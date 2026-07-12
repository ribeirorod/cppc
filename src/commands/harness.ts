import type { Command } from 'commander';
import { loadConfig } from '../lib/config.js';
import { getHarness } from '../lib/harnesses.js';
import { launchHarness } from '../lib/launch.js';
import { out, err } from '../lib/output.js';

/** Register a launch command per non-claude harness (cppc codex | pi | opencode) */
export function registerHarnesses(program: Command): void {
  for (const id of ['codex', 'pi', 'opencode']) {
    const harness = getHarness(id)!;
    program
      .command(id)
      .description(`Launch ${harness.name} with a cppc profile applied`)
      .option('-p, --profile <name>', 'Profile to use (defaults to active)')
      .option('-m, --mode <mode>', 'Permission mode: autonomous | default | plan')
      .option('--model <model>', 'Override the model for this session')
      .allowUnknownOption(true)
      .addHelpText('after', `
Examples:
  cppc ${id}                                # Launch with active profile
  cppc ${id} -p openrouter --model <model>  # Specific profile + model
  cppc ${id} -m autonomous                  # Skip approvals
  cppc ${id} -- --help                      # Pass extra flags to ${harness.bin}
      `)
      .action((opts, cmd) => {
        const config = loadConfig();
        if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

        const profileName = opts.profile || config.active;
        const profile = config.profiles.get(profileName);
        if (!profile) {
          err(`Profile '${profileName}' not found. Available: ${[...config.profiles.keys()].join(', ')}`);
          return;
        }

        try {
          const args = [
            ...harness.profileArgs(profile, opts.model),
            ...harness.modeArgs(opts.mode),
            ...(cmd.args || []), // Pass through any remaining args after --
          ];

          out(`Launching ${harness.bin} with profile '${profileName}'${opts.mode === 'autonomous' ? ' (autonomous)' : ''}...`, {
            harness: id,
            profile: profileName,
            mode: opts.mode || 'default',
            env_overrides: Object.keys(harness.buildEnv(profile, opts.model)),
          });

          const child = launchHarness(harness, profile, args, opts.model);
          child.on('error', (e) => {
            err(`Failed to launch ${harness.bin}: ${e.message}. Is ${harness.name} installed?`);
          });
        } catch (e) {
          err(e instanceof Error ? e.message : String(e));
        }
      });
  }
}
