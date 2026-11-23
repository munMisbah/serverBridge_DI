import type React from 'react';
import type { GlassThemeConfig, SettingsBackdrop } from '../types';

export interface GlassTintPreset {
  id: string;
  label: string;
  color: string;
}

export const GLASS_TINT_PRESETS: GlassTintPreset[] = [
  { id: 'obsidian', label: 'Hitam Pekat', color: '#050608' },
  { id: 'charcoal', label: 'Charcoal', color: '#0c0e14' },
  { id: 'slate', label: 'Slate', color: '#141d2c' },
  { id: 'navy', label: 'Midnight Navy', color: '#0d172e' },
  { id: 'emerald', label: 'Emerald Dark', color: '#091b16' },
  { id: 'plum', label: 'Plum Dark', color: '#1a1026' },
];

export function getDefaultGlassTheme(backdrop: SettingsBackdrop): GlassThemeConfig {
  switch (backdrop) {
    case 'acrylic':
      return {
        tintColor: '#06070a',
        opacity: 68,
        borderOpacity: 12,
        separateNotes: false,
        notesOpacity: 68,
      };
    case 'slate':
      return {
        tintColor: '#141d2c',
        opacity: 48,
        borderOpacity: 14,
        separateNotes: false,
        notesOpacity: 48,
      };
    case 'mica':
      return {
        tintColor: '#0b0c10',
        opacity: 22,
        borderOpacity: 10,
        separateNotes: false,
        notesOpacity: 22,
      };
    case 'tabbed':
      return {
        tintColor: '#0b0c10',
        opacity: 28,
        borderOpacity: 10,
        separateNotes: false,
        notesOpacity: 28,
      };
    case 'solid':
      return {
        tintColor: '#0c0d12',
        opacity: 100,
        borderOpacity: 10,
        separateNotes: false,
        notesOpacity: 100,
      };
  }
}

export function resolveGlassTheme(
  backdrop: SettingsBackdrop,
  custom?: Partial<GlassThemeConfig>
): GlassThemeConfig {
  const base = getDefaultGlassTheme(backdrop);
  if (!custom) return base;
  return {
    tintColor: custom.tintColor || base.tintColor,
    opacity: typeof custom.opacity === 'number' ? custom.opacity : base.opacity,
    borderOpacity:
      typeof custom.borderOpacity === 'number' ? custom.borderOpacity : base.borderOpacity,
    separateNotes: Boolean(custom.separateNotes),
    notesOpacity:
      typeof custom.notesOpacity === 'number' ? custom.notesOpacity : base.notesOpacity,
  };
}

export function hexToRgba(hex: string, alphaPercent: number): string {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(1, alphaPercent / 100));
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

export function resolveGlassSurfaceStyle(
  backdrop: SettingsBackdrop,
  custom: Partial<GlassThemeConfig> | undefined,
  target: 'window' | 'note'
): React.CSSProperties {
  const cfg = resolveGlassTheme(backdrop, custom);
  const effectiveOpacity =
    backdrop === 'solid'
      ? 100
      : target === 'note' && cfg.separateNotes
        ? cfg.notesOpacity
        : cfg.opacity;
  const borderAlpha = Math.max(0, Math.min(0.6, cfg.borderOpacity / 100));

  return {
    backgroundColor: hexToRgba(cfg.tintColor, effectiveOpacity),
    boxShadow:
      borderAlpha > 0
        ? `inset 0 0 0 1px rgba(255, 255, 255, ${borderAlpha.toFixed(3)})`
        : undefined,
  };
}
