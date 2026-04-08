import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

mkdirSync(join(root, 'dist'), { recursive: true });

await esbuild.build({
  entryPoints: [join(root, 'src', 'main.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  outdir: join(root, 'dist'),
  splitting: true,
  platform: 'browser',
});

await esbuild.build({
  entryPoints: [join(root, 'src', 'gif-export-worker.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: join(root, 'dist', 'gif-export-worker.js'),
  platform: 'browser',
});

await esbuild.build({
  entryPoints: [join(root, 'assets', 'styles.css')],
  minify: true,
  outfile: join(root, 'assets', 'styles.min.css'),
});
