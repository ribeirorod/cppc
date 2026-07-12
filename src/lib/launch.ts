import { spawn, type ChildProcess } from 'node:child_process';
import type { Profile } from '../types.js';
import { profileToJson } from './env-mapper.js';

/** Map a cppc permission mode to claude CLI flags */
export function modeArgs(mode?: string): string[] {
  if (mode === 'autonomous') return ['--dangerously-skip-permissions'];
  if (mode === 'plan') return ['--plan'];
  return [];
}

/** Build the spawn env for a profile. Token-based profiles drop any inherited
 * ANTHROPIC_API_KEY — Claude Code prefers it over ANTHROPIC_AUTH_TOKEN, so a stale
 * key from `claude login` would silently hijack the routing. OAuth profiles (no
 * authToken) inherit the environment untouched so subscriptions work normally. */
export function launchEnv(profile: Profile, extraEnv: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...profileToJson(profile), ...extraEnv };
  if (profile.authToken) delete env.ANTHROPIC_API_KEY;
  return env;
}

/** Spawn claude with the profile's env applied, inheriting stdio for full interactivity */
export function launchClaude(profile: Profile, args: string[], extraEnv: Record<string, string> = {}): ChildProcess {
  const child = spawn('claude', args, {
    env: launchEnv(profile, extraEnv),
    stdio: 'inherit',
    shell: true,
  });
  child.on('close', (code) => { process.exitCode = code ?? 0; });
  return child;
}
