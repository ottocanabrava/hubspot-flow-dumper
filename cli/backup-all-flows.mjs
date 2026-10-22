/**
 * Backup de TODOS os workflows via Automation API v4.
 *
 * Requer Private App com scope `automation`:
 *   $env:HUBSPOT_TOKEN = "pat-na1-..."
 *   node cli/backup-all-flows.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const token = process.env.HUBSPOT_TOKEN;
if (!token) {
  console.error('Defina HUBSPOT_TOKEN (Private App com scope automation)');
  process.exit(1);
}

const BASE = 'https://api.hubapi.com';
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function api(method, urlPath, body) {
  const r = await fetch(BASE + urlPath, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`${method} ${urlPath} → ${r.status} ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

async function listAllFlows() {
  const all = [];
  let after = undefined;
  for (;;) {
    const q = new URLSearchParams({ limit: '100' });
    if (after) q.set('after', after);
    const page = await api('GET', `/automation/v4/flows?${q}`);
    all.push(...(page.results || []));
    after = page.paging && page.paging.next && page.paging.next.after;
    if (!after) break;
  }
  return all;
}

async function batchRead(ids) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  const full = [];
  for (const chunk of chunks) {
    const body = {
      inputs: chunk.map((flowId) => ({ flowId: String(flowId), type: 'FLOW_ID' })),
    };
    try {
      const res = await api('POST', '/automation/v4/flows/batch/read', body);
      full.push(...(res.results || []));
    } catch (e) {
      console.warn('batch/read falhou, fallback GET individual:', e.message);
      for (const flowId of chunk) {
        try {
          full.push(await api('GET', `/automation/v4/flows/${flowId}`));
        } catch (err) {
          console.warn('  skip', flowId, err.message);
        }
      }
    }
  }
  return full;
}

const day = new Date().toISOString().slice(0, 10);
const outDir = path.join(__dirname, '..', 'output', `backup-${day}`);
fs.mkdirSync(outDir, { recursive: true });

console.log('Listando flows…');
const listed = await listAllFlows();
console.log(`Encontrados: ${listed.length}`);

const ids = listed.map((f) => f.id || f.flowId).filter(Boolean);
console.log('Baixando definições…');
const defs = await batchRead(ids);

const manifest = [];
for (const flow of defs) {
  const id = flow.id || flow.flowId;
  const file = `flow-${id}.json`;
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(flow, null, 2));
  manifest.push({
    flowId: id,
    name: flow.name,
    isEnabled: flow.isEnabled,
    objectTypeId: flow.objectTypeId,
    revisionId: flow.revisionId,
    file,
  });
}

fs.writeFileSync(
  path.join(outDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);
fs.writeFileSync(
  path.join(outDir, 'manifest.csv'),
  'flowId,name,isEnabled,file\n' +
    manifest
      .map(
        (m) =>
          `${m.flowId},"${(m.name || '').replace(/"/g, '""')}",${m.isEnabled},${m.file}`
      )
      .join('\n')
);

console.log(`OK → ${outDir} (${manifest.length} arquivos)`);
