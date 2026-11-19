import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShots } from '../src/extract.js';

test('parseShots aceita JSON em bloco markdown e normaliza valores', () => {
  const r = parseShots('```json\n{"shots":[{"flat_carry":"150,5","total_distance":160,"ball_speed":"x"}]}\n```');
  assert.equal(r.length, 1);
  assert.equal(r[0].flat_carry, 150.5);
  assert.equal(r[0].ball_speed, null);
});

test('parseShots descarta shots vazios e rejeita lixo', () => {
  assert.equal(parseShots('{"shots":[{}, {"apex":20}]}').length, 1);
  assert.throws(() => parseShots('sem json'));
});
