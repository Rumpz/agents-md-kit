// agents-md-kit CLI logic. Exit codes: 0 success, 1 error, 2 install finished with conflicts.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { install, UsageError } from './install.js';
import { validateRepo, validateTemplate } from './validate.js';
import { loadUnits } from './manifest.js';

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Usage:
  agents-md-kit install [--preset <name>]... [--pack <name>]... [--target <dir>] [--apply]
  agents-md-kit validate [--target <dir>] [--template]
  agents-md-kit list

install is a dry run unless --apply is given. core is always installed.`;

export function parseArgs(/** @type {string[]} */ argv) {
  const [command, ...rest] = argv;
  /** @type {{ command: string, presets: string[], packs: string[], target: string, apply: boolean, template: boolean, help: boolean }} */
  const opts = { command, presets: [], packs: [], target: '.', apply: false, template: false, help: false };
  /** @type {Record<string, string[]>} */
  const allowed = {
    install: ['--preset', '--pack', '--target', '--apply'],
    validate: ['--target', '--template'],
    list: [],
  };
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    opts.help = true;
    return opts;
  }
  if (!(command in allowed)) throw new UsageError(`unknown command "${command}"\n\n${USAGE}`);
  for (let i = 0; i < rest.length; i++) {
    let arg = rest[i];
    let value;
    const eq = arg.indexOf('=');
    if (arg.startsWith('--') && eq > 0) {
      value = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (!allowed[command].includes(arg)) throw new UsageError(`unknown option "${arg}" for ${command}\n\n${USAGE}`);
    const needsValue = ['--preset', '--pack', '--target'].includes(arg);
    if (needsValue) {
      if (value === undefined) {
        value = rest[++i];
        if (value === undefined || value.startsWith('--')) throw new UsageError(`${arg} needs a value`);
      }
      if (arg === '--preset') opts.presets.push(value);
      else if (arg === '--pack') opts.packs.push(value);
      else opts.target = value;
    } else {
      if (value !== undefined) throw new UsageError(`${arg} takes no value`);
      if (arg === '--apply') opts.apply = true;
      if (arg === '--template') opts.template = true;
    }
  }
  return opts;
}

/** @typedef {(line: string) => void} Print */

function printReport(
  /** @type {{ errors: string[], warnings: string[], notes: string[] }} */ { errors, warnings, notes },
  /** @type {Print} */ out,
) {
  for (const e of errors) out(`error    ${e}`);
  for (const w of warnings) out(`warning  ${w}`);
  for (const n of notes) out(`note     ${n}`);
}

export function main(/** @type {string[]} */ argv, { out = console.log, err = console.error, cwd = process.cwd(), kitRoot = KIT_ROOT } = {}) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    err(/** @type {Error} */ (e).message);
    return 1;
  }
  if (opts.help) {
    out(USAGE);
    return 0;
  }
  const target = path.resolve(cwd, opts.target);
  try {
    if (opts.command === 'list') {
      const units = loadUnits(kitRoot);
      out(`core (always installed)\n  ${units.core.description}`);
      for (const [label, map] of /** @type {const} */ ([
        ['packs (--pack)', units.packs],
        ['presets (--preset)', units.presets],
      ])) {
        out(`\n${label}:`);
        if (map.size === 0) out('  (none)');
        for (const u of map.values()) {
          const inc = u.implies.length ? ` (also installs pack ${u.implies.join(', ')})` : '';
          out(`  ${u.name.padEnd(18)} ${u.description}${inc}`);
        }
      }
      return 0;
    }
    if (opts.command === 'validate') {
      const report = opts.template ? validateTemplate({ kitRoot }) : validateRepo({ target, kitRoot });
      printReport(report, out);
      const what = opts.template ? `template ${kitRoot}` : target;
      out(
        report.errors.length
          ? `\nvalidate: FAILED with ${report.errors.length} error(s) in ${what}`
          : `\nvalidate: OK (${report.warnings.length} warning(s)) in ${what}`,
      );
      return report.errors.length ? 1 : 0;
    }
    // install
    const res = install({ kitRoot, target, presets: opts.presets, packs: opts.packs, apply: opts.apply });
    const width = Math.max(...res.actions.map((a) => a.op.length), 6);
    for (const a of res.actions) out(`${a.op.padEnd(width)}  ${a.path}${a.detail ? `  (${a.detail})` : ''}`);
    /** @type {Record<string, number>} */
    const counts = {};
    for (const a of res.actions) {
      const key = a.op.startsWith('conflict') ? 'conflict' : a.op.startsWith('skip (needs') ? 'skip (needs pack)' : a.op;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    out('');
    out(`Summary: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
    for (const n of res.notes) out(`note: ${n}`);
    if (res.conflicts) out(`${res.conflicts} conflict(s): review each <path>.new, merge by hand, then delete the .new file.`);
    if (!res.applied) {
      out(`Dry run: nothing was written to ${res.root}. Re-run with --apply to write ${res.writes} file(s).`);
    } else {
      out(`Applied: wrote ${res.writes} file(s) to ${res.root}.`);
      const binAbs = path.join(kitRoot, 'bin', 'agent-kit.js');
      const binRel = path.relative(cwd, binAbs);
      const bin = binRel.startsWith('..') || path.isAbsolute(binRel) ? binAbs : binRel;
      const q = (/** @type {string} */ s) => (/\s/.test(s) ? `"${s}"` : s);
      // Installed from npm (npx or a dependency): the path into node_modules is no use to the reader.
      const viaNpm = kitRoot.split(path.sep).includes('node_modules');
      out(`Next: ${viaNpm ? 'npx agents-md-kit' : `node ${q(bin)}`} validate --target ${q(opts.target)}`);
    }
    for (const doc of res.nextSteps) out(`Next steps for this preset: ${path.join(res.root, ...doc.split('/'))}`);
    if (res.commands.length) {
      out('');
      out(
        `Run these yourself in ${res.root}${res.applied ? '' : ' (after --apply)'}; ` +
          'agents-md-kit never edits package.json, pyproject.toml, README.md or lockfiles:',
      );
      for (const c of res.commands) out(`  ${c}`);
    } else {
      out('The installer never touches package.json, pyproject.toml, README.md or lockfiles.');
    }
    return res.conflicts ? 2 : 0;
  } catch (e) {
    err(`error: ${/** @type {Error} */ (e).message}`);
    return 1;
  }
}

