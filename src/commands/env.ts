import type { Command } from 'commander';
import { loadConfig } from '../lib/config.js';
import { profileToExports, profileToJson } from '../lib/env-mapper.js';
import { out, err } from '../lib/output.js';

export function registerEnv(program: Command): void {
  program
    .command('env')
    .description('Print export statements for the active profile')
    .option('--profile <name>', 'Use a specific profile instead of active')
    .option('--model <model>', 'Override the model for this export')
    .addHelpText('after', `
Examples:
  eval $(cppc env)                    # Load active profile into shell
  eval $(cppc env --profile minimax)  # Load specific profile
  eval $(cppc env --profile openrouter --model qwen/qwen3-coder)
  cppc env --json                     # JSON output for agents
    `)
    .action((opts) => {
      const config = loadConfig();
      if (!config) {
        err('No .cppc.env found. Run: cppc init');
        return;
      }

      const profileName = opts.profile || config.active;
      const stored = config.profiles.get(profileName);
      if (!stored) {
        err(`Profile '${profileName}' not found. Available: ${[...config.profiles.keys()].join(', ')}`);
        return;
      }

      const profile = opts.model ? { ...stored, model: opts.model } : stored;
      out(profileToExports(profile), profileToJson(profile));
    });
}
