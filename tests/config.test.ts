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
