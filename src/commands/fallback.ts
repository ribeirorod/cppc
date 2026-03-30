import type { Command } from 'commander';
import { loadConfig, saveConfig } from '../lib/config.js';
import { out, err } from '../lib/output.js';

export function registerFallback(program: Command): void {
  const fallback = program
    .command('fallback')
    .description('Manage fallback provider chain');

  fallback
    .command('set <profiles>')
    .description('Set fallback chain (comma-separated profile names)')
    .addHelpText('after', `
Examples:
  cppc fallback set minimax,deepseek,qwen
  cppc fallback set minimax
    `)
    .action((profilesStr: string) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      const names = profilesStr.split(',').map(s => s.trim()).filter(Boolean);
      for (const name of names) {
        if (!config.profiles.has(name)) {
          err(`Profile '${name}' not found. Available: ${[...config.profiles.keys()].join(', ')}`);
          return;
        }
      }

      config.fallback = names;
      saveConfig(config);
      out(`Fallback chain: ${names.join(' → ')}`, { fallback: names });
    });

  fallback
    .command('activate')
    .description('Switch to the next fallback provider in the chain')
    .addHelpText('after', `
Examples:
  cppc fallback activate          # Switch to next fallback
  cppc fallback activate --json   # JSON output for agents

After activating, load the new profile: eval $(cppc env)
    `)
    .action(() => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      if (config.fallback.length === 0) {
        err('No fallback chain configured. Run: cppc fallback set <profiles>');
        return;
      }

      const next = config.fallback.find(f => f !== config.active);
      if (!next) {
        err(`Fallback chain exhausted. All fallbacks tried. Current: ${config.active}`);
        return;
      }

      const previous = config.active;
      config.active = next;
      saveConfig(config);

      const remaining = config.fallback.filter(f => f !== next && f !== previous);
      out(
        `Switched from '${previous}' to '${next}' (next fallback).\nRemaining: ${remaining.length > 0 ? remaining.join(' → ') : '(none)'}\nRun: eval $(cppc env)`,
        { previous, activated: next, remaining },
      );
    });

  fallback
    .command('reset')
    .description('Reset to the first profile in the fallback chain or the original active')
    .addHelpText('after', `
Examples:
  cppc fallback reset          # Reset to primary profile
    `)
    .action(() => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      const allNames = [...config.profiles.keys()];
      const primary = allNames.find(n => !config.fallback.includes(n)) || allNames[0];

      if (!primary) {
        err('No profiles configured.');
        return;
      }

      config.active = primary;
      saveConfig(config);
      out(`Reset to primary profile '${primary}'. Run: eval $(cppc env)`, { active: primary });
    });

  fallback
    .command('status')
    .description('Show current fallback chain status')
    .addHelpText('after', `
Examples:
  cppc fallback status --json
    `)
    .action(() => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      const data = {
        active: config.active,
        chain: config.fallback,
        exhausted: config.fallback.every(f => f === config.active),
      };

      out([
        `Active: ${config.active}`,
        `Chain: ${config.fallback.length > 0 ? config.fallback.join(' → ') : '(none)'}`,
      ].join('\n'), data);
    });
}
