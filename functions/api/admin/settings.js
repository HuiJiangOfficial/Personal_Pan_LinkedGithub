import { readEnv, assertEnv, jsonResponse, withCors } from '../../_utils.js';
import { getSession } from '../../_session.js';
import { requireAdmin } from '../../_authz.js';
import { loadUserStore, saveUserStore } from '../../_userStore.js';

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
    return withCors(
      request,
      jsonResponse({
        ok: true,
        guestEnabled: Boolean(data.guestEnabled),
        guestPaths: Array.isArray(data.guestPaths) ? data.guestPaths : [],
        allowRegistration: data.allowRegistration !== false,
      })
    );
  } catch (e) {
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500));
  }
}

export async function onRequestPatch(context) {
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

  try {
    let { data, sha } = await loadUserStore(cfg);
    if (typeof body.guestEnabled === 'boolean') data.guestEnabled = body.guestEnabled;
    if (Array.isArray(body.guestPaths)) {
      data.guestPaths = body.guestPaths.map((p) => String(p || '').replace(/^\/+/, '').trim()).filter(Boolean);
    }
    if (typeof body.allowRegistration === 'boolean') data.allowRegistration = body.allowRegistration;
    await saveUserStore(cfg, data, sha);
    return withCors(
      request,
      jsonResponse({
        ok: true,
        guestEnabled: Boolean(data.guestEnabled),
        guestPaths: data.guestPaths,
        allowRegistration: data.allowRegistration !== false,
      })
    );
  } catch (e) {
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500));
  }
}
