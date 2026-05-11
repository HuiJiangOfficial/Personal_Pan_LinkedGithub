/**
 * 前端可见配置（来自构建时环境变量，由根目录 config.js 经 scripts/sync-web-env.mjs 同步）
 * 请勿在此文件写入 Token；密钥仅在 Cloudflare / .dev.vars 中配置。
 */
export const publicConfig = {
  owner: import.meta.env.VITE_GITHUB_OWNER || '',
  repo: import.meta.env.VITE_GITHUB_REPO || '',
  branch: import.meta.env.VITE_GITHUB_BRANCH || 'main',
};
