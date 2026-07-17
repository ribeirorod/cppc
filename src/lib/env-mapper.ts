import type { Profile } from '../types.js';
import { ENV_KEY_MAP } from '../types.js';

function profileToEnvPairs(profile: Profile): [string, string][] {
  return Object.entries(ENV_KEY_MAP)
    .map(([field, envName]) => [envName, profile[field as keyof Profile]] as [string, string | undefined])
    .filter((pair): pair is [string, string] => !!pair[1]);
}

export function profileToExports(profile: Profile): string {
  return profileToEnvPairs(profile)
    .map(([key, value]) => `export ${key}="${value}"`)
    .join('\n');
}

export function profileToJson(profile: Profile): Record<string, string> {
  return Object.fromEntries(profileToEnvPairs(profile));
}
