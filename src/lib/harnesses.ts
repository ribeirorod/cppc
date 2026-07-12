import type { Profile } from '../types.js';
import { profileToJson } from './env-mapper.js';

/** A launchable coding-agent CLI that cppc can apply a profile to */
export interface Harness {
  id: string;
  name: string;
  /** Binary to spawn */
  bin: string;
  /** Map a profile (+ optional model override) to the env vars the harness reads.
   * Throws with a clear message when the profile can't work with this harness. */
  buildEnv(profile: Profile, model?: string): Record<string, string>;
  /** Inherited env vars to remove so they can't conflict with the profile's routing */
  stripEnv(profile: Profile): string[];
  /** Map a cppc permission mode (default | autonomous | plan) to harness flags.
   * Throws when the harness has no equivalent for the mode. */
  modeArgs(mode?: string): string[];
  /** Args wiring the profile/model into the harness (e.g. --model flags, codex -c overrides) */
  profileArgs(profile: Profile, model?: string): string[];
}

const claude: Harness = {
  id: 'claude',
  name: 'Claude Code',
  bin: 'claude',
  buildEnv: (profile, model) => profileToJson(model ? { ...profile, model } : profile),
  // Claude Code prefers ANTHROPIC_API_KEY over ANTHROPIC_AUTH_TOKEN, so a stale key
  // from `claude login` would hijack token-based routing. OAuth profiles (no authToken)
  // inherit the environment untouched so subscriptions work normally.
  stripEnv: (profile) => profile.authToken ? ['ANTHROPIC_API_KEY'] : [],
  modeArgs: (mode) => {
    if (mode === 'autonomous') return ['--dangerously-skip-permissions'];
    if (mode === 'plan') return ['--plan'];
    return [];
  },
  profileArgs: () => [],
};

// Codex speaks only the OpenAI Responses API (chat-completions support was removed),
// so none of cppc's Anthropic-compatible profiles work with it directly. OpenRouter is
// the known exception — its OpenAI surface (/api/v1) implements /v1/responses.
const CODEX_KEY_VAR = 'CPPC_CODEX_API_KEY';

function codexBaseUrl(profile: Profile): string {
  if (profile.baseUrl.includes('openrouter.ai')) return 'https://openrouter.ai/api/v1';
  throw new Error(
    `Codex speaks only the OpenAI Responses API — profile '${profile.name}' (${profile.baseUrl || 'OAuth'}) has no known Responses-compatible surface. Works today: openrouter.`
  );
}

const codex: Harness = {
  id: 'codex',
  name: 'OpenAI Codex CLI',
  bin: 'codex',
  buildEnv: (profile) => {
    codexBaseUrl(profile); // validate up front
    return { [CODEX_KEY_VAR]: profile.authToken };
  },
  stripEnv: () => [],
  modeArgs: (mode) => {
    if (mode === 'autonomous') return ['--dangerously-bypass-approvals-and-sandbox'];
    if (mode === 'plan') return ['--sandbox', 'read-only']; // closest analog; codex has no plan UI
    return [];
  },
  // Repeated -c overrides define an ephemeral provider — no ~/.codex/config.toml writes
  profileArgs: (profile, model) => {
    const m = model || profile.model;
    return [
      '-c', 'model_provider=cppc',
      '-c', 'model_providers.cppc.name=cppc',
      '-c', `model_providers.cppc.base_url=${codexBaseUrl(profile)}`,
      '-c', `model_providers.cppc.env_key=${CODEX_KEY_VAR}`,
      '-c', 'model_providers.cppc.wire_api=responses',
      ...(m ? ['-m', m] : []),
    ];
  },
};

// pi ships built-in providers with dedicated env vars for most of cppc's catalog,
// each speaking the vendor's correct wire protocol — no config files needed.
const PI_ENV_VARS: Record<string, string> = {
  'anthropic-api': 'ANTHROPIC_API_KEY',
  minimax: 'MINIMAX_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  kimi: 'KIMI_API_KEY',
  zhipu: 'ZAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

const pi: Harness = {
  id: 'pi',
  name: 'pi (pi.dev)',
  bin: 'pi',
  buildEnv: (profile) => {
    const envVar = PI_ENV_VARS[profile.name];
    if (!envVar || !profile.authToken) {
      throw new Error(
        `pi has no built-in provider for profile '${profile.name}'. Supported profiles: ${Object.keys(PI_ENV_VARS).join(', ')}. For others, add a custom provider to ~/.pi/agent/models.json.`
      );
    }
    return { [envVar]: profile.authToken };
  },
  stripEnv: () => [],
  modeArgs: (mode) => {
    if (mode === 'plan') {
      throw new Error('pi has no plan (read-only) mode — it always runs fully autonomous.');
    }
    return []; // default and autonomous are the same thing in pi
  },
  // pi's --model does fuzzy pattern matching, so the bare model id is enough
  profileArgs: (profile, model) => {
    const m = model || profile.model;
    return m ? ['--model', m] : [];
  },
};

// OpenCode takes inline JSON config via OPENCODE_CONFIG_CONTENT — we synthesize a
// provider from the profile per launch, no file writes. wireApi picks the AI SDK
// package: @ai-sdk/anthropic (default) or @ai-sdk/openai-compatible (e.g. ollama).
const opencode: Harness = {
  id: 'opencode',
  name: 'OpenCode',
  bin: 'opencode',
  buildEnv: (profile, model): Record<string, string> => {
    if (!profile.baseUrl && !profile.authToken) return {}; // OAuth profile: use opencode's own auth
    const m = model || profile.model;
    const config = {
      provider: {
        cppc: {
          npm: profile.wireApi === 'openai' ? '@ai-sdk/openai-compatible' : '@ai-sdk/anthropic',
          name: `cppc (${profile.name})`,
          // {env:VAR} substitution is broken for OPENCODE_CONFIG_CONTENT, so the token is inlined
          options: { baseURL: profile.baseUrl, apiKey: profile.authToken },
          models: m ? { [m]: { name: m } } : {},
        },
      },
    };
    return { OPENCODE_CONFIG_CONTENT: JSON.stringify(config) };
  },
  stripEnv: () => [],
  modeArgs: (mode) => {
    if (mode === 'autonomous') return ['--auto'];
    if (mode === 'plan') return ['--agent', 'plan']; // native read-only plan agent
    return [];
  },
  profileArgs: (profile, model) => {
    const m = model || profile.model;
    if (!m) return [];
    // OAuth/native profiles have no synthesized provider — pass the model as given
    return ['--model', (profile.baseUrl || profile.authToken) ? `cppc/${m}` : m];
  },
};

const harnesses: Harness[] = [claude, codex, pi, opencode];

export function getAllHarnesses(): Harness[] {
  return [...harnesses];
}

export function getHarness(id: string): Harness | undefined {
  return harnesses.find(h => h.id === id);
}
