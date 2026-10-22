# Install the browser extension (Chrome / Edge)

Manifest V3 — works in **Chrome** and **Microsoft Edge**.

## Edge

1. Open `edge://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the **`extension`** folder inside this repository (the folder that contains `manifest.json`)

## Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the **`extension`** folder

## Use

1. Open a workflow in HubSpot (`…/flow/NUMERO/edit`)
2. Click the orange **Dump flow** button (bottom-right), or the extension icon → **Dump deste workflow**
3. Files land in **Downloads** with a prefix like `flow-584768388_My-Flow_hybrid.json`

After changing extension files: **Reload** on the extensions page.

## Permissions

Only `app.hubspot.com` and `api.hubapi.com`. Uses your logged-in session + CSRF cookie — **no token is stored**.
