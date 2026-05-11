/**
 * GET /api/status
 * 返回站点配置状态（不含密钥）；无需访问密码
 */
import { readEnv, jsonResponse, corsHeaders } from '../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const res = jsonResponse({
    ok: true,
    needPassword: Boolean(cfg.password),
    configured: Boolean(cfg.owner && cfg.repo && cfg.token),
    branch: cfg.branch || 'main',
  });
  const h = new Headers(res.headers);
  Object.entries(corsHeaders(request)).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: res.status, headers: h });
}
