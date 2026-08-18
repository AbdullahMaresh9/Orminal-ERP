# Staged upgrades — Decimal precision & Enums (require coordinated code changes)

These two are genuine ERP standards, deliberately NOT applied in the
`20260818000000_professional_hardening` migration because a big-bang change on
live data would introduce silent bugs. Each needs a code pass alongside the
schema change.

## 1. Money & quantity precision: Float → Decimal  ✅ DONE (migration 20260818010000)

**Status: IMPLEMENTED.** All 153 monetary/quantity columns are now `Decimal`
(amounts 20,4 · quantities 20,6 · percentages 9,4 · fx rate 20,10). A `money.ts`
helper (`n`, `round2`, `sumBy`, `decimalsToNumbers`) coerces at read/serialization
edges, the response envelope converts Decimal→number centrally, and 11 money tests
guard it. Original rationale kept below for the record.

**Original why-staged:** 141 monetary/quantity columns were `Float`. Prisma maps
`Decimal` to the `Prisma.Decimal` object on reads, so JS `+ - * /` operators
stop doing math (`+` becomes **string concatenation**). ~59 files read these
fields and compute with them (accounting engine, financial statements, every
sales/purchase total calc). Converting the columns without refactoring the
arithmetic produces **silent wrong numbers** in a financial system.

**Plan:**
1. Schema: change money columns to `Decimal @db.Decimal(20, 4)` (amounts),
   quantities to `Decimal @db.Decimal(20, 6)`, rates/percent to
   `Decimal @db.Decimal(9, 4)`, exchange rate to `Decimal @db.Decimal(20, 8)`.
2. Introduce `src/lib/erp/money.ts` (add/sub/mul/round on Decimal).
3. Refactor the ~59 arithmetic sites to use it (or `.toNumber()` at the edge).
4. Postgres migration is a safe in-place `ALTER COLUMN ... TYPE numeric` (widening).
5. Gate with the existing 76-test suite + new money-precision tests.

## 2. Type safety: String status/type → Prisma enums  (MEDIUM value, MEDIUM risk)

**Why staged:** 17+ routes write `status: body.status` untyped, and the code
already writes values beyond the documented sets (`Delivery.fulfilled`,
`InventoryAdjustment.completed`/`in_progress`). A strict enum makes any
out-of-set value fail at runtime on a live system.

**Plan:**
1. Define enums as the UNION of documented + observed-in-data + code-scanned
   literals (mine with the query in the review notes) so nothing existing breaks.
2. Add input validation (zod) at every write site before switching the column
   type, so bad input returns 422 instead of a Prisma runtime throw.
3. Convert columns to enums model-by-model (start with JournalEntry.state,
   Account, payment methods — smallest domains), running the build between each.
