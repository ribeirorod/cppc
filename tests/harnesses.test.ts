import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getHarness, getAllHarnesses } from '../src/lib/harnesses.js';
import type { Profile } from '../src/types.js';

const openrouter: Profile = { name: 'openrouter', baseUrl: 'https://openrouter.ai/api', authToken: 'sk-or-x', model: 'anthropic/claude-sonnet-5' };
const minimax: Profile = { name: 'minimax', baseUrl: 'https://api.minimax.io/anthropic', authToken: 'mm-x', model: 'MiniMax-M2.7' };
const ollama: Profile = { name: 'ollama', baseUrl: 'http://localhost:11434/v1', authToken: 'x', model: 'llama3', wireApi: 'openai' };
const oauth: Profile = { name: 'anthropic', baseUrl: '', authToken: '', model: '' };

describe('harness registry', () => {
  it('registers claude, codex, pi, opencode', () => {
    assert.deepEqual(getAllHarnesses().map(h => h.id), ['claude', 'codex', 'pi', 'opencode']);
  });
});

describe('codex harness', () => {
  const codex = getHarness('codex')!;

  it('wires an ephemeral provider via -c flags, using the OpenAI surface of OpenRouter', () => {
    const args = codex.profileArgs(openrouter);
    assert.ok(args.includes('model_providers.cppc.base_url=https://openrouter.ai/api/v1'));
    assert.ok(args.includes('model_providers.cppc.wire_api=responses'));
    assert.ok(args.includes('model_providers.cppc.env_key=CPPC_CODEX_API_KEY'));
    assert.deepEqual(args.slice(-2), ['-m', 'anthropic/claude-sonnet-5']);
    assert.deepEqual(codex.buildEnv(openrouter), { CPPC_CODEX_API_KEY: 'sk-or-x' });
  });

  it('refuses Anthropic-only profiles with a clear error', () => {
    assert.throws(() => codex.buildEnv(minimax), /Responses API/);
    assert.throws(() => codex.profileArgs(oauth), /Responses API/);
  });

  it('maps modes to codex flags', () => {
    assert.deepEqual(codex.modeArgs('autonomous'), ['--dangerously-bypass-approvals-and-sandbox']);
    assert.deepEqual(codex.modeArgs('plan'), ['--sandbox', 'read-only']);
    assert.deepEqual(codex.modeArgs(), []);
  });
});

describe('pi harness', () => {
  const pi = getHarness('pi')!;

  it('maps known profiles to pi built-in provider env vars', () => {
    assert.deepEqual(pi.buildEnv(minimax), { MINIMAX_API_KEY: 'mm-x' });
    assert.deepEqual(pi.buildEnv(openrouter), { OPENROUTER_API_KEY: 'sk-or-x' });
    assert.deepEqual(
      pi.buildEnv({ name: 'deepseek', baseUrl: 'https://api.deepseek.com/anthropic', authToken: 'sk-d', model: 'deepseek-reasoner' }),
      { DEEPSEEK_API_KEY: 'sk-d' },
    );
  });

  it('rejects profiles without a built-in pi provider', () => {
    assert.throws(() => pi.buildEnv(ollama), /no built-in pi provider|models\.json/);
    assert.throws(() => pi.buildEnv(oauth), /models\.json/);
  });

  it('has no plan mode and says so', () => {
    assert.throws(() => pi.modeArgs('plan'), /no plan/);
    assert.deepEqual(pi.modeArgs('autonomous'), []);
    assert.deepEqual(pi.modeArgs(), []);
  });

  it('passes the model as a pattern', () => {
    assert.deepEqual(pi.profileArgs(minimax, 'MiniMax-M2.5'), ['--model', 'MiniMax-M2.5']);
  });
});

describe('opencode harness', () => {
  const opencode = getHarness('opencode')!;

  it('synthesizes an Anthropic-compatible provider via OPENCODE_CONFIG_CONTENT', () => {
    const env = opencode.buildEnv(minimax);
    const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT);
    assert.equal(config.provider.cppc.npm, '@ai-sdk/anthropic');
    assert.equal(config.provider.cppc.options.baseURL, 'https://api.minimax.io/anthropic');
    assert.equal(config.provider.cppc.options.apiKey, 'mm-x');
    assert.ok(config.provider.cppc.models['MiniMax-M2.7']);
  });

  it('uses the openai-compatible SDK for openai-wire profiles', () => {
    const config = JSON.parse(opencode.buildEnv(ollama).OPENCODE_CONFIG_CONTENT);
    assert.equal(config.provider.cppc.npm, '@ai-sdk/openai-compatible');
  });

  it('leaves OAuth profiles to opencode-native auth', () => {
    assert.deepEqual(opencode.buildEnv(oauth), {});
    assert.deepEqual(opencode.profileArgs(oauth, 'claude-sonnet-5'), ['--model', 'claude-sonnet-5']);
  });

  it('namespaces the model under the synthesized provider', () => {
    assert.deepEqual(opencode.profileArgs(minimax), ['--model', 'cppc/MiniMax-M2.7']);
    assert.deepEqual(opencode.profileArgs(minimax, 'MiniMax-M2.5'), ['--model', 'cppc/MiniMax-M2.5']);
  });

  it('maps modes to opencode flags, including a native plan mode', () => {
    assert.deepEqual(opencode.modeArgs('autonomous'), ['--auto']);
    assert.deepEqual(opencode.modeArgs('plan'), ['--agent', 'plan']);
    assert.deepEqual(opencode.modeArgs(), []);
  });
});

describe('wireApi round-trip', () => {
  it('survives config serialize/parse', async () => {
    const { parseConfig, serializeConfig } = await import('../src/lib/config.js');
    const config = { active: 'ollama', fallback: [], profiles: new Map([['ollama', ollama]]) };
    const parsed = parseConfig(serializeConfig(config));
    assert.equal(parsed.profiles.get('ollama')?.wireApi, 'openai');
  });
});
