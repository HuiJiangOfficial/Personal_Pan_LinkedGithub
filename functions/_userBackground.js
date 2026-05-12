/**
 * 用户网盘内个人背景：仅允许写入 .webpan/background/（与仓库级 drive/.webpan 无关）
 */
const MAX_BYTES = 4 * 1024 * 1024;

export const USER_BG_DIR = '.webpan/background';
export const USER_BG_SETTINGS_REL = '.webpan/background/settings.json';

export function pathSegments(relPath) {
  return String(relPath || '')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean);
}

/**
 * 禁止通过通用上传 / raw / 删除 访问网盘内任意 `.webpan/**`（含背景素材）。
 * 背景仅允许由 `/api/drive-background` 在服务端按会话写入，避免绕过鉴权或路径猜测。
 */
export function isForbiddenUserWebpanPath(relPath) {
  return pathSegments(relPath).some((s) => s.toLowerCase() === '.webpan');
}

/** 主文件列表中隐藏用户 .webpan 下内容（含背景素材） */
export function isHiddenFromUserDriveList(relPath) {
  return pathSegments(relPath).some((s) => s.toLowerCase() === '.webpan');
}

export function defaultBackgroundSettings() {
  return {
    version: 1,
    overlayOpacity: 0.32,
    blurPx: 2,
    imageExt: null,
    updatedAt: null,
  };
}

/** @param {Uint8Array} bytes */
export function detectBackgroundImage(bytes) {
  if (bytes.byteLength < 8) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { ext: 'gif', mime: 'image/gif' };
  }
  return null;
}

export function bgBlobRel(ext) {
  const e = String(ext || '').toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'gif'].includes(e)) return null;
  const file = e === 'jpeg' ? 'jpg' : e;
  return `${USER_BG_DIR}/bg.${file}`;
}

export function clampOverlay(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0.32;
  return Math.min(0.78, Math.max(0.08, x));
}

export function clampBlur(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 2;
  return Math.min(20, Math.max(0, Math.round(x)));
}

export { MAX_BYTES as USER_BG_MAX_BYTES };
