# Task ID: FIX-2 — sales+purchases+finance table fixes

**Agent:** full-stack-developer (sales+purchases+finance table fixes)
**Task:** Fix table crowding, RTL number rendering, and currency format in sales + purchases + finance modules

## Work Log

- Read worklog.md (prior agents 5-a/5-b/5-e/5-f/6) and the reference sales-orders-module.tsx + src/lib/format.ts + src/app/globals.css to understand the `.num` / `.num-cell` / `.table-sticky` / `.cell-truncate` utility classes and the canonical table pattern.
- Applied the same fix pattern to 14 module files (sales-invoices, sales-credit-notes, sales-payments, clients, purchase-orders, purchase-invoices, purchase-credit-notes, purchase-payments, suppliers, expenses, revenues, finance-transfers, bank-accounts, safes):
  1. `<Table>` → `<Table className="table-sticky">` for sticky header inside ScrollArea
  2. Numeric column headers → `<TableHead className="num-cell">` (amount/balance/total/paid/creditLimit/debit/credit); kept `text-end` for the actions/إجراءات column per reference
  3. Numeric body cells: `<TableCell className="num-cell ..."><span className="num">{formatCurrency(...)}</span></TableCell>` — forces LTR rendering of digits inside RTL Arabic context
  4. Code cells: `font-mono text-xs font-semibold text-primary`
  5. Primary text: `font-medium text-sm`; secondary text: `text-xs text-muted-foreground`
  6. Long-text cells: `cell-truncate`
  7. Action groups: `gap-1` → `gap-0.5`; bare `<TableCell>` with inner justify-end div
  8. Removed physical `text-left`/`text-right`/`text-start` on `<TableHead>`
- Wrapped inline currency values in `<span className="num">` in: sales-payments by-method chart, expenses/revenues category chips, bank-accounts currency chips, safes branch chips, clients statement dialog (balance + movements debit/credit), suppliers statement dialog (4 section totals + description balance).
- Form/line-item editor tables intentionally left with `text-end`/`text-start` — matching reference.
- No business logic / API / data flow changes — className-only edits + wrapping numbers in `<span className="num">`.
- Did NOT touch: prisma schema, format.ts, ui/table.tsx, globals.css, components/erp/*, stores, layout, page, dashboard-module, sales-orders-module, or any module outside the list.

## Verification

- `bun run lint` (whole project) → 0 errors
- Targeted eslint on all 14 modified files → clean
- `curl /api/erp/clients` → 200 (real data: C-005 مكتب الأمل)
- `curl /api/erp/suppliers` → 200 (S-003 مؤسسة الإمداد)
- `curl /api/erp/sales-invoices` → 200
- Page `/` → 200
- dev.log: all recompiles successful, no errors/warnings
- No remaining `text-left`/`text-right` (physical) classes in the 14 files

## Stage Summary

- 14 module files updated with consistent num-cell + `.num` LTR-rendering pattern matching the sales-orders reference.
- Numeric currency values now render with Latin digits locked to LTR direction inside the RTL Arabic UI — no more bidi scrambling of "1,234.50 ر.س".
- All main data tables have sticky headers, tightened action groups, consistent code styling, and truncated long-text cells.
- Inline currency displays in KPI-adjacent chips and statement dialogs also wrapped for uniform LTR rendering.
- Lint clean; all endpoints return 200; dev server compiles all modules without errors.

## Files Modified

1. `src/components/modules/sales-invoices-module.tsx`
2. `src/components/modules/sales-credit-notes-module.tsx`
3. `src/components/modules/sales-payments-module.tsx`
4. `src/components/modules/clients-module.tsx`
5. `src/components/modules/purchase-orders-module.tsx`
6. `src/components/modules/purchase-invoices-module.tsx`
7. `src/components/modules/purchase-credit-notes-module.tsx`
8. `src/components/modules/purchase-payments-module.tsx`
9. `src/components/modules/suppliers-module.tsx`
10. `src/components/modules/expenses-module.tsx`
11. `src/components/modules/revenues-module.tsx`
12. `src/components/modules/finance-transfers-module.tsx`
13. `src/components/modules/bank-accounts-module.tsx`
14. `src/components/modules/safes-module.tsx`
