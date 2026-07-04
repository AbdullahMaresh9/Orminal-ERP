# Task 5-a — Inventory modules (full-stack-developer)

## Scope
Built 8 inventory modules + their API routes for Alostaz ERP:

1. **Products** — `ProductsModule` (`src/components/modules/products-module.tsx`)
2. **Categories** — `CategoriesModule` (`src/components/modules/categories-module.tsx`)
3. **Storehouses** — `StorehousesModule` (`src/components/modules/storehouses-module.tsx`)
4. **Inventory Incoming** — `InventoryIncomingModule` (`src/components/modules/inventory-incoming-module.tsx`)
5. **Inventory Outgoing** — `InventoryOutgoingModule` (`src/components/modules/inventory-outgoing-module.tsx`)
6. **Inventory Transfers** — `InventoryTransfersModule` (`src/components/modules/inventory-transfers-module.tsx`)
7. **Stock Takes** — `StockTakesModule` (`src/components/modules/stock-takes-module.tsx`)
8. **Inventory Requisitions** — `InventoryRequisitionsModule` (`src/components/modules/inventory-requisitions-module.tsx`)

## API Routes
- `src/app/api/erp/products/route.ts` (GET list + POST create) — note: GET was further enhanced by sales/finance agent; my POST handler preserved
- `src/app/api/erp/products/[id]/route.ts` (GET, PUT, DELETE)
- `src/app/api/erp/categories/route.ts` + `[id]/route.ts` (GET/POST/PUT/DELETE)
- `src/app/api/erp/storehouses/route.ts` + `[id]/route.ts` (GET/POST/PUT/DELETE)
- `src/app/api/erp/inventory-incoming/route.ts` (GET list, POST creates StockMovement type=in + upserts StockItem + optionally creates PurchaseInvoice)
- `src/app/api/erp/inventory-outgoing/route.ts` (GET list, POST creates StockMovement type=out + decrements StockItem FIFO + validates sufficient qty)
- `src/app/api/erp/inventory-transfers/route.ts` (GET, POST) + `[id]/route.ts` (GET, PUT for status changes incl. receive → actually moves stock between warehouses, DELETE)
- `src/app/api/erp/stock-takes/route.ts` (GET, POST auto-loads current stock) + `[id]/route.ts` (GET, PUT completes → applies adjustment movements, DELETE)
- `src/app/api/erp/inventory-requisitions/route.ts` (GET, POST) + `[id]/route.ts` (GET, PUT approve/reject/fulfill → fulfills decrements stock, DELETE)

## Key Implementation Details
- All 8 modules use `<ModuleShell>` wrapper with search, add, export, print (where applicable), and filter dropdowns
- 4 KPI cards in responsive grid at top of each module
- `<Dialog>` with `max-w-2xl` or `max-w-3xl` for create/edit forms
- Dynamic line-item editor for transfers/stock-takes/requisitions/incoming/outgoing with "add row" + remove buttons
- All forms use simple `useState` + controlled inputs (no react-hook-form/zod overhead)
- Status flows: transfers (draft→in_transit→received/cancelled), stock-takes (draft→completed/cancelled), requisitions (draft→approved/rejected/fulfilled)
- Toast notifications via `sonner` on success/error
- Tables wrapped in `<ScrollArea className="max-h-[60vh]">` for long lists
- Export to CSV with proper Arabic labels and BOM
- Code generation pattern: `PROD-{count+1}`, `WH-{count+1}`, `TRF-{count+1}`, `STK-{count+1}`, `REQ-{count+1}`
- For models without Prisma relation (StockTake, InventoryRequisition have `storehouseId` as plain String), I fetch storehouses separately and merge in JS
- All stock mutations use `db.$transaction` for atomicity
- StockMovement records include `refType` ('purchase', 'sales', 'transfer', 'adjustment', 'requisition', 'stock_take') and `refId` for traceability

## Verified
- `curl http://localhost:3000/api/erp/products` → 200 with full product list
- `curl -X POST http://localhost:3000/api/erp/products` → 201 (created)
- `curl -X PUT/DELETE /api/erp/products/{id}` → 200
- All 8 GET endpoints return 200
- POST for inventory-incoming creates movement + updates StockItem + optionally PurchaseInvoice (transaction)
- POST for inventory-outgoing validates stock + decrements FIFO
- POST for inventory-transfers validates same-storehouse constraint
- PUT for transfers status=received executes stock movement from src to dst
- POST for stock-takes auto-loads current stock items for counting
- PUT for stock-takes status=completed applies adjustment movements + updates StockItem
- POST for inventory-requisitions creates draft requisition
- PUT for requisitions status=fulfilled decrements stock (with validation)

## Notes for other agents
- The existing `products/route.ts` was modified by sales agent (5-b) — has a more sophisticated GET with `take: 200` and stock flattening. I added my POST handler back so both work together.
- `bun run lint` shows 1 error in `topbar.tsx` (foundation file, not in my scope to fix) — `react-hooks/set-state-in-effect` warning on `useEffect(() => setMounted(true), [])`
- Dev server runs clean — no compile errors in any of my modules or routes
- Used `ps-`/`pe-`/`ms-`/`me-` logical properties throughout (RTL-friendly)
- All KpiCard accents use the available palette (emerald/teal/violet/amber/rose) — no blue/indigo
