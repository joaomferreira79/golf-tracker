# Golf Tracker

Web app (mobile-friendly, em português) para registar treinos de driving range: carregas fotos do resumo de shots no fim do treino, a IA extrai as métricas (flat carry, distância total, ball speed, launch, apex, landing), revês/corriges os valores e a app compara o treino com o anterior e com a média histórica, com deltas e gráficos de evolução.

## Requisitos
- Node.js ≥ 22.5 (usa `node:sqlite` e `node:test`; testado em Node 26)

## Correr
```
npm install
copy .env.example .env     # (Linux/macOS: cp)
npm start
```
Abre http://localhost:3000 (no telemóvel, usa o IP do PC na mesma rede).

## Extração por IA (configurável)
Edita `.env` (nunca vai para o git):

| Variável | Descrição |
|---|---|
| `VISION_PROVIDER` | `openai`, `anthropic` ou `mock` (valores aleatórios de exemplo, sem chave; por defeito) |
| `VISION_API_KEY` | chave do provider |
| `VISION_MODEL` | opcional (defaults `gpt-4o-mini` / `claude-sonnet-4-5`) |

As fotos são enviadas ao provider escolhido só para extração e não são guardadas. Os valores extraídos aparecem sempre numa tabela editável; só são gravados quando clicas em **Guardar**.

## Fluxo
Criar treino → carregar fotos → extrair → rever/corrigir → guardar → análise (atual vs anterior vs média histórica, excluindo o treino atual) e gráficos em **Evolução**.

## Dados
SQLite local em `data/golf.db`.

## Testes
```
npm test
```
Cobrem a lógica de comparação/estatísticas (`src/stats.js`) e o parsing da resposta da IA (`src/extract.js`).

## API
`GET/POST /api/sessions`, `GET/DELETE /api/sessions/:id`, `PUT /api/sessions/:id/shots`, `POST /api/extract` (multipart `photos`), `GET /api/sessions/:id/analysis`, `GET /api/evolution`.

