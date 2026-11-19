import test from 'node:test';
import assert from 'node:assert/strict';
import { average, delta, sessionAverages, analyze, evolution } from '../src/stats.js';

const shot = (c, s = 100) => ({ flat_carry: c, total_distance: c + 10, ball_speed: s, launch: 12, apex: 20, landing: 40 });
const sessions = [
  { id: 3, date: '2026-03-01', shots: [shot(180), shot(200)] },
  { id: 1, date: '2026-01-01', shots: [shot(100), shot(120)] },
  { id: 2, date: '2026-02-01', shots: [shot(140), shot(160)] },
];

test('average ignora nulos e devolve null se vazio', () => {
  assert.equal(average([10, null, undefined, 20, NaN]), 15);
  assert.equal(average([]), null);
});

test('delta absoluto e percentual', () => {
  assert.deepEqual(delta(110, 100), { abs: 10, pct: 10 });
  assert.deepEqual(delta(5, 0), { abs: 5, pct: null });
  assert.deepEqual(delta(null, 5), { abs: null, pct: null });
});

test('sessionAverages por métrica', () => {
  const a = sessionAverages([shot(100), { ...shot(200), launch: null }]);
  assert.equal(a.flat_carry, 150);
  assert.equal(a.launch, 12);
});

test('analyze compara com anterior (por data) e média histórica sem a atual', () => {
  const r = analyze(sessions, 3);
  assert.equal(r.previous.id, 2);
  assert.equal(r.previous.comparison.flat_carry.value, 150);
  assert.equal(r.previous.comparison.flat_carry.abs, 40);
  assert.equal(r.history.sessionCount, 2);
  assert.equal(r.history.shotCount, 4);
  assert.equal(r.history.comparison.flat_carry.value, 130);
  assert.equal(r.history.comparison.flat_carry.abs, 60);
});

test('analyze primeira sessão não tem comparações', () => {
  const r = analyze(sessions, 1);
  assert.equal(r.previous, null);
  assert.equal(r.history, null);
  assert.equal(analyze(sessions, 99), null);
});

test('analyze ignora sessões anteriores sem shots', () => {
  const r = analyze([{ id: 1, date: '2026-01-01', shots: [shot(100)] }, { id: 2, date: '2026-01-02', shots: [] }, { id: 3, date: '2026-01-03', shots: [shot(110)] }], 3);
  assert.equal(r.previous.id, 1);
});

test('evolution ordenada por data e sem sessões vazias', () => {
  const e = evolution([...sessions, { id: 4, date: '2026-04-01', shots: [] }]);
  assert.deepEqual(e.map((x) => x.id), [1, 2, 3]);
});
