/**
 * POST /api/verify
 * JSON: { password: string } — 校验访问密码（不返回敏感信息）
 */
import { readEnv, jsonResponse, corsHeaders } from '../_utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const cfg = readEnv(env);

  // 未设置密码则直接通过
  if (!cfg.password) {
    return attachCors(request, jsonResponse({ ok: true, needPassword: false }));
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty */
  }
  const pwd = typeof body.password === 'string' ? body.password : '';

  if (pwd !== cfg.password) {
    return attachCors(request, jsonResponse({ ok: false, needPassword: true }, 401));
  }

  return attachCors(request, jsonResponse({ ok: true, needPassword: true }));
}

/** @param {Request} request @param {Response} res */
function attachCors(request, res) {
  const h = new Headers(res.headers);
  Object.entries(corsHeaders(request)).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: res.status, headers: h });
}
