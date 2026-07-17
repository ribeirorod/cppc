import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { fetchModels, filterModels, formatModelsTable, supportsTools } from '../src/lib/models.js';
import type { OpenRouterModel } from '../src/lib/models.js';

const FIXTURE: OpenRouterModel[] = [
  {
    id: 'anthropic/claude-sonnet-5',
    name: 'Anthropic: Claude Sonnet 5',
    context_length: 1000000,
    pricing: { prompt: '0.000003', completion: '0.000015' },
    supported_parameters: ['tools', 'max_tokens'],
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek: DeepSeek V3',
    context_length: 163840,
    pricing: { prompt: '0.0000003', completion: '0.0000009' },
    supported_parameters: ['tools'],
  },
  {
    id: 'somevendor/chat-only:free',
    name: 'SomeVendor: Chat Only (free)',
    context_length: 8192,
    pricing: { prompt: '0', completion: '0' },
    supported_parameters: ['max_tokens'],
  },
];

describe('fetchModels', () => {
  afterEach(() => mock.restoreAll());

  it('calls {baseUrl}/v1/models with a Bearer token and parses data[]', async () => {
    let seenUrl = '';
    let seenAuth = '';
    mock.method(globalThis, 'fetch', async (url: string | URL, init?: RequestInit) => {
      seenUrl = String(url);
      seenAuth = (init?.headers as Record<string, string>)['Authorization'];
      return new Response(JSON.stringify({ data: FIXTURE }), { status: 200 });
    });

    const models = await fetchModels('https://openrouter.ai/api', 'sk-or-test');
    assert.equal(seenUrl, 'https://openrouter.ai/api/v1/models');
    assert.equal(seenAuth, 'Bearer sk-or-test');
    assert.equal(models.length, 3);
    assert.equal(models[0].id, 'anthropic/claude-sonnet-5');
  });

  it('throws a clean error on non-2xx', async () => {
    mock.method(globalThis, 'fetch', async () => new Response('nope', { status: 401 }));
    await assert.rejects(() => fetchModels('https://openrouter.ai/api', 'bad'), /HTTP 401/);
  });
});

describe('filterModels', () => {
  it('filters by id/name substring, case-insensitive', () => {
    assert.deepEqual(filterModels(FIXTURE, { search: 'DEEPSEEK' }).map(m => m.id), ['deepseek/deepseek-chat']);
  });

  it('filters to tool-capable models', () => {
    const ids = filterModels(FIXTURE, { toolsOnly: true }).map(m => m.id);
    assert.deepEqual(ids, ['anthropic/claude-sonnet-5', 'deepseek/deepseek-chat']);
  });

  it('filters to free models', () => {
    assert.deepEqual(filterModels(FIXTURE, { free: true }).map(m => m.id), ['somevendor/chat-only:free']);
  });
});

describe('formatModelsTable', () => {
  it('marks tool support and shows per-million pricing', () => {
    const table = formatModelsTable(FIXTURE);
    assert.ok(table.includes('anthropic/claude-sonnet-5'));
    assert.ok(table.includes('$3.00'));
    assert.ok(table.includes('$15.00'));
    assert.ok(supportsTools(FIXTURE[0]));
    assert.ok(!supportsTools(FIXTURE[2]));
  });
});
