import type { Command } from 'commander';
import { loadConfig } from '../lib/config.js';
import { checkHealth } from '../lib/health.js';
import { out, err, isJsonMode } from '../lib/output.js';

export function registerCheck(program: Command): void {
  program
    .command('check [profile]')
    .description('Health-check a provider endpoint')
    .option('--all', 'Check all configured profiles')
    .option('--timeout <ms>', 'Timeout in milliseconds', '5000')
    .addHelpText('after', `
Examples:
  cppc check minimax            # Check one profile
  cppc check --all              # Check all profiles
  cppc check --all --json       # JSON output for agents
  cppc check --all --timeout 3000
    `)
    .action(async (profileName: string | undefined, opts) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      const timeout = parseInt(opts.timeout, 10);
      const profiles = opts.all
        ? [...config.profiles.values()]
        : profileName
          ? [config.profiles.get(profileName)].filter(Boolean)
          : [config.profiles.get(config.active)].filter(Boolean);

      if (profiles.length === 0) {
        err(profileName
          ? `Profile '${profileName}' not found. Available: ${[...config.profiles.keys()].join(', ')}`
          : 'No profiles configured.');
        return;
      }

      const results = await Promise.all(
        profiles.map(p => checkHealth(p!, timeout))
      );

      if (isJsonMode()) {
        out('', results);
      } else {
        for (const r of results) {
          const icon = r.status === 'ok' ? '✓' : '✗';
          const latency = r.latencyMs !== undefined ? ` (${r.latencyMs}ms)` : '';
          const error = r.error ? ` — ${r.error}` : '';
          console.log(`${icon} ${r.name}: ${r.status.toUpperCase()}${latency}${error}`);
        }
      }
    });
}
