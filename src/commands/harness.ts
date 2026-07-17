import type { Command } from 'commander';
import { loadConfig } from '../lib/config.js';
import { getHarness, normalizeMode } from '../lib/harnesses.js';
import { launchHarness, launchNative } from '../lib/launch.js';
import { out, err } from '../lib/output.js';

/** Register a launch command per non-claude harness (cppc codex | pi | opencode) */
export function registerHarnesses(program: Command): void {
  for (const id of ['codex', 'pi', 'opencode']) {
    const harness = getHarness(id)!;
    program
      .command(id)
      .description(`Launch ${harness.name} with a cppc profile applied`)
      .option('-p, --profile <name>', 'Profile to use (defaults to active)')
      .option('-m, --mode <mode>', 'Permission policy: yolo | edit | safe (aka autonomous | default | plan)')
      .option('--model <model>', 'Override the model for this session')
      .option('--native', `Use ${harness.name}'s own auth/config — no profile injection`)
      .allowUnknownOption(true)
      .addHelpText('after', `
Examples:
  cppc ${id}                                # Launch with active profile
  cppc ${id} -p openrouter --model <model>  # Specific profile + model
  cppc ${id} -m yolo                        # Skip approvals
  cppc ${id} --native                       # ${harness.bin} with its own keys/login
  cppc ${id} -- --help                      # Pass extra flags to ${harness.bin}
      `)
      .action((opts, cmd) => {
        const mode = normalizeMode(opts.mode);

        if (opts.native) {
          try {
            const args = [
              ...(opts.model ? harness.nativeModelArgs(opts.model) : []),
              ...harness.modeArgs(mode),
              ...(cmd.args || []),
            ];
            out(`Launching ${harness.bin} (native auth)...`, { harness: id, native: true, mode: opts.mode || 'edit' });
            const child = launchNative(harness, args);
            child.on('error', (e) => err(`Failed to launch ${harness.bin}: ${e.message}. Is ${harness.name} installed?`));
          } catch (e) {
            err(e instanceof Error ? e.message : String(e));
          }
          return;
        }

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
            ...harness.modeArgs(mode),
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
