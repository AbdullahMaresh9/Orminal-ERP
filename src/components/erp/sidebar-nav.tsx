'use client'

import { useState, useEffect } from 'react'
import { useNav, type ModuleKey } from '@/stores/nav-store'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FileText, Receipt, Wallet, Truck, Package, FolderTree,
  Warehouse, BookOpen, CalendarClock, GitBranch, Landmark, PiggyBank,
  BarChart3, Building2, Handshake, Activity, UserCircle, ShieldCheck,
  ScrollText, Bell, UserCog, Settings, ClipboardList, FileSpreadsheet,
  ArrowLeftRight, FileBarChart, FilePlus, FileMinus, PackageCheck,
  Boxes, Factory, Cog, Users, UsersRound,
  CalendarDays, CalendarCheck, Banknote, ChevronDown, ChevronLeft, ChevronRight,
  ShoppingCart, TrendingUp, TrendingDown, ArrowUpDown,
  FileCheck, Search, DollarSign, ClipboardCheck, FileInput, FileOutput,
  Store, RefreshCcw, LayoutList, Copy,
  type LucideIcon,
} from 'lucide-react'
import { RoleBadge } from './role-badge'

interface NavItem {
  key: ModuleKey
  labelKey: string
  icon: LucideIcon
}

interface NavSubGroup {
  labelKey: string
  icon?: LucideIcon
  items: NavItem[]
}

interface NavGroup {
  labelKey: string
  icon: LucideIcon
  items?: NavItem[]
  subGroups?: NavSubGroup[]
}

const NAV: NavGroup[] = [
  // ── Overview ─────────────────────────────────────────────
  {
    labelKey: 'nav.group.overview',
    icon: LayoutDashboard,
    items: [
      { key: 'dashboard', labelKey: 'module.dashboard', icon: LayoutDashboard },
    ],
  },

  // ── Master Data ───────────────────────────────────────────
  {
    labelKey: 'nav.group.master-data',
    icon: Handshake,
    items: [
      { key: 'products', labelKey: 'module.products', icon: Package },
      { key: 'categories', labelKey: 'module.categories', icon: FolderTree },
      { key: 'warehouses', labelKey: 'module.warehouses', icon: Warehouse },
      { key: 'branches', labelKey: 'module.branches', icon: Building2 },
    ],
  },

  // ── POS ───────────────────────────────────────────────────
  {
    labelKey: 'nav.group.pos',
    icon: ShoppingCart,
    items: [
      { key: 'pos', labelKey: 'module.pos', icon: ShoppingCart },
    ],
  },

  // ── Sales ─────────────────────────────────────────────────
  {
    labelKey: 'nav.group.sales',
    icon: FileText,
    items: [
      { key: 'customers', labelKey: 'module.customers', icon: Users },
      { key: 'sales-quotations', labelKey: 'module.sales-quotations', icon: FilePlus },
      { key: 'sales-orders', labelKey: 'module.sales-orders', icon: FileText },
      { key: 'sales-invoices', labelKey: 'module.sales-invoices', icon: Receipt },
      { key: 'sales-credit-notes', labelKey: 'module.sales-credit-notes', icon: FileMinus },
      { key: 'sales-payments', labelKey: 'module.sales-payments', icon: Wallet },
      { key: 'sales-returns', labelKey: 'module.sales-returns', icon: RefreshCcw },
    ],
  },

  // ── Procurement ───────────────────────────────────────────
  {
    labelKey: 'nav.group.procurement',
    icon: Truck,
    items: [
      { key: 'suppliers', labelKey: 'module.suppliers', icon: UsersRound },
      { key: 'purchase-requests', labelKey: 'module.purchase-requests', icon: ClipboardList },
      { key: 'purchase-orders', labelKey: 'module.purchase-orders', icon: FileText },
      { key: 'goods-receipts', labelKey: 'module.goods-receipts', icon: PackageCheck },
      { key: 'purchase-invoices', labelKey: 'module.purchase-invoices', icon: Receipt },
      { key: 'purchase-credit-notes', labelKey: 'module.purchase-credit-notes', icon: FileMinus },
      { key: 'purchase-payments', labelKey: 'module.purchase-payments', icon: Wallet },
      { key: 'purchase-returns', labelKey: 'module.purchase-returns', icon: RefreshCcw },
    ],
  },

  // ── Inventory ─────────────────────────────────────────────
  {
    labelKey: 'nav.group.inventory',
    icon: Boxes,
    items: [
      { key: 'stock-on-hand', labelKey: 'module.stock-on-hand', icon: Package },
      { key: 'stock-takes', labelKey: 'module.stock-takes', icon: ClipboardCheck },
      { key: 'inventory-adjustments', labelKey: 'module.inventory-adjustments', icon: ClipboardList },
      { key: 'inventory-incoming', labelKey: 'module.inventory-incoming', icon: FileInput },
      { key: 'inventory-outgoing', labelKey: 'module.inventory-outgoing', icon: FileOutput },
      { key: 'inventory-transfers', labelKey: 'module.inventory-transfers', icon: ArrowLeftRight },
      { key: 'inventory-requisitions', labelKey: 'module.inventory-requisitions', icon: LayoutList },
      { key: 'deliveries', labelKey: 'module.deliveries', icon: Truck },
      { key: 'stock-moves', labelKey: 'module.stock-moves', icon: FileSpreadsheet },
    ],
  },

  // ── Accounts & Finance (الحسابات والمالية) ─────────────────
  {
    labelKey: 'nav.group.finance',
    icon: BookOpen,
    subGroups: [
      {
        labelKey: 'nav.subgroup.coa-setup',
        icon: BookOpen,
        items: [
          { key: 'chart-of-accounts', labelKey: 'module.chart-of-accounts', icon: BookOpen },
          { key: 'analytic-accounts', labelKey: 'module.analytic-accounts', icon: GitBranch },
          { key: 'cost-centers', labelKey: 'module.cost-centers', icon: GitBranch },
          { key: 'fiscal-periods', labelKey: 'module.fiscal-periods', icon: CalendarClock },
          { key: 'opening-balances', labelKey: 'module.opening-balances', icon: FileSpreadsheet },
          { key: 'financial-statement-designer', labelKey: 'module.financial-statement-designer', icon: FileBarChart },
          { key: 'payment-methods', labelKey: 'module.payment-methods', icon: Receipt },
        ],
      },
      {
        labelKey: 'nav.subgroup.entries-vouchers',
        icon: FileText,
        items: [
          { key: 'journal-entries', labelKey: 'module.journal-entries', icon: FileText },
          { key: 'sales-payments', labelKey: 'module.sales-payments', icon: Wallet },
          { key: 'purchase-payments', labelKey: 'module.purchase-payments', icon: Wallet },
          { key: 'purchase-credit-notes', labelKey: 'module.purchase-credit-notes', icon: FileMinus },
          { key: 'sales-credit-notes', labelKey: 'module.sales-credit-notes', icon: FilePlus },
          { key: 'cash-count', labelKey: 'module.cash-count', icon: ClipboardCheck },
          { key: 'financial-adjustments', labelKey: 'module.financial-adjustments', icon: RefreshCcw },
          { key: 'accounting-posting', labelKey: 'module.accounting-posting', icon: FileCheck },
          { key: 'accounting-unposting', labelKey: 'module.accounting-unposting', icon: RefreshCcw },
        ],
      },
      {
        labelKey: 'nav.subgroup.safes-banks',
        icon: Landmark,
        items: [
          { key: 'safes', labelKey: 'module.safes', icon: PiggyBank },
          { key: 'bank-accounts', labelKey: 'module.bank-accounts', icon: Landmark },
          { key: 'bank-transfers', labelKey: 'module.bank-transfers', icon: ArrowLeftRight },
          { key: 'finance-transfers', labelKey: 'module.finance-transfers', icon: ArrowLeftRight },
          { key: 'bank-reconciliation', labelKey: 'module.bank-reconciliation', icon: FileCheck },
          { key: 'credit-card-types', labelKey: 'module.credit-card-types', icon: Receipt },
        ],
      },
      {
        labelKey: 'nav.subgroup.ar',
        icon: Users,
        items: [
          { key: 'customers', labelKey: 'module.customers', icon: Users },
          { key: 'ar-aging', labelKey: 'module.ar-aging', icon: CalendarClock },
          { key: 'customer-balances', labelKey: 'module.customer-balances', icon: Wallet },
          { key: 'customer-adjustments', labelKey: 'module.customer-adjustments', icon: FileMinus },
        ],
      },
      {
        labelKey: 'nav.subgroup.ap',
        icon: UsersRound,
        items: [
          { key: 'suppliers', labelKey: 'module.suppliers', icon: UsersRound },
          { key: 'ap-aging', labelKey: 'module.ap-aging', icon: CalendarClock },
          { key: 'supplier-balances', labelKey: 'module.supplier-balances', icon: Wallet },
          { key: 'supplier-adjustments', labelKey: 'module.supplier-adjustments', icon: FileMinus },
        ],
      },
      {
        labelKey: 'nav.subgroup.expenses-revenues',
        icon: TrendingUp,
        items: [
          { key: 'expenses', labelKey: 'module.expenses', icon: TrendingDown },
          { key: 'revenues', labelKey: 'module.revenues', icon: TrendingUp },
          { key: 'finance-requisitions', labelKey: 'module.finance-requisitions', icon: DollarSign },
          { key: 'expense-adjustments', labelKey: 'module.expense-adjustments', icon: RefreshCcw },
        ],
      },
      {
        labelKey: 'nav.subgroup.fixed-assets',
        icon: Building2,
        items: [
          { key: 'fixed-assets', labelKey: 'module.fixed-assets', icon: Building2 },
          { key: 'asset-categories', labelKey: 'module.asset-categories', icon: FolderTree },
          { key: 'asset-depreciation', labelKey: 'module.asset-depreciation', icon: TrendingDown },
          { key: 'asset-transfers', labelKey: 'module.asset-transfers', icon: ArrowLeftRight },
          { key: 'asset-disposals', labelKey: 'module.asset-disposals', icon: FileMinus },
        ],
      },
    ],
  },

  // ── Manufacturing ─────────────────────────────────────────
  {
    labelKey: 'nav.group.manufacturing',
    icon: Factory,
    items: [
      { key: 'boms', labelKey: 'module.boms', icon: ClipboardList },
      { key: 'work-centers', labelKey: 'module.work-centers', icon: Cog },
      { key: 'production-orders', labelKey: 'module.production-orders', icon: Factory },
    ],
  },

  // ── HR ────────────────────────────────────────────────────
  {
    labelKey: 'nav.group.hr',
    icon: Users,
    items: [
      { key: 'employees', labelKey: 'module.employees', icon: Users },
      { key: 'departments', labelKey: 'module.departments', icon: UsersRound },
      { key: 'attendance', labelKey: 'module.attendance', icon: CalendarCheck },
      { key: 'leave-requests', labelKey: 'module.leave-requests', icon: CalendarDays },
      { key: 'payroll-runs', labelKey: 'module.payroll-runs', icon: Banknote },
      { key: 'activities', labelKey: 'module.activities', icon: Activity },
    ],
  },

  // ── Reports ───────────────────────────────────────────────
  {
    labelKey: 'nav.group.reports',
    icon: BarChart3,
    items: [
      { key: 'reports', labelKey: 'module.reports', icon: BarChart3 },
    ],
  },

  // ── Platform ──────────────────────────────────────────────
  {
    labelKey: 'nav.group.platform',
    icon: Settings,
    items: [
      { key: 'users', labelKey: 'module.users', icon: Users },
      { key: 'roles', labelKey: 'module.roles', icon: ShieldCheck },
      { key: 'audit-logs', labelKey: 'module.audit-logs', icon: ScrollText },
      { key: 'notifications', labelKey: 'module.notifications', icon: Bell },
      { key: 'document-templates', labelKey: 'module.document-templates', icon: Copy },
      { key: 'settings', labelKey: 'module.settings', icon: Settings },
      { key: 'profile', labelKey: 'module.profile', icon: UserCog },
    ],
  },
]

export function SidebarNav() {
  const { activeModule, setActiveModule } = useNav()
  const { t } = useT()
  const [dir, setDir] = useState<'rtl' | 'ltr'>('rtl')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateDir = () => {
        const docDir = document.documentElement.dir || 'rtl'
        setDir(docDir as 'rtl' | 'ltr')
      }
      updateDir()
      const observer = new MutationObserver(updateDir)
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['dir'],
      })
      return () => observer.disconnect()
    }
  }, [])

  const isRtl = dir === 'rtl'

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const group of NAV) {
      const hasItem = group.items?.some((item) => item.key === activeModule)
      const hasSubItem = group.subGroups?.some((sg) => sg.items.some((i) => i.key === activeModule))
      if (hasItem || hasSubItem) initial.add(group.labelKey)
      if (group.items?.length === 1) initial.add(group.labelKey)
    }
    return initial
  })

  const [expandedSubGroups, setExpandedSubGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const group of NAV) {
      if (group.subGroups) {
        for (const sg of group.subGroups) {
          if (sg.items.some((item) => item.key === activeModule)) {
            initial.add(sg.labelKey)
          }
        }
      }
    }
    return initial
  })

  useEffect(() => {
    for (const group of NAV) {
      if (group.subGroups) {
        for (const sg of group.subGroups) {
          if (sg.items.some((item) => item.key === activeModule)) {
            setExpandedGroups((prev) => new Set(prev).add(group.labelKey))
            setExpandedSubGroups((prev) => new Set(prev).add(sg.labelKey))
          }
        }
      } else if (group.items?.some((i) => i.key === activeModule)) {
        setExpandedGroups((prev) => new Set(prev).add(group.labelKey))
      }
    }
  }, [activeModule])

  const toggleGroup = (labelKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(labelKey)) next.delete(labelKey)
      else next.add(labelKey)
      return next
    })
  }

  const toggleSubGroup = (labelKey: string) => {
    setExpandedSubGroups((prev) => {
      const next = new Set(prev)
      if (next.has(labelKey)) next.delete(labelKey)
      else next.add(labelKey)
      return next
    })
  }

  const handleItemClick = (key: ModuleKey) => {
    setActiveModule(key)
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground" dir={dir}>
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-sidebar-border">
        <img src="/logo.png" alt="أورمنال" className="size-9 rounded-xl shadow-sm object-contain shrink-0" />
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight truncate">{t('app.name')}</p>
          <p className="text-[10px] text-muted-foreground leading-tight truncate">{t('app.tagline')}</p>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 min-h-0 px-2 py-3 overflow-y-auto scrollbar-thin" dir={dir}>
        <nav className="flex flex-col gap-0.5" dir={dir}>
          {NAV.map((group) => {
            const GroupIcon = group.icon
            const isExpanded = expandedGroups.has(group.labelKey)
            const hasSubGroups = !!group.subGroups && group.subGroups.length > 0
            const hasActiveChild = hasSubGroups
              ? group.subGroups!.some((sg) => sg.items.some((i) => i.key === activeModule))
              : group.items?.some((item) => item.key === activeModule)
            const isSingleItem = !hasSubGroups && group.items?.length === 1

            if (isSingleItem && group.items) {
              const item = group.items[0]
              const Icon = item.icon
              const active = activeModule === item.key
              return (
                <button
                  key={group.labelKey}
                  onClick={() => handleItemClick(item.key)}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full',
                    isRtl ? 'text-right' : 'text-left',
                    active
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon className={cn('size-4 shrink-0', active ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground')} />
                  <span className={cn('truncate flex-1', isRtl ? 'text-right' : 'text-left')}>{t(item.labelKey)}</span>
                </button>
              )
            }

            return (
              <div key={group.labelKey} className="mb-0.5">
                <button
                  onClick={() => toggleGroup(group.labelKey)}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors w-full',
                    isRtl ? 'text-right' : 'text-left',
                    hasActiveChild
                      ? 'text-sidebar-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <GroupIcon className={cn('size-4 shrink-0', hasActiveChild ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground')} />
                  <span className={cn('truncate flex-1', isRtl ? 'text-right' : 'text-left')}>{t(group.labelKey)}</span>
                  <ChevronDown
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground/70 transition-transform duration-200',
                      isExpanded ? 'rotate-0' : (isRtl ? 'rotate-90' : '-rotate-90')
                    )}
                  />
                </button>

                {isExpanded && (
                  <div className="flex flex-col gap-0.5 mt-0.5 ms-3 ps-2 border-s border-sidebar-border/60">
                    {/* Render subGroups if present */}
                    {hasSubGroups
                      ? group.subGroups!.map((sg) => {
                          const SgIcon = sg.icon || BookOpen
                          const isSgExpanded = expandedSubGroups.has(sg.labelKey)
                          const hasSgActiveChild = sg.items.some((i) => i.key === activeModule)

                          return (
                            <div key={sg.labelKey} className="my-0.5">
                              <button
                                onClick={() => toggleSubGroup(sg.labelKey)}
                                className={cn(
                                  'group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors w-full',
                                  isRtl ? 'text-right' : 'text-left',
                                  hasSgActiveChild
                                    ? 'text-primary font-bold'
                                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
                                )}
                              >
                                <SgIcon className={cn('size-3.5 shrink-0', hasSgActiveChild ? 'text-primary' : 'text-muted-foreground')} />
                                <span className={cn('truncate flex-1', isRtl ? 'text-right' : 'text-left')}>{t(sg.labelKey)}</span>
                                <ChevronDown
                                  className={cn(
                                    'size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200',
                                    isSgExpanded ? 'rotate-0' : (isRtl ? 'rotate-90' : '-rotate-90')
                                  )}
                                />
                              </button>

                              {isSgExpanded && (
                                <div className="flex flex-col gap-0.5 mt-0.5 ms-3 ps-2 border-s border-sidebar-border/40">
                                  {sg.items.map((item) => {
                                    const Icon = item.icon
                                    const active = activeModule === item.key
                                    return (
                                      <button
                                        key={item.key}
                                        onClick={() => handleItemClick(item.key)}
                                        className={cn(
                                          'group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors w-full',
                                          isRtl ? 'text-right' : 'text-left',
                                          active
                                            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-semibold'
                                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-normal'
                                        )}
                                      >
                                        <Icon className={cn('size-3 shrink-0', active ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground')} />
                                        <span className={cn('truncate flex-1', isRtl ? 'text-right' : 'text-left')}>{t(item.labelKey)}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })
                      : group.items?.map((item) => {
                          const Icon = item.icon
                          const active = activeModule === item.key
                          return (
                            <button
                              key={item.key}
                              onClick={() => handleItemClick(item.key)}
                              className={cn(
                                'group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors w-full',
                                isRtl ? 'text-right' : 'text-left',
                                active
                                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-medium'
                                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-normal'
                              )}
                            >
                              <Icon className={cn('size-3.5 shrink-0', active ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground')} />
                              <span className={cn('truncate flex-1', isRtl ? 'text-right' : 'text-left')}>{t(item.labelKey)}</span>
                            </button>
                          )
                        })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      {/* Footer / user card */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        <RoleBadge />
      </div>
    </div>
  )
}
