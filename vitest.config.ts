import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Windows CI runners render jsdom several times slower: the five-level climb (D16) takes 0.6 s on a Mac and passed
  // the 5 s default only some of the time there.
  test: { environment: 'jsdom', setupFiles: ['tests/setup.ts'], restoreMocks: true, testTimeout: process.platform === 'win32' ? 20_000 : 5_000 },
});
