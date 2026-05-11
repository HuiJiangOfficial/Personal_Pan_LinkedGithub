/**
 * 构建前根据根目录 config.js 生成 web/.env.production（仅写入公开字段）
 * 若不存在 config.js，则保留环境变量中已有的 VITE_*（Cloudflare Pages 构建变量）
 */
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const configPath = join(root, 'config.js');
const webDir = join(root, 'web');
const outFile = join(webDir, '.env.production');

let owner = process.env.VITE_GITHUB_OWNER || '';
let repo = process.env.VITE_GITHUB_REPO || '';
let branch = process.env.VITE_GITHUB_BRANCH || 'main';

if (existsSync(configPath)) {
  const mod = await import(pathToFileURL(configPath).href);
  const c = mod.default || mod;
  owner = c.GITHUB_OWNER || owner;
  repo = c.GITHUB_REPO || repo;
  branch = c.GITHUB_BRANCH || branch;
}

const lines = [
  `VITE_GITHUB_OWNER=${owner}`,
  `VITE_GITHUB_REPO=${repo}`,
  `VITE_GITHUB_BRANCH=${branch}`,
  '',
];

writeFileSync(outFile, lines.join('\n'), 'utf8');
console.log('[sync-web-env] wrote', outFile);
