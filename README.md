# CPPC — Claude Profiled Provider CLI

Provider- and harness-independent profiles for coding agents. Define a provider once, then launch **any** agent CLI against it — Claude Code, OpenAI Codex, OpenCode, or pi — switching providers, models, and harnesses with a flag. Set fallback chains, health-check endpoints, and run prompts non-interactively across several harnesses at once.

One key, one profile, any model, any harness.

## Install

```bash
npm install -g @ribeirorod/cppc-cli
```

## Quick Start

Run `cppc` with no arguments to launch the interactive wizard:

```bash
cppc
```

It searches for credentials nearest-first — `./.cppc.env`, any parent folder (including a home-level `~/.cppc.env`), then the global `~/.cppc/.cppc.env`. First run walks you through provider selection, API key setup, and where to store them (global recommended). When credentials are found outside the current project, the wizard shows where they came from and lets you reuse them, copy them into a project-scoped file, or start fresh — no re-entering keys you already have.

Or use commands directly:

```bash
# Claude Max (OAuth) — no API key needed
cppc init

# Third-party provider
cppc init --provider minimax --auth-token mm-xxx

# Load into current shell
eval $(cppc env)

# Claude works as normal — env vars handle the routing
claude "hello"
```

## Why

Coding-agent CLIs read provider settings from env vars, flags, or config files — each in its own way. Claude Code respects `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_MODEL`; Codex wants a `model_providers` block; OpenCode wants a provider in `opencode.json`; pi wants its own env vars. CPPC keeps **one** set of named profiles and translates each into whatever the target harness needs — per launch, no config files written, no global state mutated.

The result is a clean, scriptable seam between *who serves the tokens* (provider), *which model* (flag), *which agent drives* (harness), and *how much freedom it has* (policy) — each swappable independently. That is exactly the surface an orchestrating agent needs to spin up sub-agents on the right model, at the right price, under the right guardrails.

**Use cases:**
- **Provider independence** — one profile catalog for MiniMax, DeepSeek, Kimi, Qwen, Z.AI/GLM, OpenRouter, Ollama, and Anthropic
- **Harness independence** — the same profile launches Claude Code, Codex, OpenCode, or pi (`cppc <harness> -p <profile>`)
- **Fallback resilience** — quota hit or outage? `cppc fallback activate && eval $(cppc env)`
- **Cost arbitrage** — cheap models for grunt work, frontier models for judgment; `cppc models` shows live per-token pricing
- **Cross-model verification** — `cppc run` the same task through several harness/model pairs in parallel; disagreement is signal
- **Parallel terminals** — different providers in different terminals simultaneously

## Built-in Providers

| ID | Provider | Default Model |
|----|----------|---------------|
| `anthropic` | Anthropic (Claude Max / OAuth) | *(Claude default)* |
| `anthropic-api` | Anthropic (API key) | claude-sonnet-5 |
| `minimax` | MiniMax | MiniMax-M2.7 |
| `deepseek` | DeepSeek | deepseek-reasoner |
| `kimi` | Kimi / Moonshot | K2.5 |
| `qwen` | Qwen / DashScope | qwen3.5-plus |
| `zhipu` | Z.AI / GLM | GLM-5.1 |
| `openrouter` | OpenRouter | anthropic/claude-sonnet-5 |
| `ollama` | Ollama (local) | llama3 |

Default models are just profile seeds — each profile stores its own `MODEL` in `.cppc.env`, so you can pin any model without waiting for a cppc release, and override it per-invocation with `--model`.

### OpenRouter: one key, many models

The `openrouter` template targets OpenRouter's Anthropic-compatible endpoint (`https://openrouter.ai/api` — Claude Code appends `/v1/messages` itself), giving one profile access to the whole catalog:

```bash
cppc profile add openrouter --auth-token sk-or-v1-...
cppc models --search deepseek              # browse the catalog
cppc claude -p openrouter --model deepseek/deepseek-chat
eval $(cppc env --profile openrouter --model qwen/qwen3-coder)
```

Claude Code needs models that support tool use — `cppc models` marks them with ✓ (`--tools-only` to hide the rest). Non-Anthropic models rely on OpenRouter's tool-call translation and aren't guaranteed to behave perfectly.

> **Upgrading?** If you created an `openrouter` profile before this fix, its base URL was `https://openrouter.ai/api/v1` (the OpenAI-compatible surface, which Claude Code can't use). Re-add the profile or edit `CPPC__openrouter__BASE_URL` in `.cppc.env` to `https://openrouter.ai/api`.

Your Anthropic subscription keeps working as before: the `anthropic` (OAuth) profile exports nothing and never strips your `claude login` credentials — only token-based profiles clear a stale `ANTHROPIC_API_KEY` so it can't hijack their routing.

## Harnesses: one profile, any agent CLI

cppc profiles aren't just for Claude Code — the same profile can launch other coding-agent harnesses:

```bash
cppc claude   -p minimax                  # Claude Code (as always)
cppc opencode -p minimax -m plan          # OpenCode, native plan mode
cppc pi       -p deepseek                 # pi (pi.dev)
cppc codex    -p openrouter -m autonomous # OpenAI Codex CLI
```

All harness commands share the same flags: `-p/--profile`, `-m/--mode`, `--model`, `--native`, and `--` passthrough. No harness config files are ever written — cppc wires profiles in per-launch (env vars for Claude Code and pi, inline `OPENCODE_CONFIG_CONTENT` for OpenCode, `-c` overrides for Codex).

### Unified permission policies

One policy vocabulary, translated per harness — callers (human or agent) don't need to know each CLI's flags:

| Policy | Meaning | claude | codex | opencode | pi |
|--------|---------|--------|-------|----------|-----|
| `yolo` | fully autonomous | `--dangerously-skip-permissions` | `--dangerously-bypass-approvals-and-sandbox` | `--auto` | (always) |
| `edit` | work, ask when risky | *(default)* | *(default)* | *(default)* | n/a — pi is always yolo |
| `safe` | read-only / plan | `--plan` | `--sandbox read-only` | `--agent plan` | refused with clear error |

The legacy names (`autonomous | default | plan`) still work everywhere.

### Native launches

`--native` (or profile `native` in `cppc run` targets) launches a harness with **its own** auth and config — no profile injection. Handy when your active profile is a cheap provider but you just want your Claude subscription for one session:

```bash
cppc claude --native            # your claude login, untouched
cppc codex --native -m yolo     # codex with its native OpenAI auth
```

### `cppc run` — unified non-interactive verb

One spawn contract across all harnesses (`--print` / `codex exec` / `opencode run` / `pi -p` are translated for you) — built for agentic workflows:

```bash
cppc run "explain this repo"                            # claude + active profile
cppc run -H opencode -p minimax --policy safe "plan the refactor"
cppc run -p native --policy yolo "fix the failing test"

# Fan-out: the same task through several harness/model pairs, in parallel
cppc run --on claude:openrouter:anthropic/claude-sonnet-5 \
         --on codex:openrouter:openai/gpt-5.2 \
         --json "review src/lib/config.ts for bugs"
```

Targets are `harness[:profile[:model]]` (`active` and `native` are special profile names). A single target streams straight through with its exit code; multiple targets run in parallel and report labeled results (or a JSON array with `--json`) — disagreement between models is signal.

| Harness | Command | Profile compatibility | Mode notes |
|---------|---------|----------------------|------------|
| Claude Code | `cppc claude` | All profiles (Anthropic wire) | Full: default / autonomous / plan |
| OpenCode | `cppc opencode` | All profiles (Anthropic + OpenAI wire via `wireApi`) | Native plan mode (`--agent plan`) |
| pi | `cppc pi` | anthropic-api, minimax, deepseek, kimi, zhipu, openrouter (built-in providers) | Always autonomous — no plan mode |
| Codex | `cppc codex` | openrouter only (Codex speaks only the OpenAI Responses API) | plan ≈ read-only sandbox |

Profiles carry an optional `WIRE_API` field in `.cppc.env` (`anthropic` default, `openai` for e.g. Ollama) so harnesses that support both wire protocols pick the right one. Harnesses that can't work with a profile refuse with a clear error instead of launching something broken.

## Commands

| Command | Description |
|---------|-------------|
| `cppc` | Interactive wizard (first-run setup or main menu) |
| `cppc init` | Create `.cppc.env` with a starter profile (global by default, `--project` for local) |
| `cppc env` | Print `export` statements for the active profile |
| `cppc status` | Show active profile, fallback chain, profile count |
| `cppc switch <profile>` | Set the active profile |
| `cppc profile list` | List all profiles |
| `cppc profile show <name>` | Show profile details (use `--unmask` for full token) |
| `cppc profile add <name>` | Add a profile (`--from-env` to read current env vars) |
| `cppc profile remove <name>` | Remove a profile |
| `cppc fallback set <a,b,c>` | Set the fallback chain |
| `cppc fallback activate` | Switch to the next provider in the chain |
| `cppc fallback status` | Show current fallback chain status |
| `cppc fallback reset` | Clear the fallback chain |
| `cppc check [profile]` | Health-check a provider endpoint (`--all` for all) |
| `cppc claude` | Launch a Claude terminal with profile env vars injected |
| `cppc codex` / `cppc pi` / `cppc opencode` | Launch other agent harnesses with a profile applied |
| `cppc run <prompt>` | Non-interactive run through one or more harnesses (`--on` fan-out) |
| `cppc models` | List models available through an OpenRouter profile |
| `cppc providers` | List built-in provider templates |
| `cppc reset` | Remove the resolved `.cppc.env` (nearest first, then global) |

Every command supports `--help` with examples and `--json` for machine-readable output.

## Launch Profiled Terminals

```bash
# Interactive — pick profile and mode from menus
cppc claude

# Direct — MiniMax in autonomous mode
cppc claude -p minimax -m autonomous

# DeepSeek in plan mode
cppc claude -p deepseek -m plan

# Resume a conversation on Anthropic
cppc claude -p anthropic --resume
```

## Fallback — Keep the Engines Running

The core idea: you run Claude on Anthropic. Quota exceeded, rate limited, or service down? Don't stop — fall through to the next provider automatically.

```
anthropic (primary) → minimax → kimi
                      ↑
              quota exceeded? next.
```

### 1. Set it up once

```bash
# Primary — your Claude Max account
cppc init

# Add fallback providers (Anthropic-compatible APIs)
cppc profile add minimax --auth-token mm-xxx
cppc profile add kimi --auth-token mk-xxx

# Define the fallback chain
cppc fallback set minimax,kimi
```

Now your `.cppc.env` holds three profiles with a defined order: `anthropic → minimax → kimi`.

### 2. You're working, Anthropic goes down

You hit the Claude Max quota or Anthropic returns 529. One command:

```bash
cppc fallback activate && eval $(cppc env)
# ✓ Switched from 'anthropic' to 'minimax'
```

Claude Code keeps running — same commands, same workflow — just routed through MiniMax now.

Still broken? Move down the chain:

```bash
cppc fallback activate && eval $(cppc env)
# ✓ Switched from 'minimax' to 'kimi'
```

### 3. Anthropic is back — switch home

```bash
cppc switch anthropic && eval $(cppc env)
# ✓ Switched to 'anthropic'
```

### 4. Check who's healthy before switching

```bash
cppc check --all
# ✓ anthropic: OK (120ms)
# ✓ minimax: OK (89ms)
# ✗ kimi: FAIL — timeout
```

### 5. Parallel terminals — different providers at the same time

Run Anthropic for complex architecture work and a cheaper provider for routine tasks, side by side:

```bash
# Terminal 1 — heavy lifting
cppc claude -p anthropic -m autonomous

# Terminal 2 — tests, docs, simple fixes
cppc claude -p minimax -m autonomous
```

### 6. Script / agent integration

All commands support `--json` so agents and scripts can drive failover programmatically:

```bash
# Check current state
cppc status --json
# {"ok":true,"data":{"active":"anthropic","fallback":["minimax","kimi"],"profiles":3}}

# Automated failover in a wrapper script
cppc fallback activate --json && eval $(cppc env)

# Health monitoring
cppc check --all --json
```

## Agent SDK Integration

CPPC works with the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript) — pass profile env vars via `options.env` to route agent sessions through any provider.

### TypeScript

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { execSync } from 'child_process';

// Read the active profile's env vars from cppc
const cppcEnv = JSON.parse(execSync('cppc env --json').toString()).data;

for await (const message of query({
  prompt: 'Analyze the repo for bugs.',
  options: {
    env: cppcEnv,  // ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_MODEL
    allowedTools: ['Read', 'Glob', 'Grep'],
  }
})) {
  if (message.type === 'assistant') {
    console.log(message.message.content);
  }
}
```

### Python

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
import subprocess, json

# Read the active profile's env vars from cppc
cppc_env = json.loads(
    subprocess.check_output(["cppc", "env", "--json"])
)["data"]

options = ClaudeAgentOptions(
    env=cppc_env,  # ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_MODEL
    allowed_tools=["Read", "Write", "Edit"],
    permission_mode="bypassPermissions"
)

async with ClaudeSDKClient(options=options) as client:
    async for message in client.query("Review this code."):
        print(message)
```

### How it works

| Auth method | What CPPC sets | What happens |
|-------------|---------------|--------------|
| **Claude Max (OAuth)** | Nothing — env vars are empty | Agent SDK uses your `claude login` session automatically |
| **API key provider** | `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL` | Agent SDK routes to the specified provider |

For Claude Max users: just run `claude login` once. CPPC's `anthropic` profile leaves env vars empty so the SDK falls through to your OAuth session.

### Failover in agent scripts

```typescript
import { execSync } from 'child_process';

function getCppcEnv(profile?: string): Record<string, string> {
  const flag = profile ? ` --profile ${profile}` : '';
  return JSON.parse(execSync(`cppc env --json${flag}`).toString()).data;
}

// Try primary, fall back on error
try {
  await runAgent(getCppcEnv());
} catch (err) {
  if (isQuotaOrRateError(err)) {
    execSync('cppc fallback activate');
    await runAgent(getCppcEnv());  // now on the next provider
  }
}
```

## Config

Single flat file, resolved **nearest first**. cppc walks up from the current directory and then checks the global home, so it finds your keys wherever they live:

1. `./.cppc.env` — project-scoped, wins when present (create with `cppc init --project`; add it to `.gitignore` — it contains auth tokens)
2. any parent folder's `.cppc.env`, including a home-level `~/.cppc.env` — picked up automatically when you work beneath it
3. `~/.cppc/.cppc.env` — the default home for your keys (override the directory with `CPPC_HOME`)

Fresh setups save globally so your keys live in one place and work from any directory. If you run bare `cppc` in a project that has no local `.cppc.env` but credentials exist elsewhere, the wizard shows what it found and lets you **use them as-is**, **copy them into a project-scoped `.cppc.env`** (no keys to re-enter), or start fresh — so a project-scoped file is always an option, never an obligation. The file is written with owner-only permissions (0600). `cppc status` shows which config is active; `cppc reset` removes the resolved one.

```env
CPPC_ACTIVE=anthropic
CPPC_FALLBACK=minimax,deepseek

CPPC__anthropic__BASE_URL=
CPPC__anthropic__AUTH_TOKEN=
CPPC__anthropic__MODEL=

CPPC__minimax__BASE_URL=https://api.minimax.io/anthropic
CPPC__minimax__AUTH_TOKEN=mm-xxx
CPPC__minimax__MODEL=MiniMax-M2.7
```

CPPC never touches `~/.claude/settings.json` or any harness's own config.

## License

MIT
