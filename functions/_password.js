/**
 * 密码存储：PBKDF2-SHA256（不可逆）；与「加密保存」语义一致，服务端永不存明文
 */
const ITER = 120000;

function hexToBuf(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(plain) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(plain), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { salt: bufToHex(salt), hash: bufToHex(bits), iterations: ITER };
}

export async function verifyPassword(plain, stored) {
  if (!stored?.salt || !stored?.hash) return false;
  const enc = new TextEncoder();
  const salt = hexToBuf(String(stored.salt));
  const iterations = Number(stored.iterations) || ITER;
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(plain), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const calc = bufToHex(bits).toLowerCase();
  const expect = String(stored.hash).toLowerCase();
  if (calc.length !== expect.length) return false;
  let ok = 0;
  for (let i = 0; i < calc.length; i++) ok |= calc.charCodeAt(i) ^ expect.charCodeAt(i);
  return ok === 0;
}
