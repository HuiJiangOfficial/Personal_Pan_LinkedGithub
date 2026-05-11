/**
 * DELETE /api/file?path=
 */
import {
  readEnv,
  assertEnv,
  jsonResponse,
  withCors,
  githubFetch,
  normalizeRelativePath,
  githubErrorBody,
} from '../_utils.js';
import { getSession } from '../_session.js';
import { assertDriveRole, assertNotGuestWrite, isSystemDrivePath } from '../_authz.js';

export async function onRequestDelete(context) {
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

  const url = new URL(request.url);
  let rel;
  try {
    rel = normalizeRelativePath(url.searchParams.get('path'));
  } catch {
    return withCors(request, jsonResponse({ error: '非法 path 参数' }, 400));
  }

  if (isSystemDrivePath(rel)) {
    return withCors(request, jsonResponse({ error: '禁止删除系统路径' }, 403));
  }

  const ghPath = `drive/${rel}`;
  const apiPath = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${ghPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')}?ref=${encodeURIComponent(cfg.branch)}`;

  const getRes = await githubFetch(cfg, apiPath);
  if (!getRes.ok) {
    const detail = await githubErrorBody(getRes);
    return withCors(request, jsonResponse({ error: '获取文件元数据失败', detail, status: getRes.status }, getRes.status));
  }

  let meta;
  try {
    meta = await getRes.json();
  } catch {
    return withCors(request, jsonResponse({ error: '解析元数据失败' }, 502));
  }
  if (!meta?.sha) {
    return withCors(request, jsonResponse({ error: '缺少文件 sha' }, 502));
  }

  const delRes = await githubFetch(cfg, apiPath, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `web: delete ${rel}`,
      sha: meta.sha,
      branch: cfg.branch,
    }),
  });

  if (!delRes.ok) {
    const detail = await githubErrorBody(delRes);
    return withCors(request, jsonResponse({ error: '删除失败', detail, status: delRes.status }, 502));
  }

  return withCors(request, jsonResponse({ ok: true, path: rel }));
}
