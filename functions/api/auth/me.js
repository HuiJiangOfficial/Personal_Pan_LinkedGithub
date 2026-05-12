import { readEnv, assertEnv, jsonResponse, withCors, CACHE_PRIVATE_NO_STORE } from '../../_utils.js';
import { getSession } from '../../_session.js';
import { sessionDriveSub } from '../../_driveScope.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);
  if (!cfg.jwtSecret) {
    return withCors(
      request,
      jsonResponse({ ok: false, authenticated: false, reason: 'no_jwt_secret', code: 'SRV_JWT_NOT_SET' }, 200, CACHE_PRIVATE_NO_STORE)
    );
  }

  const session = await getSession(request, env);
  if (!session?.sub) {
    return withCors(request, jsonResponse({ ok: false, authenticated: false }, 200, CACHE_PRIVATE_NO_STORE));
  }
  const driveSub = sessionDriveSub(session);
  if (!driveSub) {
    return withCors(
      request,
      jsonResponse({ ok: false, authenticated: false, reason: 'bad_session', code: 'AUTH_SESSION_INVALID' }, 401, CACHE_PRIVATE_NO_STORE)
    );
  }
  return withCors(
    request,
    jsonResponse(
      {
        ok: true,
        authenticated: true,
        user: session.sub,
        role: session.role,
        driveSub,
      },
      200,
      CACHE_PRIVATE_NO_STORE
    )
  );
}
