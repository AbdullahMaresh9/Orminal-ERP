'use client'

import dynamic from 'next/dynamic'
import type { ModuleKey } from '@/stores/nav-store'
import { Skeleton } from '@/components/ui/skeleton'
import { ModuleComingSoon } from './module-coming-soon'

// Eager-loaded: dashboard (default landing)
import { DashboardModule } from '@/components/modules/dashboard-module'

// Lazy-loading skeleton fallback
function ModuleSkeleton() {
  return (
    <div className="flex flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 max-w-[1600px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

const lazy = (loader: () => Promise<{ default: React.ComponentType } | { [k: string]: React.ComponentType }>) =>
  dynamic(async () => {
    const mod = await loader()
    const Comp = (mod as any).default ?? Object.values(mod)[0]
    return { default: Comp }
  }, { loading: () => <ModuleSkeleton /> })

// Stub factory — returns a ModuleComingSoon for unimplemented modules
function stub(titleKey: string, description?: string) {
  return function StubModule() {
    return <ModuleComingSoon titleKey={titleKey} description={description} />
  }
}

// === Lazy-loaded fully functional modules ===
const PartnersModule = lazy(() => import('@/components/modules/partners-module'))
const ProductsModule = lazy(() => import('@/components/modules/products-module'))
const ChartOfAccountsModule = lazy(() => import('@/components/modules/chart-of-accounts-module'))
const JournalEntriesModule = lazy(() => import('@/components/modules/journal-entries-module'))
const SalesOrdersModule = lazy(() => import('@/components/modules/sales-orders-module'))
const SalesInvoicesModule = lazy(() => import('@/components/modules/sales-invoices-module'))
const PurchaseOrdersModule = lazy(() => import('@/components/modules/purchase-orders-module'))
const StockOnHandModule = lazy(() => import('@/components/modules/stock-on-hand-module'))
const ReportsModule = lazy(() => import('@/components/modules/reports-module'))
const SettingsModule = lazy(() => import('@/components/modules/settings-module'))
const SalesQuotationsModule = lazy(() => import('@/components/modules/sales-quotations-module'))
const SalesCreditNotesModule = lazy(() => import('@/components/modules/sales-credit-notes-module'))
const SalesReturnsModule = lazy(() => import('@/components/modules/sales-returns-module'))
const SalesPaymentsModule = lazy(() => import('@/components/modules/sales-payments-module'))
const PurchaseRequestsModule = lazy(() => import('@/components/modules/purchase-requests-module'))
const GoodsReceiptsModule = lazy(() => import('@/components/modules/goods-receipts-module'))
const PurchaseInvoicesModule = lazy(() => import('@/components/modules/purchase-invoices-module'))
const PurchaseCreditNotesModule = lazy(() => import('@/components/modules/purchase-credit-notes-module'))
const PurchasePaymentsModule = lazy(() => import('@/components/modules/purchase-payments-module'))
const PurchaseReturnsModule = lazy(() => import('@/components/modules/purchase-returns-module'))
const UsersModule = lazy(() => import('@/components/modules/users-module'))
const RolesModule = lazy(() => import('@/components/modules/roles-module'))
const AuditLogsModule = lazy(() => import('@/components/modules/audit-logs-module'))
const NotificationsModule = lazy(() => import('@/components/modules/notifications-module'))
const ProfileModule = lazy(() => import('@/components/modules/profile-module'))

// === Manufacturing modules ===
const BomsModule = lazy(() => import('@/components/modules/boms-module'))
const WorkCentersModule = lazy(() => import('@/components/modules/work-centers-module'))
const ProductionOrdersModule = lazy(() => import('@/components/modules/production-orders-module'))

// === HR modules ===
const EmployeesModule = lazy(() => import('@/components/modules/employees-module'))
const DepartmentsModule = lazy(() => import('@/components/modules/departments-module'))
const AttendanceModule = lazy(() => import('@/components/modules/attendance-module'))
const LeaveRequestsModule = lazy(() => import('@/components/modules/leave-requests-module'))
const PayrollRunsModule = lazy(() => import('@/components/modules/payroll-runs-module'))

// === Inventory & Finance (newly wired) ===
const CategoriesModule = lazy(() => import('@/components/modules/categories-module'))
const WarehousesModule = lazy(() => import('@/components/modules/warehouses-module'))
const StockLocationsModule = lazy(() => import('@/components/modules/stock-locations-module'))
const StockTransfersModule = lazy(() => import('@/components/modules/stock-transfers-module'))
const DeliveriesModule = lazy(() => import('@/components/modules/deliveries-module'))
const InventoryAdjustmentsModule = lazy(() => import('@/components/modules/inventory-adjustments-module'))
const StockMovesModule = lazy(() => import('@/components/modules/stock-moves-module'))
const CostCentersModule = lazy(() => import('@/components/modules/cost-centers-module'))
const FiscalPeriodsModule = lazy(() => import('@/components/modules/fiscal-periods-module'))
const BankAccountsModule = lazy(() => import('@/components/modules/bank-accounts-module'))
const SafesModule = lazy(() => import('@/components/modules/safes-module'))

export const moduleRegistry: Record<ModuleKey, React.ComponentType> = {
  // Overview
  dashboard: DashboardModule,

  // Master Data
  partners: PartnersModule,
  products: ProductsModule,
  categories: CategoriesModule,
  warehouses: WarehousesModule,

  // Sales
  'sales-quotations': SalesQuotationsModule,
  'sales-orders': SalesOrdersModule,
  'sales-invoices': SalesInvoicesModule,
  'sales-credit-notes': SalesCreditNotesModule,
  'sales-payments': SalesPaymentsModule,
  'sales-returns': SalesReturnsModule,

  // Procurement
  'purchase-requests': PurchaseRequestsModule,
  'purchase-orders': PurchaseOrdersModule,
  'goods-receipts': GoodsReceiptsModule,
  'purchase-invoices': PurchaseInvoicesModule,
  'purchase-credit-notes': PurchaseCreditNotesModule,
  'purchase-payments': PurchasePaymentsModule,
  'purchase-returns': PurchaseReturnsModule,

  // Inventory
  'stock-on-hand': StockOnHandModule,
  'stock-transfers': StockTransfersModule,
  deliveries: DeliveriesModule,
  'inventory-adjustments': InventoryAdjustmentsModule,
  'stock-moves': StockMovesModule,

  // Finance
  'chart-of-accounts': ChartOfAccountsModule,
  'journal-entries': JournalEntriesModule,
  'cost-centers': CostCentersModule,
  'fiscal-periods': FiscalPeriodsModule,
  'bank-accounts': BankAccountsModule,
  safes: SafesModule,

  // Manufacturing
  boms: BomsModule,
  'work-centers': WorkCentersModule,
  'production-orders': ProductionOrdersModule,

  // HR
  employees: EmployeesModule,
  departments: DepartmentsModule,
  attendance: AttendanceModule,
  'leave-requests': LeaveRequestsModule,
  'payroll-runs': PayrollRunsModule,

  // Reports
  reports: ReportsModule,

  // Platform
  users: UsersModule,
  roles: RolesModule,
  'audit-logs': AuditLogsModule,
  notifications: NotificationsModule,
  settings: SettingsModule,
  profile: ProfileModule,
}
