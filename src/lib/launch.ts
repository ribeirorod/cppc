import { spawn, type ChildProcess } from 'node:child_process';
import type { Profile } from '../types.js';
import { profileToJson } from './env-mapper.js';

/** Map a cppc permission mode to claude CLI flags */
export function modeArgs(mode?: string): string[] {
  if (mode === 'autonomous') return ['--dangerously-skip-permissions'];
  if (mode === 'plan') return ['--plan'];
  return [];
}

/** Spawn claude with the profile's env applied, inheriting stdio for full interactivity */
export function launchClaude(profile: Profile, args: string[], extraEnv: Record<string, string> = {}): ChildProcess {
  const child = spawn('claude', args, {
    env: { ...process.env, ...profileToJson(profile), ...extraEnv },
    stdio: 'inherit',
    shell: true,
  });
  child.on('close', (code) => { process.exitCode = code ?? 0; });
  return child;
}
