import type { Command } from 'commander';
import { loadConfig } from '../lib/config.js';
import { fetchModels, filterModels, formatModelsTable, supportsTools } from '../lib/models.js';
import { out, err } from '../lib/output.js';

export function registerModels(program: Command): void {
  program
    .command('models')
    .description('List models available through an OpenRouter profile')
    .option('--profile <name>', 'OpenRouter profile to use (defaults to active)')
    .option('--search <text>', 'Filter by model id/name substring')
    .option('--tools-only', 'Only models that support tool use (required by Claude Code)')
    .option('--free', 'Only free models')
    .option('--limit <n>', 'Maximum rows to print', '30')
    .addHelpText('after', `
Examples:
  cppc models --profile openrouter          # Browse the catalog
  cppc models --search deepseek             # Find a model
  cppc models --tools-only --free           # Free models that work with Claude Code
  cppc models --json                        # JSON output for agents

Then launch with it:
  cppc claude -p openrouter --model deepseek/deepseek-chat
    `)
    .action(async (opts) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      const profileName = opts.profile || config.active;
      const profile = config.profiles.get(profileName);
      if (!profile) {
        err(`Profile '${profileName}' not found. Available: ${[...config.profiles.keys()].join(', ')}`);
        return;
      }

      if (!profile.baseUrl.includes('openrouter.ai')) {
        err(`Model listing is only supported for OpenRouter today (profile '${profileName}' points at ${profile.baseUrl || 'the native Anthropic API'}).`);
        return;
      }

      try {
        const all = await fetchModels(profile.baseUrl, profile.authToken);
        const filtered = filterModels(all, { search: opts.search, toolsOnly: opts.toolsOnly, free: opts.free })
          .sort((a, b) => Number(supportsTools(b)) - Number(supportsTools(a)) || a.id.localeCompare(b.id));
        const shown = filtered.slice(0, parseInt(opts.limit, 10));

        const footer = filtered.length > shown.length
          ? `… ${filtered.length - shown.length} more — narrow with --search or raise --limit. T ✓ = supports tool use (required by Claude Code).`
          : 'T ✓ = supports tool use (required by Claude Code).';
        out(`${formatModelsTable(shown)}\n${footer}`, shown);
      } catch (e) {
        err(`Failed to fetch models: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
}
