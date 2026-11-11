// Shared test helpers (not a test file itself; node --test runs it harmlessly).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function tmpDir(prefix = 'agent-kit-test-') {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

/** Write a { 'rel/path': content } map under root. */
export function writeTree(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

/** Hash of every path, type, mode and content under root (lstat, no symlink following). */
export function hashTree(root) {
  const h = crypto.createHash('sha256');
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const st = fs.lstatSync(abs);
      h.update(`${path.relative(root, abs)}|${st.isDirectory() ? 'd' : st.isSymbolicLink() ? 'l' : 'f'}|${st.mode}\n`);
      if (st.isDirectory()) walk(abs);
      else if (st.isFile()) h.update(fs.readFileSync(abs));
    }
  };
  walk(root);
  return h.digest('hex');
}

export const read = (root, rel) => fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8');
export const exists = (root, rel) => fs.existsSync(path.join(root, ...rel.split('/')));

/** Minimal valid skill file. */
export const skill = (name, body = 'Body.') => `---\nname: ${name}\ndescription: Test skill ${name}.\n---\n\n# ${name}\n\n${body}\n`;

/**
 * Try to create a directory link (junction on Windows, symlink elsewhere).
 * Returns false if the OS refuses (caller should skip).
 */
export function linkDir(target, linkPath) {
  try {
    fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
    return true;
  } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EACCES') return false;
    throw e;
  }
}

export function linkFile(target, linkPath) {
  try {
    fs.symlinkSync(target, linkPath, 'file');
    return true;
  } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EACCES') return false;
    throw e;
  }
}
