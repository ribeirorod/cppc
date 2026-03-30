# CPPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lean, agent-friendly CLI (`cppc`) that manages Anthropic-compatible provider profiles per project directory via a single `.cppc.env` file.

**Architecture:** Commander-based CLI with no interactive prompts. Config is a flat `.cppc.env` file parsed as key=value pairs with `CPPC__<profile>__<key>` convention. All commands output plain text by default, JSON with `--json`. Provider registry provides built-in templates for known providers.

**Tech Stack:** TypeScript (ES2022, NodeNext), Commander, Node.js 18+. Zero runtime deps beyond commander.

---

## File Structure

```
src/
├── cli.ts              # Commander setup, global --json flag, command registration
├── types.ts            # All TypeScript interfaces (Profile, Config, ProviderTemplate, etc.)
├── lib/
│   ├── config.ts       # Parse/serialize .cppc.env, read/write profiles
│   ├── providers.ts    # Built-in provider registry (minimax, deepseek, kimi, qwen, zhipu, etc.)
│   ├── env-mapper.ts   # Map profile keys → ANTHROPIC_* shell exports
│   └── health.ts       # HTTP health check for provider endpoints
├── commands/
│   ├── init.ts         # cppc init
│   ├── env.ts          # cppc env
│   ├── status.ts       # cppc status
│   ├── profile.ts      # cppc profile list|add|remove|show
│   ├── switch.ts       # cppc switch <profile>
│   ├── fallback.ts     # cppc fallback set|activate|reset
│   ├── check.ts        # cppc check [profile|--all]
│   └── reset.ts        # cppc reset
tests/
├── config.test.ts      # Config parsing/serialization
├── env-mapper.test.ts  # Env mapping
├── providers.test.ts   # Provider registry
├── commands/
│   ├── init.test.ts
│   ├── env.test.ts
│   ├── profile.test.ts
│   ├── switch.test.ts
│   ├── fallback.test.ts
│   ├── check.test.ts
│   └── status.test.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.cppc.env.example`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "cppc",
  "version": "0.1.0",
  "description": "Claude Profiled Provider CLI - agent-friendly provider switching for Claude Code & Agent SDK",
  "main": "dist/cli.js",
  "bin": {
    "cppc": "dist/cli.js"
  },
  "type": "module",
  "files": ["dist", "README.md", "LICENSE"],
  "engines": { "node": ">=18.0.0" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/cli.ts",
    "start": "node dist/cli.js",
    "test": "node --import tsx --test tests/**/*.test.ts",
    "clean": "rm -rf dist",
    "prepublishOnly": "npm run clean && npm run build"
  },
  "keywords": ["cli", "claude-code", "claude", "provider", "agent-sdk", "fallback", "ai"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ribeirorod/cppc.git"
  },
  "dependencies": {
    "commander": "^13.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.20.6",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create .cppc.env.example**

```env
# CPPC Configuration - Claude Profiled Provider CLI
# Copy to .cppc.env and fill in your API keys
# Add .cppc.env to .gitignore (contains auth tokens)

# Active profile name
CPPC_ACTIVE=anthropic

# Fallback chain (comma-separated profile names)
CPPC_FALLBACK=minimax,deepseek

# Profile: anthropic
CPPC__anthropic__BASE_URL=https://api.anthropic.com
CPPC__anthropic__AUTH_TOKEN=sk-ant-your-key-here
CPPC__anthropic__MODEL=claude-sonnet-4-20250514

# Profile: minimax
CPPC__minimax__BASE_URL=https://api.minimax.io/anthropic
CPPC__minimax__AUTH_TOKEN=your-minimax-key
CPPC__minimax__MODEL=MiniMax-M2.7
CPPC__minimax__TIMEOUT_MS=3000000
CPPC__minimax__DISABLE_TRAFFIC=1
```

- [ ] **Step 4: Install dependencies**

Run: `cd /Users/beam/projects/cppc && npm install`
Expected: `node_modules/` created, `package-lock.json` generated

- [ ] **Step 5: Verify TypeScript compiles (empty project)**

Create `src/cli.ts` with just:
```typescript
#!/usr/bin/env node
console.log('cppc');
```

Run: `cd /Users/beam/projects/cppc && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
cd /Users/beam/projects/cppc
git add package.json package-lock.json tsconfig.json .cppc.env.example src/cli.ts
git commit -m "chore: scaffold project with package.json, tsconfig, example env"
```

---

### Task 2: Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write types**

```typescript
/** A single provider profile stored in .cppc.env */
export interface Profile {
  name: string;
  baseUrl: string;
  authToken: string;
  model: string;
  smallFastModel?: string;
  subagentModel?: string;
  timeoutMs?: string;
  disableTraffic?: string;
}

/** Parsed .cppc.env configuration */
export interface Config {
  active: string;
  fallback: string[];
  profiles: Map<string, Profile>;
}

/** Built-in provider template for quick setup */
export interface ProviderTemplate {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  smallFastModel?: string;
  validateUrl: string;
}

/** Result of a health check */
export interface HealthResult {
  name: string;
  status: 'ok' | 'fail';
  latencyMs?: number;
  error?: string;
}

/** JSON output wrapper for --json flag */
export interface JsonOutput {
  ok: boolean;
  data?: unknown;
  error?: string;
}

/** Map of profile keys to their ANTHROPIC_* env var names */
export const ENV_KEY_MAP: Record<string, string> = {
  BASE_URL: 'ANTHROPIC_BASE_URL',
  AUTH_TOKEN: 'ANTHROPIC_AUTH_TOKEN',
  MODEL: 'ANTHROPIC_MODEL',
  SMALL_FAST_MODEL: 'ANTHROPIC_SMALL_FAST_MODEL',
  SUBAGENT_MODEL: 'CLAUDE_CODE_SUBAGENT_MODEL',
  TIMEOUT_MS: 'API_TIMEOUT_MS',
  DISABLE_TRAFFIC: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/beam/projects/cppc && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/beam/projects/cppc
git add src/types.ts
git commit -m "feat: add core TypeScript types and env key mapping"
```

---

### Task 3: Config Parser (`.cppc.env` read/write)

**Files:**
- Create: `src/lib/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig, serializeConfig } from '../src/lib/config.js';
import type { Config } from '../src/types.js';

describe('parseConfig', () => {
  it('parses a complete .cppc.env string', () => {
    const input = `
CPPC_ACTIVE=anthropic
CPPC_FALLBACK=minimax,deepseek

CPPC__anthropic__BASE_URL=https://api.anthropic.com
CPPC__anthropic__AUTH_TOKEN=sk-ant-xxx
CPPC__anthropic__MODEL=claude-sonnet-4-20250514

CPPC__minimax__BASE_URL=https://api.minimax.io/anthropic
CPPC__minimax__AUTH_TOKEN=mm-xxx
CPPC__minimax__MODEL=MiniMax-M2.7
CPPC__minimax__TIMEOUT_MS=3000000
`;
    const config = parseConfig(input);
    assert.equal(config.active, 'anthropic');
    assert.deepEqual(config.fallback, ['minimax', 'deepseek']);
    assert.equal(config.profiles.size, 2);

    const anthropic = config.profiles.get('anthropic')!;
    assert.equal(anthropic.name, 'anthropic');
    assert.equal(anthropic.baseUrl, 'https://api.anthropic.com');
    assert.equal(anthropic.authToken, 'sk-ant-xxx');
    assert.equal(anthropic.model, 'claude-sonnet-4-20250514');

    const minimax = config.profiles.get('minimax')!;
    assert.equal(minimax.name, 'minimax');
    assert.equal(minimax.timeoutMs, '3000000');
  });

  it('handles empty fallback', () => {
    const input = `CPPC_ACTIVE=anthropic\nCPPC__anthropic__BASE_URL=https://api.anthropic.com\nCPPC__anthropic__AUTH_TOKEN=sk\nCPPC__anthropic__MODEL=m`;
    const config = parseConfig(input);
    assert.deepEqual(config.fallback, []);
  });

  it('ignores comments and blank lines', () => {
    const input = `# comment\n\nCPPC_ACTIVE=a\nCPPC__a__BASE_URL=u\nCPPC__a__AUTH_TOKEN=t\nCPPC__a__MODEL=m`;
    const config = parseConfig(input);
    assert.equal(config.active, 'a');
  });
});

describe('serializeConfig', () => {
  it('round-trips a config', () => {
    const config: Config = {
      active: 'anthropic',
      fallback: ['minimax'],
      profiles: new Map([
        ['anthropic', { name: 'anthropic', baseUrl: 'https://api.anthropic.com', authToken: 'sk', model: 'm' }],
        ['minimax', { name: 'minimax', baseUrl: 'https://api.minimax.io/anthropic', authToken: 'mm', model: 'M2.7', timeoutMs: '3000000' }],
      ]),
    };
    const serialized = serializeConfig(config);
    const reparsed = parseConfig(serialized);
    assert.equal(reparsed.active, 'anthropic');
    assert.deepEqual(reparsed.fallback, ['minimax']);
    assert.equal(reparsed.profiles.size, 2);
    assert.equal(reparsed.profiles.get('minimax')!.timeoutMs, '3000000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/config.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write config.ts implementation**

```typescript
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
      // CPPC__<profile>__<KEY>
      const rest = key.substring(6); // after 'CPPC__'
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

/** Resolve the .cppc.env file path (cwd or --config-dir) */
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/config.test.ts`
Expected: All 3 tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/beam/projects/cppc
git add src/lib/config.ts tests/config.test.ts
git commit -m "feat: config parser for .cppc.env format with round-trip serialization"
```

---

### Task 4: Provider Registry

**Files:**
- Create: `src/lib/providers.ts`
- Create: `tests/providers.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTemplate, getAllTemplates, getTemplateOrThrow } from '../src/lib/providers.js';

describe('provider registry', () => {
  it('returns all templates', () => {
    const all = getAllTemplates();
    assert.ok(all.length >= 6);
    const ids = all.map(t => t.id);
    assert.ok(ids.includes('anthropic'));
    assert.ok(ids.includes('minimax'));
    assert.ok(ids.includes('deepseek'));
    assert.ok(ids.includes('kimi'));
    assert.ok(ids.includes('qwen'));
    assert.ok(ids.includes('zhipu'));
  });

  it('gets a template by id', () => {
    const mm = getTemplate('minimax');
    assert.ok(mm);
    assert.equal(mm.id, 'minimax');
    assert.equal(mm.baseUrl, 'https://api.minimax.io/anthropic');
    assert.equal(mm.defaultModel, 'MiniMax-M2.7');
  });

  it('returns undefined for unknown id', () => {
    assert.equal(getTemplate('nope'), undefined);
  });

  it('throws for unknown id with getTemplateOrThrow', () => {
    assert.throws(() => getTemplateOrThrow('nope'), /Unknown provider: nope/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/providers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write providers.ts**

```typescript
import type { ProviderTemplate } from '../types.js';

const templates: ProviderTemplate[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-20250514',
    validateUrl: 'https://api.anthropic.com/v1/models',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.io/anthropic',
    defaultModel: 'MiniMax-M2.7',
    smallFastModel: 'MiniMax-M2.7',
    validateUrl: 'https://api.minimax.io/anthropic/v1/models',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/anthropic',
    defaultModel: 'deepseek-reasoner',
    smallFastModel: 'deepseek-chat',
    validateUrl: 'https://api.deepseek.com/models',
  },
  {
    id: 'kimi',
    name: 'Kimi / Moonshot',
    baseUrl: 'https://api.moonshot.ai/anthropic',
    defaultModel: 'K2.5',
    validateUrl: 'https://api.moonshot.ai/anthropic/v1/models',
  },
  {
    id: 'qwen',
    name: 'Qwen / DashScope',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/apps/anthropic',
    defaultModel: 'qwen3.5-plus',
    smallFastModel: 'qwen3-coder-next',
    validateUrl: 'https://dashscope-intl.aliyuncs.com/apps/anthropic/v1/models',
  },
  {
    id: 'zhipu',
    name: 'Z.AI / GLM',
    baseUrl: 'https://api.z.ai/api/anthropic',
    defaultModel: 'GLM-5.1',
    validateUrl: 'https://api.z.ai/api/anthropic/v1/models',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4',
    validateUrl: 'https://openrouter.ai/api/v1/models',
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    validateUrl: 'http://localhost:11434/v1/models',
  },
];

export function getAllTemplates(): ProviderTemplate[] {
  return [...templates];
}

export function getTemplate(id: string): ProviderTemplate | undefined {
  return templates.find(t => t.id === id);
}

export function getTemplateOrThrow(id: string): ProviderTemplate {
  const t = getTemplate(id);
  if (!t) throw new Error(`Unknown provider: ${id}. Available: ${templates.map(t => t.id).join(', ')}`);
  return t;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/providers.test.ts`
Expected: All 4 tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/beam/projects/cppc
git add src/lib/providers.ts tests/providers.test.ts
git commit -m "feat: built-in provider registry with 8 Anthropic-compatible templates"
```

---

### Task 5: Env Mapper

**Files:**
- Create: `src/lib/env-mapper.ts`
- Create: `tests/env-mapper.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { profileToExports, profileToJson } from '../src/lib/env-mapper.js';
import type { Profile } from '../src/types.js';

const profile: Profile = {
  name: 'minimax',
  baseUrl: 'https://api.minimax.io/anthropic',
  authToken: 'mm-xxx',
  model: 'MiniMax-M2.7',
  timeoutMs: '3000000',
  disableTraffic: '1',
};

describe('profileToExports', () => {
  it('generates shell export statements', () => {
    const output = profileToExports(profile);
    assert.ok(output.includes('export ANTHROPIC_BASE_URL="https://api.minimax.io/anthropic"'));
    assert.ok(output.includes('export ANTHROPIC_AUTH_TOKEN="mm-xxx"'));
    assert.ok(output.includes('export ANTHROPIC_MODEL="MiniMax-M2.7"'));
    assert.ok(output.includes('export API_TIMEOUT_MS="3000000"'));
    assert.ok(output.includes('export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"'));
  });

  it('omits undefined optional keys', () => {
    const minimal: Profile = { name: 'test', baseUrl: 'u', authToken: 't', model: 'm' };
    const output = profileToExports(minimal);
    assert.ok(!output.includes('API_TIMEOUT_MS'));
    assert.ok(!output.includes('SMALL_FAST_MODEL'));
  });
});

describe('profileToJson', () => {
  it('returns a JSON-serializable env map', () => {
    const map = profileToJson(profile);
    assert.equal(map['ANTHROPIC_BASE_URL'], 'https://api.minimax.io/anthropic');
    assert.equal(map['ANTHROPIC_MODEL'], 'MiniMax-M2.7');
    assert.equal(map['API_TIMEOUT_MS'], '3000000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/env-mapper.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write env-mapper.ts**

```typescript
import type { Profile } from '../types.js';
import { ENV_KEY_MAP } from '../types.js';

/** Map a Profile to its key-value env var pairs */
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

/** Generate shell export statements for a profile */
export function profileToExports(profile: Profile): string {
  return profileToEnvPairs(profile)
    .map(([key, value]) => `export ${key}="${value}"`)
    .join('\n');
}

/** Generate a JSON env map for a profile */
export function profileToJson(profile: Profile): Record<string, string> {
  return Object.fromEntries(profileToEnvPairs(profile));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/env-mapper.test.ts`
Expected: All 3 tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/beam/projects/cppc
git add src/lib/env-mapper.ts tests/env-mapper.test.ts
git commit -m "feat: env mapper converts profiles to shell exports and JSON"
```

---

### Task 6: Health Check

**Files:**
- Create: `src/lib/health.ts`
- Create: `tests/health.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkHealth } from '../src/lib/health.js';
import type { Profile } from '../src/types.js';

describe('checkHealth', () => {
  it('returns fail for unreachable host', async () => {
    const profile: Profile = {
      name: 'bad',
      baseUrl: 'http://127.0.0.1:1',
      authToken: 'x',
      model: 'm',
    };
    const result = await checkHealth(profile, 1000);
    assert.equal(result.status, 'fail');
    assert.equal(result.name, 'bad');
    assert.ok(result.error);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/health.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write health.ts**

```typescript
import type { Profile, HealthResult } from '../types.js';

/** Health-check a profile by hitting its base URL + /v1/models */
export async function checkHealth(profile: Profile, timeoutMs = 5000): Promise<HealthResult> {
  const url = profile.baseUrl.replace(/\/$/, '') + '/v1/models';
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.authToken}`,
        'x-api-key': profile.authToken,
      },
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - start;

    if (response.ok || response.status === 401 || response.status === 403) {
      // 401/403 means the endpoint is reachable (auth may differ per provider)
      return { name: profile.name, status: 'ok', latencyMs };
    }

    return { name: profile.name, status: 'fail', latencyMs, error: `HTTP ${response.status}` };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return { name: profile.name, status: 'fail', latencyMs, error: message };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/health.test.ts`
Expected: 1 test passes (fail result for unreachable host)

- [ ] **Step 5: Commit**

```bash
cd /Users/beam/projects/cppc
git add src/lib/health.ts tests/health.test.ts
git commit -m "feat: health check pings provider endpoints with timeout"
```

---

### Task 7: Output Helper

**Files:**
- Create: `src/lib/output.ts`

- [ ] **Step 1: Write output.ts**

A thin helper all commands use so `--json` is consistent everywhere.

```typescript
import type { JsonOutput } from '../types.js';

let jsonMode = false;

export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

/** Print output — JSON if --json flag, plain text otherwise */
export function out(text: string, data?: unknown): void {
  if (jsonMode && data !== undefined) {
    const output: JsonOutput = { ok: true, data };
    console.log(JSON.stringify(output));
  } else if (jsonMode) {
    const output: JsonOutput = { ok: true, data: text };
    console.log(JSON.stringify(output));
  } else {
    console.log(text);
  }
}

/** Print error */
export function err(message: string): void {
  if (jsonMode) {
    const output: JsonOutput = { ok: false, error: message };
    console.log(JSON.stringify(output));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exitCode = 1;
}

/** Mask an auth token for display */
export function mask(token: string): string {
  if (token.length <= 6) return '***';
  return token.substring(0, 4) + '***' + token.substring(token.length - 3);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/beam/projects/cppc && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/beam/projects/cppc
git add src/lib/output.ts
git commit -m "feat: output helper for --json mode and token masking"
```

---

### Task 8: Commands — init, env, status, reset

**Files:**
- Create: `src/commands/init.ts`
- Create: `src/commands/env.ts`
- Create: `src/commands/status.ts`
- Create: `src/commands/reset.ts`
- Create: `tests/commands/env.test.ts`

- [ ] **Step 1: Write tests for env command logic**

```typescript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../../src/lib/config.js';
import { profileToExports } from '../../src/lib/env-mapper.js';

describe('env command logic', () => {
  const dir = join(tmpdir(), 'cppc-test-env-' + Date.now());
  const envFile = join(dir, '.cppc.env');

  beforeEach(() => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(envFile, [
      'CPPC_ACTIVE=minimax',
      'CPPC__minimax__BASE_URL=https://api.minimax.io/anthropic',
      'CPPC__minimax__AUTH_TOKEN=mm-test',
      'CPPC__minimax__MODEL=MiniMax-M2.7',
    ].join('\n'));
  });

  afterEach(() => {
    try { unlinkSync(envFile); } catch {}
  });

  it('loads config and generates exports for active profile', () => {
    const config = loadConfig(dir);
    assert.ok(config);
    const profile = config.profiles.get(config.active);
    assert.ok(profile);
    const exports = profileToExports(profile);
    assert.ok(exports.includes('export ANTHROPIC_BASE_URL="https://api.minimax.io/anthropic"'));
    assert.ok(exports.includes('export ANTHROPIC_AUTH_TOKEN="mm-test"'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/commands/env.test.ts`
Expected: FAIL (directory may not exist yet — test infra issue) or PASS if config module works

- [ ] **Step 3: Write init.ts**

```typescript
import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { loadConfig, saveConfig, resolveConfigPath } from '../lib/config.js';
import { getTemplate } from '../lib/providers.js';
import type { Config, Profile } from '../types.js';
import { out, err } from '../lib/output.js';

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Create .cppc.env with a starter profile')
    .option('--provider <id>', 'Provider template (anthropic, minimax, deepseek, kimi, qwen, zhipu, openrouter, ollama)')
    .option('--auth-token <token>', 'API key / auth token')
    .option('--model <model>', 'Model name (defaults to provider default)')
    .option('--base-url <url>', 'Custom base URL (overrides provider template)')
    .option('--force', 'Overwrite existing .cppc.env')
    .addHelpText('after', `
Examples:
  cppc init --provider anthropic --auth-token sk-ant-xxx
  cppc init --provider minimax --auth-token mm-xxx --model MiniMax-M2.7
  cppc init --provider deepseek --auth-token sk-xxx
  cppc init --base-url https://custom.api/v1 --auth-token xxx --model my-model
    `)
    .action((opts) => {
      const configPath = resolveConfigPath();
      if (existsSync(configPath) && !opts.force) {
        err('.cppc.env already exists. Use --force to overwrite.');
        return;
      }

      const providerId = opts.provider || 'anthropic';
      const template = getTemplate(providerId);

      const baseUrl = opts.baseUrl || template?.baseUrl;
      const model = opts.model || template?.defaultModel;
      const authToken = opts.authToken || '';

      if (!baseUrl) {
        err('--base-url required for unknown provider. Known providers: anthropic, minimax, deepseek, kimi, qwen, zhipu, openrouter, ollama');
        return;
      }

      if (!authToken) {
        err('--auth-token required');
        return;
      }

      const profile: Profile = {
        name: providerId,
        baseUrl,
        authToken,
        model: model || '',
      };

      const config: Config = {
        active: providerId,
        fallback: [],
        profiles: new Map([[providerId, profile]]),
      };

      saveConfig(config);
      out(`Created .cppc.env with profile '${providerId}'. Run: eval $(cppc env)`, { profile: providerId, file: configPath });
    });
}
```

- [ ] **Step 4: Write env.ts**

```typescript
import type { Command } from 'commander';
import { loadConfig } from '../lib/config.js';
import { profileToExports, profileToJson } from '../lib/env-mapper.js';
import { out, err } from '../lib/output.js';
import { isJsonMode } from '../lib/output.js';

export function registerEnv(program: Command): void {
  program
    .command('env')
    .description('Print export statements for the active profile')
    .option('--profile <name>', 'Use a specific profile instead of active')
    .addHelpText('after', `
Examples:
  eval $(cppc env)                    # Load active profile into shell
  eval $(cppc env --profile minimax)  # Load specific profile
  cppc env --json                     # JSON output for agents
    `)
    .action((opts) => {
      const config = loadConfig();
      if (!config) {
        err('No .cppc.env found. Run: cppc init');
        return;
      }

      const profileName = opts.profile || config.active;
      const profile = config.profiles.get(profileName);
      if (!profile) {
        err(`Profile '${profileName}' not found. Available: ${[...config.profiles.keys()].join(', ')}`);
        return;
      }

      if (isJsonMode()) {
        out('', profileToJson(profile));
      } else {
        // Raw exports — no decoration so eval $() works
        console.log(profileToExports(profile));
      }
    });
}
```

- [ ] **Step 5: Write status.ts**

```typescript
import type { Command } from 'commander';
import { loadConfig } from '../lib/config.js';
import { out, err, mask } from '../lib/output.js';

export function registerStatus(program: Command): void {
  program
    .command('status')
    .description('Show active profile, fallback chain, and configured profiles')
    .addHelpText('after', `
Examples:
  cppc status          # Human-readable status
  cppc status --json   # JSON output for agents
    `)
    .action(() => {
      const config = loadConfig();
      if (!config) {
        err('No .cppc.env found. Run: cppc init');
        return;
      }

      const profiles = [...config.profiles.values()].map(p => ({
        name: p.name,
        active: p.name === config.active,
        base_url: p.baseUrl,
        model: p.model,
        auth_token: mask(p.authToken),
      }));

      const data = {
        active: config.active,
        fallback: config.fallback,
        profiles,
      };

      out([
        `Active: ${config.active}`,
        `Fallback chain: ${config.fallback.length > 0 ? config.fallback.join(' → ') : '(none)'}`,
        `Profiles: ${[...config.profiles.keys()].join(', ')} (${config.profiles.size} configured)`,
      ].join('\n'), data);
    });
}
```

- [ ] **Step 6: Write reset.ts**

```typescript
import type { Command } from 'commander';
import { unlinkSync, existsSync } from 'node:fs';
import { resolveConfigPath } from '../lib/config.js';
import { out, err } from '../lib/output.js';

export function registerReset(program: Command): void {
  program
    .command('reset')
    .description('Remove .cppc.env and restore provider defaults')
    .addHelpText('after', `
Examples:
  cppc reset          # Remove .cppc.env from current directory
    `)
    .action(() => {
      const path = resolveConfigPath();
      if (!existsSync(path)) {
        err('No .cppc.env found. Nothing to reset.');
        return;
      }

      unlinkSync(path);
      out('Removed .cppc.env. Provider defaults restored.', { removed: path });
    });
}
```

- [ ] **Step 7: Run all tests**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/**/*.test.ts`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
cd /Users/beam/projects/cppc
git add src/commands/init.ts src/commands/env.ts src/commands/status.ts src/commands/reset.ts tests/commands/env.test.ts
git commit -m "feat: init, env, status, reset commands"
```

---

### Task 9: Commands — profile (list, add, remove, show)

**Files:**
- Create: `src/commands/profile.ts`
- Create: `tests/commands/profile.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseConfig, serializeConfig, loadConfig, saveConfig } from '../../src/lib/config.js';
import type { Config, Profile } from '../../src/types.js';

describe('profile operations', () => {
  it('adds a profile to existing config', () => {
    const config: Config = {
      active: 'anthropic',
      fallback: [],
      profiles: new Map([
        ['anthropic', { name: 'anthropic', baseUrl: 'https://api.anthropic.com', authToken: 'sk', model: 'm' }],
      ]),
    };

    const newProfile: Profile = {
      name: 'minimax',
      baseUrl: 'https://api.minimax.io/anthropic',
      authToken: 'mm-key',
      model: 'MiniMax-M2.7',
    };
    config.profiles.set('minimax', newProfile);

    const serialized = serializeConfig(config);
    const reparsed = parseConfig(serialized);
    assert.equal(reparsed.profiles.size, 2);
    assert.equal(reparsed.profiles.get('minimax')!.model, 'MiniMax-M2.7');
  });

  it('removes a profile from config', () => {
    const config: Config = {
      active: 'anthropic',
      fallback: ['minimax'],
      profiles: new Map([
        ['anthropic', { name: 'anthropic', baseUrl: 'u', authToken: 't', model: 'm' }],
        ['minimax', { name: 'minimax', baseUrl: 'u2', authToken: 't2', model: 'm2' }],
      ]),
    };

    config.profiles.delete('minimax');
    config.fallback = config.fallback.filter(f => f !== 'minimax');

    assert.equal(config.profiles.size, 1);
    assert.deepEqual(config.fallback, []);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/commands/profile.test.ts`
Expected: PASS (these test config logic, which already works) or FAIL if path issue

- [ ] **Step 3: Write profile.ts**

```typescript
import type { Command } from 'commander';
import { loadConfig, saveConfig } from '../lib/config.js';
import { getTemplate } from '../lib/providers.js';
import { getAllTemplates } from '../lib/providers.js';
import type { Profile } from '../types.js';
import { out, err, mask } from '../lib/output.js';

export function registerProfile(program: Command): void {
  const profile = program
    .command('profile')
    .description('Manage provider profiles');

  // list
  profile
    .command('list')
    .description('List all configured profiles')
    .addHelpText('after', `
Examples:
  cppc profile list          # List profiles
  cppc profile list --json   # JSON output
    `)
    .action(() => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      const profiles = [...config.profiles.values()].map(p => ({
        name: p.name,
        active: p.name === config.active,
        base_url: p.baseUrl,
        model: p.model,
      }));

      const text = profiles
        .map(p => `${p.name}${p.active ? ' (active)' : ''}`)
        .join('\n');

      out(text, profiles);
    });

  // show
  profile
    .command('show <name>')
    .description('Show profile details')
    .option('--unmask', 'Show full auth token')
    .addHelpText('after', `
Examples:
  cppc profile show minimax            # Masked token
  cppc profile show minimax --unmask   # Full token
  cppc profile show minimax --json     # JSON output
    `)
    .action((name: string, opts) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      const p = config.profiles.get(name);
      if (!p) { err(`Profile '${name}' not found. Available: ${[...config.profiles.keys()].join(', ')}`); return; }

      const token = opts.unmask ? p.authToken : mask(p.authToken);
      const data = {
        name: p.name,
        base_url: p.baseUrl,
        model: p.model,
        auth_token: token,
        small_fast_model: p.smallFastModel,
        subagent_model: p.subagentModel,
        timeout_ms: p.timeoutMs,
        disable_traffic: p.disableTraffic,
      };

      const lines = [
        `Name: ${p.name}`,
        `Base URL: ${p.baseUrl}`,
        `Model: ${p.model}`,
        `Auth Token: ${token}`,
      ];
      if (p.smallFastModel) lines.push(`Small/Fast Model: ${p.smallFastModel}`);
      if (p.subagentModel) lines.push(`Subagent Model: ${p.subagentModel}`);
      if (p.timeoutMs) lines.push(`Timeout: ${p.timeoutMs}ms`);
      if (p.disableTraffic) lines.push(`Disable Traffic: ${p.disableTraffic}`);

      out(lines.join('\n'), data);
    });

  // add
  profile
    .command('add <name>')
    .description('Add a new provider profile')
    .option('--base-url <url>', 'Provider base URL')
    .option('--auth-token <token>', 'API key / auth token')
    .option('--model <model>', 'Model name')
    .option('--small-fast-model <model>', 'Small/fast model for subagents')
    .option('--subagent-model <model>', 'Subagent model override')
    .option('--timeout <ms>', 'API timeout in milliseconds')
    .option('--disable-traffic', 'Disable non-essential traffic')
    .option('--from-env', 'Read from current ANTHROPIC_* environment variables')
    .addHelpText('after', `
Examples:
  cppc profile add minimax --auth-token mm-xxx
  cppc profile add deepseek --auth-token sk-xxx --model deepseek-chat
  cppc profile add custom --base-url https://my.api/v1 --auth-token xxx --model my-model
  cppc profile add anthropic --from-env

Known providers (auto-fill base URL & model): ${getAllTemplates().map(t => t.id).join(', ')}
    `)
    .action((name: string, opts) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      if (config.profiles.has(name) && !opts.force) {
        err(`Profile '${name}' already exists. Remove it first or use a different name.`);
        return;
      }

      let baseUrl = opts.baseUrl;
      let model = opts.model;
      let authToken = opts.authToken;

      if (opts.fromEnv) {
        baseUrl = baseUrl || process.env.ANTHROPIC_BASE_URL;
        authToken = authToken || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
        model = model || process.env.ANTHROPIC_MODEL;
      }

      // Auto-fill from provider registry
      const template = getTemplate(name);
      if (template) {
        baseUrl = baseUrl || template.baseUrl;
        model = model || template.defaultModel;
      }

      if (!baseUrl) { err('--base-url required (or use a known provider name)'); return; }
      if (!authToken) { err('--auth-token required'); return; }

      const newProfile: Profile = {
        name,
        baseUrl,
        authToken,
        model: model || '',
        smallFastModel: opts.smallFastModel || template?.smallFastModel,
        subagentModel: opts.subagentModel,
        timeoutMs: opts.timeout,
        disableTraffic: opts.disableTraffic ? '1' : undefined,
      };

      config.profiles.set(name, newProfile);
      saveConfig(config);
      out(`Profile '${name}' added.`, { name, base_url: baseUrl, model });
    });

  // remove
  profile
    .command('remove <name>')
    .description('Remove a provider profile')
    .addHelpText('after', `
Examples:
  cppc profile remove minimax
    `)
    .action((name: string) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      if (!config.profiles.has(name)) {
        err(`Profile '${name}' not found. Available: ${[...config.profiles.keys()].join(', ')}`);
        return;
      }

      if (config.active === name) {
        err(`Cannot remove active profile '${name}'. Switch to another profile first.`);
        return;
      }

      config.profiles.delete(name);
      config.fallback = config.fallback.filter(f => f !== name);
      saveConfig(config);
      out(`Profile '${name}' removed.`, { removed: name });
    });
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/**/*.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/beam/projects/cppc
git add src/commands/profile.ts tests/commands/profile.test.ts
git commit -m "feat: profile list/add/remove/show commands"
```

---

### Task 10: Commands — switch, fallback, check

**Files:**
- Create: `src/commands/switch.ts`
- Create: `src/commands/fallback.ts`
- Create: `src/commands/check.ts`
- Create: `tests/commands/fallback.test.ts`

- [ ] **Step 1: Write the failing test for fallback logic**

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Config } from '../../src/types.js';

describe('fallback logic', () => {
  it('activates next fallback in chain', () => {
    const config: Config = {
      active: 'anthropic',
      fallback: ['minimax', 'deepseek', 'qwen'],
      profiles: new Map([
        ['anthropic', { name: 'anthropic', baseUrl: 'u', authToken: 't', model: 'm' }],
        ['minimax', { name: 'minimax', baseUrl: 'u2', authToken: 't2', model: 'm2' }],
        ['deepseek', { name: 'deepseek', baseUrl: 'u3', authToken: 't3', model: 'm3' }],
        ['qwen', { name: 'qwen', baseUrl: 'u4', authToken: 't4', model: 'm4' }],
      ]),
    };

    // Simulate fallback activation: find first fallback that isn't the current active
    const next = config.fallback.find(f => f !== config.active);
    assert.equal(next, 'minimax');

    // After activating minimax, next should be deepseek
    config.active = 'minimax';
    const next2 = config.fallback.find(f => f !== config.active);
    assert.equal(next2, 'deepseek');
  });

  it('returns undefined when fallback chain is exhausted', () => {
    const config: Config = {
      active: 'qwen',
      fallback: ['qwen'],
      profiles: new Map([
        ['qwen', { name: 'qwen', baseUrl: 'u', authToken: 't', model: 'm' }],
      ]),
    };

    const next = config.fallback.find(f => f !== config.active);
    assert.equal(next, undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/commands/fallback.test.ts`
Expected: PASS (pure logic test) or FAIL if import issue

- [ ] **Step 3: Write switch.ts**

```typescript
import type { Command } from 'commander';
import { loadConfig, saveConfig } from '../lib/config.js';
import { out, err } from '../lib/output.js';

export function registerSwitch(program: Command): void {
  program
    .command('switch <profile>')
    .description('Set the active provider profile')
    .addHelpText('after', `
Examples:
  cppc switch minimax          # Switch to minimax
  cppc switch anthropic        # Switch back to Anthropic
  cppc switch minimax --json   # JSON output for agents

After switching, load the new profile: eval $(cppc env)
    `)
    .action((profileName: string) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      if (!config.profiles.has(profileName)) {
        err(`Profile '${profileName}' not found. Available: ${[...config.profiles.keys()].join(', ')}`);
        return;
      }

      config.active = profileName;
      saveConfig(config);
      out(`Switched to '${profileName}'. Run: eval $(cppc env)`, { switched_to: profileName, eval_hint: 'eval $(cppc env)' });
    });
}
```

- [ ] **Step 4: Write fallback.ts**

```typescript
import type { Command } from 'commander';
import { loadConfig, saveConfig } from '../lib/config.js';
import { out, err } from '../lib/output.js';

export function registerFallback(program: Command): void {
  const fallback = program
    .command('fallback')
    .description('Manage fallback provider chain');

  // set
  fallback
    .command('set <profiles>')
    .description('Set fallback chain (comma-separated profile names)')
    .addHelpText('after', `
Examples:
  cppc fallback set minimax,deepseek,qwen
  cppc fallback set minimax
    `)
    .action((profilesStr: string) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      const names = profilesStr.split(',').map(s => s.trim()).filter(Boolean);
      for (const name of names) {
        if (!config.profiles.has(name)) {
          err(`Profile '${name}' not found. Available: ${[...config.profiles.keys()].join(', ')}`);
          return;
        }
      }

      config.fallback = names;
      saveConfig(config);
      out(`Fallback chain: ${names.join(' → ')}`, { fallback: names });
    });

  // activate
  fallback
    .command('activate')
    .description('Switch to the next fallback provider in the chain')
    .addHelpText('after', `
Examples:
  cppc fallback activate          # Switch to next fallback
  cppc fallback activate --json   # JSON output for agents

After activating, load the new profile: eval $(cppc env)
    `)
    .action(() => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      if (config.fallback.length === 0) {
        err('No fallback chain configured. Run: cppc fallback set <profiles>');
        return;
      }

      const next = config.fallback.find(f => f !== config.active);
      if (!next) {
        err(`Fallback chain exhausted. All fallbacks tried. Current: ${config.active}`);
        return;
      }

      const previous = config.active;
      config.active = next;
      saveConfig(config);

      const remaining = config.fallback.filter(f => f !== next && f !== previous);
      out(
        `Switched from '${previous}' to '${next}' (next fallback).\nRemaining: ${remaining.length > 0 ? remaining.join(' → ') : '(none)'}\nRun: eval $(cppc env)`,
        { previous, activated: next, remaining },
      );
    });

  // reset
  fallback
    .command('reset')
    .description('Reset to the first profile in the fallback chain or the original active')
    .addHelpText('after', `
Examples:
  cppc fallback reset          # Reset to primary profile
    `)
    .action(() => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      // Reset to the first profile that's not in the fallback chain,
      // or the first profile overall
      const allNames = [...config.profiles.keys()];
      const primary = allNames.find(n => !config.fallback.includes(n)) || allNames[0];

      if (!primary) {
        err('No profiles configured.');
        return;
      }

      config.active = primary;
      saveConfig(config);
      out(`Reset to primary profile '${primary}'. Run: eval $(cppc env)`, { active: primary });
    });

  // status (inline under fallback)
  fallback
    .command('status')
    .description('Show current fallback chain status')
    .addHelpText('after', `
Examples:
  cppc fallback status --json
    `)
    .action(() => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      const data = {
        active: config.active,
        chain: config.fallback,
        exhausted: config.fallback.every(f => f === config.active),
      };

      out([
        `Active: ${config.active}`,
        `Chain: ${config.fallback.length > 0 ? config.fallback.join(' → ') : '(none)'}`,
      ].join('\n'), data);
    });
}
```

- [ ] **Step 5: Write check.ts**

```typescript
import type { Command } from 'commander';
import { loadConfig } from '../lib/config.js';
import { checkHealth } from '../lib/health.js';
import { out, err, isJsonMode } from '../lib/output.js';

export function registerCheck(program: Command): void {
  program
    .command('check [profile]')
    .description('Health-check a provider endpoint')
    .option('--all', 'Check all configured profiles')
    .option('--timeout <ms>', 'Timeout in milliseconds', '5000')
    .addHelpText('after', `
Examples:
  cppc check minimax            # Check one profile
  cppc check --all              # Check all profiles
  cppc check --all --json       # JSON output for agents
  cppc check --all --timeout 3000
    `)
    .action(async (profileName: string | undefined, opts) => {
      const config = loadConfig();
      if (!config) { err('No .cppc.env found. Run: cppc init'); return; }

      const timeout = parseInt(opts.timeout, 10);
      const profiles = opts.all
        ? [...config.profiles.values()]
        : profileName
          ? [config.profiles.get(profileName)].filter(Boolean)
          : [config.profiles.get(config.active)].filter(Boolean);

      if (profiles.length === 0) {
        err(profileName
          ? `Profile '${profileName}' not found. Available: ${[...config.profiles.keys()].join(', ')}`
          : 'No profiles configured.');
        return;
      }

      const results = await Promise.all(
        profiles.map(p => checkHealth(p!, timeout))
      );

      if (isJsonMode()) {
        out('', results);
      } else {
        for (const r of results) {
          const icon = r.status === 'ok' ? '✓' : '✗';
          const latency = r.latencyMs !== undefined ? ` (${r.latencyMs}ms)` : '';
          const error = r.error ? ` — ${r.error}` : '';
          console.log(`${icon} ${r.name}: ${r.status.toUpperCase()}${latency}${error}`);
        }
      }
    });
}
```

- [ ] **Step 6: Run all tests**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/**/*.test.ts`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
cd /Users/beam/projects/cppc
git add src/commands/switch.ts src/commands/fallback.ts src/commands/check.ts tests/commands/fallback.test.ts
git commit -m "feat: switch, fallback, and check commands"
```

---

### Task 11: CLI Entry Point

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Write cli.ts — wire everything together**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { setJsonMode } from './lib/output.js';
import { registerInit } from './commands/init.js';
import { registerEnv } from './commands/env.js';
import { registerStatus } from './commands/status.js';
import { registerProfile } from './commands/profile.js';
import { registerSwitch } from './commands/switch.js';
import { registerFallback } from './commands/fallback.js';
import { registerCheck } from './commands/check.js';
import { registerReset } from './commands/reset.js';
import { getAllTemplates } from './lib/providers.js';

const program = new Command();

program
  .name('cppc')
  .description('Claude Profiled Provider CLI — agent-friendly provider switching for Claude Code & Agent SDK')
  .version('0.1.0', '-v, --version')
  .option('--json', 'Output in JSON format for programmatic use')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.optsWithGlobals();
    if (opts.json) setJsonMode(true);
  });

// Register all commands
registerInit(program);
registerEnv(program);
registerStatus(program);
registerProfile(program);
registerSwitch(program);
registerFallback(program);
registerCheck(program);
registerReset(program);

// Provider list (convenience, no config needed)
program
  .command('providers')
  .description('List built-in provider templates')
  .addHelpText('after', `
Examples:
  cppc providers          # List known providers
  cppc providers --json   # JSON output
  `)
  .action(() => {
    const templates = getAllTemplates();
    const { isJsonMode } = require('./lib/output.js');

    if (isJsonMode()) {
      console.log(JSON.stringify({ ok: true, data: templates }));
    } else {
      for (const t of templates) {
        console.log(`${t.id.padEnd(14)} ${t.name.padEnd(20)} ${t.baseUrl}`);
      }
    }
  });

// Help text
program.addHelpText('after', `
Examples:
  cppc init --provider anthropic --auth-token sk-ant-xxx
  cppc profile add minimax --auth-token mm-xxx
  cppc fallback set minimax,deepseek
  cppc switch minimax && eval $(cppc env)
  cppc check --all
  cppc status --json

Agent integration:
  eval $(cppc env)                         # Load active profile
  eval $(cppc env --profile minimax)       # Load specific profile
  cppc fallback activate && eval $(cppc env)  # Activate next fallback
`);

program.parseAsync(process.argv).catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
```

- [ ] **Step 2: Fix the providers command — replace require with import**

The `providers` command uses `require()` which won't work in ESM. Fix it:

```typescript
// Replace the providers command action with:
program
  .command('providers')
  .description('List built-in provider templates')
  .addHelpText('after', `
Examples:
  cppc providers          # List known providers
  cppc providers --json   # JSON output
  `)
  .action(() => {
    const templates = getAllTemplates();
    // JSON mode is already set via preAction hook
    const jsonFlag = program.optsWithGlobals().json;

    if (jsonFlag) {
      console.log(JSON.stringify({ ok: true, data: templates }));
    } else {
      for (const t of templates) {
        console.log(`${t.id.padEnd(14)} ${t.name.padEnd(20)} ${t.baseUrl}`);
      }
    }
  });
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/beam/projects/cppc && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Test the CLI end-to-end**

Run: `cd /tmp && npx tsx /Users/beam/projects/cppc/src/cli.ts --help`
Expected: Shows help with all commands listed

Run: `cd /tmp && npx tsx /Users/beam/projects/cppc/src/cli.ts providers`
Expected: Lists all 8 providers with URLs

- [ ] **Step 5: Commit**

```bash
cd /Users/beam/projects/cppc
git add src/cli.ts
git commit -m "feat: wire CLI entry point with all commands and global --json flag"
```

---

### Task 12: Integration Test — Full Workflow

**Files:**
- Create: `tests/integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseConfig, serializeConfig, loadConfig, saveConfig } from '../src/lib/config.js';
import { profileToExports, profileToJson } from '../src/lib/env-mapper.js';
import { getTemplate } from '../src/lib/providers.js';
import type { Config, Profile } from '../src/types.js';

describe('full workflow integration', () => {
  const dir = join(tmpdir(), 'cppc-integration-' + Date.now());
  const envFile = join(dir, '.cppc.env');

  beforeEach(() => {
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    try { unlinkSync(envFile); } catch {}
  });

  it('init → add profiles → switch → fallback → env', () => {
    // Step 1: Init with anthropic
    const anthropicTemplate = getTemplate('anthropic')!;
    const config: Config = {
      active: 'anthropic',
      fallback: [],
      profiles: new Map([
        ['anthropic', {
          name: 'anthropic',
          baseUrl: anthropicTemplate.baseUrl,
          authToken: 'sk-ant-test',
          model: anthropicTemplate.defaultModel,
        }],
      ]),
    };
    saveConfig(config, dir);

    // Step 2: Add minimax profile
    const loaded = loadConfig(dir)!;
    const mmTemplate = getTemplate('minimax')!;
    loaded.profiles.set('minimax', {
      name: 'minimax',
      baseUrl: mmTemplate.baseUrl,
      authToken: 'mm-test',
      model: mmTemplate.defaultModel,
      timeoutMs: '3000000',
      disableTraffic: '1',
    });
    saveConfig(loaded, dir);

    // Step 3: Set fallback
    const loaded2 = loadConfig(dir)!;
    loaded2.fallback = ['minimax'];
    saveConfig(loaded2, dir);

    // Step 4: Switch to minimax
    const loaded3 = loadConfig(dir)!;
    loaded3.active = 'minimax';
    saveConfig(loaded3, dir);

    // Step 5: Verify env output
    const loaded4 = loadConfig(dir)!;
    assert.equal(loaded4.active, 'minimax');
    const profile = loaded4.profiles.get('minimax')!;
    const exports = profileToExports(profile);
    assert.ok(exports.includes('export ANTHROPIC_BASE_URL="https://api.minimax.io/anthropic"'));
    assert.ok(exports.includes('export ANTHROPIC_AUTH_TOKEN="mm-test"'));
    assert.ok(exports.includes('export ANTHROPIC_MODEL="MiniMax-M2.7"'));
    assert.ok(exports.includes('export API_TIMEOUT_MS="3000000"'));

    // Step 6: Verify JSON output
    const json = profileToJson(profile);
    assert.equal(json['ANTHROPIC_BASE_URL'], 'https://api.minimax.io/anthropic');
    assert.equal(json['ANTHROPIC_MODEL'], 'MiniMax-M2.7');
    assert.equal(json['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'], '1');

    // Step 7: Fallback activate (simulate)
    const loaded5 = loadConfig(dir)!;
    // Active is minimax, fallback is [minimax], so chain is exhausted
    // Add deepseek to test proper fallback
    loaded5.profiles.set('deepseek', {
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/anthropic',
      authToken: 'ds-test',
      model: 'deepseek-reasoner',
    });
    loaded5.fallback = ['minimax', 'deepseek'];
    loaded5.active = 'anthropic';
    saveConfig(loaded5, dir);

    const loaded6 = loadConfig(dir)!;
    const next = loaded6.fallback.find(f => f !== loaded6.active);
    assert.equal(next, 'minimax');
  });

  it('round-trips config through file system', () => {
    const config: Config = {
      active: 'anthropic',
      fallback: ['minimax', 'deepseek'],
      profiles: new Map([
        ['anthropic', { name: 'anthropic', baseUrl: 'https://api.anthropic.com', authToken: 'sk', model: 'claude-sonnet-4-20250514' }],
        ['minimax', { name: 'minimax', baseUrl: 'https://api.minimax.io/anthropic', authToken: 'mm', model: 'MiniMax-M2.7', timeoutMs: '3000000' }],
        ['deepseek', { name: 'deepseek', baseUrl: 'https://api.deepseek.com/anthropic', authToken: 'ds', model: 'deepseek-reasoner' }],
      ]),
    };

    saveConfig(config, dir);
    const loaded = loadConfig(dir)!;
    assert.equal(loaded.active, 'anthropic');
    assert.deepEqual(loaded.fallback, ['minimax', 'deepseek']);
    assert.equal(loaded.profiles.size, 3);

    // Verify file content is human-readable
    const raw = readFileSync(envFile, 'utf-8');
    assert.ok(raw.includes('CPPC_ACTIVE=anthropic'));
    assert.ok(raw.includes('CPPC_FALLBACK=minimax,deepseek'));
    assert.ok(raw.includes('CPPC__minimax__TIMEOUT_MS=3000000'));
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/**/*.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
cd /Users/beam/projects/cppc
git add tests/integration.test.ts
git commit -m "test: full workflow integration test"
```

---

### Task 13: Build, Link & Smoke Test

- [ ] **Step 1: Build the project**

Run: `cd /Users/beam/projects/cppc && npm run build`
Expected: `dist/` created with compiled JS files, no errors

- [ ] **Step 2: Link globally for testing**

Run: `cd /Users/beam/projects/cppc && npm link`
Expected: `cppc` command available globally

- [ ] **Step 3: Smoke test the full CLI**

Run the following sequence:
```bash
cd /tmp/cppc-smoke-test && mkdir -p /tmp/cppc-smoke-test && cd /tmp/cppc-smoke-test

# Init
cppc init --provider minimax --auth-token mm-smoke-test
# Expected: Created .cppc.env with profile 'minimax'

# Status
cppc status
# Expected: Active: minimax, Fallback chain: (none)

# Add a second profile
cppc profile add deepseek --auth-token ds-smoke-test

# Profile list
cppc profile list
# Expected: minimax (active)\ndeepseek

# Set fallback
cppc fallback set deepseek

# Switch
cppc switch deepseek
# Expected: Switched to 'deepseek'

# Env output
cppc env
# Expected: export ANTHROPIC_BASE_URL=... export ANTHROPIC_MODEL=deepseek-reasoner

# JSON mode
cppc status --json
# Expected: {"ok":true,"data":{"active":"deepseek",...}}

# Providers
cppc providers
# Expected: List of 8 providers

# Reset
cppc reset
# Expected: Removed .cppc.env

# Clean up
rm -rf /tmp/cppc-smoke-test
```

- [ ] **Step 4: Run full test suite one final time**

Run: `cd /Users/beam/projects/cppc && node --import tsx --test tests/**/*.test.ts`
Expected: All tests pass

- [ ] **Step 5: Final commit and push**

```bash
cd /Users/beam/projects/cppc
git add -A
git commit -m "feat: CPPC v0.1.0 — complete CLI with profiles, fallback, health checks"
git push origin main
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Project scaffolding | `package.json`, `tsconfig.json`, `.cppc.env.example` |
| 2 | Types | `src/types.ts` |
| 3 | Config parser | `src/lib/config.ts`, `tests/config.test.ts` |
| 4 | Provider registry | `src/lib/providers.ts`, `tests/providers.test.ts` |
| 5 | Env mapper | `src/lib/env-mapper.ts`, `tests/env-mapper.test.ts` |
| 6 | Health check | `src/lib/health.ts`, `tests/health.test.ts` |
| 7 | Output helper | `src/lib/output.ts` |
| 8 | Commands: init, env, status, reset | `src/commands/*.ts`, `tests/commands/env.test.ts` |
| 9 | Commands: profile | `src/commands/profile.ts`, `tests/commands/profile.test.ts` |
| 10 | Commands: switch, fallback, check | `src/commands/*.ts`, `tests/commands/fallback.test.ts` |
| 11 | CLI entry point | `src/cli.ts` |
| 12 | Integration test | `tests/integration.test.ts` |
| 13 | Build, link, smoke test | — |
