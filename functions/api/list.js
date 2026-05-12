/**
 * GET /api/list
 * 需登录；访客仅能看到 guestPaths 白名单内文件；隐藏 .webpan；可按设置隐藏 .gitkeep
 */
import { readEnv, assertEnv, jsonResponse, withCors, githubFetch, githubErrorBody } from '../_utils.js';
import { getSession } from '../_session.js';
import { assertDriveRole, isSystemDrivePath, guestMayReadPath } from '../_authz.js';
import { loadUserStore } from '../_userStore.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  let bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);
  if (!cfg.jwtSecret) return withCors(request, jsonResponse({ error: '未配置 JWT_SECRET，无法使用网盘' }, 503));

  const session = await getSession(request, env);
  bad = await assertDriveRole(cfg, session);
  if (bad) return withCors(request, bad);

  try {
    const { data: store } = await loadUserStore(cfg);
    const guestStore = session.role === 'guest' ? store : null;
    const hideGitkeep = store.ignoreGitkeep !== false;

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
      return withCors(request, jsonResponse({ error: '无法读取目录树', detail, status: treeRes.status }, treeRes.status));
    }
    const treeJson = await treeRes.json();
    const truncated = Boolean(treeJson.truncated);
    /** @type {{ path: string, type: string, sha?: string, size?: number }[]} */
    const tree = Array.isArray(treeJson.tree) ? treeJson.tree : [];

    const prefix = 'drive/';
    let files = tree
      .filter((n) => n.type === 'blob' && typeof n.path === 'string' && n.path.startsWith(prefix))
      .map((n) => {
        const rel = n.path.slice(prefix.length);
        return {
          name: n.path.split('/').pop(),
          path: rel,
          sha: n.sha,
          size: typeof n.size === 'number' ? n.size : null,
          type: 'file',
        };
      })
      .filter((f) => !isSystemDrivePath(f.path));

    if (hideGitkeep) {
      files = files.filter((f) => f.name !== '.gitkeep');
    }

    if (session.role === 'guest' && guestStore) {
      files = files.filter((f) => guestMayReadPath(guestStore, f.path));
    }

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
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500));
  }
}
