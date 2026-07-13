import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { saveConfig, resolveConfigPath, findConfigPath } from '../lib/config.js';
import { getTemplate } from '../lib/providers.js';
import type { Config, Profile } from '../types.js';
import { out, err } from '../lib/output.js';

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Create .cppc.env with a starter profile')
    .option('--provider <id>', 'Provider template (anthropic, minimax, deepseek, kimi, qwen, zhipu, openrouter, ollama)')
    .option('--auth-token <token>', 'API key / auth token')
    .option('--model <model>', 'Model name (defaults to provider default)')
    .option('--base-url <url>', 'Custom base URL (overrides provider template)')
    .option('--force', 'Overwrite existing .cppc.env')
    .option('--project', 'Create .cppc.env in the current directory instead of ~/.cppc')
    .addHelpText('after', `
Examples:
  cppc init                                        # Anthropic OAuth (Claude Max), saved to ~/.cppc
  cppc init --provider anthropic                   # Same — uses claude login
  cppc init --provider anthropic-api --auth-token sk-ant-xxx  # Anthropic API key
  cppc init --provider minimax --auth-token mm-xxx
  cppc init --project --provider deepseek --auth-token sk-xxx  # Project-scoped config
  cppc init --base-url https://custom.api/v1 --auth-token xxx --model my-model

Config lives in ~/.cppc/.cppc.env by default; a project-local .cppc.env (--project)
takes precedence when present.
    `)
    .action((opts) => {
      const targetDir = opts.project ? process.cwd() : undefined;
      const existing = opts.project ? resolveConfigPath() : findConfigPath();
      if (existing && existsSync(existing) && !opts.force) {
        err(`${existing} already exists. Use --force to overwrite.`);
        return;
      }

      const providerId = opts.provider || 'anthropic';
      const template = getTemplate(providerId);
      const isOAuth = template?.oauth ?? false;

      const baseUrl = opts.baseUrl || template?.baseUrl || '';
      const model = opts.model || template?.defaultModel || '';
      const authToken = opts.authToken || '';

      if (!isOAuth && !baseUrl) {
        err('--base-url required for unknown provider. Known providers: anthropic, anthropic-api, minimax, deepseek, kimi, qwen, zhipu, openrouter, ollama');
        return;
      }

      if (!isOAuth && !authToken) {
        err('--auth-token required (use --provider anthropic for OAuth/Claude Max)');
        return;
      }

      const profile: Profile = {
        name: providerId,
        baseUrl,
        authToken,
        model: model || '',
        smallFastModel: template?.smallFastModel,
        wireApi: template?.wireApi,
      };

      const config: Config = {
        active: providerId,
        fallback: [],
        profiles: new Map([[providerId, profile]]),
      };

      const savedPath = saveConfig(config, targetDir);
      out(`Created ${savedPath} with profile '${providerId}'. Run: eval $(cppc env)`, { profile: providerId, file: savedPath });
    });
}
