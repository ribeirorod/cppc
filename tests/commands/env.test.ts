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
