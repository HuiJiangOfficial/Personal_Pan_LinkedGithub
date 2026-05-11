import { readEnv, assertEnv, jsonResponse, withCors } from '../../_utils.js';
import { getSession } from '../../_session.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);
  if (!cfg.jwtSecret) return withCors(request, jsonResponse({ ok: false, authenticated: false, reason: 'no_jwt_secret' }));

  const session = await getSession(request, env);
  if (!session?.sub) {
    return withCors(request, jsonResponse({ ok: false, authenticated: false }));
  }
  return withCors(
    request,
    jsonResponse({
      ok: true,
      authenticated: true,
      user: session.sub,
      role: session.role,
    })
  );
}
