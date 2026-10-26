import {createHmac, timingSafeEqual} from 'node:crypto';
export const SESSION_SECONDS = 8 * 60 * 60;
const name = org => 'hms_ops_' + org.code.toLowerCase();
const signature = (payload, secret) => createHmac('sha256', secret).update('hms-operations-session-v1:' + payload).digest('base64url');
export function sessionCookie(org, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({v: 1, org: org.code, exp: Math.floor(now / 1000) + SESSION_SECONDS})).toString('base64url');
  return `${name(org)}=${payload}.${signature(payload, secret)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}
export const clearSessionCookie = org => `${name(org)}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export function hasOperationsSession(req, org, secret, now = Date.now()) {
  if (!secret) return false;
  const cookie = typeof req.headers?.cookie === 'string' ? req.headers.cookie : '';
  const value = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(name(org) + '='))?.slice(name(org).length + 1);
  if (!value || value.length > 1200 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return false;
  const [payload, supplied] = value.split('.'), expected = signature(payload, secret);
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed.v === 1 && parsed.org === org.code && Number.isSafeInteger(parsed.exp) && parsed.exp > Math.floor(now / 1000);
  } catch { return false; }
}
