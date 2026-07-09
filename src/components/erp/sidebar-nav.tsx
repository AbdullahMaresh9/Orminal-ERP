'use client'

import { useNav, type ModuleKey } from '@/stores/nav-store'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  LayoutDashboard, FileText, Receipt, Wallet, Truck, Package, FolderTree,
  Warehouse, BookOpen, CalendarClock, GitBranch, Landmark, PiggyBank,
  BarChart3, Building2, Handshake, Activity, UserCircle, ShieldCheck,
  ScrollText, Bell, UserCog, Settings, ClipboardList, FileSpreadsheet,
  ArrowLeftRight, FileBarChart, FilePlus, FileMinus, PackageCheck,
  Boxes, Factory, Cog, ClipboardList as ClipboardListIcon, Users, UsersRound,
  CalendarDays, CalendarCheck, Banknote, type LucideIcon,
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

// 10 unified groups per Ormenal spec (16 modules)
const NAV: NavGroup[] = [
  {
    labelKey: 'nav.group.overview',
    icon: LayoutDashboard,
    items: [
      { key: 'dashboard', labelKey: 'module.dashboard', icon: LayoutDashboard },
    ],
  },
  {
    labelKey: 'nav.group.master-data',
    icon: Handshake,
    items: [
      { key: 'partners', labelKey: 'module.partners', icon: Handshake },
      { key: 'products', labelKey: 'module.products', icon: Package },
      { key: 'categories', labelKey: 'module.categories', icon: FolderTree },
      { key: 'warehouses', labelKey: 'module.warehouses', icon: Warehouse },
    ],
  },
  {
    labelKey: 'nav.group.sales',
    icon: FileText,
    items: [
      { key: 'sales-quotations', labelKey: 'module.sales-quotations', icon: FilePlus },
      { key: 'sales-orders', labelKey: 'module.sales-orders', icon: FileText },
      { key: 'sales-invoices', labelKey: 'module.sales-invoices', icon: Receipt },
      { key: 'sales-credit-notes', labelKey: 'module.sales-credit-notes', icon: FileMinus },
      { key: 'sales-payments', labelKey: 'module.sales-payments', icon: Wallet },
      { key: 'sales-returns', labelKey: 'module.sales-returns', icon: FileBarChart },
    ],
  },
  {
    labelKey: 'nav.group.procurement',
    icon: Truck,
    items: [
      { key: 'purchase-requests', labelKey: 'module.purchase-requests', icon: ClipboardList },
      { key: 'purchase-orders', labelKey: 'module.purchase-orders', icon: FileText },
      { key: 'goods-receipts', labelKey: 'module.goods-receipts', icon: PackageCheck },
      { key: 'purchase-invoices', labelKey: 'module.purchase-invoices', icon: Receipt },
      { key: 'purchase-credit-notes', labelKey: 'module.purchase-credit-notes', icon: FileMinus },
      { key: 'purchase-payments', labelKey: 'module.purchase-payments', icon: Wallet },
      { key: 'purchase-returns', labelKey: 'module.purchase-returns', icon: FileBarChart },
    ],
  },
  {
    labelKey: 'nav.group.inventory',
    icon: Boxes,
    items: [
      { key: 'stock-on-hand', labelKey: 'module.stock-on-hand', icon: Package },
      { key: 'stock-transfers', labelKey: 'module.stock-transfers', icon: ArrowLeftRight },
      { key: 'deliveries', labelKey: 'module.deliveries', icon: Truck },
      { key: 'inventory-adjustments', labelKey: 'module.inventory-adjustments', icon: ClipboardListIcon },
      { key: 'stock-moves', labelKey: 'module.stock-moves', icon: FileSpreadsheet },
    ],
  },
  {
    labelKey: 'nav.group.finance',
    icon: BookOpen,
    items: [
      { key: 'chart-of-accounts', labelKey: 'module.chart-of-accounts', icon: BookOpen },
      { key: 'journal-entries', labelKey: 'module.journal-entries', icon: FileText },
      { key: 'cost-centers', labelKey: 'module.cost-centers', icon: GitBranch },
      { key: 'fiscal-periods', labelKey: 'module.fiscal-periods', icon: CalendarClock },
      { key: 'bank-accounts', labelKey: 'module.bank-accounts', icon: Landmark },
      { key: 'safes', labelKey: 'module.safes', icon: PiggyBank },
    ],
  },
  {
    labelKey: 'nav.group.manufacturing',
    icon: Factory,
    items: [
      { key: 'boms', labelKey: 'module.boms', icon: ClipboardList },
      { key: 'work-centers', labelKey: 'module.work-centers', icon: Cog },
      { key: 'production-orders', labelKey: 'module.production-orders', icon: Factory },
    ],
  },
  {
    labelKey: 'nav.group.hr',
    icon: Users,
    items: [
      { key: 'employees', labelKey: 'module.employees', icon: Users },
      { key: 'departments', labelKey: 'module.departments', icon: UsersRound },
      { key: 'attendance', labelKey: 'module.attendance', icon: CalendarCheck },
      { key: 'leave-requests', labelKey: 'module.leave-requests', icon: CalendarDays },
      { key: 'payroll-runs', labelKey: 'module.payroll-runs', icon: Banknote },
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
    labelKey: 'nav.group.platform',
    icon: Settings,
    items: [
      { key: 'users', labelKey: 'module.users', icon: Users },
      { key: 'roles', labelKey: 'module.roles', icon: ShieldCheck },
      { key: 'audit-logs', labelKey: 'module.audit-logs', icon: ScrollText },
      { key: 'notifications', labelKey: 'module.notifications', icon: Bell },
      { key: 'settings', labelKey: 'module.settings', icon: Settings },
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
        <img src="/logo.png" alt="أورمنال" className="size-9 rounded-xl shadow-sm object-contain" />
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight truncate">{t('app.name')}</p>
          <p className="text-[10px] text-muted-foreground leading-tight truncate">{t('app.tagline')}</p>
        </div>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 min-h-0 px-2 py-3 scrollbar-thin">
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
