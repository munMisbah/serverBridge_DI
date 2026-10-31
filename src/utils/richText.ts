/**
 * Minimal rich-text layer for the sticky notes.
 *
 * Notes stay plain strings in localStorage, but they may now carry a small,
 * whitelisted subset of HTML (b/strong, i/em, u, h1-h3, ul/ol/li, div, br).
 * Everything outside the whitelist is flattened to text, so a note can never
 * smuggle markup into the app — no editor library, no sanitizer package.
 */

export type NoteFormatCommand = 'bold' | 'italic' | 'heading' | 'bullet' | 'numbered';

export type NoteSnapshotLine = {
  text: string;
  kind: 'title' | 'body' | 'bullet' | 'number';
  /** Ordinal for `kind: 'number'`, 1-based. */
  index?: number;
};

/** Static tag whitelists: membership only, so plain records. */
const ALLOWED_TAGS: Record<string, true> = {
  B: true,
  STRONG: true,
  I: true,
  EM: true,
  U: true,
  H1: true,
  H2: true,
  H3: true,
  UL: true,
  OL: true,
  LI: true,
  DIV: true,
  P: true,
  BR: true,
};

/** Tags stripped while keeping their children (browser/OS paste debris). */
const UNWRAP_TAGS: Record<string, true> = {
  SPAN: true,
  FONT: true,
  A: true,
  BIG: true,
  SMALL: true,
  MARK: true,
  S: true,
  STRIKE: true,
  SUB: true,
  SUP: true,
};

const HEADING_TAGS = /^H[1-3]$/;

const RICH_PATTERN = /<(b|strong|i|em|u|h[1-3]|ul|ol|li|div|br|p)\b/i;
const INLINE_PATTERN = /<(b|strong|i|em|u)\b/i;

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const parse = (value: string) => {
  const holder = document.createElement('div');
  holder.innerHTML = value;
  return holder;
};

/** True when the stored string carries our HTML subset; plain text never does. */
export const isRichNote = (value: string) => RICH_PATTERN.test(value);

/** Plain-text projection, used for list titles/previews and the canvas snapshot. */
export const noteToText = (value: string): string => {
  if (!isRichNote(value)) return value.replace(/\u200b/g, '');
  const holder = parse(value);
  const lines: string[] = [];

  const visit = (node: Element) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.textContent ?? '').replace(/\u00a0/g, ' ').trim();
        if (text) lines.push(text);
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName;
      if (tag === 'UL' || tag === 'OL') {
        [...el.children].forEach((li, index) => {
          const text = (li.textContent ?? '').trim();
          if (text) lines.push(tag === 'OL' ? `${index + 1}. ${text}` : `• ${text}`);
        });
        return;
      }
      if (tag === 'BR') {
        lines.push('');
        return;
      }
      if (tag === 'DIV' || tag === 'P' || tag === 'LI' || tag === 'H1' || tag === 'H2' || tag === 'H3') {
        if (el.querySelector('ul,ol')) {
          visit(el);
          return;
        }
        const text = (el.textContent ?? '').replace(/\u00a0/g, ' ').trim();
        if (text) lines.push(text);
        else lines.push('');
        return;
      }
      visit(el);
    });
  };

  visit(holder);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

/** Strip everything outside the whitelist, keeping the text of unknown tags. */
export const sanitizeNoteHtml = (html: string): string => {
  const holder = parse(html.replace(/\u200b/g, ''));

  const walk = (node: Element) => {
    [...node.children].forEach((child) => {
      if (UNWRAP_TAGS[child.tagName]) {
        child.replaceWith(...[...child.childNodes]);
        walk(node);
        return;
      }
      if (!ALLOWED_TAGS[child.tagName]) {
        child.replaceWith(...[...child.childNodes]);
        walk(node);
        return;
      }
      // A list nested inside a heading is invalid markup: split them apart.
      if (HEADING_TAGS.test(child.tagName) && child.querySelector('ul,ol')) {
        const list = child.querySelector('ul,ol');
        const head = document.createElement('div');
        [...child.childNodes].forEach((item) => {
          if (item !== list) head.appendChild(item);
        });
        const frag = document.createDocumentFragment();
        if ((head.textContent ?? '').trim()) frag.appendChild(head);
        if (list) frag.appendChild(list);
        child.replaceWith(frag);
        walk(node);
        return;
      }
      [...child.attributes].forEach((attr) => child.removeAttribute(attr.name));
      walk(child);
    });
  };
  walk(holder);

  // Inline formatting leaves empty wrappers behind (<b></b>) when a command is
  // used without a selection; they render as stray spacing, so drop them.
  const prune = (node: Element) => {
    [...node.children].forEach((child) => {
      prune(child);
      const isEmptyInline =
        /^(B|STRONG|I|EM|U)$/.test(child.tagName) && (child.textContent ?? '').trim() === '';
      const isEmptyBlock =
        /^(DIV|P|H[1-3]|LI)$/.test(child.tagName) &&
        (child.textContent ?? '').trim() === '' &&
        !child.querySelector('br');
      if (isEmptyInline || isEmptyBlock) child.remove();
    });
  };
  prune(holder);

  // A list whose items were all empty must not survive as an empty <ul>.
  holder.querySelectorAll('ul,ol').forEach((list) => {
    if (list.children.length === 0) list.remove();
  });

  return holder.innerHTML;
};

/** Escape plain text into the HTML subset so it can seed the editor. */
export const textToNoteHtml = (value: string): string =>
  value
    .split('\n')
    .map((line) => (line.trim() === '' ? '<br>' : `<div>${escapeHtml(line)}</div>`))
    .join('');

/**
 * Value stored for a note body: plain text stays plain text (so old notes keep
 * their newlines), anything with real markup is sanitized and kept as HTML.
 */
export const serializeNote = (html: string): string => {
  const clean = sanitizeNoteHtml(html).replace(/<([a-z0-9]+)[^>]*>\u200b<\/\1>/gi, '<$1></$1>');
  const holder = parse(clean);
  const hasBlockMarkup = [...holder.children].some(
    (child) => child.tagName !== 'DIV' && child.tagName !== 'BR' && child.tagName !== 'P'
  );
  const hasInline = INLINE_PATTERN.test(clean);
  if (hasBlockMarkup || hasInline) return clean;
  // Plain paragraphs only: store as text so old/new notes share one format.
  return noteToText(clean);
};

/**
 * Apply a formatting command to the current selection.
 *
 * `execCommand` is formally deprecated, but it is the only editing API WebView2
 * ships, it is what every lightweight editor still relies on, and it keeps the
 * dependency footprint at zero.
 */
export const applyNoteFormat = (command: NoteFormatCommand) => {
  const exec = (id: string) => document.execCommand(id, false);
  if (command === 'bold') exec('bold');
  else exec('italic');
};

const BLOCK_TAGS = /^(DIV|P|H1|H2|H3|LI)$/;

/** Element that owns the caret, wrapping bare root text in a div first. */
const caretBlock = (editor: HTMLElement): HTMLElement | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  let node: Node | null = selection.getRangeAt(0).startContainer;

  // Typing into an empty editor leaves a bare text node under the root.
  if (node && node.nodeType === Node.TEXT_NODE && node.parentElement === editor) {
    const textNode = node as Text;
    const wrapper = document.createElement('div');
    textNode.replaceWith(wrapper);
    wrapper.appendChild(textNode);
    const range = document.createRange();
    range.selectNodeContents(textNode);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return wrapper;
  }

  while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
  let el = node as HTMLElement | null;
  while (el && el !== editor && !BLOCK_TAGS.test(el.tagName)) el = el.parentElement;
  if (!el || el === editor) return null;
  return el;
};

const replaceTag = (el: HTMLElement, tag: string): HTMLElement => {
  const next = document.createElement(tag);
  while (el.firstChild) next.appendChild(el.firstChild);
  el.replaceWith(next);
  return next;
};

/**
 * Put the caret at the end of a block.
 *
 * An empty block gets a <br> first: Chromium silently relocates the caret to
 * the editor root when it sits in an element with no content, which would send
 * subsequent keystrokes outside the block.
 */
/**
 * Put the caret at the end of a block.
 *
 * Chromium relocates the caret to the editor root when the target block has no
 * content (keystrokes then land outside the block), so an empty block gets a
 * zero-width space to type against. It is stripped again on serialize.
 */
/**
 * Prepare a freshly created block for typing.
 *
 * Blink refuses to type into an element that holds no text (keystrokes go to
 * the editor root instead), and an empty text node is not enough. The block
 * gets a temporary placeholder that is selected, so the first keystroke
 * replaces it and `stripPlaceholder` cleans up whatever is left behind.
 */
const PLACEHOLDER = '\u200b';

const placeCaretAtEnd = (el: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection) return;

  if (!el.textContent) {
    el.textContent = PLACEHOLDER;
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

/** Remove leftover placeholders from a block that was never typed into. */
export const stripPlaceholder = (editor: HTMLElement) => {
  editor.querySelectorAll('h1,h2,h3,li,div,p').forEach((el) => {
    if ((el.textContent ?? '') === PLACEHOLDER) el.textContent = '';
  });
};

/**
 * Toggle the caret's block between heading and body.
 *
 * Hand-rolled instead of `formatBlock`: Chromium wraps a multi-block selection
 * into one heading, which is how lists ended up nested inside an `<h3>`. Only
 * the caret's own block is converted, and pressing again restores a paragraph.
 */
export const toggleNoteHeading = (editor: HTMLElement) => {
  const block = caretBlock(editor);

  if (!block) {
    // Empty editor: promote a single empty line.
    const heading = document.createElement('h3');
    heading.appendChild(document.createElement('br'));
    editor.replaceChildren(heading);
    placeCaretAtEnd(heading);
    return;
  }

  // A heading inside a bullet is not useful; leave list items alone.
  if (block.tagName === 'LI' || block.closest('ul,ol')) return;

  const next = replaceTag(block, HEADING_TAGS.test(block.tagName) ? 'div' : 'h3');
  placeCaretAtEnd(next);
};

const LIST_TAGS = /^(UL|OL)$/;

/** Blocks the selection touches, in document order (LI counts as a block). */
const selectedBlocks = (editor: HTMLElement): HTMLElement[] => {
  const candidates = [...editor.querySelectorAll('*')].filter((el) => {
    const tag = el.tagName;
    if (tag === 'LI') return true;
    if (LIST_TAGS.test(tag)) return false;
    if (!BLOCK_TAGS.test(tag)) return false;
    // Blocks inside a list item are item content, not separate blocks.
    return !el.closest('li');
  }) as HTMLElement[];

  const selection = window.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  if (!range) return [];

  if (range.collapsed) {
    const block = caretBlock(editor);
    return block ? [block] : [];
  }

  const hit = candidates.filter((block) => range.intersectsNode(block));
  if (hit.length > 0) return hit;
  const block = caretBlock(editor);
  return block ? [block] : [];
};

/** Replace a list with plain paragraphs, preserving inline formatting. */
const unwrapList = (list: HTMLElement) => {
  const frag = document.createDocumentFragment();
  [...list.children].forEach((item) => {
    const div = document.createElement('div');
    while (item.firstChild) div.appendChild(item.firstChild);
    if (!div.firstChild) div.appendChild(document.createElement('br'));
    frag.appendChild(div);
  });
  list.replaceWith(frag);
};

const selectContents = (el: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
};

/**
 * Toggle a bullet / numbered list on the selection.
 *
 * Hand-rolled because Chromium's `insertUnorderedList` leaves sibling blocks
 * outside the list when several blocks are selected, so a multi-line selection
 * became one bullet plus loose paragraphs. Every selected block becomes an
 * item, switching kind converts in place, and toggling the same kind again
 * restores paragraphs.
 */
export const toggleNoteList = (editor: HTMLElement, kind: 'ul' | 'ol') => {
  const blocks = selectedBlocks(editor);
  if (blocks.length === 0) return;

  const sameKind = kind.toUpperCase();
  const listed = blocks.filter(
    (block) => block.tagName === 'LI' && block.parentElement?.tagName === sameKind
  );
  const anyListed = blocks.some(
    (block) => block.tagName === 'LI' && block.parentElement && LIST_TAGS.test(block.parentElement.tagName)
  );

  // Clicking the active list type removes it.
  if (listed.length === blocks.length) {
    new Set(blocks.map((block) => block.parentElement as HTMLElement)).forEach(unwrapList);
    return;
  }

  // Switching bullet <-> numbered: rebuild in place with the same items.
  if (anyListed) {
    const lists = [...new Set(blocks.map((block) => block.parentElement as HTMLElement))].filter(
      (list) => list && LIST_TAGS.test(list.tagName)
    );
    const first = lists[0];
    if (!first) return;
    const next = document.createElement(kind);
    lists.forEach((list) => {
      [...list.children].forEach((item) => {
        const li = document.createElement('li');
        while (item.firstChild) li.appendChild(item.firstChild);
        if (!li.firstChild) li.appendChild(document.createElement('br'));
        next.appendChild(li);
      });
    });
    first.replaceWith(next);
    lists.slice(1).forEach((list) => list.remove());
    selectContents(next);
    return;
  }

  // Build a fresh list from the selected paragraphs.
  const list = document.createElement(kind);
  blocks.forEach((block) => {
    const li = document.createElement('li');
    while (block.firstChild) li.appendChild(block.firstChild);
    if (!li.firstChild) li.appendChild(document.createElement('br'));
    list.appendChild(li);
  });
  blocks[0].replaceWith(list);
  blocks.slice(1).forEach((block) => block.remove());
  selectContents(list);
};

/** Turn the caret's block back into a plain paragraph (and drop any list). */
export const applyPlainBlock = (editor: HTMLElement) => {
  const block = caretBlock(editor);
  if (!block) return;

  const list = block.closest('ul,ol');
  if (list) {
    const div = document.createElement('div');
    while (block.firstChild) div.appendChild(block.firstChild);
    if (!div.firstChild) div.appendChild(document.createElement('br'));
    list.replaceWith(div);
    placeCaretAtEnd(div);
    return;
  }

  if (HEADING_TAGS.test(block.tagName)) {
    placeCaretAtEnd(replaceTag(block, 'div'));
    return;
  }
  placeCaretAtEnd(block);
};

/** Whether the caret currently sits inside one of the given tags. */
export const selectionHasTag = (tags: string[]): boolean => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  let node: Node | null = selection.getRangeAt(0).startContainer;
  while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
  let el = node as HTMLElement | null;
  while (el) {
    if (tags.includes(el.tagName)) return true;
    el = el.parentElement;
  }
  return false;
};

/** Structured lines for the canvas snapshot painter. */
export const noteSnapshotLines = (value: string): NoteSnapshotLine[] => {
  if (!isRichNote(value)) {
    return value.split('\n').map((text) => ({ text: text.replace(/\u200b/g, ''), kind: 'body' as const }));
  }
  const holder = parse(value);
  const lines: NoteSnapshotLine[] = [];

  const visit = (node: Element) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.textContent ?? '').replace(/\u00a0/g, ' ').trim();
        if (text) lines.push({ text, kind: 'body' });
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName;

      if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
        const text = (el.textContent ?? '').trim();
        if (text) lines.push({ text, kind: 'title' });
        return;
      }
      if (tag === 'UL' || tag === 'OL') {
        [...el.children].forEach((li, index) => {
          const text = (li.textContent ?? '').replace(/\u00a0/g, ' ').trim();
          if (!text) return;
          lines.push(
            tag === 'OL'
              ? { text, kind: 'number', index: index + 1 }
              : { text, kind: 'bullet' }
          );
        });
        return;
      }
      if (tag === 'DIV' || tag === 'P' || tag === 'LI') {
        if (el.querySelector('ul,ol')) {
          visit(el);
          return;
        }
        const text = (el.textContent ?? '').replace(/\u00a0/g, ' ').trim();
        lines.push({ text, kind: 'body' });
        return;
      }
      if (tag === 'BR') {
        lines.push({ text: '', kind: 'body' });
        return;
      }
      visit(el);
    });
  };

  visit(holder);
  return lines;
};
