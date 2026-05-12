/**
 * 用户与访客策略存储在 GitHub 单文件 users.json
 */
import { githubFetch, githubErrorBody, uint8ToBase64 } from './_utils.js';
import { USERS_BLOB_PATH } from './_paths.js';

export function defaultUserStore() {
  return {
    version: 1,
    guestEnabled: false,
    guestPaths: /** @type {string[]} */ ([]),
    allowRegistration: true,
    /** 为 true 时列表 API 不返回名为 .gitkeep 的文件（目录占位） */
    ignoreGitkeep: true,
    users: /** @type {{ username: string, role: 'user', salt: string, hash: string, iterations?: number, createdAt: string }[]} */ ([]),
  };
}

function segmentsGithub(path) {
  return path
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join('/');
}

/** @param {any} cfg */
export async function loadUserStore(cfg) {
  const apiPath = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${segmentsGithub(
    USERS_BLOB_PATH
  )}?ref=${encodeURIComponent(cfg.branch)}`;
  const res = await githubFetch(cfg, apiPath);
  if (res.status === 404) {
    return { data: defaultUserStore(), sha: null };
  }
  if (!res.ok) {
    const detail = await githubErrorBody(res);
    throw new Error(detail || `读取用户数据失败 ${res.status}`);
  }
  const meta = await res.json();
  if (Array.isArray(meta)) throw new Error('users.json 路径为目录，请删除后重试');
  const raw = atob(String(meta.content || '').replace(/\s/g, ''));
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('users.json 格式错误');
  if (!Array.isArray(data.users)) data.users = [];
  if (!Array.isArray(data.guestPaths)) data.guestPaths = [];
  if (typeof data.ignoreGitkeep !== 'boolean') data.ignoreGitkeep = true;
  return { data, sha: meta.sha };
}

/**
 * @param {any} cfg
 * @param {ReturnType<defaultUserStore>} data
 * @param {string | null} sha
 */
export async function saveUserStore(cfg, data, sha) {
  const json = JSON.stringify(data, null, 2);
  const bytes = new TextEncoder().encode(json);
  const content = uint8ToBase64(bytes);
  const apiPath = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${segmentsGithub(
    USERS_BLOB_PATH
  )}`;
  const body = {
    message: 'webpan: update users/settings',
    content,
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;
  const put = await githubFetch(cfg, apiPath, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!put.ok) {
    const detail = await githubErrorBody(put);
    throw new Error(detail || `保存用户数据失败 ${put.status}`);
  }
  const out = await put.json();
  return out.content?.sha || null;
}

export function findUser(data, username) {
  const u = String(username || '').toLowerCase();
  return data.users.find((x) => String(x.username).toLowerCase() === u);
}
