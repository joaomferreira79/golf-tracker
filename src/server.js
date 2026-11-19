import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { extractShots } from './extract.js';
import { analyze, evolution, METRICS } from './stats.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 20 } });

export function createApp(db = openDb()) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(`${root}public`));
  app.use('/vendor/chart.js', express.static(`${root}node_modules/chart.js/dist/chart.umd.js`));

  const validDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const wrap = (fn) => (req, res) => {
    try { fn(req, res); } catch (e) { res.status(500).json({ error: e.message }); }
  };

  app.get('/api/sessions', wrap((req, res) => res.json(db.listSessions().map((s) => ({ ...s, shots: undefined, shotCount: s.shots.length })))));

  app.post('/api/sessions', wrap((req, res) => {
    const { date, notes } = req.body ?? {};
    if (!validDate(date)) return res.status(400).json({ error: 'Data inválida (AAAA-MM-DD)' });
    res.status(201).json({ id: db.createSession(date, String(notes ?? '')) });
  }));

  app.get('/api/sessions/:id', wrap((req, res) => {
    const s = db.getSession(Number(req.params.id));
    s ? res.json(s) : res.status(404).json({ error: 'Sessão não encontrada' });
  }));

  app.delete('/api/sessions/:id', wrap((req, res) => { db.deleteSession(Number(req.params.id)); res.status(204).end(); }));

  app.put('/api/sessions/:id/shots', wrap((req, res) => {
    const id = Number(req.params.id);
    if (!db.getSession(id)) return res.status(404).json({ error: 'Sessão não encontrada' });
    const { shots, date, notes } = req.body ?? {};
    if (!Array.isArray(shots)) return res.status(400).json({ error: 'shots em falta' });
    const clean = shots.map((s) => Object.fromEntries(METRICS.map((m) => [m, Number.isFinite(Number(s?.[m])) && s?.[m] !== null && s?.[m] !== '' ? Number(s[m]) : null])));
    db.replaceShots(id, clean);
    if (validDate(date)) db.updateSession(id, date, String(notes ?? ''));
    res.json({ saved: clean.length });
  }));

  // Extrai shots das fotos; nada é guardado até o utilizador rever e confirmar.
  app.post('/api/extract', upload.array('photos', 20), async (req, res) => {
    if (!req.files?.length) return res.status(400).json({ error: 'Nenhuma foto enviada' });
    try {
      res.json({ shots: await extractShots(req.files) });
    } catch (e) {
      res.status(502).json({ error: `Falha na extração: ${e.message}` });
    }
  });

  app.get('/api/sessions/:id/analysis', wrap((req, res) => {
    const r = analyze(db.listSessions(), Number(req.params.id));
    r ? res.json(r) : res.status(404).json({ error: 'Sessão não encontrada' });
  }));

  app.get('/api/evolution', wrap((req, res) => res.json(evolution(db.listSessions()))));
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => console.log(`Golf Tracker em http://localhost:${port}`));
}
