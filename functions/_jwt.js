/**
 * 极简 HS256 JWT（仅依赖 Web Crypto），会话 Cookie 使用
 */
const enc = new TextEncoder();

function b64urlFromBytes(bytes) {
  let s = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlFromString(str) {
  return b64urlFromBytes(enc.encode(str));
}

function b64urlToString(b64url) {
  const pad = 4 - (b64url.length % 4);
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + (pad < 4 ? '='.repeat(pad) : '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmacSha256(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64urlFromBytes(sig);
}

export async function signSession(secret, payload) {
  const header = b64urlFromString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64urlFromString(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = await hmacSha256(secret, data);
  return `${data}.${sig}`;
}

export async function verifySession(secret, token) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const data = `${h}.${p}`;
    const expect = await hmacSha256(secret, data);
    if (expect.length !== s.length) return null;
    let diff = 0;
    for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ s.charCodeAt(i);
    if (diff !== 0) return null;
    const payload = JSON.parse(b64urlToString(p));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
