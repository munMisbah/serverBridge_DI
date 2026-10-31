import type { NoteColor } from '../types';

export const NOTE_COLORS: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'purple'];

export interface NoteTheme {
  bg: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  dot: string;
}

export const NOTE_THEME: Record<NoteColor, NoteTheme> = {
  yellow: {
    bg: '#fef3c7',
    border: '#fde68a',
    text: '#3f3a1f',
    muted: 'rgba(63, 58, 31, 0.55)',
    accent: '#d97706',
    dot: '#fbbf24',
  },
  pink: {
    bg: '#fce7f3',
    border: '#fbcfe8',
    text: '#4a1d33',
    muted: 'rgba(74, 29, 51, 0.55)',
    accent: '#db2777',
    dot: '#f472b6',
  },
  blue: {
    bg: '#dbeafe',
    border: '#bfdbfe',
    text: '#1e3a5f',
    muted: 'rgba(30, 58, 95, 0.55)',
    accent: '#2563eb',
    dot: '#60a5fa',
  },
  green: {
    bg: '#d1fae5',
    border: '#a7f3d0',
    text: '#14432a',
    muted: 'rgba(20, 67, 42, 0.55)',
    accent: '#059669',
    dot: '#34d399',
  },
  purple: {
    bg: '#ede9fe',
    border: '#ddd6fe',
    text: '#3b2d6b',
    muted: 'rgba(59, 45, 107, 0.55)',
    accent: '#7c3aed',
    dot: '#a78bfa',
  },
};

export const NOTE_MIN_WIDTH = 168;
export const NOTE_MIN_HEIGHT = 132;
export const NOTE_DEFAULT_WIDTH = 224;
export const NOTE_DEFAULT_HEIGHT = 188;
