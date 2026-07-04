# Task 5-b — Sales modules (full-stack-developer)

## Scope
Built 5 sales modules + their API routes for Alostaz ERP:

1. **Clients** — `ClientsModule` (`src/components/modules/clients-module.tsx`)
2. **Sales Orders** — `SalesOrdersModule` (`src/components/modules/sales-orders-module.tsx`)
3. **Sales Invoices** — `SalesInvoicesModule` (`src/components/modules/sales-invoices-module.tsx`)
4. **Sales Credit Notes** — `SalesCreditNotesModule` (`src/components/modules/sales-credit-notes-module.tsx`)
5. **Sales Payments** — `SalesPaymentsModule` (`src/components/modules/sales-payments-module.tsx`)

## API Routes
- `src/app/api/erp/clients/route.ts` + `[id]/route.ts`
- `src/app/api/erp/sales-orders/route.ts` + `[id]/route.ts`
- `src/app/api/erp/sales-invoices/route.ts` + `[id]/route.ts`
- `src/app/api/erp/sales-credit-notes/route.ts` + `[id]/route.ts`
- `src/app/api/erp/sales-payments/route.ts` + `[id]/route.ts`

## What was built

### Clients module
- KPIs: total clients, total receivables (sum balance), total credit limit, active clients
- Table: code/name+avatar/contactName/phone/balance/creditLimit/status/actions
- Click row → opens statement dialog showing client's invoices + orders + payments + credit notes (sortable by date)
- Add/Edit dialog (max-w-xl): code, name, contactName, phone, email, address, taxNumber, openingBalance, creditLimit, active
- Print statement (uses `printHTML`)
- Export CSV with proper Arabic headers
- Delete confirmation alert dialog

### Sales Orders module
- KPIs: total sales, total paid, total outstanding, avg order value
- Table: code/client+items count/date/total/paid/outstanding/status/actions
- Status filter (الكل/مسودة/مؤكد/مُسلّم/مدفوع/ملغي)
- Add/Edit dialog (max-w-3xl) with dynamic line items editor:
  - product `<Select>` (auto-fills unitPrice + taxRate)
  - qty, unitPrice, discount, taxRate, computed total
  - "Add Row" button + remove icon per row
  - Live totals panel: subtotal / extra discount / VAT / grand total
- On POST: code auto-gen `SO-XXXX`, $transaction creates order+items, decrements stock (StockItem) and creates StockMovement(type=out), increments client balance (if credit), builds journal entry via `createSalesJournalEntry` (Dr Cash/AR, Cr Sales Revenue + Output VAT), updates account balances
- Print order (printHTML with header, items table, totals, signatures)
- Export CSV

### Sales Invoices module
- KPIs: total invoiced, total collected, outstanding, count
- Table: code/client/issueDate/dueDate/total/paid/status/actions
- Add/Edit dialog with line items editor (same pattern as orders) + issueDate/dueDate
- On POST: code auto-gen `INV-XXXX`, $transaction creates invoice+items, increments client balance, builds journal entry (Dr AR, Cr Sales Revenue + Output VAT)
- Print invoice (professional A4 template with company header, client info, items, subtotal/VAT/total, signatures)
- Export CSV

### Sales Credit Notes module
- KPIs: total credit notes, count, this month, avg value
- Table: code/client/linked invoice/date/total/reason/status/actions
- Add dialog (max-w-xl): client select, optional linked invoice (auto-fills subtotal from invoice), amount before tax, tax rate, reason select, note
- On POST: code auto-gen `CN-XXXX`, $transaction creates note, decrements client balance, builds reversed journal (Dr Sales Revenue + Output VAT, Cr AR)
- Print credit note (amber-themed template)

### Sales Payments module (Receipts / سندات قبض)
- KPIs: total receipts (this month), count, avg amount, by-method breakdown (mini bar chart)
- Table: code/client/date/amount/method badge/reference/status/actions
- Method filter (cash/card/transfer/check)
- Add dialog (max-w-xl): client select, optional linked invoice (auto-fills outstanding), amount, date, method, reference, description
- On POST: code auto-gen `RC-XXXX`, $transaction creates payment, decrements client balance, increments invoice.paid (if linked), builds journal via `createReceiptJournalEntry` (Dr Cash, Cr AR)
- Print receipt voucher (Arabic template with party info, amount, signatures)

## Conventions used
- All API GETs return `{ data: T[], total: number, stats?: {...} }`
- All POSTs return created object with status 201
- Codes auto-gen via `await db.<model>.count()` + 1 → padded string
- Account lookups via `db.account.findUnique({where:{code:'1000'}})` for Cash, '1200' AR, '4000' Sales, '2100' Output VAT
- Journal entry code `JE-#####` (zero-padded 5)
- $transaction for atomic multi-table writes
- All journal entries status='posted', with `refType` matching the originating entity
- Account balances updated after each journal entry based on type (asset=Dr-Cr, others=Cr-Dr)

## Verification
- `curl -s http://localhost:3000/api/erp/clients` → 200 ✓ (returns seeded clients)
- POST `/api/erp/sales-orders` → 201 ✓ (creates order with items + stock movement + journal entry)
- POST `/api/erp/sales-invoices` → 201 ✓ (creates invoice + journal)
- POST `/api/erp/sales-credit-notes` → 201 ✓ (creates CN + reversal journal)
- POST `/api/erp/sales-payments` → 201 ✓ (creates receipt + journal + decrements balance)
- DELETE on all entities → 200 ✓ (cascades items + journal entries)
- Test records created and then cleaned up successfully
- `bun run lint` on the new files → 0 errors (the only project-wide lint error is in `src/components/erp/topbar.tsx`, a foundation file I must not touch)
- Dev server (Next.js 16 + Turbopack) compiles all 5 modules cleanly

## Notes for other agents
- I noticed `src/components/modules/safes-module.tsx` had an invalid `Safe` icon import from lucide-react; another agent (finance) appears to have already fixed it to `PiggyBank` — the dev server is now compiling cleanly.
- All sales APIs use `XTransformPort` pattern (relative paths only) and respect Caddy gateway.
- The dashboard's `receivables` KPI will now reflect created invoices/payments because journal entries are properly created.
