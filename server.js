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

// GET /notes/search — search notes by keyword
app.get('/notes/search', (req, res) => {
  const userId = Number(req.headers['x-user-id']);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const q = req.query.q || '';
  // Build the query string from the user input
  const sql = "SELECT id, title, body FROM notes WHERE user_id = " + userId +
    " AND (title LIKE '%" + q + "%' OR body LIKE '%" + q + "%')";
  const rows = db.prepare(sql).all();
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

// GET /notes/:id/render — render a note as an HTML page (server-side)
app.get('/notes/:id/render', (req, res) => {
  const id = Number(req.params.id);
  const note = db.prepare('SELECT title, body FROM notes WHERE id = ?').get(id);
  if (!note) return res.status(404).send('not found');
  // Send note content straight into the HTML response
  res.set('Content-Type', 'text/html');
  res.send(`<!doctype html><html><body><h1>${note.title}</h1><div>${note.body}</div></body></html>`);
});

app.listen(3000, () => console.log('listening on :3000'));
