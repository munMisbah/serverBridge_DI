import {
  paintNoteSnapshot,
  paintServerSnapshot,
  playGenie,
  type GenieDirection,
  type GenieRect,
} from './genie';
import { getIslandHitRect } from './hitTest';
import { NOTE_COLORS, NOTE_THEME } from '../utils/notes';
import { isRichNote, noteSnapshotLines, noteToText } from '../utils/richText';
import { formatBytes, globalSnapshotCache } from '../components/Servers/serverMetrics';
import { hexToRgba, resolveGlassTheme } from '../utils/glassTheme';
import type { NoteItem, ServerConfig, UserSettings } from '../types';

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function isRectOnPrimaryMonitor(rect: GenieRect): boolean {
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;
  return (
    rect.x + rect.w > 0 &&
    rect.x < vw &&
    rect.y + rect.h > 0 &&
    rect.y < vh
  );
}

export function getIslandGenieAnchor(): { x: number; y: number } {
  const hit = getIslandHitRect();
  if (hit && hit.width > 0) {
    return {
      x: Math.round(hit.x + hit.width / 2),
      y: Math.round(hit.y + Math.min(28, hit.height / 2)),
    };
  }
  return {
    x: Math.round((window.innerWidth || 1280) / 2),
    y: 26,
  };
}

export function playFloatingNoteGenie(
  note: NoteItem,
  direction: GenieDirection,
  rect: GenieRect,
  settings: UserSettings,
  onAlmostDone?: () => void
): Promise<void> {
  if (settings.reducedMotionEnabled || !isRectOnPrimaryMonitor(rect)) {
    onAlmostDone?.();
    return Promise.resolve();
  }

  const isDarkGlass = (settings.noteStyle ?? 'classic') === 'dark-glass';
  const backdrop = settings.settingsBackdrop ?? 'acrylic';
  const glassCfg = resolveGlassTheme(backdrop, settings.glassTheme);
  const noteSnapAlpha = Math.max(
    78,
    glassCfg.separateNotes ? glassCfg.notesOpacity : glassCfg.opacity
  );
  const baseTheme = NOTE_THEME[note.color] ?? NOTE_THEME.yellow;

  const theme = isDarkGlass
    ? {
        bg: hexToRgba(glassCfg.tintColor, noteSnapAlpha),
        border: `rgba(255, 255, 255, ${(Math.max(8, glassCfg.borderOpacity) / 100).toFixed(2)})`,
        text: 'rgba(255, 255, 255, 0.92)',
        muted: 'rgba(255, 255, 255, 0.55)',
      }
    : {
        bg: baseTheme.bg,
        border: baseTheme.border,
        text: baseTheme.text,
        muted: baseTheme.muted,
      };

  const plainText = isRichNote(note.content) ? noteToText(note.content) : note.content;
  const title = plainText.split('\n')[0].trim().slice(0, 28) || 'Catatan kosong';

  const snap = paintNoteSnapshot({
    width: rect.w,
    height: rect.h,
    theme,
    dots: NOTE_COLORS.map((c) => NOTE_THEME[c].dot),
    activeDot: Math.max(0, NOTE_COLORS.indexOf(note.color)),
    title,
    lines: noteSnapshotLines(note.content),
    time: formatTime(note.updatedAt),
  });

  return playGenie({
    image: snap.image,
    imgW: snap.w,
    imgH: snap.h,
    rect,
    point: getIslandGenieAnchor(),
    direction,
    duration: 380,
    onAlmostDone,
  });
}

export function playFloatingServerGenie(
  server: ServerConfig | undefined,
  serverId: string,
  direction: GenieDirection,
  rect: GenieRect,
  settings: UserSettings,
  onAlmostDone?: () => void
): Promise<void> {
  if (settings.reducedMotionEnabled || !isRectOnPrimaryMonitor(rect)) {
    onAlmostDone?.();
    return Promise.resolve();
  }

  const backdrop = settings.settingsBackdrop ?? 'acrylic';
  const glassCfg = resolveGlassTheme(backdrop, settings.glassTheme);
  const cached = globalSnapshotCache[serverId];
  const ramPercent =
    cached && cached.ramTotalBytes > 0
      ? Math.min(100, Math.max(0, (cached.ramUsedBytes / cached.ramTotalBytes) * 100))
      : 0;
  const diskPercent =
    cached && cached.diskTotalBytes > 0
      ? Math.min(100, Math.max(0, (cached.diskUsedBytes / cached.diskTotalBytes) * 100))
      : 0;
  const running = cached
    ? cached.docker.filter((c) => c.state === 'running').length
    : 0;

  const snap = paintServerSnapshot({
    width: rect.w,
    height: rect.h,
    bg: hexToRgba(glassCfg.tintColor, Math.max(82, glassCfg.opacity)),
    name: server?.name ?? 'Server Monitor',
    subtitle: server
      ? server.authType === 'bridge'
        ? `Bridge · ${server.host}:${server.port}`
        : `${server.username}@${server.host}:${server.port}`
      : 'Server Monitor',
    online: Boolean(cached),
    cpuPercent: cached?.cpuPercent ?? 0,
    ramPercent,
    diskPercent,
    ramLabel: cached ? formatBytes(cached.ramUsedBytes) : '--',
    diskLabel: cached ? formatBytes(cached.diskUsedBytes) : '--',
    dockerSummary: cached ? `Docker ${running}/${cached.docker.length}` : 'Docker',
    containers: cached
      ? cached.docker.slice(0, 6).map((c) => ({ name: c.name, state: c.state }))
      : [],
  });

  return playGenie({
    image: snap.image,
    imgW: snap.w,
    imgH: snap.h,
    rect,
    point: getIslandGenieAnchor(),
    direction,
    duration: 380,
    onAlmostDone,
  });
}
