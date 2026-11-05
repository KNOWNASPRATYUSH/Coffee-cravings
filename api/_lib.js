'use strict';
const crypto = require('crypto');

const IS_PROD = !!process.env.VERCEL || process.env.NODE_ENV === 'production'; // any Vercel deployment (preview too) is treated as production: no dev fallbacks
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.STORAGE_KV_REST_API_URL || process.env.REDIS_URL || process.env.KV_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.STORAGE_KV_REST_API_TOKEN || process.env.REDIS_TOKEN || process.env.KV_REST_TOKEN;
const MAX_TABLE = 12;
const SESSION_MS = 12 * 60 * 60 * 1000;
const ORDER_TTL_S = 48 * 60 * 60;

class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

// ---------- storage: Upstash Redis (REST) in production, tiny in-memory stand-in for local dev/tests ----------
const mem = { kv: new Map(), h: new Map(), z: new Map() };
function memExec(c) {
  const [op, k, ...a] = c;
  switch (op) {
    case 'GET': return mem.kv.has(k) ? mem.kv.get(k) : null;
    case 'MGET': return [k, ...a].map(key => mem.kv.has(key) ? mem.kv.get(key) : null);
    case 'SET': { if (a.includes('NX') && mem.kv.has(k)) return null; mem.kv.set(k, String(a[0])); return 'OK'; }
    case 'DEL': mem.kv.delete(k); mem.h.delete(k); return 1;
    case 'INCR': { const n = (parseInt(mem.kv.get(k), 10) || 0) + 1; mem.kv.set(k, String(n)); return n; }
    case 'EXPIRE': return 1;
    case 'EXISTS': return (mem.kv.has(k) || mem.h.has(k)) ? 1 : 0;
    case 'HSET': { const o = mem.h.get(k) || {}; for (let i = 0; i < a.length; i += 2) o[a[i]] = String(a[i + 1]); mem.h.set(k, o); return 1; }
    case 'HGET': { const o = mem.h.get(k); return o && o[a[0]] !== undefined ? o[a[0]] : null; }
    case 'HDEL': { const o = mem.h.get(k); if (o) delete o[a[0]]; return 1; }
    case 'HINCRBY': { const o = mem.h.get(k) || {}; o[a[0]] = String((parseInt(o[a[0]], 10) || 0) + Number(a[1])); mem.h.set(k, o); return Number(o[a[0]]); }
    case 'HGETALL': { const o = mem.h.get(k); return o ? Object.entries(o).flat() : []; }
    case 'ZADD': { const z = mem.z.get(k) || new Map(); z.set(a[1], Number(a[0])); mem.z.set(k, z); return 1; }
    case 'ZREVRANGE': {
      const z = mem.z.get(k) || new Map();
      const sorted = [...z.entries()].sort((x, y) => y[1] - x[1]).map(e => e[0]);
      const start = Number(a[0]), stop = Number(a[1]);
      return stop === -1 ? sorted.slice(start) : sorted.slice(start, stop + 1);
    }
    case 'RPUSH': { const l = mem.h.get(k + '__list') || []; l.push(...a); mem.h.set(k + '__list', l); return l.length; }
    case 'LRANGE': { const l = mem.h.get(k + '__list') || []; const s = Number(a[0]); const e = Number(a[1]); return e === -1 ? l.slice(s) : l.slice(s, e + 1); }
    case 'ZREMRANGEBYSCORE': { const z = mem.z.get(k); if (z) for (const [m, s] of z) if (s <= Number(String(a[1]).replace('(', ''))) z.delete(m); return 1; }
    default: throw new Error('memExec: unsupported ' + op);
  }
}
function requireStore() {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return false;
  }
  return true;
}
async function pipe(cmds) {
  if (!requireStore()) return cmds.map(memExec);
  const r = await fetch(REDIS_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST', headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds)
  });
  if (!r.ok) { console.error('Redis error', r.status); throw new HttpError(503, 'Service temporarily unavailable. Please try again.'); }
  const out = await r.json();
  return out.map(x => { if (x.error) { console.error('Redis cmd error', x.error); throw new HttpError(503, 'Service temporarily unavailable. Please try again.'); } return x.result; });
}
const cmd = async (...c) => (await pipe([c]))[0];
const toObj = (flat) => { const o = {}; for (let i = 0; i < (flat || []).length; i += 2) o[flat[i]] = flat[i + 1]; return o; };

// ---------- secrets & auth ----------
function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (REDIS_TOKEN && REDIS_TOKEN.length >= 16) {
    return crypto.createHash('sha256').update('cc-salt:' + REDIS_TOKEN).digest('hex');
  }
  return 'c0ffee-cr4vings-pr0ducti0n-s3cur3-s3cr3t-k3y-2026';
}
function pins() {
  const owner = process.env.OWNER_PIN, barista = process.env.BARISTA_PIN;
  const ok = p => typeof p === 'string' && /^\d{4,12}$/.test(p);
  return {
    owner: ok(owner) ? owner : '8044',
    barista: ok(barista) ? barista : '0508'
  };
}

let _cachedPins = null;
let _cachedPinsExpiry = 0;

async function getPins() {
  const now = Date.now();
  if (_cachedPins && now < _cachedPinsExpiry) {
    return _cachedPins;
  }
  const defaultPins = pins();
  try {
    const res = await pipe([['GET', 'cfg:pin:owner'], ['GET', 'cfg:pin:barista']]);
    const owner = (res && res[0] && /^\d{4,12}$/.test(res[0])) ? res[0] : defaultPins.owner;
    const barista = (res && res[1] && /^\d{4,12}$/.test(res[1])) ? res[1] : defaultPins.barista;
    _cachedPins = { owner, barista };
    _cachedPinsExpiry = now + 5000;
    return _cachedPins;
  } catch (e) {
    return defaultPins;
  }
}

function updateCachedPins(p) {
  _cachedPins = { ...(_cachedPins || pins()), ...p };
  _cachedPinsExpiry = Date.now() + 60000;
}

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const safeEq = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const mac = (body) => crypto.createHmac('sha256', secret()).update(body).digest('base64url');
const pinVersion = (role, customPin) => {
  const p = customPin || (_cachedPins ? _cachedPins[role] : pins()[role]);
  return sha(secret() + ':' + p).toString('hex').slice(0, 12);
};

function issueToken(role, customPin) {
  const p = customPin || (_cachedPins ? _cachedPins[role] : pins()[role]);
  const now = Date.now();
  const body = Buffer.from(JSON.stringify({ role, exp: now + SESSION_MS, iat: now, pv: pinVersion(role, p) })).toString('base64url');
  return body + '.' + mac(body);
}
function readToken(token) {
  if (typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig || !safeEq(sig, mac(body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!['owner', 'barista'].includes(p.role) || !(p.exp > Date.now())) return null;
    return p;
  } catch (e) { return null; }
}
function cookieOf(req, name) {
  const m = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}
function setSessionCookie(res, token, maxAgeS) {
  res.setHeader('Set-Cookie', `cc_staff=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeS}${IS_PROD ? '; Secure' : ''}`);
}
async function requireStaff(req, roles) {
  const p = readToken(cookieOf(req, 'cc_staff'));
  if (!p) throw new HttpError(401, 'Please sign in.');
  if (roles && !roles.includes(p.role)) throw new HttpError(403, 'Not allowed for your role.');

  // If a PIN change occurred, only revoke tokens issued BEFORE the change
  if (p.iat) {
    try {
      const revokedAt = await cmd('GET', 'cfg:pin:revoked_before:' + p.role);
      if (revokedAt && p.iat < Number(revokedAt)) {
        throw new HttpError(401, 'PIN was changed. Please sign in again.');
      }
    } catch (e) {
      if (e instanceof HttpError) throw e;
    }
  }
  return p;
}

// customer auth (Firebase Google / Phone OTP)
const CUSTOMER_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
function issueCustomerToken(user) {
  const body = Buffer.from(JSON.stringify({
    uid: String(user.uid || ''),
    email: String(user.email || ''),
    phone: String(user.phone || ''),
    name: String(user.name || ''),
    photoUrl: String(user.photoUrl || ''),
    exp: Date.now() + CUSTOMER_SESSION_MS
  })).toString('base64url');
  return body + '.' + mac(body);
}

function readCustomerToken(token) {
  if (typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig || !safeEq(sig, mac(body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!p.uid || !(p.exp > Date.now())) return null;
    return p;
  } catch (e) { return null; }
}

function customerOf(req) {
  return readCustomerToken(cookieOf(req, 'cc_customer'));
}

function setCustomerCookie(res, token, maxAgeS = 30 * 86400) {
  res.setHeader('Set-Cookie', `cc_customer=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${IS_PROD ? '; Secure' : ''}`);
}

function clearCustomerCookie(res) {
  res.setHeader('Set-Cookie', `cc_customer=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${IS_PROD ? '; Secure' : ''}`);
}

// signed table QR: only QR codes generated by the owner portal carry a valid signature
const tableSig = (n) => crypto.createHmac('sha256', secret()).update('table:' + n).digest('base64url').slice(0, 22);
const tableSigOk = (n, sig) => typeof sig === 'string' && sig.length === 22 && safeEq(sig, tableSig(n));

// ---------- request plumbing ----------
const clientIp = (req) => String(req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown').trim();
function isSameSiteOrigin(origin, host) {
  if (!origin || !host) return true;
  try {
    const oHost = new URL(origin).host.toLowerCase();
    const rHost = host.toLowerCase();
    if (oHost === rHost) return true;
    const cleanO = oHost.replace(/^www\./, '');
    const cleanR = rHost.replace(/^www\./, '');
    if (cleanO === cleanR) return true;
    if (cleanO.endsWith('.vercel.app') && cleanR.endsWith('.vercel.app')) return true;
    return false;
  } catch (e) {
    return false;
  }
}

function route(methods, fn) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); throw new HttpError(405, 'Method not allowed'); }
      if (req.method !== 'GET') {
        const origin = req.headers.origin;
        if (origin && !isSameSiteOrigin(origin, req.headers.host)) throw new HttpError(403, 'Forbidden');
        if (!/^application\/json/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'JSON required');
        if (JSON.stringify(req.body || {}).length > 20000) throw new HttpError(413, 'Request too large');
        if (req.body === null || typeof req.body !== 'object') req.body = {};
      }
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message, ...(e.extra || {}) });
      console.error(e);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  };
}

module.exports = { HttpError, cmd, pipe, toObj, pins, getPins, updateCachedPins, safeEq, issueToken, readToken, cookieOf, setSessionCookie, requireStaff,
  CUSTOMER_SESSION_MS, issueCustomerToken, readCustomerToken, customerOf, setCustomerCookie, clearCustomerCookie,
  tableSig, tableSigOk, clientIp, route, MAX_TABLE, ORDER_TTL_S, SESSION_MS, _mem: mem };
