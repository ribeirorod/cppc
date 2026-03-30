import type { Command } from 'commander';
import { loadConfig, saveConfig } from '../lib/config.js';
import { getTemplate, getAllTemplates } from '../lib/providers.js';
import type { Profile } from '../types.js';
import { out, err, mask } from '../lib/output.js';

export function registerProfile(program: Command): void {
  const profile = program
    .command('profile')
    .description('Manage provider profiles');

  profile
    .command('list')
    .description('List all configured profiles')
    .addHelpText('after', `
Examples:
  cppc profile list          # List profiles
  cppc profile list --json   # JSON output
    `)
    .action(() => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      const profiles = [...config.profiles.values()].map(p => ({
        name: p.name,
        active: p.name === config.active,
        base_url: p.baseUrl,
        model: p.model,
      }));

      const text = profiles
        .map(p => `${p.name}${p.active ? ' (active)' : ''}`)
        .join('\n');

      out(text, profiles);
    });

  profile
    .command('show <name>')
    .description('Show profile details')
    .option('--unmask', 'Show full auth token')
    .addHelpText('after', `
Examples:
  cppc profile show minimax            # Masked token
  cppc profile show minimax --unmask   # Full token
  cppc profile show minimax --json     # JSON output
    `)
    .action((name: string, opts) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      const p = config.profiles.get(name);
      if (!p) { err(`Profile '${name}' not found. Available: ${[...config.profiles.keys()].join(', ')}`); return; }

      const token = opts.unmask ? p.authToken : mask(p.authToken);
      const data = {
        name: p.name,
        base_url: p.baseUrl,
        model: p.model,
        auth_token: token,
        small_fast_model: p.smallFastModel,
        subagent_model: p.subagentModel,
        timeout_ms: p.timeoutMs,
        disable_traffic: p.disableTraffic,
      };

      const lines = [
        `Name: ${p.name}`,
        `Base URL: ${p.baseUrl}`,
        `Model: ${p.model}`,
        `Auth Token: ${token}`,
      ];
      if (p.smallFastModel) lines.push(`Small/Fast Model: ${p.smallFastModel}`);
      if (p.subagentModel) lines.push(`Subagent Model: ${p.subagentModel}`);
      if (p.timeoutMs) lines.push(`Timeout: ${p.timeoutMs}ms`);
      if (p.disableTraffic) lines.push(`Disable Traffic: ${p.disableTraffic}`);

      out(lines.join('\n'), data);
    });

  profile
    .command('add <name>')
    .description('Add a new provider profile')
    .option('--base-url <url>', 'Provider base URL')
    .option('--auth-token <token>', 'API key / auth token')
    .option('--model <model>', 'Model name')
    .option('--small-fast-model <model>', 'Small/fast model for subagents')
    .option('--subagent-model <model>', 'Subagent model override')
    .option('--timeout <ms>', 'API timeout in milliseconds')
    .option('--disable-traffic', 'Disable non-essential traffic')
    .option('--from-env', 'Read from current ANTHROPIC_* environment variables')
    .addHelpText('after', `
Examples:
  cppc profile add minimax --auth-token mm-xxx
  cppc profile add deepseek --auth-token sk-xxx --model deepseek-chat
  cppc profile add custom --base-url https://my.api/v1 --auth-token xxx --model my-model
  cppc profile add anthropic --from-env

Known providers (auto-fill base URL & model): ${getAllTemplates().map(t => t.id).join(', ')}
    `)
    .action((name: string, opts) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      if (config.profiles.has(name)) {
        err(`Profile '${name}' already exists. Remove it first or use a different name.`);
        return;
      }

      let baseUrl = opts.baseUrl;
      let model = opts.model;
      let authToken = opts.authToken;

      if (opts.fromEnv) {
        baseUrl = baseUrl || process.env.ANTHROPIC_BASE_URL;
        authToken = authToken || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
        model = model || process.env.ANTHROPIC_MODEL;
      }

      const template = getTemplate(name);
      if (template) {
        baseUrl = baseUrl || template.baseUrl;
        model = model || template.defaultModel;
      }

      if (!baseUrl) { err('--base-url required (or use a known provider name)'); return; }
      if (!authToken) { err('--auth-token required'); return; }

      const newProfile: Profile = {
        name,
        baseUrl,
        authToken,
        model: model || '',
        smallFastModel: opts.smallFastModel || template?.smallFastModel,
        subagentModel: opts.subagentModel,
        timeoutMs: opts.timeout,
        disableTraffic: opts.disableTraffic ? '1' : undefined,
      };

      config.profiles.set(name, newProfile);
      saveConfig(config);
      out(`Profile '${name}' added.`, { name, base_url: baseUrl, model });
    });

  profile
    .command('remove <name>')
    .description('Remove a provider profile')
    .addHelpText('after', `
Examples:
  cppc profile remove minimax
    `)
    .action((name: string) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      if (!config.profiles.has(name)) {
        err(`Profile '${name}' not found. Available: ${[...config.profiles.keys()].join(', ')}`);
        return;
      }

      if (config.active === name) {
        err(`Cannot remove active profile '${name}'. Switch to another profile first.`);
        return;
      }

      config.profiles.delete(name);
      config.fallback = config.fallback.filter(f => f !== name);
      saveConfig(config);
      out(`Profile '${name}' removed.`, { removed: name });
    });
}
