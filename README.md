# CPPC — Claude Profiled Provider CLI

Manage multiple Anthropic-compatible providers for Claude Code and the Agent SDK. Switch profiles, set fallback chains, and launch profiled terminals — all project-scoped, never global.

## Install

```bash
npm install -g cppc
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
| `anthropic-api` | Anthropic (API key) | claude-sonnet-4-20250514 |
| `minimax` | MiniMax | MiniMax-M2.7 |
| `deepseek` | DeepSeek | deepseek-reasoner |
| `kimi` | Kimi / Moonshot | K2.5 |
| `qwen` | Qwen / DashScope | qwen3.5-plus |
| `zhipu` | Z.AI / GLM | GLM-5.1 |
| `openrouter` | OpenRouter | anthropic/claude-sonnet-4 |
| `ollama` | Ollama (local) | llama3 |

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

## Agent Integration

```bash
# Load active profile into shell
eval $(cppc env)

# Load a specific profile
eval $(cppc env --profile minimax)

# On quota error, failover to next provider
cppc fallback activate --json
eval $(cppc env)

# Check provider health programmatically
cppc check --all --json
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
