import { readEnv, assertEnv, jsonResponse, withCors } from '../../_utils.js';
import { getSession } from '../../_session.js';
import { requireAdmin } from '../../_authz.js';
import { loadUserStore, findUser, saveUserStore } from '../../_userStore.js';
import { hashPassword } from '../../_password.js';
import { putBlobAtPath, deleteAllBlobsUnderUserPrefix } from '../../_driveScope.js';

const USER_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$/;

export async function onRequestGet(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);
  const session = await getSession(request, env);
  const deny = requireAdmin(session);
  if (deny) return withCors(request, deny);

  try {
    const { data } = await loadUserStore(cfg);
    const users = (data.users || []).map((u) => ({
      username: u.username,
      role: u.role,
      createdAt: u.createdAt || null,
    }));
    return withCors(request, jsonResponse({ ok: true, users }));
  } catch (e) {
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500));
  }
}

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
  if (!USER_RE.test(username)) {
    return withCors(request, jsonResponse({ error: '用户名格式无效' }, 400));
  }
  if (password.length < 6) return withCors(request, jsonResponse({ error: '密码至少 6 位' }, 400));
  if (username.toLowerCase() === 'guest' || username.toLowerCase() === String(cfg.adminUsername).toLowerCase()) {
    return withCors(request, jsonResponse({ error: '不可使用该用户名' }, 400));
  }

  try {
    let { data, sha } = await loadUserStore(cfg);
    if (findUser(data, username)) return withCors(request, jsonResponse({ error: '用户已存在' }, 409));
    const cred = await hashPassword(password);
    data.users.push({
      username,
      role: 'user',
      salt: cred.salt,
      hash: cred.hash,
      iterations: cred.iterations,
      createdAt: new Date().toISOString(),
    });
    await saveUserStore(cfg, data, sha);
    try {
      await putBlobAtPath(
        cfg,
        `drive/${username}/.gitkeep`,
        new TextEncoder().encode('\n'),
        `web: init drive for ${username}`
      );
    } catch {
      /* 目录初始化失败不阻断创建，与自助注册一致 */
    }
    return withCors(request, jsonResponse({ ok: true, username }));
  } catch (e) {
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500));
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);
  const session = await getSession(request, env);
  const deny = requireAdmin(session);
  if (deny) return withCors(request, deny);

  const url = new URL(request.url);
  const username = String(url.searchParams.get('username') || '').trim();
  if (!username) return withCors(request, jsonResponse({ error: '缺少 username' }, 400));
  if (username.toLowerCase() === 'guest') return withCors(request, jsonResponse({ error: '不可删除访客标识' }, 400));
  if (username.toLowerCase() === String(cfg.adminUsername || 'admin').toLowerCase()) {
    return withCors(request, jsonResponse({ error: '不可删除环境变量中的管理员账号' }, 400));
  }

  try {
    let { data, sha } = await loadUserStore(cfg);
    const idx = data.users.findIndex((u) => String(u.username).toLowerCase() === username.toLowerCase());
    if (idx < 0) return withCors(request, jsonResponse({ error: '用户不存在' }, 404));
    const canonical = String(data.users[idx].username);

    let deletedFiles = 0;
    try {
      deletedFiles = await deleteAllBlobsUnderUserPrefix(cfg, canonical);
    } catch (e) {
      return withCors(
        request,
        jsonResponse({ error: '删除该用户网盘文件失败', detail: e instanceof Error ? e.message : String(e) }, 502)
      );
    }

    data.users.splice(idx, 1);
    await saveUserStore(cfg, data, sha);
    return withCors(request, jsonResponse({ ok: true, deletedFiles }));
  } catch (e) {
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500));
  }
}
