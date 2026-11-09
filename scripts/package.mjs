/**
 * Builds the installable extension package.
 *
 * Only runtime files go into `release/a-max-<version>/` and the matching ZIP:
 * `app/`, `docs/`, `reference/`, `node_modules/` and the packing scripts are
 * development-only and would otherwise be shipped (and rejected by the store
 * review for containing unreferenced code).
 *
 * Usage: npm run package
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseRoot = join(root, 'release');

/** Required runtime entries; every one must exist before packaging. */
// Verification reports are repository-only on purpose: they quote the SHA-256 of
// the archive, so shipping them inside it would make the documented hash stale
// the moment the files changed.
const ENTRIES = ['manifest.json', 'dist', 'icons', 'src', '_locales', 'LICENSE', 'README.md'];

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exitCode = 1;
  throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readVersion(file) {
  const source = readFileSync(file, 'utf8');
  const match = source.match(/APP_VERSION(?:\s*=\s*|\s*:\s*)['"]([^'"]+)['"]/) || source.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
  return match ? match[1] : '';
}

/** All version declarations must agree before a package is produced. */
function verifyVersions() {
  const manifest = readJson(join(root, 'manifest.json'));
  const pkg = readJson(join(root, 'package.json'));
  const appPkg = readJson(join(root, 'app', 'package.json'));
  const uiVersion = readVersion(join(root, 'app', 'src', 'lib', 'version.ts'));
  const engineVersion = readVersion(join(root, 'src', 'engine', 'format.js'));
  const versions = {
    manifest: manifest.version,
    'package.json': pkg.version,
    'app/package.json': appPkg.version,
    'app/src/lib/version.ts': uiVersion,
    'src/engine/format.js': engineVersion,
  };
  const unique = new Set(Object.values(versions));
  if (unique.size !== 1 || ![...unique][0]) {
    fail(`Version mismatch:\n${Object.entries(versions).map(([k, v]) => `  ${k}: ${v || '(missing)'}`).join('\n')}`);
  }
  return [...unique][0];
}

function verifyRuntime(version) {
  for (const entry of ENTRIES) {
    if (!existsSync(join(root, entry))) fail(`Missing required entry: ${entry}`);
  }
  const required = [
    'dist/index.html',
    'dist/engine/engine-bridge.js',
    'dist/engine/format.js',
    'dist/engine/docx.js',
    'dist/engine/image.js',
    'src/background/service-worker.js',
    'src/content/content.js',
  ];
  for (const file of required) {
    if (!existsSync(join(root, file))) fail(`Missing build output: ${file} (run "npm run build" in app/)`);
  }
  const manifest = readJson(join(root, 'manifest.json'));
  if (manifest.version !== version) fail('manifest.json changed during packaging');
}

async function collect(dir, list = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await collect(full, list);
    else if (entry.isFile()) list.push(full);
  }
  return list;
}

function copyTree(from, to) {
  const stat = statSync(from);
  if (stat.isFile()) {
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, readFileSync(from));
    return;
  }
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) copyTree(source, target);
    else if (entry.isFile()) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(source));
    }
  }
}

/* ------------------------------- ZIP (deflate) ------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosStamp(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  const day = (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time, day };
}

function buildZip(files) {
  const stamp = dosStamp();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name.split(sep).join('/'), 'utf8');
    const data = readFileSync(file.path);
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, compressed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(stamp.time, 12);
    entry.writeUInt16LE(stamp.day, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(compressed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt16LE(0, 30);
    entry.writeUInt16LE(0, 32);
    entry.writeUInt16LE(0, 34);
    entry.writeUInt16LE(0, 36);
    entry.writeUInt32LE(0, 38);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, directory, end]);
}

/* ---------------------------------- main ---------------------------------- */

const version = verifyVersions();
verifyRuntime(version);

if (process.argv.includes('--verify-only')) {
  console.log(`✓ Version ${version} is consistent and all runtime files are present.`);
  process.exit(0);
}

const outDir = join(releaseRoot, `a-max-${version}`);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const entry of ENTRIES) {
  const source = join(root, entry);
  const target = join(outDir, entry);
  if (statSync(source).isDirectory()) copyTree(source, target);
  else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(source));
  }
}

const files = await collect(outDir);
for (const file of files) {
  const rel = relative(outDir, file);
  if (rel.startsWith('..') || rel.includes(`node_modules${sep}`)) fail(`Unexpected file in package: ${rel}`);
}

const zipName = `a-max-${version}.zip`;
const zipBuffer = buildZip(files.map(file => ({ name: relative(outDir, file), path: file })));
writeFileSync(join(releaseRoot, zipName), zipBuffer);

const digest = createHash('sha256').update(zipBuffer).digest('hex');
writeFileSync(join(releaseRoot, `${zipName}.sha256`), `${digest}  ${zipName}\n`);

console.log(`✓ A.max ${version}`);
console.log(`  folder : ${relative(root, outDir)} (${files.length} files)`);
console.log(`  archive: ${relative(root, join(releaseRoot, zipName))} (${(zipBuffer.length / 1024).toFixed(1)} KB)`);
console.log(`  sha256 : ${digest}`);
