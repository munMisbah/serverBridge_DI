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
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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

const drawTask = (
  c: CanvasRenderingContext2D,
  task: GenieTask,
  progress: number
) => {
  const { rect, point, direction, image, imgW, imgH } = task;
  const rows = Math.max(36, Math.round(rect.h / 3));
  const rowH = rect.h / rows;
  // Minimize is the open warp played backwards, so every frame of the close
  // mirrors the open at the same shape — no separate direction math.
  const p = direction === 'minimize' ? 1 - progress : progress;

  for (let i = 0; i < rows; i += 1) {
    const r = i / rows;

    // The anchor (island row) sits above the card, so the rows nearest the
    // bottom lead: the sheet reads as being pulled up from below instead of
    // being peeled downward from its top edge.
    const xStart = (1 - r) * 0.65;
    const xEase = easeInOutCubic(clamp((p - xStart) / (1 - xStart), 0, 1));
    const yStart = (1 - r) * 0.2;
    const yProgress = clamp((p - yStart) / (1 - yStart), 0, 1);
    const yEase = yProgress * yProgress;

    const left = lerp(point.x, rect.x, xEase);
    const right = lerp(point.x, rect.x + rect.w, xEase);
    const destY = lerp(point.y, rect.y + i * rowH, yEase);

    const width = right - left;
    if (width < 0.4) continue;

    const sliceH = Math.max(rowH + 0.6, 1.0);
    c.drawImage(
      image,
      0,
      (i / rows) * imgH,
      imgW,
      Math.max(1, imgH / rows),
      left,
      destY,
      width,
      sliceH
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
  // Keep canvas mounted, simply leave cleared transparent surface
  c.clearRect(0, 0, window.innerWidth, window.innerHeight);
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
