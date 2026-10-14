> Historical implementation note. For the uploaded application and current checks, start with [README](../README.md) and [GitHub review notes](GITHUB-REVIEW.md). References to raw assets, baseline snapshots and machine QA reports are retained for context; those files are excluded from this source package. Later features, including the supplied video intro without a Skip button, supersede earlier descriptions.

# Record mapping, migration and adapter contract

The private live Sheet has not been accessed. This document describes the repository's public Apps Script contract and the implemented local/sandbox interfaces. No live migration has run. Local records and local account roles are synthetic.

## Legacy fields and dry-run normalization

The public contract has 27 fields: 24 original fields plus `payment`, `source` and `writtenIso`. `server/schema.mjs` exports the exact `legacyHeaders` list, `legacyStatuses`, versioned `schema`, `validDate` and `dryRunImport`.

| Existing columns | Implemented normalization / treatment |
|---|---|
| `id`, `ref` | `id` is immutable; `ref` is display-only. Missing IDs use a deterministic migration ID keyed by reference or a stable content fingerprint. The returned `migrationMap` must be saved and reused. Duplicate IDs are quarantined. |
| `status` | Known Thai labels map to stable status IDs; the original label is retained as `originalStatus`. Unknown values become `review` in the quarantined record. |
| `dateNeeded` | Normalized to strict `YYYY-MM-DD` requested date; impossible dates are quarantined. |
| `received`, `writtenIso`, `created_at_utc` | Recognized timestamps map to `createdAt`; original fields remain in the private `legacy` snapshot. Invalid or ambiguous timestamps are quarantined for review. No timestamp is inferred as a payment date. |
| `window`, `fulfil` | Original time-window text is retained for migration review; new orders derive valid window IDs and labels server-side. Unknown nonempty fulfillment values are quarantined. |
| `items`, `brief`, `budget` | Original descriptions retained in `legacy`; never treated as the sole structured truth or parsed into invented flower configurations. New orders have immutable structured items/configuration and server pricing snapshots. |
| `subtotal`, `quoteNeeded` | Strict legacy THB subtotal is converted to `legacySubtotalSatang`; it is not promoted to a confirmed quote or a receipt. Malformed money is quarantined. |
| `confirmed_total_satang` | Recognized normalized extension; must be a nonnegative integer. |
| `customerName`, `customerPhone`, `customerLine`, `recipientName`, `recipientPhone` | Names/contact meanings retained. Phone strings keep leading zeroes. Numeric source phones receive a review warning because lost zeroes cannot be recovered. |
| `address`, `district`, `province`, `card`, `anonymous`, `lang`, `notes` | Retained as private original intent. Staff changes use explicit revision/audit fields on normalized records. |
| `payment` | A legacy Paid label without dated events sets `historyIncomplete`; it contributes nothing to dated cash receipts. |
| `source` | Original provenance retained. |

Thai statuses: รอยืนยัน → `new`; ยืนยันแล้ว → `confirmed`; กำลังจัด → `preparing`; พร้อมรับ → `ready`; ออกจากบ้านแล้ว → `out`; ถึงมือแล้ว → `done`; ยกเลิก → `cancelled`.

`dryRunImport(rows, {headers, migrationMap})` accepts objects or header-indexed arrays. It returns recognized/missing/unrecognized headers, row count, accepted and quarantined records, all validation reasons, warnings, the persistent migration map, and `destructive:false`. It does not modify a Sheet or apply rows to the journal. Retaining raw legacy data is restricted to the authorized migration sandbox. Legacy records without IDs/references must be reconciled against their saved mapping before changing their source content; a changed identity-less row cannot be reliably matched by guesswork.

Before any later authorized import, export the original test data and mapping, inspect the report, resolve quarantined rows, verify every private header and preserve formulas/validations outside owned ranges. The currently unknown private schema is a specific connection prerequisite, not an unimplemented local normalization layer.

## Local records and units

| Local collection / Sheet-shaped tab | Implemented contents |
|---|---|
| `orders` / `Bookings` | Stable ID, server reference, date/window/fulfillment, customer/recipient fields, schema/config snapshots, order status, quote and delivery fee, revision, author/time and sync state. |
| `OrderItems` | Stable per-order item IDs, quantity, product and pricing snapshot; a separate custom item preserves configuration hash, preview asset/version and estimate. Materialized by the local adapter. |
| `assets` / proposed `Assets` mapping | Private reference owner/order ID, MIME, dimensions, content hash, creation time and authenticated file route. Catalog/concept assets have separate public provenance. No binary images or tokens are put in Sheets. The local asset metadata remains in the private journal/storage; the future Sheet Asset index requires verified owned-column mapping. |
| `payments` / `Payments` | Append-only event ID/order ID, receipt/refund, integer satang, actual event timestamp, method/reference, actor, reason and optional reversal ID. |
| `events` / `AuditLog` | Actor/time, old/new changed fields, revision, reason/origin; conflict resolutions include the chosen source. |
| `StaffUpdates` | Stable request ID, order ID, expected revision, requested changes and processed/conflict result. |
| `queue`, `payment_sync`, `audit_sync`, `staff_operations` | Durable replication/recovery state. These are backend journal records, not replacement business invoices. |
| `rollups` / `RevenueDaily` | Versioned nonpersonal daily cash/confirmed-value/count totals preserved through retention. Monthly/yearly results are grouped from these daily values. |
| `coverage` / proposed `Coverage` | Explicit from/to completeness declarations and source/review time. Unknown periods remain unknown; complete periods with no events are zero. |

Payments/confirmed quotes/delivery fees use integer satang. The inherited storefront's catalogue unit/line/subtotal boundary uses THB and is recomputed on submission using the original pricing engine. A custom estimate, confirmed arrangement quote, separate delivery fee and actual receipts have distinct meanings. A confirmed delivery fee is included in payable/outstanding, but is displayed separately from arrangement value. Requested banknotes are contextual pass-through amounts, not automatically confirmed or received money.

## Working adapters

`LocalDemoAdapter` and `GoogleSheetsAdapter` implement `read`, `getOperation`, `upsert`, `payments`, `audit`, `appendStaffUpdate` and `markStaffUpdate`. Google remains uninstantiated in the preview. The Google constructor requires `sandbox:true`, an explicitly authorized spreadsheet ID, a server token-provider function and approved owned-column mappings. It enforces request timeouts, exposes retry status/Retry-After, uses RAW writes and serializes its writes. The worker handles durable retry/backoff/dead letters.

A tab mapping has the form `{tab:'Bookings', id:'AB', record:'AC', operation:'AD', start:2}`. Map Bookings, Payments, AuditLog and StaffUpdates after inspecting the test Sheet. These columns are examples only. Each operation re-reads stable IDs and writes only its mapped cells; unrelated legacy columns/formulas remain untouched. The JSON extension preserves the complete structured snapshot. A row reorder does not redirect a write to a neighboring order. A lost acknowledgment is reconciled by the operation ID before retry. Payment IDs are immutable, and previously synchronized payments/audit events are not repeatedly rewritten.

The Sheet simulator is the replicated local business record; the durable journal is the application's operational read cache and source of pending operations. One shared worker polls at approximately 5 seconds during authenticated staff activity, slowing to 30 seconds when idle. Staff browsers poll only the cached local API. The journal survives backend restart; order/payment writes remain visible as pending or requiring retry until acknowledged.

An `expectedRevision` mismatch returns 409 and retains draft text. Direct Sheet edits are captured as conflicts rather than silently adopted. In Settings an owner compares values and can keep the studio record or apply reviewed Sheet values with a reason. The conflict snapshot/version must still match, and the result creates a new audited revision. StaffUpdates use the same validation path and durable operation markers. Google Sheets has no general compare-and-swap for arbitrary human edits; protected canonical columns and the StaffUpdates path remain necessary before a real sandbox is connected.

## Coverage and retention

The synthetic coverage ledger includes a verified-zero month and a deliberately missing month, exposed in Settings. Legacy Paid labels without a timestamp remain historically incomplete. A chart does not prove a real Sheet connection or actual shop earnings.

The retention job reconciles dated cash and confirmed-order metrics before deleting eligible completed/cancelled records older than 11 months. Daily rollups use no customer names, phone numbers, addresses, cards, photos or direct order IDs. A journal transaction and completion checksum prevent duplicate aggregation. Retryable cleanup markers handle external fixture/file failures; linked items, events, payment/sync/operation records and private files are removed. Rollups preserve annual results without retaining personal records. No claim is made that the live purge trigger is installed, or that this policy establishes legal accounting retention requirements.

`safeCell` protects text for a future CSV export; there is no CSV export UI. The Google adapter uses RAW values. Production object storage, real staff identity and an authorized private Sheet mapping remain separate integration work. There is no live Apps Script fallback, no email sending and no remote publishing path in this preview.
