/**
 * Notion-style slash menu for the sticky note editor.
 *
 * Typing "/" at the start of a block opens a small command list; the query
 * after the slash filters it. Only the caret's own text node is inspected, so
 * the menu never reacts to a "/" typed in the middle of a word.
 */

import type { NoteFormatCommand } from './richText';

export type SlashCommand =
  | { kind: 'format'; command: NoteFormatCommand }
  | { kind: 'plain' };

export type SlashItem = {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  action: SlashCommand;
};

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: 'text',
    label: 'Teks biasa',
    hint: 'Paragraf tanpa format',
    keywords: 'text teks paragraf plain biasa body',
    action: { kind: 'plain' },
  },
  {
    id: 'heading',
    label: 'Heading',
    hint: 'Judul bagian',
    keywords: 'heading judul title h3 section',
    action: { kind: 'format', command: 'heading' },
  },
  {
    id: 'bullet',
    label: 'Daftar bullet',
    hint: 'Daftar tak bernomor',
    keywords: 'bullet list daftar poin unordered',
    action: { kind: 'format', command: 'bullet' },
  },
  {
    id: 'numbered',
    label: 'Daftar nomor',
    hint: 'Daftar berurutan',
    keywords: 'number nomor daftar ordered angka',
    action: { kind: 'format', command: 'numbered' },
  },
  {
    id: 'bold',
    label: 'Bold',
    hint: 'Tebalkan teks',
    keywords: 'bold tebal b',
    action: { kind: 'format', command: 'bold' },
  },
  {
    id: 'italic',
    label: 'Italic',
    hint: 'Miringkan teks',
    keywords: 'italic miring i',
    action: { kind: 'format', command: 'italic' },
  },
];

export const filterSlashItems = (query: string): SlashItem[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return SLASH_ITEMS;
  return SLASH_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(needle) ||
      item.keywords.includes(needle) ||
      item.id.startsWith(needle)
  );
};

export type SlashTrigger = {
  /** The "/" text node, so the command can delete the query. */
  node: Text;
  /** Characters typed after the "/" (without the slash). */
  query: string;
  /** Screen rect of the caret, for positioning the menu. */
  rect: DOMRect;
};

const isSlashTriggerText = (text: string, atBlockStart: boolean) => {
  const slash = text.lastIndexOf('/');
  if (slash === -1) return false;
  const query = text.slice(slash + 1);
  // Bail out when the user kept typing words after the slash.
  if (query.length > 24 || /\s{2,}/.test(query)) return false;
  // The slash must start the line, follow a space, or open a fresh block
  // (Chromium keeps a new list item's text in the previous item's text node,
  // so "susu" + "/" arrives as one string).
  const before = text.slice(0, slash);
  if (before === '' || /\s$/.test(before)) return true;
  // Fresh block: the item's own text is empty, so the slash still starts it.
  return atBlockStart && before.trim() === '';
};

/**
 * Read the caret and report an open slash menu when the text right before it
 * looks like "/query".
 */
export const readSlashTrigger = (): SlashTrigger | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;

  const text = node.textContent ?? '';
  const caret = range.startOffset;
  const before = text.slice(0, caret);
  const slash = before.lastIndexOf('/');
  if (slash === -1) return null;

  // Slash is only meaningful at the start of the caret's block. Compare the
  // text *before* the slash: anything typed earlier in the block disqualifies
  // it (so "a/b" never opens the menu).
  const block = node.parentElement?.closest('div,p,li,h1,h2,h3');
  const textBeforeSlash = text.slice(0, slash);
  const atBlockStart = !!block && (block.textContent ?? '').startsWith(textBeforeSlash);

  const query = before.slice(slash + 1);
  if (!isSlashTriggerText(before, atBlockStart)) return null;
  // Ignore anything already committed behind the slash.
  if (query.includes('/')) return null;

  const rects = range.getClientRects();
  const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();

  return { node: node as Text, query, rect };
};

/**
 * Remove the typed "/query" from the DOM and leave the caret where the slash
 * used to be, so the chosen command applies to a clean block.
 */
export const clearSlashQuery = (trigger: SlashTrigger) => {
  const { node } = trigger;
  const text = node.textContent ?? '';
  const caret = window.getSelection()?.getRangeAt(0).startOffset ?? text.length;
  const slash = text.slice(0, caret).lastIndexOf('/');
  if (slash === -1) return;

  const start = slash;
  const end = caret;
  node.textContent = text.slice(0, start) + text.slice(end);

  const range = document.createRange();
  const offset = Math.min(start, node.textContent.length);
  range.setStart(node, offset);
  range.collapse(true);
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
};
