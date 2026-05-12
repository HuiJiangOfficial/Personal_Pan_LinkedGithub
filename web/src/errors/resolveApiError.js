import { ERROR_CATALOG } from './catalog.js';

/**
 * 将 axios 错误解析为统一结构
 * @param {import('axios').AxiosError} err
 * @param {{ severityOverride?: string }} options
 */
export function resolveApiError(err, options = {}) {
  const override = options.severityOverride;
  const d = err.response?.data;
  const apiCode = d && typeof d === 'object' && typeof d.code === 'string' ? d.code : null;

  if (apiCode && ERROR_CATALOG[apiCode]) {
    const c = ERROR_CATALOG[apiCode];
    return {
      code: apiCode,
      severity: override || c.severity,
      title: c.title,
      message: (typeof d.error === 'string' && d.error) || c.message,
      solution: c.solution,
      httpStatus: err.response?.status ?? null,
      raw: err,
    };
  }

  if (!err.response) {
    if (err.code === 'ECONNABORTED') {
      const c = ERROR_CATALOG.NET_TIMEOUT;
      return {
        code: 'NET_TIMEOUT',
        severity: override || c.severity,
        title: c.title,
        message: c.message,
        solution: c.solution,
        httpStatus: null,
        raw: err,
      };
    }
    const c = ERROR_CATALOG.NET_OFFLINE;
    return {
      code: 'NET_OFFLINE',
      severity: override || c.severity,
      title: c.title,
      message: err.message || c.message,
      solution: c.solution,
      httpStatus: null,
      raw: err,
    };
  }

  const status = err.response.status;
  const msg = typeof d?.error === 'string' ? d.error : err.message || '请求失败';

  if (status === 401 && d?.code === 'AUTH_SESSION_INVALID') {
    const c = ERROR_CATALOG.AUTH_SESSION_INVALID;
    return {
      code: 'AUTH_SESSION_INVALID',
      severity: override || c.severity,
      title: c.title,
      message: msg,
      solution: c.solution,
      httpStatus: status,
      raw: err,
    };
  }

  if (status === 401) {
    const c = ERROR_CATALOG.AUTH_UNAUTHORIZED;
    return {
      code: 'AUTH_UNAUTHORIZED',
      severity: override || c.severity,
      title: c.title,
      message: msg,
      solution: c.solution,
      httpStatus: status,
      raw: err,
    };
  }

  if (status === 403) {
    const c = ERROR_CATALOG.HTTP_403;
    return { code: 'HTTP_403', severity: override || c.severity, title: c.title, message: msg, solution: c.solution, httpStatus: status, raw: err };
  }
  if (status === 404) {
    const c = ERROR_CATALOG.HTTP_404;
    return { code: 'HTTP_404', severity: override || c.severity, title: c.title, message: msg, solution: c.solution, httpStatus: status, raw: err };
  }
  if (status === 413) {
    const c = ERROR_CATALOG.HTTP_413;
    return { code: 'HTTP_413', severity: override || c.severity, title: c.title, message: msg, solution: c.solution, httpStatus: status, raw: err };
  }
  if (status === 429) {
    const c = ERROR_CATALOG.HTTP_429;
    return { code: 'HTTP_429', severity: override || c.severity, title: c.title, message: msg, solution: c.solution, httpStatus: status, raw: err };
  }
  if (status === 502) {
    const c = ERROR_CATALOG.HTTP_502;
    return { code: 'HTTP_502', severity: override || c.severity, title: c.title, message: msg, solution: c.solution, httpStatus: status, raw: err };
  }
  if (status === 503) {
    const c = ERROR_CATALOG.HTTP_503;
    return { code: 'HTTP_503', severity: override || c.severity, title: c.title, message: msg, solution: c.solution, httpStatus: status, raw: err };
  }
  if (status >= 500) {
    const c = ERROR_CATALOG.HTTP_500;
    return { code: 'HTTP_500', severity: override || c.severity, title: c.title, message: msg, solution: c.solution, httpStatus: status, raw: err };
  }

  const c = ERROR_CATALOG.HTTP_502;
  return {
    code: `HTTP_${status}`,
    severity: override || 'warning',
    title: '请求未完成',
    message: msg,
    solution: c.solution,
    httpStatus: status,
    raw: err,
  };
}

/**
 * 根据业务错误码展示（无 axios 对象，例如 /api/status 返回体）
 */
export function resolveByCode(code, extra = {}) {
  const c = ERROR_CATALOG[code];
  if (!c || c.severity === 'silent') {
    return {
      code: code || 'UNKNOWN',
      severity: 'silent',
      title: '',
      message: '',
      solution: '',
      httpStatus: null,
      raw: null,
    };
  }
  return {
    code,
    severity: c.severity,
    title: c.title,
    message: extra.message || c.message,
    solution: c.solution,
    httpStatus: null,
    raw: null,
  };
}
