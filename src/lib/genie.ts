/**
 * macOS-style genie effect for the sticky notes.
 *
 * The technique is the same one ui-layouts uses for their "Mac Genie"
 * component: rasterize the note once, then redraw it as 1px scanlines whose
 * horizontal extent converges into (or fans out of) a single anchor point.
 * Drawing happens on one shared full-viewport canvas, so there is no extra
 * DOM per note and nothing is rendered while no animation is running.
 */

import type { NoteSnapshotLine } from '../utils/richText';

export type GenieDirection = 'open' | 'minimize';

export interface GenieRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GeniePoint {
  x: number;
  y: number;
}

export interface NoteSnapshot {
  image: CanvasImageSource;
  w: number;
  h: number;
}

interface GenieTask {
  image: CanvasImageSource;
  imgW: number;
  imgH: number;
  rect: GenieRect;
  point: GeniePoint;
  direction: GenieDirection;
  duration: number;
  start: number;
  onAlmostDone?: () => void;
  resolve: () => void;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let dpr = 1;
let frameId = 0;
const tasks: GenieTask[] = [];

const ensureCanvas = (): CanvasRenderingContext2D | null => {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:70;display:block;';
    document.body.appendChild(canvas);
  }

  dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.round(window.innerWidth * dpr);
  const height = Math.round(window.innerHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx = canvas.getContext('2d');
  return ctx;
};

const smoothstep = (x: number) => {
  const c = clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
};

const drawTask = (
  c: CanvasRenderingContext2D,
  task: GenieTask,
  progress: number
) => {
  const { rect, point, direction, image, imgW, imgH } = task;
  const rows = Math.max(48, Math.round(rect.h / 2.5));
  const rowH = rect.h / rows;

  // Muelle-inspired two-phase liquid funnel Genie (adapted to flow UPWARD into the top Island):
  // t = 0 is untouched window; t = 1 is fully sucked into the Island slot.
  const t = direction === 'minimize' ? progress : 1 - progress;
  const bend = smoothstep(t / 0.5);
  const slideRaw = clamp((t - 0.15) / 0.85, 0, 1);
  const slide = slideRaw * slideRaw;

  const slotTop = point.y - 4;
  const slotHalfW = 14;
  const slotLeft = point.x - slotHalfW;
  const slotRight = point.x + slotHalfW;

  const winLeft = rect.x;
  const winRight = rect.x + rect.w;
  const winTop = rect.y;
  const winBottom = rect.y + rect.h;
  const span = Math.max(1, winBottom - slotTop);
  const shift = slide * span;

  for (let i = 0; i < rows; i += 1) {
    const rawTop = winTop + i * rowH - shift;
    const rawBottom = rawTop + rowH;
    if (rawBottom <= slotTop) continue;

    const destTop = Math.max(slotTop, rawTop);
    const destBottom = rawBottom;
    const destH = destBottom - destTop;
    if (destH <= 0.2) continue;

    const midY = (destTop + destBottom) * 0.5;
    // along = 0 at window bottom, 1 at the Island slot
    const along = clamp((winBottom - midY) / span, 0, 1);
    const curve = ((1 - Math.cos(Math.PI * along)) * 0.5) * bend;

    const left = lerp(winLeft, slotLeft, curve);
    const right = lerp(winRight, slotRight, curve);
    const width = right - left;
    if (width < 0.5) continue;

    const clipFrac = (destTop - rawTop) / rowH;
    const srcY = ((i + clipFrac) / rows) * imgH;
    const srcH = Math.max(1, ((1 - clipFrac) / rows) * imgH);

    c.drawImage(
      image,
      0,
      srcY,
      imgW,
      srcH,
      left,
      destTop,
      width,
      Math.max(destH + 0.6, 1.0)
    );
  }
};

const frame = (now: number) => {
  if (!ctx) return;
  const c = ctx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, window.innerWidth, window.innerHeight);

  for (let i = tasks.length - 1; i >= 0; i -= 1) {
    const task = tasks[i];
    const progress = clamp((now - task.start) / task.duration, 0, 1);
    drawTask(c, task, progress);

    if (progress >= 0.94 && task.onAlmostDone) {
      task.onAlmostDone();
      task.onAlmostDone = undefined;
    }

    if (progress >= 1) {
      tasks.splice(i, 1);
      task.resolve();
    }
  }

  if (tasks.length > 0) {
    frameId = requestAnimationFrame(frame);
    return;
  }

  frameId = 0;

  // Nothing left to draw: drop the full-viewport surface entirely. A mounted
  // screen-sized canvas keeps a GPU layer (~32 MB at 1920x1040 @2x) alive even
  // when transparent, so it is recreated on demand by `ensureCanvas`.
  if (canvas) {
    canvas.remove();
    canvas = null;
  }
  ctx = null;
};

/** Play one genie warp. Resolves when the animation finishes. */
export const playGenie = (options: {
  image: CanvasImageSource;
  imgW: number;
  imgH: number;
  rect: GenieRect;
  point: GeniePoint;
  direction: GenieDirection;
  duration?: number;
  onAlmostDone?: () => void;
}): Promise<void> => {
  const context = ensureCanvas();
  if (!context) return Promise.resolve();
  let resolvePromise!: () => void;
  const promise = new Promise<void>((res) => {
    resolvePromise = res;
  });

  const task: GenieTask = {
    ...options,
    duration: options.duration ?? 420,
    start: performance.now(),
    resolve: resolvePromise,
  };

  // When minimizing, immediately render frame 0 synchronously so there is no
  // 1-frame blackout when the DOM note is hidden!
  if (options.direction === 'minimize') {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTask(context, task, 0);
  }

  tasks.push(task);
  if (!frameId) frameId = requestAnimationFrame(frame);
  return promise;
};

/** Everything the painter needs to draw a note card. */
export interface NotePaintSpec {
  width: number;
  height: number;
  theme: { bg: string; border: string; text: string; muted: string };
  dots: string[];
  activeDot: number;
  title: string;
  lines: NoteSnapshotLine[];
  time: string;
}

/**
 * Paint the note card straight onto a canvas.
 *
 * Painting instead of screenshotting the DOM keeps the transition instant
 * (no stylesheet serialization) and keeps the bundle free of a capture
 * dependency; during a ~0.4s warp the difference is invisible.
 */
export const paintNoteSnapshot = (spec: NotePaintSpec): NoteSnapshot => {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, spec.width);
  const height = Math.max(1, spec.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);

  const c = canvas.getContext('2d');
  if (!c) return { image: canvas, w: canvas.width, h: canvas.height };

  c.scale(ratio, ratio);

  const radius = 16;
  c.beginPath();
  c.roundRect(0.5, 0.5, width - 1, height - 1, radius);
  c.fillStyle = spec.theme.bg;
  c.fill();
  c.strokeStyle = spec.theme.border;
  c.lineWidth = 1;
  c.stroke();

  c.save();
  c.beginPath();
  c.roundRect(0.5, 0.5, width - 1, height - 1, radius);
  c.clip();

  // Header strip
  c.fillStyle = spec.theme.border;
  c.fillRect(0, 0, width, 32);

  // Drag grip
  c.strokeStyle = spec.theme.muted;
  c.globalAlpha = 0.6;
  c.lineWidth = 1.1;
  for (let i = 0; i < 3; i += 1) {
    c.beginPath();
    c.moveTo(11, 13 + i * 3.2);
    c.lineTo(19, 13 + i * 3.2);
    c.stroke();
  }
  c.globalAlpha = 1;

  // Title
  c.font = '600 10px Inter, system-ui, sans-serif';
  c.fillStyle = spec.theme.muted;
  c.textBaseline = 'middle';
  let label = spec.title.toUpperCase();
  if (c.measureText(label).width > width - 92) {
    while (label.length > 1 && c.measureText(`${label}…`).width > width - 92) {
      label = label.slice(0, -1);
    }
    label = `${label}…`;
  }
  c.fillText(label, 26, 17);

  // Header buttons
  c.fillStyle = spec.theme.muted;
  c.globalAlpha = 0.45;
  for (let i = 0; i < 2; i += 1) {
    c.beginPath();
    c.arc(width - 40 + i * 20, 16, 3.2, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;

  // Body copy: headings, bullets and paragraphs mirror the editor layout.
  c.fillStyle = spec.theme.text;
  c.textBaseline = 'top';
  const maxWidth = width - 24;
  const bottom = height - 26;
  let y = 42;

  for (const line of spec.lines) {
    const isTitle = line.kind === 'title';
    const lineHeight = isTitle ? 17 : 19;
    const indent = line.kind === 'bullet' || line.kind === 'number' ? 26 : 12;
    const textWidth = maxWidth - (indent - 12);

    c.font = isTitle
      ? '600 13px Inter, system-ui, sans-serif'
      : '12px Inter, system-ui, sans-serif';

    if (line.kind === 'bullet' || line.kind === 'number') {
      if (y + lineHeight > bottom) break;
      c.fillStyle = spec.theme.muted;
      c.fillText(line.kind === 'bullet' ? '•' : `${line.index ?? 1}.`, 12, y + 1);
      c.fillStyle = spec.theme.text;
    }

    if (isTitle) {
      if (y + lineHeight > bottom) break;
      c.fillText(line.text, 12, y);
      y += lineHeight;
      continue;
    }

    const words = line.text.split(' ');
    if (words.length === 1 && words[0] === '') {
      y += lineHeight;
      continue;
    }
    let current = '';
    let started = false;
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (started && c.measureText(candidate).width > textWidth) {
        c.fillText(current, indent, y);
        y += lineHeight;
        if (y + lineHeight > bottom) break;
        current = word;
      } else {
        current = candidate;
      }
      started = true;
    }
    if (y + lineHeight > bottom) break;
    c.fillText(current, indent, y);
    y += lineHeight;
  }

  // Color dots
  spec.dots.forEach((color, index) => {
    c.beginPath();
    c.arc(13.5 + index * 16, height - 13, 5, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
    if (index === spec.activeDot) {
      c.strokeStyle = spec.theme.text;
      c.globalAlpha = 0.55;
      c.lineWidth = 1.2;
      c.stroke();
      c.globalAlpha = 1;
    }
  });

  // Timestamp
  c.font = '9px Inter, system-ui, sans-serif';
  c.fillStyle = spec.theme.muted;
  c.textAlign = 'right';
  c.textBaseline = 'middle';
  c.fillText(spec.time, width - 12, height - 13);

  c.restore();

  return { image: canvas, w: canvas.width, h: canvas.height };
};

export interface ServerPaintSpec {
  width: number;
  height: number;
  bg: string;
  name: string;
  subtitle: string;
  online: boolean;
  cpuPercent: number;
  ramPercent: number;
  diskPercent: number;
  ramLabel: string;
  diskLabel: string;
  dockerSummary: string;
  containers: { name: string; state: string }[];
}

/**
 * Paint a faithful dark-glass snapshot of a Floating Server Monitor window
 * onto an offscreen canvas so `playGenie` can warp it across the screen.
 */
export const paintServerSnapshot = (spec: ServerPaintSpec): NoteSnapshot => {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, spec.width);
  const height = Math.max(1, spec.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);

  const c = canvas.getContext('2d');
  if (!c) return { image: canvas, w: canvas.width, h: canvas.height };

  c.scale(ratio, ratio);

  const radius = 12;
  c.beginPath();
  c.roundRect(0.5, 0.5, width - 1, height - 1, radius);
  c.fillStyle = spec.bg;
  c.fill();
  c.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  c.lineWidth = 1;
  c.stroke();

  c.save();
  c.beginPath();
  c.roundRect(0.5, 0.5, width - 1, height - 1, radius);
  c.clip();

  // Header bar
  c.fillStyle = 'rgba(0, 0, 0, 0.28)';
  c.fillRect(0, 0, width, 44);
  c.fillStyle = 'rgba(255, 255, 255, 0.08)';
  c.fillRect(0, 44, width, 1);

  // Status dot
  c.beginPath();
  c.arc(18, 22, 3.2, 0, Math.PI * 2);
  c.fillStyle = spec.online ? '#34d399' : '#737373';
  c.fill();

  // Server name & subtitle
  c.textBaseline = 'top';
  c.font = '600 11.5px Inter, system-ui, sans-serif';
  c.fillStyle = 'rgba(255, 255, 255, 0.94)';
  c.fillText(spec.name.slice(0, 30), 28, 10);

  c.font = '500 8.5px Inter, system-ui, sans-serif';
  c.fillStyle = 'rgba(163, 163, 163, 0.9)';
  c.fillText(spec.subtitle.slice(0, 48), 28, 25);

  // Dock button pill on right
  c.beginPath();
  c.roundRect(width - 58, 12, 46, 20, 6);
  c.fillStyle = 'rgba(255, 255, 255, 0.1)';
  c.fill();
  c.font = '600 9px Inter, system-ui, sans-serif';
  c.fillStyle = 'rgba(255, 255, 255, 0.85)';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('Dock', width - 35, 22);
  c.textAlign = 'left';

  // 3 Metric Cards
  const pad = 12;
  const gap = 8;
  const cardW = (width - pad * 2 - gap * 2) / 3;
  const cardY = 56;
  const cardH = 74;
  const cards = [
    {
      label: 'CPU',
      value: `${Math.round(spec.cpuPercent)}%`,
      percent: spec.cpuPercent,
      accent: '#38bdf8',
    },
    {
      label: 'RAM',
      value: spec.ramLabel,
      percent: spec.ramPercent,
      accent: '#a855f7',
    },
    {
      label: 'STORAGE',
      value: spec.diskLabel,
      percent: spec.diskPercent,
      accent: '#22c55e',
    },
  ];

  cards.forEach((card, idx) => {
    const cx = pad + idx * (cardW + gap);
    c.beginPath();
    c.roundRect(cx, cardY, cardW, cardH, 10);
    c.fillStyle = 'rgba(255, 255, 255, 0.045)';
    c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    c.stroke();

    c.textBaseline = 'top';
    c.font = '600 8.5px Inter, system-ui, sans-serif';
    c.fillStyle = 'rgba(163, 163, 163, 0.85)';
    c.fillText(card.label, cx + 9, cardY + 9);

    c.font = '700 14px Inter, system-ui, sans-serif';
    c.fillStyle = '#ffffff';
    c.fillText(card.value, cx + 9, cardY + 24);

    // Progress bar
    const barX = cx + 9;
    const barY = cardY + cardH - 14;
    const barW = Math.max(10, cardW - 18);
    c.beginPath();
    c.roundRect(barX, barY, barW, 4, 2);
    c.fillStyle = 'rgba(255, 255, 255, 0.1)';
    c.fill();

    const fillW = Math.max(4, (clamp(card.percent, 0, 100) / 100) * barW);
    c.beginPath();
    c.roundRect(barX, barY, fillW, 4, 2);
    c.fillStyle = card.accent;
    c.fill();
  });

  // Docker tab header
  const tabY = cardY + cardH + 14;
  c.beginPath();
  c.roundRect(pad, tabY, 92, 20, 6);
  c.fillStyle = 'rgba(14, 165, 233, 0.2)';
  c.fill();
  c.font = '600 9.5px Inter, system-ui, sans-serif';
  c.fillStyle = '#7dd3fc';
  c.textBaseline = 'middle';
  c.fillText(spec.dockerSummary, pad + 8, tabY + 10);

  // Container rows
  let rowY = tabY + 28;
  const maxRows = Math.max(0, Math.floor((height - rowY - 12) / 28));
  spec.containers.slice(0, maxRows).forEach((ct) => {
    c.beginPath();
    c.roundRect(pad, rowY, width - pad * 2, 24, 7);
    c.fillStyle = 'rgba(0, 0, 0, 0.28)';
    c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    c.stroke();

    c.beginPath();
    c.arc(pad + 10, rowY + 12, 2.8, 0, Math.PI * 2);
    c.fillStyle = ct.state === 'running' ? '#34d399' : '#737373';
    c.fill();

    c.font = '500 9.5px Inter, system-ui, sans-serif';
    c.fillStyle = 'rgba(255, 255, 255, 0.88)';
    c.textBaseline = 'middle';
    c.fillText(ct.name.slice(0, 34), pad + 19, rowY + 12);
    rowY += 28;
  });

  c.restore();

  return { image: canvas, w: canvas.width, h: canvas.height };
};
