> Historical implementation note. For the uploaded application and current checks, start with [README](../README.md) and [GitHub review notes](GITHUB-REVIEW.md). References to raw assets, baseline snapshots and machine QA reports are retained for context; those files are excluded from this source package. Later features, including the supplied video intro without a Skip button, supersede earlier descriptions.

# Little House Flower — completed local implementation pass
Reviewed the entire 39-page supplied PDF and implemented the local customer, preview, loading, staff and integration work against its requirements. The latest customizer repair and standalone studio app are documented in LOCAL-APP-UPDATE.md. This copy builds on the original storefront. Nothing was pushed, deployed or connected to live order/Sheet systems.

## What changed
**Made-to-order images and state (p15–21).** Eight configuration-matched concepts cover florist's-choice bouquet, red roses, blue/white box, white/green basket, bridal bouquet, jasmine garland, pastel wreath and money bouquet. Each has an original, responsive WebP files, stable asset ID/version, source reference, exact prompt and visual-QA record. AI images are explicitly labelled; florist approval remains pending. Actual catalogue photos continue to work for unchanged quote-only/expired products, independent of price.

The five steps retain 18 bilingual flower options with available thumbnails and evidence-aware color indicators. The review includes flowers, palette, container, finish, ribbon, relative size, budget, occasion, notes, separate banknote value, price status and image role. Dependency changes require confirmation. Drafts survive refresh/language/back navigation without modifying free text. Keyboard focus/caret, reference removal/replacement, late uploads and out-of-order preview responses have dedicated regressions.

The preview service implements queued/generating/validating/ready/failed states, exact-key deduplication, versioned cache identity, image decoding/limits, transfer-ready approved references, cumulative estimated-cost caps, concurrency/rate/storage caps, timeout and bounded explicit retry. Price validity is separate from image validity. A local composition renderer now covers arbitrary supported visual choices automatically with 18 botanical cutouts and four photographic presentation assets. These are explicitly labelled illustrative compositions. Full-image provider generation remains disconnected.

**Original-artwork loading screen and hero (p12–14).** Independently editable masks preserve the original LH, botanical stems/leaves/blooms, butterfly body/wings, wordmark and tagline. The final frame is the exact original supplied image. Pixel comparisons at small/large sizes report zero final-frame difference. Readiness uses real shell, route, logo and high-resolution hero milestones; a blurred placeholder cannot complete the image milestone. Skip, reduced motion, session caching, timeout, missing assets and failed routes leave the site usable. Replay uses ?intro=1.

The four specified real shop photos retain their order and live catalogue-derived captions. Scaling/seams are removed, responsive focal points are explicit, the first photo is preloaded only on the homepage, subsequent photos are staged, and failed slides are skipped. Controls support keyboard/manual operation and pause behavior.

**Pricing, booking and receipts (p19–21).** Published prices, single-rose tiers, expiry and the existing Bangkok booking rules remain. Unknown custom adjustments are disabled in an editable rule register. Budget status never becomes a quote. The final submission independently rechecks current prices and requires visible acknowledgment for changes. Server-owned references/window labels and recalculated line prices reject client tampering. Saved orders retain immutable design/image/estimate versions. Refreshable30-day browser receipts preserve public design details while stripping personal/free-text/private-reference data. Copy/calendar summaries include the design; no private image URL is exported.

**Staff and operations (p22–29).** The separate application has server-enforced demo roles; full filters/sort/filtered counts; correct catalogue/concept thumbnails; calendar; drawer/mobile detail; explicit editing conflicts; Save/Discard/Keep editing; owner correction/reopen with reason; missing-detail/delivery-issue flags; print ticket/card; copy/LINE drafts; quote/delivery and append-only payment/refund history. Status does not imply payment.

Cash reporting uses payment-event dates in Bangkok and distinguishes deposits, refunds, order value, outstanding, delivery and banknote pass-through, verified zero and unknown history. Coverage, previous-period comparisons and contributor views are explicit. Local and disconnected Google adapters share mapped contracts, stable IDs, RAW writes and owned-column boundaries. Synchronization is serialized, durable, bounded and visible; direct external conflicts require owner resolution. Migration dry runs preserve 27 legacy headers/Thai status/phone semantics and stable import mappings. Reconciled nonpersonal rollups survive retention of eligible completed/cancelled records.

**Other pages and delivery (p30–31).** Catalogue chips/reset/bilingual search, meanings/card persistence, occasion continuity, gallery image failure/mobile navigation/focus/scroll, no-JS fallback and Thai spacing are repaired. Meaningful control borders and faint text have measured contrast checks. Editable source modules are bundled in order and served compressed; customizer/admin code remains separate.

## Verification
Current integrated command results are recorded in **FINAL-VERIFICATION.json**, including the new customizer, studio dashboard and native Mac app checks. Build succeeded. The separate direct-Sheet-conflict dialog check also passed against isolated synthetic data. Exact totals and service health are in FINAL-VERIFICATION.json; machine-readable browser output is in browser-results.json. Functional browser tests use Playwright WebKit. Local performance uses Chromium with identical documented throttling/compression for baseline and updated versions. Neither is physical Safari/iPhone or VoiceOver validation.

Evidence includes:
- Exact original logo final-frame comparisons and delayed-real-image readiness tests in docs/logo-qa.
- All eight actual recipe images, seven styles, mobile/desktop design and booking screenshots in docs/final-qa.
- Published/tier/expiry pricing, tampering, explicit price-change acceptance, independent price/image failure, immutable receipts and complete customer→staff journey.
- Consent/media-format/size/access controls, stale uploads, read-only staff restrictions, local-only network destinations and no-JS recovery.
- Lost acknowledgment, duplicate submission, pending/retry/dead-letter synchronization, field conflicts, ledger totals, zero/unknown history and retention reconciliation.
- Responsive route checks 320–1440px, short landscape, focus/caret,200% root-text reflow and sampled contrast.

The initial gap rows in REQUIREMENT-MATRIX.md are retained as history; its current-status table and this report supersede those initial missing-feature observations.

## External inputs and unverified conditions
These do not authorize a live connection:
- Florist-approved availability, substitutions, physical size exemplars and custom-cost rules. Relative size choices are requests, not invented dimensions or stem counts.
- Florist approval of AI concepts. Full photorealistic AI generation for arbitrary combinations needs an approved provider/model and cost policy. Automatic local composition previews are available now.
- Authorized sandbox Sheet headers/OAuth/owned columns and a real roundtrip; current Google tests inject a mock transport.
- Production staff identity, payment/order/notification configuration and owner-reviewed retention/privacy policy. Demo role selection is not production authentication.
- Genuine historical receipts/refunds/coverage. Synthetic amounts demonstrate accounting behavior only.
- Physical Safari/iPhone, VoiceOver, complete WCAG assessment and field p75 LCP/INP/CLS. The controlled measurement in PERFORMANCE.md remains above the 2.5s LCP target; it must not be marketed as a performance pass.

The original published repository remains unchanged. Existing local review data is retained. Customer 5173, Staff 5174 and API 8787 bind to 127.0.0.1; README.md documents start/stop/build and review links.
