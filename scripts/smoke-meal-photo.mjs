// Teste real do adapter meal-photo com fotos do proprio fundador.
// Uso:
//   1) npm run build && node dist/main > /tmp/selah-smoke.log 2>&1     (outro terminal, .env local)
//   2) SELAH_LOG_FILE=/tmp/selah-smoke.log node scripts/smoke-meal-photo.mjs foto1.jpg foto2.jpg ...
// Variaveis: SELAH_BASE_URL (padrao http://localhost:3010), SELAH_API_KEY (padrao selah-dev-key),
// SELAH_SOURCE_APP (padrao BalancoGorduraBack), SELAH_LOG_FILE (para ler tokens do log do servidor).
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, basename } from 'node:path';

const BASE = (process.env.SELAH_BASE_URL || 'http://localhost:3010').replace(/\/+$/, '');
const KEY = process.env.SELAH_API_KEY || 'selah-dev-key';
const SOURCE = process.env.SELAH_SOURCE_APP || 'BalancoGorduraBack';
const LOG_FILE = process.env.SELAH_LOG_FILE || '';
const MAX_BYTES = 2_000_000;
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Passe os caminhos das fotos (as suas, ate ~2 MB cada).');
  process.exit(1);
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

const tokensFromLog = (requestId) => {
  if (!LOG_FILE || !existsSync(LOG_FILE)) return null;
  const lines = readFileSync(LOG_FILE, 'utf8').split('\n').filter((l) => l.includes(`[${requestId}]`));
  const done = lines.find((l) => l.includes('Gemini request completed'));
  const match = done?.match(/tokens\(prompt=(\d+), candidate=(\d+), total=(\d+), thoughts=(\d+)\)/);
  const attempts = done?.match(/attempts=(\d+)/)?.[1];
  const retried = lines.filter((l) => l.includes('will retry')).length;
  if (!match) return { retried };
  return {
    prompt: Number(match[1]),
    candidate: Number(match[2]),
    thoughts: Number(match[4]),
    attempts: Number(attempts || 1),
    retried,
  };
};

const rows = [];
for (const [index, file] of files.entries()) {
  const mimeType = MIME[extname(file).toLowerCase()];
  if (!mimeType || !existsSync(file)) {
    console.error(`pulando ${file}: arquivo inexistente ou tipo nao suportado (jpg, png, webp)`);
    continue;
  }
  const size = statSync(file).size;
  if (size > MAX_BYTES) {
    console.error(`pulando ${basename(file)}: ${(size / 1e6).toFixed(2)} MB (acima de ~2 MB; reduza a foto)`);
    continue;
  }
  const requestId = `smoke-${Date.now()}-${index}`;
  const startedAt = Date.now();
  let status = 'erro-de-rede';
  let http = 0;
  let detail = '';
  try {
    const res = await fetch(`${BASE}/v1/adapters/balancogordura/meal-photo/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Selah-Api-Key': KEY,
        'X-Source-App': SOURCE,
        'X-Request-Id': requestId,
      },
      body: JSON.stringify({
        mimeType,
        imageBase64: readFileSync(file).toString('base64'),
        localeHint: 'pt-BR',
      }),
    });
    http = res.status;
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      status = json.status;
      detail = (json.items || [])
        .map((i) => `${i.foodKey === 'outro' ? `outro:${i.otherLabel}` : i.foodKey}/${i.preparo} ${i.grams.low}-${i.grams.mid}-${i.grams.high}g (${i.confidence})`)
        .join('; ');
      if (json.questions?.length) detail += ` | perguntas: ${json.questions.map((q) => `${q.id}@${q.itemIndex}`).join(', ')}`;
    } else {
      status = `HTTP ${res.status}`;
      detail = String(json.message || '').slice(0, 160);
    }
  } catch (error) {
    detail = String(error.message).slice(0, 160);
  }
  const latencyMs = Date.now() - startedAt;
  rows.push({ file: basename(file), kb: Math.round(size / 1024), http, status, latencyMs, tokens: tokensFromLog(requestId), detail });
  console.log(`[${index + 1}/${files.length}] ${basename(file)} -> ${http} ${status} em ${latencyMs} ms`);
  if (detail) console.log(`      ${detail}`);
}

const ok = rows.filter((r) => r.http === 200);
const latencies = ok.map((r) => r.latencyMs);
console.log('\n=== Resumo ===');
console.log(`fotos enviadas: ${rows.length} | respostas 200: ${ok.length} | 429: ${rows.filter((r) => r.http === 429).length} | 5xx: ${rows.filter((r) => r.http >= 500).length}`);
if (latencies.length) console.log(`latencia p50: ${percentile(latencies, 50)} ms | maxima: ${Math.max(...latencies)} ms`);
const withTokens = rows.filter((r) => r.tokens?.prompt !== undefined);
if (withTokens.length) {
  const avg = (key) => Math.round(withTokens.reduce((s, r) => s + r.tokens[key], 0) / withTokens.length);
  console.log(`tokens medios por foto: entrada=${avg('prompt')} saida=${avg('candidate')} raciocinio=${avg('thoughts')} (n=${withTokens.length})`);
} else {
  console.log('tokens: indisponiveis (passe SELAH_LOG_FILE com o log do servidor)');
}
const retried = rows.reduce((s, r) => s + (r.tokens?.retried || 0), 0);
if (retried) console.log(`tentativas repetidas pelo provedor (429/5xx): ${retried}`);
