'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ModuleKey =
  // Platform
  | 'dashboard' | 'profile' | 'users' | 'roles' | 'audit-logs' | 'notifications' | 'settings' | 'system-config'
  | 'user-groups' | 'user-data' | 'transaction-privileges' | 'screen-privileges' | 'input-privileges' | 'view-privileges' | 'audit-control'
  | 'system-settings' | 'sequence-doc-types' | 'transaction-sequences' | 'system-alerts' | 'default-transaction-data'
  // System Configuration Domains & Sub-branches
  | 'org-structure'
  | 'config-general' | 'config-company' | 'config-general-vars' | 'config-general-defs' | 'config-currencies' | 'config-fiscal-periods' | 'config-org-structure' | 'config-subledgers-naming' | 'config-doc-types' | 'config-doc-sequences' | 'config-languages' | 'config-datetime' | 'config-payment-methods'
  | 'config-finance' | 'config-general-accounting' | 'config-posting-settings' | 'config-opening-balances' | 'config-closing-settings' | 'config-currencies-accounting' | 'config-cost-centers' | 'config-analytic-accounts'
  | 'config-sales' | 'config-sales-general' | 'config-payment-terms' | 'config-quotations-validity' | 'config-discounts' | 'config-credit-limits' | 'config-below-cost-sale' | 'config-sales-invoices' | 'config-price-levels' | 'config-sales-outlets'
  | 'config-procurement' | 'config-procurement-general' | 'config-purchase-requests' | 'config-purchase-orders' | 'config-three-way-matching' | 'config-price-qty-variance' | 'config-auto-posting-procurement' | 'config-purchase-expenses' | 'config-supplier-price-lists'
  | 'config-inventory' | 'config-inventory-general' | 'config-valuation-method' | 'config-inventory-accounts' | 'config-warehouses-setup' | 'config-warehouse-groups' | 'config-uom' | 'config-item-categories' | 'config-item-definitions' | 'config-barcodes' | 'config-electronic-scales' | 'config-inventory-expenses'
  | 'config-taxes-einvoicing' | 'config-taxes' | 'config-tax-categories' | 'config-tax-registration' | 'config-einvoicing' | 'config-zatca' | 'config-qr-code' | 'config-digital-signature' | 'config-e-integration'
  | 'config-hr' | 'config-hr-departments' | 'config-hr-job-titles' | 'config-hr-schedules' | 'config-hr-leaves' | 'config-hr-payroll' | 'config-hr-contracts'
  | 'config-manufacturing' | 'config-mfg-general' | 'config-mfg-accounts' | 'config-mfg-boms' | 'config-mfg-work-centers' | 'config-mfg-production-orders'
  | 'config-pos' | 'config-pos-general' | 'config-pos-sessions' | 'config-pos-invoices' | 'config-pos-outlets' | 'config-pos-payment-methods' | 'config-pos-print-templates'
  | 'config-notifications-comm' | 'config-notif-settings' | 'config-smtp' | 'config-sms' | 'config-whatsapp' | 'config-reminders' | 'config-comm-channels'
  | 'config-printing-docs' | 'config-print-settings' | 'config-doc-templates-setup' | 'config-company-logo' | 'config-signatures' | 'config-document-footer' | 'config-pdf-settings' | 'config-export-settings'
  | 'config-backup' | 'config-manual-backup' | 'config-backup-schedule' | 'config-retention-policy' | 'config-restore' | 'config-cloud-storage'
  | 'config-integrations' | 'config-api-keys' | 'config-webhooks' | 'config-aws' | 'config-email-integration' | 'config-payment-gateways' | 'config-external-systems'
  | 'config-workflow-approval' | 'config-approval-policies' | 'config-approval-routes' | 'config-approval-levels' | 'config-approval-rules' | 'config-approval-conditions' | 'config-device-approval'
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
