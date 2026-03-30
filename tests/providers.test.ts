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
