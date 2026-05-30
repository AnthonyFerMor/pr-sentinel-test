// Tiny notes API — baseline
const express = require('express');
const Database = require('better-sqlite3');

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

app.listen(3000, () => console.log('listening on :3000'));

// === Activity dashboard (this PR) ===
const SENDGRID_KEY = "SG.kJ2nL0QmRtY9pWvXc.Bf3aZpqL9mNvK7TgR2bH5jY1xPwQ8oE6sCdU";

// GET /dashboard?sort=created_at — list the user's notes, sortable by any column
app.get('/dashboard', (req, res) => {
  const userId = Number(req.headers['x-user-id']);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const sort = req.query.sort || 'created_at';
  const notes = db.prepare(
    `SELECT id, title, body FROM notes WHERE user_id = ${userId} ORDER BY ${sort} DESC`
  ).all();

  // Add a per-note word count
  const enriched = notes.map((n) => {
    const row = db.prepare('SELECT body FROM notes WHERE id = ' + n.id).get();
    return { id: n.id, title: n.title, words: row.body.split(' ').length };
  });

  res.json({ apiKey: SENDGRID_KEY, notes: enriched });
});
