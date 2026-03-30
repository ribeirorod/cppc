import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { loadConfig, saveConfig, resolveConfigPath } from '../lib/config.js';
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
    .addHelpText('after', `
Examples:
  cppc init --provider anthropic --auth-token sk-ant-xxx
  cppc init --provider minimax --auth-token mm-xxx --model MiniMax-M2.7
  cppc init --provider deepseek --auth-token sk-xxx
  cppc init --base-url https://custom.api/v1 --auth-token xxx --model my-model
    `)
    .action((opts) => {
      const configPath = resolveConfigPath();
      if (existsSync(configPath) && !opts.force) {
        err('.cppc.env already exists. Use --force to overwrite.');
        return;
      }

      const providerId = opts.provider || 'anthropic';
      const template = getTemplate(providerId);

      const baseUrl = opts.baseUrl || template?.baseUrl;
      const model = opts.model || template?.defaultModel;
      const authToken = opts.authToken || '';

      if (!baseUrl) {
        err('--base-url required for unknown provider. Known providers: anthropic, minimax, deepseek, kimi, qwen, zhipu, openrouter, ollama');
        return;
      }

      if (!authToken) {
        err('--auth-token required');
        return;
      }

      const profile: Profile = {
        name: providerId,
        baseUrl,
        authToken,
        model: model || '',
      };

      const config: Config = {
        active: providerId,
        fallback: [],
        profiles: new Map([[providerId, profile]]),
      };

      saveConfig(config);
      out(`Created .cppc.env with profile '${providerId}'. Run: eval $(cppc env)`, { profile: providerId, file: configPath });
    });
}
