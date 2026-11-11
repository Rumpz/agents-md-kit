#!/usr/bin/env node
// Entry point. Kept trivial: npm may invoke it through a symlink, so it must not
// compare process.argv[1] with its own path.
import { main } from '../src/cli.js';

process.exitCode = main(process.argv.slice(2));
