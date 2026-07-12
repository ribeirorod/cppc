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
  /** If true, uses OAuth (claude login) — no API key needed */
  oauth?: boolean;
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

/** Map of Profile fields to their ANTHROPIC_* env var names */
export const ENV_KEY_MAP: Record<string, string> = {
  baseUrl: 'ANTHROPIC_BASE_URL',
  authToken: 'ANTHROPIC_AUTH_TOKEN',
  model: 'ANTHROPIC_MODEL',
  smallFastModel: 'ANTHROPIC_SMALL_FAST_MODEL',
  subagentModel: 'CLAUDE_CODE_SUBAGENT_MODEL',
  timeoutMs: 'API_TIMEOUT_MS',
  disableTraffic: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
};
