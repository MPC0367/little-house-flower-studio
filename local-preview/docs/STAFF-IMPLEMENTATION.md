> Historical implementation note. For the uploaded application and current checks, start with [README](../README.md) and [GitHub review notes](GITHUB-REVIEW.md). References to raw assets, baseline snapshots and machine QA reports are retained for context; those files are excluded from this source package. Later features, including the supplied video intro without a Skip button, supersede earlier descriptions.

# Staff, ledger and synchronization implementation

The staff app is a separate loopback application. Its role chooser is explicit synthetic-demo authentication; it must never be used as production identity. All writes are local. The Google adapter is not activated and no credentials or private Sheet have been read.

## Orders and operations

Orders supports reference/name/phone search, status, requested date/range, fulfillment, payment state, custom/catalogue and attention filters, plus priority/date/newest sorting. Counters use the filtered rows. Refresh leaves the rows in place until the user chooses Show updates. Custom rows use their saved concept image. Missing imagery has a readable fallback.

The detail drawer includes the immutable order-time configuration, catalog/concept/reference asset labels, quote and separate delivery fee, payment history, contacts, card, and field audit history. Staff can flag missing details or delivery issues. Owners can explicitly correct/reopen a status with a reason; pickup cannot enter delivery status. Closing an edited drawer offers Save and close, Discard changes or Keep editing. Completed/cancelled record edits require an owner correction and reason; payment recording remains separate. A revision conflict compares server and proposed values and retains the inputs. Copy reply/LINE actions never send a message. The message card has a separate print layout.

## Cash and history

The payments ledger is append-only. A payment idempotency key cannot be reused for different amounts/types/dates. Refunds require a reason and cannot exceed net receipts. A quote cannot be lowered below receipts without recording the appropriate refund. Completion never marks an order paid.

Cash is grouped by payment-event date in Asia/Bangkok. Confirmed order value and outstanding use requested handover date and exclude new, cancelled and review statuses. Delivery fees and requested banknote values are separately labelled and never added to cash totals. Unknown quotes stay pending.

`coverage` records explicitly declare complete synthetic ledger date ranges. A complete period with no events is zero; a missing period is unknown; incomplete periods with events are partial. The synthetic fixtures contain both zero and missing months, plus a legacy Paid label without a date, which is excluded from cash. Comparisons are shown only for complete periods of equal length; the current incomplete period is explicitly marked partial.

## Sheet contract

`LocalDemoAdapter` and `GoogleSheetsAdapter` expose `read`, `upsert`, `getOperation`, `payments`, `audit`, `appendStaffUpdate` and `markStaffUpdate`. The local fixture retains structured Bookings, OrderItems, Payments, AuditLog and StaffUpdates. The main source of truth during this preview is the local Sheet simulator with a durable SQLite journal for pending writes and recovery.

One worker polls at about5seconds during active staff use and30seconds when idle, resumes immediately after renewed authenticated activity, and suppresses overlapping runs. Foreground/online browser events request fresh cached data without clearing rows or editor drafts. One worker serializes order writes, finds stable IDs, reconciles unknown outcomes by operation ID, bounds retries with exponential backoff/jitter and honors Retry-After. Exhausted or permanent errors become visible dead letters. Payment replication has its own durable pending/synced/dead-letter journal; acknowledged payments and audit events are not repeatedly rewritten. A lost-ack simulator writes once then returns a timeout. Multiple admin tabs poll only the cached backend. StaffUpdates use expected revisions and the same audited validation path; operation markers survive an acknowledgment failure. Direct edits are detected and flagged instead of silently overwriting canonical records. Settings provides an owner resolution dialog comparing the current studio values and detected Sheet values. Keeping local values or applying the reviewed external values requires a reason and a matching conflict version, creates a new revision and audit event, and is replicated through the same queue. Google Sheets does not offer transactional compare-and-swap for arbitrary human edits: canonical ID/revision/system columns must be protected before an authorized sandbox connection.

The disconnected Google adapter requires `sandbox:true`, an explicit spreadsheet ID, a server-only token-provider function, and approved owned-column mappings. Example per-tab mapping: `{tab:'Bookings',id:'AB',record:'AC',operation:'AD',start:2}`. Map Bookings, Payments, AuditLog and StaffUpdates separately after inspecting the authorized test sheet. IDs are re-read before a write; only those mapped cells are changed using RAW values. This preserves unrelated legacy columns, formulas and validations. The adapter is contract-tested with an injected mock transport; no real Google connection has been verified.

## Migration and retention

`dryRunImport` recognizes the repository's 27 legacy headers, preserves source labels, maps known Thai statuses, quarantines unknown statuses and invalid amounts/dates, preserves phone strings, and returns a persistent migration-ID map. Legacy subtotal and Paid labels never become invented receipts. It returns a nondestructive report; any later import must first make an authorized backup and persist the returned mapping.

Eligible completed/cancelled orders older than 11 months are reconciled into nonpersonal, versioned daily rollups before personal records are removed. The local journal transaction prevents double aggregation. External cleanup markers make failed fixture cleanup retryable, and the job removes linked private assets, payments, items, queue entries, operation links and audit records. The completion marker contains an aggregate checksum, not customer identifiers. This follows the existing local policy; it is not a claim of legal accounting compliance or proof that the live purge trigger runs.

## Review fixtures

- All seven custom styles from the shared illustrated recipes.
- White Rose pickup, Box Congratulations delivery and seven single-rose tier boundary quantities.
- Separate pending, failed, missing and broken image cases.
- Deposit/balance/refund example: THB 1,490 gross; THB 200 refunds; THB 1,290 net.
- Unpaid, part-paid, paid, refunded, cancelled, overdue, due today, completed and unknown legacy states.
- Verified-zero month and missing-history month exposed in Settings.

Existing local orders are preserved. Synthetic seed IDs are stable; reseeding does not overwrite staff edits.

## Remaining boundaries after the local review

The production identity provider and approved live roles are absent; the role chooser is deliberately a local demo. The private Sheet headers/permissions have not been inspected, so no live mapping or data import has been executed. The Google adapter supports configured JSON extension columns and transport contracts, but real token acquisition/refresh, protected-range setup and credentials must be supplied and verified in an authorized sandbox. The current private upload store is local disk; a production object store and its lifecycle policy have not been connected. Historical shop payments/coverage cannot be reconstructed from synthetic fixtures or old Paid labels. These specific dependencies do not prevent local review of the implemented staff workflows, conflict/retry paths, charts or retention job.

Local follow-up verification: `npx playwright test --config tests/staff-followup.config.mjs` runs three WebKit checks against a dedicated synthetic fixture on ports5373/5374/8987, including a real fixture-file direct-edit conflict and owner resolution. The usual browser suite runs the two UI/network checks; the direct-fixture scenario is isolated to avoid modifying another test process's store.
