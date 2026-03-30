import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkHealth } from '../src/lib/health.js';
import type { Profile } from '../src/types.js';

describe('checkHealth', () => {
  it('returns fail for unreachable host', async () => {
    const profile: Profile = {
      name: 'bad',
      baseUrl: 'http://127.0.0.1:1',
      authToken: 'x',
      model: 'm',
    };
    const result = await checkHealth(profile, 1000);
    assert.equal(result.status, 'fail');
    assert.equal(result.name, 'bad');
    assert.ok(result.error);
  });
});
