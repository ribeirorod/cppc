import type { Profile } from '../types.js';
import { ENV_KEY_MAP } from '../types.js';

function profileToEnvPairs(profile: Profile): [string, string][] {
  const pairs: [string, string][] = [];
  const data: Record<string, string | undefined> = {
    BASE_URL: profile.baseUrl,
    AUTH_TOKEN: profile.authToken,
    MODEL: profile.model,
    SMALL_FAST_MODEL: profile.smallFastModel,
    SUBAGENT_MODEL: profile.subagentModel,
    TIMEOUT_MS: profile.timeoutMs,
    DISABLE_TRAFFIC: profile.disableTraffic,
  };

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== '') {
      const envName = ENV_KEY_MAP[key];
      if (envName) pairs.push([envName, value]);
    }
  }

  return pairs;
}

export function profileToExports(profile: Profile): string {
  return profileToEnvPairs(profile)
    .map(([key, value]) => `export ${key}="${value}"`)
    .join('\n');
}

export function profileToJson(profile: Profile): Record<string, string> {
  return Object.fromEntries(profileToEnvPairs(profile));
}
