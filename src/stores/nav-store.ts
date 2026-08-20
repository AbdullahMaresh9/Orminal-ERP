'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ModuleKey =
  //  Platform
  | 'dashboard' | 'profile' | 'users' | 'roles' | 'audit-logs' | 'notifications' | 'settings' | 'system-config'
  // Master Data
  | 'products' | 'categories' | 'warehouses' | 'branches' | 'customers' | 'suppliers'
  // Finance & Accounts
  | 'chart-of-accounts' | 'journal-entries' | 'fiscal-periods' | 'cost-centers' | 'bank-accounts' | 'safes'
  | 'analytic-accounts' | 'closed-periods' | 'opening-balances' | 'financial-statement-designer' | 'payment-methods'
  | 'sales-payments' | 'purchase-payments' | 'cash-count' | 'financial-adjustments' | 'accounting-posting' | 'accounting-unposting'
  | 'bank-transfers' | 'bank-reconciliation' | 'credit-card-types'
  | 'ar-aging' | 'customer-balances' | 'customer-adjustments'
  | 'ap-aging' | 'supplier-balances' | 'supplier-adjustments'
  | 'expenses' | 'revenues' | 'finance-transfers' | 'finance-requisitions' | 'expense-adjustments'
  | 'fixed-assets' | 'asset-categories' | 'asset-depreciation' | 'asset-transfers' | 'asset-disposals'
  // Sales & CRM
  | 'sales-quotations' | 'sales-orders' | 'sales-invoices' | 'sales-credit-notes' | 'sales-returns'
  // POS
  | 'pos'
  // Procurement
  | 'purchase-requests' | 'purchase-orders' | 'goods-receipts' | 'purchase-invoices' | 'purchase-credit-notes' | 'purchase-returns'
  // Inventory
  | 'stock-on-hand' | 'deliveries' | 'inventory-adjustments' | 'stock-moves'
  | 'stock-takes' | 'inventory-transfers' | 'inventory-incoming' | 'inventory-outgoing' | 'inventory-requisitions'
  // Manufacturing
  | 'boms' | 'work-centers' | 'production-orders'
  // HR
  | 'employees' | 'departments' | 'attendance' | 'leave-requests' | 'payroll-runs' | 'activities'
  // Reports
  | 'reports'
  | 'reports-dashboard'
  | 'account-statement' | 'general-journal' | 'trial-balance' | 'balance-sheet' | 'income' | 'cash-flow'
  | 'account-movement' | 'opening-balances-rep' | 'posted-unposted-entries' | 'debit-credit-notes'
  | 'receipt-vouchers' | 'payment-vouchers' | 'cash-count-rep' | 'chart-of-accounts-rep' | 'cost-center-report'
  | 'customers-list' | 'customer-balances-rep' | 'customer-statement' | 'customer-debts' | 'ar-aging-rep' | 'customer-collections' | 'customer-adjustments-rep'
  | 'suppliers-list' | 'supplier-balances-rep' | 'supplier-statement' | 'supplier-payables' | 'ap-aging-rep' | 'supplier-payments-rep' | 'supplier-adjustments-rep'
  | 'sales-quotations-rep' | 'sales-orders-rep' | 'tax-invoices' | 'sales-returns-rep' | 'sales-credit-notes-rep' | 'net-sales' | 'sales-by-customer' | 'sales-by-product' | 'sales-by-branch' | 'sales-by-rep' | 'profit-margin'
  | 'purchase-requests-rep' | 'purchase-orders-rep' | 'goods-receipts-rep' | 'purchase-invoices-rep' | 'purchase-returns-rep' | 'purchase-credit-notes-rep' | 'net-purchases' | 'purchases-by-supplier' | 'purchases-by-product' | 'purchases-by-branch'
  | 'current-stock' | 'stock-moves-rep' | 'inventory-value' | 'stock-takes-rep' | 'inventory-adjustments-rep' | 'incoming-outgoing' | 'stock-transfers-rep' | 'stock-turnover' | 'dead-stock' | 'low-stock' | 'product-movement'
  | 'pos-daily-sales' | 'pos-invoices' | 'pos-returns' | 'pos-payment-methods' | 'pos-performance' | 'shift-closing'
  | 'employees-directory' | 'attendance-summary' | 'leave-summary' | 'payroll-summary' | 'hr-overview'
  | 'assets-register' | 'assets-valuation' | 'asset-depreciation-rep' | 'asset-transfers-rep' | 'asset-disposals-rep'
  // Document Templates
  | 'document-templates'

interface NavState {
  activeModule: ModuleKey
  setActiveModule: (m: ModuleKey) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (v: boolean) => void
}

export const useNav = create<NavState>()(
  persist(
    (set) => ({
      activeModule: 'dashboard',
      setActiveModule: (m) => set({ activeModule: m, mobileSidebarOpen: false }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      mobileSidebarOpen: false,
      setMobileSidebarOpen: (v) => set({ mobileSidebarOpen: v }),
    }),
    {
      name: 'ormenal-nav-v3',
      skipHydration: true,
      partialize: (s) => ({ activeModule: s.activeModule, sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
)
