'use strict';
const { HttpError, cmd, pipe, route, pins, safeEq, issueToken, setSessionCookie, requireStaff, clientIp, SESSION_MS } = require('../_lib');

const MAX_FAILS = 5, WINDOW_S = 900, GLOBAL_MAX = 40;

module.exports = route(['GET', 'POST', 'DELETE'], async (req, res) => {
  if (req.method === 'GET') { const s = requireStaff(req); return res.json({ role: s.role }); }
  if (req.method === 'DELETE') { setSessionCookie(res, '', 0); return res.json({ ok: true }); }

  const ipKey = 'rl:login:' + clientIp(req), allKey = 'rl:login:all';
  const [mine, all] = (await pipe([['GET', ipKey], ['GET', allKey]])).map(v => parseInt(v, 10) || 0);
  if (mine >= MAX_FAILS || all >= GLOBAL_MAX) throw new HttpError(429, 'Too many attempts. Please wait 15 minutes and try again.', { retryAfter: WINDOW_S });

  const pin = String(req.body.pin || '');
  const p = pins();
  const isOwner = safeEq(pin, p.owner), isBarista = safeEq(pin, p.barista); // both always evaluated
  const role = isOwner ? 'owner' : isBarista ? 'barista' : null;

  if (!role || !/^\d{6,12}$/.test(pin)) {
    await pipe([['INCR', ipKey], ['EXPIRE', ipKey, WINDOW_S, 'NX'], ['INCR', allKey], ['EXPIRE', allKey, WINDOW_S, 'NX']]);
    throw new HttpError(401, 'Incorrect PIN.');
  }
  await cmd('DEL', ipKey);
  setSessionCookie(res, issueToken(role), Math.floor(SESSION_MS / 1000));
  res.json({ role });
});
