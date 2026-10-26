@echo off
title Dynamic Island for Windows 11 - Build Installer
echo ===================================================
echo   Dynamic Island for Windows 11 - Release Build
echo ===================================================
echo Building React frontend and Tauri Windows executable...
call npm run tauri:build
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================
    echo   BUILD SUCCESSFUL!
    echo   Installer binary located at:
    echo   src-tauri\target\release\bundle\nsis\
    echo   src-tauri\target\release\bundle\msi\
    echo ===================================================
) else (
    echo.
    echo Build failed. Please check build logs above.
)
pause
