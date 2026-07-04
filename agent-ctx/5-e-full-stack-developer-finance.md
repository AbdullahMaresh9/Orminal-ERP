# Task 5-e — Finance Modules (full-stack-developer agent)

## Scope
Built 6 finance modules + 12 API routes for the Alostaz Accounting ERP:
- BankAccountsModule (CRUD + statement print + CSV)
- SafesModule (CRUD + statement print + CSV)
- ExpensesModule (auto journal + balance decrement + voucher print)
- RevenuesModule (auto journal + balance increment + voucher print)
- FinanceTransfersModule (cross-account transfers bank↔safe)
- FinanceRequisitionsModule (draft → approve/reject → fulfill workflow)

## Files written
### API routes (`src/app/api/erp/`)
- `bank-accounts/route.ts` + `bank-accounts/[id]/route.ts` — full CRUD; GET [id] also returns last 100 finance transactions for the statement.
- `safes/route.ts` + `safes/[id]/route.ts` — full CRUD; auto code `SAFE-####`. Note: `Safe` model has no relation to `Branch` in the schema, so branch is joined manually via a second query.
- `expenses/route.ts` + `expenses/[id]/route.ts` — GET list with bank/safe enrichment (no Prisma include since `FinanceTransaction` lacks FK relations); POST creates `FinanceTransaction(type=expense)` + auto journal (Dr Operating Expenses 6000, Cr Cash 1000 / Bank 1100) + balance decrement.
- `revenues/route.ts` + `revenues/[id]/route.ts` — mirror of expenses; journal is Dr Cash/Bank, Cr Other Revenue 4100; balance increment.
- `finance-transfers/route.ts` + `finance-transfers/[id]/route.ts` — uses composite ref strings `bank:<id>` / `safe:<id>` for `fromAccountId` / `toAccountId`. Journal Dr toAccount, Cr fromAccount; updates both balances.
- `finance-requisitions/route.ts` + `finance-requisitions/[id]/route.ts` — CRUD + actions: `approve` → status=approved, `reject` → status=rejected, `fulfill` → status=fulfilled AND auto-creates an expense FinanceTransaction (EXP-####) + journal (Dr Operating Expenses, Cr Cash) — the safe/bank is not auto-selected because requisition model has no destination field.

### Helper
`postJournal({code, date, description, refType, refId, lines})` is duplicated in expenses, revenues, finance-transfers, and finance-requisitions routes. It looks up accounts by code (`SYSTEM_ACCOUNTS`), builds balanced `JournalEntry` + `JournalLine` rows, and marks status='posted'. (Could be refactored into `lib/erp` later.)

### Module components (`src/components/modules/`)
Each module:
- Uses `<ModuleShell>` wrapper with title, description, search, add, export buttons.
- 4 KPI cards in `grid grid-cols-2 lg:grid-cols-4 gap-4`.
- Table in `<Card className="rounded-xl border bg-card">` with `<ScrollArea className="max-h-[60vh]">`.
- Add/Edit dialog in `max-w-xl`.
- All Arabic labels, RTL-friendly with `ps-/pe-` and `text-start/text-end`.
- TanStack Query for fetching, sonner for toasts (`toast.success('تم الحفظ بنجاح')`).
- `exportToCSV` and `printHTML` from `@/lib/export`.

## Schema notes (NO schema modifications)
- `FinanceTransaction` model has NO Prisma relations to BankAccount/Safe (only `bankAccountId` and `safeId` as String FKs). So all routes fetch banks + safes in parallel and join in JS via a `Map`.
- `Safe` model has NO Prisma relation to `Branch` (only `branchId` String). Same manual join pattern.
- `JournalEntry` has a `refType` column. We use 'expense' | 'revenue' | 'transfer'.

## Verification results (live)
- `GET /api/erp/safes` → 200, returns `{ data: [...], total: n }`
- `POST /api/erp/bank-accounts` → 201, creates bank with openingBalance
- `POST /api/erp/safes` → 201, auto-generates code `SAFE-0001`
- `POST /api/erp/expenses` (amount=500, safeId) → 201, creates `EXP-0001` + journal + safe balance decremented from 10000 → 9500 ✓
- `POST /api/erp/revenues` (amount=1500, safeId) → 201, creates `REV-0001` + journal + safe balance incremented 9500 → 11000 ✓
- `POST /api/erp/finance-requisitions` → 201, creates `FRQ-0001` with status='draft'
- `PUT /api/erp/finance-requisitions/{id}` `{action:'approve'}` → 200, status='approved'
- `PUT /api/erp/finance-requisitions/{id}` `{action:'fulfill'}` → 200, status='fulfilled' AND auto-creates `EXP-0002` ✓
- `POST /api/erp/finance-transfers` (from `safe:X` to `bank:Y`, amount=1000) → 201, creates `TRF-0001` + journal + safe balance 11000→10000 ✓ + bank balance 50000→51000 ✓

## Lint status
- All my new files (6 modules + 12 API routes) pass `eslint` cleanly.
- 1 pre-existing lint error in `src/components/erp/topbar.tsx` (foundation file — off-limits per task rules).
- No new lint warnings or errors introduced.

## Dev server status
- Dev server runs on port 3000. SPA `/` returns 200 (92 KB HTML).
- All `/api/erp/*` finance endpoints return 200 or 201.
- No runtime errors in dev.log related to finance modules.

## What's next (for downstream agents)
- Reports module may want to consume finance data (total expenses, revenues, transfers per period).
- Dashboard KPIs could include "cash on hand" (sum of bank + safe balances) — currently the dashboard only computes salesOrder/purchaseOrder totals.
- Requisition fulfill could optionally prompt user for a destination bank/safe (currently defaults to Cash account 1000).
