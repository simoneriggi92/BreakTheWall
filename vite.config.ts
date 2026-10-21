import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: './',
  build: { target: 'es2023' },
  plugins: [{
    name: 'local-content-policy',
    transformIndexHtml(html) {
      const dev = command === 'serve';
      const policy = `default-src 'self'; script-src 'self'; style-src 'self'${dev ? " 'unsafe-inline'" : ''}; img-src 'self' data:; font-src 'self'; connect-src ${dev ? "'self' ws://127.0.0.1:5173" : "'none'"}; object-src 'none'; base-uri 'none'; form-action 'none'`;
      return html.replace('<!-- POLICY -->', `<meta http-equiv="Content-Security-Policy" content="${policy}">`);
    },
  }],
}));
