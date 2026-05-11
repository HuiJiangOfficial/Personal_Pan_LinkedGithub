/**
 * 通用工具：环境变量读取、CORS、密码校验、GitHub 请求封装
 */

/** @param {Record<string, string | undefined>} env Cloudflare 绑定环境变量 */
export function readEnv(env) {
  const owner = env.GITHUB_OWNER || '';
  const repo = env.GITHUB_REPO || '';
  const branch = env.GITHUB_BRANCH || 'main';
  const token = env.GITHUB_TOKEN || '';
  const password = env.SITE_PASSWORD || '';
  return { owner, repo, branch, token, password };
}

export function assertEnv(cfg) {
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    return jsonResponse(
      {
        error:
          '服务端未配置 GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN。请检查 wrangler.toml 的 [vars] 是否已填写仓库信息，并在控制台「机密」或 wrangler pages secret 中设置 GITHUB_TOKEN；本地可用 .dev.vars。',
      },
      500
    );
  }
  return null;
}

/**
 * 若设置了 SITE_PASSWORD，则校验请求头
 * 支持：X-Site-Password 或 Authorization: Bearer <密码>
 */
export function checkPassword(request, cfg) {
  if (!cfg.password) return null;
  const headerPwd = request.headers.get('X-Site-Password') || '';
  const auth = request.headers.get('Authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const provided = headerPwd || bearer;
  if (provided !== cfg.password) {
    return jsonResponse({ error: '未授权：访问密码错误或缺失' }, 401);
  }
  return null;
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

/** @param {Request} request */
export function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Site-Password, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** 防止路径穿越；返回相对于 drive 的路径（不含 drive/ 前缀） */
export function normalizeRelativePath(raw) {
  const s = String(raw || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();
  if (!s || s.includes('..')) {
    throw new Error('非法路径');
  }
  return s;
}

export function driveBlobPath(relativePath) {
  const rel = normalizeRelativePath(relativePath);
  return `drive/${rel}`;
}

const GITHUB_API = 'https://api.github.com';

export async function githubFetch(cfg, pathAndQuery, init = {}) {
  const url = pathAndQuery.startsWith('http') ? pathAndQuery : `${GITHUB_API}${pathAndQuery}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'CloudflarePages-GithubWebPan',
    Authorization: `Bearer ${cfg.token}`,
    ...(init.headers || {}),
  };
  return fetch(url, { ...init, headers });
}

export async function githubErrorBody(res) {
  try {
    const t = await res.text();
    return t.slice(0, 2000);
  } catch {
    return '';
  }
}

export function guessContentType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  /** @type {Record<string, string>} */
  const map = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    pdf: 'application/pdf',
    txt: 'text/plain; charset=utf-8',
    md: 'text/markdown; charset=utf-8',
    json: 'application/json; charset=utf-8',
    csv: 'text/csv; charset=utf-8',
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    ts: 'text/typescript; charset=utf-8',
    css: 'text/css; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

/** Uint8Array -> base64（适用于 Workers 运行时） */
export function uint8ToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  const chunk = 0x8000;
  for (let i = 0; i < len; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
