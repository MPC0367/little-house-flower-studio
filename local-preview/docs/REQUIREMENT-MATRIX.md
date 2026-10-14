> Historical implementation note. For the uploaded application and current checks, start with [README](../README.md) and [GitHub review notes](GITHUB-REVIEW.md). References to raw assets, baseline snapshots and machine QA reports are retained for context; those files are excluded from this source package. Later features, including the supplied video intro without a Skip button, supersede earlier descriptions.

# PDF requirement matrix — careful second-pass review

Reviewed the complete **39-page** `little-house-flower-audit-and-gpt-6-astra-prompt.pdf` through `docs/pdf-review/full-text.txt` on 14 October 2026 (Asia/Bangkok). Page numbers below refer to PDF pages, not text-file lines. This is the **initial gap audit before the second implementation pass**; concurrent fixes must receive fresh acceptance evidence before statuses change. Source inspection is not a browser, accessibility or production-integration pass.

Statuses: **Present** = implementation located in source; **Partial** = meaningful implementation but missing specified behavior; **Missing** = no implementation found; **External** = an actual owner/service dependency; **Verify** = required test evidence absent. Existing 20-browser/14-domain test claims are limited to their individual assertions and do not imply full PDF completion.

## Current second-pass status — read this before the historical matrix

The detailed rows below intentionally preserve the initial discovery record. **They are not a list of currently missing features.** The second pass has since added these concrete implementations and tests:

| PDF area | Current evidence | Remaining practical limit |
|---|---|---|
| p12–14 hero and original logo | `upgrade.js` keeps the4source photos, no hero scaling, stages later slides and applies breakpoint focal positions; `logo-intro.js`/editable SVG masks use original artwork, readiness milestones, bounded Skip/fallback and session behavior. `docs/logo-qa` contains zero-error final-frame source comparisons and 11 WebKit cases. | Physical Safari/VoiceOver remains unverified. Hero staging was added after the recorded delivery benchmark. |
| p15–18 builder and preview pipeline | Illustrated recipes cover all7styles plus a second bouquet;18flowers keep bilingual names, evidence-aware color indicators and available shop thumbnails. Validation/field errors, state retention, mobile collapse, budget summary, recipe confirmation, abort/debounce, queued/provider/validation/cache contracts and exact asset versions are implemented. Quote-only catalog photos now work independently of price. | Eight full concepts remain a finite corpus. Automatic locally composed illustrative previews now cover supported visual choices; paid full-image generation stays disconnected. See LOCAL-APP-UPDATE.md. Florist-approved compatibility/scale/material/color inventory remains owner input. |
| p19–21 price and booking | Published/tier/expiry pricing stays integer-satang; changed designs stay quote-required. Preview and estimate freshness are independent; budget feasibility is shown. Shared translated design rows preserve free text and reach review/receipt/copy/calendar. Final pre-submit price check and changed-price acknowledgment are implemented; price-check.spec.mjs passes both price-change and unrelated-draft cases. | Unknown custom adjustments remain disabled instead of fabricated. Real owner-approved adjustment bands/size exemplars are not supplied. |
| p21,29 privacy and receipt | `core/db.js` now retains an allowlisted nonpersonal design/estimate/public asset/version snapshot for30days; it strips customer/card/address/free text/private reference URLs/tokens and scrubs older nested values on revisit. Card helper loads/persists the existing36-hour draft. | Browser receipt deliberately omits personal details after refresh. Reference photos remain private server assets and are never exported into the minimal local receipt. |
| p22–29 staff and integration | Added full filters/sort/counts, saved design thumbnails, owner reasoned correction, Save/Discard/Keep editing, conflict comparison/resolution, separate card print/reply draft, payment idempotency, zero/unknown coverage, explicit period bases, contributor views, mapped disconnected Google adapter, migration mapping and reconciled retention. See `STAFF-IMPLEMENTATION.md` and staff test suites. | Real sandbox credentials, actual Sheet header ownership and production identity remain external. No Google write or notification was performed. |
| p30–31 remaining customer pages | Bilingual filter chips/reset, expired-price labels, meanings recovery/persistence, occasion draft preservation, gallery media states/mobile controls/keyboard/focus/scroll, observer failure recovery and Thai spacing implemented. `customer-polish.spec.mjs`:8/8WebKit passed. | Tests cover specified behaviors, not all assistive technologies or a full WCAG audit. |
| p31 measured performance | `PERFORMANCE.md` records initial and bundled/gzip three-pair desktop/mobile Chromium measurements with equal compression in the final comparison, real LCP/CLS entries and external-write blocking. | Final measured updated LCP4.280s desktop /3.408s mobile is slower than the equal-gzip baseline3.932s/3.024s. No field-p75/INP target certification. |
| p30–31 targeted contrast | `polish.css` strengthens muted text and meaningful control borders only; decorative separators are unchanged. Rendered WebKit contrast samples and regression evidence are documented below. | Gradient/photo text, disabled controls, full focus-state/assistive-technology coverage are not claimed as audited. |
| p33–36 verification/handoff | Regression includes real calendar download, denied-clipboard recovery, card persistence, malformed/deep links, no-JS fallback with no blocking overlay, local-only request destinations and privacy-safe refreshed design. Final integrated run passes 42 unit/backend and 87 WebKit browser tests; all three local services return healthy. | Final integrated totals belong in `HANDOFF.md`; isolated suite counts must not be added together as if they were a fresh final run. |

Final integrated tests include the price-change acknowledgment, hero smoke after staging and staff no-overlap/foreground polling checks; see HANDOFF.md and FINAL-VERIFICATION.json for final results. Other remaining constraints are supplied-business-data or test-environment limits rather than authorization to connect production.

## Initial implementation defects (historical audit, before the fixes below)

1. **Actual-photo availability incorrectly depends on price.** `server/main.mjs` serves Tier A only when `estimate(c).kind === 'published'`. Unchanged quote-only baskets and expired catalogue products still have valid photographs (p17); image matching must not depend on numeric-price availability.
2. **Free text is altered each time a design continues to booking.** `customer/customizer.mjs` joins `b.feel` with material/finish/ribbon/size, writes it back, then appends those labels again after an edit. Preserve free text and derive the display summary from structured fields.
3. **Price validity is coupled to successful image generation.** Builder handoff stores `estimate` only when `currentPreview()` is true. The estimate and preview are independently versioned outputs (p20); generation failure cannot erase a valid price result.
4. **Thai review includes internal English IDs.** Customizer review and `LHF.designSnapshot` render `bouquet`, `paper`, `cream`, `reference`, etc. Translate displayed labels while keeping stable machine IDs.
5. **Blank/unavailable custom previews are the normal experience.** One exact generated key is the only custom coverage. There is no practical preview catalogue, queued generation or lifecycle UI; most valid designs cannot demonstrate the requested workflow.
6. **Customizer step links bypass current-step validation.** Every progress button changes `step` immediately. Error messages have no field association and first invalid control is not focused.
7. **Backend adapters do not share a working contract.** Local adapter implements read/upsert/payments; Google adapter only has readRanges/writeRanges. The missing mapped adapter can be built locally without credentials; live verification remains external.
8. **Required sample coverage is substantially absent.** Eight catalogue orders do not demonstrate the seven custom styles, zero-versus-unknown financial history, failed/pending previews and media failure examples required on p33.

## Preservation, identity and hero

| Requirement | PDF | Status at audit | Evidence / next acceptance |
|---|---:|---|---|
| Localhost only; no GitHub/Sheet/notification writes; retain previous work | 1–3, 10, 32, 39 | Present | New sibling folder, disabled Apps Script, loopback server and local Sheet fixture. Recheck network and remote state at final handoff (T27). |
| Read entire PDF before edits; distinguish reference from authorization | 2 | Present | This audit covered pages 1–39. Current user authorizes local execution, not deployment. |
| Preserve all hash routes, invalid-product and confirmation recovery | 10, 30 | Present / Verify | Original router/modules retained. Nine main routes have responsive tests; nested post/occasion/confirmation/error routes need assertions. |
| Preserve homepage section order, shop story/contact/credit and 16-product fields | 10 | Present / Verify | Original catalogue/settings/posts retained. Confirm full field-level parity and page section order after second-pass edits. |
| Preserve date engine, business facts, 18 flowers, 7 styles, 10 occasions | 10, 16 | Present | Original engine plus catalog test counts; retain phone/LINE/address/hours and conditional promotion. Style-specific invented lead times are prohibited. |
| Existing fonts/colors/paper language; no layout replacement | 11 | Present | Original tokens/font CSS used. Verify Thai mark clipping and actual contrast pairs. |
| Semantic surface/state tokens and measured contrast | 11, 31 | Partial / Verify | Existing colors reused, but no contrast report or complete semantic alias layer. Check text 4.5:1 and controls 3:1. |
| Micro-motion timings; reduced-motion final states; pause while hidden | 11 | Partial | Hero pauses while hidden and static reduced-motion. Preview decode/fade absent; loader and hero/marquee choreography not coordinated. |
| Remove hero scale/seam; fixed reserved geometry | 4, 7, 12 | Present | `upgrade.css` removes scale/gradient; breakpoint/browser geometry tests exist. Inspect actual crops and no-strip cold load. |
| Exact four-photo order, captions and current price rules | 12 | Present | `upgrade.js` uses four named keys and catalogue caption pricing. Verify all four frames at desktop/mobile. |
| Per-breakpoint focal points and available source resolution | 12 | Partial | One object-position per slide; no distinct mobile focal data applied. Source resolution provenance exists in manifest. |
| Preload first, decode next/background then remainder; skip failed images | 12 | Partial | First eager and new slide decoded; no staged next-image preload. Failure skip test exists. |
| Carousel manual/keyboard controls, 44px, pause focus/hover/hidden | 12 | Present / Verify | Source implements these. Test full auto cadence, manual stop/resume, focus and hidden visibility. |
| Faithful layered editable logo, fixed LH, stem/petal bloom, wing groups/path | 13 | Missing | Current intro displays original flattened JPG. No layered SVG, paths or animation source at audit. |
| Exact final logo overlay comparison at small/large sizes | 13 | Missing | Required evidence must compare final asset against supplied 447×447 JPG, not merely visually approximate it. |
| Readiness percentage from settled shell/logo/hero/route milestones | 14 | Partial | Weighted promise milestones exist; route readiness represented by rAF, not explicit rendered state. No smoothed monotonic progress. |
| Bounded 2.5s overlay, Skip, focus/inert, session, reduced motion | 13–14 | Partial | Current static overlay includes these basic safeguards. Keyboard Skip, direct-route, exception and blocked-font cases not comprehensively tested. |
| Percentage bottom-right mobile16/desktop24 + safe area; quiet semantics | 14 | Partial | Desktop24 exists; mobile/safe-area override absent. Progress semantics present; screen-reader review unperformed. |
| Loader cannot conceal layout bugs; no JS overlay trap; honest shell-failure state | 4, 14 | Partial | Overlay injected only by JS and max timeout removes it. Explicit useful shell-error/retry not provided. |

## Customizer, previews, pricing and booking

| Requirement | PDF | Status at audit | Evidence / next acceptance |
|---|---:|---|---|
| Five steps, desktop55/45, mobile preview first/collapse | 15 | Present | `customizer.mjs` and upgrade CSS implement layout and navigation; mobile summary collapse lacks expanded-state semantics. |
| Continuous style/flowers/finish/**budget** summary | 15 | Partial | First three shown; budget absent from preview summary until review. |
| Required/optional labels; current-step errors and navigable error summary | 15, 31 | Partial | Occasion/reference optional marked. Step navigation bypasses validation; errors not linked to fields. |
| Preserve values on back/refresh/language and warn dependent invalidation | 15, 20 | Partial | Persistence exists; style/container native confirmation preserves unrelated choices. Free-text append bug and raw-ID labels need fixing. |
| Florist's choice representative concept, bespoke request path without image | 15, 17 | Partial | Empty flower selection and consultation continuation exist. Representative concept absent. |
| Explicit Actual / AI / customer reference / unavailable role labels | 15, 21 | Partial | Actual/concept/stale/unavailable labels exist. Reference image separate, with minimal role explanation. Staff actual/concept labels need consistent treatment. |
| 18 flowers bilingual names; thumbnails if available and supported color indicators | 16 | Partial | All choices retained; symbols replace thumbnails; flowerColors has only ten entries and is exposed via title, not meaningful swatches. |
| Natural/dyed/mixed/seasonal evidence; soap/foliage distinctions | 16 | Partial | Rose/eucalyptus/soap explanatory copy exists. Full supported-color data and evidence approval absent. |
| Text-labelled flower-color swatches separate from finish; no impossible roses/foliage | 16 | Partial | Finish swatches good. Flower palette is generic select; only red/white-green conflict rules exist. |
| Compatibility for style/container/flower/finish/size with disabled reasons | 16 | Partial | Containers and finishes constrained. Flower/style/size compatibility is not explicit; unavailable options disappear instead of offering reasons/alternatives. |
| Exact budget range IDs/custom minimum; real size exemplars | 16 | Partial | Range IDs/minimum250 retained. Reference/smaller/larger choices lack cited exemplar/recipe; custom step50 should be checked against original rule. |
| Money face value separate; wreath/garland/bridal consultation and lead rules | 16, 20 | Partial | Banknote value field exists but absent from review/admin financial breakdown and validation policy. Style-specific consultation rule metadata missing. |
| Tier A matching catalogue photos, including quote-only products | 17 | Defect | Numeric-price condition erroneously blocks actual quote-only/expired photos. |
| Tier B on-demand provider + persistent covered-key cache | 17–18 | Missing / External | One cached key only. Local queue/adapters/fixtures are implementable; paid provider credentials/budget are external. |
| Tier C honest unsupported/seasonal request path | 17 | Present | Explicit unavailable plus continue consultation. Must not use unsupported fallback as claim of Tier B coverage. |
| Canonical visual key covers every visible feature + versions; excludes PII/metadata | 17 | Partial | Style/container/finish/palette/sorted flowers/ribbon/size/source/version included. Flower proportions/colors, accessory/ref fingerprint not modeled. Avoid adding unsupported visual options without key support. |
| One job/key, queued→generating→validating→ready or failure, immutable assets | 18, 27 | Missing | Preview provider returns unavailable synchronously; jobs endpoint reads preview record. No actual lifecycle or bounded queue. |
| Debounce/abort obsolete view requests, server dedup, explicit update | 18 | Partial | Explicit Update and sequence ignore exist. No AbortController cancellation, server active job/session queue or debounce. |
| Preserve old image until new decode + crossfade; mark stale and disable reuse | 18 | Partial | Old image retained for pending/stale. Rendering replaces DOM before decode; no preview fade. Stale is excluded from booking snapshot. |
| Timeout/retry ceiling/provider budgets/abuse/body/image/cache caps | 17–18 | Partial | Body/upload/cache250 limits exist. No provider timeout/retry/budget/queue controls, request metrics or lifecycle failure demo. |
| Quality screening, provenance, QA/florist approval, responsive derivatives/original | 18 | Partial | One generated image has source/640/1200 derivatives and manual QA provenance. General validation pipeline and immutable per-job records absent. |
| Independently testable integer-satang price engine and exact anchors | 19–20 | Present | `estimate()` retains White Rose1090 and all single-rose tiers; expiry and client-tampering tests exist. |
| Complete estimate outputs: reasons/breakdown/confidence/comparators/expiry/exclusions | 19–20 | Present / Partial | Engine returns most fields for exact/unknown modes. UI hides most details; no editable unknown-adjustment table. |
| Unknown adjustments disabled; optional sample rules clearly separate | 20 | Partial | Unknown changes correctly quote-required. No rule-table layer or sample-off acceptance case. Sample numeric rules are optional; fabricated estimates forbidden. |
| Independent preview/price validity; explicit final reprice before submission | 20–21 | Partial | Server recomputes. Builder estimate tied to image-ready state; final review does not surface reprice/change confirmation. |
| Budget feasibility within/near/over + accepted suggestions | 20 | Missing | Budget is collected, never compared with known amount; no accepted suggested adjustment path. |
| Immutable design snapshot incl timestamp/catalog/rules/preview version | 20–21 | Partial | Server saves versions, configHash/snapshotAt. Client snapshot before final booking lacks independent timestamp/catalog version contract and review is incomplete. |
| Six-step existing booking, preserve other items, edit links, correct photos | 21 | Present / Partial | Flow retained, full local journey tested, other items retained. Review missing complete translated design details/estimate/banknotes. |
| Shipping fee unknown, request not payment/guaranteed slot | 21 | Present | Existing request semantics + nullable delivery fee and custom disclaimer retained. |
| Reference consent, private upload, format/bytes/dimensions/size/EXIF, remove/replace | 21 | Present | Server sharp validates JPEG/PNG/WebP5MB/25MP, converts strips metadata; owner/admin-only routes and tests. HEIC explicitly unsupported. |
| Separate immutable product/concept/reference asset records with hashes/dimensions | 21, 26 | Partial | Private uploads have most metadata; catalog/concept fixtures differ in schema; orderItems lacks stable line item IDs. |
| Stable request ID, durable acknowledge, timeout recovery, truthful replication pending | 21 | Present / Verify | Lookup-before-retry and transaction journal exist. Need real lost-ack/restart-during-pending browser/adapter test, not only journal reopen. |
| Receipt/copy/calendar/LINE/phone include design+estimate; no private URLs | 21 | Partial | Original actions retained. Copy summary omits complete structured flowers/presentation/estimate roles; custom feel mutation is workaround bug. |
| 36h draft/unused assets; minimal30d receipt | 21, 29 | Present / Verify | Cleanup implemented, expired draft test exists. Confirm actual saved receipt payload remains minimal and no orphan job/reference data persists. |

## Staff, integration, finances and data

| Requirement | PDF | Status at audit | Evidence / next acceptance |
|---|---:|---|---|
| Separate origin/app/API; server roles owner/staff/read-only | 22, 24, 27 | Present / External | Local sessions/role checks/origin constraints tested; production identity explicitly external. |
| Orders/calendar/earnings/settings IA; mobile settings secondary | 22 | Partial | Four views exist. Mobile settings remains equal nav item; no account/menu placement. |
| Compact rows with correct photo, amount type, status/payment; priority sort | 22 | Partial | Catalogue thumbs/status/payment present. Custom thumb can be logo/first product; explicit date/newest sort controls absent. |
| Filter status/date **range**/fulfilment/payment/type/search; filtered counts/saved views | 22 | Partial | Status/date/type/fulfilment/search and saved payment view exist. No general payment control/range/sort, header counts ignore filters. |
| Preserve scroll/filter; loading/empty/stale/offline/reconnect/read-only; no incoming jumps | 22 | Partial | Rows preserved during polling; notice used. Refresh rebuilds whole content and skeleton; stale threshold, reconnect/last-known lifecycle incomplete. |
| Drawer desktop/fullpage mobile; full order/config/media/event details | 23 | Partial | Dialog details exist. Test mobile fullpage, focus restoration; budget/estimate shown but several design metadata and role labels incomplete. |
| Forward transitions/pickup skip/out actor/time; unknown legacy needs review | 23 | Present / Partial | Forward matrix and audit exist. Request-details/delivery-issue actions absent; actual Thai import mapping only documentation. |
| Cancellation/backward/reopen/correction reasons | 23 | Partial | Cancellation reason required. No controlled correction/reopen/backward flow. |
| Save changed fields; saving/saved/failed; conflicts server/proposed/merge | 23 | Partial | Changed fields and409 with retained text exist. Server versus proposed values shown only for notes; full structured conflict resolution missing. |
| Unsaved close offers Save / Discard / Keep editing | 23 | Partial | Native confirm only Discard/Cancel; no Save action. |
| Copy ref/address, phone/LINE, print work ticket and free card, quote reason/payments | 23 | Partial | Copy/phone/work-ticket/quote/payments exist. LINE editable draft and dedicated card print absent; print layout requires QA. |
| Separate payment state, no status-derived payment, append-only audit | 23, 26 | Present | Server payment endpoint independent; receipts/refunds append-only and idempotent. Corrections/reversal_of not modeled. |
| Secure backend calls Sheets, durable journal not hidden production replacement | 24–27 | Partial | Safe local boundary, no live calls. Adapter equality/mapping unfinished; docs explicitly call journal prototype-authoritative. |
| Demo works credential-free; Google adapter shares contract and sandbox config | 24, 27 | Partial / External | RAW range interface exists; mapped upsert/read/payment contract absent. Sandbox auth/Sheet approval is external, implementation is not. |
| One poller, no overlap, staff-active5s, idle slowdown, foreground refresh | 25 | Partial | Single no-overlap2s worker; browser5s polling. No staff-active/idle cadence or foreground reconnect. |
| Sync ack pending/time; stale30s; 429/5xx jitter/retry-after/permanent failures | 25 | Partial | Pending/dead-letter/time and jitter exist. Retry-After ignored; simulator no typed permanent schema/auth handling. |
| Durable IDs/serial writes/row relocation/unknown outcomes | 25 | Present / Verify | Stable-ID upsert and transactions; reorder/retry tests. Need lost acknowledgment and restart-inflight integration tests. |
| Direct Sheet race detection plus append-only StaffUpdates, visible resolution | 25 | Partial | Direct conflicts and StaffUpdates implemented. Settings shows counts, not conflict detail/resolution. No atomicity claim made. |
| Preserve27 legacy columns and add normalized versioned tabs | 26 | Partial | Mapping document exists; actual fixture only Bookings/Payments/StaffUpdates/AuditLog JSON and proposed schema subset. No normalized assets/items/config/revenue Sheet adapter. |
| Backup/export dry run header counts/missing/duplicate/status/date/money report | 26 | Partial | Normalized row dryRun quarantines basic cases. No header normalization/Thai map/backup/report runner/persisted migration ID mapping. |
| Stable migration IDs survive edits/reimports | 26 | Partial | Hash entire missing-ID row means a modified legacy row gets a new ID; must persist source mapping. |
| RAW Sheet/customer text, formula-safe CSV, phone strings | 26 | Present / Verify | RAW range write and safeCell unit test; no CSV export currently. Verify mapping retains leading-zero phones. |
| API allowlists/methods/lengths/enums/date/money/assets; private no-store/redacted | 27 | Partial | Significant validation and access controls exist. Complete schema definition and consistent response redaction/asset role metadata need adversarial tests. |
| Cash receipts/refunds/Bangkok period/date distinct from quotes/order value | 28 | Present | Deterministic1490−200=1290 and deposit-only500 tests. Period/date labels exist. |
| Weekly Monday–Sunday/month/day/year; dynamic year and partial-period controls | 28 | Partial | Week start seeded Monday but arbitrary date accepted; years hardcoded2025–27; no previous-period/partial treatment. |
| Outstanding/confirmed/completed and pass-through delivery/banknotes | 28 | Partial | Main metrics exist; outstanding explicitly all orders. Pass-through components absent from revenue definitions/UI. |
| Chart labels/table/contributor links/status counts; grayscale refunds | 28 | Partial | ARIA labels/table exist; no keyboard tooltips/contributing orders/status lists. Refunds depend on color with general legend; grayscale review needed. |
| Verified zero vs missing history and legacy Paid without timestamp | 28, 33 | Partial | Legacy unknown excluded; all missing rows marked unknown. No verified-zero coverage ledger/sample month. Headline still shows0 for fully unknown periods. |
| Idempotent reviewed rollup before purge + checksum/error; historical survival | 29 | Present / Partial | Rollup/purge/retry tests; checksum stores net sum not independent reconciliation; open unresolved old orders excluded from purge. |
| Privacy notice describes location/access/provider policy/TTL; no default photo→AI | 29 | Present | New notice states local private storage/no AI; owner legal/privacy review external. |
| Delete all eligible assets/derivatives/queues/logs, old unresolved cases, no private offline cache | 29 | Partial | Orders/done/cancelled/media/events/queue cleanup exists. Reconciliation and retention scope need review; production backups external. |

## Remaining pages, accessibility, performance and handoff

| Requirement | PDF | Status at audit | Evidence / next acceptance |
|---|---:|---|---|
| Header/nav order active aria;44px; focus/menu/contact/footer | 30–31 | Partial | Active aria added for desktop nav; measure mobile menu/control targets, restore focus and Thai marks. |
| Catalog photo/list/filter URL/search/sort/count/selected chips/clear no-result | 30 | Partial | Search/sort works and tests exist; selected removable chips absent; empty state no contextual clear; check localized name matching. |
| Product full info plus prefilled custom action and exact quantity tiers | 30 | Present | Original details preserved, customize action added. Test source appearance/price/photo and existing items. |
| Ten occasion counts/imagery, seasonal caveats, prefill preserve another brief | 30 | Present / Verify | Existing route merges occasion only. Test unrelated saved brief and required navigation state. |
| Meanings search empty/Thai content; card helper count/draft/preview | 30 | Partial / Verify | Original helper retained. Search-empty refinement and full regression tests absent. |
| Instagram loading/empty/error, captions/reels, keyboard modal/focus/grid position | 30 | Partial | Original viewer already Escape/arrows/trap/restore; image error and accessible mobile navigation/return position tests absent. |
| Contact call/copy/map fallback, no invented zones | 30 | Present / Verify | Original source retained. External destinations read-only validation, lazy-map failure test absent. |
| 44px preferred targets, grouping/labels/errors, no hover-only actions | 31 | Partial / Verify | New swatches generally44+; many labels use generic wrappers, error linkage missing. Full keyboard walk not yet done. |
|200% text/320 reflow/short landscape/Thai marks/VoiceOver | 31 | Partial / Verify | Width tests and root-size test exist. Root-size is not actual browser zoom; physical Safari/VoiceOver and short landscape unverified. |
| Measured before/after same throttling LCP/CLS, no field claim | 31 | Missing / Verify | Screenshots are not performance metrics; no lab report. INP field target cannot be certified locally. |
| First hero explicit dimensions/srcset/priority; preview space; route code split | 31 | Partial | First hero and lazy customizer exist; old unused custom page remains public bundle. Next-slide image staging absent. |
| Lazy map/social/font fallback, reduced-motion/reveal JS failure | 30–31 | Partial / Verify | Original reveal/fallback logic exists but observer exception/runtime failure not tested. NoJS content limited to fallback. |
| Accurate meta/canonical/title/structured-data, localhost noindex | 31 | Present / Verify | Noindex set in headers/meta; original metadata preserved. Nested-route title/quote-only Offer audit needed. |
| All required synthetic style/status/media/history/failure fixtures | 33 | Partial | Eight catalogue orders/ledger fixture only; custom7styles/bluebox/zero-month/media failure/pending job cases absent. |
| End-to-end ID/config/image/estimate/Sheet/staff2tabs/deposit/revenue | 33 | Partial | Main generated concept→booking→staff/status/deposit/second tab test exists. Same-config fixture comparison and earning delta need explicit assertions. |
| Editable logo/hero manifest/preview manifest/options/pricing/status/schema/env | 36 | Partial | Most docs/config exist, but logo layers, broadened preview manifest and editable pricing rule table absent. |
| Start/stop/runtime/ports/login/adapter swap/reset/import docs | 36 | Partial | Setup/start/stop exists. Working fixture import/mapped adapter swap needs implementation/docs. |
| Change log by audit IDs, parity, before/after, pass/fail/not-run matrix | 36 | Partial | Prior HANDOFF has honest limits/screenshots, but whole-document traceability absent before this matrix. |
| Working URLs checked and servers left available; explicit no publication | 36 | Verify | Final rerun health checks after all fixes and provide start/stop commands. |

## Acceptance tests T01–T27: evidence still needed

| ID | Existing evidence at audit | Missing or strengthened assertion |
|---|---|---|
| T01 | Breakpoints899/900/1199/1200 and scale-none | Cold image/font load actual crop seam and responsive final captures. |
| T02 | Four manual captions, broken slide | Auto cadence, hover/focus/tab visibility, first→next decode; caption remains matching during crossfade. |
| T03 | Static reduced-motion behavior in tests | New full logo fidelity; first/cached/direct/Skip/font/image/JS/decode failure, overlay budget and focus. |
| T04 |320/390/768/1024/1440 nine routes; root200% | Short landscape, mobile keyboard, Thai tone marks, actual zoom, drawer and collapse targets. |
| T05 | Search/sort/list reload | Combined filters/removable chips/count/Back restoration/clear-empty and cross-locale flower terms. |
| T06 | White Rose unchanged/existing items retained | Quote-only actual preview, single rose qty, edited-source image/pricing invalidation. |
| T07 |3flowers/fourth feedback | Each7style relevant material/flower/size/consultation states and accessible selected controls. |
| T08 | Source confirmation branch | Confirm and cancel dependency change, both container and style; preserve unrelated notes/reference/budget. |
| T09 | Changed selection stale label | Two queued requests resolve out of order, abort, one active key, only matching result accepted. |
| T10 | Valid/corrupt/oversized/consent/private/remove | Unsupported HEIC bytes,25MP cap, replacement failure/no leaked old image, EXIF strip. |
| T11 | Price anchors/tiers/expiry/unknown/tamper | Budget near/over, independent price on failed preview, sample rules off, explicit final reprice. |
| T12 | Reload/Thai draft preservation | Full back/refresh/language across every stage and free-text-not-appended regression. |
| T13 | Concurrent submit/scoped lookup/500pending | Lost acknowledgment browser timeout, retry same ID after process restart, receipt remains honest. |
| T14 | Main page smoke only | Card helper/counter/calendar/copy design/invalid routes/privacy/map/social read-only links. |
| T15 | Unauthenticated/read-only/customer-origin/CSRF | Every admin/private media endpoint/method; session expiry/logout and no private response headers leakage. |
| T16 | Booking2tabs/deposit update | Exact asset version/config/estimate identity once in normalized Sheet fixture and list thumbnail. |
| T17 |409 API+editor implementation | UI unsaved text retained, explicit proposed/server values, Save/Discard/Keep editing. |
| T18 | Stable-ID reorder upsert test | Reorder/insert then real admin update; neighboring row unmodified. |
| T19 |500recovery/journal reopen |429Retry-After/5xx/offline/lostack/dead-letter ceiling/no overlap/foreground recovery. |
| T20 | StaffUpdates roundtrip | Direct unauthorized field edit conflict surfaced and resolved without pretending transactional Sheet CAS. |
| T21 | Unit pickup skip/cancel reason | UI ready→done versus ready→out→done; actor/time retained; unchanged ledger; corrections reason. |
| T22 |1490gross200refund1290net/Bangkok boundary | Ledger→chart/table equality, deposit-only period, cancellations, corrected receipts, zero/unknown coverage. |
| T23 | Purge/rerun/external cleanup retry | Private upload deletion + no PII across every collection/fixture; independently reconciled total marker. |
| T24 | Private media denial/access | Public bundle/log scan, CORS origin/CSRF, private work-ticket and expiry leakage assertions. |
| T25 | Duplicate/invaliddate/status/RAW tests | Actual legacy headers/Thai statuses, stable persisted missing-ID mapping, leading-zero phone, report counts. |
| T26 | Shared config source exists | Modify one option/label/disabled rule fixture and prove UI+API both change without hardcoded edits. |
| T27 | Local-only source design | Final network destination capture, original repo status, no notifications/remotes/tunnel/deploy command. |

## Genuine external dependencies versus locally implementable work

**External inputs:** florist-approved material/color/recipe availability and custom price adjustments; final florist approval of generated designs; paid generation model credentials/approved cost ceiling; authorized sandbox Sheet/header access/OAuth identity; production staff identity/roles; reliable historical payment/refund records; owner-reviewed privacy/retention/notification policy; higher-resolution original logo/vector master if fidelity cannot be achieved from supplied JPG.

**Not external blockers:** local layered asset work using supplied reference, honest style reference previews and a documented generated corpus, queued/failed/stale pipeline fixtures, complete provider and Sheet adapter contracts, offline-safe workflow, local schema migration tooling, configurable pricing rules with unknown bands disabled, bilingual labels, accessibility/errors, missing staff controls, payment coverage fixtures, acceptance tests and lab measurements. The PDF expressly requires these local pieces even when real services stay disconnected (p37).

## Second-pass customer-page work completed after the audit

The following scoped refinements are now implemented; the initial matrix above remains a record of what was missing when the PDF was first re-read.

- **U01/U02:** minimum44px menu/icon/viewer controls, mobile viewer Previous/Next controls, Thai heading/mark spacing, short-landscape viewer layout.
- **U03:** bilingual flower-name search excludes metadata/IDs; removable selected-filter chips, contextual Clear all filters, safe unsupported-sort fallback, preserved query/view/count behavior.
- **Price consistency:** all shared catalogue/hero display-price labels now obey the original price-validity engine; expired tier price-list notes are not represented as current prices.
- **U05:** product-card body alignment and unobscured Thai heading line height; full information remains on unchanged product routes.
- **U06:** image loading/unavailable states, no nested source links inside gallery buttons, honest source-link/retry viewer fallback, persisted Load more count, accessible mobile viewer controls, background inert/focus restoration and exact return scroll. A real Safari/WebKit issue was fixed by retaining the clicked trigger explicitly because pointer-clicking a button does not necessarily make it `document.activeElement`.
- **U07:** reveal fallback timer is installed before observers; a thrown observer cannot leave sections hidden.
- **Page30:** meanings text/count/empty-state recovery persists through language changes and refresh using the existing36-hour card draft; occasion prefill retains unrelated custom details and card text; mobile navigation includes current-page semantics.

**Scoped verification:** `tests/customer-polish.spec.mjs` — **8/8 WebKit tests passed**, using synthetic isolated local fixtures on5373/5374/8987. Tests cover bilingual search/chips/clear, expired display prices, meanings persistence/recovery, occasion draft preservation, viewer keyboard/focus/scroll, failed-gallery image recovery,320px and667×375 controls/reflow, and observer exception fallback. This does not certify physical Safari, VoiceOver, WCAG conformance or field performance. Loaded mobile gallery output was visually inspected. The shell includes `/polish.css`; final full-suite tests must rerun after the remaining parallel changes.

## Final independent customer regression and contrast evidence

`tests/regression.spec.mjs`: **8/8 WebKit tests passed in6.2seconds**, using new synthetic fixtures on5373/5374/8987. Verified actual .ics download with Bangkok→UTC timing and75-byte UTF-8 folding; denied-clipboard editable selection fallback; saved card text/counter/preview; business links without clicking external destinations; invalid/malformed route recovery; no-JavaScript contact fallback immediately usable; browser write destinations restricted to loopback; refreshed custom receipts preserve public design/versions/estimate while stripping personal and private upload fields, including legacy nested values. The network case retains an unfinished builder draft while submitting a catalogue product.

Targeted contrast refinements live only in `polish.css`. Decorative page separators remain unchanged. The text token formerly `#8A7B73` (3.68:1 against paper) is now `#75665E` (4.97:1 against paper;4.58:1 against paper2). Actionable borders formerly using pale line colors at1.25–1.53:1 now use `#796E65`:4.48:1 against paper;4.14:1 against paper2;4.75:1 against the form surface. This applies to filter/choice/recipe/swatches, date/time controls, quantity/upload boundaries and secondary actions. Active language has an ink underline; selected radio marks use ink, so state does not rely only on the pale fill.

The browser test reads rendered `getComputedStyle` colors, resolves transparent ancestors to the nearest opaque surface, computes sRGB contrast and checks normal text≥4.5:1 and each sampled visible control border≥3:1 against inner and outer surfaces. It samples catalogue search/filter controls, language control, builder styles/recipes/palette/finish and booking date/time controls. Final sample count and minima: **23 elements; minimum text 4.533:1; minimum meaningful boundary 4.484:1**. Disabled controls and decorative borders are excluded; this is not a full automated accessibility audit, photo/gradient contrast certification, VoiceOver review or physical Safari verification.

The measured delivery profile is in `PERFORMANCE.md`; it records both the improvement after bundling/gzip and the remaining LCP gap honestly. No field-performance score was fabricated.
