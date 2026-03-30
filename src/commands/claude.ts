import type { Command } from 'commander';
import { spawn } from 'node:child_process';
import { loadConfig } from '../lib/config.js';
import { profileToJson } from '../lib/env-mapper.js';
import { out, err } from '../lib/output.js';

export function registerClaude(program: Command): void {
  program
    .command('claude')
    .description('Launch a Claude Code terminal with a specific profile')
    .option('-p, --profile <name>', 'Profile to use (defaults to active)')
    .option('-m, --mode <mode>', 'Permission mode: autonomous | default | plan (default: default)')
    .option('--print', 'Use claude --print (non-interactive, pipe-friendly)')
    .option('--resume', 'Resume last conversation')
    .option('--model <model>', 'Override the model for this session')
    .allowUnknownOption(true)
    .addHelpText('after', `
Examples:
  cppc claude                                  # Launch with active profile
  cppc claude -p minimax                       # Launch with minimax profile
  cppc claude -p minimax -m autonomous         # Minimax + skip permissions
  cppc claude -p deepseek -m plan              # DeepSeek in plan mode
  cppc claude -p anthropic --resume            # Resume last conversation on Anthropic
  cppc claude -p minimax --print "explain X"   # Non-interactive with minimax
  cppc claude -p minimax -- --verbose          # Pass extra flags to claude

Modes:
  default      Normal interactive mode
  autonomous   Equivalent to --dangerously-skip-permissions
  plan         Equivalent to --plan
    `)
    .action((opts, cmd) => {
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

      // Build env vars from profile
      const envOverrides = profileToJson(profile);

      // Override model if specified
      if (opts.model) {
        envOverrides['ANTHROPIC_MODEL'] = opts.model;
      }

      // Build claude args
      const claudeArgs: string[] = [];

      // Permission mode
      if (opts.mode === 'autonomous') {
        claudeArgs.push('--dangerously-skip-permissions');
      } else if (opts.mode === 'plan') {
        claudeArgs.push('--plan');
      }

      if (opts.print) {
        claudeArgs.push('--print');
      }

      if (opts.resume) {
        claudeArgs.push('--resume');
      }

      // Pass through any remaining args after --
      const passthrough = cmd.args || [];
      claudeArgs.push(...passthrough);

      // Merge env: current process env + profile overrides
      const childEnv = { ...process.env, ...envOverrides };

      out(`Launching claude with profile '${profileName}'${opts.mode === 'autonomous' ? ' (autonomous)' : ''}...`, {
        profile: profileName,
        mode: opts.mode || 'default',
        env_overrides: Object.keys(envOverrides),
      });

      // Spawn claude with inherited stdio for full interactivity
      const child = spawn('claude', claudeArgs, {
        env: childEnv,
        stdio: 'inherit',
        shell: true,
      });

      child.on('error', (e) => {
        err(`Failed to launch claude: ${e.message}. Is Claude Code installed?`);
      });

      child.on('close', (code) => {
        process.exitCode = code ?? 0;
      });
    });
}
