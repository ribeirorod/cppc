import type { Command } from 'commander';
import { unlinkSync } from 'node:fs';
import { findConfigPath } from '../lib/config.js';
import { out, err } from '../lib/output.js';

export function registerReset(program: Command): void {
  program
    .command('reset')
    .description('Remove the active .cppc.env (local first, then global) and restore provider defaults')
    .addHelpText('after', `
Examples:
  cppc reset          # Remove the resolved .cppc.env (./.cppc.env or ~/.cppc/.cppc.env)
    `)
    .action(() => {
      const path = findConfigPath();
      if (!path) {
        err('No .cppc.env found (local or global). Nothing to reset.');
        return;
      }

      unlinkSync(path);
      out(`Removed ${path}. Provider defaults restored.`, { removed: path });
    });
}
