import type { Command } from 'commander';
import { select, input, confirm } from '@inquirer/prompts';
import { loadConfig, saveConfig, resolveConfigPath } from '../lib/config.js';
import { getAllTemplates, getTemplate } from '../lib/providers.js';
import { profileToExports } from '../lib/env-mapper.js';
import { mask } from '../lib/output.js';
import type { Config, Profile } from '../types.js';

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

/** Wrap a prompt — returns null on Esc/Ctrl+C */
async function ask<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null; // ExitPromptError on Esc or Ctrl+C
  }
}

interface ProviderChoice {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  oauth: boolean;
}

function banner(): void {
  console.log(`
${CYAN}${BOLD}  ╔═══════════════════════════════════════════╗
  ║   CPPC — Claude Profiled Provider CLI     ║
  ╚═══════════════════════════════════════════╝${RESET}
  ${DIM}Esc to exit · Esc in sub-menu to go back${RESET}
`);
}

async function selectProvider(): Promise<ProviderChoice | null> {
  const templates = getAllTemplates();

  const providerId = await ask(() => select({
    message: 'Select a provider',
    choices: templates.map(t => ({
      name: `${t.name.padEnd(30)} ${DIM}${t.oauth ? '(OAuth — claude login)' : t.baseUrl}${RESET}`,
      value: t.id,
    })),
  }));
  if (providerId === null) return null;

  const template = getTemplate(providerId)!;

  let model = template.defaultModel;
  if (!template.oauth) {
    const m = await ask(() => input({ message: 'Model', default: template.defaultModel }));
    if (m === null) return null;
    model = m;
  }

  return { id: providerId, name: template.name, baseUrl: template.baseUrl, model, oauth: !!template.oauth };
}

async function askAuthToken(providerName: string): Promise<string | null> {
  const token = await ask(() => input({
    message: `${providerName} API key / auth token`,
    validate: (val) => val.trim().length > 0 || 'Auth token is required',
  }));
  if (token === null) return null;
  return token.trim();
}

async function firstRunSetup(): Promise<void> {
  banner();
  console.log(`${YELLOW}  No .cppc.env found. Let's set up your first provider.${RESET}\n`);

  const provider = await selectProvider();
  if (!provider) { console.log(`\n${DIM}  Exited.${RESET}`); return; }

  let authToken = '';
  if (provider.oauth) {
    console.log(`\n${CYAN}  OAuth provider — no API key needed.${RESET}`);
    console.log(`${DIM}  Make sure you're logged in: ${BOLD}claude login${RESET}\n`);
  } else {
    const t = await askAuthToken(provider.name);
    if (t === null) { console.log(`\n${DIM}  Exited.${RESET}`); return; }
    authToken = t;
  }

  const profile: Profile = {
    name: provider.id,
    baseUrl: provider.baseUrl,
    authToken,
    model: provider.model,
  };

  const template = getTemplate(provider.id);
  if (template?.smallFastModel) profile.smallFastModel = template.smallFastModel;

  const config: Config = {
    active: provider.id,
    fallback: [],
    profiles: new Map([[provider.id, profile]]),
  };

  saveConfig(config);
  console.log(`${GREEN}  ✓ Profile '${provider.id}' created and set as active.${RESET}`);
  console.log(`${DIM}  Config saved to ${resolveConfigPath()}${RESET}\n`);

  const addMore = await ask(() => confirm({ message: 'Add another provider (for fallback)?', default: false }));
  if (addMore) await addProfileFlow(config);

  showNextSteps(config);
}

async function addProfileFlow(config: Config): Promise<void> {
  while (true) {
    const provider = await selectProvider();
    if (!provider) return; // Esc → back

    if (config.profiles.has(provider.id)) {
      console.log(`${YELLOW}  Profile '${provider.id}' already exists, skipping.${RESET}`);
    } else {
      let authToken = '';
      if (provider.oauth) {
        console.log(`\n${CYAN}  OAuth provider — no API key needed.${RESET}`);
        console.log(`${DIM}  Make sure you're logged in: ${BOLD}claude login${RESET}\n`);
      } else {
        const t = await askAuthToken(provider.name);
        if (t === null) return; // Esc → back
        authToken = t;
      }

      const profile: Profile = {
        name: provider.id,
        baseUrl: provider.baseUrl,
        authToken,
        model: provider.model,
      };

      const template = getTemplate(provider.id);
      if (template?.smallFastModel) profile.smallFastModel = template.smallFastModel;

      config.profiles.set(provider.id, profile);
      config.fallback.push(provider.id);
      saveConfig(config);

      console.log(`${GREEN}  ✓ Profile '${provider.id}' added to fallback chain.${RESET}`);
    }

    const more = await ask(() => confirm({ message: 'Add another provider?', default: false }));
    if (!more) break;
  }

  if (config.fallback.length > 0) {
    saveConfig(config);
    console.log(`\n${GREEN}  Fallback chain: ${config.fallback.join(' → ')}${RESET}`);
  }
}

function showNextSteps(config: Config): void {
  const profileNames = [...config.profiles.keys()];

  console.log(`\n${CYAN}${BOLD}  What's next?${RESET}\n`);
  console.log(`  ${BOLD}Option 1:${RESET} Load into this shell`);
  console.log(`  ${DIM}  eval $(cppc env)${RESET}\n`);
  console.log(`  ${BOLD}Option 2:${RESET} Launch a Claude terminal directly`);
  console.log(`  ${DIM}  cppc claude${RESET}`);
  if (profileNames.length > 1) {
    console.log(`  ${DIM}  cppc claude -p ${profileNames[1]} -m autonomous${RESET}`);
  }
  console.log(`\n  ${BOLD}Option 3:${RESET} Apply to project (auto-activates with 'claude')`);
  console.log(`  ${DIM}  cppc apply${RESET}`);
  console.log('');
}

async function mainMenu(): Promise<void> {
  const config = loadConfig()!;

  banner();
  console.log(`  ${BOLD}Active:${RESET}   ${GREEN}${config.active}${RESET}`);
  console.log(`  ${BOLD}Profiles:${RESET} ${[...config.profiles.keys()].join(', ')}`);
  if (config.fallback.length > 0) {
    console.log(`  ${BOLD}Fallback:${RESET} ${config.fallback.join(' → ')}`);
  }
  console.log('');

  const action = await ask(() => select({
    message: 'What would you like to do?',
    choices: [
      { name: 'Launch Claude terminal',         value: 'launch' as const },
      { name: 'Switch active profile',          value: 'switch' as const },
      { name: 'Add a provider profile',         value: 'add' as const },
      { name: 'Activate next fallback',         value: 'fallback' as const },
      { name: 'Show env exports',               value: 'env' as const },
      { name: 'Apply to project (.claude/settings.json)', value: 'apply' as const },
      { name: 'Show all profiles',              value: 'list' as const },
      { name: 'Remove a profile',               value: 'remove' as const },
      { name: 'Health check providers',          value: 'check' as const },
      { name: 'Reset (remove .cppc.env)',        value: 'reset' as const },
      { name: 'Exit',                           value: 'exit' as const },
    ],
  }));

  if (action === null) return; // Esc on main menu = exit

  switch (action) {
    case 'launch': {
      const profileNames = [...config.profiles.keys()];
      const profile = await ask(() => select({
        message: 'Which profile?',
        choices: profileNames.map(n => ({
          name: `${n}${n === config.active ? ' (active)' : ''}`,
          value: n,
        })),
      }));
      if (profile === null) break;

      const mode = await ask(() => select({
        message: 'Permission mode?',
        choices: [
          { name: 'Default (normal)',         value: 'default' },
          { name: 'Autonomous (skip perms)',  value: 'autonomous' },
          { name: 'Plan mode',               value: 'plan' },
        ],
      }));
      if (mode === null) break;

      const { spawn } = await import('node:child_process');
      const { profileToJson } = await import('../lib/env-mapper.js');
      const p = config.profiles.get(profile)!;
      const envOverrides = profileToJson(p);
      const args: string[] = [];
      if (mode === 'autonomous') args.push('--dangerously-skip-permissions');
      if (mode === 'plan') args.push('--plan');
      console.log(`\n${GREEN}  Launching claude with '${profile}'...${RESET}\n`);
      const child = spawn('claude', args, { env: { ...process.env, ...envOverrides }, stdio: 'inherit', shell: true });
      child.on('close', (code) => { process.exitCode = code ?? 0; });
      return;
    }
    case 'switch': {
      const profileNames = [...config.profiles.keys()];
      const p = await ask(() => select({
        message: 'Switch to which profile?',
        choices: profileNames.map(n => ({ name: n, value: n })),
      }));
      if (p === null) break;
      config.active = p;
      saveConfig(config);
      console.log(`${GREEN}  ✓ Switched to '${p}'.${RESET}`);
      break;
    }
    case 'add': {
      await addProfileFlow(config);
      break;
    }
    case 'fallback': {
      if (config.fallback.length === 0) {
        console.log(`${YELLOW}  No fallback chain configured.${RESET}`);
        break;
      }
      const next = config.fallback.find(f => f !== config.active);
      if (!next) { console.log(`${YELLOW}  Fallback chain exhausted.${RESET}`); break; }
      const prev = config.active;
      config.active = next;
      saveConfig(config);
      console.log(`${GREEN}  ✓ Switched from '${prev}' to '${next}'.${RESET}`);
      break;
    }
    case 'env': {
      const p = config.profiles.get(config.active)!;
      console.log(`\n${profileToExports(p)}\n`);
      break;
    }
    case 'apply': {
      console.log(`${DIM}  Run: cppc apply${RESET}`);
      break;
    }
    case 'list': {
      console.log('');
      for (const [name, p] of config.profiles) {
        const active = name === config.active ? ` ${GREEN}(active)${RESET}` : '';
        console.log(`  ${BOLD}${name}${RESET}${active}`);
        console.log(`    ${DIM}URL:   ${p.baseUrl || '(native — OAuth)'}${RESET}`);
        console.log(`    ${DIM}Model: ${p.model || '(Claude default)'}${RESET}`);
        console.log(`    ${DIM}Key:   ${p.authToken ? mask(p.authToken) : '(OAuth)'}${RESET}`);
        console.log('');
      }
      break;
    }
    case 'remove': {
      const removable = [...config.profiles.keys()].filter(n => n !== config.active);
      if (removable.length === 0) {
        console.log(`${YELLOW}  Cannot remove the only/active profile.${RESET}`);
        break;
      }
      const toRemove = await ask(() => select({
        message: 'Remove which profile?',
        choices: removable.map(n => ({ name: n, value: n })),
      }));
      if (toRemove === null) break;
      config.profiles.delete(toRemove);
      config.fallback = config.fallback.filter(f => f !== toRemove);
      saveConfig(config);
      console.log(`${GREEN}  ✓ Profile '${toRemove}' removed.${RESET}`);
      break;
    }
    case 'check': {
      const { checkHealth } = await import('../lib/health.js');
      console.log('');
      for (const p of config.profiles.values()) {
        const result = await checkHealth(p, 5000);
        const icon = result.status === 'ok' ? `${GREEN}✓${RESET}` : `\x1b[31m✗${RESET}`;
        const latency = result.latencyMs ? ` ${DIM}(${result.latencyMs}ms)${RESET}` : '';
        const errMsg = result.error ? ` ${DIM}— ${result.error}${RESET}` : '';
        console.log(`  ${icon} ${p.name}: ${result.status.toUpperCase()}${latency}${errMsg}`);
      }
      console.log('');
      break;
    }
    case 'reset': {
      const sure = await ask(() => confirm({ message: 'Remove .cppc.env? This cannot be undone.', default: false }));
      if (!sure) break;
      const { unlinkSync } = await import('node:fs');
      unlinkSync(resolveConfigPath());
      console.log(`${GREEN}  ✓ Removed .cppc.env.${RESET}`);
      return;
    }
    case 'exit':
      return;
  }

  // Loop back to menu
  await mainMenu();
}

export function registerWizard(program: Command): void {
  program.action(async () => {
    const config = loadConfig();
    if (!config) {
      await firstRunSetup();
    } else {
      await mainMenu();
    }
  });
}
