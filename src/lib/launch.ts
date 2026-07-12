import { spawn, type ChildProcess } from 'node:child_process';
import type { Profile } from '../types.js';
import type { Harness } from './harnesses.js';
import { getHarness } from './harnesses.js';

/** Legacy claude-mode mapping, kept for callers that don't go through a harness */
export function modeArgs(mode?: string): string[] {
  return getHarness('claude')!.modeArgs(mode);
}

/** Build the spawn env for a harness+profile: inherited env, minus the harness's
 * conflict guards, plus the profile mapping and any explicit extras. */
export function launchEnv(harness: Harness, profile: Profile, model?: string, extraEnv: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...harness.buildEnv(profile, model), ...extraEnv };
  for (const key of harness.stripEnv(profile)) delete env[key];
  return env;
}

/** Spawn a harness with the profile's env applied, inheriting stdio for full interactivity */
export function launchHarness(harness: Harness, profile: Profile, args: string[], model?: string, extraEnv: Record<string, string> = {}): ChildProcess {
  const child = spawn(harness.bin, args, {
    env: launchEnv(harness, profile, model, extraEnv),
    stdio: 'inherit',
    shell: true,
  });
  child.on('close', (code) => { process.exitCode = code ?? 0; });
  return child;
}

/** Spawn claude with the profile's env applied */
export function launchClaude(profile: Profile, args: string[], model?: string): ChildProcess {
  return launchHarness(getHarness('claude')!, profile, args, model);
}
