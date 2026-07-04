'use client'

import { useNav, type ModuleKey } from '@/stores/nav-store'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  LayoutDashboard, ShoppingCart, FileText, Receipt, Wallet, Users, Truck,
  Package, FolderTree, Warehouse, ArrowLeftRight, ClipboardList, FileSpreadsheet,
  BookOpen, GitBranch, CalendarClock, Landmark, PiggyBank, TrendingDown, TrendingUp,
  BarChart3, Building2, Handshake, Activity, UserCircle, ShieldCheck, FileBarChart,
  Settings, FileCode, ScrollText, Bell, UserCog, type LucideIcon,
} from 'lucide-react'
import { RoleBadge } from './role-badge'

interface NavItem {
  key: ModuleKey
  labelKey: string
  icon: LucideIcon
}
interface NavGroup {
  labelKey: string
  icon: LucideIcon
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    labelKey: 'nav.group.overview',
    icon: LayoutDashboard,
    items: [
      { key: 'dashboard', labelKey: 'module.dashboard', icon: LayoutDashboard },
      { key: 'pos', labelKey: 'module.pos', icon: ShoppingCart },
    ],
  },
  {
    labelKey: 'nav.group.sales',
    icon: FileText,
    items: [
      { key: 'clients', labelKey: 'module.clients', icon: Users },
      { key: 'sales-orders', labelKey: 'module.sales-orders', icon: FileText },
      { key: 'sales-invoices', labelKey: 'module.sales-invoices', icon: Receipt },
      { key: 'sales-credit-notes', labelKey: 'module.sales-credit-notes', icon: FileBarChart },
      { key: 'sales-payments', labelKey: 'module.sales-payments', icon: Wallet },
    ],
  },
  {
    labelKey: 'nav.group.purchases',
    icon: Truck,
    items: [
      { key: 'suppliers', labelKey: 'module.suppliers', icon: Truck },
      { key: 'purchase-orders', labelKey: 'module.purchase-orders', icon: FileText },
      { key: 'purchase-invoices', labelKey: 'module.purchase-invoices', icon: Receipt },
      { key: 'purchase-credit-notes', labelKey: 'module.purchase-credit-notes', icon: FileBarChart },
      { key: 'purchase-payments', labelKey: 'module.purchase-payments', icon: Wallet },
    ],
  },
  {
    labelKey: 'nav.group.inventory',
    icon: Package,
    items: [
      { key: 'products', labelKey: 'module.products', icon: Package },
      { key: 'categories', labelKey: 'module.categories', icon: FolderTree },
      { key: 'storehouses', labelKey: 'module.storehouses', icon: Warehouse },
      { key: 'inventory-incoming', labelKey: 'module.inventory-incoming', icon: Package },
      { key: 'inventory-outgoing', labelKey: 'module.inventory-outgoing', icon: Package },
      { key: 'inventory-transfers', labelKey: 'module.inventory-transfers', icon: ArrowLeftRight },
      { key: 'stock-takes', labelKey: 'module.stock-takes', icon: ClipboardList },
      { key: 'inventory-requisitions', labelKey: 'module.inventory-requisitions', icon: FileSpreadsheet },
    ],
  },
  {
    labelKey: 'nav.group.accounting',
    icon: BookOpen,
    items: [
      { key: 'chart-of-accounts', labelKey: 'module.chart-of-accounts', icon: BookOpen },
      { key: 'analytic-accounts', labelKey: 'module.analytic-accounts', icon: GitBranch },
      { key: 'journal-entries', labelKey: 'module.journal-entries', icon: FileText },
      { key: 'closed-periods', labelKey: 'module.closed-periods', icon: CalendarClock },
    ],
  },
  {
    labelKey: 'nav.group.finance',
    icon: Landmark,
    items: [
      { key: 'bank-accounts', labelKey: 'module.bank-accounts', icon: Landmark },
      { key: 'safes', labelKey: 'module.safes', icon: PiggyBank },
      { key: 'expenses', labelKey: 'module.expenses', icon: TrendingDown },
      { key: 'revenues', labelKey: 'module.revenues', icon: TrendingUp },
      { key: 'finance-transfers', labelKey: 'module.finance-transfers', icon: ArrowLeftRight },
      { key: 'finance-requisitions', labelKey: 'module.finance-requisitions', icon: FileSpreadsheet },
    ],
  },
  {
    labelKey: 'nav.group.reports',
    icon: BarChart3,
    items: [
      { key: 'reports', labelKey: 'module.reports', icon: BarChart3 },
    ],
  },
  {
    labelKey: 'nav.group.branches',
    icon: Building2,
    items: [
      { key: 'branches', labelKey: 'module.branches', icon: Building2 },
      { key: 'partners', labelKey: 'module.partners', icon: Handshake },
      { key: 'activities', labelKey: 'module.activities', icon: Activity },
    ],
  },
  {
    labelKey: 'nav.group.users',
    icon: UserCircle,
    items: [
      { key: 'users', labelKey: 'module.users', icon: Users },
      { key: 'roles', labelKey: 'module.roles', icon: ShieldCheck },
    ],
  },
  {
    labelKey: 'nav.group.settings',
    icon: Settings,
    items: [
      { key: 'settings', labelKey: 'module.settings', icon: Settings },
      { key: 'document-templates', labelKey: 'module.document-templates', icon: FileCode },
      { key: 'audit-logs', labelKey: 'module.audit-logs', icon: ScrollText },
      { key: 'notifications', labelKey: 'module.notifications', icon: Bell },
      { key: 'profile', labelKey: 'module.profile', icon: UserCog },
    ],
  },
]

export function SidebarNav() {
  const { activeModule, setActiveModule } = useNav()
  const { t } = useT()

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-sidebar-border">
        <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-extrabold text-lg shadow-sm">
          أ
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight truncate">{t('app.name')}</p>
          <p className="text-[10px] text-muted-foreground leading-tight truncate">{t('app.tagline')}</p>
        </div>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 min-h-0 px-2 py-3">
        <nav className="flex flex-col gap-1">
          {NAV.map((group) => {
            const GroupIcon = group.icon
            return (
              <div key={group.labelKey} className="mb-2">
                <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  <GroupIcon className="size-3" />
                  <span>{t(group.labelKey)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const active = activeModule === item.key
                    return (
                      <button
                        key={item.key}
                        onClick={() => setActiveModule(item.key)}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-start',
                          active
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <Icon className={cn('size-4 shrink-0', active ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground')} />
                        <span className="truncate">{t(item.labelKey)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Footer / user card */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        <RoleBadge />
      </div>
    </div>
  )
}
