# Spec: OpenRouter as a First-Class Provider with Model Flags

> Status: proposed · Researched 2026-07-12

## 1. Feasibility summary

**Yes — Claude Code can talk to OpenRouter directly**, but only if `cppc` points at the right base URL. There are two distinct OpenRouter surfaces and only one of them works with Claude Code:

| Surface | Base URL | Protocol | Works with Claude Code? |
|---|---|---|---|
| OpenAI-compatible completions | `https://openrouter.ai/api/v1` | OpenAI chat-completions | No — Claude Code speaks the Anthropic Messages protocol, not OpenAI's |
| **"Anthropic Skin" Messages API** | `https://openrouter.ai/api` | Anthropic Messages API (`/v1/messages`) | **Yes** — this is what OpenRouter's own Claude Code integration guide documents |

OpenRouter publishes an official Claude Code cookbook that sets:

```
OPENROUTER_API_KEY=<key>
ANTHROPIC_BASE_URL=https://openrouter.ai/api
ANTHROPIC_AUTH_TOKEN=$OPENROUTER_API_KEY
```

Claude Code appends `/v1/messages` itself (same as it does for `https://api.anthropic.com`), so `ANTHROPIC_BASE_URL` must be the host **without** a trailing `/v1` — no proxy, no Docker, no local port. Sources: [Claude Code Integration — OpenRouter docs](https://openrouter.ai/docs/cookbook/coding-agents/claude-code-integration), [Claude Code with OpenRouter: Setup, Models, and Costs — OpenRouter Blog](https://openrouter.ai/blog/tutorials/claude-code-openrouter/), [Anthropic API and Models — OpenRouter](https://openrouter.ai/anthropic).

**This means the existing `openrouter` template in `src/lib/providers.ts` is subtly wrong today.** It sets `baseUrl: 'https://openrouter.ai/api/v1'`, which is the OpenAI-compatible surface, not the Anthropic one — a `cppc claude -p openrouter` session built from that template would hit `https://openrouter.ai/api/v1/v1/messages` (double `/v1`, 404) or otherwise fail to negotiate the right protocol. The fix is a one-line change: drop the trailing `/v1`. Its `validateUrl` (`https://openrouter.ai/api/v1/models`) is coincidentally already correct once `baseUrl` is fixed, since `health.ts` appends `/v1/models` to `baseUrl`.

**Caveat (must be surfaced to users, not just a footnote):** OpenRouter's own docs state Claude Code integration is "only guaranteed to work with the Anthropic first-party provider." Claude Code doesn't just chat — it requires structured tool-call emission in Anthropic's exact tool_use format. The Anthropic Skin translates other vendors' native tool-calling conventions (GLM, Qwen, DeepSeek, Kimi, etc.) into that format, and the translation is imperfect. So the "any model via one key" pitch is real for models that reliably support tool use, but not a blanket guarantee across all 400+ models in the catalog — this needs to be reflected in the CLI (surface tool-support metadata) and in docs, not oversold.

## 2. Model naming, listing, and auth

- **Naming**: `vendor/model-name[:variant]`, e.g. `anthropic/claude-sonnet-4.5`, `deepseek/deepseek-chat`, `openai/gpt-4o`, `z-ai/glm-4.6`, `qwen/qwen3-coder`, `moonshotai/kimi-k2`. Variant suffixes are routing hints: `:free` (free-tier hosting), `:nitro` (optimize for throughput), `:floor` (optimize for cost), `:extended` (larger context provider), `:thinking` (enable reasoning mode where supported). [Nitro Variant docs](https://openrouter.ai/docs/guides/routing/model-variants/nitro), [OpenRouter model routing](https://openrouter.ai/blog/insights/model-routing/).
- **Listing**: `GET https://openrouter.ai/api/v1/models` returns `{ data: [{ id, name, context_length, pricing: {prompt, completion, ...}, supported_parameters: [...] }] }`. `supported_parameters` includes `"tools"` when a model accepts Claude-Code-style tool definitions — this is the field to filter on for a "will this model actually work with Claude Code" signal. [OpenRouter Models guide](https://openrouter.ai/docs/guides/overview/models).
- **Auth**: `Authorization: Bearer <OPENROUTER_API_KEY>`. This maps directly onto cppc's existing `Profile.authToken` → `ANTHROPIC_AUTH_TOKEN` mapping — no new field needed. [API Authentication docs](https://openrouter.ai/docs/api/reference/authentication).
- **Optional headers**: `HTTP-Referer` / `X-Title` are attribution-only (OpenRouter leaderboards/analytics), not required for auth or function. Safe to skip in an MVP; can be added later as a nice-to-have.
- **Risk — `ANTHROPIC_API_KEY` collision**: several third-party guides insist `ANTHROPIC_API_KEY` must be explicitly empty when using OpenRouter, because Claude Code may prefer it over `ANTHROPIC_AUTH_TOKEN` if both are present in the environment. `cppc` never sets `ANTHROPIC_API_KEY` itself (it's not in `ENV_KEY_MAP`), but `launch.ts` does `{ ...process.env, ...profileToJson(profile), ...extraEnv }` — if the user's shell already exports `ANTHROPIC_API_KEY` (e.g., left over from a native `claude login` session), it will leak into the spawned process and can silently override the OpenRouter routing. This is worth a targeted fix (see §4).

## 3. CLI surface

Keep the existing minimal, flag-based style — no new interaction paradigm.

```
# Already works today once the template baseUrl is fixed (§4) — no code change required here:
cppc profile add openrouter --auth-token sk-or-v1-...      # baseUrl/model auto-filled from template
cppc claude -p openrouter                                   # launches with template's defaultModel
cppc claude -p openrouter --model deepseek/deepseek-chat    # per-invocation override (existing --model flag)
cppc claude -p openrouter --model z-ai/glm-4.6:nitro

# New: parity --model override on `env` (currently missing)
eval $(cppc env --profile openrouter --model qwen/qwen3-coder)

# New: model discovery/search command
cppc models                              # list OpenRouter models (uses active profile if it's an openrouter profile)
cppc models --search deepseek            # substring filter on id/name
cppc models --tools-only                 # only models with supported_parameters includes "tools"
cppc models --free                       # only :free-eligible models
cppc models --profile openrouter --json  # explicit profile, JSON output for agents
cppc models --limit 50                   # cap rows (catalog is 400+ models; default a sane limit e.g. 30)
```

Design notes:

- **`cppc claude --model` and eventual `cppc env --model` are the actual feature** — this is what lets one `openrouter` profile stand in for N per-model profiles. The bulk of the "value prop" ships from a one-line template fix plus a small `env.ts` addition; `cppc models` is a discoverability nicety on top.
- `cppc models` is scoped to OpenRouter for v1 (its catalog and `/models` shape are what make discovery useful — the other templates each expose 1–3 models, not worth building generic multi-provider model search for). If `--provider` isn't OpenRouter (or omitted and the active/`--profile` profile isn't OpenRouter-shaped), print a clear "model listing is only supported for OpenRouter today" and exit non-zero rather than silently guessing at a foreign schema.
- Table columns: `id`, `context_length`, `$/1M prompt`, `$/1M completion`, `tools` (yes/no from `supported_parameters`). Sort tool-capable models first, or flag `--tools-only` to hide the rest — since this is the property that determines whether Claude Code will actually function.

## 4. Code changes (file by file)

**`src/lib/providers.ts`**

- Fix the `openrouter` template entry:

  ```ts
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api',           // was 'https://openrouter.ai/api/v1' — wrong surface for Claude Code
    defaultModel: 'anthropic/claude-sonnet-4.5',     // verify current id against live /v1/models at implementation time
    smallFastModel: 'anthropic/claude-haiku-4.5',    // pick a cheap, confirmed tool-use-capable model
    validateUrl: 'https://openrouter.ai/api/v1/models', // unchanged — already correct
  },
  ```

- Add a short code comment noting the tool-use caveat (non-Anthropic models routed through the Skin are not guaranteed to work correctly with Claude Code's tool-calling).

**`src/types.ts`**

- No required changes. Do **not** add a separate `modelsUrl` field — `validateUrl` already points at the same endpoint used for model listing; reusing it keeps the diff small (acceptable minor naming overload for this codebase's size; flag it as a possible rename target if `cppc models` grows beyond OpenRouter later).

**`src/lib/models.ts` (new)** — pure logic, unit-testable without Commander, mirroring the `health.ts`/`checkHealth` split:

```ts
export interface OpenRouterModel {
  id: string; name: string; context_length: number;
  pricing: { prompt: string; completion: string };
  supported_parameters?: string[];
}
export async function fetchModels(baseUrl: string, authToken: string, timeoutMs?: number): Promise<OpenRouterModel[]>
export function filterModels(models: OpenRouterModel[], opts: { search?: string; toolsOnly?: boolean; free?: boolean }): OpenRouterModel[]
export function formatModelsTable(models: OpenRouterModel[]): string
```

Fetch reuses the same `Authorization: Bearer` header pattern already established in `health.ts`.

**`src/commands/models.ts` (new)** — thin wrapper: resolve profile/token (via `--profile`, active profile, or `--auth-token`), call `fetchModels`, apply `filterModels`, print via existing `out()` helper (text + `--json` data payload), matching the shape of `check.ts`.

**`src/cli.ts`**

- `import { registerModels } from './commands/models.js';` and `registerModels(program);`
- Add an example line to the trailing help text block, e.g. `cppc claude -p openrouter --model deepseek/deepseek-chat`.

**`src/commands/env.ts`**

- Add `.option('--model <model>', 'Override the model for this export')`.
- Build an override before calling `profileToExports`/`profileToJson` — cheapest approach: shallow-clone the profile with `model: opts.model || profile.model` before passing it down (avoids touching `env-mapper.ts`'s signature).

**`src/lib/launch.ts`** (targeted fix for the `ANTHROPIC_API_KEY` collision risk from §2)

- When building the spawn env, explicitly `delete env.ANTHROPIC_API_KEY` whenever `profile.authToken` is set (i.e., non-OAuth profiles), so a stale key from a prior native `claude login` session in the parent shell can't silently override `ANTHROPIC_AUTH_TOKEN` routing. Small, targeted, doesn't touch the OAuth (`anthropic`) path.

**`src/commands/claude.ts`**

- No functional change needed — `--model` already exists and does exactly what's needed (`extraEnv.ANTHROPIC_MODEL = opts.model`). Just update the `addHelpText` examples to include an OpenRouter model-flag example, and confirm/adjust the same `ANTHROPIC_API_KEY` deletion behavior flows through (already handled if fixed in `launch.ts`).

**`src/commands/wizard.ts`**

- No required change; the OpenRouter entry already flows through `selectProvider()`/`buildProfile()` generically. Optionally mention in the model prompt step that OpenRouter model IDs use `vendor/model` format (cosmetic).

## 5. Config format

**No `.cppc.env` schema changes.** `MODEL` is already a per-profile field; `--model` overrides are purely runtime (`extraEnv`/clone-before-export), never persisted. This is fully backward compatible with existing config files — the only behavioral change existing OpenRouter-profile users would see is their `baseUrl` needing to be corrected (either by re-running `cppc profile add openrouter ...` or manually editing `CPPC__openrouter__BASE_URL` in `.cppc.env`, since the template fix doesn't retroactively touch already-saved profiles). Worth a one-line callout in the changelog/README: *"If you already have an `openrouter` profile, its base URL was wrong (used the OpenAI-compatible surface); re-add it or edit `.cppc.env` to `https://openrouter.ai/api`."*

## 6. Testing

Follow the existing `node:test` + `node:assert/strict` style, no mocking framework — use `node:test`'s built-in `mock.method` for `fetch`.

- **`tests/providers.test.ts`**: update the `openrouter` template assertion to `baseUrl === 'https://openrouter.ai/api'` (this actually catches the current bug — the existing test only checks `minimax`'s baseUrl, so `openrouter`'s wrong URL is currently untested).
- **`tests/models.test.ts` (new)**: mock `globalThis.fetch` to return a fixture JSON payload (a handful of models, some with `supported_parameters: ['tools']`, some without, one `:free`). Assert:
  - `fetchModels` sends `Authorization: Bearer <token>` and parses `data[]` correctly.
  - `filterModels` correctly applies `search`, `toolsOnly`, `free`.
  - Network failure / non-2xx surfaces a clean error rather than throwing raw.
- **`tests/commands/env.test.ts`**: extend with a case asserting `--model` override wins over the stored profile model (test at the `profileToExports`/clone level, matching the existing pattern of testing lib functions directly rather than spawning the CLI).
- **`tests/health.test.ts`**: no change required — `checkHealth` logic is untouched; the `openrouter` template fix is exercised via `providers.test.ts`, not `health.test.ts`.
- Optionally add a `tests/launch.test.ts` (currently doesn't exist) asserting `ANTHROPIC_API_KEY` is stripped from the spawn env when a profile has an `authToken` — small, targeted, catches regressions on the collision fix.

## 7. Out of scope / risks

- **Tool-use reliability across non-Anthropic models is not solvable by cppc.** The Anthropic Skin's translation quality is OpenRouter's problem, not cppc's — the CLI's job is to surface `supported_parameters` so users can self-select, not to guarantee correctness. Document this prominently (README + `cppc models` output), don't imply "any model works."
- **Pricing/rate limits**: OpenRouter bills per-token per-model and enforces its own rate limits (especially on `:free` variants); cppc has no visibility into or control over this — surfacing `pricing` in `cppc models` is informational only, not a cost guard.
- **Catalog volatility**: model IDs and default-model recommendations (`defaultModel`, `smallFastModel` in the template) will drift as OpenRouter adds/deprecates models. Treat the hardcoded template values as "verify against live `/v1/models` before each release," not a one-time fix.
- **HTTP-Referer/X-Title headers**: explicitly deferred — optional, analytics-only, no functional impact on Claude Code compatibility.
- **Provider-generic `cppc models`**: deliberately not building this now. Other templates (MiniMax, DeepSeek, Kimi, Qwen, Zhipu) each expose only 1–3 models with heterogeneous `/models` response shapes; generalizing model search across all of them is a bigger effort for little payoff versus OpenRouter's actual "many models, one key" value prop. Revisit only if a second provider ships a similarly large, uniform catalog.
- **`ANTHROPIC_API_KEY` stripping** (§4) is a narrow, defensive fix for one known collision; it does not solve the general problem that `cppc env`'s `eval $(cppc env ...)` never unsets stale exports left in the calling shell from a previous profile switch — that's a pre-existing limitation of the tool, out of scope for this spec.
