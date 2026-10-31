import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { SlashItem } from '../../utils/slashMenu';

type SlashMenuProps = {
  items: SlashItem[];
  activeIndex: number;
  /** Caret position in viewport coordinates. */
  anchor: { x: number; y: number };
  /** Max height before the list scrolls. */
  maxHeight: number;
  onSelect: (item: SlashItem) => void;
  onHover: (index: number) => void;
};

/**
 * Floating command list for the "/" menu.
 *
 * Rendered through a portal: the note card is a transformed, overflow-hidden
 * element, so a fixed-position child would be positioned against the card and
 * clipped by it. In `document.body` the menu is viewport-relative as intended.
 */
export const SlashMenu: React.FC<SlashMenuProps> = ({
  items,
  activeIndex,
  anchor,
  maxHeight,
  onSelect,
  onHover,
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const width = 196;
  const left = Math.max(8, Math.min(anchor.x, window.innerWidth - width - 8));
  const openUp = anchor.y + maxHeight + 16 > window.innerHeight;
  const top = openUp ? Math.max(8, anchor.y - maxHeight - 10) : anchor.y + 6;

  return createPortal(
    <div
      className="fixed z-[200] overflow-hidden rounded-xl border border-white/10 bg-[#1b1b20] p-1 shadow-[0_16px_36px_rgba(0,0,0,0.55)]"
      style={{ left, top, width }}
      // Keep the caret and selection alive while clicking an item.
      onPointerDown={(e) => e.preventDefault()}
      role="listbox"
      aria-label="Sisipkan blok"
    >
      {items.length === 0 ? (
        <div className="px-2 py-2 text-[11px] leading-snug text-white/40">
          Tidak ada blok yang cocok.
          <span className="mt-1 block text-[9px] text-white/25">
            Tekan Enter untuk membatalkan, atau Esc.
          </span>
        </div>
      ) : (
        <div ref={listRef} className="overflow-y-auto" style={{ maxHeight }}>
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              data-index={index}
              role="option"
              aria-selected={index === activeIndex}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onSelect(item)}
              onPointerEnter={() => onHover(index)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                index === activeIndex ? 'bg-white/12' : 'hover:bg-white/8'
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-medium text-white/90">
                  {item.label}
                </span>
                <span className="block truncate text-[9px] text-white/40">{item.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
};
