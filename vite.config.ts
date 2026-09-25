import { defineConfig } from 'vite';

// Relative base: the same build runs under github.io/<repo>/ and at the root of <client_id>.discordsays.com
export default defineConfig({
  base: './',
  server: { host: true, allowedHosts: true },
});
