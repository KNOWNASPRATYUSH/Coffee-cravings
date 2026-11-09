'use strict';
const crypto = require('crypto');
const { HttpError, pipe, route, clientIp } = require('./_lib');
const { text } = require('./_shop');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = route(['POST'], async (req, res) => {
  // Rate limit: max 5 messages per 10 minutes per IP
  const ip = clientIp(req);
  const rlKey = 'rl:contact:' + ip;
  const [attempts] = await pipe([
    ['INCR', rlKey],
    ['EXPIRE', rlKey, 600, 'NX']
  ]);
  if (attempts > 5) {
    throw new HttpError(429, 'Too many messages sent. Please wait a few minutes before trying again.');
  }

  const b = req.body || {};
  const name = text(b.name, 80);
  const email = String(b.email || '').trim().slice(0, 100);
  const message = text(b.message, 3000);

  if (!name || name.length < 2) {
    throw new HttpError(400, 'Please enter a valid name (at least 2 characters).');
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new HttpError(400, 'Please enter a valid email address.');
  }
  if (!message || message.length < 5) {
    throw new HttpError(400, 'Please enter a message (at least 5 characters).');
  }

  const id = 'msg_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const now = new Date().toISOString();

  await pipe([
    ['HSET', 'contact:msg:' + id, 'id', id, 'name', name, 'email', email, 'message', message, 'createdAt', now],
    ['ZADD', 'contact:messages', Date.now(), id]
  ]);

  return res.status(201).json({
    ok: true,
    message: 'Thank you! Your message has been received. Our team will get back to you shortly.'
  });
});

