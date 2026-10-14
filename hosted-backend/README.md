# Little House Flower client demo

A password-protected online demonstration of the existing Little House Flower storefront and studio. This runs on hosted Cloudflare Workers through Sites, with D1 for shared demo records and private R2 for all site files and images. Public static serving is disabled so every page, script, image and API request passes through the password gate. The owner's computer is not part of the serving path.

- Storefront: `/`
- Studio: `/studio/`
- Username for the browser password prompt: `client`
- The same password unlocks the studio. Change it under **Studio → Settings → Password protection**.
- Initial password comes from the secret runtime environment variable `DEMO_PASSWORD`. It is never included in source or browser bundles. Once changed in Settings, the stored password replaces the initial secret and old sessions expire.
- All orders and payments are synthetic demonstration records. No production Google Sheets, notifications, real payments or courier service is connected.
- The supplied loading animation, bilingual storefront/studio, automatic customization previews, order details and enlarged images are preserved.

## Local verification

Install dependencies with the Sites plugin helper, configure an ignored `.dev.vars` containing `DEMO_PASSWORD`, build with the Sites build helper, apply pending schema migrations locally, then run `npm start -- --port 5580 --env-file /absolute/path/to/.dev.vars`. The local database and uploaded assets remain separate from hosted data.

## Publishing

Use the Sites plugin's source and publication helpers with the existing `.openai/hosting.json` project ID. Never create a second Site for updates. Build output belongs to the exact pushed commit. Production runtime secrets are configured through Sites, not committed.

This is a shared-password client demonstration. Anyone given the password can operate its demo dashboard; it is not a production customer-data system.

Before each build, regenerate the approved asset manifest with `node scripts/generate-site-asset-manifest.mjs` after any `public/` edit. After deploying, upload the approved immutable files with `node scripts/upload-site-assets.mjs <site-url>`. The uploader reads the ignored `.dev.vars` initial password (or `LHF_UPLOAD_PASSWORD` when the shared password has been changed). Each upload requires a staff session and must match the exact hash and size in the deployed manifest.
