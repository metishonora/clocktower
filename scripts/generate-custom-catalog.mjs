import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const destination = new URL('../web/src/custom/generated/characterCatalog.json', import.meta.url);
const catalog = JSON.parse(execFileSync('cargo', ['run', '--quiet', '-p', 'clocktower-custom-domain', '--example', 'export_catalog'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const output = `${JSON.stringify(catalog, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== output) throw new Error('Custom catalog is stale; run node scripts/generate-custom-catalog.mjs');
} else {
  mkdirSync(new URL('../web/src/custom/generated/', import.meta.url), { recursive: true });
  writeFileSync(destination, output);
}
