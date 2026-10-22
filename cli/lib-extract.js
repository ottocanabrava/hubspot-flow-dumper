const fs = require('fs');
const path = require('path');

function findCode(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const keys = [
    'sourceCode',
    'code',
    'script',
    'pythonCode',
    'javascriptCode',
    'customCode',
    'source',
  ];
  for (const k of keys) {
    if (typeof meta[k] === 'string' && meta[k].length > 20) {
      return {
        lang: meta.language || meta.runtime || guessLang(meta[k]),
        code: meta[k],
      };
    }
  }
  for (const v of Object.values(meta)) {
    if (v && typeof v === 'object') {
      const nested = findCode(v);
      if (nested) return nested;
    }
  }
  return null;
}

function guessLang(code) {
  if (/^def main\(|import os|requests\./m.test(code)) return 'py';
  if (/exports\.main|require\(|async \(event/.test(code)) return 'js';
  return 'txt';
}

function summarizeFilter(fb) {
  if (!fb) return null;
  const out = [];
  (function walk(f) {
    if (!f) return;
    (f.filters || []).forEach((x) =>
      out.push({
        prop: x.property || x.propertyName || x.name,
        op: (x.operation && x.operation.operator) || x.operator,
        vals: (x.operation && x.operation.values) || x.values || x.value,
      })
    );
    (f.filterBranches || []).forEach(walk);
  })(fb);
  return out.slice(0, 8);
}

function branchInfo(a) {
  const c = a.connection || {};
  if (c.connections) {
    return c.connections.map((x) => ({
      value: x.value,
      next: x.connection && x.connection.nextActionId,
    }));
  }
  if (c.listBranches) {
    const items = c.listBranches.map((lb) => ({
      listId: lb.listId,
      next: lb.connection && lb.connection.nextActionId,
      filter: summarizeFilter(lb.filterBranch),
    }));
    const def =
      c.defaultBranchConnection && c.defaultBranchConnection.nextActionId;
    if (def) items.push({ default: true, next: def });
    return items;
  }
  return [];
}

function setPropSummary(a) {
  const m = a.metadata || {};
  if (m.targetProperty && m.value) {
    const prop = m.targetProperty.propertyName;
    let val = '';
    if (m.value.type === 'STATIC_VALUE') val = String(m.value.value);
    else if (m.value.type === 'OBJECT_PROPERTY')
      val = '← ' + m.value.propertyName;
    else if (m.value.value) val = String(m.value.value);
    return { props: [prop], vals: [val] };
  }
  const s = JSON.stringify(m);
  const props = [...s.matchAll(/"propertyName":"([^"]+)"/g)].map((x) => x[1]);
  const vals = [...s.matchAll(/"value":"((?:\\.|[^"\\])*)"/g)]
    .map((x) => x[1])
    .filter((v) => v.length < 200);
  return { props: [...new Set(props)], vals: [...new Set(vals)].slice(0, 3) };
}

function walkTree(actions, id, depth, seen, lines) {
  if (id == null || seen.has(id)) return;
  seen.add(id);
  const a = actions[id];
  const pad = '  '.repeat(depth);
  if (!a) {
    lines.push(pad + '- MISSING #' + id);
    return;
  }

  if (a.actionType === 'STATIC_BRANCH' || a.actionType === 'LIST_BRANCH') {
    lines.push(pad + `- **#${id} ${a.actionType}**`);
    const iv = a.metadata && a.metadata.inputValue;
    if (iv)
      lines.push(pad + `  - baseado em: \`${JSON.stringify(iv).slice(0, 180)}\``);
    for (const b of branchInfo(a)) {
      lines.push(pad + `  - ramo: \`${JSON.stringify(b).slice(0, 220)}\``);
      if (b.next) walkTree(actions, b.next, depth + 2, seen, lines);
    }
    return;
  }

  if (a.actionType === 'SET_PROPERTY') {
    const { props, vals } = setPropSummary(a);
    lines.push(
      pad +
        `- **#${id} SET_PROPERTY** \`${props.join(',')}\` = \`${vals.join(' | ')}\``
    );
    const next = a.connection && a.connection.nextActionId;
    if (next) walkTree(actions, next, depth, seen, lines);
    return;
  }

  if (a.actionType === 'DELAY') {
    lines.push(
      pad +
        `- **#${id} DELAY** \`${JSON.stringify(a.metadata && a.metadata.delay).slice(0, 120)}\``
    );
    const next = a.connection && a.connection.nextActionId;
    if (next) walkTree(actions, next, depth, seen, lines);
    return;
  }

  const code = findCode(a.metadata);
  if (code) {
    lines.push(
      pad +
        `- **#${id} ${a.actionType}** _(código ${code.lang} — ver arquivo separado)_`
    );
  } else {
    lines.push(pad + `- **#${id} ${a.actionType}**`);
  }
  const next = a.connection && a.connection.nextActionId;
  if (next) walkTree(actions, next, depth, seen, lines);
}

function writeSummary(flow, outPath) {
  const actions = flow.actions || {};
  const lines = [
    `# ${flow.name || 'sem-nome'}`,
    '',
    `- **flowId:** ${flow.flowId}`,
    `- **enabled:** ${flow.isEnabled}`,
    `- **object:** ${flow.flowObjectType}`,
    `- **firstActionId:** ${flow.firstActionId}`,
    `- **actions:** ${Object.keys(actions).length}`,
    `- **shouldReenroll:** ${flow.shouldReenroll}`,
    '',
    '## Enrollment',
    '```json',
    JSON.stringify(flow.enrollmentCriteria || flow.enrollmentTrigger, null, 2).slice(
      0,
      4000
    ),
    '```',
    '',
    '## Árvore',
    '',
  ];
  walkTree(actions, flow.firstActionId, 0, new Set(), lines);
  fs.writeFileSync(outPath, lines.join('\n'));
}

function extractCodes(flow, outDir) {
  let n = 0;
  const actions = flow.actions || {};
  for (const [id, a] of Object.entries(actions)) {
    const found = findCode(a.metadata);
    if (!found) continue;
    n++;
    const ext = found.lang === 'py' ? 'py' : found.lang === 'js' ? 'js' : 'txt';
    const file = path.join(
      outDir,
      `flow-${flow.flowId}-code-action-${id}.${ext}`
    );
    fs.writeFileSync(file, found.code);
  }
  return n;
}

module.exports = { findCode, writeSummary, extractCodes, walkTree };
