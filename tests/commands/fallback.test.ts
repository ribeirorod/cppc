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

    const next = config.fallback.find(f => f !== config.active);
    assert.equal(next, 'minimax');

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
