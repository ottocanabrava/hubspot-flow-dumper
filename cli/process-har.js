/**
 * Extrai todos os hybrid/{flowId} de um HAR exportado do DevTools.
 *
 *   node cli/process-har.js "%USERPROFILE%\Downloads\app.hubspot.com.har"
 *   node cli/process-har.js caminho.har output/minha-pasta   (opcional)
 */
const fs = require('fs');
const path = require('path');

const harPath = process.argv[2];
if (!harPath || !fs.existsSync(harPath)) {
  console.error('Uso: node cli/process-har.js <caminho.har> [pasta-saida]');
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const outDir =
  process.argv[3] ||
  path.join(__dirname, '..', 'output', `har-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const har = JSON.parse(fs.readFileSync(harPath, 'utf8'));
const byId = new Map();

for (const e of har.log.entries) {
  const url = e.request.url || '';
  const m = url.match(/\/api\/automationplatform\/v1\/hybrid\/(\d+)/);
  if (!m) continue;
  if (e.response.status !== 200) continue;
  const text = e.response.content && e.response.content.text;
  if (!text || text.length < 500) continue;
  let body = text;
  if (e.response.content.encoding === 'base64') {
    body = Buffer.from(text, 'base64').toString('utf8');
  }
  try {
    const obj = JSON.parse(body);
    const prev = byId.get(m[1]);
    if (!prev || body.length > prev.raw.length) {
      byId.set(m[1], { obj, raw: body });
    }
  } catch {
    /* ignore */
  }
}

if (byId.size === 0) {
  console.error(
    'Nenhum hybrid encontrado no HAR. Abra o(s) workflow(s) com Network gravando e exporte de novo.'
  );
  process.exit(2);
}

const { extractCodes, writeSummary } = require('./lib-extract');

for (const [id, { obj }] of byId) {
  const jsonPath = path.join(outDir, `flow-${id}-hybrid.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(obj, null, 2));
  writeSummary(obj, path.join(outDir, `flow-${id}-summary.md`));
  const n = extractCodes(obj, outDir);
  console.log(
    `OK ${id} — ${obj.name} — ${Object.keys(obj.actions || {}).length} actions — ${n} code file(s)`
  );
}

console.log(`\nTotal: ${byId.size} fluxo(s) → ${outDir}`);
