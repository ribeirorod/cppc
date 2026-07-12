import type { Profile } from '../types.js';
import { profileToJson } from './env-mapper.js';

/** A launchable coding-agent CLI that cppc can apply a profile to */
export interface Harness {
  id: string;
  name: string;
  /** Binary to spawn */
  bin: string;
  /** Map a profile (+ optional model override) to the env vars the harness reads */
  buildEnv(profile: Profile, model?: string): Record<string, string>;
  /** Inherited env vars to remove so they can't conflict with the profile's routing */
  stripEnv(profile: Profile): string[];
  /** Map a cppc permission mode (default | autonomous | plan) to harness flags */
  modeArgs(mode?: string): string[];
}

const claude: Harness = {
  id: 'claude',
  name: 'Claude Code',
  bin: 'claude',
  buildEnv: (profile, model) => profileToJson(model ? { ...profile, model } : profile),
  // Claude Code prefers ANTHROPIC_API_KEY over ANTHROPIC_AUTH_TOKEN, so a stale key
  // from `claude login` would hijack token-based routing. OAuth profiles (no authToken)
  // inherit the environment untouched so subscriptions work normally.
  stripEnv: (profile) => profile.authToken ? ['ANTHROPIC_API_KEY'] : [],
  modeArgs: (mode) => {
    if (mode === 'autonomous') return ['--dangerously-skip-permissions'];
    if (mode === 'plan') return ['--plan'];
    return [];
  },
};

const harnesses: Harness[] = [claude];

export function getAllHarnesses(): Harness[] {
  return [...harnesses];
}

export function getHarness(id: string): Harness | undefined {
  return harnesses.find(h => h.id === id);
}
