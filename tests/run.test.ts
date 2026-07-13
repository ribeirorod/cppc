import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTarget, buildRunArgs } from '../src/commands/run.js';
import { normalizeMode } from '../src/lib/harnesses.js';
import type { Profile } from '../src/types.js';

const profiles = new Map<string, Profile>([
  ['openrouter', { name: 'openrouter', baseUrl: 'https://openrouter.ai/api', authToken: 'sk-or-x', model: 'anthropic/claude-sonnet-5' }],
  ['minimax', { name: 'minimax', baseUrl: 'https://api.minimax.io/anthropic', authToken: 'mm-x', model: 'MiniMax-M2.7' }],
]);

describe('normalizeMode (unified policies)', () => {
  it('maps yolo/edit/safe onto autonomous/default/plan', () => {
    assert.equal(normalizeMode('yolo'), 'autonomous');
    assert.equal(normalizeMode('edit'), 'default');
    assert.equal(normalizeMode('safe'), 'plan');
  });
  it('passes legacy names and undefined through', () => {
    assert.equal(normalizeMode('autonomous'), 'autonomous');
    assert.equal(normalizeMode('plan'), 'plan');
    assert.equal(normalizeMode(undefined), undefined);
  });
});

describe('parseTarget', () => {
  it('defaults to the active profile', () => {
    const t = parseTarget('claude', profiles, 'minimax');
    assert.equal(t.harness.id, 'claude');
    assert.equal(t.profile?.name, 'minimax');
    assert.equal(t.model, undefined);
  });

  it('parses harness:profile:model, keeping colons in the model id', () => {
    const t = parseTarget('codex:openrouter:somevendor/chat:free', profiles, 'minimax');
    assert.equal(t.harness.id, 'codex');
    assert.equal(t.profile?.name, 'openrouter');
    assert.equal(t.model, 'somevendor/chat:free');
  });

  it("treats profile 'native' as no-profile", () => {
    const t = parseTarget('opencode:native:gpt-5.2', profiles, 'minimax');
    assert.equal(t.profile, null);
    assert.equal(t.model, 'gpt-5.2');
  });

  it('rejects unknown harnesses and profiles', () => {
    assert.throws(() => parseTarget('cursor:minimax', profiles, 'minimax'), /Unknown harness/);
    assert.throws(() => parseTarget('claude:nope', profiles, 'minimax'), /not found/);
  });
});

describe('buildRunArgs', () => {
  it('composes claude: --print with profile wiring via env (no argv wiring)', () => {
    const t = parseTarget('claude:minimax', profiles, 'minimax');
    assert.deepEqual(buildRunArgs(t, 'yolo', 'do the thing'), ['--dangerously-skip-permissions', '--print', 'do the thing']);
  });

  it('composes codex: exec subcommand first, -c wiring, prompt last', () => {
    const t = parseTarget('codex:openrouter', profiles, 'minimax');
    const args = buildRunArgs(t, 'safe', 'do the thing');
    assert.equal(args[0], 'exec');
    assert.ok(args.includes('model_providers.cppc.wire_api=responses'));
    assert.ok(args.includes('read-only'));
    assert.equal(args[args.length - 1], 'do the thing');
  });

  it('composes opencode: run subcommand with namespaced model and native plan agent', () => {
    const t = parseTarget('opencode:minimax', profiles, 'minimax');
    const args = buildRunArgs(t, 'safe', 'plan it');
    assert.deepEqual(args, ['run', '--model', 'cppc/MiniMax-M2.7', '--agent', 'plan', 'plan it']);
  });

  it('composes pi: -p print flag, and refuses the safe policy', () => {
    const t = parseTarget('pi:minimax', profiles, 'minimax');
    assert.deepEqual(buildRunArgs(t, 'yolo', 'go'), ['--model', 'MiniMax-M2.7', '-p', 'go']);
    assert.throws(() => buildRunArgs(t, 'safe', 'go'), /no plan/);
  });

  it('native targets wire only the model via the harness model flag', () => {
    const t = parseTarget('codex:native:gpt-5.2', profiles, 'minimax');
    assert.deepEqual(buildRunArgs(t, undefined, 'go'), ['exec', '-m', 'gpt-5.2', 'go']);
  });
});
