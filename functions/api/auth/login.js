import { readEnv, assertEnv, jsonResponse, withCors } from '../../_utils.js';
import { loadUserStore, findUser } from '../../_userStore.js';
import { verifyPassword } from '../../_password.js';
import { issueSession, setSessionCookie } from '../../_session.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);
  if (!cfg.jwtSecret) return withCors(request, jsonResponse({ error: '请配置机密 JWT_SECRET', code: 'SRV_JWT_SECRET_MISSING' }, 500));

  let body;
  try {
    body = await request.json();
  } catch {
    return withCors(request, jsonResponse({ error: '请求体须为 JSON', code: 'REQ_BODY_NOT_JSON' }, 400));
  }
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) {
    return withCors(request, jsonResponse({ error: '请输入用户名和密码', code: 'AUTH_FIELDS_MISSING' }, 400));
  }

  try {
    const adminName = String(cfg.adminUsername || 'admin').trim();
    if (username.toLowerCase() === adminName.toLowerCase()) {
      if (cfg.adminPassword && password === cfg.adminPassword) {
        const token = await issueSession(env, { sub: adminName, role: 'admin' });
        return withCors(
          request,
          jsonResponse({ ok: true, role: 'admin', user: adminName }, 200, {
            'Set-Cookie': setSessionCookie(token, env),
          })
        );
      }
      return withCors(request, jsonResponse({ error: '管理员账号或密码错误', code: 'AUTH_INVALID_CREDENTIALS' }, 401));
    }

    const { data } = await loadUserStore(cfg);
    const u = findUser(data, username);
    const userRole = u?.role || 'user';
    if (!u || userRole !== 'user') {
      return withCors(request, jsonResponse({ error: '用户不存在或密码错误', code: 'AUTH_INVALID_CREDENTIALS' }, 401));
    }
    const ok = await verifyPassword(password, u);
    if (!ok) return withCors(request, jsonResponse({ error: '用户不存在或密码错误', code: 'AUTH_INVALID_CREDENTIALS' }, 401));
    const token = await issueSession(env, { sub: u.username, role: 'user' });
    return withCors(
      request,
      jsonResponse({ ok: true, role: 'user', user: u.username }, 200, {
        'Set-Cookie': setSessionCookie(token, env),
      })
    );
  } catch (e) {
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e), code: 'SRV_LOGIN_FAILED' }, 500));
  }
}
