'use client'

import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { useT } from '@/lib/i18n/use-t'
import { ShieldCheck, Eye, X, Shield, Users, Crown, Code, Briefcase, Calculator, Wallet, UserCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

// 8 roles as columns
const ROLES = ['developer', 'owner', 'admin', 'manager', 'accountant', 'cashier', 'employee', 'viewer'] as const

// Modules as rows — each row has the permission per role
// Permissions: 'full' | 'view' | 'none'
type Perm = 'full' | 'view' | 'none'

const MODULE_ROWS: { key: string; label: string; perms: Record<typeof ROLES[number], Perm> }[] = [
  { key: 'dashboard', label: 'لوحة التحكم', perms: { developer: 'full', owner: 'full', admin: 'full', manager: 'full', accountant: 'full', cashier: 'view', employee: 'view', viewer: 'view' } },
  { key: 'pos', label: 'نقطة البيع', perms: { developer: 'full', owner: 'full', admin: 'full', manager: 'full', accountant: 'view', cashier: 'full', employee: 'view', viewer: 'none' } },
  { key: 'sales', label: 'المبيعات', perms: { developer: 'full', owner: 'full', admin: 'full', manager: 'full', accountant: 'view', cashier: 'full', employee: 'view', viewer: 'view' } },
  { key: 'purchases', label: 'المشتريات', perms: { developer: 'full', owner: 'full', admin: 'full', manager: 'full', accountant: 'view', cashier: 'none', employee: 'view', viewer: 'view' } },
  { key: 'inventory', label: 'المخزون', perms: { developer: 'full', owner: 'full', admin: 'full', manager: 'full', accountant: 'view', cashier: 'view', employee: 'full', viewer: 'view' } },
  { key: 'accounting', label: 'المحاسبة', perms: { developer: 'full', owner: 'full', admin: 'full', manager: 'view', accountant: 'full', cashier: 'none', employee: 'none', viewer: 'none' } },
  { key: 'finance', label: 'المالية', perms: { developer: 'full', owner: 'full', admin: 'full', manager: 'view', accountant: 'full', cashier: 'view', employee: 'none', viewer: 'none' } },
  { key: 'reports', label: 'التقارير', perms: { developer: 'full', owner: 'full', admin: 'full', manager: 'view', accountant: 'full', cashier: 'none', employee: 'none', viewer: 'view' } },
  { key: 'branches', label: 'الفروع', perms: { developer: 'full', owner: 'full', admin: 'full', manager: 'view', accountant: 'none', cashier: 'none', employee: 'none', viewer: 'none' } },
  { key: 'users', label: 'المستخدمون', perms: { developer: 'full', owner: 'full', admin: 'full', manager: 'view', accountant: 'none', cashier: 'none', employee: 'none', viewer: 'none' } },
  { key: 'settings', label: 'الإعدادات', perms: { developer: 'full', owner: 'full', admin: 'full', manager: 'view', accountant: 'view', cashier: 'none', employee: 'none', viewer: 'none' } },
  { key: 'audit', label: 'سجل التدقيق', perms: { developer: 'full', owner: 'full', admin: 'full', manager: 'none', accountant: 'none', cashier: 'none', employee: 'none', viewer: 'none' } },
]

const ROLE_ICONS: Record<typeof ROLES[number], React.ReactNode> = {
  developer: <Code className="size-4" />,
  owner: <Crown className="size-4" />,
  admin: <ShieldCheck className="size-4" />,
  manager: <Briefcase className="size-4" />,
  accountant: <Calculator className="size-4" />,
  cashier: <Wallet className="size-4" />,
  employee: <UserCheck className="size-4" />,
  viewer: <Eye className="size-4" />,
}

function PermIcon({ perm }: { perm: Perm }) {
  if (perm === 'full') return (
    <span title="وصول كامل" className="inline-flex items-center justify-center size-7 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
      <ShieldCheck className="size-4" />
    </span>
  )
  if (perm === 'view') return (
    <span title="عرض فقط" className="inline-flex items-center justify-center size-7 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
      <Eye className="size-4" />
    </span>
  )
  return (
    <span title="ممنوع" className="inline-flex items-center justify-center size-7 rounded-md bg-muted text-muted-foreground">
      <X className="size-4" />
    </span>
  )
}

export function RolesModule() {
  const { t } = useT()

  const fullCount = MODULE_ROWS.reduce((s, r) => s + ROLES.filter((role) => r.perms[role] === 'full').length, 0)
  const viewCount = MODULE_ROWS.reduce((s, r) => s + ROLES.filter((role) => r.perms[role] === 'view').length, 0)
  const noneCount = MODULE_ROWS.reduce((s, r) => s + ROLES.filter((role) => r.perms[role] === 'none').length, 0)

  return (
    <ModuleShell
      title={t('module.roles')}
      description="مصفوفة الأدوار والصلاحيات"
      icon={<Shield className="size-5" />}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="عدد الأدوار" value={String(ROLES.length)} icon={<Shield className="size-5" />} accent="emerald" />
        <KpiCard title="وصول كامل" value={String(fullCount)} icon={<ShieldCheck className="size-5" />} accent="teal" />
        <KpiCard title="عرض فقط" value={String(viewCount)} icon={<Eye className="size-5" />} accent="amber" />
        <KpiCard title="ممنوع" value={String(noneCount)} icon={<X className="size-5" />} accent="rose" />
      </div>

      {/* Roles legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {ROLES.map((r) => (
          <Card key={r} className="p-3 flex flex-col items-center text-center gap-1.5">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{ROLE_ICONS[r]}</div>
            <p className="text-xs font-semibold leading-tight">{t(`role.${r}` as any)}</p>
          </Card>
        ))}
      </div>

      {/* Permissions matrix */}
      <Card className="rounded-xl border">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">مصفوفة الصلاحيات</h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><PermIcon perm="full" /> وصول كامل</span>
            <span className="flex items-center gap-1"><PermIcon perm="view" /> عرض فقط</span>
            <span className="flex items-center gap-1"><PermIcon perm="none" /> ممنوع</span>
          </div>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px] sticky start-0 bg-card z-10">الوحدة</TableHead>
                {ROLES.map((r) => (
                  <TableHead key={r} className="text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{ROLE_ICONS[r]}</div>
                      <span className="text-[10px] font-semibold">{t(`role.${r}` as any)}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULE_ROWS.map((row) => (
                <TableRow key={row.key} className="hover:bg-muted/40">
                  <TableCell className="font-medium sticky start-0 bg-card z-10">{row.label}</TableCell>
                  {ROLES.map((role) => (
                    <TableCell key={role} className="text-center">
                      <div className="flex justify-center">
                        <PermIcon perm={row.perms[role]} />
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Role descriptions */}
      <Card className="rounded-xl border p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Users className="size-4" /> وصف الأدوار</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ROLES.map((r) => (
            <div key={r} className={cn('flex items-start gap-3 p-3 rounded-lg border bg-muted/30')}>
              <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">{ROLE_ICONS[r]}</div>
              <div>
                <p className="font-semibold text-sm">{t(`role.${r}` as any)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{ROLE_DESCRIPTIONS[r]}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </ModuleShell>
  )
}

const ROLE_DESCRIPTIONS: Record<typeof ROLES[number], string> = {
  developer: 'مطور النظام — صلاحية كاملة على جميع الوحدات والإعدادات والتطوير',
  owner: 'مالك النظام — صلاحية كاملة على جميع العمليات والتقارير والإعدادات',
  admin: 'مدير النظام — إدارة المستخدمين والفروع والإعدادات والوحدات',
  manager: 'مدير العمليات — إدارة المبيعات والمشتريات والمخزون وعرض المحاسبة',
  accountant: 'محاسب — إدارة القيود المحاسبية والتقارير المالية',
  cashier: 'أمين الصندوق — نقطة البيع والمقبوضات والمدفوعات',
  employee: 'موظف — إدارة المخزون والعمليات اليومية',
  viewer: 'مشاهد — عرض البيانات فقط دون تعديل',
}
