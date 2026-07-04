'use client'

import { useQuery } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt, formatPercent, relativeTime } from '@/lib/format'
import { KpiCard } from '@/components/erp/kpi-card'
import { ModuleShell } from '@/components/erp/module-shell'
import { StatusBadge } from '@/components/erp/status-badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  LayoutDashboard, TrendingUp, ShoppingCart, Package, Wallet, Users, Truck,
  Boxes, ArrowDownLeft, ArrowUpRight, AlertTriangle, ArrowLeft,
} from 'lucide-react'
import { useNav } from '@/stores/nav-store'
import { Button } from '@/components/ui/button'

const PIE_COLORS = ['#16a34a', '#65a30d', '#ca8a04', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

export function DashboardModule() {
  const { t, locale } = useT()
  const { setActiveModule } = useNav()

  const { data, isLoading } = useQuery<any>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const r = await fetch('/api/erp/dashboard')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
    staleTime: 30 * 1000,
  })

  const k = data?.kpis

  return (
    <ModuleShell
      title={t('module.dashboard')}
      description={t('app.tagline')}
      icon={<LayoutDashboard className="size-5" />}
    >
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard
              title={t('kpi.totalSales')}
              value={formatCurrency(k?.totalSales)}
              delta={k?.salesDelta}
              deltaLabel={locale === 'ar' ? 'عن الشهر الماضي' : 'vs last month'}
              icon={<TrendingUp className="size-5" />}
              accent="emerald"
            />
            <KpiCard
              title={t('kpi.totalPurchases')}
              value={formatCurrency(k?.totalPurchases)}
              icon={<ShoppingCart className="size-5" />}
              accent="amber"
            />
            <KpiCard
              title={t('kpi.netProfit')}
              value={formatCurrency(k?.netProfit)}
              icon={<Wallet className="size-5" />}
              accent={k?.netProfit >= 0 ? 'teal' : 'rose'}
            />
            <KpiCard
              title={t('kpi.inventoryValue')}
              value={formatCurrency(k?.inventoryValue)}
              icon={<Boxes className="size-5" />}
              accent="violet"
            />
          </>
        )}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MiniStat label={t('kpi.totalClients')} value={formatInt(k?.totalClients)} icon={<Users className="size-4" />} onClick={() => setActiveModule('clients')} />
        <MiniStat label={t('kpi.totalSuppliers')} value={formatInt(k?.totalSuppliers)} icon={<Truck className="size-4" />} onClick={() => setActiveModule('suppliers')} />
        <MiniStat label={t('kpi.totalProducts')} value={formatInt(k?.totalProducts)} icon={<Package className="size-4" />} onClick={() => setActiveModule('products')} />
        <MiniStat label={t('kpi.receivables')} value={formatCurrency(k?.receivables)} icon={<ArrowDownLeft className="size-4" />} onClick={() => setActiveModule('clients')} accent="emerald" />
        <MiniStat label={t('kpi.payables')} value={formatCurrency(k?.payables)} icon={<ArrowUpRight className="size-4" />} onClick={() => setActiveModule('suppliers')} accent="rose" />
        <MiniStat label={t('kpi.netCashFlow')} value={formatCurrency(k?.netCashFlow)} icon={<Wallet className="size-4" />} onClick={() => setActiveModule('safes')} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales vs Purchases */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">{t('misc.salesVsPurchases')}</h3>
              <p className="text-xs text-muted-foreground">آخر 6 أشهر</p>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-72" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data?.months ?? []}>
                <defs>
                  <linearGradient id="g-sales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-purch" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 150)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} reversed={locale === 'ar'} />
                <YAxis tick={{ fontSize: 11 }} orientation={locale === 'ar' ? 'right' : 'left'} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ direction: locale === 'ar' ? 'rtl' : 'ltr', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => formatCurrency(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="sales" name={t('kpi.totalSales')} stroke="#16a34a" strokeWidth={2} fill="url(#g-sales)" />
                <Area type="monotone" dataKey="purchases" name={t('kpi.totalPurchases')} stroke="#d97706" strokeWidth={2} fill="url(#g-purch)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Pie: sales by category */}
        <Card className="p-5">
          <div className="mb-4">
            <h3 className="font-semibold">{t('misc.salesByCategory')}</h3>
            <p className="text-xs text-muted-foreground">توزيع المبيعات</p>
          </div>
          {isLoading ? (
            <Skeleton className="h-72" />
          ) : (data?.salesByCategory?.length ?? 0) === 0 ? (
            <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">{t('empty.noData')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data?.salesByCategory ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2}>
                  {(data?.salesByCategory ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ direction: locale === 'ar' ? 'rtl' : 'ltr', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Bottom row: top products, low stock, recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top products */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t('misc.topProducts')}</h3>
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => setActiveModule('products')}>
              {t('misc.viewAll')} <ArrowLeft className="size-3 rtl:rotate-180" />
            </Button>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)
            ) : (data?.topProducts ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('empty.noData')}</p>
            ) : (
              (data?.topProducts ?? []).map((p: any, i: number) => {
                const max = data.topProducts[0]?.revenue || 1
                const pct = (p.revenue / max) * 100
                return (
                  <div key={p.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate flex items-center gap-2">
                        <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                        {p.name}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{formatCurrency(p.revenue)}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                )
              })
            )}
          </div>
        </Card>

        {/* Low stock */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="size-4 text-amber-500" />
              {t('misc.lowStock')}
            </h3>
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => setActiveModule('products')}>
              {t('misc.viewAll')} <ArrowLeft className="size-3 rtl:rotate-180" />
            </Button>
          </div>
          <ScrollArea className="max-h-72">
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)
              ) : (data?.lowStock ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">المخزون بحالة جيدة ✓</p>
              ) : (
                (data?.lowStock ?? []).map((s: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.sku}</p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{formatInt(s.quantity)}</p>
                      <p className="text-[10px] text-muted-foreground">min: {formatInt(s.minStock)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Recent orders */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t('misc.recentOrders')}</h3>
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => setActiveModule('sales-orders')}>
              {t('misc.viewAll')} <ArrowLeft className="size-3 rtl:rotate-180" />
            </Button>
          </div>
          <ScrollArea className="max-h-72">
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)
              ) : (data?.recentOrders ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t('empty.noData')}</p>
              ) : (
                (data?.recentOrders ?? []).map((o: any) => (
                  <button
                    key={o.id}
                    onClick={() => setActiveModule('sales-orders')}
                    className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/60 transition-colors text-start"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{o.code} · {o.clientName}</p>
                      <p className="text-[10px] text-muted-foreground">{relativeTime(o.date)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold tabular-nums">{formatCurrency(o.total)}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </ModuleShell>
  )
}

function MiniStat({ label, value, icon, onClick, accent }: { label: string; value: string; icon: React.ReactNode; onClick?: () => void; accent?: 'emerald' | 'rose' }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-1.5 p-3 rounded-xl border bg-card hover:bg-muted/40 hover:shadow-sm transition-all text-start"
    >
      <div className={`size-8 rounded-lg flex items-center justify-center ${accent === 'emerald' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : accent === 'rose' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-primary/10 text-primary'}`}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        <p className="text-base font-bold tabular-nums">{value}</p>
      </div>
    </button>
  )
}
