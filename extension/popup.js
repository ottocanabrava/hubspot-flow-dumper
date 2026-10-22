const statusEl = document.getElementById('status');
const btn = document.getElementById('dump');

function setStatus(msg, isErr) {
  statusEl.textContent = msg;
  statusEl.className = isErr ? 'err' : '';
}

btn.addEventListener('click', async () => {
  btn.disabled = true;
  setStatus('Dumpando…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.includes('app.hubspot.com')) {
      setStatus('Abra uma aba do HubSpot (app.hubspot.com).', true);
      return;
    }
    if (!/\/flow\/\d+/.test(tab.url)) {
      setStatus('Abra o editor do workflow (URL com /flow/ID/edit).', true);
      return;
    }

    const result = await chrome.runtime.sendMessage({
      type: 'DUMP_FLOW',
      tabId: tab.id,
    });

    if (!result?.ok) {
      setStatus(result?.error || 'Falha no dump', true);
      return;
    }

    setStatus(
      `OK: ${result.name}\n${result.actions} ações\n${result.codeFiles} código(s)` +
        (result.missingCodes
          ? `\n${result.missingCodes} code(s) sem fonte`
          : '') +
        `\nArquivos: ${(result.prefix || 'flow-…')}_*.json em Downloads`
    );
  } catch (e) {
    setStatus(String(e.message || e), true);
  } finally {
    btn.disabled = false;
  }
});
