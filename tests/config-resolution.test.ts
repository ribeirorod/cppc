import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, saveConfig, findConfigPath, discoverConfigs, configScope, globalConfigDir } from '../src/lib/config.js';
import type { Config } from '../src/types.js';

const base = join(tmpdir(), 'cppc-resolution-' + Date.now());
const globalHome = join(base, 'home-cppc');
const projectDir = join(base, 'project');

const sampleConfig = (name: string): Config => ({
  active: name,
  fallback: [],
  profiles: new Map([[name, { name, baseUrl: `https://${name}.example`, authToken: 't', model: 'm' }]]),
});

describe('config resolution (local → global)', () => {
  let savedCwd: string;
  let savedHome: string | undefined;

  beforeEach(() => {
    mkdirSync(globalHome, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    savedCwd = process.cwd();
    savedHome = process.env.CPPC_HOME;
    process.env.CPPC_HOME = globalHome;
    process.chdir(projectDir);
  });

  afterEach(() => {
    process.chdir(savedCwd);
    if (savedHome === undefined) delete process.env.CPPC_HOME;
    else process.env.CPPC_HOME = savedHome;
    rmSync(base, { recursive: true, force: true });
  });

  it('CPPC_HOME overrides the global config dir', () => {
    assert.equal(globalConfigDir(), globalHome);
  });

  it('finds nothing when neither local nor global exists', () => {
    assert.equal(findConfigPath(), null);
    assert.equal(loadConfig(), null);
  });

  it('falls back to the global config', () => {
    writeFileSync(join(globalHome, '.cppc.env'), 'CPPC_ACTIVE=glob\nCPPC__glob__BASE_URL=https://g\nCPPC__glob__AUTH_TOKEN=t\nCPPC__glob__MODEL=m\n');
    assert.equal(findConfigPath(), join(globalHome, '.cppc.env'));
    assert.equal(loadConfig()?.active, 'glob');
  });

  it('prefers a project-local config over the global one', () => {
    writeFileSync(join(globalHome, '.cppc.env'), 'CPPC_ACTIVE=glob\n');
    writeFileSync(join(projectDir, '.cppc.env'), 'CPPC_ACTIVE=local\n');
    assert.equal(findConfigPath(), join(projectDir, '.cppc.env'));
    assert.equal(loadConfig()?.active, 'local');
  });

  it('saves fresh setups to the global dir with owner-only permissions', () => {
    const path = saveConfig(sampleConfig('fresh'));
    assert.equal(path, join(globalHome, '.cppc.env'));
    assert.ok(existsSync(path));
    assert.equal(statSync(path).mode & 0o777, 0o600);
  });

  it('saves back to the resolved config when one exists', () => {
    writeFileSync(join(projectDir, '.cppc.env'), 'CPPC_ACTIVE=local\n');
    const path = saveConfig(sampleConfig('updated'));
    assert.equal(path, join(projectDir, '.cppc.env'));
    assert.ok(!existsSync(join(globalHome, '.cppc.env')));
  });

  it('discovers a config in a parent folder (walk-up)', () => {
    // Config sits in the project's parent, not in the project itself.
    writeFileSync(join(base, '.cppc.env'), 'CPPC_ACTIVE=parent\n');
    const found = discoverConfigs();
    assert.ok(found.includes(join(base, '.cppc.env')));
    // With no local file, the parent config is what resolves.
    assert.equal(findConfigPath(), join(base, '.cppc.env'));
    assert.equal(loadConfig()?.active, 'parent');
  });

  it('orders discovery nearest-first: project → parent → global', () => {
    writeFileSync(join(globalHome, '.cppc.env'), 'CPPC_ACTIVE=glob\n');
    writeFileSync(join(base, '.cppc.env'), 'CPPC_ACTIVE=parent\n');
    writeFileSync(join(projectDir, '.cppc.env'), 'CPPC_ACTIVE=local\n');
    const found = discoverConfigs();
    assert.equal(found[0], join(projectDir, '.cppc.env'));
    assert.ok(found.indexOf(join(base, '.cppc.env')) < found.indexOf(join(globalHome, '.cppc.env')));
  });

  it('labels config scope', () => {
    assert.equal(configScope(join(projectDir, '.cppc.env')), 'project');
    assert.equal(configScope(join(globalHome, '.cppc.env')), 'global');
    assert.equal(configScope(join(base, '.cppc.env')), 'inherited');
  });

  it('an explicit dir still bypasses resolution', () => {
    const explicit = join(base, 'explicit');
    mkdirSync(explicit, { recursive: true });
    const path = saveConfig(sampleConfig('exp'), explicit);
    assert.equal(path, join(explicit, '.cppc.env'));
    assert.equal(loadConfig(explicit)?.active, 'exp');
  });
});
