import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

/** Lets a page hand a recording of itself back to disk, during `vite dev` only.
 *
 * The walkthrough, the journey scenes and the globe are all canvases, and the
 * useful thing to do with one — send it to a video model, put a frame in a
 * document, check a render frame by frame — starts with having the bytes in a
 * file. A browser cannot write one: downloads are blocked in an embedded pane,
 * and streaming a blob out through a tool's return value costs more than the
 * recording is worth. So the page POSTs it here and this writes it.
 *
 * `apply: 'serve'` keeps it out of every build. It writes only inside
 * `recordings/`, which is gitignored, and only ever writes — nothing here reads
 * or lists the disk.
 */
function recorder(): Plugin {
  return {
    name: 'recorder',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__capture', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        // One path segment, no dots: a name, never a path.
        const name = decodeURIComponent((req.url ?? '').replace(/^\//, '')).trim();
        if (!/^[A-Za-z0-9_-]+\.(webm|mp4|png|jpg|jpeg)$/.test(name)) {
          res.statusCode = 400; res.end('bad name'); return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const body = Buffer.concat(chunks);
          mkdirSync(resolve(__dirname, 'recordings'), { recursive: true });
          writeFileSync(resolve(__dirname, 'recordings', name), body);
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: true, name, bytes: body.length }));
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [recorder()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tabernacle: resolve(__dirname, 'tabernacle.html'),
        temple: resolve(__dirname, 'temple.html'),
        ark: resolve(__dirname, 'ark.html'),
        figures: resolve(__dirname, 'figures.html'),
        plan: resolve(__dirname, 'plan.html'),
        crowd: resolve(__dirname, 'crowd-test.html'),
        springs: resolve(__dirname, 'figures-springs.html'),
        voxel: resolve(__dirname, 'voxel.html'),
        lowpoly: resolve(__dirname, 'lowpoly.html'),
        arkBlender: resolve(__dirname, 'ark-blender.html'),
        rigTest: resolve(__dirname, 'rig-test.html'),
      },
    },
  },
});
