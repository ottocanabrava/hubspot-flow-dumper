/**
 * Roda no contexto da página HubSpot (MAIN world).
 * Expõe window.__hsFlowDump() → Promise<{ok, name, actions, codeFiles, error?}>
 */
(function () {
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

  /**
   * Edge/Chrome: download com "pasta/arquivo" ou data: URL NÃO cria pasta de verdade.
   * Preferimos arquivo flat com prefixo identificável:
   *   flow-{id}_{nome}_hybrid.json
   */
  function download(prefix, filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = prefix + '_' + filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2500);
  }

  function getCsrf() {
    const m = document.cookie.match(/(?:^|;\s*)csrf\.app=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function parseIds() {
    const flow = location.pathname.match(/\/flow\/(\d+)/);
    const portal =
      location.pathname.match(/\/workflows\/(\d+)/) ||
      location.pathname.match(/\/automation\/(\d+)/);
    const fromQuery = new URLSearchParams(location.search).get('portalId');
    return {
      flowId: flow && flow[1],
      portalId: (portal && portal[1]) || fromQuery || null,
    };
  }

  async function api(path, portalId) {
    const csrf = getCsrf();
    if (!csrf) throw new Error('Cookie csrf.app não encontrado');
    const url = path.includes('?')
      ? path + '&portalId=' + portalId
      : path + '?portalId=' + portalId;
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
    return { ok: r.ok, status: r.status, data, text };
  }

  function findCode(meta) {
    if (!meta || typeof meta !== 'object') return null;
    const keys = [
      'sourceCode',
      'functionSource',
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
    if (/PYTHON/i.test(String(code))) return 'py';
    return 'txt';
  }

  function extFor(lang, runtime) {
    if (lang === 'py' || /PYTHON/i.test(runtime || '')) return 'py';
    if (lang === 'js' || /NODE|JS/i.test(runtime || '')) return 'js';
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
      lines.push(pad + '- **#' + id + ' ' + a.actionType + '**');
      const iv = a.metadata && a.metadata.inputValue;
      if (iv)
        lines.push(
          pad + '  - baseado em: `' + JSON.stringify(iv).slice(0, 180) + '`'
        );
      branchInfo(a).forEach((b) => {
        lines.push(pad + '  - ramo: `' + JSON.stringify(b).slice(0, 220) + '`');
        if (b.next) walkTree(actions, b.next, depth + 2, seen, lines);
      });
      return;
    }
    if (a.actionType === 'SET_PROPERTY') {
      const { props, vals } = setPropSummary(a);
      lines.push(
        pad +
          '- **#' +
          id +
          ' SET_PROPERTY** `' +
          props.join(',') +
          '` = `' +
          vals.join(' | ') +
          '`'
      );
      const next = a.connection && a.connection.nextActionId;
      if (next) walkTree(actions, next, depth, seen, lines);
      return;
    }
    if (a.actionType === 'DELAY') {
      lines.push(
        pad +
          '- **#' +
          id +
          ' DELAY** `' +
          JSON.stringify(a.metadata && a.metadata.delay).slice(0, 120) +
          '`'
      );
      const next = a.connection && a.connection.nextActionId;
      if (next) walkTree(actions, next, depth, seen, lines);
      return;
    }
    const code = findCode(a.metadata);
    lines.push(
      pad +
        '- **#' +
        id +
        ' ' +
        a.actionType +
        '**' +
        (code ? ' _(código — arquivo separado)_' : '')
    );
    const next = a.connection && a.connection.nextActionId;
    if (next) walkTree(actions, next, depth, seen, lines);
  }

  /** Tenta achar sourceCode via API v4 (sessão do browser). */
  async function tryV4Flow(flowId, portalId) {
    const paths = [
      '/api/automation/v4/flows/' + flowId,
      '/automation/v4/flows/' + flowId,
    ];
    for (const p of paths) {
      try {
        const res = await api(p, portalId);
        if (res.ok && res.data && (res.data.actions || res.data.revisionId)) {
          return res.data;
        }
      } catch (_) {
        /* next */
      }
    }
    return null;
  }

  /** Tenta baixar fonte de CUSTOM_CODE por functionId / instanceId. */
  async function tryFetchFunctionSource(meta, portalId) {
    const functionId = meta.functionId;
    const instanceId = meta.instanceId;
    const actionTypeId = meta.actionTypeId;
    const candidates = [];
    if (functionId) {
      candidates.push(
        '/api/automationscripting/v1/functions/' + functionId,
        '/api/automationplatform/v1/custom-code/functions/' + functionId,
        '/api/automationplatform/v1/functions/' + functionId,
        '/api/automation/v4/actions/functions/' + functionId
      );
    }
    if (instanceId) {
      candidates.push(
        '/api/automationscripting/v1/instances/' + instanceId,
        '/api/automationplatform/v1/custom-code/instances/' + instanceId
      );
    }
    if (actionTypeId) {
      candidates.push(
        '/api/automationplatform/v1/action-types/' + actionTypeId
      );
    }
    for (const path of candidates) {
      try {
        const res = await api(path, portalId);
        if (!res.ok) continue;
        const found = findCode(res.data) || findCode({ sourceCode: res.data.sourceCode });
        if (found) return found;
        if (typeof res.data === 'string' && res.data.length > 40) {
          return { lang: guessLang(res.data), code: res.data };
        }
      } catch (_) {
        /* next */
      }
    }
    return null;
  }

  function collectCodesFromV4(v4) {
    const map = {};
    if (!v4) return map;
    const actions = v4.actions || v4.actionDefinitions || [];
    const list = Array.isArray(actions)
      ? actions
      : Object.entries(actions).map(([id, a]) => ({ ...(a || {}), actionId: id }));
    for (const a of list) {
      const id = String(a.actionId || a.id || '');
      const code =
        findCode(a) ||
        findCode(a.metadata) ||
        (a.sourceCode
          ? { lang: guessLang(a.sourceCode), code: a.sourceCode }
          : null);
      if (id && code) map[id] = code;
    }
    return map;
  }

  async function dump() {
    const { flowId, portalId } = parseIds();
    if (!flowId) {
      return {
        ok: false,
        error: 'URL sem /flow/ID — abra o editor do workflow',
      };
    }
    if (!portalId) {
      return {
        ok: false,
        error:
          'portalId não encontrado na URL. Abra o workflow pelo menu Automações (URL com /workflows/SEU_PORTAL/...).',
      };
    }

    const hybrid = await api(
      '/api/automationplatform/v1/hybrid/' + flowId,
      portalId
    );
    if (!hybrid.ok) {
      return {
        ok: false,
        error: 'hybrid HTTP ' + hybrid.status + ': ' + JSON.stringify(hybrid.data).slice(0, 200),
      };
    }

    const flow = hybrid.data;
    const name = flow.name || 'sem-nome';
    const actions = flow.actions || {};
    const actionCount = Object.keys(actions).length;
    const prefix = 'flow-' + flowId + '_' + sanitizeFolderName(name);

    download(prefix, 'hybrid.json', JSON.stringify(flow, null, 2));

    const v4 = await tryV4Flow(flowId, portalId);
    if (v4) {
      download(prefix, 'v4.json', JSON.stringify(v4, null, 2));
    }
    const v4Codes = collectCodesFromV4(v4);

    const lines = [
      '# ' + name,
      '',
      '- **flowId:** ' + flowId,
      '- **enabled:** ' + flow.isEnabled,
      '- **object:** ' + flow.flowObjectType,
      '- **firstActionId:** ' + flow.firstActionId,
      '- **actions:** ' + actionCount,
      '- **shouldReenroll:** ' + flow.shouldReenroll,
      '',
      '## Enrollment',
      '```json',
      JSON.stringify(
        flow.enrollmentCriteria || flow.enrollmentTrigger,
        null,
        2
      ).slice(0, 4000),
      '```',
      '',
      '## Árvore',
      '',
    ];
    walkTree(actions, flow.firstActionId, 0, new Set(), lines);
    download(prefix, 'summary.md', lines.join('\n'), 'text/markdown');

    let codeFiles = 0;
    const missing = [];

    for (const [id, a] of Object.entries(actions)) {
      let found =
        findCode(a.metadata) ||
        v4Codes[id] ||
        null;

      if (!found && a.actionType === 'CUSTOM_CODE') {
        found = await tryFetchFunctionSource(a.metadata || {}, portalId);
      }

      if (!found) {
        if (a.actionType === 'CUSTOM_CODE') {
          missing.push({
            actionId: id,
            functionId: a.metadata && a.metadata.functionId,
            instanceId: a.metadata && a.metadata.instanceId,
            secrets: (a.metadata && a.metadata.secrets) || [],
            runtime: a.metadata && a.metadata.runtime,
          });
        }
        continue;
      }

      codeFiles++;
      const ext = extFor(found.lang, a.metadata && a.metadata.runtime);
      download(prefix, 'code-action-' + id + '.' + ext, found.code, 'text/plain');
    }

    if (missing.length) {
      download(
        prefix,
        'code-MISSING.json',
        JSON.stringify(
          {
            note: 'CUSTOM_CODE sem fonte no hybrid/v4. Abra a ação na UI ou use Private App GET /automation/v4/flows/{id}.',
            missing,
          },
          null,
          2
        )
      );
    }

    for (const path of [
      '/api/automationplatform/v1/output-fields/flow/' + flowId + '/allOutputs',
      '/api/automationapps/v1/flow-crm-objects/' + flowId,
    ]) {
      try {
        const res = await api(path, portalId);
        if (res.ok) {
          download(
            prefix,
            path.split('/').pop() + '.json',
            JSON.stringify(res.data, null, 2)
          );
        }
      } catch (_) {
        /* ignore */
      }
    }

    return {
      ok: true,
      name,
      flowId,
      prefix,
      actions: actionCount,
      codeFiles,
      missingCodes: missing.length,
    };
  }

  window.__hsFlowDump = dump;
})();
