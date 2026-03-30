# CPPC — Claude Profiled Provider CLI

Agent-friendly CLI for managing Anthropic-compatible provider profiles per project. Switch between Claude, MiniMax, DeepSeek, Kimi, Qwen, and more with a single command.

## Quick Start

```bash
npm install -g cppc

# Initialize with your Anthropic key
cppc init --provider anthropic --auth-token sk-ant-xxx

# Add a fallback provider
cppc profile add minimax --auth-token mm-xxx

# Set fallback chain
cppc fallback set minimax,deepseek

# Load into your shell
eval $(cppc env)

# Run Claude Code / Agent SDK as normal — it picks up the env vars
claude "hello"
```

## Why?

Claude Code and the Agent SDK respect `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` environment variables. Many providers (MiniMax, DeepSeek, Kimi, Qwen, GLM) expose Anthropic-compatible APIs. CPPC manages named profiles for these providers and outputs shell exports — no global config mutation, no MCP overhead.

## Commands

| Command | Description |
|---------|-------------|
| `cppc init` | Create `.cppc.env` with a starter profile |
| `cppc env` | Print export statements for active profile |
| `cppc status` | Show active profile and fallback chain |
| `cppc switch <profile>` | Set the active profile |
| `cppc profile list\|add\|remove\|show` | Manage profiles |
| `cppc fallback set\|activate\|reset` | Manage fallback chain |
| `cppc check [profile\|--all]` | Health-check provider endpoints |
| `cppc reset` | Remove `.cppc.env` |

All commands support `--json` for machine-readable output and `--help` with usage examples.

## Agent Integration

```bash
# On quota error, activate next fallback
cppc fallback activate --json
eval $(cppc env)

# Parallel terminals with different providers
eval $(cppc env --profile anthropic)  # Complex tasks
eval $(cppc env --profile minimax)    # Simple tasks
```

## Config

Single file: `.cppc.env` in your project directory. Add it to `.gitignore` (contains auth tokens).

```env
CPPC_ACTIVE=anthropic
CPPC_FALLBACK=minimax,deepseek

CPPC__anthropic__BASE_URL=https://api.anthropic.com
CPPC__anthropic__AUTH_TOKEN=sk-ant-xxx
CPPC__anthropic__MODEL=claude-sonnet-4-20250514

CPPC__minimax__BASE_URL=https://api.minimax.io/anthropic
CPPC__minimax__AUTH_TOKEN=mm-xxx
CPPC__minimax__MODEL=MiniMax-M2.7
```

## License

MIT
