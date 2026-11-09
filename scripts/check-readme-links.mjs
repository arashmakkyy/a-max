/**
 * Fails when a README links to a repository file that no longer exists.
 * Only local (relative) targets are checked; URLs and anchors are skipped.
 *
 * Usage: node scripts/check-readme-links.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const READMES = ['README.md', 'README.fa.md'];

let checked = 0;
const missing = [];

for (const name of READMES) {
  const source = readFileSync(join(root, name), 'utf8');
  const targets = new Set();
  for (const match of source.matchAll(/\]\(([^)\s]+)\)/g)) targets.add(match[1]);
  for (const match of source.matchAll(/src="([^"]+)"/g)) targets.add(match[1]);

  for (const target of targets) {
    if (/^(https?:|mailto:|#)/i.test(target)) continue;
    const local = decodeURIComponent(target.split('#')[0].split('?')[0]);
    if (!local) continue;
    checked += 1;
    if (!existsSync(normalize(join(root, local)))) missing.push(`${name} -> ${target}`);
  }
}

if (missing.length) {
  console.error(`✗ ${missing.length} broken local link(s):\n${missing.map(item => `  ${item}`).join('\n')}`);
  process.exit(1);
}

console.log(`✓ ${checked} local README links and images resolve.`);
