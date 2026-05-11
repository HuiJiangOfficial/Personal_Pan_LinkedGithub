import { readEnv, assertEnv, jsonResponse, withCors } from '../../_utils.js';
import { getSession } from '../../_session.js';
import { requireAdmin } from '../../_authz.js';
import { loadUserStore, findUser, saveUserStore } from '../../_userStore.js';
import { hashPassword } from '../../_password.js';

/** POST /api/admin/password — 管理员重置普通用户密码（无法查看原明文） */
export async function onRequestPost(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);
  const session = await getSession(request, env);
  const deny = requireAdmin(session);
  if (deny) return withCors(request, deny);

  let body;
  try {
    body = await request.json();
  } catch {
    return withCors(request, jsonResponse({ error: 'JSON 无效' }, 400));
  }
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || password.length < 6) {
    return withCors(request, jsonResponse({ error: '请提供用户名及至少 6 位新密码' }, 400));
  }

  try {
    let { data, sha } = await loadUserStore(cfg);
    const u = findUser(data, username);
    if (!u || u.role !== 'user') {
      return withCors(request, jsonResponse({ error: '仅可重置已存在的普通用户' }, 404));
    }
    const cred = await hashPassword(password);
    u.salt = cred.salt;
    u.hash = cred.hash;
    u.iterations = cred.iterations;
    await saveUserStore(cfg, data, sha);
    return withCors(request, jsonResponse({ ok: true, username }));
  } catch (e) {
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500));
  }
}
