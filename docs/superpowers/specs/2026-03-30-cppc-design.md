# CPPC — Claude Profiled Provider CLI

## Purpose

A lean, agent-friendly CLI that manages Anthropic-compatible provider profiles per project directory. Agents and humans use `eval $(cppc env)` to load the active provider into their shell before running Claude Code or Agent SDK scripts. No global state, no MCP overhead, no interactive prompts required.

## Problem

Anthropic access can be limited by quota, pricing, or outages. Claude Code and the Agent SDK are hardcoded to Anthropic unless overridden via environment variables. We need a programmatic way to:

1. Pre-configure multiple Anthropic-compatible providers as named profiles
2. Switch the active provider per project/terminal
3. Define a fallback chain that activates when the primary provider is unavailable
4. Expose all operations as CLI flags so agents can self-navigate via `--help` and `--json`

## Design Principles

- **Project-scoped by default** — config lives in `.cppc.env` in the working directory
- **One file** — `.cppc.env` is the entire configuration (profiles + active + fallback chain)
- **Agent-first** — every command has `--help` with examples, `--json` for structured output, no interactive prompts
- **Shell-native** — `eval $(cppc env)` is the integration point, works with any shell
- **Zero runtime deps at use-time** — the CLI writes files and prints strings, nothing resident

## Config Format

Single file: `.cppc.env`

```env
# CPPC Configuration
CPPC_ACTIVE=anthropic
CPPC_FALLBACK=minimax,deepseek,qwen

# Profile: anthropic (default)
CPPC__anthropic__BASE_URL=https://api.anthropic.com
CPPC__anthropic__AUTH_TOKEN=sk-ant-xxx
CPPC__anthropic__MODEL=claude-sonnet-4-20250514
CPPC__anthropic__TIMEOUT_MS=120000

# Profile: minimax
CPPC__minimax__BASE_URL=https://api.minimax.io/anthropic
CPPC__minimax__AUTH_TOKEN=mm-xxx
CPPC__minimax__MODEL=MiniMax-M2.7
CPPC__minimax__TIMEOUT_MS=3000000

# Profile: deepseek
CPPC__deepseek__BASE_URL=https://api.deepseek.com/anthropic
CPPC__deepseek__AUTH_TOKEN=sk-xxx
CPPC__deepseek__MODEL=deepseek-reasoner
CPPC__deepseek__TIMEOUT_MS=3000000
```

Double-underscore (`__`) separates namespace from profile from key. Keys after the profile name map directly to `ANTHROPIC_*` env vars (e.g., `BASE_URL` → `ANTHROPIC_BASE_URL`, `AUTH_TOKEN` → `ANTHROPIC_AUTH_TOKEN`).

Special keys per profile (optional):
- `MODEL` → `ANTHROPIC_MODEL`
- `SMALL_FAST_MODEL` → `ANTHROPIC_SMALL_FAST_MODEL`
- `SUBAGENT_MODEL` → `CLAUDE_CODE_SUBAGENT_MODEL`
- `TIMEOUT_MS` → `API_TIMEOUT_MS`
- `DISABLE_TRAFFIC` → `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`

## CLI Commands

All commands support `--json` for machine-readable output and `--help` with usage examples.

### `cppc env`
Print export statements for the active profile. Primary integration point.

```bash
$ cppc env
export ANTHROPIC_BASE_URL="https://api.anthropic.com"
export ANTHROPIC_AUTH_TOKEN="sk-ant-xxx"
export ANTHROPIC_MODEL="claude-sonnet-4-20250514"
export API_TIMEOUT_MS="120000"

$ cppc env --profile minimax
export ANTHROPIC_BASE_URL="https://api.minimax.io/anthropic"
...

$ cppc env --json
{"ANTHROPIC_BASE_URL":"https://api.anthropic.com",...}
```

Usage: `eval $(cppc env)` before running `claude` or agent SDK scripts.

### `cppc status`
Show active profile, fallback chain, and profile health.

```bash
$ cppc status
Active: anthropic
Fallback chain: minimax → deepseek → qwen
Profiles: anthropic, minimax, deepseek, qwen (4 configured)

$ cppc status --json
{"active":"anthropic","fallback":["minimax","deepseek","qwen"],"profiles":["anthropic","minimax","deepseek","qwen"]}
```

### `cppc profile list`
List all configured profiles.

```bash
$ cppc profile list
anthropic (active)
minimax
deepseek
qwen

$ cppc profile list --json
[{"name":"anthropic","active":true,"base_url":"https://api.anthropic.com","model":"claude-sonnet-4-20250514"},...]
```

### `cppc profile show <name>`
Show profile details (masks auth token by default).

```bash
$ cppc profile show minimax
Name: minimax
Base URL: https://api.minimax.io/anthropic
Model: MiniMax-M2.7
Auth Token: mm-***xxx
Timeout: 3000000ms

$ cppc profile show minimax --unmask
# Shows full auth token

$ cppc profile show minimax --json
{"name":"minimax","base_url":"https://api.minimax.io/anthropic","model":"MiniMax-M2.7","auth_token":"mm-***xxx","timeout_ms":"3000000"}
```

### `cppc profile add <name>`
Add a profile with flags (no interactive prompts).

```bash
$ cppc profile add minimax \
  --base-url https://api.minimax.io/anthropic \
  --auth-token mm-xxx \
  --model MiniMax-M2.7 \
  --timeout 3000000
Profile 'minimax' added.

$ cppc profile add minimax --from-env
# Reads ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_MODEL from current env
```

### `cppc profile remove <name>`
Remove a profile.

```bash
$ cppc profile remove minimax
Profile 'minimax' removed.
```

### `cppc switch <profile>`
Set the active profile.

```bash
$ cppc switch minimax
Switched to 'minimax'. Run: eval $(cppc env)

$ cppc switch minimax --json
{"switched_to":"minimax","eval_hint":"eval $(cppc env)"}
```

### `cppc fallback`
Manage fallback chain.

```bash
$ cppc fallback set minimax,deepseek,qwen
Fallback chain: minimax → deepseek → qwen

$ cppc fallback activate
Switched from 'anthropic' to 'minimax' (next fallback).
Run: eval $(cppc env)

$ cppc fallback activate --json
{"previous":"anthropic","activated":"minimax","remaining":["deepseek","qwen"]}

$ cppc fallback reset
Reset to primary profile 'anthropic'.
```

### `cppc reset`
Remove `.cppc.env` and unset environment overrides.

```bash
$ cppc reset
Removed .cppc.env. Provider defaults restored.
```

### `cppc init`
Create a `.cppc.env` with a starter profile from current environment or flags.

```bash
$ cppc init
Created .cppc.env with profile 'anthropic' from current environment.

$ cppc init --provider minimax --auth-token mm-xxx
Created .cppc.env with profile 'minimax'.
```

### `cppc check <profile>`
Health-check a profile by hitting its base URL.

```bash
$ cppc check minimax
minimax: OK (238ms)

$ cppc check --all
anthropic: OK (45ms)
minimax: OK (238ms)
deepseek: FAIL (timeout)
qwen: OK (512ms)

$ cppc check --all --json
[{"name":"anthropic","status":"ok","latency_ms":45},...]
```

## Provider Registry

Built-in provider templates for quick setup (no need to remember URLs):

| ID | Name | Base URL | Default Model |
|----|------|----------|---------------|
| `anthropic` | Anthropic | `https://api.anthropic.com` | `claude-sonnet-4-20250514` |
| `minimax` | MiniMax | `https://api.minimax.io/anthropic` | `MiniMax-M2.7` |
| `deepseek` | DeepSeek | `https://api.deepseek.com/anthropic` | `deepseek-reasoner` |
| `kimi` | Kimi/Moonshot | `https://api.moonshot.ai/anthropic` | `K2.5` |
| `qwen` | Qwen/DashScope | `https://dashscope-intl.aliyuncs.com/apps/anthropic` | `qwen3.5-plus` |
| `zhipu` | Z.AI/GLM | `https://api.z.ai/api/anthropic` | `GLM-5.1` |
| `openrouter` | OpenRouter | `https://openrouter.ai/api/v1` | (user-specified) |
| `ollama` | Ollama (local) | `http://localhost:11434/anthropic` | (user-specified) |

Shorthand: `cppc profile add minimax --auth-token mm-xxx` auto-fills base URL and default model from registry.

## Architecture

```
src/
├── cli.ts              # Commander setup, global --json/--help flags
├── commands/
│   ├── env.ts          # cppc env
│   ├── status.ts       # cppc status
│   ├── profile.ts      # cppc profile list|add|remove|show
│   ├── switch.ts       # cppc switch
│   ├── fallback.ts     # cppc fallback set|activate|reset
│   ├── check.ts        # cppc check
│   ├── init.ts         # cppc init
│   └── reset.ts        # cppc reset
├── lib/
│   ├── config.ts       # Read/write .cppc.env (parse & serialize)
│   ├── providers.ts    # Built-in provider registry
│   ├── env-mapper.ts   # Map profile keys → ANTHROPIC_* env vars
│   └── health.ts       # HTTP health check for providers
└── types.ts            # TypeScript interfaces
```

## Key Decisions

1. **No YAML/TOML/JSON config** — `.env` format is universally understood, git-friendly, and parseable without deps
2. **No daemon/resident process** — CLI writes files and prints strings, that's it
3. **No global state** — `.cppc.env` lives in the project directory; different projects can use different providers
4. **`--json` on everything** — agents parse structured output, humans read plain text
5. **`--help` with examples on everything** — agents can `cppc profile add --help` to learn the flags
6. **Provider registry is convenience, not requirement** — users can always pass `--base-url` manually
7. **`.cppc.env` should be in `.gitignore`** — contains auth tokens; `cppc init` warns about this

## Agent Integration Pattern

```bash
# Agent detects quota error, runs fallback
cppc fallback activate --json
eval $(cppc env)
# Continue with next provider

# Agent spawns parallel terminals with different providers
# Terminal 1 (complex): eval $(cppc env --profile anthropic)
# Terminal 2 (simple):  eval $(cppc env --profile minimax)
```

## Future Extensions (not in v1)

- `cppc watch` — monitor for quota errors and auto-switch (daemon mode)
- `cppc cost` — track spend per profile
- Shell hook integration (direnv, fish, zsh) for auto-loading
- Claude Code hook that calls `cppc fallback activate` on error patterns
