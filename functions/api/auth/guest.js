import { readEnv, assertEnv, jsonResponse, withCors } from '../../_utils.js';
import { loadUserStore } from '../../_userStore.js';
import { issueSession, setSessionCookie } from '../../_session.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);
  if (!cfg.jwtSecret) return withCors(request, jsonResponse({ error: '请配置机密 JWT_SECRET' }, 500));

  try {
    const { data } = await loadUserStore(cfg);
    if (!data.guestEnabled) {
      return withCors(request, jsonResponse({ error: '访客模式未开启' }, 403));
    }
    const token = await issueSession(env, { sub: 'guest', role: 'guest' });
    return withCors(
      request,
      jsonResponse({ ok: true, role: 'guest', user: 'guest' }, 200, {
        'Set-Cookie': setSessionCookie(token, env),
      })
    );
  } catch (e) {
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500));
  }
}
