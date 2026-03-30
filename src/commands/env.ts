import type { Command } from 'commander';
import { loadConfig } from '../lib/config.js';
import { profileToExports, profileToJson } from '../lib/env-mapper.js';
import { out, err, isJsonMode } from '../lib/output.js';

export function registerEnv(program: Command): void {
  program
    .command('env')
    .description('Print export statements for the active profile')
    .option('--profile <name>', 'Use a specific profile instead of active')
    .addHelpText('after', `
Examples:
  eval $(cppc env)                    # Load active profile into shell
  eval $(cppc env --profile minimax)  # Load specific profile
  cppc env --json                     # JSON output for agents
    `)
    .action((opts) => {
      const config = loadConfig();
      if (!config) {
        err('No .cppc.env found. Run: cppc init');
        return;
      }

      const profileName = opts.profile || config.active;
      const profile = config.profiles.get(profileName);
      if (!profile) {
        err(`Profile '${profileName}' not found. Available: ${[...config.profiles.keys()].join(', ')}`);
        return;
      }

      if (isJsonMode()) {
        out('', profileToJson(profile));
      } else {
        console.log(profileToExports(profile));
      }
    });
}
