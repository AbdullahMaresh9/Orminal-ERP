// Visual metadata for account classes — colors, ring styles, etc.
import type { AccountClass } from './types'

export interface ClassVisual {
  labelAr: string
  labelEn: string
  color: string
  ring: string
  bg: string
  badgeClass: string
}

export const CLASS_META: Record<AccountClass, ClassVisual> = {
  asset: {
    labelAr: 'أصول',
    labelEn: 'Assets',
    color: 'text-blue-600 dark:text-blue-400',
    ring: 'ring-blue-200 dark:ring-blue-900',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  },
  liability: {
    labelAr: 'التزامات',
    labelEn: 'Liabilities',
    color: 'text-rose-600 dark:text-rose-400',
    ring: 'ring-rose-200 dark:ring-rose-900',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900',
  },
  equity: {
    labelAr: 'حقوق ملكية',
    labelEn: 'Equity',
    color: 'text-violet-600 dark:text-violet-400',
    ring: 'ring-violet-200 dark:ring-violet-900',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900',
  },
  revenue: {
    labelAr: 'إيرادات',
    labelEn: 'Revenue',
    color: 'text-emerald-600 dark:text-emerald-400',
    ring: 'ring-emerald-200 dark:ring-emerald-900',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  },
  cogs: {
    labelAr: 'تكلفة بضاعة مباعة',
    labelEn: 'COGS',
    color: 'text-orange-600 dark:text-orange-400',
    ring: 'ring-orange-200 dark:ring-orange-900',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900',
  },
  operating_expense: {
    labelAr: 'مصروفات تشغيلية',
    labelEn: 'Operating Exp.',
    color: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-200 dark:ring-amber-900',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  },
  other_income: {
    labelAr: 'إيرادات أخرى',
    labelEn: 'Other Income',
    color: 'text-sky-600 dark:text-sky-400',
    ring: 'ring-sky-200 dark:ring-sky-900',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900',
  },
  other_expense: {
    labelAr: 'مصروفات أخرى',
    labelEn: 'Other Expenses',
    color: 'text-red-600 dark:text-red-400',
    ring: 'ring-red-200 dark:ring-red-900',
    bg: 'bg-red-50 dark:bg-red-950/40',
    badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  },
}

export const ALL_CLASSES: AccountClass[] = [
  'asset', 'liability', 'equity', 'revenue', 'cogs',
  'operating_expense', 'other_income', 'other_expense',
]

export function getClassMeta(cls: string): ClassVisual {
  return CLASS_META[cls as AccountClass] ?? {
    labelAr: cls,
    labelEn: cls,
    color: 'text-muted-foreground',
    ring: 'ring-border',
    bg: 'bg-muted/40',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  }
}
