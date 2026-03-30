import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig, serializeConfig } from '../../src/lib/config.js';
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
