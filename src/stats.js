export const METRICS = ['flat_carry', 'total_distance', 'ball_speed', 'launch', 'apex', 'landing'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function average(values) {
  const nums = values.filter(isNum);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

export function sessionAverages(shots) {
  const out = {};
  for (const m of METRICS) out[m] = average(shots.map((s) => s[m]));
  return out;
}

export function delta(current, base) {
  if (!isNum(current) || !isNum(base)) return { abs: null, pct: null };
  const abs = current - base;
  return { abs, pct: base === 0 ? null : (abs / Math.abs(base)) * 100 };
}

function compare(currentAvg, baseAvg) {
  const out = {};
  for (const m of METRICS) out[m] = { value: baseAvg[m], ...delta(currentAvg[m], baseAvg[m]) };
  return out;
}

const byDate = (a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1);

/**
 * sessions: [{id, date, shots: [...]}]. Compara a sessão `currentId` com a
 * anterior (cronologicamente) e com a média de todas as sessões anteriores.
 */
export function analyze(sessions, currentId) {
  const sorted = [...sessions].sort(byDate);
  const idx = sorted.findIndex((s) => s.id === currentId);
  if (idx < 0) return null;
  const current = sorted[idx];
  const earlier = sorted.slice(0, idx).filter((s) => s.shots.length);
  const currentAvg = sessionAverages(current.shots);

  const previous = earlier.length ? earlier[earlier.length - 1] : null;
  const previousAvg = previous ? sessionAverages(previous.shots) : null;
  const historyShots = earlier.flatMap((s) => s.shots);
  const historicAvg = historyShots.length ? sessionAverages(historyShots) : null;

  return {
    current: { id: current.id, date: current.date, shotCount: current.shots.length, averages: currentAvg },
    previous: previous
      ? { id: previous.id, date: previous.date, shotCount: previous.shots.length, comparison: compare(currentAvg, previousAvg) }
      : null,
    history: historicAvg
      ? { sessionCount: earlier.length, shotCount: historyShots.length, comparison: compare(currentAvg, historicAvg) }
      : null,
  };
}

/** Série de evolução: média por sessão, ordenada por data. */
export function evolution(sessions) {
  return [...sessions]
    .sort(byDate)
    .filter((s) => s.shots.length)
    .map((s) => ({ id: s.id, date: s.date, shotCount: s.shots.length, averages: sessionAverages(s.shots) }));
}
