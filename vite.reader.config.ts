// Builds only the reader demo (and copies the generated reader data next to it): a self-contained page for
// verifying src/reader without the globe. `npm run reader:demo` -> dist-reader/
import { defineConfig, type Plugin } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function readerData(): Plugin {
  return {
    name: 'reader-data',
    apply: 'build',
    closeBundle() {
      const from = resolve(__dirname, 'public/data/reader');
      if (!existsSync(from)) throw new Error('public/data/reader is missing: run npm run reader:data first');
      cpSync(from, resolve(__dirname, 'dist-reader/data/reader'), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [readerData()],
  publicDir: false,
  build: { outDir: 'dist-reader', emptyOutDir: true, rollupOptions: { input: { demo: resolve(__dirname, 'reader-demo.html') } } },
});
