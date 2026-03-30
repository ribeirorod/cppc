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
