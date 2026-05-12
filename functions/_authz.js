/**
 * 授权：访客路径、系统隐藏路径、用户网盘背景路径保护
 */
import { jsonResponse } from './_utils.js';
import { loadUserStore } from './_userStore.js';

/**
 * 禁止访问「全局」用户库路径（仓库内 drive/.webpan/system/…）。
 * 用户自己网盘下的 .webpan/background/ 由 isForbiddenUserWebpanPath 另行约束，不在此函数拦截。
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
  const p = String(relPath || '').replace(/^\/+/, '');
  // 允许访客读取背景配置（如果需求允许访客看默认背景或自己的访客背景）
  // 但通常背景是私有的，这里根据 api/drive-background.js 的逻辑，访客可以 GET 自己的背景
  if (p === '.webpan/background' || p.startsWith('.webpan/background/')) return null;
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

/**
 * 以下函数用于保护用户网盘内的 .webpan 目录（除 background 外）
 * 并控制列表显示
 */

function pathSegments(relPath) {
  return String(relPath || '')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean);
}

/** 禁止用户通过通用上传/读写访问的 .webpan 路径（除 .webpan/background 外） */
export function isForbiddenUserWebpanPath(relPath) {
  const parts = pathSegments(relPath);
  const i = parts.findIndex((s) => s.toLowerCase() === '.webpan');
  if (i === -1) return false;
  const next = parts[i + 1];
  if (next && next.toLowerCase() === 'background') return false;
  return true;
}

/** 主文件列表中隐藏用户 .webpan 下内容（含背景素材） */
export function isHiddenFromUserDriveList(relPath) {
  return pathSegments(relPath).some((s) => s.toLowerCase() === '.webpan');
}