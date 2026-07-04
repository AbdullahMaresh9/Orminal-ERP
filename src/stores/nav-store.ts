'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ModuleKey =
  | 'dashboard'
  | 'pos'
  // Sales
  | 'clients' | 'sales-orders' | 'sales-invoices' | 'sales-credit-notes' | 'sales-payments'
  // Purchases
  | 'suppliers' | 'purchase-orders' | 'purchase-invoices' | 'purchase-credit-notes' | 'purchase-payments'
  // Inventory
  | 'products' | 'categories' | 'storehouses' | 'inventory-incoming' | 'inventory-outgoing'
  | 'inventory-transfers' | 'stock-takes' | 'inventory-requisitions'
  // Accounting
  | 'chart-of-accounts' | 'analytic-accounts' | 'journal-entries' | 'closed-periods'
  // Finance
  | 'bank-accounts' | 'safes' | 'expenses' | 'revenues' | 'finance-transfers' | 'finance-requisitions'
  // Reports & users
  | 'reports' | 'branches' | 'partners' | 'activities' | 'users' | 'roles'
  // Settings & system
  | 'settings' | 'document-templates' | 'audit-logs' | 'notifications' | 'profile'

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
      name: 'alostaz-nav',
      partialize: (s) => ({ activeModule: s.activeModule, sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
)
