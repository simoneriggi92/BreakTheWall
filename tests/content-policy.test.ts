// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contentPolicy } from '../vite.config';

const directives = (policy: string) => Object.fromEntries(policy.split(';').map(x => x.trim().split(/\s+/)).map(([name, ...values]) => [name, values.join(' ')]));

describe('the content policy of each build (#94)', () => {
  it('lets the local page reach only its own server, and keeps Electron without any connection', () => {
    expect(directives(contentPolicy({ dev: false, page: true }))['connect-src']).toBe("'self'");
    expect(directives(contentPolicy({ dev: false, page: false }))['connect-src']).toBe("'none'");
  });

  it('changes nothing else between the two builds', () => {
    const { 'connect-src': _, ...page } = directives(contentPolicy({ dev: false, page: true }));
    const { 'connect-src': __, ...electron } = directives(contentPolicy({ dev: false, page: false }));
    expect(page).toEqual(electron);
    expect(electron['script-src']).toBe("'self'");
    expect(electron['style-src']).toBe("'self'");
  });
});
