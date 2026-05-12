/**
 * POST /api/upload
 */
import {
  readEnv,
  assertEnv,
  jsonResponse,
  withCors,
  githubFetch,
  normalizeRelativePath,
  uint8ToBase64,
  githubErrorBody,
  CACHE_PRIVATE_NO_STORE,
} from '../_utils.js';
import { getSession } from '../_session.js';
import { assertDriveRole, assertNotGuestWrite, isSystemDrivePath } from '../_authz.js';
import { sessionDriveSub, toGithubUserDrivePath } from '../_driveScope.js';

const MAX_BYTES = 45 * 1024 * 1024;

function buildRelativeSavePath(pathField, originalName) {
  if (typeof pathField !== 'string' || !pathField.trim()) {
    return originalName;
  }
  const p = pathField.trim().replace(/\\/g, '/');
  if (p.endsWith('/')) {
    return `${p}${originalName}`;
  }
  const base = p.split('/').pop() || '';
  if (base && !base.includes('.')) {
    return `${p.replace(/\/+$/, '')}/${originalName}`;
  }
  return p;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  let bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);
  if (!cfg.jwtSecret) return withCors(request, jsonResponse({ error: '未配置 JWT_SECRET' }, 503));

  const session = await getSession(request, env);
  bad = await assertDriveRole(cfg, session);
  if (bad) return withCors(request, bad);
  bad = await assertNotGuestWrite(session);
  if (bad) return withCors(request, bad);
  if (!sessionDriveSub(session)) return withCors(request, jsonResponse({ error: '无效会话' }, 401));

  const ct = request.headers.get('Content-Type') || '';
  if (!ct.includes('multipart/form-data')) {
    return withCors(request, jsonResponse({ error: '请使用 multipart/form-data 上传' }, 400));
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return withCors(request, jsonResponse({ error: '无法解析表单' }, 400));
  }

  const file = form.get('file');
  const pathField = form.get('path');

  if (!file || typeof file === 'string') {
    return withCors(request, jsonResponse({ error: '缺少 file 字段' }, 400));
  }

  /** @type {File} */
  const f = file;
  const buf = new Uint8Array(await f.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return withCors(request, jsonResponse({ error: `文件过大，请小于 ${Math.floor(MAX_BYTES / 1024 / 1024)} MB` }, 413));
  }

  let relative;
  try {
    const sub = buildRelativeSavePath(pathField, f.name);
    relative = normalizeRelativePath(sub);
  } catch {
    return withCors(request, jsonResponse({ error: '非法保存路径' }, 400));
  }

  if (isSystemDrivePath(relative)) {
    return withCors(request, jsonResponse({ error: '禁止上传到系统目录' }, 403));
  }

  let ghPath;
  try {
    ghPath = toGithubUserDrivePath(session, relative);
  } catch {
    return withCors(request, jsonResponse({ error: '非法保存路径' }, 400));
  }
  const ghSegments = ghPath.split('/').filter(Boolean).map((s) => encodeURIComponent(s));
  const putUrl = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${ghSegments.join('/')}`;

  const metaRes = await githubFetch(cfg, `${putUrl}?ref=${encodeURIComponent(cfg.branch)}`);
  let existingSha = null;
  if (metaRes.ok) {
    try {
      const meta = await metaRes.json();
      if (meta && meta.sha) existingSha = meta.sha;
    } catch {
      /* ignore */
    }
  } else if (metaRes.status !== 404) {
    const detail = await githubErrorBody(metaRes);
    return withCors(request, jsonResponse({ error: '检查目标文件是否存在时失败', detail, status: metaRes.status }, 502));
  }

  const content = uint8ToBase64(buf);
  const body = {
    message: `web: upload ${relative}`,
    content,
    branch: cfg.branch,
  };
  if (existingSha) body.sha = existingSha;

  const putRes = await githubFetch(cfg, putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const detail = await githubErrorBody(putRes);
    return withCors(request, jsonResponse({ error: '上传到 GitHub 失败', detail, status: putRes.status }, 502));
  }

  let json;
  try {
    json = await putRes.json();
  } catch {
    json = null;
  }

  return withCors(
    request,
    jsonResponse(
      {
        ok: true,
        path: relative,
        content: json?.content || null,
      },
      200,
      CACHE_PRIVATE_NO_STORE
    )
  );
}
