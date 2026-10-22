async function dumpActiveTab(tabId) {
  if (!tabId) throw new Error('Sem aba');

  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    files: ['dump-core.js'],
  });

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async () => {
      if (typeof window.__hsFlowDump !== 'function') {
        return { ok: false, error: 'dump-core não carregou' };
      }
      try {
        return await window.__hsFlowDump();
      } catch (e) {
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    },
  });

  return result || { ok: false, error: 'sem resultado' };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DUMP_FLOW') {
    const tabId = msg.tabId || (sender.tab && sender.tab.id);
    dumpActiveTab(tabId)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }
  return false;
});
