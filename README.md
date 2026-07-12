# CPPC — Claude Profiled Provider CLI

Manage multiple Anthropic-compatible providers for Claude Code and the Agent SDK. Switch profiles, set fallback chains, and launch profiled terminals — all project-scoped, never global.

## Install

```bash
npm install -g @ribeirorod/cppc-cli
```

## Quick Start

Run `cppc` with no arguments to launch the interactive wizard:

```bash
cppc
```

It detects whether `.cppc.env` exists. First run walks you through provider selection and API key setup. Subsequent runs open the main menu.

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

Claude Code and the Agent SDK respect `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, and `ANTHROPIC_MODEL` environment variables. Many providers expose Anthropic-compatible APIs — MiniMax, DeepSeek, Kimi, Qwen, Z.AI/GLM, OpenRouter, Ollama. CPPC manages named profiles for these and outputs shell exports. No global config mutation, no MCP overhead.

**Use cases:**
- **Fallback resilience** — quota hit or outage? `cppc fallback activate && eval $(cppc env)`
- **Cost optimization** — run complex tasks on Anthropic, simple ones on cheaper providers
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

All harness commands share the same flags: `-p/--profile`, `-m/--mode` (`default | autonomous | plan`), `--model`, and `--` passthrough. No harness config files are ever written — cppc wires profiles in per-launch (env vars for Claude Code and pi, inline `OPENCODE_CONFIG_CONTENT` for OpenCode, `-c` overrides for Codex).

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
| `cppc init` | Create `.cppc.env` with a starter profile |
| `cppc env` | Print `export` statements for the active profile |
| `cppc status` | Show active profile, fallback chain, profile count |
| `cppc switch <profile>` | Set the active profile |
| `cppc profile list` | List all profiles |
| `cppc profile show <name>` | Show profile details (use `--unmask` for full token) |
| `cppc profile add <name>` | Add a profile (`--from-env` to read current env vars) |
| `cppc profile remove <name>` | Remove a profile |
| `cppc fallback set <a,b,c>` | Set the fallback chain |
| `cppc fallback activate` | Switch to the next provider in the chain |
| `cppc fallback reset` | Clear the fallback chain |
| `cppc check [profile]` | Health-check a provider endpoint (`--all` for all) |
| `cppc claude` | Launch a Claude terminal with profile env vars injected |
| `cppc codex` / `cppc pi` / `cppc opencode` | Launch other agent harnesses with a profile applied |
| `cppc models` | List models available through an OpenRouter profile |
| `cppc providers` | List built-in provider templates |
| `cppc reset` | Remove `.cppc.env` |

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

Single flat file: `.cppc.env` in your project directory. Add it to `.gitignore` — it contains auth tokens.

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

Profiles are project-scoped. CPPC never touches `~/.claude/settings.json` or any global config.

## License

MIT
