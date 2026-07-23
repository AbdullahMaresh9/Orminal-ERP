'use client'

import { useQuery } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt, formatDate, relativeTime } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StatusBadge } from '@/components/erp/status-badge'
import {
  LayoutDashboard, TrendingUp, TrendingDown, Wallet, Users, Package,
  Boxes, AlertTriangle, ArrowUpRight, ArrowDownRight, Banknote,
} from 'lucide-react'
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  CartesianGrid, Pie, PieChart, Cell, Legend,
} from 'recharts'

const PIE_COLORS = ['#10b981', '#f59e0b', '#0d9488', '#8b5cf6', '#f43f5e', '#06b6d4']

interface DashboardData {
  kpis: {
    totalSales: number
    totalPurchases: number
    netProfit: number
    inventoryValue: number
    totalPartners: number
    totalCustomers: number
    totalSuppliers: number
    totalProducts: number
    totalReceipts: number
    totalPayments: number
    netCashFlow: number
    cashBalance: number
    receivables: number
    payables: number
  }
  months: { label: string; sales: number; purchases: number }[]
  topProducts: { id: string; name: string; sku: string; qty: number; revenue: number }[]
  lowStock: { name: string; sku: string; quantity: number; minStock: number }[]
  recentOrders: { id: string; code: string; clientName: string; total: number; status: string; date: string }[]
}

export function DashboardModule() {
  const { t, isRTL } = useT()
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const r = await fetch('/api/erp/dashboard')
      if (!r.ok) throw new Error('Failed to load dashboard')
      const json = await r.json()
      return json.data
    },
    staleTime: 30 * 1000,
  })

  const k = data?.kpis
  const months = data?.months ?? []
  const topProducts = data?.topProducts ?? []
  const lowStock = data?.lowStock ?? []
  const recentOrders = data?.recentOrders ?? []
  const pieData = topProducts.map((p) => ({ name: p.name, value: Math.round(p.revenue) }))

  return (
    <ModuleShell
      title={t('module.dashboard')}
      description="نظرة شاملة على أداء الأعمال والمالية والمخزون"
      icon={<LayoutDashboard className="size-5" />}
    >
      {isError ? (
        <Card className="p-10 text-center border-rose-200 bg-rose-50/50 dark:bg-rose-950/10">
          <AlertTriangle className="size-10 mx-auto text-rose-500 mb-3" />
          <p className="text-rose-700 dark:text-rose-400 font-semibold mb-1">تعذّر تحميل بيانات لوحة التحكم</p>
          <p className="text-sm text-muted-foreground mb-4">يرجى التحقق من تشغيل قاعدة البيانات والمحاولة مرة أخرى</p>
          <button onClick={() => refetch()} className="text-sm font-semibold text-primary hover:underline">
            إعادة المحاولة
          </button>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Main KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title={t('kpi.totalSales')}
              value={formatCurrency(k?.totalSales ?? 0)}
              icon={<TrendingUp className="size-5" />}
              accent="blue"
              delta={8.2}
              deltaLabel="هذا الشهر"
            />
            <KpiCard
              title={t('kpi.totalPurchases')}
              value={formatCurrency(k?.totalPurchases ?? 0)}
              icon={<TrendingDown className="size-5" />}
              accent="amber"
              delta={-3.1}
              deltaLabel="هذا الشهر"
            />
            <KpiCard
              title={t('kpi.netProfit')}
              value={formatCurrency(k?.netProfit ?? 0)}
              icon={<Wallet className="size-5" />}
              accent={(k?.netProfit ?? 0) >= 0 ? 'sky' : 'rose'}
              delta={12.4}
              deltaLabel="هذا الشهر"
            />
            <KpiCard
              title={t('kpi.inventoryValue')}
              value={formatCurrency(k?.inventoryValue ?? 0)}
              icon={<Boxes className="size-5" />}
              accent="violet"
              delta={4.7}
              deltaLabel="هذا الشهر"
            />
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MiniStat
              label={t('kpi.totalClients')}
              value={formatInt(k?.totalCustomers ?? 0)}
              icon={<Users className="size-4" />}
              accent="blue"
            />
            <MiniStat
              label={t('kpi.totalSuppliers')}
              value={formatInt(k?.totalSuppliers ?? 0)}
              icon={<Users className="size-4" />}
              accent="amber"
            />
            <MiniStat
              label={t('kpi.totalProducts')}
              value={formatInt(k?.totalProducts ?? 0)}
              icon={<Package className="size-4" />}
              accent="violet"
            />
            <MiniStat
              label={t('kpi.receivables')}
              value={formatCurrency(k?.receivables ?? 0)}
              icon={<ArrowUpRight className="size-4" />}
              accent="sky"
            />
            <MiniStat
              label={t('kpi.payables')}
              value={formatCurrency(k?.payables ?? 0)}
              icon={<ArrowDownRight className="size-4" />}
              accent="rose"
            />
            <MiniStat
              label="الرصيد النقدي"
              value={formatCurrency(k?.cashBalance ?? 0)}
              icon={<Banknote className="size-4" />}
              accent="blue"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-2">
            {/* Sales vs Purchases Area Chart */}
            <Card className="p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-base">{t('misc.salesVsPurchases')}</h3>
                  <p className="text-xs text-muted-foreground">آخر 6 أشهر</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-blue-500" />
                    المبيعات
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-amber-500" />
                    المشتريات
                  </span>
                </div>
              </div>
              <div className="h-64" dir="ltr">
                {isLoading ? (
                  <div className="h-full animate-pulse bg-muted/40 rounded" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={months} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="purchasesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: 'Cairo' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontFamily: 'Cairo', fontSize: 12 }}
                        formatter={(v: number) => formatCurrency(v)}
                      />
                      <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2.5} fill="url(#salesGrad)" name="المبيعات" />
                      <Area type="monotone" dataKey="purchases" stroke="#f59e0b" strokeWidth={2.5} fill="url(#purchasesGrad)" name="المشتريات" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Sales by Category Pie */}
            <Card className="p-5">
              <h3 className="font-semibold text-base mb-4">{t('misc.salesByCategory')}</h3>
              <div className="h-64" dir="ltr">
                {isLoading ? (
                  <div className="h-full animate-pulse bg-muted/40 rounded" />
                ) : pieData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    لا توجد بيانات
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontFamily: 'Cairo', fontSize: 12 }}
                        formatter={(v: number) => formatCurrency(v)}
                      />
                      <Legend
                        wrapperStyle={{ fontFamily: 'Cairo', fontSize: 11 }}
                        iconType="circle"
                        formatter={(value) => <span style={{ color: '#555' }}>{value.length > 14 ? value.slice(0, 14) + '…' : value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          {/* Lists row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Products */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base">{t('misc.topProducts')}</h3>
              </div>
              <div className="space-y-3">
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">{t('empty.noData')}</p>
                ) : (
                  topProducts.map((p, i) => {
                    const maxRev = topProducts[0]?.revenue || 1
                    const pct = Math.round((p.revenue / maxRev) * 100)
                    return (
                      <div key={p.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="size-5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>
                            <span className="truncate font-medium">{p.name}</span>
                          </div>
                          <span className="text-xs font-semibold tabular-nums" dir="ltr">{formatCurrency(p.revenue)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>

            {/* Low Stock */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  {t('misc.stockAlerts')}
                </h3>
              </div>
              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {lowStock.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">لا توجد تنبيهات</p>
                  ) : (
                    lowStock.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground font-mono" dir="ltr">{s.sku}</p>
                        </div>
                        <div className="text-end shrink-0">
                          <p className="text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums" dir="ltr">
                            {formatInt(s.quantity)} / {formatInt(s.minStock)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">متبقٍ / أدنى</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>

            {/* Recent Orders */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base">{t('misc.recentOrders')}</h3>
              </div>
              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {recentOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">{t('empty.noData')}</p>
                  ) : (
                    recentOrders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/40 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-mono font-semibold" dir="ltr">{o.code}</p>
                          <p className="text-xs text-muted-foreground truncate">{o.clientName}</p>
                          <p className="text-[10px] text-muted-foreground">{relativeTime(o.date)}</p>
                        </div>
                        <div className="text-end shrink-0 flex flex-col items-end gap-1">
                          <span className="text-sm font-bold tabular-nums" dir="ltr">{formatCurrency(o.total)}</span>
                          <StatusBadge status={o.status} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>
        </div>
      )}
    </ModuleShell>
  )
}

function MiniStat({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: 'blue' | 'amber' | 'rose' | 'violet' | 'sky' }) {
  const accentClasses = {
    emerald: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
    teal: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  }
  return (
    <Card className="p-3.5 flex items-center gap-3 hover:shadow-sm transition-shadow">
      <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${accentClasses[accent]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-bold tabular-nums truncate" dir="ltr">{value}</p>
      </div>
    </Card>
  )
}
