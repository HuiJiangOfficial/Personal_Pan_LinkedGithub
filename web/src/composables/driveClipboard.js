import { reactive, computed } from 'vue';

/**
 * 网盘内部剪贴板（复制 / 剪切），用于在目录间粘贴；非系统剪贴板 API。
 * @typedef {{ path: string, name: string, size?: number | null, sha?: string | null }} DriveClipItem
 */

export const driveClipboard = reactive({
  /** @type {'copy' | 'cut' | null} */
  mode: null,
  /** @type {DriveClipItem[]} */
  items: [],
});

export const driveClipboardLabel = computed(() => {
  const n = driveClipboard.items.length;
  if (!n || !driveClipboard.mode) return '';
  const verb = driveClipboard.mode === 'cut' ? '剪切' : '复制';
  return n === 1 ? `已${verb}：${driveClipboard.items[0].name}` : `已${verb} ${n} 项`;
});

export const hasDriveClipboard = computed(() => driveClipboard.items.length > 0 && driveClipboard.mode != null);

/** @param {'copy'|'cut'} mode @param {DriveClipItem[]} items */
export function setDriveClipboard(mode, items) {
  const list = (items || []).filter((x) => x && x.path && x.name);
  if (!list.length) {
    clearDriveClipboard();
    return;
  }
  driveClipboard.mode = mode;
  driveClipboard.items = list.map((x) => ({
    path: x.path,
    name: x.name,
    size: x.size ?? null,
    sha: x.sha ?? null,
  }));
}

export function clearDriveClipboard() {
  driveClipboard.mode = null;
  driveClipboard.items = [];
}
