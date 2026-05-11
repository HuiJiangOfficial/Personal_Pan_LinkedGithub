/**
 * GET /api/raw?path=
 */
import {
  readEnv,
  assertEnv,
  jsonResponse,
  withCors,
  corsHeaders,
  githubFetch,
  normalizeRelativePath,
  guessContentType,
} from '../_utils.js';
import { getSession } from '../_session.js';
import { assertDriveRole, assertGuestPathAllowed, isSystemDrivePath } from '../_authz.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  let bad = assertEnv(cfg);
  if (bad) return attachCors(request, bad);
  if (!cfg.jwtSecret) return attachCors(request, jsonResponse({ error: '未配置 JWT_SECRET' }, 503));

  const session = await getSession(request, env);
  bad = await assertDriveRole(cfg, session);
  if (bad) return attachCors(request, bad);

  const url = new URL(request.url);
  let rel;
  try {
    rel = normalizeRelativePath(url.searchParams.get('path'));
  } catch {
    return attachCors(request, jsonResponse({ error: '非法 path 参数' }, 400));
  }

  if (isSystemDrivePath(rel)) {
    return attachCors(request, jsonResponse({ error: '禁止访问系统路径' }, 403));
  }

  bad = await assertGuestPathAllowed(cfg, session, rel);
  if (bad) return attachCors(request, bad);

  const ghPath = `drive/${rel}`;
  const apiPath = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${ghPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')}?ref=${encodeURIComponent(cfg.branch)}`;

  const ghRes = await githubFetch(cfg, apiPath, {
    headers: { Accept: 'application/vnd.github.raw' },
  });

  if (!ghRes.ok) {
    const errText = await ghRes.text();
    return attachCors(
      request,
      jsonResponse({ error: '读取文件失败', status: ghRes.status, detail: errText.slice(0, 500) }, ghRes.status === 404 ? 404 : 502)
    );
  }

  const disposition = url.searchParams.get('download') === '1' ? 'attachment' : 'inline';
  const filename = rel.split('/').pop() || 'file';
  const headers = new Headers();
  headers.set('Content-Type', guessContentType(rel));
  headers.set('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`);
  headers.set('Cache-Control', 'private, max-age=120');
  Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));

  return new Response(ghRes.body, { status: 200, headers });
}

function attachCors(request, res) {
  return withCors(request, res);
}
