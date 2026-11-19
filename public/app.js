const METRICS = [
  ['flat_carry', 'Flat carry', 'm'], ['total_distance', 'Distância total', 'm'], ['ball_speed', 'Vel. bola', 'km/h'],
  ['launch', 'Launch', '°'], ['apex', 'Apex', 'm'], ['landing', 'Landing', '°'],
];
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n, d = 1) => (n == null ? '–' : Number(n).toFixed(d));
const api = async (url, opts) => {
  const r = await fetch(url, opts);
  if (r.status === 204) return null;
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
};
const json = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const today = () => new Date().toISOString().slice(0, 10);
let charts = [];

async function route() {
  charts.forEach((c) => c.destroy()); charts = [];
  const h = location.hash.slice(1) || '/';
  try {
    if (h === '/') await listView();
    else if (h === '/evolucao') await evolutionView();
    else if (h.startsWith('/sessao/')) await sessionView(Number(h.split('/')[2]));
    else if (h.startsWith('/analise/')) await analysisView(Number(h.split('/')[2]));
  } catch (e) { app.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

async function listView() {
  const sessions = await api('/api/sessions');
  app.innerHTML = `
    <div class="card"><h2>Novo treino</h2>
      <label>Data <input type="date" id="date" value="${today()}"></label>
      <label>Notas <textarea id="notes" rows="2" placeholder="Ex.: ferro 7, foco no tempo de swing"></textarea></label>
      <button id="create">Criar treino</button></div>
    <div class="card"><h2>Treinos</h2><ul>${sessions.map((s) => `
      <li class="item"><b>${esc(s.date)}</b> · ${s.shotCount} shots ${s.notes ? `· <span class="muted">${esc(s.notes)}</span>` : ''}<br>
      <a href="#/sessao/${s.id}">Editar/fotos</a> · <a href="#/analise/${s.id}">Análise</a> · <a href="#" data-del="${s.id}">Apagar</a></li>`).join('') || '<li class="muted">Ainda sem treinos.</li>'}</ul></div>`;
  document.getElementById('create').onclick = async () => {
    const { id } = await api('/api/sessions', json('POST', { date: date.value, notes: notes.value }));
    location.hash = `#/sessao/${id}`;
  };
  app.querySelectorAll('[data-del]').forEach((a) => a.onclick = async (e) => {
    e.preventDefault();
    if (confirm('Apagar este treino?')) { await api(`/api/sessions/${a.dataset.del}`, { method: 'DELETE' }); route(); }
  });
}

async function sessionView(id) {
  const s = await api(`/api/sessions/${id}`);
  let shots = s.shots.map((x) => ({ ...x }));
  app.innerHTML = `
    <div class="card"><h2>Treino</h2>
      <label>Data <input type="date" id="date" value="${esc(s.date)}"></label>
      <label>Notas <textarea id="notes" rows="2">${esc(s.notes)}</textarea></label></div>
    <div class="card"><h2>Fotografias do resumo</h2>
      <input type="file" id="photos" accept="image/*" multiple>
      <button id="extract">Extrair shots com IA</button> <span id="status" class="muted"></span>
      <p class="muted">Os valores extraídos devem ser revistos antes de guardar. Extrair acrescenta shots à tabela abaixo.</p></div>
    <div class="card"><h2>Revisão dos shots</h2><div class="table-wrap" id="tbl"></div>
      <button class="sec" id="add">+ Adicionar shot</button>
      <button id="save">Guardar e ver análise</button> <span id="msg" class="err"></span></div>`;
  const render = () => {
    document.getElementById('tbl').innerHTML = `<table><tr><th>#</th>${METRICS.map((m) => `<th>${m[1]} (${m[2]})</th>`).join('')}<th></th></tr>
      ${shots.map((sh, i) => `<tr><td>${i + 1}</td>${METRICS.map((m) => `<td><input type="number" step="0.1" data-i="${i}" data-m="${m[0]}" value="${sh[m[0]] ?? ''}"></td>`).join('')}<td><button class="sec" data-rm="${i}">✕</button></td></tr>`).join('')}</table>`;
    tbl.querySelectorAll('input').forEach((inp) => inp.oninput = () => { shots[inp.dataset.i][inp.dataset.m] = inp.value === '' ? null : Number(inp.value); });
    tbl.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { shots.splice(Number(b.dataset.rm), 1); render(); });
  };
  render();
  document.getElementById('add').onclick = () => { shots.push(Object.fromEntries(METRICS.map((m) => [m[0], null]))); render(); };
  document.getElementById('extract').onclick = async () => {
    if (!photos.files.length) return (status.textContent = 'Escolhe fotos primeiro.');
    const fd = new FormData();
    [...photos.files].forEach((f) => fd.append('photos', f));
    status.textContent = 'A extrair…';
    try {
      const r = await api('/api/extract', { method: 'POST', body: fd });
      shots = shots.concat(r.shots); render(); status.textContent = `${r.shots.length} shots extraídos. Revê os valores.`;
    } catch (e) { status.textContent = e.message; }
  };
  document.getElementById('save').onclick = async () => {
    try {
      await api(`/api/sessions/${id}/shots`, json('PUT', { shots, date: date.value, notes: notes.value }));
      location.hash = `#/analise/${id}`;
    } catch (e) { msg.textContent = e.message; }
  };
}

function deltaCell(c, unit) {
  if (!c || c.abs == null) return '<td>–</td><td></td>';
  const cls = c.abs >= 0 ? 'up' : 'down';
  return `<td>${fmt(c.value)}</td><td class="${cls}">${c.abs >= 0 ? '+' : ''}${fmt(c.abs)} ${unit}${c.pct != null ? ` (${c.pct >= 0 ? '+' : ''}${fmt(c.pct)}%)` : ''}</td>`;
}

async function analysisView(id) {
  const [a, evo] = await Promise.all([api(`/api/sessions/${id}/analysis`), api('/api/evolution')]);
  if (!a.current.shotCount) { app.innerHTML = `<p>Este treino ainda não tem shots. <a href="#/sessao/${id}">Adicionar</a></p>`; return; }
  app.innerHTML = `<div class="card"><h2>Análise do treino ${esc(a.current.date)}</h2>
    <p class="muted">${a.current.shotCount} shots${a.previous ? ` · anterior: ${esc(a.previous.date)} (${a.previous.shotCount})` : ''}${a.history ? ` · histórico: ${a.history.sessionCount} treinos, ${a.history.shotCount} shots` : ''}</p>
    ${!a.previous ? '<p>Primeiro treino com dados: ainda sem comparações.</p>' : ''}
    <div class="table-wrap"><table><tr><th>Métrica</th><th>Atual</th><th>Anterior</th><th>Δ vs anterior</th><th>Média hist.</th><th>Δ vs média</th></tr>
    ${METRICS.map(([k, n, u]) => `<tr><td>${n}</td><td><b>${fmt(a.current.averages[k])}</b></td>${a.previous ? deltaCell(a.previous.comparison[k], u) : '<td>–</td><td></td>'}${a.history ? deltaCell(a.history.comparison[k], u) : '<td>–</td><td></td>'}</tr>`).join('')}</table></div></div>
    <div class="grid" id="charts"></div>`;
  drawCharts(evo, id);
}

function drawCharts(evo, highlightId) {
  const box = document.getElementById('charts');
  METRICS.forEach(([k, n, u]) => {
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<h3>${n} (${u})</h3><canvas></canvas>`; box.appendChild(card);
    charts.push(new Chart(card.querySelector('canvas'), {
      type: 'line',
      data: { labels: evo.map((e) => e.date), datasets: [{ label: `Média ${n}`, data: evo.map((e) => e.averages[k]), borderColor: '#1e5b2f', tension: .2,
        pointBackgroundColor: evo.map((e) => (e.id === highlightId ? '#e65100' : '#1e5b2f')), pointRadius: evo.map((e) => (e.id === highlightId ? 6 : 3)) }] },
      options: { plugins: { legend: { display: false } } },
    }));
  });
}

async function evolutionView() {
  const evo = await api('/api/evolution');
  app.innerHTML = evo.length ? '<div class="grid" id="charts"></div>' : '<p>Sem dados ainda.</p>';
  if (evo.length) drawCharts(evo, null);
}

window.addEventListener('hashchange', route);
route();
