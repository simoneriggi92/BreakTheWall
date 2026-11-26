// @vitest-environment node
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkMarketplacePin, packPlugin, pluginTag, releaseNotes } from '../scripts/plugin-release.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function tempDir() {
  const root = mkdtempSync(join(tmpdir(), 'btw-plugin-release-'));
  roots.push(root);
  return root;
}

function write(path: string, text = '') {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/** The repository's own plugin/ as `npm run build:plugin` leaves it, with stand-ins for the build output. */
function builtPlugin() {
  const from = join(tempDir(), 'plugin');
  cpSync('plugin', from, {
    recursive: true,
    filter: source => !/[\\/](server|page)$|[\\/]\.claude-plugin[\\/]types$/.test(source),
  });
  write(join(from, 'server', 'server.cjs'), '// server');
  write(join(from, 'server', 'launcher.cjs'), '// launcher');
  write(join(from, 'page', 'index.html'), '<!doctype html>');
  write(join(from, 'page', 'assets', 'index.js'), '// page');
  // What an interactive session lays beside a loaded mod.
  write(join(from, '.claude-plugin', 'types', 'claude-code.d.ts'), 'export {};');
  return from;
}

function files(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => relative(dir, join(entry.parentPath, entry.name)).split('\\').join('/'))
    .sort();
}

const notices = () => {
  const dir = tempDir();
  write(join(dir, 'LICENSE'), 'Apache License');
  write(join(dir, 'NOTICE'), 'Break the Wall');
  return [join(dir, 'LICENSE'), join(dir, 'NOTICE')];
};

describe('the plugin a release publishes (#107)', () => {
  it('ships the mod, its hooks, the doctor command, the bundled server and the built page, with the license', () => {
    const to = join(tempDir(), 'out');
    packPlugin({ from: builtPlugin(), to, version: '0.6.0', notices: notices() });

    expect(files(to)).toEqual(expect.arrayContaining([
      '.claude-plugin/plugin.json',
      'LICENSE',
      'NOTICE',
      'commands/doctor.md',
      'hooks/hooks.json',
      'hooks/inject.mjs',
      'hooks/messages.ts',
      'hooks/register.ts',
      'page/assets/index.js',
      'page/index.html',
      'server/launcher.cjs',
      'server/server.cjs',
    ]));
  });

  it('leaves out the mod\'s tests, the notes for agents, the type-check setup and the types an interactive session laid', () => {
    const to = join(tempDir(), 'out');
    packPlugin({ from: builtPlugin(), to, version: '0.6.0', notices: notices() });

    const shipped = files(to);
    expect(shipped.filter(file => file.endsWith('.test.ts'))).toEqual([]);
    expect(shipped).not.toContain('AGENTS.md');
    expect(shipped).not.toContain('tsconfig.json');
    expect(shipped.filter(file => file.startsWith('.claude-plugin/types/'))).toEqual([]);
  });

  it('gives plugin.json the version of the tag, keeping the rest of the manifest', () => {
    const to = join(tempDir(), 'out');
    packPlugin({ from: builtPlugin(), to, version: '0.6.0', notices: notices() });

    const manifest = JSON.parse(readFileSync(join(to, '.claude-plugin', 'plugin.json'), 'utf8'));
    expect(manifest).toMatchObject({ name: 'break-the-wall', version: '0.6.0', license: 'Apache-2.0' });
  });

  it('refuses a plugin that was not built, naming the build', () => {
    const from = builtPlugin();
    rmSync(join(from, 'server'), { recursive: true });
    expect(() => packPlugin({ from, to: join(tempDir(), 'out'), version: '0.6.0', notices: notices() })).toThrow('npm run build:plugin');
  });

  it('refuses a package manifest or a lockfile, which would make Claude Code run an install step', () => {
    for (const file of ['package.json', 'package-lock.json', 'node_modules/zod/index.js']) {
      const from = builtPlugin();
      write(join(from, file), '{}');
      expect(() => packPlugin({ from, to: join(tempDir(), 'out'), version: '0.6.0', notices: notices() })).toThrow(/install step/);
    }
  });
});

describe('the plugin tag a release writes (#107)', () => {
  it('follows the release tag, which names package.json\'s version', () => {
    expect(pluginTag('v0.6.0-alpha', '0.6.0-alpha')).toEqual({ version: '0.6.0-alpha', tag: 'plugin-v0.6.0-alpha' });
  });

  it('refuses a release tag that is not package.json\'s version', () => {
    expect(() => pluginTag('v0.7.0', '0.6.0-alpha')).toThrow(/0\.6\.0-alpha/);
    expect(() => pluginTag('0.6.0-alpha', '0.6.0-alpha')).toThrow(/v<version>/);
  });
});

describe('the marketplace on main (#107)', () => {
  const marketplace = (ref: string) => ({
    name: 'break-the-wall',
    owner: { name: 'Simone Riggi' },
    plugins: [{ name: 'break-the-wall', source: { source: 'url', url: 'https://github.com/simoneriggi92/BreakTheWall.git', ref } }],
  });

  it('accepts an entry pinned at the tag the release writes', () => {
    expect(() => checkMarketplacePin(marketplace('plugin-v0.6.0'), 'plugin-v0.6.0')).not.toThrow();
  });

  it('refuses a release the marketplace does not pin, so no installer is left on an older tag unnoticed', () => {
    expect(() => checkMarketplacePin(marketplace('plugin-v0.5.0'), 'plugin-v0.6.0')).toThrow(/plugin-v0\.5\.0/);
    expect(() => checkMarketplacePin({ ...marketplace('plugin-v0.6.0'), plugins: [] }, 'plugin-v0.6.0')).toThrow(/break-the-wall/);
  });

  it('refuses a source cloned over SSH, which a machine without github.com in known_hosts refuses', () => {
    const entry = (source: object) => ({ ...marketplace('plugin-v0.6.0'), plugins: [{ name: 'break-the-wall', source: { ...source, ref: 'plugin-v0.6.0' } }] });
    expect(() => checkMarketplacePin(entry({ source: 'github', repo: 'simoneriggi92/BreakTheWall' }), 'plugin-v0.6.0')).toThrow(/https:\/\/github\.com\/simoneriggi92\/BreakTheWall\.git/);
    expect(() => checkMarketplacePin(entry({ source: 'url', url: 'git@github.com:simoneriggi92/BreakTheWall.git' }), 'plugin-v0.6.0')).toThrow(/must come from/);
  });

  it('pins this repository\'s plugin at the tag of package.json\'s version, installed as break-the-wall@break-the-wall', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
    const pinned = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'));
    expect(pinned.name).toBe('break-the-wall');
    expect(() => checkMarketplacePin(pinned, pluginTag(`v${version}`, version).tag)).not.toThrow();
  });

  it('names package.json\'s version in the plugin\'s own manifest, which a --plugin-dir session reads unpacked, and in the lockfile', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(JSON.parse(readFileSync('plugin/.claude-plugin/plugin.json', 'utf8')).version).toBe(version);
    expect(JSON.parse(readFileSync('package-lock.json', 'utf8')).version).toBe(version);
  });
});

describe('the release notes a tag drafts (#130)', () => {
  const changelog = [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '## [1.0.0-rc.1] - 2026-11-25',
    '',
    'Answer an agent\'s rounds in a local page.',
    '',
    '### Added',
    '- The round page.',
    '',
    '## [0.5.0-alpha] - 2026-11-10',
    '',
    '### Added',
    '- The exploration.',
    '',
    '[Unreleased]: https://example.org/compare',
  ].join('\n');

  it('titles the release with the section\'s first paragraph, without its full stop, and keeps the rest as notes', () => {
    expect(releaseNotes(changelog, '1.0.0-rc.1')).toEqual({
      title: 'Answer an agent\'s rounds in a local page',
      notes: '### Added\n- The round page.\n',
    });
  });

  it('takes a summary wrapped over several lines whole into the title', () => {
    const wrapped = '## [1.0.0] - 2026-12-01\n\nBreak the Wall\nin Claude Code.\n\n### Added\n- The plugin.\n';
    expect(releaseNotes(wrapped, '1.0.0')).toEqual({ title: 'Break the Wall in Claude Code', notes: '### Added\n- The plugin.\n' });
  });

  it('falls back to the version for a section that starts with a heading or a list, which stays whole in the notes', () => {
    expect(releaseNotes(changelog, '0.5.0-alpha')).toEqual({
      title: 'Break the Wall v0.5.0-alpha',
      notes: '### Added\n- The exploration.\n',
    });
  });

  it('refuses a version the CHANGELOG has no section for, so no tag is pushed without its notes', () => {
    expect(() => releaseNotes(changelog, '1.0.0')).toThrow(/CHANGELOG\.md has no section for 1\.0\.0/);
    expect(() => releaseNotes(changelog, 'Unreleased')).toThrow(/no section for Unreleased/);
  });

  it('finds a section for package.json\'s version in this repository\'s CHANGELOG', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version).title).not.toBe('');
  });
});
