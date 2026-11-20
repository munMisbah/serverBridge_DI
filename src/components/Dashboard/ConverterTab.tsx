import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import {
  Image as ImageIcon,
  Upload,
  FolderOpen,
  FolderInput,
  Download,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  RotateCcw,
  X,
} from 'lucide-react';
import { ImageConvertFormat } from '../../types';
import { useIsland } from '../../context/IslandContext';
import { setCollapseSuppressed } from '../../lib/hitTest';

interface BrowserDirectoryHandle {
  name: string;
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

interface ConvertedEntry {
  id: string;
  sourceName: string;
  fileName: string;
  format: ImageConvertFormat;
  originalBytes: number;
  convertedBytes: number;
  outputPath?: string;
  savedToDirName?: string;
  downloadUrl?: string;
  width?: number;
  height?: number;
}

interface TauriConvertedResult {
  outputPath: string;
  fileName: string;
  format: string;
  originalBytes: number;
  convertedBytes: number;
  width: number;
  height: number;
}

const TARGET_FORMATS: { id: ImageConvertFormat; label: string; hint: string }[] = [
  { id: 'webp', label: 'WEBP', hint: 'Ringan · Web' },
  { id: 'jpg', label: 'JPG', hint: 'Kompatibel' },
  { id: 'png', label: 'PNG', hint: 'Lossless' },
  { id: 'avif', label: 'AVIF', hint: 'Ultra kecil' },
];

const QUALITY_PRESETS = [65, 82, 92, 100];

const isSupportedInputName = (name: string) => /\.(jpe?g|png)$/i.test(name);

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const shortenPath = (fullPath: string): string => {
  const parts = fullPath.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return fullPath;
  return `…\\${parts.slice(-2).join('\\')}`;
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const idx = res.indexOf(',');
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });

const convertInBrowser = async (
  file: File,
  format: ImageConvertFormat,
  quality: number,
  dirHandle: BrowserDirectoryHandle | null
): Promise<ConvertedEntry> => {
  const mimeMap: Record<ImageConvertFormat, string> = {
    webp: 'image/webp',
    jpg: 'image/jpeg',
    png: 'image/png',
    avif: 'image/avif',
  };

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context tidak tersedia.');

  if (format === 'jpg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const targetMime = mimeMap[format];
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, targetMime, format === 'png' ? undefined : quality / 100)
  );

  if (!blob) {
    throw new Error(`Browser tidak mendukung encode ke ${format.toUpperCase()}.`);
  }
  if (format === 'avif' && blob.type !== 'image/avif') {
    throw new Error(
      'Encode AVIF di mode browser belum didukung engine ini — jalankan via aplikasi desktop Tauri untuk AVIF native.'
    );
  }

  const stem = file.name.replace(/\.[^.]+$/, '') || 'image';
  const fileName = `${stem}.${format}`;
  const downloadUrl = URL.createObjectURL(blob);

  let savedToDirName: string | undefined;
  if (dirHandle) {
    const fh = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fh.createWritable();
    await writable.write(blob);
    await writable.close();
    savedToDirName = dirHandle.name;
  } else {
    // Best-practice browser default: auto-save to Downloads immediately after conversion
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    a.click();
  }

  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sourceName: file.name,
    fileName,
    format,
    originalBytes: file.size,
    convertedBytes: blob.size,
    savedToDirName,
    downloadUrl,
    width: canvas.width,
    height: canvas.height,
  };
};

export const ConverterTab: React.FC = () => {
  const { isDraggingImageFile, setIsDraggingImageFile, settings, updateSettings } = useIsland();
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  const [isDragging, setIsDragging] = useState(isDraggingImageFile);
  const [hoveredFormat, setHoveredFormat] = useState<ImageConvertFormat | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState<number>(82);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ConvertedEntry[]>([]);
  const [defaultTauriDir, setDefaultTauriDir] = useState<string>('Pictures\\DynamicIsland-Converted');
  const [browserDirHandle, setBrowserDirHandle] = useState<BrowserDirectoryHandle | null>(null);
  const [pickingFolder, setPickingFolder] = useState(false);

  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const bucketRefs = useRef<Record<ImageConvertFormat, HTMLButtonElement | null>>({
    webp: null,
    jpg: null,
    png: null,
    avif: null,
  });
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const outputDirRef = useRef(settings.converterOutputDir ?? null);
  outputDirRef.current = settings.converterOutputDir ?? null;
  const browserDirRef = useRef(browserDirHandle);
  browserDirRef.current = browserDirHandle;
  const resultsRef = useRef(results);
  resultsRef.current = results;

  // Fetch best-practice default save directory in Tauri
  useEffect(() => {
    if (!isTauri) return;
    invoke<string>('get_default_converter_dir')
      .then((dir) => {
        if (dir) setDefaultTauriDir(dir);
      })
      .catch(() => {});
  }, [isTauri]);

  const clearResults = useCallback(() => {
    resultsRef.current.forEach((r) => {
      if (r.downloadUrl) URL.revokeObjectURL(r.downloadUrl);
    });
    setResults([]);
  }, []);

  const appendResults = useCallback((nextEntries: ConvertedEntry[]) => {
    setResults((prev) => {
      const combined = [...nextEntries, ...prev];
      const evicted = combined.slice(12);
      evicted.forEach((r) => {
        if (r.downloadUrl) URL.revokeObjectURL(r.downloadUrl);
      });
      return combined.slice(0, 12);
    });
  }, []);

  useEffect(() => {
    return () => {
      resultsRef.current.forEach((r) => {
        if (r.downloadUrl) URL.revokeObjectURL(r.downloadUrl);
      });
    };
  }, []);

  const convertBrowserFiles = useCallback(
    async (files: File[], targetFormat: ImageConvertFormat) => {
      const valid = files.filter((f) => isSupportedInputName(f.name));
      if (valid.length === 0) {
        setError('Hanya menerima file JPG atau PNG.');
        return;
      }

      setError(null);
      setConverting(true);
      const nextEntries: ConvertedEntry[] = [];

      try {
        for (const file of valid) {
          if (isTauri) {
            const dataBase64 = await fileToBase64(file);
            const res = await invoke<TauriConvertedResult>('convert_image_bytes', {
              dataBase64,
              fileName: file.name,
              targetFormat,
              quality: qualityRef.current,
              outputDir: outputDirRef.current,
            });
            nextEntries.push({
              id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              sourceName: file.name,
              fileName: res.fileName,
              format: targetFormat,
              originalBytes: res.originalBytes,
              convertedBytes: res.convertedBytes,
              outputPath: res.outputPath,
              width: res.width,
              height: res.height,
            });
          } else {
            const entry = await convertInBrowser(
              file,
              targetFormat,
              qualityRef.current,
              browserDirRef.current
            );
            nextEntries.push(entry);
          }
        }
        appendResults(nextEntries);
        setPendingFiles([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setConverting(false);
      }
    },
    [isTauri, appendResults]
  );

  const convertTauriPaths = useCallback(
    async (paths: string[], targetFormat: ImageConvertFormat) => {
      const valid = paths.filter((p) => isSupportedInputName(p));
      if (valid.length === 0) {
        setError('Hanya menerima file JPG atau PNG.');
        return;
      }

      setError(null);
      setConverting(true);
      const nextEntries: ConvertedEntry[] = [];

      try {
        for (const inputPath of valid) {
          const res = await invoke<TauriConvertedResult>('convert_image_path', {
            inputPath,
            targetFormat,
            quality: qualityRef.current,
            outputDir: outputDirRef.current,
          });
          const sourceName = inputPath.split(/[\\/]/).pop() || inputPath;
          nextEntries.push({
            id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sourceName,
            fileName: res.fileName,
            format: targetFormat,
            originalBytes: res.originalBytes,
            convertedBytes: res.convertedBytes,
            outputPath: res.outputPath,
            width: res.width,
            height: res.height,
          });
        }
        appendResults(nextEntries);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setConverting(false);
      }
    },
    [appendResults]
  );

  // Listen to native OS file drag-and-drop in Tauri so hovering from Windows Explorer
  // immediately reveals the 4 format drop buckets and highlights whichever one is under cursor.
  useEffect(() => {
    if (!isTauri) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const hitFormatAt = (clientX: number, clientY: number): ImageConvertFormat | null => {
      for (const fmt of TARGET_FORMATS) {
        const el = bucketRefs.current[fmt.id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
          return fmt.id;
        }
      }
      return null;
    };

    const isInsidePane = (clientX: number, clientY: number): boolean => {
      const el = paneRef.current;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
    };

    import('@tauri-apps/api/webview')
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent((event) => {
          if (cancelled) return;
          const payload = event.payload;
          const dpr = window.devicePixelRatio || 1;

          if (payload.type === 'enter' || payload.type === 'over') {
            const x = payload.position.x / dpr;
            const y = payload.position.y / dpr;
            const inside = isInsidePane(x, y);
            setIsDragging(inside);
            setHoveredFormat(inside ? hitFormatAt(x, y) : null);
          } else if (payload.type === 'drop') {
            const x = payload.position.x / dpr;
            const y = payload.position.y / dpr;
            const fmt = hitFormatAt(x, y);
            const inside = isInsidePane(x, y);
            setIsDragging(false);
            setHoveredFormat(null);
            if (inside && fmt && payload.paths.length > 0) {
              void convertTauriPaths(payload.paths, fmt);
            }
          } else {
            setIsDragging(false);
            setHoveredFormat(null);
          }
        })
      )
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {
        // Fallback to standard HTML5 drag-drop
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [isTauri, convertTauriPaths]);

  const handlePaneDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handlePaneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handlePaneDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
      setHoveredFormat(null);
    }
  };

  const handlePaneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    setIsDraggingImageFile(false);
    setCollapseSuppressed(false);
    setHoveredFormat(null);
  };

  const handleBucketDrop = (format: ImageConvertFormat, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    setIsDraggingImageFile(false);
    setCollapseSuppressed(false);
    setHoveredFormat(null);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) {
      void convertBrowserFiles(files, format);
    }
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => isSupportedInputName(f.name));
    e.target.value = '';
    if (files.length === 0) {
      setError('Pilih file JPG atau PNG.');
      return;
    }
    setError(null);
    setPendingFiles(files);
  };

  const handleChangeFolder = async () => {
    setError(null);
    setPickingFolder(true);
    setCollapseSuppressed(true);
    try {
      if (isTauri) {
        const chosen = await invoke<string | null>('pick_converter_output_dir', {
          initialDir: settings.converterOutputDir ?? defaultTauriDir,
        });
        if (chosen) {
          updateSettings({ converterOutputDir: chosen });
        }
      } else {
        const win = window as unknown as {
          showDirectoryPicker?: (opts?: { mode?: string }) => Promise<BrowserDirectoryHandle>;
        };
        if (typeof win.showDirectoryPicker === 'function') {
          const handle = await win.showDirectoryPicker({ mode: 'readwrite' });
          setBrowserDirHandle(handle);
        } else {
          setError(
            'Browser ini belum mendukung pemilih folder langsung — hasil otomatis disimpan ke folder Downloads browser.'
          );
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled picker
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setPickingFolder(false);
      setCollapseSuppressed(false);
    }
  };

  const handleResetFolder = () => {
    if (isTauri) {
      updateSettings({ converterOutputDir: null });
    } else {
      setBrowserDirHandle(null);
    }
  };

  const handleOpenSaveFolder = async () => {
    if (!isTauri) return;
    try {
      await invoke('open_converter_output_dir', {
        dir: settings.converterOutputDir ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleOpenOrDownload = async (item: ConvertedEntry) => {
    if (isTauri && item.outputPath) {
      try {
        await invoke('reveal_file_in_explorer', { path: item.outputPath });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return;
    }
    if (item.downloadUrl) {
      const a = document.createElement('a');
      a.href = item.downloadUrl;
      a.download = item.fileName;
      a.click();
    }
  };

  const showTargetShelf = isDragging || isDraggingImageFile || pendingFiles.length > 0;
  const hasCustomFolder = isTauri
    ? Boolean(settings.converterOutputDir)
    : Boolean(browserDirHandle);
  const activeFolderFull = isTauri
    ? settings.converterOutputDir || defaultTauriDir
    : browserDirHandle
      ? `Folder lokal: ${browserDirHandle.name}`
      : 'Downloads (Default browser)';
  const activeFolderShort = isTauri
    ? shortenPath(activeFolderFull)
    : browserDirHandle
      ? browserDirHandle.name
      : 'Downloads (Default)';

  return (
    <div
      ref={paneRef}
      onDragEnter={handlePaneDragEnter}
      onDragOver={handlePaneDragOver}
      onDragLeave={handlePaneDragLeave}
      onDrop={handlePaneDrop}
      className="relative flex h-full w-full flex-col px-4 pt-3 pb-1 text-white select-none"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        onChange={handleFilePick}
        className="hidden"
      />

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-1.5">
          <ImageIcon size={13} className="text-white/80" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">
            Image Converter
          </span>
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[8.5px] font-medium text-neutral-400">
            JPG / PNG
          </span>
        </div>

        {/* Quality Presets */}
        <div className="flex items-center gap-1">
          <span className="text-[8.5px] text-neutral-500">Quality</span>
          <div className="flex items-center rounded-lg bg-white/[0.04] p-0.5">
            {QUALITY_PRESETS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuality(q)}
                className={`rounded-md px-1.5 py-0.5 text-[8.5px] font-medium tabular-nums transition-colors ${
                  quality === q
                    ? 'bg-white/15 text-white'
                    : 'text-neutral-500 hover:text-neutral-200'
                }`}
              >
                {q}%
              </button>
            ))}
          </div>
          {results.length > 0 && !showTargetShelf && (
            <button
              type="button"
              onClick={clearResults}
              title="Bersihkan riwayat"
              className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <AnimatePresence initial={false}>
          {showTargetShelf ? (
            /* Drag-Hover / Pending Target Format Picker */
            <motion.div
              key="target-shelf"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.14 }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="mb-1.5 flex items-center justify-between px-0.5">
                <p className="text-[10px] font-medium text-white/80">
                  {isDragging || isDraggingImageFile
                    ? 'Lepas ke format tujuan:'
                    : `Pilih format untuk ${pendingFiles.length} file (${pendingFiles[0]?.name}${
                        pendingFiles.length > 1 ? ` +${pendingFiles.length - 1}` : ''
                      }):`}
                </p>
                {!isDragging && !isDraggingImageFile && pendingFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPendingFiles([])}
                    className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] text-neutral-400 hover:bg-white/10 hover:text-white"
                  >
                    <X size={10} /> Batal
                  </button>
                )}
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-4 gap-2">
                {TARGET_FORMATS.map((fmt) => {
                  const isHot = hoveredFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      ref={(el) => {
                        bucketRefs.current[fmt.id] = el;
                      }}
                      type="button"
                      disabled={converting}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setHoveredFormat(fmt.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (hoveredFormat !== fmt.id) setHoveredFormat(fmt.id);
                      }}
                      onDragLeave={() => {
                        setHoveredFormat((prev) => (prev === fmt.id ? null : prev));
                      }}
                      onDrop={(e) => handleBucketDrop(fmt.id, e)}
                      onClick={() => {
                        if (pendingFiles.length > 0) {
                          void convertBrowserFiles(pendingFiles, fmt.id);
                        }
                      }}
                      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed px-2 py-3 text-center transition-all ${
                        isHot
                          ? 'scale-[1.03] border-white/60 bg-white/[0.14] text-white shadow-lg'
                          : 'border-white/20 bg-white/[0.04] text-white/80 hover:border-white/45 hover:bg-white/[0.10] hover:text-white'
                      }`}
                    >
                      <span className="pointer-events-none text-[13px] font-bold tracking-wide">
                        {fmt.label}
                      </span>
                      <span className="pointer-events-none mt-0.5 text-[8.5px] text-neutral-400">
                        {fmt.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            /* Idle Dropzone + Recent Conversions */
            <motion.div
              key="idle-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="flex min-h-0 flex-1 gap-2.5"
            >
              {/* Left: Drop trigger */}
              <button
                type="button"
                disabled={converting}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-3 text-center transition-colors hover:border-white/30 hover:bg-white/[0.06] ${
                  results.length > 0 ? 'w-[185px] shrink-0' : 'w-full'
                }`}
              >
                {converting ? (
                  <>
                    <Loader2 size={18} className="mb-1.5 animate-spin text-white/70" />
                    <p className="text-[10.5px] font-semibold text-white/85">Mengonversi…</p>
                  </>
                ) : (
                  <>
                    <Upload size={17} className="mb-1.5 text-white/65" />
                    <p className="text-[10.5px] font-semibold text-white/90">
                      Drag JPG / PNG ke sini
                    </p>
                    <p className="mt-0.5 text-[8.5px] leading-snug text-neutral-500">
                      Hover untuk pilih target WEBP · JPG · PNG · AVIF, atau klik pilih file
                    </p>
                  </>
                )}
              </button>

              {/* Right: Recent Converted List */}
              {results.length > 0 && (
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
                    {results.map((item) => {
                      const delta =
                        item.originalBytes > 0
                          ? Math.round(
                              ((item.convertedBytes - item.originalBytes) / item.originalBytes) *
                                100
                            )
                          : 0;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-2.5 py-1.5 transition-colors hover:bg-white/[0.07]"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
                            <Check size={11} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[10px] font-semibold text-white/90">
                              {item.fileName}
                            </p>
                            <p className="truncate text-[8.5px] tabular-nums text-neutral-400">
                              {formatSize(item.originalBytes)} → {formatSize(item.convertedBytes)}
                              <span
                                className={`ml-1 font-medium ${
                                  delta <= 0 ? 'text-emerald-400' : 'text-amber-300'
                                }`}
                              >
                                ({delta <= 0 ? `${delta}%` : `+${delta}%`})
                              </span>
                              {item.savedToDirName && (
                                <span className="ml-1 text-neutral-500">
                                  · {item.savedToDirName}
                                </span>
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleOpenOrDownload(item)}
                            title={isTauri ? 'Buka di Explorer' : 'Download ulang'}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/75 transition-colors hover:bg-white/15 hover:text-white"
                          >
                            {isTauri ? <FolderOpen size={11} /> : <Download size={11} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save Location Bar */}
        <div className="mt-2 flex shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.03] px-2.5 py-1 text-[9px]">
          <FolderOpen size={11} className="shrink-0 text-neutral-400" />
          <span className="shrink-0 text-neutral-500">Simpan ke:</span>
          <span
            title={activeFolderFull}
            className="min-w-0 flex-1 truncate font-medium text-white/80"
          >
            {activeFolderShort}
          </span>
          {isTauri && (
            <button
              type="button"
              onClick={() => void handleOpenSaveFolder()}
              title="Buka folder tujuan di Explorer"
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[8.5px] text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              Buka
            </button>
          )}
          {hasCustomFolder && (
            <button
              type="button"
              onClick={handleResetFolder}
              title="Kembalikan ke folder default"
              className="flex shrink-0 items-center justify-center rounded-md p-1 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <RotateCcw size={10} />
            </button>
          )}
          <button
            type="button"
            disabled={pickingFolder}
            onClick={() => void handleChangeFolder()}
            title="Ubah lokasi folder simpan"
            className="flex shrink-0 items-center gap-1 rounded-md bg-white/[0.08] px-2 py-0.5 text-[8.5px] font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-50"
          >
            <FolderInput size={10} />
            Ubah
          </button>
        </div>

        {/* Inline Error Toast */}
        {error && (
          <div className="mt-1.5 flex shrink-0 items-center gap-1.5 rounded-lg bg-red-500/15 px-2.5 py-1 text-[9px] text-red-200">
            <AlertCircle size={11} className="shrink-0 text-red-400" />
            <span className="min-w-0 flex-1 truncate">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-300 hover:text-white"
            >
              <X size={10} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
