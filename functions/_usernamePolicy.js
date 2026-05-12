/**
 * 与网盘目录名、会话角色冲突的用户名不可注册或由管理员创建。
 */
import { ADMIN_DRIVE_ROOT } from './_driveScope.js';

/**
 * @param {string} username
 * @param {string | undefined} adminUsername 环境变量 ADMIN_USERNAME，缺省为 admin
 */
export function isReservedUsername(username, adminUsername) {
  const u = String(username || '').trim().toLowerCase();
  if (!u) return true;
  if (u === 'guest') return true;
  const admin = String(adminUsername ?? 'admin').trim().toLowerCase();
  if (admin && u === admin) return true;
  if (u === ADMIN_DRIVE_ROOT.toLowerCase()) return true;
  return false;
}
