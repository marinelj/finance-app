import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, 'dist');
const appConfig = JSON.parse(await readFile(path.join(projectRoot, 'app.json'), 'utf8'));
const configuredBase = appConfig.expo?.experiments?.baseUrl ?? '';
const baseUrl = configuredBase
  ? `/${String(configuredBase).replace(/^\/+|\/+$/g, '')}`
  : '';

if (baseUrl.includes('..') || baseUrl.includes('?') || baseUrl.includes('#')) {
  throw new Error(`Invalid experiments.baseUrl: ${configuredBase}`);
}

async function listFiles(directory, parent = '') {
  const entries = await readdir(path.join(directory, parent), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const relative = path.posix.join(parent, entry.name);
      return entry.isDirectory() ? listFiles(directory, relative) : [relative];
    })
  );
  return nested.flat().sort();
}

const files = (await listFiles(outputDirectory)).filter((file) => file !== 'sw.js');
if (!files.includes('index.html') || !files.some((file) => file.endsWith('.wasm'))) {
  throw new Error('Expected an SPA index.html and the Expo SQLite WebAssembly asset in dist/.');
}

const hash = createHash('sha256');
for (const file of files) {
  hash.update(file);
  hash.update(await readFile(path.join(outputDirectory, file)));
}
const buildId = hash.digest('hex').slice(0, 16);
const prefix = baseUrl;
const precacheUrls = files.map((file) => `${prefix}/${file.split('/').map(encodeURIComponent).join('/')}`);

const indexPath = path.join(outputDirectory, 'index.html');
const indexHtml = (await readFile(indexPath, 'utf8')).replaceAll('__FINANCE_BASE_URL__', baseUrl);
await writeFile(indexPath, indexHtml);

const workerPath = path.join(outputDirectory, 'sw.js');
let worker = await readFile(workerPath, 'utf8');
worker = worker
  .replace('__FINANCE_WEB_BUILD_ID__', buildId)
  .replaceAll('__FINANCE_BASE_URL__', baseUrl)
  .replace(
    'const PRECACHE_URLS = []; // __FINANCE_PRECACHE_URLS__',
    `const PRECACHE_URLS = ${JSON.stringify(precacheUrls)};`
  );
await writeFile(workerPath, worker);

console.log(`Finalized Finance web build ${buildId} (${files.length} offline assets, base “${baseUrl || '/'}”).`);
