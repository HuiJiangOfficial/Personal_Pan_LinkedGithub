import { readEnv, assertEnv, jsonResponse, withCors } from '../../_utils.js';
import { loadUserStore, findUser, saveUserStore } from '../../_userStore.js';
import { hashPassword } from '../../_password.js';
import { putBlobAtPath } from '../../_driveScope.js';
import { isReservedUsername } from '../../_usernamePolicy.js';

const USER_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$/;

export async function onRequestPost(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);
  if (!cfg.jwtSecret) return withCors(request, jsonResponse({ error: '请配置机密 JWT_SECRET' }, 500));

  let body;
  try {
    body = await request.json();
  } catch {
    return withCors(request, jsonResponse({ error: '请求体须为 JSON' }, 400));
  }
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!USER_RE.test(username)) {
    return withCors(request, jsonResponse({ error: '用户名须为 3–32 位字母数字，可含 _ -' }, 400));
  }
  if (password.length < 6) {
    return withCors(request, jsonResponse({ error: '密码至少 6 位' }, 400));
  }

  if (isReservedUsername(username, cfg.adminUsername)) {
    return withCors(request, jsonResponse({ error: '该用户名不可注册' }, 400));
  }

  try {
    let { data, sha } = await loadUserStore(cfg);
    if (!data.allowRegistration) {
      return withCors(request, jsonResponse({ error: '管理员已关闭自助注册' }, 403));
    }
    if (findUser(data, username)) {
      return withCors(request, jsonResponse({ error: '用户名已存在' }, 409));
    }
    const cred = await hashPassword(password);
    data.users.push({
      username,
      role: 'user',
      salt: cred.salt,
      hash: cred.hash,
      iterations: cred.iterations,
      createdAt: new Date().toISOString(),
    });
    const newSha = await saveUserStore(cfg, data, sha);
    try {
      await putBlobAtPath(
        cfg,
        `drive/${username}/.gitkeep`,
        new TextEncoder().encode('\n'),
        `web: init drive for ${username}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return withCors(
        request,
        jsonResponse(
          {
            ok: true,
            username,
            sha: newSha,
            warning: `账号已创建，但初始化网盘目录失败：${msg}`,
          },
          200
        )
      );
    }
    return withCors(request, jsonResponse({ ok: true, username, sha: newSha }));
  } catch (e) {
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500));
  }
}
