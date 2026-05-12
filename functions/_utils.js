/**
 * 通用工具：环境变量读取、CORS、GitHub 请求封装
 */

/** @param {Record<string, string | undefined>} env Cloudflare 绑定环境变量 */
export function readEnv(env) {
  const owner = env.GITHUB_OWNER || '';
  const repo = env.GITHUB_REPO || '';
  const branch = env.GITHUB_BRANCH || 'main';
  const token = env.GITHUB_TOKEN || '';
  const jwtSecret = env.JWT_SECRET || '';
  const adminUsername = env.ADMIN_USERNAME || 'admin';
  const adminPassword = env.ADMIN_PASSWORD || '';
  return { owner, repo, branch, token, jwtSecret, adminUsername, adminPassword };
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

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  const h = new Headers();
  h.set('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(extraHeaders)) {
    if (k.toLowerCase() === 'set-cookie') {
      h.append(k, String(v));
    } else {
      h.set(k, String(v));
    }
  }
  return new Response(JSON.stringify(data), { status, headers: h });
}

/** 合并 CORS；extraHeaders 可含 Set-Cookie（须用 append，Workers 中 set 会失效） */
export function withCors(request, response, extraHeaders = {}) {
  let setCookies = [];
  if (typeof response.headers.getSetCookie === 'function') {
    setCookies = response.headers.getSetCookie();
  } else {
    const one = response.headers.get('Set-Cookie');
    if (one) setCookies = [one];
  }

  const h = new Headers(response.headers);
  if (setCookies.length > 0) {
    h.delete('Set-Cookie');
    for (const c of setCookies) {
      h.append('Set-Cookie', c);
    }
  }

  Object.entries(corsHeaders(request)).forEach(([k, v]) => h.set(k, v));
  for (const [k, v] of Object.entries(extraHeaders)) {
    if (k.toLowerCase() === 'set-cookie') {
      h.append(k, String(v));
    } else {
      h.set(k, String(v));
    }
  }
  return new Response(response.body, { status: response.status, headers: h });
}

/** @param {Request} request */
export function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Credentials'] = 'true';
  } else {
    h['Access-Control-Allow-Origin'] = '*';
  }
  return h;
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
