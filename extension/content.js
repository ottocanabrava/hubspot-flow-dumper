(function () {
  if (document.getElementById('hs-flow-dumper-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'hs-flow-dumper-btn';
  btn.type = 'button';
  btn.textContent = 'Dump flow';
  btn.title = 'Baixa JSON + summary + códigos deste workflow';

  const toast = document.createElement('div');
  toast.id = 'hs-flow-dumper-toast';

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Dumpando…';
    toast.className = '';
    toast.textContent = '';
    try {
      const result = await chrome.runtime.sendMessage({ type: 'DUMP_FLOW' });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || 'falha');
      }
      toast.className = 'ok';
      toast.textContent =
        'OK: ' +
        result.name +
        ' · ' +
        result.actions +
        ' ações · ' +
        result.codeFiles +
        ' código(s)' +
        (result.missingCodes
          ? ' · ' + result.missingCodes + ' sem fonte'
          : '') +
        (result.prefix ? ' → ' + result.prefix + '_*' : '');
    } catch (e) {
      toast.className = 'err';
      toast.textContent = String(e.message || e);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Dump flow';
    }
  });

  document.documentElement.appendChild(btn);
  document.documentElement.appendChild(toast);
})();
