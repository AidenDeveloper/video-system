const fs = require('fs');

const secret = (name) => {
  const f = process.env[`${name}_FILE`];
  return f ? fs.readFileSync(f, 'utf8').trim() : process.env[name];
};
const escapeHtml = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }));

function sniffVideo(buf) {   // trust file contents, not the client-supplied MIME type
  if (buf.length >= 12 && buf.subarray(4, 8).toString() === 'ftyp') return 'video/mp4';
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm';
  return null;
}

function makeAuth(authUrl, ttlMs = 0) {
  const cache = new Map();
  return async function requireAuth(req, res, next) {
    const token = /(?:^|;\s*)token=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    if (!token) return res.redirect('/login');
    const hit = cache.get(token);
    if (ttlMs && hit && hit.exp > Date.now()) { req.user = hit.user; return next(); }
    try {
      const r = await fetch(`${authUrl}/verify`, {
        headers: { cookie: `token=${token}` }, signal: AbortSignal.timeout(3000) });
      if (r.status === 401) return res.redirect('/login');
      if (!r.ok) throw new Error(`auth status ${r.status}`);
      req.user = await r.json();
      if (ttlMs) { cache.set(token, { user: req.user, exp: Date.now() + ttlMs }); if (cache.size > 1000) cache.clear(); }
      next();
    } catch (e) {
      log('error', 'auth service unavailable', { err: e.message });
      res.status(503).send('Authentication service unavailable');
    }
  };
}
module.exports = { secret, escapeHtml, log, sniffVideo, makeAuth };