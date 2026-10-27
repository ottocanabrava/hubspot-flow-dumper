# HubSpot Flow Dumper

[🇧🇷 Português](README.md) | [🇺🇸 English](README.en.md)

Export **HubSpot workflow** definitions when the canvas is too big to screenshot: hybrid JSON, a Markdown summary, and custom code actions (Node.js / Python).

> **Unofficial tool.** Uses the same browser-session APIs the HubSpot UI calls (`hybrid`, optional v4). Not affiliated with or endorsed by HubSpot. Use responsibly and review HubSpot’s terms for safe automation and data handling.

---

## Por que isso existe

No dia a dia de **ops / produto / revops**, workflows grandes viram um problema silencioso:

- O **backup nativo** do HubSpot **não inclui workflows** da forma que você precisa para documentar ou versionar.
- Print e scroll no editor não escalam quando há dezenas de ramos, delays e `CUSTOM_CODE`.
- Para entender uma cadeia (ex.: ticket mãe → webhook → N8N), você precisa do **JSON + código** num lugar que o time (ou um agente de IA) consiga ler.

Este projeto nasceu enquanto mapeávamos fluxos de **movimentação / TJ** no HubSpot: documentação viva, dumps em `summary.md`, e extensão de um clique. Foi extraído para um repositório público para facilitar o uso e compartilhamento.

---

## O que usar no dia a dia

**Use a extensão.** É o caminho mais completo (hybrid + summary + tentativas extras de puxar `CUSTOM_CODE` via v4 e APIs auxiliares).

| Se… | Use |
|-----|-----|
| Mapear / documentar **um** workflow com o máximo de detalhe | **Extensão** (`extension/`) |
| Está em outro PC e não quer instalar extensão | **Console** — mesmo fluxo básico, menos tentativas de código ([`console/dump-flow-console.js`](console/dump-flow-console.js)) |
| Quer **inventário** de todos os fluxos do portal | **Backup API** (abaixo) — não substitui dump fino de um fluxo |
| Já gravou Network e só quer os `hybrid` que o browser pediu | **HAR** (abaixo) — atalho em lote, **não** é dump completo |

As outras opções existem por **casos pontuais** do mapeamento (vários fluxos abertos numa sessão, backup em massa). Não é obrigatório aprender todas.

---

## Comparativo rápido

| | Extensão | Console | HAR (`process-har`) | Backup API |
|---|:---:|:---:|:---:|:---:|
| `hybrid.json` | ✅ | ✅ | ✅ *só o que estava na gravação* | ❌ (formato **v4**) |
| `summary.md` | ✅ | ✅ | ✅ | ❌ |
| Código no metadata do hybrid | ✅ | ✅ | ✅ | depende do v4 |
| Tentativas extras de código (v4 / function APIs) | ✅ | ❌ | ❌ | parcial |
| Vários fluxos de uma vez | um por clique | um por colagem | ✅ *os que você abriu com Network ligada* | ✅ *todos do portal* |
| Precisa | Chrome/Edge | só login HubSpot | Node + arquivo HAR | Private App + PAT |

---

## O que você recebe (extensão / console)

| Arquivo | Conteúdo |
|---------|----------|
| `*_hybrid.json` | Definição completa (ações, ramos, enrollment) |
| `*_summary.md` | Árvore legível + critérios de inscrição |
| `*_code-action-*.js` / `.py` | Código custom quando disponível |
| `*_v4.json` | Tentativa via API v4 (**só extensão**) |
| `*_code-MISSING.json` | Ações sem fonte — abrir na UI ou usar Private App (**só extensão**) |

Arquivos vão para **Downloads** (browser) ou para `output/` (CLI).

---

## Instalação — extensão (recomendado)

Chrome ou Edge (Manifest V3).

1. Clone este repositório.
2. Siga [extension/INSTALL.md](extension/INSTALL.md) — carregue a pasta **`extension`** como extensão sem compactação.
3. Abra um workflow: `…/workflows/SEU_PORTAL/…/flow/ID/edit`
4. Clique **Dump flow** (canto inferior direito) ou use o popup da extensão.

**Segurança:** só roda em `app.hubspot.com`; usa sua sessão + cookie CSRF. **Não armazena token.**

### Console (sem instalar extensão)

1. Abra o workflow no editor.
2. F12 → **Console**.
3. Cole o conteúdo de [`console/dump-flow-console.js`](console/dump-flow-console.js) e Enter.

---

## Alternativas (opcional)

### HAR — batch de `hybrid` da gravação

Útil quando você **já** estava com DevTools → Network aberto e visitou vários workflows. O script extrai respostas `…/hybrid/{id}` do arquivo HAR.

**Não baixa “tudo do portal”.** Não inclui chamadas que não apareceram na gravação (código em endpoints separados, etc.). Para documentar um fluxo crítico, prefira a **extensão**.

```powershell
node cli/process-har.js "$env:USERPROFILE\Downloads\app.hubspot.com.har"
```

Saída em `output/har-…/` (ou passe uma pasta como segundo argumento).

### Backup API — todos os fluxos (inventário)

Private App com scope **`automation`**. Gera JSON **v4** de cada fluxo + `manifest.csv` — bom para **lista e backup**, não para substituir o pacote hybrid + summary + código da extensão.

```powershell
$env:HUBSPOT_TOKEN = "pat-na1-..."
node cli/backup-all-flows.mjs
```

Salva em `output/backup-YYYY-MM-DD/`.

---

## Estrutura do repositório

```
hubspot-flow-dumper/
  extension/     # ← use isto
  console/       # fallback sem instalar
  cli/           # HAR + backup API (opcional)
  output/        # dumps locais (gitignored)
```

**Não commite** pastas em `output/` — podem conter webhooks, nomes de secrets e dados do seu portal.

---

## English (short)

HubSpot’s native backup doesn’t give you reviewable workflow definitions. **Use the browser extension** for the fullest dump (hybrid JSON, Markdown summary, custom code when the APIs expose it). For a more lightweight fallback, use the console script or a HAR capture. The repo also includes optional backup utilities for bulk inventory work.

---

## Licença

[MIT](LICENSE)
