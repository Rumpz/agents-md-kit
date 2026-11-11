import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { install } from '../src/install.js';
import { validateRepo, validateTemplate, indexedSkills } from '../src/validate.js';
import { KIT_ROOT, tmpDir, writeTree, read, skill } from './helpers.js';

function installed(packs = ['web', 'github']) {
  const t = tmpDir();
  install({ kitRoot: KIT_ROOT, target: t, packs, apply: true });
  return t;
}
const edit = (t, rel, fn) => fs.writeFileSync(path.join(t, ...rel.split('/')), fn(read(t, rel)));
const errorsOf = (t) => validateRepo({ target: t, kitRoot: KIT_ROOT }).errors;

test('a fresh install passes validate (core only and core + web + github)', () => {
  assert.deepEqual(errorsOf(installed([])), []);
  assert.deepEqual(errorsOf(installed()), []);
});

test('every real preset installs, validates and re-installs as a no-op, with and without github', () => {
  for (const preset of ['react-typescript', 'node-backend', 'python']) {
    for (const packs of [[], ['github']]) {
      const label = `${preset} ${packs.join(',')}`;
      const t = tmpDir();
      const first = install({ kitRoot: KIT_ROOT, target: t, presets: [preset], packs, apply: true });
      assert.equal(first.conflicts, 0, label);
      assert.deepEqual(first.nextSteps, [`docs/agent-kit/${preset}.md`], label);
      assert.deepEqual(errorsOf(t), [], label);
      assert.equal(fs.existsSync(path.join(t, 'release-please-config.json')), packs.includes('github'), label);
      assert.equal(fs.existsSync(path.join(t, '.github', 'workflows', 'ci.yml')), packs.includes('github'), label);
      const again = install({ kitRoot: KIT_ROOT, target: t, presets: [preset], packs, apply: true });
      assert.equal(again.writes, 0, label);
    }
  }
});

test('presets that ship different content for the same file cannot be combined', () => {
  assert.throws(
    () => install({ kitRoot: KIT_ROOT, target: tmpDir(), presets: ['react-typescript', 'node-backend'] }),
    /node-backend and react-typescript both install eslint\.config\.mjs with different content/,
  );
  assert.throws(() => install({ kitRoot: KIT_ROOT, target: tmpDir(), presets: ['node-backend', 'python'] }), /different content/);
});

test('validate --template passes on this repository', () => {
  const r = validateTemplate({ kitRoot: KIT_ROOT });
  assert.deepEqual(r.errors, []);
  assert.ok(r.notes.some((n) => /light check/.test(n)));
});

test('fails on a wrong frontmatter name', () => {
  const t = installed();
  edit(t, '.claude/skills/backend-security/SKILL.md', (s) => s.replace('name: backend-security', 'name: security'));
  assert.ok(errorsOf(t).some((e) => /name "security" must equal folder name "backend-security"/.test(e)));
});

test('fails on a missing description', () => {
  const t = installed();
  edit(t, '.claude/skills/api-design-rest/SKILL.md', (s) => s.replace(/^description:.*$/m, 'description:'));
  assert.ok(errorsOf(t).some((e) => /api-design-rest\/SKILL\.md: frontmatter description/.test(e)));
});

test('fails when the index lists a skill that does not exist', () => {
  const t = installed();
  fs.rmSync(path.join(t, '.claude', 'skills', 'seo-best-practices'), { recursive: true });
  assert.ok(errorsOf(t).some((e) => /index lists skill `seo-best-practices`/.test(e)));
});

test('fails when an installed skill is missing from the index', () => {
  const t = installed();
  writeTree(t, { '.claude/skills/team-extra/SKILL.md': skill('team-extra') });
  assert.ok(errorsOf(t).some((e) => /installed skill `team-extra` is missing from the index/.test(e)));
  // Listing it in a user-owned block outside agent-kit markers does not count; inside a managed block it does.
  edit(t, 'AGENTS.md', (s) => s.replace('| Project management |', '| Extra | `team-extra` | Always |\n| Project management |'));
  assert.deepEqual(errorsOf(t), []);
});

test('fails on a skill reference ending in .md, and on an unresolved reference', () => {
  const t = installed([]);
  edit(t, 'MEMORY.md', (s) => s + '\nSee `backend-security.md`.\n');
  assert.ok(errorsOf(t).some((e) => /MEMORY\.md: skill reference `backend-security\.md` must not end in \.md/.test(e)));
  const t2 = installed([]);
  edit(t2, '.claude/skills/api-design-rest/SKILL.md', (s) => s + '\nAlso see `seo-best-practices`.\n');
  assert.ok(errorsOf(t2).some((e) => /reference to skill `seo-best-practices` does not resolve/.test(e)));
});

test('fails on an unpaired or duplicated marker', () => {
  const t = installed();
  edit(t, 'AGENTS.md', (s) => s.replace('<!-- END agent-kit:web -->', ''));
  assert.ok(errorsOf(t).some((e) => /AGENTS\.md: line \d+: BEGIN web is never closed/.test(e)));
  const t2 = installed();
  edit(t2, 'AGENTS.md', (s) => s + '\n<!-- BEGIN agent-kit:core -->\n<!-- END agent-kit:core -->\n');
  assert.ok(errorsOf(t2).some((e) => /duplicate block core/.test(e)));
});

test('fails on invalid JSON and tab-indented YAML in kit-managed files', () => {
  const t = installed();
  edit(t, '.claude/settings.json', (s) => s.replace('{', '{,'));
  edit(t, '.github/workflows/pr-title.yml', (s) => s.replace('jobs:\n  pr-title:', 'jobs:\n\tpr-title:'));
  const errs = errorsOf(t);
  assert.ok(errs.some((e) => /settings\.json: invalid JSON/.test(e)));
  assert.ok(errs.some((e) => /pr-title\.yml:\d+: tab used for indentation/.test(e)));
});

test('index parsing reads only the Skill column of tables', () => {
  const md = '| Area | Skill | Load when |\n|---|---|---|\n| A | `one` | `not-a-skill` |\n\n| File | Owner |\n|---|---|\n| `x` | y |\n';
  assert.deepEqual(indexedSkills(md), ['one']);
});

test('--template: a preset may reference skills of packs it implies, and only those', () => {
  const files = (implies) => ({
    'core/manifest.txt': 'block core AGENTS.md a.md\ncopy .claude/skills/c1/SKILL.md\n',
    'core/fragments/a.md': '| Area | Skill | Load when |\n|---|---|---|\n| C | `c1` | x |\n',
    'core/files/.claude/skills/c1/SKILL.md': skill('c1'),
    'packs/web/manifest.txt': 'block web AGENTS.md w.md\ncopy .claude/skills/w1/SKILL.md\n',
    'packs/web/fragments/w.md': '| Area | Skill | Load when |\n|---|---|---|\n| W | `w1` | x |\n',
    'packs/web/files/.claude/skills/w1/SKILL.md': skill('w1'),
    'presets/react/manifest.txt': `# run: npm install\n${implies}block react AGENTS.md r.md\ncopy .claude/skills/r1/SKILL.md\n`,
    'presets/react/fragments/r.md': '| Area | Skill | Load when |\n|---|---|---|\n| R | `r1` | x |\n',
    'presets/react/files/.claude/skills/r1/SKILL.md': skill('r1', 'See `w1` and `c1`.'),
  });
  const ok = validateTemplate({ kitRoot: writeTree(tmpDir('agent-kit-fixture-'), files('implies web\n')) });
  assert.deepEqual(ok.errors, []);
  const missing = validateTemplate({ kitRoot: writeTree(tmpDir('agent-kit-fixture-'), files('')) });
  assert.ok(missing.errors.some((e) => /r1\/SKILL\.md: reference to skill `w1` does not resolve/.test(e)), missing.errors.join('\n'));
  const ghost = validateTemplate({ kitRoot: writeTree(tmpDir('agent-kit-fixture-'), files('implies web\nimplies ghost\n')) });
  assert.ok(ghost.errors.some((e) => /implies ghost, which is not a pack/.test(e)), ghost.errors.join('\n'));
});

test('--template catches orphans, missing sources, duplicate copies, bad requires, unindexed skills', () => {
  const kit = writeTree(tmpDir('agent-kit-fixture-'), {
    'core/manifest.txt': 'copy a.txt\ncopy missing.txt\ncopy .claude/skills/s1/SKILL.md\nblock core AGENTS.md agents.md\n',
    'core/files/a.txt': 'a',
    'core/files/orphan.txt': 'o',
    'core/files/.claude/skills/s1/SKILL.md': skill('s1'),
    'core/fragments/agents.md': '| Area | Skill | Load when |\n|---|---|---|\n| X | `ghost` | y |\n',
    'core/fragments/unused.md': 'never referenced',
    'packs/p/manifest.txt': 'copy a.txt requires=nonexistent\n',
    'packs/p/files/a.txt': 'a',
    'presets/norun/manifest.txt': '# description: no commands\ncopy b.txt\n',
    'presets/norun/files/b.txt': 'b',
  });
  const errs = validateTemplate({ kitRoot: kit }).errors;
  const expect = [
    /core\/manifest\.txt:2: source core\/files\/missing\.txt does not exist/,
    /core\/files\/orphan\.txt: orphan file/,
    /core\/fragments\/unused\.md: orphan file/,
    /packs\/p\/manifest\.txt:1: a\.txt is also copied by core/,
    /requires=nonexistent is not a pack/,
    /core: skill `s1` is not listed/,
    /core: AGENTS\.md fragment lists `ghost`/,
    /presets\/norun\/manifest\.txt: a preset needs at least one "# run: <command>" line/,
  ];
  for (const re of expect) assert.ok(errs.some((e) => re.test(e)), `expected an error matching ${re}\n${errs.join('\n')}`);
});
