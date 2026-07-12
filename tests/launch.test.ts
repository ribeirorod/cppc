import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { launchEnv } from '../src/lib/launch.js';
import type { Profile } from '../src/types.js';

describe('launchEnv', () => {
  const VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL'];
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(VARS.map(v => [v, process.env[v]]));
    for (const v of VARS) delete process.env[v];
    process.env.ANTHROPIC_API_KEY = 'sk-ant-stale';
  });
  afterEach(() => {
    for (const v of VARS) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
  });

  it('strips inherited ANTHROPIC_API_KEY for token-based profiles', () => {
    const profile: Profile = { name: 'openrouter', baseUrl: 'https://openrouter.ai/api', authToken: 'sk-or-x', model: 'anthropic/claude-sonnet-5' };
    const env = launchEnv(profile);
    assert.equal(env.ANTHROPIC_API_KEY, undefined);
    assert.equal(env.ANTHROPIC_AUTH_TOKEN, 'sk-or-x');
    assert.equal(env.ANTHROPIC_BASE_URL, 'https://openrouter.ai/api');
  });

  it('leaves the environment untouched for OAuth profiles (claude login subscriptions)', () => {
    const oauth: Profile = { name: 'anthropic', baseUrl: '', authToken: '', model: '' };
    const env = launchEnv(oauth);
    assert.equal(env.ANTHROPIC_API_KEY, 'sk-ant-stale');
    assert.equal(env.ANTHROPIC_AUTH_TOKEN, undefined);
    assert.equal(env.ANTHROPIC_BASE_URL, undefined);
  });

  it('applies extraEnv overrides on top of the profile', () => {
    const profile: Profile = { name: 'openrouter', baseUrl: 'https://openrouter.ai/api', authToken: 'sk-or-x', model: 'anthropic/claude-sonnet-5' };
    const env = launchEnv(profile, { ANTHROPIC_MODEL: 'deepseek/deepseek-chat' });
    assert.equal(env.ANTHROPIC_MODEL, 'deepseek/deepseek-chat');
  });
});
