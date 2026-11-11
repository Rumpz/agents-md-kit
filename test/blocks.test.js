import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyBlock, findBlocks, detectEol } from '../src/blocks.js';

const B = (id) => `<!-- BEGIN agent-kit:${id} -->`;
const E = (id) => `<!-- END agent-kit:${id} -->`;

test('creates a missing file with a title and the block', () => {
  const r = applyBlock(null, { id: 'core', content: 'hello\n', title: '# AGENTS.md' });
  assert.equal(r.status, 'block-create');
  assert.equal(r.text, `# AGENTS.md\n\n${B('core')}\nhello\n${E('core')}\n`);
});

test('inserts into an existing file, preserving its content byte for byte', () => {
  const user = '# My rules\n\nDo not touch this.\n';
  const r = applyBlock(user, { id: 'core', content: 'x' });
  assert.equal(r.status, 'block-create');
  assert.ok(r.text.startsWith(user));
  assert.equal(r.text, `${user}\n${B('core')}\nx\n${E('core')}\n`);
});

test('inserts into a file without a trailing newline', () => {
  const r = applyBlock('no newline', { id: 'a', content: 'x' });
  assert.equal(r.text, `no newline\n\n${B('a')}\nx\n${E('a')}\n`);
});

test('updates an existing block and leaves the rest untouched; unchanged stays unchanged', () => {
  const before = `top\n${B('core')}\nold\n${E('core')}\nbottom  \n`;
  const r = applyBlock(before, { id: 'core', content: 'new' });
  assert.equal(r.status, 'block-update');
  assert.equal(r.text, `top\n${B('core')}\nnew\n${E('core')}\nbottom  \n`);
  const again = applyBlock(r.text, { id: 'core', content: 'new\n' });
  assert.equal(again.status, 'block-unchanged');
  assert.equal(again.text, r.text);
});

test('keeps CRLF files CRLF and their outside content intact', () => {
  const before = `top\r\n${B('core')}\r\nold\r\n${E('core')}\r\nbottom\r\n`;
  const r = applyBlock(before, { id: 'core', content: 'line1\nline2\n' });
  assert.equal(r.text, `top\r\n${B('core')}\r\nline1\r\nline2\r\n${E('core')}\r\nbottom\r\n`);
  assert.equal(r.text.replace(/\r\n/g, '').includes('\n'), false, 'no bare LF introduced');
  const added = applyBlock(r.text, { id: 'web', content: 'w' });
  assert.ok(added.text.startsWith(r.text));
  assert.equal(added.text.replace(/\r\n/g, '').includes('\n'), false);
  assert.equal(detectEol(added.text), '\r\n');
});

test('hash-style markers', () => {
  const r = applyBlock('node_modules/\n', { id: 'react', style: 'hash', content: 'dist/' });
  assert.equal(r.text, 'node_modules/\n\n# BEGIN agent-kit:react\ndist/\n# END agent-kit:react\n');
  assert.equal(applyBlock(r.text, { id: 'react', style: 'hash', content: 'dist/' }).status, 'block-unchanged');
  assert.equal(applyBlock(r.text, { id: 'react', style: 'html', content: 'dist/' }).status, 'conflict');
});

test('malformed markers produce a conflict and are never edited', () => {
  const cases = {
    unpairedBegin: `${B('core')}\nx\n`,
    endWithoutBegin: `x\n${E('core')}\n`,
    duplicate: `${B('core')}\n${E('core')}\n${B('core')}\n${E('core')}\n`,
    nested: `${B('a')}\n${B('b')}\n${E('b')}\n${E('a')}\n`,
    mismatched: `${B('a')}\n${E('b')}\n`,
    garbled: `<!-- BEGIN agent-kit: core -->\n`,
  };
  for (const [name, text] of Object.entries(cases)) {
    const r = applyBlock(text, { id: 'core', content: 'new' });
    assert.equal(r.status, 'conflict', name);
    assert.match(r.reason, /malformed markers/, name);
    assert.ok(findBlocks(text).errors.length > 0, name);
  }
});
