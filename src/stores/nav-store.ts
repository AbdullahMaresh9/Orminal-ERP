'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 16 unified modules per Arabic Accounting Spec §22 + Volume 2 bounded contexts
export type ModuleKey =
  // Platform
  | 'dashboard' | 'profile' | 'users' | 'roles' | 'audit-logs' | 'notifications' | 'settings'
  // Master Data
  | 'partners' | 'products' | 'categories' | 'warehouses'
  // Finance
  | 'chart-of-accounts' | 'journal-entries' | 'fiscal-periods' | 'cost-centers' | 'bank-accounts' | 'safes'
  | 'sales-payments' | 'purchase-payments'
  // Sales & CRM
  | 'sales-quotations' | 'sales-orders' | 'sales-invoices' | 'sales-credit-notes' | 'sales-returns'
  // Procurement
  | 'purchase-requests' | 'purchase-orders' | 'goods-receipts' | 'purchase-invoices' | 'purchase-credit-notes' | 'purchase-returns'
  // Inventory
  | 'stock-on-hand' | 'stock-transfers' | 'deliveries' | 'inventory-adjustments' | 'stock-moves'
  // Manufacturing
  | 'boms' | 'work-centers' | 'production-orders'
  // HR
  | 'employees' | 'departments' | 'attendance' | 'leave-requests' | 'payroll-runs'
  // Reports
  | 'reports'

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
      name: 'alostaz-nav-v2',
      skipHydration: true,
      partialize: (s) => ({ activeModule: s.activeModule, sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
)
