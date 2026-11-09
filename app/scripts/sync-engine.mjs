/**
 * Copies the shared export engine (used by the content script as well) into
 * public/engine so the built extension pages can load real DOCX/PNG support
 * without duplicating the sources inside app/.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const srcEngine = path.resolve(appRoot, '..', 'src', 'engine');
const bridge = path.resolve(appRoot, '..', 'src', 'shared', 'engine-bridge.js');
const outDir = path.resolve(appRoot, 'public', 'engine');

const ENGINE_FILES = ['util.js', 'extract.js', 'sites.js', 'format.js', 'zip.js', 'docx.js', 'image.js', 'bundle.js'];

mkdirSync(outDir, { recursive: true });

for (const file of ENGINE_FILES) {
  const from = path.join(srcEngine, file);
  if (!existsSync(from)) throw new Error(`[sync-engine] missing engine file: ${from}`);
  copyFileSync(from, path.join(outDir, file));
}

if (!existsSync(bridge)) throw new Error(`[sync-engine] missing bridge file: ${bridge}`);
copyFileSync(bridge, path.join(outDir, 'engine-bridge.js'));

console.log(`[sync-engine] synced ${ENGINE_FILES.length + 1} files → public/engine`);
