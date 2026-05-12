import { jsonResponse, withCors } from '../../_utils.js';
import { clearSessionCookie } from '../../_session.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  return withCors(request, jsonResponse({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(env) }));
}
