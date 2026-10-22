# HubSpot Flow Dumper

Export **HubSpot workflow** definitions when the canvas is too big to screenshot: hybrid JSON, a Markdown summary, and custom code actions (Node.js / Python).

> **Unofficial tool.** Uses the same browser-session APIs the HubSpot UI calls (`hybrid`, optional v4). Not affiliated with or endorsed by HubSpot. Use responsibly and review HubSpot’s terms for your account.

---

## Por que isso existe

No dia a dia de **ops / produto / revops**, workflows grandes viram um problema silencioso:

- O **backup nativo** do HubSpot **não inclui workflows** da forma que você precisa para documentar ou versionar.
- Print e scroll no editor não escalam quando há dezenas de ramos, delays e `CUSTOM_CODE`.
- Para entender uma cadeia (ex.: ticket mãe → webhook → N8N), você precisa do **JSON + código** num lugar que o time (ou um agente de IA) consiga ler.

Este projeto nasceu enquanto mapeávamos fluxos de **movimentação / TJ** no HubSpot: documentação viva, dumps em `summary.md`, e extensão de um clique para não perder tempo. Foi extraído para um repositório próprio para **clonar em outro PC**, compartilhar aberto e não misturar com docs internos da empresa.

---

## O que você recebe em cada dump

| Arquivo | Conteúdo |
|---------|----------|
| `*_hybrid.json` | Definição completa (ações, ramos, enrollment) |
| `*_summary.md` | Árvore legível + critérios de inscrição |
| `*_code-action-*.js` / `.py` | Código custom quando disponível |
| `*_v4.json` | Tentativa via API v4 (extensão) |
| `*_code-MISSING.json` | Ações sem fonte — abrir na UI ou usar Private App |

Arquivos vão para **Downloads** (browser) ou para `output/` (CLI).

---

## Opção 1 — Extensão (recomendado)

Chrome ou Edge (Manifest V3).

1. Clone este repositório.
2. Siga [extension/INSTALL.md](extension/INSTALL.md) — carregue a pasta **`extension`** como extensão sem compactação.
3. Abra um workflow: `…/workflows/SEU_PORTAL/…/flow/ID/edit`
4. Clique **Dump flow** (canto inferior direito) ou use o popup da extensão.

**Segurança:** só roda em `app.hubspot.com`; usa sua sessão + cookie CSRF. **Não armazena token.**

---

## Opção 2 — Console (sem instalar)

1. Abra o workflow no editor.
2. F12 → **Console**.
3. Cole o conteúdo de [`console/dump-flow-console.js`](console/dump-flow-console.js) e Enter.

---

## Opção 3 — HAR (vários fluxos de uma gravação)

1. DevTools → **Network** (não limpe).
2. Abra vários workflows no HubSpot.
3. Exporte HAR.
4. No repositório:

```powershell
node cli/process-har.js "$env:USERPROFILE\Downloads\app.hubspot.com.har"
```

Saída em `output/har-…/` (ou passe uma pasta como segundo argumento).

---

## Opção 4 — Backup de todos os fluxos (API)

Private App com scope **`automation`**:

```powershell
$env:HUBSPOT_TOKEN = "pat-na1-..."
node cli/backup-all-flows.mjs
```

Salva em `output/backup-YYYY-MM-DD/` com `manifest.json` e `manifest.csv`.

---

## Estrutura do repositório

```
hubspot-flow-dumper/
  extension/     # Extensão Chrome/Edge
  console/       # Script para colar no DevTools
  cli/           # HAR + backup API
  output/        # Dumps locais (gitignored)
```

**Não commite** pastas em `output/` — podem conter webhooks, nomes de secrets e dados do seu portal.

---

## English (short)

HubSpot’s UI backup doesn’t give you workflow definitions in a reviewable form. This repo exports the open workflow via session APIs: **extension**, **console snippet**, **HAR batch**, or **v4 API backup**. MIT licensed. Unofficial.

---

## Licença

[MIT](LICENSE)
