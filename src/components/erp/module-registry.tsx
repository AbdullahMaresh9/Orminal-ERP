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

// === Stubs (coming soon) ===
const SalesQuotationsModule = stub('module.sales-quotations', 'عروض الأسعار للعملاء — قيد التطوير')
const SalesCreditNotesModule = stub('module.sales-credit-notes', 'إشعارات دائنة للمبيعات — قيد التطوير')
const SalesReturnsModule = stub('module.sales-returns', 'مرتجع المبيعات — قيد التطوير')
const SalesPaymentsModule = stub('module.sales-payments', 'سندات قبض العملاء — قيد التطوير')
const PurchaseRequestsModule = stub('module.purchase-requests', 'طلبات الشراء الداخلية — قيد التطوير')
const GoodsReceiptsModule = stub('module.goods-receipts', 'استلام بضاعة الموردين — قيد التطوير')
const PurchaseInvoicesModule = stub('module.purchase-invoices', 'فواتير المشتريات — قيد التطوير')
const PurchaseCreditNotesModule = stub('module.purchase-credit-notes', 'إشعارات دائنة للمشتريات — قيد التطوير')
const PurchasePaymentsModule = stub('module.purchase-payments', 'سندات صرف الموردين — قيد التطوير')
const PurchaseReturnsModule = stub('module.purchase-returns', 'مرتجع المشتريات — قيد التطوير')
const CategoriesModule = stub('module.categories', 'فئات المنتجات — قيد التطوير')
const WarehousesModule = stub('module.warehouses', 'المستودعات ومواقع التخزين — قيد التطوير')
const StockLocationsModule = stub('module.stock-locations', 'مواقع التخزين داخل المستودعات — قيد التطوير')
const StockTransfersModule = stub('module.stock-transfers', 'تحويلات المخزون بين المستودعات — قيد التطوير')
const DeliveriesModule = stub('module.deliveries', 'تسليمات المبيعات — قيد التطوير')
const InventoryAdjustmentsModule = stub('module.inventory-adjustments', 'تسويات جرد المخزون — قيد التطوير')
const StockMovesModule = stub('module.stock-moves', 'سجل حركات المخزون — قيد التطوير')
const CostCentersModule = stub('module.cost-centers', 'مراكز التكلفة — قيد التطوير')
const FiscalPeriodsModule = stub('module.fiscal-periods', 'الفترات المالية — قيد التطوير')
const BankAccountsModule = stub('module.bank-accounts', 'الحسابات البنكية — قيد التطوير')
const SafesModule = stub('module.safes', 'الخزائن النقدية — قيد التطوير')
const BomsModule = stub('module.boms', 'قوائم التركيب (BOM) — قيد التطوير')
const WorkCentersModule = stub('module.work-centers', 'مراكز العمل — قيد التطوير')
const ProductionOrdersModule = stub('module.production-orders', 'أوامر الإنتاج — قيد التطوير')
const EmployeesModule = stub('module.employees', 'إدارة الموظفين — قيد التطوير')
const DepartmentsModule = stub('module.departments', 'الإدارات والأقسام — قيد التطوير')
const AttendanceModule = stub('module.attendance', 'الحضور والانصراف — قيد التطوير')
const LeaveRequestsModule = stub('module.leave-requests', 'طلبات الإجازات — قيد التطوير')
const PayrollRunsModule = stub('module.payroll-runs', 'تشغيلات الرواتب — قيد التطوير')
const UsersModule = stub('module.users', 'إدارة المستخدمين — قيد التطوير')
const RolesModule = stub('module.roles', 'الأدوار والصلاحيات — قيد التطوير')
const AuditLogsModule = stub('module.audit-logs', 'سجل التدقيق — قيد التطوير')
const NotificationsModule = stub('module.notifications', 'الإشعارات — قيد التطوير')
const ProfileModule = stub('module.profile', 'الملف الشخصي — قيد التطوير')

export const moduleRegistry: Record<ModuleKey, React.ComponentType> = {
  // Overview
  dashboard: DashboardModule,

  // Master Data
  partners: PartnersModule,
  products: ProductsModule,
  categories: CategoriesModule as React.ComponentType,
  warehouses: WarehousesModule as React.ComponentType,

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
