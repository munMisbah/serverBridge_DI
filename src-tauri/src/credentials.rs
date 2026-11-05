use zeroize::Zeroize;

/// All credentials this app stores live under one namespace so a compromised
/// renderer cannot ask the backend to touch arbitrary Windows credentials.
const TARGET_PREFIX: &str = "di-win/ssh/";
const MAX_SECRET_BYTES: usize = 2560; // CRED_MAX_CREDENTIAL_BLOB_SIZE

pub(crate) fn credential_target(server_id: &str) -> String {
    format!("{}{}", TARGET_PREFIX, server_id)
}

fn validate_server_id(server_id: &str) -> Result<(), String> {
    if server_id.is_empty()
        || server_id.len() > 100
        || server_id.contains('/')
        || server_id.contains('\\')
        || server_id.contains('\0')
    {
        return Err("Invalid server id".into());
    }
    Ok(())
}

fn target_for(server_id: &str) -> Result<String, String> {
    validate_server_id(server_id)?;
    Ok(credential_target(server_id))
}

/// Store an SSH password or key passphrase in Windows Credential Manager.
/// The `identity` string (host:port:username) is persisted as the credential
/// comment and verified on every read, so a credential cannot be replayed
/// against a different server.
pub(crate) fn save_stored_credential(
    server_id: &str,
    username: &str,
    identity: &str,
    mut secret: String,
) -> Result<(), String> {
    let result = (|| {
        let target = target_for(server_id)?;
        if username.is_empty() || username.len() > 256 {
            return Err("Invalid credential username".into());
        }
        if identity.is_empty() || identity.len() > 256 {
            return Err("Invalid credential identity".into());
        }
        if secret.is_empty() || secret.len() > MAX_SECRET_BYTES {
            return Err("Invalid credential secret length".into());
        }
        save_impl(&target, username, &secret, identity)
    })();
    secret.zeroize();
    result
}

pub(crate) fn delete_stored_credential(server_id: &str) -> Result<(), String> {
    delete_impl(&target_for(server_id)?)
}

/// Internal read path. Deliberately NOT a Tauri command: the plaintext secret
/// must never cross the IPC boundary back to the WebView.
pub(crate) fn read_credential_for(
    server_id: &str,
    identity: &str,
) -> Result<Option<String>, String> {
    read_impl(&target_for(server_id)?, identity)
}

#[cfg(target_os = "windows")]
fn save_impl(target: &str, username: &str, secret: &str, identity: &str) -> Result<(), String> {
    use windows::core::PWSTR;
    use windows::Win32::Security::Credentials::{
        CredWriteW, CREDENTIALW, CRED_FLAGS, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    };

    let mut target_w: Vec<u16> = target.encode_utf16().chain(std::iter::once(0)).collect();
    let mut username_w: Vec<u16> = username.encode_utf16().chain(std::iter::once(0)).collect();
    let mut comment_w: Vec<u16> = identity.encode_utf16().chain(std::iter::once(0)).collect();
    let mut blob = secret.as_bytes().to_vec();

    let credential = CREDENTIALW {
        Flags: CRED_FLAGS(0),
        Type: CRED_TYPE_GENERIC,
        TargetName: PWSTR(target_w.as_mut_ptr()),
        Comment: PWSTR(comment_w.as_mut_ptr()),
        LastWritten: Default::default(),
        CredentialBlobSize: blob.len() as u32,
        CredentialBlob: blob.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        AttributeCount: 0,
        Attributes: std::ptr::null_mut(),
        TargetAlias: PWSTR::null(),
        UserName: PWSTR(username_w.as_mut_ptr()),
    };

    let result = unsafe { CredWriteW(&credential, 0) }
        .map_err(|e| format!("Credential Manager write failed: {}", e));
    blob.zeroize();
    result
}

#[cfg(target_os = "windows")]
fn read_impl(target: &str, identity: &str) -> Result<Option<String>, String> {
    use windows::core::PCWSTR;
    use windows::Win32::Security::Credentials::{
        CredFree, CredReadW, CREDENTIALW, CRED_TYPE_GENERIC,
    };

    let target_w: Vec<u16> = target.encode_utf16().chain(std::iter::once(0)).collect();
    let mut credential: *mut CREDENTIALW = std::ptr::null_mut();

    let read = unsafe {
        CredReadW(
            PCWSTR(target_w.as_ptr()),
            CRED_TYPE_GENERIC,
            0,
            &mut credential,
        )
    };
    if read.is_err() || credential.is_null() {
        return Ok(None);
    }

    let (bytes, stored_identity) = unsafe {
        let raw = credential;
        let credential_ref = &*raw;
        let bytes = std::slice::from_raw_parts(
            credential_ref.CredentialBlob,
            credential_ref.CredentialBlobSize as usize,
        )
        .to_vec();
        let comment = if credential_ref.Comment.is_null() {
            String::new()
        } else {
            credential_ref.Comment.to_string().unwrap_or_default()
        };
        CredFree(raw as *const _);
        (bytes, comment)
    };

    if stored_identity != identity {
        return Err(
            "Credential tersimpan terikat ke host/username lain; simpan ulang secret.".into(),
        );
    }

    let mut secret = String::from_utf8(bytes)
        .map_err(|_| "Stored credential is not valid UTF-8".to_string())?;
    let value = secret.clone();
    secret.zeroize();
    Ok(Some(value))
}

#[cfg(target_os = "windows")]
fn delete_impl(target: &str) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::Security::Credentials::{CredDeleteW, CRED_TYPE_GENERIC};

    const ERROR_NOT_FOUND_HRESULT: i32 = 0x8007_0490u32 as i32;
    let target_w: Vec<u16> = target.encode_utf16().chain(std::iter::once(0)).collect();
    match unsafe { CredDeleteW(PCWSTR(target_w.as_ptr()), CRED_TYPE_GENERIC, 0) } {
        Ok(()) => Ok(()),
        Err(e) if e.code().0 == ERROR_NOT_FOUND_HRESULT => Ok(()),
        Err(e) => Err(format!("Credential Manager delete failed: {}", e)),
    }
}

#[cfg(not(target_os = "windows"))]
fn save_impl(_target: &str, _username: &str, _secret: &str, _identity: &str) -> Result<(), String> {
    Err("Windows Credential Manager is only available on Windows".into())
}

#[cfg(not(target_os = "windows"))]
fn read_impl(_target: &str, _identity: &str) -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(not(target_os = "windows"))]
fn delete_impl(_target: &str) -> Result<(), String> {
    Ok(())
}