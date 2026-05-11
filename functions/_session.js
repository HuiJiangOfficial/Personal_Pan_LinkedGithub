/**
 * Cookie 会话：解析与签发
 */
import { readEnv } from './_utils.js';
import { verifySession, signSession } from './_jwt.js';

export const SESSION_COOKIE = 'webpan_session';
const MAX_AGE = 60 * 60 * 24 * 7;

export function parseCookies(request) {
  /** @type {Record<string, string>} */
  const out = {};
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export async function getSession(request, env) {
  const cfg = readEnv(env);
  if (!cfg.jwtSecret) return null;
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  return verifySession(cfg.jwtSecret, token);
}

export async function issueSession(env, { sub, role }) {
  const cfg = readEnv(env);
  if (!cfg.jwtSecret) throw new Error('JWT_SECRET 未配置');
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub, role, iat: now, exp: now + MAX_AGE };
  return signSession(cfg.jwtSecret, payload);
}

/** 本地 http 调试可在环境变量设 COOKIE_SECURE=false 以去掉 Secure */
export function setSessionCookie(token, env) {
  const secure = env?.COOKIE_SECURE !== 'false';
  const sec = secure ? 'Secure; ' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}; ${sec}`;
}

export function clearSessionCookie(env) {
  const secure = env?.COOKIE_SECURE !== 'false';
  const sec = secure ? 'Secure; ' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; ${sec}`;
}
