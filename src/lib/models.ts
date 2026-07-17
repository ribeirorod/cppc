/** A model entry from OpenRouter's GET /v1/models catalog */
export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  /** Per-token USD prices as decimal strings */
  pricing: { prompt: string; completion: string };
  supported_parameters?: string[];
}

export function supportsTools(model: OpenRouterModel): boolean {
  return (model.supported_parameters ?? []).includes('tools');
}

export async function fetchModels(baseUrl: string, authToken: string, timeoutMs = 10000): Promise<OpenRouterModel[]> {
  const url = baseUrl.replace(/\/$/, '') + '/v1/models';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
    const body = await response.json() as { data?: OpenRouterModel[] };
    return body.data ?? [];
  } finally {
    clearTimeout(timer);
  }
}

export function filterModels(
  models: OpenRouterModel[],
  opts: { search?: string; toolsOnly?: boolean; free?: boolean },
): OpenRouterModel[] {
  const search = opts.search?.toLowerCase();
  return models.filter(m =>
    (!search || `${m.id} ${m.name}`.toLowerCase().includes(search)) &&
    (!opts.toolsOnly || supportsTools(m)) &&
    (!opts.free || m.id.endsWith(':free') || (Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0))
  );
}

export function formatModelsTable(models: OpenRouterModel[]): string {
  const perMillion = (price: string) => {
    const n = Number(price) * 1_000_000;
    return Number.isFinite(n) ? `$${n.toFixed(2)}` : '?';
  };
  const header = `T  ${'model'.padEnd(44)} ${'context'.padStart(9)} ${'$/1M in'.padStart(9)} ${'$/1M out'.padStart(9)}`;
  const rows = models.map(m =>
    `${supportsTools(m) ? '✓' : ' '}  ${m.id.padEnd(44)} ${String(m.context_length).padStart(9)} ${perMillion(m.pricing.prompt).padStart(9)} ${perMillion(m.pricing.completion).padStart(9)}`
  );
  return [header, ...rows].join('\n');
}
