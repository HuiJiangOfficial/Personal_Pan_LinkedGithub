/**
 * Pages Functions 中间件：为 /api 路径处理 CORS 预检
 */
import { corsHeaders } from './_utils.js';

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (!url.pathname.startsWith('/api')) {
    return next();
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: new Headers(corsHeaders(request)),
    });
  }

  const response = await next();
  if (!response) return response;

  // `new Headers(response.headers)` 在 Workers 中不会带上 Set-Cookie，会导致登录 Cookie 丢失、无法进入网盘
  let setCookies = [];
  if (typeof response.headers.getSetCookie === 'function') {
    setCookies = response.headers.getSetCookie();
  } else {
    const one = response.headers.get('Set-Cookie');
    if (one) setCookies = [one];
  }

  const merged = new Headers(response.headers);
  if (setCookies.length > 0) {
    merged.delete('Set-Cookie');
    for (const c of setCookies) {
      merged.append('Set-Cookie', c);
    }
  }

  const c = corsHeaders(request);
  Object.entries(c).forEach(([k, v]) => merged.set(k, v));
  // 避免中间层仅按 URL 复用带 Cookie 的 /api 响应
  merged.set('Vary', 'Origin, Cookie');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}
