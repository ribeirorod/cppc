import type { Profile, HealthResult } from '../types.js';

export async function checkHealth(profile: Profile, timeoutMs = 5000): Promise<HealthResult> {
  const url = profile.baseUrl.replace(/\/$/, '') + '/v1/models';
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.authToken}`,
        'x-api-key': profile.authToken,
      },
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - start;

    if (response.ok || response.status === 401 || response.status === 403) {
      return { name: profile.name, status: 'ok', latencyMs };
    }

    return { name: profile.name, status: 'fail', latencyMs, error: `HTTP ${response.status}` };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return { name: profile.name, status: 'fail', latencyMs, error: message };
  }
}
