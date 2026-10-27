# HubSpot Flow Dumper

[🇧🇷 Português](README.md) | [🇺🇸 English](README.en.md)

Export **HubSpot workflow** definitions when the canvas is too big to screenshot: hybrid JSON, a Markdown summary, and custom code actions (Node.js / Python).

> **Unofficial tool.** Uses the same browser-session APIs the HubSpot UI calls (`hybrid`, optional v4). Not affiliated with or endorsed by HubSpot. Use responsibly and review HubSpot’s terms for safe automation and data handling.

---

## Why this exists

In day-to-day **ops / product / revops** work, large workflows become a quiet problem:

- HubSpot’s native backup does not include workflows in the format you need to document or version them.
- Screenshots and editor scrolling do not scale when there are dozens of branches, delays, and `CUSTOM_CODE` actions.
- To understand a chain (for example: parent ticket → webhook → N8N), you need the **JSON + code** in one place that the team (or an AI agent) can read.

This project was born while mapping **movement / TJ** flows in HubSpot: living documentation, dumps in `summary.md`, and a one-click browser extension. It was extracted into a public repository to make it easier to use and share.

---

## What to use day to day

**Use the extension.** It is the most complete path (hybrid + summary + extra attempts to pull `CUSTOM_CODE` through v4 and helper APIs).

| If… | Use |
|-----|-----|
| You want to map / document **one** workflow with maximum detail | **Extension** (`extension/`) |
| You are on another PC and do not want to install the extension | **Console** — same basic flow, fewer code attempts ([`console/dump-flow-console.js`](console/dump-flow-console.js)) |
| You want an **inventory** of all flows in the portal | **Backup API** (below) — does not replace a detailed dump of a single flow |
| You already captured Network traffic and only want the `hybrid` payloads the browser requested | **HAR** (below) — batch shortcut, **not** a full dump |

The other options exist for specific mapping cases (multiple flows open in one session, bulk backup). You do not need to learn all of them.

---

## Quick comparison

| | Extension | Console | HAR (`process-har`) | Backup API |
|---|:---:|:---:|:---:|:---:|
| `hybrid.json` | ✅ | ✅ | ✅ *only what was in the capture* | ❌ (**v4** format only) |
| `summary.md` | ✅ | ✅ | ✅ | ❌ |
| Code in hybrid metadata | ✅ | ✅ | ✅ | depends on v4 |
| Extra code attempts (v4 / function APIs) | ✅ | ❌ | ❌ | partial |
| Multiple flows at once | one per click | one per paste | ✅ *those you opened with Network enabled* | ✅ *all flows in the portal* |
| Requires | Chrome/Edge | HubSpot login only | Node + HAR file | Private App + PAT |

---

## What you get (extension / console)

| File | Content |
|---------|----------|
| `*_hybrid.json` | Full definition (actions, branches, enrollment) |
| `*_summary.md` | Readable tree + enrollment criteria |
| `*_code-action-*.js` / `.py` | Custom code when available |
| `*_v4.json` | Attempt via v4 API (**extension only**) |
| `*_code-MISSING.json` | Actions without source — open in the UI or use a Private App (**extension only**) |

Files are saved to **Downloads** (browser) or to `output/` (CLI).

---

## Installation — extension (recommended)

Chrome or Edge (Manifest V3).

1. Clone this repository.
2. Follow [extension/INSTALL.md](extension/INSTALL.md) — load the **`extension`** folder as an unpacked extension.
3. Open a workflow: `…/workflows/YOUR_PORTAL/…/flow/ID/edit`
4. Click **Dump flow** (bottom-right corner) or use the extension popup.

**Security:** it only runs on `app.hubspot.com`; it uses your session + CSRF cookie. **It does not store tokens.**

### Console (without installing the extension)

1. Open the workflow in the editor.
2. F12 → **Console**.
3. Paste the contents of [`console/dump-flow-console.js`](console/dump-flow-console.js) and press Enter.

---

## Alternatives (optional)

### HAR — batch extraction of `hybrid` payloads

Useful when you **already** had DevTools → Network open and visited several workflows. The script extracts `…/hybrid/{id}` responses from the HAR file.

**It does not download “everything from the portal.”** It does not include calls that were not present in the capture (code in separate endpoints, etc.). For documenting a critical flow, prefer the **extension**.

```powershell
node cli/process-har.js "$env:USERPROFILE\Downloads\app.hubspot.com.har"
```

Output goes to `output/har-…/` (or pass a folder as the second argument).

### Backup API — all flows (inventory)

Private App with **`automation`** scope. Generates a **v4** JSON for each flow + `manifest.csv` — good for **listing and backup**, not for replacing the hybrid + summary + code package from the extension.

```powershell
$env:HUBSPOT_TOKEN = "pat-na1-..."
node cli/backup-all-flows.mjs
```

Saves to `output/backup-YYYY-MM-DD/`.

---

## Repository structure

```
hubspot-flow-dumper/
  extension/     # ← use this
  console/       # fallback without installing
  cli/           # HAR + backup API (optional)
  output/        # local dumps (gitignored)
```

**Do not commit** `output/` folders — they may contain webhooks, secret names, and data from your portal.

---

## English (short)

HubSpot’s native backup does not give you reviewable workflow definitions. **Use the browser extension** for the fullest dump (hybrid JSON, Markdown summary, custom code when the APIs expose it). For a lighter fallback, use the console script or capture a HAR. The repo also includes optional backup utilities for bulk inventory work.

---

## License

[MIT](LICENSE)
