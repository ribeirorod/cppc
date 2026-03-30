import type { Command } from 'commander';
import { unlinkSync, existsSync } from 'node:fs';
import { resolveConfigPath } from '../lib/config.js';
import { out, err } from '../lib/output.js';

export function registerReset(program: Command): void {
  program
    .command('reset')
    .description('Remove .cppc.env and restore provider defaults')
    .addHelpText('after', `
Examples:
  cppc reset          # Remove .cppc.env from current directory
    `)
    .action(() => {
      const path = resolveConfigPath();
      if (!existsSync(path)) {
        err('No .cppc.env found. Nothing to reset.');
        return;
      }

      unlinkSync(path);
      out('Removed .cppc.env. Provider defaults restored.', { removed: path });
    });
}
