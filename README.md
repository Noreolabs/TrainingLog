# Rep Log

A standalone, installable workout tracker built around your Phase 1 plan. Works fully offline once installed — no account, no server required for day-to-day use.

## Get it on your phone (2 minutes)

You need to serve these files over `http://` or `https://` for the install/offline features to work (opening `index.html` directly as a `file://` won't allow the service worker to register). Easiest options:

**Option A — GitHub Pages (free, permanent, works from anywhere)**
1. Create a new repo on GitHub, upload all files in this folder.
2. Settings → Pages → deploy from the `main` branch.
3. Open the resulting `https://yourname.github.io/repo-name/` URL on your phone.

**Option B — Your Raspberry Pi**
Drop this folder alongside your nutrition kiosk app and serve it (e.g. a second Flask static route, or `python3 -m http.server` in this folder on a spare port). Reachable from your phone whenever you're on the same network — or forward the port / use a tool like Tailscale if you want it reachable from the gym too.

**Option C — Quick local test right now**
```
python3 -m http.server 8000
```
then visit `http://localhost:8000` (or `http://<your-computer's-LAN-IP>:8000` from your phone, same wifi).

## Install to your home screen

- **iPhone (Safari):** open the URL → Share icon → "Add to Home Screen"
- **Android (Chrome):** open the URL → ⋮ menu → "Add to Home screen" / "Install app"

Once installed it opens full-screen like a native app, and works with zero signal or wifi at the gym — logging, history, and the week view are all stored on-device.

## Important: data lives on this device only

There's no cloud account or sync — your sets are stored locally in the browser you install from (via IndexedDB). That means:
- It'll survive closing the app, restarting your phone, and going offline — as long as you don't uninstall it or clear that browser's site data.
- It will **not** show up if you open the same URL in a different browser or on a different device.
- **Use the Export tab regularly** (CSV or text file) as your backup, not just for sending to your coach. Sharing to yourself via email/Notes takes 5 seconds and protects your history.

## Using it

- **Today tab** — defaults to today's date and the matching day from your plan. Change the date to log a missed day, or use the "Logging as" dropdown if you trained a different day than your actual weekday (e.g. schedule got shuffled). Tap an exercise to expand it, see your last logged numbers for that lift, and add sets (reps, weight, RPE, notes).
- **Week tab** — read-only view of the full week's plan, pulled from whatever plan is currently active. Tap a day to jump straight to logging it.
- **History tab** — pick any exercise and see every session you've logged for it, most recent first, with your top set called out.
- **Export tab** — pick a date range, preview it, then Share (uses your phone's native share sheet straight to Messages/Email if supported), or download as CSV/text.
- **Plan tab** — shows your current plan, and lets you import a new PDF from your coach for the next phase.

## Importing a new phase

Upload the PDF on the Plan tab (needs internet, since it loads a PDF-reading library — everything else works offline). It parses days and exercises automatically, but **always review the parsed result before saving** — PDF layouts vary and it's tuned to your coach's current format, not guaranteed to catch everything perfectly on a new layout. Edit anything wrong, add/remove exercises or days as needed, then save. Your logged history isn't affected by this — it's tied to exercise names and dates, not to a specific plan version.

## Files

- `index.html` / `styles.css` / `app.js` — the app
- `plan-data.js` — your Phase 1 plan, parsed from the PDF you uploaded (used only the very first time the app runs, to seed your data)
- `manifest.json` / `sw.js` / `icon-*.png` — what makes it installable and offline-capable
