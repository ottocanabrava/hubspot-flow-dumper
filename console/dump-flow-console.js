/**
 * Cole este arquivo INTEIRO no Console do Chrome (F12),
 * com o workflow aberto no HubSpot (URL .../flow/{id}/edit).
 *
 * Baixa: hybrid JSON + summary.md + arquivos de código custom.
 */
(async () => {
  const flowMatch = location.pathname.match(/\/flow\/(\d+)/);
  if (!flowMatch) {
    alert('Abra um workflow no editor (URL com /flow/ID/edit)');
    return;
  }
  const flowId = flowMatch[1];
  const portalMatch =
    location.pathname.match(/\/workflows\/(\d+)/) ||
    location.pathname.match(/\/automation\/(\d+)/);
  const portalId =
    (portalMatch && portalMatch[1]) ||
    new URLSearchParams(location.search).get('portalId');
  if (!portalId) {
    alert(
      'portalId não encontrado na URL.\nAbra o workflow pelo menu Automações (/workflows/SEU_PORTAL/...).'
    );
    return;
  }

  const csrfRaw = document.cookie.match(/(?:^|;\s*)csrf\.app=([^;]*)/);
  if (!csrfRaw) {
    alert('Cookie csrf.app não encontrado — você está logado?');
    return;
  }
  const csrf = decodeURIComponent(csrfRaw[1]);

  async function api(path) {
    const url = path.includes('?')
      ? `${path}&portalId=${portalId}`
      : `${path}?portalId=${portalId}`;
    const r = await fetch(url, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-HubSpot-CSRF-hubspotapi': csrf,
      },
    });
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { ok: r.ok, status: r.status, data };
  }

  function sanitizeFolderName(name) {
    return String(name || 'sem-nome')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'sem-nome';
  }

  function download(prefix, filename, content, mime = 'application/json') {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = prefix + '_' + filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
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
        return { lang: meta.language || meta.runtime || guessLang(meta[k]), code: meta[k] };
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

  console.log('%c Dump flow ' + flowId + '…', 'color:#ff7a59;font-weight:bold');

  const hybrid = await api(`/api/automationplatform/v1/hybrid/${flowId}`);
  if (!hybrid.ok) {
    console.error(hybrid);
    alert('Falha ao baixar hybrid: HTTP ' + hybrid.status + '\nVeja o Console.');
    return;
  }

  const flow = hybrid.data;
  const name = flow.name || 'sem-nome';
  const actions = flow.actions || {};
  const actionCount = Object.keys(actions).length;
  const prefix = `flow-${flowId}_${sanitizeFolderName(name)}`;

  download(prefix, 'hybrid.json', JSON.stringify(flow, null, 2));

  const lines = [
    `# ${name}`,
    '',
    `- **flowId:** ${flowId}`,
    `- **enabled:** ${flow.isEnabled}`,
    `- **object:** ${flow.flowObjectType}`,
    `- **firstActionId:** ${flow.firstActionId}`,
    `- **actions:** ${actionCount}`,
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
  download(prefix, 'summary.md', lines.join('\n'), 'text/markdown');

  let codeFiles = 0;
  for (const [id, a] of Object.entries(actions)) {
    const found = findCode(a.metadata);
    if (!found) continue;
    codeFiles++;
    const ext = found.lang === 'py' ? 'py' : found.lang === 'js' ? 'js' : 'txt';
    download(prefix, `code-action-${id}.${ext}`, found.code, 'text/plain');
  }

  const extras = [
    `/api/automationplatform/v1/output-fields/flow/${flowId}/allOutputs`,
    `/api/automationapps/v1/flow-crm-objects/${flowId}`,
  ];
  for (const path of extras) {
    try {
      const res = await api(path);
      if (res.ok) {
        const short = path.split('/').pop();
        download(prefix, `${short}.json`, JSON.stringify(res.data, null, 2));
      }
    } catch (e) {
      console.warn('extra falhou', path, e);
    }
  }

  console.log('%c OK', 'color:green;font-weight:bold', {
    name,
    flowId,
    prefix,
    actions: actionCount,
    codeFiles,
  });
  alert(
    `Dump OK\n\n${name}\nID ${flowId}\n${actionCount} ações\n${codeFiles} arquivo(s) de código\n\nArquivos: Downloads\\${prefix}_*`
  );
})();
