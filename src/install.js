// Installer: plan every change in memory first, then (only with apply) write.
// Any error during planning aborts before a single byte is written.

import fs from 'node:fs';
import path from 'node:path';
import { loadUnits } from './manifest.js';
import { applyBlock, assertFragmentClean, renderBlock } from './blocks.js';
import { assertNoSymlinks, readTargetFile, resolveInside, sameText, writeTargetFile } from './fsutil.js';

export class UsageError extends Error {}

const isHook = (rel) => /^\.husky\/[^/]+$/.test(rel);

/** Pick units in a stable order: core, selected packs, selected presets (kit order). */
export function selectUnits(units, { presets = [], packs = [] } = {}) {
  const check = (names, map, kind) => {
    for (const n of names) {
      if (!map.has(n)) {
        const valid = [...map.keys()];
        throw new UsageError(
          `unknown ${kind} "${n}". Valid ${kind}s: ${valid.length ? valid.join(', ') : '(none)'}`,
        );
      }
    }
  };
  check(packs, units.packs, 'pack');
  check(presets, units.presets, 'preset');
  const packSet = new Set(packs);
  const presetSet = new Set(presets);
  // Expand `implies <pack>` transitively (presets and packs may imply packs).
  const implied = []; // { pack, by }
  const queue = [
    ...[...presetSet].map((n) => units.presets.get(n)),
    ...[...packSet].map((n) => units.packs.get(n)),
  ];
  while (queue.length) {
    const u = queue.shift();
    for (const p of u.implies ?? []) {
      if (!units.packs.has(p)) throw new Error(`${u.type} ${u.name} implies unknown pack "${p}"`);
      if (packSet.has(p)) continue;
      packSet.add(p);
      implied.push({ pack: p, by: `${u.type} ${u.name}` });
      queue.push(units.packs.get(p));
    }
  }
  return {
    selected: [
      units.core,
      ...[...units.packs.values()].filter((u) => packSet.has(u.name)),
      ...[...units.presets.values()].filter((u) => presetSet.has(u.name)),
    ],
    packs: packSet,
    implied,
  };
}

function readSource(unit, rel) {
  const abs = resolveInside(unit.dir, rel);
  try {
    return fs.readFileSync(abs);
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error(`${unit.type} ${unit.name}: missing source ${rel}`);
    throw e;
  }
}

/**
 * Plan (and optionally apply) an install.
 * Returns { actions: [{ op, path, unit, detail? }], conflicts, notes, nextSteps, applied }.
 */
export function install({ kitRoot, target, presets = [], packs = [], apply = false, platform = process.platform }) {
  const units = loadUnits(kitRoot);
  const { selected, packs: selectedPacks, implied } = selectUnits(units, { presets, packs });

  let root;
  try {
    root = fs.realpathSync(target);
  } catch {
    throw new UsageError(`target directory does not exist: ${target}`);
  }
  if (!fs.statSync(root).isDirectory()) throw new UsageError(`target is not a directory: ${target}`);

  const overlay = new Map(); // rel -> Buffer (planned content)
  const writes = []; // { rel, data, mode? }
  const actions = [];
  const notes = implied.map(({ pack, by }) => `pack ${pack} added because ${by} implies it`);

  const current = (rel) => {
    if (overlay.has(rel)) return overlay.get(rel);
    return readTargetFile(root, rel); // also refuses symlinks on the path
  };
  const plan = (rel, data, extra = {}) => {
    overlay.set(rel, data);
    const existing = writes.findIndex((w) => w.rel === rel);
    if (existing >= 0) writes.splice(existing, 1);
    writes.push({ rel, data, ...extra });
  };
  const conflict = (unit, rel, data, reason) => {
    const newRel = `${rel}.new`;
    assertNoSymlinks(root, newRel);
    const prev = current(newRel);
    if (!prev || !prev.equals(data)) plan(newRel, data);
    actions.push({ op: `conflict -> ${newRel}`, path: rel, unit: unit.name, detail: reason });
  };
  // Block conflicts for the same dest are collected, then written as ONE .new
  // holding every rendered block for that dest (in unit order).
  const blockConflicts = new Map(); // dest -> [rendered block]
  const claimed = new Map(); // dest -> { unit, src } for copy/copy-once entries

  for (const unit of selected) {
    for (const e of unit.entries) {
      if (e.requires && !units.packs.has(e.requires)) {
        throw new Error(`${unit.name}:${e.line}: requires unknown pack "${e.requires}"`);
      }
      if (e.requires && !selectedPacks.has(e.requires)) {
        actions.push({ op: `skip (needs --pack ${e.requires})`, path: e.dest, unit: unit.name });
        continue;
      }
      assertNoSymlinks(root, e.dest);
      if (e.kind === 'copy' || e.kind === 'copy-once') {
        const src = readSource(unit, e.source);
        const prevClaim = claimed.get(e.dest);
        if (prevClaim && !prevClaim.src.equals(src)) {
          throw new UsageError(
            `${prevClaim.unit} and ${unit.name} both install ${e.dest} with different content. ` +
              'Install one preset per repository (for monorepos see docs/monorepo.md in the kit).',
          );
        }
        claimed.set(e.dest, { unit: unit.name, src });
        const have = current(e.dest);
        const mode = isHook(e.dest) && platform !== 'win32' ? 0o755 : undefined;
        if (have === null) {
          plan(e.dest, src, { mode });
          actions.push({ op: 'create', path: e.dest, unit: unit.name });
        } else if (e.kind === 'copy-once') {
          actions.push({ op: 'skip (exists)', path: e.dest, unit: unit.name });
        } else if (sameText(have, src)) {
          actions.push({ op: 'unchanged', path: e.dest, unit: unit.name });
        } else {
          conflict(unit, e.dest, src, 'existing file differs');
        }
        if (isHook(e.dest) && platform === 'win32') {
          notes.push(`${e.dest}: exec bit not set on Windows; run "git update-index --chmod=+x ${e.dest}" after adding it`);
        }
      } else {
        const content = readSource(unit, e.source).toString('utf8');
        assertFragmentClean(content, `${unit.name}/${e.source}`);
        const have = current(e.dest);
        const title = e.dest.endsWith('.md') && e.style === 'html' ? `# ${path.posix.basename(e.dest)}` : null;
        const res = applyBlock(have === null ? null : have.toString('utf8'), {
          id: e.id,
          style: e.style,
          content,
          title,
        });
        if (res.status === 'conflict') {
          const newRel = `${e.dest}.new`;
          assertNoSymlinks(root, newRel);
          if (!blockConflicts.has(e.dest)) blockConflicts.set(e.dest, []);
          blockConflicts.get(e.dest).push(renderBlock(e.id, e.style, content));
          actions.push({ op: `conflict -> ${newRel}`, path: e.dest, unit: unit.name, detail: `block ${e.id}: ${res.reason}` });
        } else {
          if (res.status !== 'block-unchanged') plan(e.dest, Buffer.from(res.text, 'utf8'));
          actions.push({ op: res.status, path: e.dest, unit: unit.name, detail: `block ${e.id}` });
        }
      }
    }
  }

  for (const [dest, rendered] of blockConflicts) {
    const newRel = `${dest}.new`;
    const data = Buffer.from(rendered.join('\n\n') + '\n', 'utf8');
    const prev = current(newRel);
    if (!prev || !prev.equals(data)) plan(newRel, data);
  }

  const commands = selected.flatMap((u) => u.runs ?? []);
  const nextSteps = [];
  for (const unit of selected.filter((u) => u.type === 'preset')) {
    const doc = `docs/agent-kit/${unit.name}.md`;
    if (unit.entries.some((e) => e.dest === doc)) nextSteps.push(doc);
  }

  if (apply) {
    for (const w of writes) writeTargetFile(root, w.rel, w.data, { mode: w.mode });
  }

  const conflicts = actions.filter((a) => a.op.startsWith('conflict')).length;
  return {
    root,
    actions,
    conflicts,
    notes: [...new Set(notes)],
    nextSteps,
    commands,
    applied: apply,
    writes: writes.length,
    packs: [...selectedPacks],
  };
}
