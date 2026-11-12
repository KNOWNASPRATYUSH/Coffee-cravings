'use strict';
const { HttpError, cmd, pipe, route, getPins, safeEq, issueToken, setSessionCookie, requireStaff, clientIp, SESSION_MS } = require('../_lib');

const MAX_FAILS = 5, WINDOW_S = 900;

module.exports = route(['GET', 'POST', 'DELETE'], async (req, res) => {
  if (req.method === 'GET') { const s = await requireStaff(req); return res.json({ role: s.role }); }
  if (req.method === 'DELETE') { setSessionCookie(res, '', 0); return res.json({ ok: true }); }

  const ipKey = 'rl:login:' + clientIp(req);
  const mine = parseInt(await cmd('GET', ipKey) || 0, 10);
  if (mine >= MAX_FAILS) throw new HttpError(429, 'Too many attempts. Please wait 15 minutes and try again.', { retryAfter: WINDOW_S });

  const pin = String(req.body.pin || '');
  const p = await getPins();
  const isOwner = safeEq(pin, p.owner), isBarista = safeEq(pin, p.barista); // both always evaluated
  const role = isOwner ? 'owner' : isBarista ? 'barista' : null;

  if (!role || !/^\d{6,12}$/.test(pin)) {
    await pipe([['INCR', ipKey], ['EXPIRE', ipKey, WINDOW_S, 'NX']]);
    throw new HttpError(401, 'Incorrect PIN.');
  }
  await cmd('DEL', ipKey);
  setSessionCookie(res, issueToken(role, p[role]), Math.floor(SESSION_MS / 1000));
  res.json({ role });
});
