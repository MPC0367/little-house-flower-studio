> Historical implementation note. For the uploaded application and current checks, start with [README](../README.md) and [GitHub review notes](GITHUB-REVIEW.md). References to raw assets, baseline snapshots and machine QA reports are retained for context; those files are excluded from this source package. Later features, including the supplied video intro without a Skip button, supersede earlier descriptions.

# Little House Flower — local customizer and studio app

This update stays in `localhost-astra`. Nothing is pushed or deployed. The original live-source repository, live order integration, Google Sheet and shop order settings are untouched. Existing local data is preserved.

## Made to order

The reported problem was reproducible: automatic changes only looked up eight exact cached recipes, while the manual Update button called a disconnected image provider. Most valid custom selections could never produce an image.

- Completed visual choices now request a preview automatically after a short debounce. The normal Update preview button is removed; Retry appears only after a genuine failure.
- The local compositor covers all 18 flower choices and seven arrangement styles, compatible containers/finishes, ribbons, natural seasonal palette variations and relative sizes. Fixed flower colours remain fixed. Budget and customer notes do not create new images.
- Generated transparent flower and presentation cutouts are composed on this computer. These are labelled **Live composition preview — illustrative**, distinct from actual shop photos and the existing eight full AI arrangement concepts. This is an illustration of choices, not an exact florist production photograph or guaranteed stem count.
- Preset concepts and unchanged catalogue product photos remain available. The optional full-image provider adapter is preserved and disconnected. No external generation request is made during local customization.
- Incompatible choices explain the problem immediately and offer a compatible florist colour mix without discarding chosen flowers.
- The previous image remains mounted during updates. Late responses cannot replace newer selections. Review messaging follows the actual preview state. Booking waits for the current result, then stores its exact asset ID, version and configuration.
- Customer review, privacy-safe refreshed receipt and staff details distinguish the new image role correctly.
- Local rendering uses two workers, identical-key deduplication, a 64-job queue, 600 requests per hour and a 1,000-configuration local storage cap. It never deletes saved order assets to reclaim space.

## Image assets and provenance

All new raster assets were created with individual **built-in imagegen** calls; no CLI image API or runtime paid image endpoint was used. Originals and exact prompts/source paths are retained in:

- `assets/live-flowers/` — nine individual JSON prompt records plus `group-a-provenance.json` and QA records; all 18 PNG originals.
- `assets/live-presentation/` — `provenance.json`, `qa.json`, and original wicker/hatbox/vase/bow PNGs.
- `customer/img/live-flowers/` and `customer/img/live-presentation/` — inspected transparent WebP derivatives.
- `docs/live-composition-qa/all-styles.png` — reviewed composition contact sheet.

Flower prompts ask for a single realistic isolated bloom/sprig, minimal stem, neutral diffuse light, complete botanical silhouette and genuine transparent alpha. Presentation prompts request an isolated empty container or silk bow with no flowers or branding. Exact per-image prompts are in the manifests above.

## Studio application

The admin has been adapted from the supplied O2 dashboard reference into a compact florist workspace using the shop's warm cream, brown, sage and blush palette. Today, Orders, Calendar, Earnings and Settings use a persistent app dock, counted filters, local financial totals and compact florist order rows. The local Mac wrapper opens it in a separate application window and starts this workspace's local server if necessary. Closing the window leaves the local server and saved data intact.

The browser entry also has a standalone web-app manifest, app icons and installation guidance. Its service worker caches only public application shell files. It never caches API responses, customer records, private images or order submissions, and it does not queue payments or staff changes while offline.

This remains a local demo workspace. Google synchronization and production staff authentication are not activated. The Mac app depends on this workspace and its Node installation; it is not a packaged public production release.

## English / Thai and order details

The studio language toggle appears at sign-in, in the app header and inside order details. It remembers the language in this app's local storage. Labels, navigation, status options, summaries and dates change in place; filters, customer content, cursor selections and unsaved order/payment/reply drafts remain intact. Customer names and free-text instructions are never machine-translated.

Click any order row, or its keyboard-accessible order button, to open the full detail drawer. It includes requested date/time, collection or delivery, flowers and colours, wrapping/container and colour, ribbon, size, budget/estimate, customer notes, contact/recipient/address, message card, order status and payment history. Product photographs and saved custom previews are displayed uncropped at a larger size; clicking them opens an accessible image viewer with zoom and Escape-to-close. Missing images leave all order information available.

New local catalogue orders store the published name, flowers, colours, wrapping and size alongside their order. Historical records without that snapshot show explicitly labelled catalogue reference details; missing values are left for customer confirmation. Existing orders and payments are not rewritten. Customer colour requests are shown separately from the catalogue reference.

Pending payment and reply drafts now participate in close/reload warnings. Saving order edits preserves them; recording a payment still requires its own explicit action.

## Verification

See `FINAL-VERIFICATION.json` for final command results after implementation. Browser automation uses Playwright WebKit. Safari WebDriver was attempted, but its session creation timed out; that is not recorded as a physical Safari test.
