import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { install, UsageError } from '../src/install.js';
import { main } from '../src/cli.js';
import { KIT_ROOT, tmpDir, writeTree, hashTree, read, exists, linkDir, linkFile } from './helpers.js';

const ops = (res) => res.actions.map((a) => `${a.op} ${a.path}`);
const quiet = { out: () => {}, err: () => {} };

test('dry run writes nothing, on an empty and on a populated target', () => {
  const empty = tmpDir();
  const before = hashTree(empty);
  const res = install({ kitRoot: KIT_ROOT, target: empty, packs: ['web', 'github'] });
  assert.equal(res.applied, false);
  assert.ok(res.writes > 0);
  assert.equal(hashTree(empty), before);
  assert.deepEqual(fs.readdirSync(empty), []);

  const populated = writeTree(tmpDir(), { 'AGENTS.md': '# Mine\n', 'CLAUDE.md': 'different\n' });
  const before2 = hashTree(populated);
  install({ kitRoot: KIT_ROOT, target: populated, packs: ['web'] });
  assert.equal(hashTree(populated), before2);
});

test('--apply creates the expected files; a second --apply is a no-op', () => {
  const t = tmpDir();
  const first = install({ kitRoot: KIT_ROOT, target: t, packs: ['web', 'github'], apply: true });
  assert.equal(first.conflicts, 0);
  for (const rel of [
    'AGENTS.md',
    'CLAUDE.md',
    'MEMORY.md',
    '.claude/settings.json',
    '.claude/skills/agent-memory-protocol/SKILL.md',
    '.claude/skills/backend-architecture-principles/SKILL.md',
    '.claude/skills/html-syntax-and-semantics/SKILL.md',
    '.claude/skills/seo-best-practices/SKILL.md',
    'docs/adr/0000-template.md',
    '.github/pull_request_template.md',
    '.github/workflows/pr-title.yml',
  ]) {
    assert.ok(exists(t, rel), `missing ${rel}`);
  }
  assert.equal(exists(t, 'CHANGELOG.md'), false, 'CHANGELOG.md is not part of core');
  assert.equal(read(t, 'CLAUDE.md'), '@AGENTS.md\n');
  const agents = read(t, 'AGENTS.md');
  assert.ok(agents.startsWith('# AGENTS.md\n\n<!-- BEGIN agent-kit:core -->'));
  assert.ok(agents.indexOf('agent-kit:core') < agents.indexOf('agent-kit:web'));

  const snapshot = hashTree(t);
  const second = install({ kitRoot: KIT_ROOT, target: t, packs: ['web', 'github'], apply: true });
  assert.equal(second.writes, 0);
  assert.equal(second.conflicts, 0);
  for (const a of second.actions) assert.match(a.op, /^(unchanged|block-unchanged|skip \(exists\))$/, `${a.op} ${a.path}`);
  assert.equal(hashTree(t), snapshot);
});

test('an existing different file yields <path>.new and the original is untouched', () => {
  const t = writeTree(tmpDir(), { 'CLAUDE.md': 'my own claude file\n', '.claude/settings.json': '{}\n' });
  const res = install({ kitRoot: KIT_ROOT, target: t, apply: true });
  assert.equal(res.conflicts, 2);
  assert.equal(read(t, 'CLAUDE.md'), 'my own claude file\n');
  assert.equal(read(t, 'CLAUDE.md.new'), '@AGENTS.md\n');
  assert.equal(read(t, '.claude/settings.json'), '{}\n');
  assert.ok(exists(t, '.claude/settings.json.new'));
  // Re-running keeps reporting the conflict but does not rewrite an identical .new
  const snap = hashTree(t);
  const again = install({ kitRoot: KIT_ROOT, target: t, apply: true });
  assert.equal(again.conflicts, 2);
  assert.equal(hashTree(t), snap);
});

test('a CRLF copy of an identical file counts as unchanged', () => {
  const t = writeTree(tmpDir(), { 'CLAUDE.md': '@AGENTS.md\r\n' });
  const res = install({ kitRoot: KIT_ROOT, target: t });
  assert.ok(ops(res).includes('unchanged CLAUDE.md'));
});

test('copy-once never overwrites and never writes .new', () => {
  const t = writeTree(tmpDir(), { 'MEMORY.md': 'my memory\n' });
  const res = install({ kitRoot: KIT_ROOT, target: t, apply: true });
  assert.ok(ops(res).includes('skip (exists) MEMORY.md'));
  assert.equal(read(t, 'MEMORY.md'), 'my memory\n');
  assert.equal(exists(t, 'MEMORY.md.new'), false);
});

test('managed block goes into an existing AGENTS.md, preserving user content and CRLF', () => {
  const user = '# Team rules\r\n\r\nKeep this paragraph.\r\n';
  const t = writeTree(tmpDir(), { 'AGENTS.md': user });
  install({ kitRoot: KIT_ROOT, target: t, packs: ['web'], apply: true });
  const text = read(t, 'AGENTS.md');
  assert.ok(text.startsWith(user));
  assert.equal(text.replace(/\r\n/g, '').includes('\n'), false, 'file is still pure CRLF');
  assert.match(text, /<!-- BEGIN agent-kit:core -->\r\n/);
  assert.match(text, /<!-- END agent-kit:web -->\r\n$/);
  const again = install({ kitRoot: KIT_ROOT, target: t, packs: ['web'], apply: true });
  assert.equal(again.writes, 0);
});

test('an outdated block is updated in place; outside content preserved', () => {
  const t = writeTree(tmpDir(), {
    'AGENTS.md': 'before\n<!-- BEGIN agent-kit:core -->\nstale\n<!-- END agent-kit:core -->\nafter\n',
  });
  const res = install({ kitRoot: KIT_ROOT, target: t, apply: true });
  assert.ok(ops(res).includes('block-update AGENTS.md'));
  const text = read(t, 'AGENTS.md');
  assert.ok(text.startsWith('before\n<!-- BEGIN agent-kit:core -->\nThis file is the entry point'));
  assert.ok(text.endsWith('<!-- END agent-kit:core -->\nafter\n'));
  assert.ok(!text.includes('stale'));
});

test('malformed markers produce AGENTS.md.new and leave AGENTS.md untouched', () => {
  const broken = 'x\n<!-- BEGIN agent-kit:core -->\nno end marker\n';
  const t = writeTree(tmpDir(), { 'AGENTS.md': broken });
  const res = install({ kitRoot: KIT_ROOT, target: t, packs: ['web'], apply: true });
  assert.equal(read(t, 'AGENTS.md'), broken);
  assert.ok(exists(t, 'AGENTS.md.new'));
  assert.ok(res.actions.some((a) => a.op === 'conflict -> AGENTS.md.new' && /malformed/.test(a.detail)));
  const proposed = read(t, 'AGENTS.md.new');
  assert.match(proposed, /<!-- BEGIN agent-kit:core -->/);
  assert.match(proposed, /<!-- BEGIN agent-kit:web -->/);
  assert.ok(proposed.indexOf('agent-kit:core') < proposed.indexOf('agent-kit:web'));
  const snap = hashTree(t);
  const again = install({ kitRoot: KIT_ROOT, target: t, packs: ['web'], apply: true });
  assert.equal(again.writes, 0);
  assert.equal(hashTree(t), snap);
  assert.equal(main(['install', '--target', t, '--pack', 'web'], quiet), 2);
});

function fixtureKit(manifest, files = {}) {
  return writeTree(tmpDir('agent-kit-fixture-'), { 'core/manifest.txt': manifest, ...files });
}

test('path traversal and absolute paths in a manifest are rejected before writing', () => {
  for (const line of ['copy ../evil.txt', 'copy /tmp/evil.txt', 'copy C:/evil.txt', 'copy a\\..\\..\\evil.txt', 'copy ok.txt from=../../x', 'block x ../AGENTS.md f.md']) {
    const kit = fixtureKit(`${line}\n`, { 'core/files/ok.txt': 'ok' });
    const t = tmpDir();
    assert.throws(() => install({ kitRoot: kit, target: t, apply: true }), /unsafe/, line);
    assert.deepEqual(fs.readdirSync(t), [], line);
  }
});

test('refuses to write through a directory symlink/junction', (t) => {
  const outside = tmpDir('agent-kit-outside-');
  const target = tmpDir();
  if (!linkDir(outside, path.join(target, '.claude'))) return t.skip('cannot create directory links here');
  assert.equal(fs.lstatSync(path.join(target, '.claude')).isSymbolicLink(), true, 'lstat reports the link');
  const before = hashTree(outside);
  assert.throws(() => install({ kitRoot: KIT_ROOT, target, apply: true }), /symlink/);
  assert.equal(hashTree(outside), before);
  assert.equal(exists(target, 'AGENTS.md'), false, 'planning failed before any write');
  assert.equal(main(['install', '--target', target], quiet), 1);
});

test('refuses to write through a file symlink, including <path>.new', (t) => {
  const outside = tmpDir('agent-kit-outside-');
  fs.writeFileSync(path.join(outside, 'victim.txt'), 'secret\n');
  const target = tmpDir();
  if (!linkFile(path.join(outside, 'victim.txt'), path.join(target, 'CLAUDE.md'))) {
    // Still cover the leaf position: a junction named like the destination file.
    const t3 = tmpDir();
    assert.ok(linkDir(outside, path.join(t3, 'CLAUDE.md')));
    assert.throws(() => install({ kitRoot: KIT_ROOT, target: t3, apply: true }), /symlink/);
    assert.equal(fs.readFileSync(path.join(outside, 'victim.txt'), 'utf8'), 'secret\n');
    return t.skip('file symlinks unavailable (Windows without Developer Mode); leaf checked with a junction');
  }
  assert.throws(() => install({ kitRoot: KIT_ROOT, target, apply: true }), /symlink/);
  assert.equal(fs.readFileSync(path.join(outside, 'victim.txt'), 'utf8'), 'secret\n');

  const target2 = writeTree(tmpDir(), { 'CLAUDE.md': 'mine\n' });
  linkFile(path.join(outside, 'victim.txt'), path.join(target2, 'CLAUDE.md.new'));
  assert.throws(() => install({ kitRoot: KIT_ROOT, target: target2, apply: true }), /symlink/);
  assert.equal(fs.readFileSync(path.join(outside, 'victim.txt'), 'utf8'), 'secret\n');
});

test('requires=<pack> entries install only with that pack selected', () => {
  const kit = writeTree(tmpDir('agent-kit-fixture-'), {
    'core/manifest.txt': 'copy a.txt\n',
    'core/files/a.txt': 'a',
    'packs/github/manifest.txt': 'copy .github/x.yml\n',
    'packs/github/files/.github/x.yml': 'x: 1\n',
    'presets/demo/manifest.txt': 'copy .github/workflows/ci.yml requires=github from=github/workflows/ci.yml\ncopy docs/agent-kit/demo.md from=docs/demo.md\n',
    'presets/demo/github/workflows/ci.yml': 'name: ci\n',
    'presets/demo/docs/demo.md': '# Demo setup\n',
  });
  const t1 = tmpDir();
  const without = install({ kitRoot: kit, target: t1, presets: ['demo'], apply: true });
  assert.ok(ops(without).includes('skip (needs --pack github) .github/workflows/ci.yml'));
  assert.equal(exists(t1, '.github/workflows/ci.yml'), false);
  assert.deepEqual(without.nextSteps, ['docs/agent-kit/demo.md']);
  assert.equal(read(t1, 'docs/agent-kit/demo.md'), '# Demo setup\n');

  const t2 = tmpDir();
  install({ kitRoot: kit, target: t2, presets: ['demo'], packs: ['github'], apply: true });
  assert.equal(read(t2, '.github/workflows/ci.yml'), 'name: ci\n');
});

test('implies <pack> selects that pack (transitively), enables its requires= entries, and is reported', () => {
  const kit = writeTree(tmpDir('agent-kit-fixture-'), {
    'core/manifest.txt': 'copy a.txt\n',
    'core/files/a.txt': 'a',
    'packs/web/manifest.txt': 'implies base\ncopy web.txt\n',
    'packs/web/files/web.txt': 'w',
    'packs/base/manifest.txt': 'copy base.txt\n',
    'packs/base/files/base.txt': 'b',
    'presets/react/manifest.txt': 'implies web\ncopy r.txt\ncopy r-web.txt requires=web\n',
    'presets/react/files/r.txt': 'r',
    'presets/react/files/r-web.txt': 'rw',
  });
  const t = tmpDir();
  const res = install({ kitRoot: kit, target: t, presets: ['react'], apply: true });
  for (const f of ['a.txt', 'web.txt', 'base.txt', 'r.txt', 'r-web.txt']) assert.ok(exists(t, f), f);
  assert.deepEqual(res.notes, ['pack web added because preset react implies it', 'pack base added because pack web implies it']);
  // Naming the pack explicitly as well is fine and adds no note for it.
  const res2 = install({ kitRoot: kit, target: tmpDir(), presets: ['react'], packs: ['web'] });
  assert.deepEqual(res2.notes, ['pack base added because pack web implies it']);

  const bad = writeTree(tmpDir('agent-kit-fixture-'), {
    'core/manifest.txt': 'copy a.txt\n',
    'core/files/a.txt': 'a',
    'presets/p/manifest.txt': 'implies ghost\n',
  });
  assert.throws(() => install({ kitRoot: bad, target: tmpDir(), presets: ['p'] }), /implies unknown pack "ghost"/);
  const coreImplies = writeTree(tmpDir('agent-kit-fixture-'), { 'core/manifest.txt': 'implies web\n' });
  assert.throws(() => install({ kitRoot: coreImplies, target: tmpDir() }), /core cannot use implies/);
});

test('hook files get the exec bit on POSIX; Windows skips chmod with a note', () => {
  const kit = fixtureKit('copy .husky/pre-commit\n', { 'core/files/.husky/pre-commit': 'npx lint-staged\n' });
  const winTarget = tmpDir();
  const win = install({ kitRoot: kit, target: winTarget, apply: true, platform: 'win32' });
  assert.ok(win.notes.some((n) => n.includes('.husky/pre-commit') && n.includes('Windows')));
  if (process.platform !== 'win32') {
    const t = tmpDir();
    install({ kitRoot: kit, target: t, apply: true, platform: process.platform });
    assert.ok(fs.statSync(path.join(t, '.husky', 'pre-commit')).mode & 0o100, 'owner exec bit set');
  }
});

test('unknown preset/pack names are errors that list valid names; missing target is an error', () => {
  const t = tmpDir();
  assert.throws(() => install({ kitRoot: KIT_ROOT, target: t, packs: ['nope'] }), (e) => e instanceof UsageError && /github, web/.test(e.message));
  assert.throws(() => install({ kitRoot: KIT_ROOT, target: t, presets: ['nope'] }), UsageError);
  assert.throws(() => install({ kitRoot: KIT_ROOT, target: path.join(t, 'missing') }), /does not exist/);
});

test('CLI exit codes and argument parsing', () => {
  const t = tmpDir();
  const lines = [];
  assert.equal(main(['install', '--target', t], { out: (l) => lines.push(l), err: () => {} }), 0);
  assert.ok(lines.some((l) => l.startsWith('Dry run')));
  assert.deepEqual(fs.readdirSync(t), []);
  assert.equal(main(['install', `--target=${t}`, '--apply'], quiet), 0);
  assert.equal(main(['validate', '--target', t], quiet), 0);
  assert.equal(main(['install', '--bogus'], quiet), 1);
  assert.equal(main(['install', '--pack'], quiet), 1);
  assert.equal(main(['frobnicate'], quiet), 1);
  assert.equal(main(['list'], quiet), 0);

  // Presets' setup commands are printed (the installer never edits package.json/pyproject.toml).
  const py = [];
  assert.equal(main(['install', '--target', tmpDir(), '--preset', 'python'], { out: (l) => py.push(l), err: () => {} }), 0);
  assert.ok(py.some((l) => l.includes('(after --apply)')));
  assert.ok(py.some((l) => l.trim() === 'pre-commit install'));
  assert.ok(py.some((l) => l.trim() === 'python -m pip install ruff==0.17.4 pytest pre-commit'));
  const rt = [];
  main(['install', '--target', tmpDir(), '--preset', 'react-typescript'], { out: (l) => rt.push(l), err: () => {} });
  assert.ok(rt.some((l) => l.trim().startsWith('npm install -D eslint@9 @eslint/js@9 ')));
  assert.equal(main(['--help'], quiet), 0);
});
