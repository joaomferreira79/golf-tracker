import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { METRICS } from './stats.js';

export function openDb(path = 'data/golf.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS shots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      ${METRICS.map((m) => `${m} REAL`).join(',\n      ')}
    );
  `);

  const q = {
    insertSession: db.prepare('INSERT INTO sessions (date, notes) VALUES (?, ?)'),
    updateSession: db.prepare('UPDATE sessions SET date = ?, notes = ? WHERE id = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
    getSession: db.prepare('SELECT * FROM sessions WHERE id = ?'),
    allSessions: db.prepare('SELECT * FROM sessions ORDER BY date DESC, id DESC'),
    shotsOf: db.prepare('SELECT * FROM shots WHERE session_id = ? ORDER BY id'),
    clearShots: db.prepare('DELETE FROM shots WHERE session_id = ?'),
    insertShot: db.prepare(`INSERT INTO shots (session_id, ${METRICS.join(',')}) VALUES (?, ${METRICS.map(() => '?').join(',')})`),
  };

  const withShots = (s) => (s ? { ...s, shots: q.shotsOf.all(s.id) } : null);

  return {
    createSession: (date, notes = '') => Number(q.insertSession.run(date, notes).lastInsertRowid),
    updateSession: (id, date, notes) => q.updateSession.run(date, notes, id),
    deleteSession: (id) => q.deleteSession.run(id),
    getSession: (id) => withShots(q.getSession.get(id)),
    listSessions: () => q.allSessions.all().map(withShots),
    replaceShots(sessionId, shots) {
      db.exec('BEGIN');
      try {
        q.clearShots.run(sessionId);
        for (const s of shots) q.insertShot.run(sessionId, ...METRICS.map((m) => s[m] ?? null));
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
