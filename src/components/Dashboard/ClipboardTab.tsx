import React, { useState, useRef } from 'react';
import {
  ClipboardList,
  Check,
  Trash2,
  Image as ImageIcon,
  FileText,
  Maximize2,
  Copy,
  X,
} from 'lucide-react';
import { useIsland } from '../../context/IslandContext';
import { ClipboardItem } from '../../types';
import fileTextIcon from '../../assets/file-text.svg';
import fileLinkIcon from '../../assets/file-link.svg';
import fileImageIcon from '../../assets/file-image.svg';

export const ClipboardTab: React.FC = () => {
  const {
    clipboardItems,
    copyClipboardItem,
    deleteClipboardItem,
    clearClipboardHistory,
  } = useIsland();

  const [filter, setFilter] = useState<'all' | 'text' | 'image'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<ClipboardItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const handleCopy = async (item: ClipboardItem) => {
    const success = await copyClipboardItem(item);
    if (success) {
      setCopiedId(item.id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === item.id ? null : prev));
      }, 1500);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current && (e.deltaY !== 0 || e.deltaX !== 0)) {
      scrollContainerRef.current.scrollLeft += e.deltaY || e.deltaX;
    }
  };

  const textCount = clipboardItems.filter((i) => i.type === 'text').length;
  const imageCount = clipboardItems.filter((i) => i.type === 'image').length;

  const filteredItems = clipboardItems.filter((item) => {
    if (filter === 'text' && item.type !== 'text') return false;
    if (filter === 'image' && item.type !== 'image') return false;
    return true;
  });

  return (
    <div className="relative flex h-full flex-col justify-between space-y-1.5 select-none px-0.5">
      {/* Header Bar: Title + Filter Pills + Clear All */}
      <div className="flex shrink-0 items-center justify-between pt-0.5">
        <div className="flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[12px] font-semibold tracking-tight text-white/95">
            Clipboard
          </span>
          <span className="rounded-full bg-white/[0.08] px-1.5 py-0.2 text-[9px] font-medium text-white/60">
            {clipboardItems.length}
          </span>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center rounded-xl bg-white/[0.05] p-0.5 text-[10px] font-medium">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-lg px-2.5 py-0.5 transition-all ${
              filter === 'all'
                ? 'bg-white/20 font-semibold text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            All ({clipboardItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('text')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-0.5 transition-all ${
              filter === 'text'
                ? 'bg-cyan-500/30 font-semibold text-cyan-200 shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <FileText className="h-2.5 w-2.5" />
            <span>Text ({textCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('image')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-0.5 transition-all ${
              filter === 'image'
                ? 'bg-violet-500/30 font-semibold text-violet-200 shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <ImageIcon className="h-2.5 w-2.5" />
            <span>Screenshots ({imageCount})</span>
          </button>
        </div>

        {/* Clear All Action */}
        <div className="flex items-center gap-1.5">
          {clipboardItems.length > 0 && (
            <>
              {showClearConfirm ? (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-red-300">Hapus semua?</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearClipboardHistory();
                      setShowClearConfirm(false);
                    }}
                    className="rounded-full bg-red-500/80 px-2 py-0.5 text-[9px] font-semibold text-white transition-colors hover:bg-red-500"
                  >
                    Ya
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="rounded-full bg-white/[0.1] px-1.5 py-0.5 text-[9px] text-white/70 hover:bg-white/[0.18]"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  title="Hapus semua riwayat clipboard"
                  className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/70 transition-colors hover:bg-red-500/20 hover:text-red-300"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                  <span>Clear All</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Horizontal Box Cards Scrolling Area */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden pb-1 pt-1 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
      >
        {filteredItems.length === 0 ? (
          <div className="flex h-full min-h-[130px] w-full flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
              <ClipboardList className="h-4 w-4" />
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-white/80">
              Belum ada clipboard tersimpan
            </p>
            <p className="mt-0.5 text-[9px] text-white/40">
              Salin teks (Ctrl+C) atau screenshot (Win+Shift+S)
            </p>
          </div>
        ) : (
          <div className="flex h-full items-stretch gap-2.5 pr-1">
            {filteredItems.map((item) => {
              const isCopied = copiedId === item.id;

              return (
                <div
                  key={item.id}
                  className="group relative flex h-full w-[136px] shrink-0 flex-col justify-between rounded-xl p-2 transition-all hover:bg-white/[0.04]"
                >
                  {/* Top Bar inside Card: Expand (for images) + Delete (top right) */}
                  <div className="flex items-center justify-between">
                    {item.type === 'image' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewItem(item);
                        }}
                        title="Perbesar screenshot"
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.04] text-white/40 transition-all hover:bg-violet-500/25 hover:text-violet-200"
                      >
                        <Maximize2 className="h-2.5 w-2.5" />
                      </button>
                    ) : (
                      <span className="text-[8px] font-mono uppercase text-white/20">
                        {item.isUrl ? 'LINK' : 'TEXT'}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteClipboardItem(item.id);
                      }}
                      title="Hapus"
                      className="flex h-5 w-5 items-center justify-center rounded-md text-white/30 transition-all hover:bg-red-500/20 hover:text-red-300"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>

                  {/* Center: Clickable Thumbnail Icon (Copies to Clipboard on Click) */}
                  <div
                    onClick={() => handleCopy(item)}
                    className="relative flex flex-1 cursor-pointer flex-col items-center justify-center py-1 transition-transform active:scale-95 group-hover:scale-105"
                    title="Klik icon untuk salin ke clipboard"
                  >
                    <img
                      src={
                        item.type === 'image'
                          ? fileImageIcon
                          : item.isUrl
                          ? fileLinkIcon
                          : fileTextIcon
                      }
                      alt={
                        item.type === 'image'
                          ? 'Image File'
                          : item.isUrl
                          ? 'Link File'
                          : 'Text File'
                      }
                      className="h-[56px] w-[46px] object-contain drop-shadow select-none pointer-events-none"
                    />

                    {/* Copied Feedback Overlay on the Icon */}
                    {isCopied && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-emerald-950/85 border border-emerald-400/50 backdrop-blur-xs">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-300">
                          <Check className="h-3 w-3" />
                          <span>Tersalin!</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom: Description Under Thumbnail */}
                  <div
                    onClick={() => handleCopy(item)}
                    className="mt-1 flex cursor-pointer flex-col items-center text-center"
                    title="Klik untuk salin"
                  >
                    {/* Title / snippet */}
                    <p className="line-clamp-1 w-full text-[10px] font-medium leading-tight text-white/90">
                      {item.type === 'image'
                        ? 'Screenshot'
                        : item.content.trim()}
                    </p>

                    {/* Sub-description (chars or dimensions + time ago) */}
                    <p className="mt-0.5 line-clamp-1 text-[8.5px] text-white/40">
                      {item.type === 'image'
                        ? `${
                            item.imageWidth && item.imageHeight
                              ? `${item.imageWidth}×${item.imageHeight} px`
                              : 'Screenshot'
                          } • ${formatTimeAgo(item.timestamp)}`
                        : `${item.charCount ?? item.content.length} chars • ${formatTimeAgo(
                            item.timestamp
                          )}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox / Full Screenshot Preview Modal */}
      {previewItem && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[30px] bg-black/90 p-3 backdrop-blur-md"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative flex max-h-full max-w-full flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex w-full items-center justify-between text-white/90">
              <span className="text-[11px] font-medium">
                Screenshot Preview ({previewItem.imageWidth || '—'} ×{' '}
                {previewItem.imageHeight || '—'} px)
              </span>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="rounded-full bg-white/10 p-1 text-white/70 hover:bg-white/20 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-[140px] overflow-hidden rounded-xl border border-white/20 bg-black/60 shadow-2xl">
              <img
                src={previewItem.content}
                alt="Screenshot full preview"
                className="max-h-[140px] w-auto object-contain"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleCopy(previewItem);
                  setPreviewItem(null);
                }}
                className="flex items-center gap-1.5 rounded-full bg-cyan-600 px-3 py-1 text-[11px] font-semibold text-white shadow hover:bg-cyan-500"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Salin Screenshot</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteClipboardItem(previewItem.id);
                  setPreviewItem(null);
                }}
                className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/20"
              >
                <Trash2 className="h-3 w-3" />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
