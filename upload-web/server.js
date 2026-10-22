const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const fs = require('fs');
const crypto = require('crypto');
const { Readable } = require('stream');
const { secret, escapeHtml, log, sniffVideo, makeAuth } = require('./lib');

const app = express();
app.disable('x-powered-by');
const FILE_URL = process.env.FILE_URL;
const API_KEY = secret('INTERNAL_API_KEY');
const EXT = { 'video/mp4': 'mp4', 'video/webm': 'webm' };

const pool = mysql.createPool({
  host: process.env.DB_HOST, user: process.env.DB_USER, password: secret('DB_PASSWORD'),
  database: process.env.DB_NAME, connectionLimit: 10, connectTimeout: 3000 });
const requireAuth = makeAuth(process.env.AUTH_URL, Number(process.env.AUTH_CACHE_TTL_MS || 0));
const requireUploader = (req, res, next) =>
  req.user.role === 'uploader' ? next() : res.status(403).send('Forbidden: uploader role required');
const upload = multer({ dest: '/tmp/uploads', limits: { fileSize: 200 * 1024 * 1024, files: 1 } });

app.get('/healthz', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.send('ok'); } catch { res.status(503).send('database unavailable'); }
});

app.get('/upload', requireAuth, requireUploader, (req, res) => res.send(`<!doctype html><title>Upload</title>
<h1>Upload video</h1><p>User: ${escapeHtml(req.user.user)} · <a href="/videos">Videos</a> · <a href="/logout">Logout</a></p>
<form method="post" action="/upload" enctype="multipart/form-data">
<input name="title" maxlength="100" required placeholder="Title">
<input type="file" name="video" accept="video/mp4,video/webm" required><button>Upload</button></form>`));

app.post('/upload', requireAuth, requireUploader, upload.single('video'), async (req, res) => {
  const f = req.file;
  const title = String(req.body.title || '').trim();
  const cleanup = () => { if (f) fs.unlink(f.path, () => {}); };
  if (!f || !title || title.length > 100) { cleanup(); return res.status(400).send('Title and video file required'); }
  const fd = fs.openSync(f.path, 'r'); const head = Buffer.alloc(12);
  fs.readSync(fd, head, 0, 12, 0); fs.closeSync(fd);
  const type = sniffVideo(head);
  if (!type) { cleanup(); return res.status(400).send('Only MP4 or WebM videos are accepted'); }
  const id = crypto.randomUUID(); const name = `${id}.${EXT[type]}`;
  try {
    const r = await fetch(`${FILE_URL}/files/${name}`, {
      method: 'PUT', duplex: 'half',
      headers: { 'X-API-Key': API_KEY, 'Content-Type': type, 'Content-Length': String(f.size) },
      body: Readable.toWeb(fs.createReadStream(f.path)) });
    if (!r.ok) throw new Error(`file-service responded ${r.status}`);
    await pool.execute(
      'INSERT INTO videos (id,title,filename,content_type,size_bytes,uploaded_by) VALUES (?,?,?,?,?,?)',
      [id, title, name, type, f.size, req.user.user]);
    log('info', 'video uploaded', { id, user: req.user.user, bytes: f.size });
    res.redirect('/videos');
  } catch (e) {
    log('error', 'upload failed', { err: e.message });
    res.status(502).send('Upload failed: storage or database unavailable. Please retry.');
  } finally { cleanup(); }
});

app.use((err, _req, res, _next) => {
  log('error', 'request failed', { err: err.message, code: err.code });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).send('File too large (max 200 MB)');
  res.status(500).send('Server error');
});
app.listen(3000, '0.0.0.0', () => log('info', 'upload-web listening on 3000'));