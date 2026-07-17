import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { Config, Profile } from '../types.js';

const CPPC_FILE = '.cppc.env';

/** Global config home: ~/.cppc (override with CPPC_HOME) */
export function globalConfigDir(): string {
  return process.env.CPPC_HOME || join(homedir(), '.cppc');
}

/** Discover every .cppc.env visible from here, nearest first.
 * Walks up from the current directory (so a project-local file, or one in any
 * parent — including your home folder — is found), then the global ~/.cppc dir.
 * Deduplicated; only existing files are returned. */
export function discoverConfigs(): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (p: string) => {
    if (seen.has(p)) return;
    seen.add(p);
    if (existsSync(p)) found.push(p);
  };

  // Walk up the directory tree: ./.cppc.env, then each parent's, up to the root.
  // This naturally catches a home-level ~/.cppc.env whenever you're working
  // anywhere beneath your home folder.
  let dir = process.cwd();
  while (true) {
    add(join(dir, CPPC_FILE));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // The dedicated global config dir (~/.cppc/.cppc.env, or $CPPC_HOME).
  add(join(globalConfigDir(), CPPC_FILE));

  return found;
}

/** Resolution order: nearest .cppc.env wins (project-local, then any parent),
 * falling back to the global ~/.cppc/.cppc.env. Returns null when none exist. */
export function findConfigPath(): string | null {
  return discoverConfigs()[0] ?? null;
}

/** Classify where a resolved config lives, for user-facing messaging. */
export function configScope(path: string): 'project' | 'home' | 'global' | 'inherited' {
  if (path === resolveConfigPath()) return 'project';
  if (path === join(globalConfigDir(), CPPC_FILE)) return 'global';
  if (path === join(homedir(), CPPC_FILE)) return 'home';
  return 'inherited';
}

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
      wireApi: data.WIRE_API,
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
    if (profile.wireApi) lines.push(`CPPC__${name}__WIRE_API=${profile.wireApi}`);
  }

  lines.push('');
  return lines.join('\n');
}

/** Resolve the .cppc.env file path */
export function resolveConfigPath(configDir?: string): string {
  return join(configDir || process.cwd(), CPPC_FILE);
}

/** Load config from disk (explicit dir, or local-then-global resolution).
 * Returns null if no config exists. */
export function loadConfig(configDir?: string): Config | null {
  const path = configDir ? resolveConfigPath(configDir) : findConfigPath();
  if (!path || !existsSync(path)) return null;
  const content = readFileSync(path, 'utf-8');
  return parseConfig(content);
}

/** Save config to disk. Without an explicit dir, writes back to the resolved config
 * (local wins over global) or creates the global ~/.cppc/.cppc.env for fresh setups.
 * The file holds API keys, so it's written owner-only (0600). Returns the path. */
export function saveConfig(config: Config, configDir?: string): string {
  const path = configDir
    ? resolveConfigPath(configDir)
    : findConfigPath() ?? join(globalConfigDir(), CPPC_FILE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeConfig(config), { encoding: 'utf-8', mode: 0o600 });
  return path;
}
