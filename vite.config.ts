import { defineConfig, type Plugin } from 'vite';
import { resolve, join } from 'node:path';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';

function recorder(): Plugin {
  return {
    name: 'recorder',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__capture', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
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

/** Copies public/ (excluding external symlinks and unshipped raw test GLBs)
 *  and merges t7-web-stage/ into dist/ so builds are 100% self-contained. */
function stagePublicPlugin(): Plugin {
  const skipRel = new Set([
    'models/tripo-test',
    'models/ark/tripo/lamb-source.glb',
    'models/ark/tripo/prompts.json',
  ]);

  function copyTree(srcDir: string, destDir: string, relBase = '') {
    if (!existsSync(srcDir)) return;
    mkdirSync(destDir, { recursive: true });
    for (const entry of readdirSync(srcDir)) {
      if (entry === '.DS_Store') continue;
      const rel = relBase ? `${relBase}/${entry}` : entry;
      if (skipRel.has(rel)) continue;
      const srcPath = join(srcDir, entry);
      const destPath = join(destDir, entry);
      const st = lstatSync(srcPath);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        copyTree(srcPath, destPath, rel);
      } else if (st.isFile()) {
        cpSync(srcPath, destPath);
      }
    }
  }

  return {
    name: 'stage-public',
    apply: 'build',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      copyTree(resolve(__dirname, 'public'), distDir);
      copyTree(resolve(__dirname, 't7-web-stage'), distDir);
    },
  };
}

export default defineConfig({
  plugins: [recorder(), stagePublicPlugin()],
  build: {
    copyPublicDir: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        bible: resolve(__dirname, 'bible.html'),
        scenes: resolve(__dirname, 'scenes.html'),
        tabernacle: resolve(__dirname, 'tabernacle.html'),
        temple: resolve(__dirname, 'temple.html'),
        ark: resolve(__dirname, 'ark.html'),
        sceneAssembly: resolve(__dirname, 'scene-assembly.html'),
        previewArk: resolve(__dirname, 'previews/noahs-ark-v01/index.html'),
        previewTabernacle: resolve(__dirname, 'previews/moses-tabernacle-v04/index.html'),
        previewTemple: resolve(__dirname, 'previews/solomon-temple-v02/index.html'),
        figures: resolve(__dirname, 'figures.html'),
        plan: resolve(__dirname, 'plan.html'),
        crowd: resolve(__dirname, 'crowd-test.html'),
        springs: resolve(__dirname, 'figures-springs.html'),
        voxel: resolve(__dirname, 'voxel.html'),
        lowpoly: resolve(__dirname, 'lowpoly.html'),
        arkBlender: resolve(__dirname, 'ark-blender.html'),
        rigTest: resolve(__dirname, 'rig-test.html'),
        elephantStudy: resolve(__dirname, 'elephant-3d.html'),
      },
    },
  },
});
