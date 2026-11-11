// Managed blocks: regions between BEGIN/END markers that the installer owns.
//
//   style=html: <!-- BEGIN agent-kit:<id> -->  ...  <!-- END agent-kit:<id> -->
//   style=hash: # BEGIN agent-kit:<id>         ...  # END agent-kit:<id>
//
// Content outside the markers is preserved byte for byte. When updating an
// existing file, the inserted block uses that file's line ending (LF or CRLF).

const MARKER_RE = /^(?:<!--\s*(BEGIN|END) agent-kit:([a-z0-9][a-z0-9-]*)\s*-->|#\s*(BEGIN|END) agent-kit:([a-z0-9][a-z0-9-]*))$/;
// Anything that looks like it is trying to be a marker.
const MARKERISH_RE = /\b(BEGIN|END)\s+agent-kit:/;

export function markers(id, style = 'html') {
  if (style === 'hash') return { begin: `# BEGIN agent-kit:${id}`, end: `# END agent-kit:${id}` };
  return { begin: `<!-- BEGIN agent-kit:${id} -->`, end: `<!-- END agent-kit:${id} -->` };
}

/** "\r\n" if the first line break in the text is CRLF, else "\n". */
export function detectEol(text) {
  const i = text.indexOf('\n');
  return i > 0 && text[i - 1] === '\r' ? '\r\n' : '\n';
}

/** Split into lines, remembering each line's start/end offsets (end excludes the line break). */
function splitLines(text) {
  const lines = [];
  let start = 0;
  while (start <= text.length) {
    let nl = text.indexOf('\n', start);
    const last = nl === -1;
    if (last) nl = text.length;
    const end = nl > start && text[nl - 1] === '\r' ? nl - 1 : nl;
    lines.push({ text: text.slice(start, end), start, end, index: lines.length });
    if (last) break;
    start = nl + 1;
  }
  return lines;
}

/**
 * Find managed blocks in text.
 * Returns { blocks: [{ id, style, start, end }], errors: [string] }.
 * `start` is the offset of the BEGIN line, `end` the offset just after the END
 * marker text (before its line break). Any error means the file must not be edited.
 */
export function findBlocks(text) {
  const blocks = [];
  const errors = [];
  const seen = new Set();
  let open = null;
  for (const line of splitLines(text)) {
    const trimmed = line.text.trim();
    const m = MARKER_RE.exec(trimmed);
    if (!m) {
      if (MARKERISH_RE.test(line.text)) errors.push(`line ${line.index + 1}: unrecognized agent-kit marker`);
      continue;
    }
    const kind = m[1] ?? m[3];
    const id = m[2] ?? m[4];
    const style = m[1] ? 'html' : 'hash';
    if (kind === 'BEGIN') {
      if (open) {
        errors.push(`line ${line.index + 1}: BEGIN ${id} inside open block ${open.id} (nested)`);
        continue;
      }
      if (seen.has(id)) errors.push(`line ${line.index + 1}: duplicate block ${id}`);
      seen.add(id);
      open = { id, style, start: line.start, line: line.index + 1 };
    } else {
      if (!open) {
        errors.push(`line ${line.index + 1}: END ${id} without BEGIN`);
        continue;
      }
      if (open.id !== id || open.style !== style) {
        errors.push(`line ${line.index + 1}: END ${id} does not match BEGIN ${open.id} on line ${open.line}`);
        open = null;
        continue;
      }
      blocks.push({ id, style, start: open.start, end: line.end });
      open = null;
    }
  }
  if (open) errors.push(`line ${open.line}: BEGIN ${open.id} is never closed`);
  return { blocks, errors };
}

/** Render a block (markers + content) with the given line ending, without a trailing break. */
export function renderBlock(id, style, content, eol = '\n') {
  const { begin, end } = markers(id, style);
  const body = content.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const lines = [begin, ...(body ? body.split('\n') : []), end];
  return lines.join(eol);
}

/** Throws if fragment content itself contains marker-like lines. */
export function assertFragmentClean(content, label) {
  if (MARKERISH_RE.test(content)) throw new Error(`${label}: fragment contains an agent-kit marker`);
}

/**
 * Compute the new text for a file after inserting/updating one block.
 * existing: current file text, or null if the file does not exist.
 * Returns { status: 'block-create'|'block-update'|'block-unchanged'|'conflict', text?, reason? }.
 */
export function applyBlock(existing, { id, style = 'html', content, title = null }) {
  if (existing === null) {
    const block = renderBlock(id, style, content, '\n');
    return { status: 'block-create', text: (title ? `${title}\n\n` : '') + block + '\n' };
  }
  const { blocks, errors } = findBlocks(existing);
  if (errors.length) return { status: 'conflict', reason: `malformed markers: ${errors.join('; ')}` };
  const eol = detectEol(existing);
  const block = renderBlock(id, style, content, eol);
  const current = blocks.find((b) => b.id === id);
  if (current) {
    if (current.style !== style) {
      return { status: 'conflict', reason: `block ${id} uses ${current.style} markers, expected ${style}` };
    }
    const text = existing.slice(0, current.start) + block + existing.slice(current.end);
    return text === existing ? { status: 'block-unchanged', text } : { status: 'block-update', text };
  }
  let text = existing;
  if (text.length > 0) {
    if (!text.endsWith('\n')) text += eol;
    text += eol;
  }
  text += block + eol;
  return { status: 'block-create', text };
}
