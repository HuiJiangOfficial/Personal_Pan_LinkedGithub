/**
 * 每用户网盘根目录：仓库内 drive/<网盘根名>/，API 层 path 均为相对该根的相对路径。
 * 管理员使用固定根名（与 JWT 中的登录名解耦），避免与普通用户目录同名时共用仓库路径。
 */
import { normalizeRelativePath, githubFetch, githubErrorBody, uint8ToBase64 } from './_utils.js';

/** 管理员专用网盘段（无法通过 USER_RE 注册占用） */
export const ADMIN_DRIVE_ROOT = '__webpan_admin__';

/** @param {{ sub?: string, role?: string }} | null | undefined session */
export function sessionDriveSub(session) {
  if (!session || typeof session !== 'object') return null;
  if (session.role === 'admin') return ADMIN_DRIVE_ROOT;
  const raw = session.sub;
  if (raw == null || typeof raw !== 'string') return null;
  const sub = raw.trim();
  if (!sub || sub.includes('/') || sub.includes('\\')) return null;
  if (sub === '.' || sub === '..') return null;
  if (sub.toLowerCase() === ADMIN_DRIVE_ROOT.toLowerCase()) return null;
  return sub;
}

/**
 * @param {{ sub?: string }} session
 * @param {string} relativePath 相对用户网盘根
 */
export function toGithubUserDrivePath(session, relativePath) {
  const rel = normalizeRelativePath(relativePath);
  const sub = sessionDriveSub(session);
  if (!sub) throw new Error('无效会话');
  return `drive/${sub}/${rel}`;
}

function contentsApiPath(cfg, ghPath) {
  return `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${ghPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')}?ref=${encodeURIComponent(cfg.branch)}`;
}

function contentsPutPath(cfg, ghPath) {
  return `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${ghPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')}`;
}

/** 创建或覆盖仓库中的 blob（用于注册初始化目录等） */
export async function putBlobAtPath(cfg, ghPath, bytes, message) {
  const putUrl = contentsPutPath(cfg, ghPath);
  const metaRes = await githubFetch(cfg, `${putUrl}?ref=${encodeURIComponent(cfg.branch)}`);
  let existingSha = null;
  if (metaRes.ok) {
    try {
      const meta = await metaRes.json();
      if (meta?.sha) existingSha = meta.sha;
    } catch {
      /* ignore */
    }
  } else if (metaRes.status !== 404) {
    const detail = await githubErrorBody(metaRes);
    throw new Error(detail || `meta ${metaRes.status}`);
  }
  const body = {
    message,
    content: uint8ToBase64(bytes),
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
    throw new Error(detail || `put ${putRes.status}`);
  }
}

export async function deleteBlobAtPath(cfg, ghPath) {
  const apiPath = contentsApiPath(cfg, ghPath);
  const getRes = await githubFetch(cfg, apiPath);
  if (getRes.status === 404) return { ok: true, skipped: true };
  if (!getRes.ok) {
    const detail = await githubErrorBody(getRes);
    throw new Error(detail || `get ${getRes.status}`);
  }
  let meta;
  try {
    meta = await getRes.json();
  } catch {
    throw new Error('解析元数据失败');
  }
  if (!meta?.sha) throw new Error('缺少文件 sha');
  const delRes = await githubFetch(cfg, apiPath, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `web: delete ${ghPath}`,
      sha: meta.sha,
      branch: cfg.branch,
    }),
  });
  if (!delRes.ok) {
    const detail = await githubErrorBody(delRes);
    throw new Error(detail || `delete ${delRes.status}`);
  }
  return { ok: true };
}

/**
 * 删除 drive/<username>/ 下所有 blob（用于管理员删用户）
 * @returns {Promise<number>} 删除的文件数
 */
export async function deleteAllBlobsUnderUserPrefix(cfg, username) {
  const u = String(username || '').trim();
  if (!u || u.includes('/') || u.toLowerCase() === 'guest') return 0;
  const prefix = `drive/${u}/`;

  const branchRes = await githubFetch(
    cfg,
    `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/branches/${encodeURIComponent(cfg.branch)}`
  );
  if (!branchRes.ok) {
    const detail = await githubErrorBody(branchRes);
    throw new Error(detail || `branch ${branchRes.status}`);
  }
  const branchJson = await branchRes.json();
  const treeSha = branchJson?.commit?.commit?.tree?.sha;
  if (!treeSha) throw new Error('无法解析 tree sha');

  const treeRes = await githubFetch(
    cfg,
    `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/git/trees/${treeSha}?recursive=1`
  );
  if (!treeRes.ok) {
    const detail = await githubErrorBody(treeRes);
    throw new Error(detail || `tree ${treeRes.status}`);
  }
  const treeJson = await treeRes.json();
  const tree = Array.isArray(treeJson.tree) ? treeJson.tree : [];
  const paths = tree
    .filter((n) => n.type === 'blob' && typeof n.path === 'string' && n.path.startsWith(prefix))
    .map((n) => n.path);

  let n = 0;
  for (const ghPath of paths) {
    await deleteBlobAtPath(cfg, ghPath);
    n++;
  }
  return n;
}
