import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseManifest, checkRelPath, ManifestError, loadUnits } from '../src/manifest.js';
import { KIT_ROOT } from './helpers.js';

test('parses copy, copy-once and block entries with options and comments', () => {
  const { entries, description } = parseManifest(
    [
      '# description: Test unit.',
      '',
      'copy a/b.txt            # trailing comment',
      'copy-once  MEMORY.md',
      'copy .github/ci.yml requires=github from=github/ci.yml',
      'block core AGENTS.md agents-core.md',
      'block ign .gitignore gitignore.txt style=hash requires=github',
    ].join('\r\n'),
  );
  assert.equal(description, 'Test unit.');
  assert.equal(entries.length, 5);
  assert.deepEqual(entries[0], { kind: 'copy', dest: 'a/b.txt', source: 'files/a/b.txt', requires: null, line: 3 });
  assert.equal(entries[1].kind, 'copy-once');
  assert.equal(entries[2].source, 'github/ci.yml');
  assert.equal(entries[2].requires, 'github');
  assert.equal(entries[3].style, 'html');
  assert.equal(entries[3].source, 'fragments/agents-core.md');
  assert.equal(entries[4].style, 'hash');
});

test('rejects unsafe paths regardless of host OS', () => {
  for (const bad of ['../x', 'a/../b', '/etc/passwd', 'C:/x', 'C:x', 'c:\\x', '\\\\server\\share', 'a\\b', '~/x', './a', 'a//b', 'a/', '']) {
    assert.notEqual(checkRelPath(bad), null, `expected "${bad}" to be rejected`);
  }
  for (const good of ['a', '.github/workflows/ci.yml', '.husky/pre-commit', 'a..b/c']) {
    assert.equal(checkRelPath(good), null, `expected "${good}" to be accepted`);
  }
  assert.throws(() => parseManifest('copy ../escape'), ManifestError);
  assert.throws(() => parseManifest('copy /abs/path'), ManifestError);
  assert.throws(() => parseManifest('copy C:/Windows/x'), ManifestError);
  assert.throws(() => parseManifest('copy ok from=../../outside'), ManifestError);
  assert.throws(() => parseManifest('block x ../AGENTS.md f.md'), ManifestError);
  assert.throws(() => parseManifest('block x AGENTS.md ../f.md'), ManifestError);
});

test('rejects malformed entries with file:line context', () => {
  const cases = [
    ['move a b', /unknown entry type/],
    ['copy', /needs a path/],
    ['block id AGENTS.md', /needs <id> <dest> <fragment>/],
    ['block Bad_Id AGENTS.md f.md', /invalid block id/],
    ['block x AGENTS.md f.md style=xml', /style must be/],
    ['copy a stray', /unexpected field/],
    ['copy a colour=red', /unknown option/],
    ['copy a requires=x requires=y', /given twice/],
    ['copy-once a style=hash', /unknown option/],
  ];
  for (const [line, re] of cases) {
    assert.throws(() => parseManifest(`# c\n${line}`, 'm.txt'), (e) => e instanceof ManifestError && re.test(e.message) && e.message.startsWith('m.txt:2'));
  }
});

test('parses implies lines and rejects malformed ones', () => {
  assert.deepEqual(parseManifest('implies web\nimplies github # comment\n').implies, ['web', 'github']);
  assert.throws(() => parseManifest('implies'), /exactly one pack/);
  assert.throws(() => parseManifest('implies a b'), /exactly one pack/);
  assert.throws(() => parseManifest('implies Web'), /invalid pack name/);
  assert.throws(() => parseManifest('implies web\nimplies web'), /implied twice/);
});

test('loads the real kit units', () => {
  const units = loadUnits(KIT_ROOT);
  assert.equal(units.core.name, 'core');
  assert.ok(units.packs.has('web'));
  assert.ok(units.packs.has('github'));
});
