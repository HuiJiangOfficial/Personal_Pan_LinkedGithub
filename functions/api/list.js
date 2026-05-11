/**
 * GET /api/list
 * 递归列出仓库中 drive/ 下所有文件（GitHub Git Tree API）
 */
import {
  readEnv,
  assertEnv,
  checkPassword,
  jsonResponse,
  corsHeaders,
  githubFetch,
  githubErrorBody,
} from '../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const bad = assertEnv(cfg) || checkPassword(request, cfg);
  if (bad) {
    const h = new Headers(bad.headers);
    Object.entries(corsHeaders(request)).forEach(([k, v]) => h.set(k, v));
    return new Response(bad.body, { status: bad.status, headers: h });
  }

  try {
    const branchRes = await githubFetch(
      cfg,
      `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/branches/${encodeURIComponent(cfg.branch)}`
    );
    if (!branchRes.ok) {
      const detail = await githubErrorBody(branchRes);
      return withCors(
        request,
        jsonResponse(
          { error: `无法读取分支 ${cfg.branch}`, detail, status: branchRes.status },
          branchRes.status >= 400 ? branchRes.status : 502
        )
      );
    }
    const branchJson = await branchRes.json();
    const treeSha = branchJson?.commit?.commit?.tree?.sha;
    if (!treeSha) {
      return withCors(request, jsonResponse({ error: '无法解析分支 tree sha' }, 502));
    }

    const treeRes = await githubFetch(
      cfg,
      `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/git/trees/${treeSha}?recursive=1`
    );
    if (!treeRes.ok) {
      const detail = await githubErrorBody(treeRes);
      return withCors(
        request,
        jsonResponse({ error: '无法读取目录树', detail, status: treeRes.status }, treeRes.status)
      );
    }
    const treeJson = await treeRes.json();
    const truncated = Boolean(treeJson.truncated);
    /** @type {{ path: string, type: string, sha?: string, size?: number }[]} */
    const tree = Array.isArray(treeJson.tree) ? treeJson.tree : [];

    const prefix = 'drive/';
    const files = tree
      .filter((n) => n.type === 'blob' && typeof n.path === 'string' && n.path.startsWith(prefix))
      .map((n) => ({
        name: n.path.split('/').pop(),
        path: n.path.slice(prefix.length),
        sha: n.sha,
        size: typeof n.size === 'number' ? n.size : null,
        type: 'file',
      }));

    return withCors(
      request,
      jsonResponse({
        ok: true,
        branch: cfg.branch,
        truncated,
        files,
      })
    );
  } catch (e) {
    return withCors(
      request,
      jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
    );
  }
}

/** @param {Request} request @param {Response} res */
function withCors(request, res) {
  const h = new Headers(res.headers);
  Object.entries(corsHeaders(request)).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: res.status, headers: h });
}
