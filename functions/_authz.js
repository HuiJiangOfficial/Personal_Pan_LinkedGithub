/**
 * 授权：访客路径、系统隐藏路径、用户网盘 .webpan 保护（与 _userBackground 一致）
 */
import { jsonResponse } from './_utils.js';
import { loadUserStore } from './_userStore.js';
import { isForbiddenUserWebpanPath, isHiddenFromUserDriveList } from './_userBackground.js';

export { isForbiddenUserWebpanPath, isHiddenFromUserDriveList };

/**
 * 禁止访问「全局」用户库路径（仓库内 drive/.webpan/system/…）。
 * 用户网盘下的 `.webpan/**`（含背景）禁止走通用 raw/upload/delete，仅能通过 /api/drive-background。
 */
export function isSystemDrivePath(relPath) {
  const p = String(relPath || '').replace(/^\/+/, '').toLowerCase();
  if (p === '.webpan') return true;
  if (p === '.webpan/system' || p.startsWith('.webpan/system/')) return true;
  if (p.includes('/.webpan/system')) return true;
  return false;
}

export function guestMayReadPath(store, relPath) {
  if (!store?.guestPaths?.length) return false;
  const p = String(relPath || '').replace(/^\/+/, '');
  for (const rule of store.guestPaths) {
    const r = String(rule).replace(/^\/+/, '').trim();
    if (!r) continue;
    if (r.endsWith('/*')) {
      const pre = r.slice(0, -2);
      if (p === pre || p.startsWith(pre + '/')) return true;
    } else if (p === r || p.startsWith(r + '/')) return true;
  }
  return false;
}

/** 管理员或普通用户可读写 drive；访客需开启且仅能访问白名单路径 */
export async function assertDriveRole(cfg, session) {
  if (!session?.sub) return jsonResponse({ error: '请先登录' }, 401);
  if (session.role === 'admin' || session.role === 'user') return null;
  if (session.role === 'guest') {
    const { data } = await loadUserStore(cfg);
    if (!data.guestEnabled) return jsonResponse({ error: '访客登录已关闭' }, 403);
    return null;
  }
  return jsonResponse({ error: '无效会话' }, 401);
}

export async function assertGuestPathAllowed(cfg, session, relPath) {
  if (session.role !== 'guest') return null;
  const { data } = await loadUserStore(cfg);
  if (guestMayReadPath(data, relPath)) return null;
  return jsonResponse({ error: '访客无权访问此路径' }, 403);
}

export async function assertNotGuestWrite(session) {
  if (session.role === 'guest') return jsonResponse({ error: '访客只读，无法上传或删除' }, 403);
  return null;
}

export function requireAdmin(session) {
  if (!session?.sub) return jsonResponse({ error: '请先登录' }, 401);
  if (session.role !== 'admin') return jsonResponse({ error: '需要管理员权限' }, 403);
  return null;
}
