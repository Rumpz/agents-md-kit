// Line-based manifest parser and unit discovery. No dependencies.
//
//   copy       <path> [requires=<pack>] [from=<unit-relative source>]
//   copy-once  <path> [requires=<pack>] [from=<unit-relative source>]
//   block      <id> <dest> <fragment> [style=html|hash] [requires=<pack>]
//   implies    <pack>          # selecting this unit also selects that pack (not allowed in core)
//
// `#` starts a comment (whole line or trailing). Fields split on whitespace,
// so paths cannot contain spaces. A first-line comment `# description: ...`
// is used by `agent-kit list`.

import fs from 'node:fs';
import path from 'node:path';

export class ManifestError extends Error {}

/**
 * @typedef {{ kind: 'copy' | 'copy-once', dest: string, source: string, requires: string | null, line: number }} CopyEntry
 * @typedef {{ kind: 'block', id: string, dest: string, fragment: string, source: string, style: 'html' | 'hash', requires: string | null, line: number }} BlockEntry
 * @typedef {CopyEntry | BlockEntry} Entry
 * @typedef {'core' | 'pack' | 'preset'} UnitType
 * @typedef {{ name: string, type: UnitType, dir: string, entries: Entry[], implies: string[], runs: string[], description: string }} Unit
 * @typedef {{ core: Unit, packs: Map<string, Unit>, presets: Map<string, Unit> }} Units
 */

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Check that a manifest path is a safe, relative, forward-slash path.
 * Rejected regardless of host OS: absolute POSIX paths, Windows drive and UNC
 * paths, backslashes, `.`/`..`/empty segments, NUL bytes.
 * Returns an error message, or null when the path is safe.
 */
export function checkRelPath(/** @type {unknown} */ p) {
  if (typeof p !== 'string' || p.length === 0) return 'empty path';
  if (p.includes('\0')) return 'path contains a NUL byte';
  if (p.includes('\\')) return 'path contains a backslash (use forward slashes)';
  if (p.startsWith('/')) return 'absolute path';
  if (/^[A-Za-z]:/.test(p)) return 'absolute or drive-relative Windows path';
  if (p.startsWith('~')) return 'path starts with ~';
  for (const seg of p.split('/')) {
    if (seg === '') return 'path has an empty segment';
    if (seg === '.' || seg === '..') return `path contains "${seg}"`;
  }
  return null;
}

function parseOptions(/** @type {string[]} */ tokens, /** @type {string[]} */ allowed, /** @type {string} */ where) {
  /** @type {Record<string, string>} */
  const opts = {};
  for (const tok of tokens) {
    const eq = tok.indexOf('=');
    if (eq <= 0) throw new ManifestError(`${where}: unexpected field "${tok}"`);
    const key = tok.slice(0, eq);
    const value = tok.slice(eq + 1);
    if (!allowed.includes(key)) {
      throw new ManifestError(`${where}: unknown option "${key}" (allowed: ${allowed.join(', ')})`);
    }
    if (key in opts) throw new ManifestError(`${where}: option "${key}" given twice`);
    if (value === '') throw new ManifestError(`${where}: option "${key}" has no value`);
    opts[key] = value;
  }
  if (opts.requires !== undefined && !NAME_RE.test(opts.requires)) {
    throw new ManifestError(`${where}: invalid requires value "${opts.requires}"`);
  }
  if (opts.style !== undefined && opts.style !== 'html' && opts.style !== 'hash') {
    throw new ManifestError(`${where}: style must be "html" or "hash", got "${opts.style}"`);
  }
  if (opts.from !== undefined) {
    const err = checkRelPath(opts.from);
    if (err) throw new ManifestError(`${where}: unsafe from path "${opts.from}": ${err}`);
  }
  return opts;
}

function safePath(/** @type {string} */ p, /** @type {string} */ where, /** @type {string} */ what) {
  const err = checkRelPath(p);
  if (err) throw new ManifestError(`${where}: unsafe ${what} "${p}": ${err}`);
  return p;
}

/** Parse manifest text into entries. Throws ManifestError on the first problem. */
export function parseManifest(/** @type {string} */ text, label = 'manifest') {
  /** @type {Entry[]} */
  const entries = [];
  /** @type {string[]} */
  const implies = [];
  /** @type {string[]} */
  const runs = []; // `# run: <command>` lines: commands the user runs (files we never touch)
  let description = '';
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const where = `${label}:${i + 1}`;
    const descMatch = /^#\s*description:\s*(.*)$/.exec(raw.trim());
    if (descMatch && !description) description = descMatch[1].trim();
    const runMatch = /^#\s*run:\s*(.+)$/.exec(raw.trim());
    if (runMatch) runs.push(runMatch[1].trim());
    const hash = raw.indexOf('#');
    const line = (hash >= 0 ? raw.slice(0, hash) : raw).trim();
    if (!line) return;
    const [kind, ...rest] = line.split(/\s+/);
    if (kind === 'copy' || kind === 'copy-once') {
      if (rest.length < 1) throw new ManifestError(`${where}: ${kind} needs a path`);
      const [p, ...optTokens] = rest;
      const opts = parseOptions(optTokens, ['requires', 'from'], where);
      entries.push({
        kind,
        dest: safePath(p, where, 'path'),
        source: opts.from ?? `files/${p}`,
        requires: opts.requires ?? null,
        line: i + 1,
      });
    } else if (kind === 'block') {
      if (rest.length < 3) throw new ManifestError(`${where}: block needs <id> <dest> <fragment>`);
      const [id, dest, fragment, ...optTokens] = rest;
      if (!ID_RE.test(id)) throw new ManifestError(`${where}: invalid block id "${id}" (use a-z, 0-9, -)`);
      const opts = parseOptions(optTokens, ['style', 'requires'], where);
      entries.push({
        kind,
        id,
        dest: safePath(dest, where, 'dest'),
        fragment: safePath(fragment, where, 'fragment'),
        source: `fragments/${fragment}`,
        style: /** @type {'html' | 'hash'} */ (opts.style ?? 'html'),
        requires: opts.requires ?? null,
        line: i + 1,
      });
    } else if (kind === 'implies') {
      if (rest.length !== 1) throw new ManifestError(`${where}: implies needs exactly one pack name`);
      if (!NAME_RE.test(rest[0])) throw new ManifestError(`${where}: invalid pack name "${rest[0]}"`);
      if (implies.includes(rest[0])) throw new ManifestError(`${where}: pack "${rest[0]}" implied twice`);
      implies.push(rest[0]);
    } else {
      throw new ManifestError(`${where}: unknown entry type "${kind}" (expected copy, copy-once, block or implies)`);
    }
  });
  return { entries, implies, runs, description };
}

function listDirs(/** @type {string} */ dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch (e) {
    if (/** @type {NodeJS.ErrnoException} */ (e).code === 'ENOENT') return [];
    throw e;
  }
}

/**
 * Discover units under kitRoot: `core`, `packs/<name>`, `presets/<name>`.
 * A folder counts as a unit only if it has a manifest.txt.
 * Returns { core, packs: Map, presets: Map } of { name, type, dir, entries, description }.
 */
export function loadUnits(/** @type {string} */ kitRoot) {
  /** @returns {Unit} */
  const load = (/** @type {string} */ name, /** @type {UnitType} */ type, /** @type {string} */ dir) => {
    const file = path.join(dir, 'manifest.txt');
    const label = path.relative(kitRoot, file).split(path.sep).join('/');
    const { entries, implies, runs, description } = parseManifest(fs.readFileSync(file, 'utf8'), label);
    if (type === 'core' && implies.length) throw new ManifestError(`${label}: core cannot use implies`);
    return { name, type, dir, entries, implies, runs, description };
  };
  const coreDir = path.join(kitRoot, 'core');
  if (!fs.existsSync(path.join(coreDir, 'manifest.txt'))) {
    throw new ManifestError(`no core/manifest.txt under ${kitRoot}`);
  }
  /** @type {Units} */
  const result = { core: load('core', 'core', coreDir), packs: new Map(), presets: new Map() };
  for (const [type, key] of /** @type {const} */ ([
    ['pack', 'packs'],
    ['preset', 'presets'],
  ])) {
    const base = path.join(kitRoot, key);
    for (const name of listDirs(base)) {
      const dir = path.join(base, name);
      if (!fs.existsSync(path.join(dir, 'manifest.txt'))) continue;
      if (!NAME_RE.test(name)) throw new ManifestError(`invalid ${type} folder name "${name}"`);
      result[key].set(name, load(name, type, dir));
    }
  }
  return result;
}
