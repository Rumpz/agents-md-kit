// Validation for an installed repo (default) and for this kit's own template (--template).

import fs from 'node:fs';
import path from 'node:path';
import { loadUnits } from './manifest.js';
import { findBlocks } from './blocks.js';
import { readTargetFile, walkFiles } from './fsutil.js';

const SKILLS_DIR = '.claude/skills';

/**
 * @typedef {import('./manifest.js').Units} Units
 * @typedef {{ known: Set<string>, available: Set<string> }} RefContext
 */

/** Parse simple `key: value` YAML frontmatter. Returns null if there is none. */
export function parseFrontmatter(/** @type {string} */ text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  if (lines[0].trim() !== '---') return null;
  /** @type {Record<string, string>} */
  const data = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return data;
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
    if (m) data[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return null; // never closed
}

function checkSkillFile(/** @type {string} */ text, /** @type {string} */ folder, /** @type {string} */ label, /** @type {string[]} */ errors) {
  const fm = parseFrontmatter(text);
  if (!fm) return errors.push(`${label}: missing or unterminated frontmatter`);
  if (fm.name !== folder) errors.push(`${label}: frontmatter name "${fm.name ?? ''}" must equal folder name "${folder}"`);
  if (!fm.description) errors.push(`${label}: frontmatter description is missing or empty`);
}

/** Backtick code spans outside fenced code blocks. */
export function codeSpans(/** @type {string} */ text) {
  const withoutFences = text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '');
  /** @type {string[]} */ 
  const spans = [];
  for (const m of withoutFences.matchAll(/`([^`\n]+)`/g)) spans.push(m[1].trim());
  return spans;
}

/** Check backtick references to skills. known = every skill name the kit or repo knows. */
function checkRefs(/** @type {string} */ text, /** @type {string} */ label, /** @type {RefContext} */ { known, available }, /** @type {string[]} */ errors) {
  for (const span of codeSpans(text)) {
    if (span.endsWith('.md')) {
      const base = path.posix.basename(span.slice(0, -3));
      if (known.has(base) && !span.includes('/')) {
        errors.push(`${label}: skill reference \`${span}\` must not end in .md (use \`${base}\`)`);
      }
      continue;
    }
    if (known.has(span) && !available.has(span)) {
      errors.push(`${label}: reference to skill \`${span}\` does not resolve (not installed)`);
    }
  }
}

/**
 * Skill names listed in index tables: markdown tables whose header has a
 * "Skill" column. Only text inside the given regions is considered.
 */
export function indexedSkills(/** @type {string} */ text) {
  /** @type {string[]} */ 
  const names = [];
  let col = -1;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('|')) {
      col = -1;
      continue;
    }
    const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (col === -1) {
      col = cells.findIndex((c) => c.toLowerCase() === 'skill');
      if (col === -1) col = -2; // a table without a Skill column
      continue;
    }
    if (col < 0 || /^:?-+:?$/.test(cells[0] ?? '')) continue;
    const m = /^`([^`]+)`$/.exec(cells[col] ?? '');
    if (m) names.push(m[1]);
  }
  return names;
}

function blockRegions(/** @type {string} */ text) {
  const { blocks } = findBlocks(text);
  return blocks.map((b) => text.slice(b.start, b.end)).join('\n\n');
}

function kitSkillNames(/** @type {Units} */ units) {
  /** @type {Map<string, string>} skill name -> unit name */
  const out = new Map();
  for (const u of [units.core, ...units.packs.values(), ...units.presets.values()]) {
    for (const e of u.entries) {
      const m = /^\.claude\/skills\/([^/]+)\/SKILL\.md$/.exec(e.dest);
      if (m && e.kind !== 'block') out.set(m[1], u.name);
    }
  }
  return out;
}

function lightYamlCheck(/** @type {string} */ text, /** @type {string} */ label, /** @type {string[]} */ errors) {
  if (!text.trim()) return errors.push(`${label}: YAML file is empty`);
  const lines = text.split(/\r?\n/);
  lines.forEach((l, i) => {
    if (/^[ ]*\t/.test(l)) errors.push(`${label}:${i + 1}: tab used for indentation in YAML`);
  });
}

function checkJson(/** @type {string} */ text, /** @type {string} */ label, /** @type {string[]} */ errors) {
  try {
    JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    errors.push(`${label}: invalid JSON (${/** @type {Error} */ (e).message})`);
  }
}

/** Validate an installed repository. */
export function validateRepo(
  /** @type {{ target: string, kitRoot: string, platform?: string }} */ { target, kitRoot, platform = process.platform },
) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  const notes = ['YAML files get a light check only (non-empty, no tab indentation), not a full parse.'];
  const root = fs.realpathSync(target);
  const units = loadUnits(kitRoot);
  const read = (/** @type {string} */ rel) => {
    try {
      const buf = readTargetFile(root, rel);
      return buf === null ? null : buf.toString('utf8');
    } catch (e) {
      errors.push(`${rel}: ${/** @type {Error} */ (e).message}`);
      return null;
    }
  };

  // Skills
  const skillsAbs = path.join(root, ...SKILLS_DIR.split('/'));
  /** @type {Set<string>} */
  const installed = new Set();
  const skillTexts = [];
  if (fs.existsSync(skillsAbs)) {
    for (const d of fs.readdirSync(skillsAbs, { withFileTypes: true })) {
      if (d.isSymbolicLink()) {
        errors.push(`${SKILLS_DIR}/${d.name}: is a symlink`);
        continue;
      }
      if (!d.isDirectory()) continue;
      installed.add(d.name);
      const rel = `${SKILLS_DIR}/${d.name}/SKILL.md`;
      const text = read(rel);
      if (text === null) {
        errors.push(`${rel}: missing`);
        continue;
      }
      checkSkillFile(text, d.name, rel, errors);
      skillTexts.push([rel, text]);
    }
  }
  const known = new Set([...kitSkillNames(units).keys(), ...installed]);
  const ctx = { known, available: installed };

  // AGENTS.md index and drift
  const agents = read('AGENTS.md');
  if (agents === null) {
    if (installed.size) errors.push('AGENTS.md: missing (skills are installed but not indexed)');
  } else {
    const { errors: blockErrors } = findBlocks(agents);
    for (const e of blockErrors) errors.push(`AGENTS.md: ${e}`);
    const indexed = new Set(indexedSkills(blockRegions(agents)));
    for (const n of indexed) {
      if (!installed.has(n)) errors.push(`AGENTS.md: index lists skill \`${n}\` but ${SKILLS_DIR}/${n}/ does not exist`);
    }
    for (const n of installed) {
      if (!indexed.has(n)) errors.push(`AGENTS.md: installed skill \`${n}\` is missing from the index`);
    }
    checkRefs(agents, 'AGENTS.md', ctx, errors);
  }
  for (const [rel, text] of skillTexts) checkRefs(text, rel, ctx, errors);
  for (const rel of ['CLAUDE.md', 'MEMORY.md']) {
    const text = read(rel);
    if (text !== null) checkRefs(text, rel, ctx, errors);
  }

  // Managed blocks in other files, JSON/YAML of kit-managed files, hooks
  const allEntries = [units.core, ...units.packs.values(), ...units.presets.values()].flatMap((u) => u.entries);
  const blockDests = new Set(allEntries.filter((e) => e.kind === 'block' && e.dest !== 'AGENTS.md').map((e) => e.dest));
  for (const rel of blockDests) {
    const text = read(rel);
    if (text === null) continue;
    for (const e of findBlocks(text).errors) errors.push(`${rel}: ${e}`);
  }
  const fileDests = new Set(allEntries.filter((e) => e.kind !== 'block').map((e) => e.dest));
  for (const rel of [...fileDests].sort()) {
    if (rel.endsWith('.json')) {
      const text = read(rel);
      if (text !== null) checkJson(text, rel, errors);
    } else if (/\.ya?ml$/.test(rel)) {
      const text = read(rel);
      if (text !== null) lightYamlCheck(text, rel, errors);
    }
  }
  const huskyAbs = path.join(root, '.husky');
  if (fs.existsSync(huskyAbs) && fs.lstatSync(huskyAbs).isDirectory()) {
    for (const d of fs.readdirSync(huskyAbs, { withFileTypes: true })) {
      if (!d.isFile()) continue;
      if (platform === 'win32') {
        notes.push(`.husky/${d.name}: exec bit not checked on Windows`);
      } else if ((fs.statSync(path.join(huskyAbs, d.name)).mode & 0o111) === 0) {
        warnings.push(`.husky/${d.name}: hook is not executable (chmod +x)`);
      }
    }
  }
  return { errors, warnings, notes };
}

/** Validate this kit's own template tree. */
export function validateTemplate(/** @type {{ kitRoot: string }} */ { kitRoot }) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  const notes = ['YAML files get a light check only (non-empty, no tab indentation), not a full parse.'];
  let units;
  try {
    units = loadUnits(kitRoot);
  } catch (e) {
    return { errors: [/** @type {Error} */ (e).message], warnings, notes };
  }
  const all = [units.core, ...units.packs.values(), ...units.presets.values()];
  const kitSkills = kitSkillNames(units);
  const known = new Set(kitSkills.keys());
  /** @type {Map<string, { name: string, type: string }>} copy destination -> unit */
  const copyDests = new Map();
  /** @type {Map<string, string>} dest#id -> unit name */
  const blockKeys = new Map();

  for (const u of all) {
    const label = path.relative(kitRoot, u.dir).split(path.sep).join('/');
    const referenced = new Set(['manifest.txt']);
    /** @type {Set<string>} */
    const ownSkills = new Set();
    /** @type {string[]} */ 
    const indexed = [];
    // A unit may reference skills from core, itself, and packs it implies (transitively).
    const reach = new Set(['core', u.name]);
    const queue = [...u.implies];
    for (let p = queue.shift(); p !== undefined; p = queue.shift()) {
      if (reach.has(p)) continue;
      const pack = units.packs.get(p);
      if (!pack) {
        errors.push(`${label}/manifest.txt: implies ${p}, which is not a pack (packs: ${[...units.packs.keys()].join(', ')})`);
        continue;
      }
      reach.add(p);
      queue.push(...pack.implies);
    }
    if (u.implies.includes(u.name)) errors.push(`${label}/manifest.txt: a pack cannot imply itself`);
    const available = new Set([...kitSkills].filter(([, owner]) => reach.has(owner)).map(([n]) => n));
    for (const e of u.entries) {
      const where = `${label}/manifest.txt:${e.line}`;
      referenced.add(e.source);
      const abs = path.join(u.dir, ...e.source.split('/'));
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        errors.push(`${where}: source ${label}/${e.source} does not exist`);
        continue;
      }
      if (e.requires && !units.packs.has(e.requires)) {
        errors.push(`${where}: requires=${e.requires} is not a pack (packs: ${[...units.packs.keys()].join(', ')})`);
      }
      if (e.requires && u.type === 'pack' && e.requires === u.name) {
        errors.push(`${where}: a pack cannot require itself`);
      }
      const text = fs.readFileSync(abs, 'utf8');
      if (e.kind === 'copy') {
        // Presets are alternatives (one per repository), so two presets may ship the same
        // destination; the installer refuses to combine presets whose contents differ.
        // Core and packs combine with everything, so they must not share a destination.
        const prev = copyDests.get(e.dest);
        if (prev && !(prev.type === 'preset' && u.type === 'preset')) {
          errors.push(`${where}: ${e.dest} is also copied by ${prev.name}`);
        } else if (!prev) copyDests.set(e.dest, { name: u.name, type: u.type });
      }
      if (e.kind === 'block') {
        const key = `${e.dest}#${e.id}`;
        if (blockKeys.has(key)) errors.push(`${where}: block ${e.id} in ${e.dest} is also defined by ${blockKeys.get(key)}`);
        else blockKeys.set(key, u.name);
        if (/\b(BEGIN|END)\s+agent-kit:/.test(text)) errors.push(`${where}: fragment contains an agent-kit marker`);
        if (e.dest === 'AGENTS.md') indexed.push(...indexedSkills(text));
        checkRefs(text, `${label}/${e.source}`, { known, available }, errors);
      }
      const skill = /^\.claude\/skills\/([^/]+)\/SKILL\.md$/.exec(e.dest);
      if (skill && e.kind !== 'block') {
        ownSkills.add(skill[1]);
        checkSkillFile(text, skill[1], `${label}/${e.source}`, errors);
        checkRefs(text, `${label}/${e.source}`, { known, available }, errors);
      }
      if (e.kind !== 'block' && ['CLAUDE.md', 'MEMORY.md'].includes(e.dest)) {
        checkRefs(text, `${label}/${e.source}`, { known, available }, errors);
      }
      if (e.dest.endsWith('.json')) checkJson(text, `${label}/${e.source}`, errors);
      if (/\.ya?ml$/.test(e.dest)) lightYamlCheck(text, `${label}/${e.source}`, errors);
    }
    if (u.type === 'preset' && u.runs.length === 0) {
      errors.push(`${label}/manifest.txt: a preset needs at least one "# run: <command>" line (setup commands the installer prints)`);
    }
    for (const f of walkFiles(u.dir)) {
      if (!referenced.has(f)) errors.push(`${label}/${f}: orphan file (not referenced by ${label}/manifest.txt)`);
    }
    for (const n of ownSkills) {
      if (!indexed.includes(n)) errors.push(`${label}: skill \`${n}\` is not listed in the unit's AGENTS.md fragment`);
    }
    for (const n of indexed) {
      if (!ownSkills.has(n)) errors.push(`${label}: AGENTS.md fragment lists \`${n}\`, which this unit does not ship`);
    }
  }
  return { errors, warnings, notes };
}
