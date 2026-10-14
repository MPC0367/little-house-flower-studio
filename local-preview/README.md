# Little House Flower — local storefront and studio

This application extends the existing Little House Flower storefront with automatic made-to-order previews, a bilingual staff workspace and the supplied loading animation. In the GitHub review branch, it lives in `local-preview/`; the published files at the repository root remain unchanged.

This is a local Node application. GitHub Pages cannot run its order API, SQLite journal, preview renderer or staff sessions. Uploading this source does not deploy it or connect it to the live shop.

## Start from a fresh checkout

Requires Node >=22.13 and npm. Tested with Node 26.8.1 on macOS.

From the `local-preview` directory (or this standalone workspace), run:

```sh
npm ci --ignore-scripts
npm start
```

Keep that terminal running; Ctrl+C stops the foreground server. On macOS or another POSIX system, the background launcher is also available:

```sh
npm run preview:start
npm run preview:stop
```

The launcher stores its PID and log in `data/`, preserves existing records and stops only its matching process. Avoid starting a second copy on the same ports.

- Customer: http://127.0.0.1:5173/
- Made to order: http://127.0.0.1:5173/?lang=en#/custom
- Replay the intro: http://127.0.0.1:5173/?lang=en&intro=1#/
- Studio: http://127.0.0.1:5174/ — choose a local demo role to enter.
- Health: http://127.0.0.1:8787/api/health

The default servers bind to loopback. Optional client sharing is described below. A fresh checkout creates synthetic demonstration records. Saved orders, uploaded reference photos, sessions and payments from the original local workspace are excluded from Git. Live ordering, Google Sheets, notifications and paid image services are disconnected. Social and contact links remain ordinary outbound links.

## Review the changes

1. Open Made to order. Select a concept or customize flowers, colours, presentation, wrapping and ribbon. Supported changes update the illustrative preview automatically. Catalogue photographs, AI concepts and illustrative compositions retain their distinct labels.
2. Choose a budget, add notes and optionally upload a reference with consent. Continue through the reservation steps to review the complete configuration, requested date and time, fulfilment and pricing status. All submissions go to the local journal.
3. Open Studio Orders and click an order. Inspect the saved design choices, customer and delivery details, card message, large product image and image zoom. Switch between English and Thai using the language control.
4. Review Today, Calendar, Earnings and Settings. Quote, status, payment and staff-note changes remain local. Unsaved order edits are protected during navigation and session recovery.
5. Replay the loading animation. Playback follows page readiness, with roughly three seconds of minimum presentation time and a bounded fallback. There is no Skip button. Reduced-motion preferences bypass decorative motion; failed media does not permanently block the page.

## Set a workspace password

In Studio, open **Settings → Password protection**. Set and confirm a password of 12–128 characters. Once configured, the role selector is replaced by password sign-in; the password grants owner access to this demonstration workspace. Changing it requires the current password and signs out other staff sessions. Passwords are salted and hashed in the private local journal; no password is stored in browser storage or Git.

The original unconfigured local workspace still supports demo roles. It must not be exposed directly. The sharing launcher below requires password protection before opening either link.

## Share a temporary client preview

Requires `cloudflared` installed on this Mac (default `/opt/homebrew/bin/cloudflared`; override its executable path with `LHF_CLOUDFLARED`). Run:

```sh
npm run share:start
npm run share:status
npm run share:stop
```

Start creates a separate synthetic review workspace in `data/client-review/`, using ports 5373, 5374 and 8987 with password-protected proxies on 5383 and 5384. It does not share the saved records in the ordinary localhost workspace. It refuses an existing review database without its synthetic-review marker.

The command prints separate HTTPS customer and studio links. Both require username `client` and the generated password stored privately in `data/client-review/access.txt`. The studio then asks for that same workspace password. You can change it in Studio Settings; both share links immediately use the new password, and browsers may ask you to sign in again. The access file documents the initial password and is not automatically updated when you choose a new one.

Both links are temporary Cloudflare Quick Tunnels. The Mac and sharing processes must remain awake and online; restarting creates new links. This is a client demonstration, not permanent production hosting. Orders and uploads stay in the separate review database, live Google Sheets and notifications remain disconnected, and paid image-provider settings are removed from the review process. Use demonstration details only. Stopping the share retains its saved demo records and password.

The share gateway checks the tunnel host and request origin, requires a password on every path, adds secure cookies, bounds request bodies and authentication work, and stops both links if a required backend or tunnel process exits. It does not alter existing Cloudflare configuration or the shop's live GitHub Pages site.

## Edit and verify

Startup rebuilds `customer/storefront.js` from the ordered modules in `scripts/customer-sources.json`. After editing those modules while the server is running, run `npm run build`. Styles and customizer modules are served directly.

```sh
npm run build
npm test
npx playwright install webkit
npm run test:browser
npm run test:password
```

Browser tests use Playwright WebKit with isolated synthetic data on ports 5273, 5274 and 8887. They do not submit orders to the live backend. Generated test reports, screenshots and databases are ignored. WebKit automation is not a substitute for testing on physical Apple devices.

The optional native Mac workspace has a dedicated window without browser controls. Build it locally with `node scripts/build-admin-app.mjs`, then open `output/macos/Little House Flower.app`. It requires macOS 14+, Xcode command-line tools and Node. Rebuild after moving the workspace or changing Node. See [native app notes](native/README.md).

## Project layout

- `customer/`: storefront, catalogue source, imagery, customizer and intro media.
- `admin/`: bilingual staff web application and app icons.
- `shared/`: configuration choices, recipes and price rules.
- `server/`: local API, SQLite journal, media, preview rendering and adapter contracts.
- `fixtures/`: curated preview mappings and synthetic fixtures.
- `scripts/`, `tests/`, `native/`: build and preview tools, automated checks and optional Mac app source.
- `docs/`: implementation history and verification notes. Earlier audits describe the state when written; later changes may supersede them.

`customer/data/` contains required source modules and must be committed. The separate top-level `data/` directory contains private runtime state and must not be committed. Raw asset-generation work files and machine-specific QA captures are omitted from the GitHub package; all images and media required by the running app are included.

Do not edit `data/journal.sqlite` by hand. For an independent review, choose a fresh `LHF_DATA_DIR` and unused ports through environment variables. `.env.example` documents these options; the server does not automatically load an `.env` file.

Production deployment, production authentication, live integrations and verified pricing require separate configuration and approval. The local demonstration role selector is not production authentication.
