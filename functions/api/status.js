/**
 * GET /api/status
 */
import { readEnv, jsonResponse, corsHeaders } from '../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const varsPresent = {
    GITHUB_OWNER: Boolean(cfg.owner),
    GITHUB_REPO: Boolean(cfg.repo),
    GITHUB_TOKEN: Boolean(cfg.token),
    JWT_SECRET: Boolean(cfg.jwtSecret),
  };
  const configured = Boolean(cfg.owner && cfg.repo && cfg.token);
  const res = jsonResponse({
    ok: true,
    needPassword: false,
    configured,
    branch: cfg.branch || 'main',
    varsPresent,
    /** 前端错误引导：未就绪时非 OK */
    code: !configured ? 'SRV_NOT_CONFIGURED' : !cfg.jwtSecret ? 'SRV_JWT_NOT_SET' : 'SRV_OK',
  });
  const h = new Headers(res.headers);
  Object.entries(corsHeaders(request)).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: res.status, headers: h });
}
