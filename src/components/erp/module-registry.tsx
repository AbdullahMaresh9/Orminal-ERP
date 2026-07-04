'use client'

import dynamic from 'next/dynamic'
import { type ModuleKey } from '@/stores/nav-store'
import { lazy, Suspense } from 'react'
import { DashboardModule } from '@/components/modules/dashboard-module'

// Lazy-load all modules except dashboard to keep initial bundle small.
// Each module is a separate chunk that loads on demand.
const lazyMod = (loader: () => Promise<{ default: React.ComponentType }>) =>
  dynamic(loader, { loading: () => <ModuleSkeleton />, ssr: false })

export const moduleRegistry: Record<ModuleKey, React.ComponentType> = {
  dashboard: DashboardModule,
  pos: lazyMod(() => import('@/components/modules/pos-module').then(m => ({ default: m.PosModule }))),

  // Sales
  clients: lazyMod(() => import('@/components/modules/clients-module').then(m => ({ default: m.ClientsModule }))),
  'sales-orders': lazyMod(() => import('@/components/modules/sales-orders-module').then(m => ({ default: m.SalesOrdersModule }))),
  'sales-invoices': lazyMod(() => import('@/components/modules/sales-invoices-module').then(m => ({ default: m.SalesInvoicesModule }))),
  'sales-credit-notes': lazyMod(() => import('@/components/modules/sales-credit-notes-module').then(m => ({ default: m.SalesCreditNotesModule }))),
  'sales-payments': lazyMod(() => import('@/components/modules/sales-payments-module').then(m => ({ default: m.SalesPaymentsModule }))),

  // Purchases
  suppliers: lazyMod(() => import('@/components/modules/suppliers-module').then(m => ({ default: m.SuppliersModule }))),
  'purchase-orders': lazyMod(() => import('@/components/modules/purchase-orders-module').then(m => ({ default: m.PurchaseOrdersModule }))),
  'purchase-invoices': lazyMod(() => import('@/components/modules/purchase-invoices-module').then(m => ({ default: m.PurchaseInvoicesModule }))),
  'purchase-credit-notes': lazyMod(() => import('@/components/modules/purchase-credit-notes-module').then(m => ({ default: m.PurchaseCreditNotesModule }))),
  'purchase-payments': lazyMod(() => import('@/components/modules/purchase-payments-module').then(m => ({ default: m.PurchasePaymentsModule }))),

  // Inventory
  products: lazyMod(() => import('@/components/modules/products-module').then(m => ({ default: m.ProductsModule }))),
  categories: lazyMod(() => import('@/components/modules/categories-module').then(m => ({ default: m.CategoriesModule }))),
  storehouses: lazyMod(() => import('@/components/modules/storehouses-module').then(m => ({ default: m.StorehousesModule }))),
  'inventory-incoming': lazyMod(() => import('@/components/modules/inventory-incoming-module').then(m => ({ default: m.InventoryIncomingModule }))),
  'inventory-outgoing': lazyMod(() => import('@/components/modules/inventory-outgoing-module').then(m => ({ default: m.InventoryOutgoingModule }))),
  'inventory-transfers': lazyMod(() => import('@/components/modules/inventory-transfers-module').then(m => ({ default: m.InventoryTransfersModule }))),
  'stock-takes': lazyMod(() => import('@/components/modules/stock-takes-module').then(m => ({ default: m.StockTakesModule }))),
  'inventory-requisitions': lazyMod(() => import('@/components/modules/inventory-requisitions-module').then(m => ({ default: m.InventoryRequisitionsModule }))),

  // Accounting
  'chart-of-accounts': lazyMod(() => import('@/components/modules/chart-of-accounts-module').then(m => ({ default: m.ChartOfAccountsModule }))),
  'analytic-accounts': lazyMod(() => import('@/components/modules/analytic-accounts-module').then(m => ({ default: m.AnalyticAccountsModule }))),
  'journal-entries': lazyMod(() => import('@/components/modules/journal-entries-module').then(m => ({ default: m.JournalEntriesModule }))),
  'closed-periods': lazyMod(() => import('@/components/modules/closed-periods-module').then(m => ({ default: m.ClosedPeriodsModule }))),

  // Finance
  'bank-accounts': lazyMod(() => import('@/components/modules/bank-accounts-module').then(m => ({ default: m.BankAccountsModule }))),
  safes: lazyMod(() => import('@/components/modules/safes-module').then(m => ({ default: m.SafesModule }))),
  expenses: lazyMod(() => import('@/components/modules/expenses-module').then(m => ({ default: m.ExpensesModule }))),
  revenues: lazyMod(() => import('@/components/modules/revenues-module').then(m => ({ default: m.RevenuesModule }))),
  'finance-transfers': lazyMod(() => import('@/components/modules/finance-transfers-module').then(m => ({ default: m.FinanceTransfersModule }))),
  'finance-requisitions': lazyMod(() => import('@/components/modules/finance-requisitions-module').then(m => ({ default: m.FinanceRequisitionsModule }))),

  // Reports
  reports: lazyMod(() => import('@/components/modules/reports-module').then(m => ({ default: m.ReportsModule }))),

  // Branches
  branches: lazyMod(() => import('@/components/modules/branches-module').then(m => ({ default: m.BranchesModule }))),
  partners: lazyMod(() => import('@/components/modules/partners-module').then(m => ({ default: m.PartnersModule }))),
  activities: lazyMod(() => import('@/components/modules/activities-module').then(m => ({ default: m.ActivitiesModule }))),

  // Users
  users: lazyMod(() => import('@/components/modules/users-module').then(m => ({ default: m.UsersModule }))),
  roles: lazyMod(() => import('@/components/modules/roles-module').then(m => ({ default: m.RolesModule }))),

  // Settings & system
  settings: lazyMod(() => import('@/components/modules/settings-module').then(m => ({ default: m.SettingsModule }))),
  'document-templates': lazyMod(() => import('@/components/modules/document-templates-module').then(m => ({ default: m.DocumentTemplatesModule }))),
  'audit-logs': lazyMod(() => import('@/components/modules/audit-logs-module').then(m => ({ default: m.AuditLogsModule }))),
  notifications: lazyMod(() => import('@/components/modules/notifications-module').then(m => ({ default: m.NotificationsModule }))),
  profile: lazyMod(() => import('@/components/modules/profile-module').then(m => ({ default: m.ProfileModule }))),
}

function ModuleSkeleton() {
  return (
    <div className="flex flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 max-w-[1600px] mx-auto w-full">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-3 w-64 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-muted rounded-xl animate-pulse" />
    </div>
  )
}
