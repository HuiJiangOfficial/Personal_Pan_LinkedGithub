/**
 * DELETE /api/file?path=相对于 drive 的文件路径
 * 删除 GitHub 仓库中的文件（需先查询 sha）
 */
import {
  readEnv,
  assertEnv,
  checkPassword,
  jsonResponse,
  corsHeaders,
  githubFetch,
  normalizeRelativePath,
  githubErrorBody,
} from '../_utils.js';

export async function onRequestDelete(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const bad = assertEnv(cfg) || checkPassword(request, cfg);
  if (bad) return attachCors(request, bad);

  const url = new URL(request.url);
  let rel;
  try {
    rel = normalizeRelativePath(url.searchParams.get('path'));
  } catch {
    return attachCors(request, jsonResponse({ error: '非法 path 参数' }, 400));
  }

  const ghPath = `drive/${rel}`;
  const apiPath = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${ghPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')}?ref=${encodeURIComponent(cfg.branch)}`;

  const getRes = await githubFetch(cfg, apiPath);
  if (!getRes.ok) {
    const detail = await githubErrorBody(getRes);
    return attachCors(
      request,
      jsonResponse({ error: '获取文件元数据失败', detail, status: getRes.status }, getRes.status)
    );
  }

  let meta;
  try {
    meta = await getRes.json();
  } catch {
    return attachCors(request, jsonResponse({ error: '解析元数据失败' }, 502));
  }
  if (!meta?.sha) {
    return attachCors(request, jsonResponse({ error: '缺少文件 sha' }, 502));
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
    return attachCors(
      request,
      jsonResponse({ error: '删除失败', detail, status: delRes.status }, 502)
    );
  }

  return attachCors(request, jsonResponse({ ok: true, path: rel }));
}

/** @param {Request} request @param {Response} res */
function attachCors(request, res) {
  const h = new Headers(res.headers);
  Object.entries(corsHeaders(request)).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: res.status, headers: h });
}
