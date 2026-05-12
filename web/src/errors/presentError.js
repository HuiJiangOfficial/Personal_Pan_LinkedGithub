import { ElMessageBox, ElNotification } from 'element-plus';
import { ERROR_CATALOG } from './catalog.js';
import { resolveApiError, resolveByCode } from './resolveApiError.js';

const LOG_PREFIX = '[WebPan]';

/**
 * 控制台详细日志（所有经过统一处理的错误均记录）
 */
export function logWebPanError(err, resolved) {
  const payload = {
    code: resolved?.code,
    severity: resolved?.severity,
    title: resolved?.title,
    message: resolved?.message,
    solution: resolved?.solution,
    httpStatus: resolved?.httpStatus,
    url: err?.config?.url,
    method: err?.config?.method,
    responseData: err?.response?.data,
  };
  console.error(LOG_PREFIX, resolved?.code || 'ERROR', payload, err);
}

/**
 * 展示 API/网络错误（弹窗或右下角通知）
 */
export async function presentApiError(err, options = {}) {
  const resolved = resolveApiError(err, options);
  logWebPanError(err, resolved);
  if (resolved.severity === 'silent') return;

  const body = resolved.solution ? `${resolved.message}\n\n【处理建议】\n${resolved.solution}` : resolved.message;

  if (resolved.severity === 'critical') {
    await ElMessageBox.alert(body, resolved.title || '网盘提示', {
      type: 'error',
      confirmButtonText: '我知道了',
      dangerouslyUseHTMLString: false,
    });
    return;
  }

  ElNotification({
    title: resolved.title || '提示',
    message: body,
    type: resolved.severity === 'info' ? 'info' : 'warning',
    position: 'bottom-right',
    duration: 6200,
    showClose: true,
  });
}

/**
 * 根据错误码展示（用于 /api/status 等 200 响应携带 code）
 */
export async function presentByCode(code, extra = {}) {
  const resolved = resolveByCode(code, extra);
  if (resolved.severity === 'silent') return;
  logWebPanError(null, resolved);
  const body = resolved.solution ? `${resolved.message}\n\n【处理建议】\n${resolved.solution}` : resolved.message;
  if (resolved.severity === 'critical') {
    await ElMessageBox.alert(body, resolved.title || '网盘提示', {
      type: 'error',
      confirmButtonText: '我知道了',
    });
    return;
  }
  ElNotification({
    title: resolved.title,
    message: body,
    type: 'warning',
    position: 'bottom-right',
    duration: 6200,
    showClose: true,
  });
}

/**
 * 纯客户端提示（无 axios）
 */
export function presentClientWarning(code, title, message, solution) {
  console.warn(LOG_PREFIX, code, { title, message, solution });
  const body = solution ? `${message}\n\n【处理建议】\n${solution}` : message;
  ElNotification({
    title: title || '提示',
    message: body,
    type: 'warning',
    position: 'bottom-right',
    duration: 5000,
    showClose: true,
  });
}

/** 使用 catalog 中的错误码展示右下角提示 */
export function presentClientWarningCode(code) {
  const c = ERROR_CATALOG[code];
  if (!c || c.severity === 'silent') return;
  presentClientWarning(code, c.title, c.message, c.solution);
}
