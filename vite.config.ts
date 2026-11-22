import { defineConfig } from 'vite';

/**
 * The renderer's content policy. The Electron build connects nowhere (`'none'`); the local page opened from Claude
 * Code (`--mode page`, #94) may reach its own server and nothing else: the one exception, recorded in AGENTS.md.
 */
export function contentPolicy({ dev, page }: { dev: boolean; page: boolean }) {
  const connect = dev ? "'self' ws://127.0.0.1:5173" : page ? "'self'" : "'none'";
  return `default-src 'self'; script-src 'self'; style-src 'self'${dev ? " 'unsafe-inline'" : ''}; img-src 'self' data:; font-src 'self'; connect-src ${connect}; object-src 'none'; base-uri 'none'; form-action 'none'`;
}

export default defineConfig(({ command, mode }) => ({
  base: './',
  build: { target: 'es2023' },
  plugins: [{
    name: 'local-content-policy',
    transformIndexHtml(html) {
      const policy = contentPolicy({ dev: command === 'serve', page: mode === 'page' });
      return html.replace('<!-- POLICY -->', `<meta http-equiv="Content-Security-Policy" content="${policy}">`);
    },
  }],
}));
