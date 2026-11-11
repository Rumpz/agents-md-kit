// Filesystem helpers that keep every write inside the target and never follow symlinks.

import fs from 'node:fs';
import path from 'node:path';
import { checkRelPath } from './manifest.js';

export class SafetyError extends Error {}

/** Resolve a manifest-relative path inside root, or throw. */
export function resolveInside(/** @type {string} */ root, /** @type {string} */ rel) {
  const err = checkRelPath(rel);
  if (err) throw new SafetyError(`unsafe path "${rel}": ${err}`);
  const abs = path.resolve(root, ...rel.split('/'));
  const back = path.relative(root, abs);
  if (back === '' || back.startsWith('..') || path.isAbsolute(back)) {
    throw new SafetyError(`path "${rel}" resolves outside ${root}`);
  }
  return abs;
}

function lstatOrNull(/** @type {string} */ p) {
  try {
    return fs.lstatSync(p);
  } catch (e) {
    if (/** @type {NodeJS.ErrnoException} */ (e).code === 'ENOENT' || /** @type {NodeJS.ErrnoException} */ (e).code === 'ENOTDIR') return null;
    throw e;
  }
}

/**
 * Throw if any existing component of root/rel (below root) is a symlink or
 * junction, or if an intermediate component exists and is not a directory.
 * Returns the lstat of the leaf (or null when it does not exist).
 */
export function assertNoSymlinks(/** @type {string} */ root, /** @type {string} */ rel) {
  resolveInside(root, rel);
  const parts = rel.split('/');
  let cur = root;
  for (let i = 0; i < parts.length; i++) {
    cur = path.join(cur, parts[i]);
    const st = lstatOrNull(cur);
    if (!st) return null;
    if (st.isSymbolicLink()) {
      throw new SafetyError(`refusing to follow symlink: ${parts.slice(0, i + 1).join('/')}`);
    }
    const isLeaf = i === parts.length - 1;
    if (!isLeaf && !st.isDirectory()) {
      throw new SafetyError(`not a directory: ${parts.slice(0, i + 1).join('/')}`);
    }
    if (isLeaf) {
      if (!st.isFile()) throw new SafetyError(`not a regular file: ${rel}`);
      return st;
    }
  }
  return null;
}

/** Read root/rel as a Buffer after symlink checks; null if missing. */
export function readTargetFile(/** @type {string} */ root, /** @type {string} */ rel) {
  const st = assertNoSymlinks(root, rel);
  if (!st) return null;
  return fs.readFileSync(resolveInside(root, rel));
}

/** Create parent directories one level at a time, refusing symlinks along the way. */
function mkdirsSafe(/** @type {string} */ root, /** @type {string} */ rel) {
  const parts = rel.split('/').slice(0, -1);
  let cur = root;
  for (let i = 0; i < parts.length; i++) {
    cur = path.join(cur, parts[i]);
    const st = lstatOrNull(cur);
    if (st && st.isSymbolicLink()) {
      throw new SafetyError(`refusing to follow symlink: ${parts.slice(0, i + 1).join('/')}`);
    }
    if (st && !st.isDirectory()) throw new SafetyError(`not a directory: ${parts.slice(0, i + 1).join('/')}`);
    if (!st) fs.mkdirSync(cur);
  }
}

/** Write root/rel (creating parents) after re-checking that nothing on the path is a symlink. */
export function writeTargetFile(
  /** @type {string} */ root,
  /** @type {string} */ rel,
  /** @type {Buffer} */ data,
  /** @type {{ mode?: number }} */ { mode } = {},
) {
  assertNoSymlinks(root, rel);
  mkdirsSafe(root, rel);
  const abs = resolveInside(root, rel);
  fs.writeFileSync(abs, data);
  if (mode !== undefined) fs.chmodSync(abs, mode);
}

/** Text equality that ignores LF vs CRLF differences. */
export function sameText(/** @type {Buffer} */ a, /** @type {Buffer} */ b) {
  if (a.equals(b)) return true;
  const norm = (/** @type {Buffer} */ buf) => buf.toString('utf8').replace(/\r\n/g, '\n');
  return norm(a) === norm(b);
}

/**
 * Recursively list files (relative, forward slashes) under dir. Skips symlinks.
 * @returns {string[]}
 */
export function walkFiles(/** @type {string} */ dir, base = dir, /** @type {Set<string>} */ skip = new Set()) {
  /** @type {string[]} */
  let out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if (/** @type {NodeJS.ErrnoException} */ (e).code === 'ENOENT') return out;
    throw e;
  }
  for (const d of entries) {
    if (skip.has(d.name)) continue;
    const abs = path.join(dir, d.name);
    if (d.isSymbolicLink()) continue;
    if (d.isDirectory()) out = out.concat(walkFiles(abs, base, skip));
    else if (d.isFile()) out.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return out.sort();
}
