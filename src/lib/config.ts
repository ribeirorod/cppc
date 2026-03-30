import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Config, Profile } from '../types.js';

const CPPC_FILE = '.cppc.env';

/** Parse a .cppc.env string into a Config object */
export function parseConfig(content: string): Config {
  const lines = content.split('\n');
  let active = '';
  let fallback: string[] = [];
  const profileData = new Map<string, Record<string, string>>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.substring(0, eqIndex).trim();
    const value = line.substring(eqIndex + 1).trim();

    if (key === 'CPPC_ACTIVE') {
      active = value;
    } else if (key === 'CPPC_FALLBACK') {
      fallback = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
    } else if (key.startsWith('CPPC__')) {
      const rest = key.substring(6);
      const sepIndex = rest.indexOf('__');
      if (sepIndex === -1) continue;
      const profileName = rest.substring(0, sepIndex);
      const profileKey = rest.substring(sepIndex + 2);
      if (!profileData.has(profileName)) {
        profileData.set(profileName, {});
      }
      profileData.get(profileName)![profileKey] = value;
    }
  }

  const profiles = new Map<string, Profile>();
  for (const [name, data] of profileData) {
    profiles.set(name, {
      name,
      baseUrl: data.BASE_URL || '',
      authToken: data.AUTH_TOKEN || '',
      model: data.MODEL || '',
      smallFastModel: data.SMALL_FAST_MODEL,
      subagentModel: data.SUBAGENT_MODEL,
      timeoutMs: data.TIMEOUT_MS,
      disableTraffic: data.DISABLE_TRAFFIC,
    });
  }

  return { active, fallback, profiles };
}

/** Serialize a Config object to .cppc.env format */
export function serializeConfig(config: Config): string {
  const lines: string[] = [
    '# CPPC Configuration',
    `CPPC_ACTIVE=${config.active}`,
  ];

  if (config.fallback.length > 0) {
    lines.push(`CPPC_FALLBACK=${config.fallback.join(',')}`);
  }

  for (const [name, profile] of config.profiles) {
    lines.push('');
    lines.push(`# Profile: ${name}`);
    lines.push(`CPPC__${name}__BASE_URL=${profile.baseUrl}`);
    lines.push(`CPPC__${name}__AUTH_TOKEN=${profile.authToken}`);
    lines.push(`CPPC__${name}__MODEL=${profile.model}`);
    if (profile.smallFastModel) lines.push(`CPPC__${name}__SMALL_FAST_MODEL=${profile.smallFastModel}`);
    if (profile.subagentModel) lines.push(`CPPC__${name}__SUBAGENT_MODEL=${profile.subagentModel}`);
    if (profile.timeoutMs) lines.push(`CPPC__${name}__TIMEOUT_MS=${profile.timeoutMs}`);
    if (profile.disableTraffic) lines.push(`CPPC__${name}__DISABLE_TRAFFIC=${profile.disableTraffic}`);
  }

  lines.push('');
  return lines.join('\n');
}

/** Resolve the .cppc.env file path */
export function resolveConfigPath(configDir?: string): string {
  return join(configDir || process.cwd(), CPPC_FILE);
}

/** Load config from disk. Returns null if file doesn't exist. */
export function loadConfig(configDir?: string): Config | null {
  const path = resolveConfigPath(configDir);
  if (!existsSync(path)) return null;
  const content = readFileSync(path, 'utf-8');
  return parseConfig(content);
}

/** Save config to disk. */
export function saveConfig(config: Config, configDir?: string): void {
  const path = resolveConfigPath(configDir);
  writeFileSync(path, serializeConfig(config), 'utf-8');
}
