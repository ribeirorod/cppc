import type { Command } from 'commander';
import { loadConfig, saveConfig } from '../lib/config.js';
import { out, err } from '../lib/output.js';

export function registerSwitch(program: Command): void {
  program
    .command('switch <profile>')
    .description('Set the active provider profile')
    .addHelpText('after', `
Examples:
  cppc switch minimax          # Switch to minimax
  cppc switch anthropic        # Switch back to Anthropic
  cppc switch minimax --json   # JSON output for agents

After switching, load the new profile: eval $(cppc env)
    `)
    .action((profileName: string) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      if (!config.profiles.has(profileName)) {
        err(`Profile '${profileName}' not found. Available: ${[...config.profiles.keys()].join(', ')}`);
        return;
      }

      config.active = profileName;
      saveConfig(config);
      out(`Switched to '${profileName}'. Run: eval $(cppc env)`, { switched_to: profileName, eval_hint: 'eval $(cppc env)' });
    });
}
