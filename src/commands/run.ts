import type { Command } from 'commander';
import { spawn } from 'node:child_process';
import { loadConfig } from '../lib/config.js';
import { getHarness, normalizeMode, type Harness } from '../lib/harnesses.js';
import { launchEnv } from '../lib/launch.js';
import { out, err } from '../lib/output.js';
import type { Profile } from '../types.js';

export interface RunTarget {
  spec: string;
  harness: Harness;
  /** null = native (harness's own auth, no profile injection) */
  profile: Profile | null;
  model?: string;
}

/** Parse a target spec: harness[:profile[:model]]. Profile 'active' (or omitted) uses the
 * active profile; 'native' skips profile injection unless a real profile shadows the name. */
export function parseTarget(spec: string, profiles: Map<string, Profile>, activeName: string): RunTarget {
  const [harnessId, profileName, ...modelParts] = spec.split(':');
  const harness = getHarness(harnessId);
  if (!harness) throw new Error(`Unknown harness '${harnessId}' in '${spec}'. Available: claude, codex, pi, opencode`);

  const model = modelParts.length ? modelParts.join(':') : undefined; // model ids may contain ':' (e.g. :free)

  if (profileName === 'native' && !profiles.has('native')) {
    return { spec, harness, profile: null, model };
  }
  const name = !profileName || profileName === 'active' ? activeName : profileName;
  const profile = profiles.get(name);
  if (!profile) {
    throw new Error(`Profile '${name}' not found in '${spec}'. Available: ${[...profiles.keys()].join(', ')} (or 'native')`);
  }
  return { spec, harness, profile, model };
}

/** Compose the non-interactive argv for a target: subcommand, wiring, policy, prompt */
export function buildRunArgs(target: RunTarget, policy: string | undefined, prompt: string): string[] {
  const wiring = target.profile
    ? target.harness.profileArgs(target.profile, target.model)
    : target.model ? target.harness.nativeModelArgs(target.model) : [];
  return [
    ...target.harness.execPrefix,
    ...wiring,
    ...target.harness.modeArgs(normalizeMode(policy)),
    ...target.harness.promptArgs(prompt),
  ];
}

function runEnv(target: RunTarget): NodeJS.ProcessEnv {
  return target.profile ? launchEnv(target.harness, target.profile, target.model) : process.env;
}

function capture(target: RunTarget, args: string[]): Promise<{ target: string; exit: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(target.harness.bin, args, { env: runEnv(target), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => stdout += d);
    child.stderr.on('data', (d) => stderr += d);
    child.on('error', (e) => resolve({ target: target.spec, exit: 127, stdout, stderr: `${e.message}. Is ${target.harness.name} installed?` }));
    child.on('close', (code) => resolve({ target: target.spec, exit: code ?? 0, stdout, stderr }));
  });
}

export function registerRun(program: Command): void {
  program
    .command('run <prompt...>')
    .description('Run a prompt non-interactively through one or more harnesses')
    .option('--on <spec>', 'Target: harness[:profile[:model]] — repeatable for fan-out', (v: string, acc: string[]) => [...acc, v], [] as string[])
    .option('-H, --harness <id>', 'Harness when --on is not used (default: claude)')
    .option('-p, --profile <name>', "Profile when --on is not used (or 'native')")
    .option('--model <model>', 'Model override when --on is not used')
    .option('--policy <policy>', 'Permission policy: yolo | edit | safe (default: edit)')
    .addHelpText('after', `
Examples:
  cppc run "explain this repo"                          # claude + active profile
  cppc run -H opencode -p minimax --policy safe "plan the refactor"
  cppc run -p native --policy yolo "fix the tests"      # harness's own auth
  cppc run --on claude:openrouter:anthropic/claude-sonnet-5 \\
           --on codex:openrouter:openai/gpt-5.2 "same task, two harnesses"
  cppc run --on claude --on opencode:minimax --json "compare answers"

Targets: harness[:profile[:model]] — profile 'active' or omitted uses the active
profile, 'native' uses the harness's own auth. One target streams; several run
in parallel with captured, labeled output.
    `)
    .action(async (promptParts: string[], opts) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }
      const prompt = promptParts.join(' ');

      let targets: RunTarget[];
      try {
        const singleSpec = `${opts.harness || 'claude'}:${opts.profile || 'active'}${opts.model ? `:${opts.model}` : ''}`;
        targets = opts.on.length > 0
          ? opts.on.map((spec: string) => parseTarget(spec, config.profiles, config.active))
          : [parseTarget(singleSpec, config.profiles, config.active)];
      } catch (e) {
        err(e instanceof Error ? e.message : String(e));
        return;
      }

      if (targets.length === 1) {
        const t = targets[0];
        try {
          const args = buildRunArgs(t, opts.policy, prompt);
          const child = spawn(t.harness.bin, args, { env: runEnv(t), stdio: 'inherit' });
          child.on('error', (e) => err(`Failed to launch ${t.harness.bin}: ${e.message}. Is ${t.harness.name} installed?`));
          child.on('close', (code) => { process.exitCode = code ?? 0; });
        } catch (e) {
          err(e instanceof Error ? e.message : String(e));
        }
        return;
      }

      // Fan-out: run all targets in parallel, report labeled results
      const results = await Promise.all(targets.map(async (t) => {
        try {
          return await capture(t, buildRunArgs(t, opts.policy, prompt));
        } catch (e) {
          return { target: t.spec, exit: 1, stdout: '', stderr: e instanceof Error ? e.message : String(e) };
        }
      }));

      const text = results.map(r =>
        `=== ${r.target} (exit ${r.exit}) ===\n${r.stdout.trim()}${r.stderr.trim() ? `\n[stderr] ${r.stderr.trim()}` : ''}`
      ).join('\n\n');
      out(text, results);
      if (results.some(r => r.exit !== 0)) process.exitCode = 1;
    });
}
