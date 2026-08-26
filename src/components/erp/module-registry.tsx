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

const lazy = (loader: () => Promise<{ default: any } | { [k: string]: any }>) =>
  dynamic(async () => {
    const mod = await loader()
    const Comp = (mod as any).default ?? Object.values(mod)[0]
    return { default: Comp }
  }, { loading: () => <ModuleSkeleton /> }) as any

// Stub factory — returns a ModuleComingSoon for future modules
function stub(titleKey: string, description?: string) {
  return function StubModule() {
    return <ModuleComingSoon titleKey={titleKey} description={description} />
  }
}

// ============================================================
//  MASTER DATA 
// ============================================================
const CustomersModule = lazy(() => import('@/components/modules/customers-module'))
const SuppliersModule = lazy(() => import('@/components/modules/suppliers-module'))
const ProductsModule = lazy(() => import('@/components/modules/products-module'))
const CategoriesModule = lazy(() => import('@/components/modules/categories-module'))
const WarehousesModule = lazy(() => import('@/components/modules/warehouses-module'))
const BranchesModule = lazy(() => import('@/components/modules/branches-module'))

// ============================================================
// SALES
// ============================================================
const SalesQuotationsModule = lazy(() => import('@/components/modules/sales-quotations-module'))
const SalesOrdersModule = lazy(() => import('@/components/modules/sales-orders-module'))
const SalesInvoicesModule = lazy(() => import('@/components/modules/sales-invoices-module'))
const SalesCreditNotesModule = lazy(() => import('@/components/modules/sales-credit-notes-module'))
const SalesPaymentsModule = lazy(() => import('@/components/modules/sales-payments-module'))
const SalesReturnsModule = lazy(() => import('@/components/modules/sales-returns-module'))
const PosModule = lazy(() => import('@/components/modules/pos-module'))

// ============================================================
// PROCUREMENT
// ============================================================
const PurchaseRequestsModule = lazy(() => import('@/components/modules/purchase-requests-module'))
const PurchaseOrdersModule = lazy(() => import('@/components/modules/purchase-orders-module'))
const GoodsReceiptsModule = lazy(() => import('@/components/modules/goods-receipts-module'))
const PurchaseInvoicesModule = lazy(() => import('@/components/modules/purchase-invoices-module'))
const PurchaseCreditNotesModule = lazy(() => import('@/components/modules/purchase-credit-notes-module'))
const PurchasePaymentsModule = lazy(() => import('@/components/modules/purchase-payments-module'))
const PurchaseReturnsModule = lazy(() => import('@/components/modules/purchase-returns-module'))

// ============================================================
// INVENTORY
// ============================================================
const StockOnHandModule = lazy(() => import('@/components/modules/stock-on-hand-module'))
const StockTransfersModule = lazy(() => import('@/components/modules/stock-transfers-module'))
const DeliveriesModule = lazy(() => import('@/components/modules/deliveries-module'))
const InventoryAdjustmentsModule = lazy(() => import('@/components/modules/inventory-adjustments-module'))
const StockMovesModule = lazy(() => import('@/components/modules/stock-moves-module'))
const StockTakesModule = lazy(() => import('@/components/modules/stock-takes-module'))
const InventoryTransfersModule = lazy(() => import('@/components/modules/inventory-transfers-module'))
const InventoryIncomingModule = lazy(() => import('@/components/modules/inventory-incoming-module'))
const InventoryOutgoingModule = lazy(() => import('@/components/modules/inventory-outgoing-module'))
const InventoryRequisitionsModule = lazy(() => import('@/components/modules/inventory-requisitions-module'))

// =============================================================
// FINANCE
// ============================================================
const FixedAssetsModule = lazy(() => import('@/components/modules/fixed-assets-module'))
const ChartOfAccountsModule = lazy(() => import('@/components/modules/chart-of-accounts-module'))
const JournalEntriesModule = lazy(() => import('@/components/modules/journal-entries-module'))
const FiscalPeriodsModule = lazy(() => import('@/components/modules/fiscal-periods-module'))
const CostCentersModule = lazy(() => import('@/components/modules/cost-centers-module'))
const AnalyticAccountsModule = lazy(() => import('@/components/modules/analytic-accounts-module'))
const ClosedPeriodsModule = lazy(() => import('@/components/modules/fiscal-periods-module'))
const BankAccountsModule = lazy(() => import('@/components/modules/bank-accounts-module'))
const SafesModule = lazy(() => import('@/components/modules/safes-module'))
const ExpensesModule = lazy(() => import('@/components/modules/expenses-module'))
const RevenuesModule = lazy(() => import('@/components/modules/revenues-module'))
const FinanceTransfersModule = lazy(() => import('@/components/modules/finance-transfers-module'))
const FinanceRequisitionsModule = lazy(() => import('@/components/modules/finance-requisitions-module'))

// ============================================================
// MANUFACTURING
// ============================================================
const BomsModule = lazy(() => import('@/components/modules/boms-module'))
const WorkCentersModule = lazy(() => import('@/components/modules/work-centers-module'))
const ProductionOrdersModule = lazy(() => import('@/components/modules/production-orders-module'))

// ============================================================
// HR
// ============================================================
const EmployeesModule = lazy(() => import('@/components/modules/employees-module'))
const DepartmentsModule = lazy(() => import('@/components/modules/departments-module'))
const AttendanceModule = lazy(() => import('@/components/modules/attendance-module'))
const LeaveRequestsModule = lazy(() => import('@/components/modules/leave-requests-module'))
const PayrollRunsModule = lazy(() => import('@/components/modules/payroll-runs-module'))
const ActivitiesModule = lazy(() => import('@/components/modules/activities-module'))

// ============================================================
// REPORTS & PLATFORM
// ============================================================
const ReportsModule = lazy(() => import('@/components/modules/reports-module'))
const UsersModule = lazy(() => import('@/components/modules/users-module'))
const RolesModule = lazy(() => import('@/components/modules/roles-module'))
const AuditLogsModule = lazy(() => import('@/components/modules/audit-logs-module'))
const NotificationsModule = lazy(() => import('@/components/modules/notifications-module'))
const SettingsModule = lazy(() => import('@/components/modules/settings-module'))
const SystemConfigModule = lazy(() => import('@/components/modules/system-config-module'))
const ProfileModule = lazy(() => import('@/components/modules/profile-module'))
const DocumentTemplatesModule = lazy(() => import('@/components/modules/document-templates-module'))
const OrgStructureModule = lazy(() => import('@/components/modules/org-structure-module'))

export const moduleRegistry: Record<ModuleKey, React.ComponentType> = {
  // Standalone Org Structure
  'org-structure': OrgStructureModule,
  // Overview
  dashboard: DashboardModule,

  // Master Data
  products: ProductsModule,
  categories: CategoriesModule,
  warehouses: WarehousesModule,
  branches: BranchesModule,

  // Sales
  customers: CustomersModule,
  'sales-quotations': SalesQuotationsModule,
  'sales-orders': SalesOrdersModule,
  'sales-invoices': SalesInvoicesModule,
  'sales-returns': SalesReturnsModule,
  pos: PosModule,

  // Procurement
  suppliers: SuppliersModule,
  'purchase-requests': PurchaseRequestsModule,
  'purchase-orders': PurchaseOrdersModule,
  'goods-receipts': GoodsReceiptsModule,
  'purchase-invoices': PurchaseInvoicesModule,
  'purchase-returns': PurchaseReturnsModule,

  // Inventory
  'stock-on-hand': StockOnHandModule,

  deliveries: DeliveriesModule,
  'inventory-adjustments': InventoryAdjustmentsModule,
  'stock-moves': StockMovesModule,
  'stock-takes': StockTakesModule,
  'inventory-transfers': InventoryTransfersModule,
  'inventory-incoming': InventoryIncomingModule,
  'inventory-outgoing': InventoryOutgoingModule,
  'inventory-requisitions': InventoryRequisitionsModule,

  // Finance & Accounts
  'chart-of-accounts': ChartOfAccountsModule,
  'analytic-accounts': AnalyticAccountsModule,
  'cost-centers': CostCentersModule,
  'fiscal-periods': FiscalPeriodsModule,
  'closed-periods': ClosedPeriodsModule,
  'opening-balances': JournalEntriesModule,
  'financial-statement-designer': ReportsModule,
  'payment-methods': SettingsModule,

  'journal-entries': JournalEntriesModule,
  'sales-payments': SalesPaymentsModule,
  'purchase-payments': PurchasePaymentsModule,
  'purchase-credit-notes': PurchaseCreditNotesModule,
  'sales-credit-notes': SalesCreditNotesModule,
  'cash-count': SafesModule,
  'financial-adjustments': FinanceRequisitionsModule,
  'accounting-posting': JournalEntriesModule,
  'accounting-unposting': JournalEntriesModule,

  safes: SafesModule,
  'bank-accounts': BankAccountsModule,
  'bank-transfers': FinanceTransfersModule,
  'finance-transfers': FinanceTransfersModule,
  'bank-reconciliation': BankAccountsModule,
  'credit-card-types': BankAccountsModule,

  'ar-aging': ReportsModule,
  'customer-balances': CustomersModule,
  'customer-adjustments': SalesCreditNotesModule,

  'ap-aging': ReportsModule,
  'supplier-balances': SuppliersModule,
  'supplier-adjustments': PurchaseCreditNotesModule,

  expenses: ExpensesModule,
  revenues: RevenuesModule,
  'finance-requisitions': FinanceRequisitionsModule,
  'expense-adjustments': ExpensesModule,

  'fixed-assets': FixedAssetsModule,
  'asset-categories': FixedAssetsModule,
  'asset-depreciation': FixedAssetsModule,
  'asset-transfers': FixedAssetsModule,
  'asset-disposals': FixedAssetsModule,

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
  activities: ActivitiesModule,

  // Reports
  reports: ReportsModule,
  'reports-dashboard': ReportsModule,
  'account-statement': ReportsModule,
  'general-journal': ReportsModule,
  'trial-balance': ReportsModule,
  'balance-sheet': ReportsModule,
  income: ReportsModule,
  'cash-flow': ReportsModule,
  'account-movement': ReportsModule,
  'opening-balances-rep': ReportsModule,
  'posted-unposted-entries': ReportsModule,
  'debit-credit-notes': ReportsModule,
  'receipt-vouchers': ReportsModule,
  'payment-vouchers': ReportsModule,
  'cash-count-rep': ReportsModule,
  'chart-of-accounts-rep': ReportsModule,
  'cost-center-report': ReportsModule,
  'customers-list': ReportsModule,
  'customer-balances-rep': ReportsModule,
  'customer-statement': ReportsModule,
  'customer-debts': ReportsModule,
  'ar-aging-rep': ReportsModule,
  'customer-collections': ReportsModule,
  'customer-adjustments-rep': ReportsModule,
  'suppliers-list': ReportsModule,
  'supplier-balances-rep': ReportsModule,
  'supplier-statement': ReportsModule,
  'supplier-payables': ReportsModule,
  'ap-aging-rep': ReportsModule,
  'supplier-payments-rep': ReportsModule,
  'supplier-adjustments-rep': ReportsModule,
  'sales-quotations-rep': ReportsModule,
  'sales-orders-rep': ReportsModule,
  'tax-invoices': ReportsModule,
  'sales-returns-rep': ReportsModule,
  'sales-credit-notes-rep': ReportsModule,
  'net-sales': ReportsModule,
  'sales-by-customer': ReportsModule,
  'sales-by-product': ReportsModule,
  'sales-by-branch': ReportsModule,
  'sales-by-rep': ReportsModule,
  'profit-margin': ReportsModule,
  'purchase-requests-rep': ReportsModule,
  'purchase-orders-rep': ReportsModule,
  'goods-receipts-rep': ReportsModule,
  'purchase-invoices-rep': ReportsModule,
  'purchase-returns-rep': ReportsModule,
  'purchase-credit-notes-rep': ReportsModule,
  'net-purchases': ReportsModule,
  'purchases-by-supplier': ReportsModule,
  'purchases-by-product': ReportsModule,
  'purchases-by-branch': ReportsModule,
  'current-stock': ReportsModule,
  'stock-moves-rep': ReportsModule,
  'inventory-value': ReportsModule,
  'stock-takes-rep': ReportsModule,
  'inventory-adjustments-rep': ReportsModule,
  'incoming-outgoing': ReportsModule,
  'stock-transfers-rep': ReportsModule,
  'stock-turnover': ReportsModule,
  'dead-stock': ReportsModule,
  'low-stock': ReportsModule,
  'product-movement': ReportsModule,
  'pos-daily-sales': ReportsModule,
  'pos-invoices': ReportsModule,
  'pos-returns': ReportsModule,
  'pos-payment-methods': ReportsModule,
  'pos-performance': ReportsModule,
  'shift-closing': ReportsModule,
  'employees-directory': ReportsModule,
  'attendance-summary': ReportsModule,
  'leave-summary': ReportsModule,
  'payroll-summary': ReportsModule,
  'hr-overview': ReportsModule,
  'assets-register': ReportsModule,
  'assets-valuation': ReportsModule,
  'asset-depreciation-rep': ReportsModule,
  'asset-transfers-rep': ReportsModule,
  'asset-disposals-rep': ReportsModule,

  // Platform
  users: UsersModule,
  roles: RolesModule,
  'audit-logs': AuditLogsModule,
  notifications: NotificationsModule,
  settings: SettingsModule,
  'system-config': SystemConfigModule,
  profile: ProfileModule,
  'document-templates': DocumentTemplatesModule,
  'user-groups': RolesModule,
  'user-data': UsersModule,
  'transaction-privileges': RolesModule,
  'screen-privileges': RolesModule,
  'input-privileges': RolesModule,
  'view-privileges': RolesModule,
  'audit-control': AuditLogsModule,
  'system-settings': SettingsModule,
  'sequence-doc-types': SettingsModule,
  'transaction-sequences': SettingsModule,
  'system-alerts': NotificationsModule,
  'default-transaction-data': SettingsModule,

  // System Configuration Leaves
  'config-general': SystemConfigModule,
  'config-company': SystemConfigModule,
  'config-general-vars': SystemConfigModule,
  'config-general-defs': SystemConfigModule,
  'config-currencies': SystemConfigModule,
  'config-fiscal-periods': SystemConfigModule,
  'config-org-structure': OrgStructureModule,
  'config-subledgers-naming': SystemConfigModule,
  'config-doc-types': SystemConfigModule,
  'config-doc-sequences': SystemConfigModule,
  'config-languages': SystemConfigModule,
  'config-datetime': SystemConfigModule,
  'config-payment-methods': SystemConfigModule,

  'config-finance': SystemConfigModule,
  'config-general-accounting': SystemConfigModule,
  'config-posting-settings': SystemConfigModule,
  'config-opening-balances': SystemConfigModule,
  'config-closing-settings': SystemConfigModule,
  'config-currencies-accounting': SystemConfigModule,
  'config-cost-centers': SystemConfigModule,
  'config-analytic-accounts': SystemConfigModule,

  'config-sales': SystemConfigModule,
  'config-sales-general': SystemConfigModule,
  'config-payment-terms': SystemConfigModule,
  'config-quotations-validity': SystemConfigModule,
  'config-discounts': SystemConfigModule,
  'config-credit-limits': SystemConfigModule,
  'config-below-cost-sale': SystemConfigModule,
  'config-sales-invoices': SystemConfigModule,
  'config-price-levels': SystemConfigModule,
  'config-sales-outlets': SystemConfigModule,

  'config-procurement': SystemConfigModule,
  'config-procurement-general': SystemConfigModule,
  'config-purchase-requests': SystemConfigModule,
  'config-purchase-orders': SystemConfigModule,
  'config-three-way-matching': SystemConfigModule,
  'config-price-qty-variance': SystemConfigModule,
  'config-auto-posting-procurement': SystemConfigModule,
  'config-purchase-expenses': SystemConfigModule,
  'config-supplier-price-lists': SystemConfigModule,

  'config-inventory': SystemConfigModule,
  'config-inventory-general': SystemConfigModule,
  'config-valuation-method': SystemConfigModule,
  'config-inventory-accounts': SystemConfigModule,
  'config-warehouses-setup': SystemConfigModule,
  'config-warehouse-groups': SystemConfigModule,
  'config-uom': SystemConfigModule,
  'config-item-categories': SystemConfigModule,
  'config-item-definitions': SystemConfigModule,
  'config-barcodes': SystemConfigModule,
  'config-electronic-scales': SystemConfigModule,
  'config-inventory-expenses': SystemConfigModule,

  'config-taxes-einvoicing': SystemConfigModule,
  'config-taxes': SystemConfigModule,
  'config-tax-categories': SystemConfigModule,
  'config-tax-registration': SystemConfigModule,
  'config-einvoicing': SystemConfigModule,
  'config-zatca': SystemConfigModule,
  'config-qr-code': SystemConfigModule,
  'config-digital-signature': SystemConfigModule,
  'config-e-integration': SystemConfigModule,

  'config-hr': SystemConfigModule,
  'config-hr-departments': SystemConfigModule,
  'config-hr-job-titles': SystemConfigModule,
  'config-hr-schedules': SystemConfigModule,
  'config-hr-leaves': SystemConfigModule,
  'config-hr-payroll': SystemConfigModule,
  'config-hr-contracts': SystemConfigModule,

  'config-manufacturing': SystemConfigModule,
  'config-mfg-general': SystemConfigModule,
  'config-mfg-accounts': SystemConfigModule,
  'config-mfg-boms': SystemConfigModule,
  'config-mfg-work-centers': SystemConfigModule,
  'config-mfg-production-orders': SystemConfigModule,

  'config-pos': SystemConfigModule,
  'config-pos-general': SystemConfigModule,
  'config-pos-sessions': SystemConfigModule,
  'config-pos-invoices': SystemConfigModule,
  'config-pos-outlets': SystemConfigModule,
  'config-pos-payment-methods': SystemConfigModule,
  'config-pos-print-templates': SystemConfigModule,

  'config-notifications-comm': SystemConfigModule,
  'config-notif-settings': SystemConfigModule,
  'config-smtp': SystemConfigModule,
  'config-sms': SystemConfigModule,
  'config-whatsapp': SystemConfigModule,
  'config-reminders': SystemConfigModule,
  'config-comm-channels': SystemConfigModule,

  'config-printing-docs': SystemConfigModule,
  'config-print-settings': SystemConfigModule,
  'config-doc-templates-setup': SystemConfigModule,
  'config-company-logo': SystemConfigModule,
  'config-signatures': SystemConfigModule,
  'config-document-footer': SystemConfigModule,
  'config-pdf-settings': SystemConfigModule,
  'config-export-settings': SystemConfigModule,

  'config-backup': SystemConfigModule,
  'config-manual-backup': SystemConfigModule,
  'config-backup-schedule': SystemConfigModule,
  'config-retention-policy': SystemConfigModule,
  'config-restore': SystemConfigModule,
  'config-cloud-storage': SystemConfigModule,

  'config-integrations': SystemConfigModule,
  'config-api-keys': SystemConfigModule,
  'config-webhooks': SystemConfigModule,
  'config-aws': SystemConfigModule,
  'config-email-integration': SystemConfigModule,
  'config-payment-gateways': SystemConfigModule,
  'config-external-systems': SystemConfigModule,

  'config-workflow-approval': SystemConfigModule,
  'config-approval-policies': SystemConfigModule,
  'config-approval-routes': SystemConfigModule,
  'config-approval-levels': SystemConfigModule,
  'config-approval-rules': SystemConfigModule,
  'config-approval-conditions': SystemConfigModule,
  'config-device-approval': SystemConfigModule,
}
