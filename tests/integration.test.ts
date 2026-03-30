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

    // Step 7: Fallback activate simulation
    const loaded5 = loadConfig(dir)!;
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

    const raw = readFileSync(envFile, 'utf-8');
    assert.ok(raw.includes('CPPC_ACTIVE=anthropic'));
    assert.ok(raw.includes('CPPC_FALLBACK=minimax,deepseek'));
    assert.ok(raw.includes('CPPC__minimax__TIMEOUT_MS=3000000'));
  });
});
