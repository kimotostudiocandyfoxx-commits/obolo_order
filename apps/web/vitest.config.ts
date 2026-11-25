import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// the app's own `@/…` imports (tsconfig paths), so a test can load a module that uses them
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
});
