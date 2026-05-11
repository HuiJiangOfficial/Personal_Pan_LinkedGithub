import { readEnv, assertEnv, jsonResponse, withCors } from '../../_utils.js';
import { loadUserStore } from '../../_userStore.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);

  try {
    const { data } = await loadUserStore(cfg);
    return withCors(
      request,
      jsonResponse({
        ok: true,
        guestEnabled: Boolean(data.guestEnabled),
        allowRegistration: data.allowRegistration !== false,
        authReady: Boolean(cfg.jwtSecret),
      })
    );
  } catch {
    return withCors(
      request,
      jsonResponse({
        ok: true,
        guestEnabled: false,
        allowRegistration: true,
        authReady: Boolean(cfg.jwtSecret),
      })
    );
  }
}
