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

  const merged = new Headers(response.headers);
  const c = corsHeaders(request);
  Object.entries(c).forEach(([k, v]) => merged.set(k, v));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}
