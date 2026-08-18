'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ModuleKey =
  //  Platform
  | 'dashboard' | 'profile' | 'users' | 'roles' | 'audit-logs' | 'notifications' | 'settings'
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
