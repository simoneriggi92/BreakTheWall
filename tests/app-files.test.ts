// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { appFilePath } from '../src/desktop/app-files';

describe('appFilePath', () => {
  const root = '/Applications/Break the Wall.app/Contents/Resources/app.asar/dist';

  it('serves the index for the root and files below it, also inside app.asar', () => {
    expect(appFilePath(root, '/')).toBe(`${root}/index.html`);
    expect(appFilePath(root, '/assets/index-abc.js')).toBe(`${root}/assets/index-abc.js`);
    expect(appFilePath(root, '/assets/a%20b.css')).toBe(`${root}/assets/a b.css`);
  });

  it('refuses paths that leave the root, the root itself and malformed escapes', () => {
    expect(appFilePath(root, '/../main.cjs')).toBeNull();
    expect(appFilePath(root, '/%2e%2e/%2e%2e/package.json')).toBeNull();
    expect(appFilePath(root, '/..')).toBeNull();
    expect(appFilePath(root, '/%E0%A4%A')).toBeNull();
  });

  it('does not accept a sibling folder that shares the root as a prefix', () => {
    expect(appFilePath(root, '/../dist-electron/main.cjs')).toBeNull();
    expect(appFilePath('/app/dist', '/../dist2/secret')).toBeNull();
  });
});
