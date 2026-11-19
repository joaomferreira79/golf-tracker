import { METRICS } from './stats.js';

const PROMPT = `Estas imagens são ecrãs de resumo de shots de um software de driving range de golfe.
Extrai TODOS os shots visíveis. Responde APENAS com JSON: {"shots":[{"flat_carry":n,"total_distance":n,"ball_speed":n,"launch":n,"apex":n,"landing":n}]}.
Usa números (sem unidades) e null quando um valor não for legível. Não inventes valores.`;

/** Valida/normaliza a resposta do modelo: aceita JSON em texto (com ou sem ```), devolve shots limpos. */
export function parseShots(text) {
  const match = String(text ?? '').match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error('Resposta sem JSON');
  let data = JSON.parse(match[0]);
  if (Array.isArray(data)) data = { shots: data };
  if (!Array.isArray(data.shots)) throw new Error('Resposta sem lista "shots"');
  return data.shots
    .filter((s) => s && typeof s === 'object')
    .map((s) => {
      const out = {};
      for (const m of METRICS) {
        const n = typeof s[m] === 'string' ? parseFloat(s[m].replace(',', '.')) : s[m];
        out[m] = typeof n === 'number' && Number.isFinite(n) ? n : null;
      }
      return out;
    })
    .filter((s) => METRICS.some((m) => s[m] !== null));
}

const dataUrl = (f) => `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;

async function post(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Provider ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const providers = {
  async openai(files, { key, model }) {
    const j = await post('https://api.openai.com/v1/chat/completions', { authorization: `Bearer ${key}` }, {
      model: model || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, ...files.map((f) => ({ type: 'image_url', image_url: { url: dataUrl(f) } }))] }],
    });
    return j.choices[0].message.content;
  },
  async anthropic(files, { key, model }) {
    const j = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, {
      model: model || 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: [...files.map((f) => ({ type: 'image', source: { type: 'base64', media_type: f.mimetype, data: f.buffer.toString('base64') } })), { type: 'text', text: PROMPT }] }],
    });
    return j.content.map((c) => c.text ?? '').join('');
  },
  async mock() {
    const r = (a, b) => Math.round((a + Math.random() * (b - a)) * 10) / 10;
    return JSON.stringify({ shots: Array.from({ length: 5 }, () => ({ flat_carry: r(120, 160), total_distance: r(130, 175), ball_speed: r(95, 115), launch: r(10, 18), apex: r(18, 30), landing: r(35, 50) })) });
  },
};

export async function extractShots(files, env = process.env) {
  const name = (env.VISION_PROVIDER || 'mock').toLowerCase();
  const provider = providers[name];
  if (!provider) throw new Error(`VISION_PROVIDER inválido: ${name}`);
  if (name !== 'mock' && !env.VISION_API_KEY) throw new Error('VISION_API_KEY não definida');
  return parseShots(await provider(files, { key: env.VISION_API_KEY, model: env.VISION_MODEL }));
}
