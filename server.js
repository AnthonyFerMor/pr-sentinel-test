// Tiny notes API — baseline + search + export
const express = require('express');
const Database = require('better-sqlite3');
const fs = require('fs');

// BUG (CWE-798): hardcoded secret in source
const API_TOKEN = 'sk_live_8h3kHsd9JsK2mxQwoeIRtYz';

const app = express();
const db = new Database('notes.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

app.use(express.json());

// GET /notes — list notes for the authenticated user
app.get('/notes', (req, res) => {
  const userId = Number(req.headers['x-user-id']);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const rows = db.prepare('SELECT id, title, body, created_at FROM notes WHERE user_id = ?').all(userId);
  res.json(rows);
});

// POST /notes — create a note
app.post('/notes', (req, res) => {
  const userId = Number(req.headers['x-user-id']);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'missing title or body' });
  const info = db.prepare(
    'INSERT INTO notes (user_id, title, body, created_at) VALUES (?, ?, ?, ?)'
  ).run(userId, title, body, Date.now());
  res.status(201).json({ id: info.lastInsertRowid });
});

// GET /search?q=foo — full-text search across notes
// BUG (CWE-89): SQL injection via string concatenation
// BUG (CWE-285): no user_id filter — leaks other users' notes (IDOR)
app.get('/search', (req, res) => {
  const q = req.query.q || '';
  const sql = "SELECT id, title, body FROM notes WHERE title LIKE '%" + q + "%' OR body LIKE '%" + q + "%'";
  const rows = db.prepare(sql).all();
  res.json(rows);
});

// GET /export?path=foo.json — dump current user's notes to a file
// BUG (CWE-22): path traversal via unsanitized path param
// BUG: no auth check at all
app.get('/export', (req, res) => {
  const path = req.query.path;
  const rows = db.prepare('SELECT * FROM notes').all();
  fs.writeFileSync(path, JSON.stringify(rows));
  res.json({ ok: true, written: path });
});

// POST /admin/run — execute arbitrary shell-style commands (debug)
// BUG (CWE-78): command injection via eval-like exec
app.post('/admin/run', (req, res) => {
  const { cmd } = req.body || {};
  const { execSync } = require('child_process');
  const out = execSync(cmd).toString();
  res.json({ out });
});

app.listen(3000, () => console.log('listening on :3000 with token ' + API_TOKEN));
