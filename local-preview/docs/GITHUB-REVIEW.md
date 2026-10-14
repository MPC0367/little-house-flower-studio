# GitHub review package — 14 October 2026

The localhost implementation is included as `local-preview/` on the `codex/localhost-upgrade` review branch. The existing files at the repository root are unchanged. GitHub Pages is configured to publish `main`; this branch upload does not publish the Node application or connect its local order journal to the live shop.

## Included

- Existing florist catalogue, responsive storefront and authentic shop imagery.
- Automatic made-to-order image compositions, curated concepts and complete reservation snapshots.
- English/Thai studio dashboard, clickable full order details, image zoom, calendar and earnings views, and draft/session recovery.
- Supplied 1080p loading video and poster, readable readiness-dependent timing, no Skip button and bounded accessible fallback.
- Local API, synthetic fixtures, build tools, test suite and optional macOS app source.

All required runtime imagery is included. Private databases, saved orders/payments/sessions, reference uploads, dependencies, compiled apps, generated image caches, raw generation files and machine-specific QA reports are excluded. No deployment workflow is added. Historical Markdown notes retain their context, including references to omitted original-workspace evidence.

## Verification of this package

A fresh dependency installation and storefront build succeeded. All **58 unit tests** and **122 Playwright WebKit browser tests** passed. Browser tests ran against a separate synthetic database and isolated ports, including coverage that storefront submissions never send writes beyond loopback.

The native app compiled successfully, with valid plists and a verified local code signature. It was not launched for this upload check. Browser automation does not establish physical-device or VoiceOver coverage.

The image library was updated from `sharp` 0.35.4 to 0.35.5 for its available security patch. `npm audit` reports **zero known vulnerabilities** for this lockfile at verification time. The native builder now records the Node executable used to build it, instead of assuming a Homebrew location.

See [structured results](GITHUB-VERIFICATION.json) and [startup instructions](../README.md). The ordinary localhost preview remained available throughout verification. Production authentication, live integrations, business-rule verification and deployment remain separate work.
