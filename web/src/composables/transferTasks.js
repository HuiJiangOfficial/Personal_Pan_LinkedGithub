/**
 * 全局上传/下载传输任务条状态（供 TransferDock 与各页面共用）
 */
import { reactive } from 'vue';

let seq = 0;

export const transferState = reactive({
  /** 是否展开任务列表 */
  expanded: true,
  /** @type {TransferTask[]} */
  tasks: [],
});

/**
 * @typedef {object} TransferTask
 * @property {string} id
 * @property {'upload'|'download'} type
 * @property {string} name
 * @property {'running'|'success'|'error'} status
 * @property {number} percent 0–100；运行中未知总量时可为 0 且 indeterminate=true
 * @property {number} loaded
 * @property {number|null} total
 * @property {boolean} indeterminate
 * @property {string} errorMessage
 */

export function formatTransferBytes(n) {
  if (n == null || !Number.isFinite(Number(n)) || n < 0) return '0 B';
  const x = Number(n);
  if (x < 1024) return `${Math.round(x)} B`;
  if (x < 1024 * 1024) return `${(x / 1024).toFixed(1)} KB`;
  if (x < 1024 * 1024 * 1024) return `${(x / 1024 / 1024).toFixed(1)} MB`;
  return `${(x / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function removeTask(id) {
  const i = transferState.tasks.findIndex((t) => t.id === id);
  if (i >= 0) transferState.tasks.splice(i, 1);
}

/**
 * @param {{ type: 'upload'|'download', name: string }} opts
 * @returns {{
 *   updateProgress: (loaded: number, total?: number | null) => void,
 *   success: () => void,
 *   fail: (msg?: string) => void,
 *   dismiss: () => void,
 * }}
 */
export function createTransferTask({ type, name }) {
  const id = `tr-${++seq}-${Date.now()}`;
  const entry = reactive({
    id,
    type,
    name,
    status: /** @type {'running'|'success'|'error'} */ ('running'),
    percent: 0,
    loaded: 0,
    total: /** @type {number | null} */ (null),
    indeterminate: false,
    errorMessage: '',
    /** 从面板移除（失败任务手动关闭） */
    dismiss() {
      removeTask(id);
    },
  });
  transferState.tasks.push(entry);
  transferState.expanded = true;

  return {
    updateProgress(loaded, total) {
      entry.loaded = loaded;
      if (total != null && total > 0) {
        entry.total = total;
        const p = Math.round((loaded * 100) / total);
        entry.percent = Math.min(99, p);
        entry.indeterminate = false;
      } else {
        entry.total = null;
        entry.percent = 0;
        entry.indeterminate = true;
      }
    },
    success() {
      entry.status = 'success';
      entry.percent = 100;
      entry.indeterminate = false;
      if (entry.total == null && entry.loaded > 0) {
        entry.total = entry.loaded;
      }
      window.setTimeout(() => removeTask(entry.id), 2400);
    },
    fail(msg) {
      entry.status = 'error';
      entry.errorMessage = msg || '操作失败';
      entry.indeterminate = false;
    },
    dismiss: () => entry.dismiss(),
  };
}
