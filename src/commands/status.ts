import type { Command } from 'commander';
import { loadConfig } from '../lib/config.js';
import { out, err, mask } from '../lib/output.js';

export function registerStatus(program: Command): void {
  program
    .command('status')
    .description('Show active profile, fallback chain, and configured profiles')
    .addHelpText('after', `
Examples:
  cppc status          # Human-readable status
  cppc status --json   # JSON output for agents
    `)
    .action(() => {
      const config = loadConfig();
      if (!config) {
        err('No .cppc.env found. Run: cppc init');
        return;
      }

      const profiles = [...config.profiles.values()].map(p => ({
        name: p.name,
        active: p.name === config.active,
        base_url: p.baseUrl,
        model: p.model,
        auth_token: mask(p.authToken),
      }));

      const data = {
        active: config.active,
        fallback: config.fallback,
        profiles,
      };

      out([
        `Active: ${config.active}`,
        `Fallback chain: ${config.fallback.length > 0 ? config.fallback.join(' → ') : '(none)'}`,
        `Profiles: ${[...config.profiles.keys()].join(', ')} (${config.profiles.size} configured)`,
      ].join('\n'), data);
    });
}
