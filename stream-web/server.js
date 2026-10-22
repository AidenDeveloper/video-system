const express = require('express');
const mysql = require('mysql2/promise');
const { Readable } = require('stream');
const { secret, escapeHtml, log, makeAuth } = require('./lib');

const app = express();
app.disable('x-powered-by');
const FILE_URL = process.env.FILE_URL;
const API_KEY = secret('INTERNAL_API_KEY');
const LIST_TTL = Number(process.env.LIST_CACHE_TTL_MS || 0);

const pool = mysql.createPool({
  host: process.env.DB_HOST, user: process.env.DB_USER, password: secret('DB_PASSWORD'),
  database: process.env.DB_NAME, connectionLimit: 10, connectTimeout: 3000 });
const requireAuth = makeAuth(process.env.AUTH_URL, Number(process.env.AUTH_CACHE_TTL_MS || 0));

let listCache = { exp: 0, rows: [] };
async function listVideos() {
  if (LIST_TTL && listCache.exp > Date.now()) return listCache.rows;
  const [rows] = await pool.query(
    'SELECT id, title, uploaded_by, size_bytes, created_at FROM videos ORDER BY created_at DESC LIMIT 100');
  if (LIST_TTL) listCache = { exp: Date.now() + LIST_TTL, rows };
  return rows;
}

app.get('/healthz', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.send('ok'); } catch { res.status(503).send('database unavailable'); }
});

app.get('/api/videos', requireAuth, async (_req, res) => res.json(await listVideos()));

app.get('/videos', requireAuth, async (req, res) => {
  const rows = await listVideos();
  const items = rows.map((v) => `<li><b>${escapeHtml(v.title)}</b> <small>by ${escapeHtml(v.uploaded_by)}</small><br>
<video controls preload="none" width="480" src="/stream/${v.id}"></video></li>`).join('');
  res.send(`<!doctype html><title>Videos</title><h1>Videos</h1>
<p>${escapeHtml(req.user.user)} · <a href="/upload">Upload</a> · <a href="/logout">Logout</a></p>
<ul>${items || '<li>No videos yet</li>'}</ul>`);
});

app.get('/stream/:id', requireAuth, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return res.sendStatus(400);
  const [rows] = await pool.execute('SELECT filename FROM videos WHERE id=?', [req.params.id]);
  if (!rows.length) return res.sendStatus(404);
  const headers = { 'X-API-Key': API_KEY };
  if (req.headers.range) headers.Range = req.headers.range;
  const r = await fetch(`${FILE_URL}/files/${rows[0].filename}`, { headers, signal: AbortSignal.timeout(10000) });
  if (r.status >= 500 || r.status === 401) { log('error', 'file-service error', { status: r.status }); return res.sendStatus(502); }
  res.status(r.status);
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const v = r.headers.get(h); if (v) res.set(h, v);
  }
  const s = Readable.fromWeb(r.body);
  res.on('close', () => s.destroy());
  s.pipe(res);
});

app.use((err, _req, res, _next) => {
  log('error', 'request failed', { err: err.message });
  res.status(503).send('Service temporarily unavailable');
});
app.listen(3000, '0.0.0.0', () => log('info', 'stream-web listening on 3000'));