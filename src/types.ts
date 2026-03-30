/** A single provider profile stored in .cppc.env */
export interface Profile {
  name: string;
  baseUrl: string;
  authToken: string;
  model: string;
  smallFastModel?: string;
  subagentModel?: string;
  timeoutMs?: string;
  disableTraffic?: string;
}

/** Parsed .cppc.env configuration */
export interface Config {
  active: string;
  fallback: string[];
  profiles: Map<string, Profile>;
}

/** Built-in provider template for quick setup */
export interface ProviderTemplate {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  smallFastModel?: string;
  validateUrl: string;
}

/** Result of a health check */
export interface HealthResult {
  name: string;
  status: 'ok' | 'fail';
  latencyMs?: number;
  error?: string;
}

/** JSON output wrapper for --json flag */
export interface JsonOutput {
  ok: boolean;
  data?: unknown;
  error?: string;
}

/** Map of profile keys to their ANTHROPIC_* env var names */
export const ENV_KEY_MAP: Record<string, string> = {
  BASE_URL: 'ANTHROPIC_BASE_URL',
  AUTH_TOKEN: 'ANTHROPIC_AUTH_TOKEN',
  MODEL: 'ANTHROPIC_MODEL',
  SMALL_FAST_MODEL: 'ANTHROPIC_SMALL_FAST_MODEL',
  SUBAGENT_MODEL: 'CLAUDE_CODE_SUBAGENT_MODEL',
  TIMEOUT_MS: 'API_TIMEOUT_MS',
  DISABLE_TRAFFIC: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
};
