#!/usr/bin/env node
import { Command } from 'commander';
import { setJsonMode } from './lib/output.js';
import { registerInit } from './commands/init.js';
import { registerEnv } from './commands/env.js';
import { registerStatus } from './commands/status.js';
import { registerProfile } from './commands/profile.js';
import { registerSwitch } from './commands/switch.js';
import { registerFallback } from './commands/fallback.js';
import { registerCheck } from './commands/check.js';
import { registerReset } from './commands/reset.js';
import { getAllTemplates } from './lib/providers.js';

const program = new Command();

program
  .name('cppc')
  .description('Claude Profiled Provider CLI — agent-friendly provider switching for Claude Code & Agent SDK')
  .version('0.1.0', '-v, --version')
  .option('--json', 'Output in JSON format for programmatic use')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.optsWithGlobals();
    if (opts.json) setJsonMode(true);
  });

// Register all commands
registerInit(program);
registerEnv(program);
registerStatus(program);
registerProfile(program);
registerSwitch(program);
registerFallback(program);
registerCheck(program);
registerReset(program);

// Provider list (convenience, no config needed)
program
  .command('providers')
  .description('List built-in provider templates')
  .addHelpText('after', `
Examples:
  cppc providers          # List known providers
  cppc providers --json   # JSON output
  `)
  .action(() => {
    const templates = getAllTemplates();
    const jsonFlag = program.optsWithGlobals().json;

    if (jsonFlag) {
      console.log(JSON.stringify({ ok: true, data: templates }));
    } else {
      for (const t of templates) {
        console.log(`${t.id.padEnd(14)} ${t.name.padEnd(20)} ${t.baseUrl}`);
      }
    }
  });

// Help text
program.addHelpText('after', `
Examples:
  cppc init --provider anthropic --auth-token sk-ant-xxx
  cppc profile add minimax --auth-token mm-xxx
  cppc fallback set minimax,deepseek
  cppc switch minimax && eval $(cppc env)
  cppc check --all
  cppc status --json

Agent integration:
  eval $(cppc env)                         # Load active profile
  eval $(cppc env --profile minimax)       # Load specific profile
  cppc fallback activate && eval $(cppc env)  # Activate next fallback
`);

program.parseAsync(process.argv).catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
