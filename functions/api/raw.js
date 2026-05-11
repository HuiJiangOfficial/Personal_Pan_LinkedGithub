/**
 * GET /api/raw?path=相对于 drive 的文件路径
 * 代理 GitHub 文件原始内容，便于私有仓库预览与下载
 */
import {
  readEnv,
  assertEnv,
  checkPassword,
  jsonResponse,
  corsHeaders,
  githubFetch,
  normalizeRelativePath,
  guessContentType,
} from '../_utils.js';

export async function onRequestGet(context) {
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

  const ghRes = await githubFetch(cfg, apiPath, {
    headers: { Accept: 'application/vnd.github.raw' },
  });

  if (!ghRes.ok) {
    const errText = await ghRes.text();
    return attachCors(
      request,
      jsonResponse(
        { error: '读取文件失败', status: ghRes.status, detail: errText.slice(0, 500) },
        ghRes.status === 404 ? 404 : 502
      )
    );
  }

  const disposition = url.searchParams.get('download') === '1' ? 'attachment' : 'inline';
  const filename = rel.split('/').pop() || 'file';
  const headers = new Headers();
  headers.set('Content-Type', guessContentType(rel));
  headers.set(
    'Content-Disposition',
    `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  headers.set('Cache-Control', 'private, max-age=120');
  Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));

  return new Response(ghRes.body, { status: 200, headers });
}

/** @param {Request} request @param {Response} res */
function attachCors(request, res) {
  const h = new Headers(res.headers);
  Object.entries(corsHeaders(request)).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: res.status, headers: h });
}
