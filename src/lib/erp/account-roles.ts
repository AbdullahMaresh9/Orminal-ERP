// Enterprise ERP — Account Role Catalog (Account Determination)
// ADR-CoA-001: Business modules NEVER hardcode GL account codes.
// Every posting resolves its accounts through a semantic ROLE which is mapped to a
// concrete GL account in the AccountRoleMapping table (configurable per company/branch).
//
// Adding a new posting rule = add a role here + map it in the UI. No code change in
// the posting sites, and no account code literals anywhere in business logic.

import type { AccountClass } from './account-classes'

export interface AccountRoleDef {
  code: AccountRole
  nameAr: string
  nameEn: string
  /** Which account classes are valid targets for this role (validation guard). */
  allowedClasses: AccountClass[]
  /** Grouping for the settings UI. */
  group: 'receivables_payables' | 'revenue' | 'cost' | 'inventory' | 'tax' | 'treasury' | 'equity' | 'payroll' | 'fixed_assets' | 'technical'
  /** Roles the posting engine cannot operate without. */
  required: boolean
  descriptionAr: string
}

export const ACCOUNT_ROLES = [
  // — Receivables / Payables —
  { code: 'CUSTOMER_RECEIVABLE', nameAr: 'ذمم العملاء المدينة', nameEn: 'Customer Receivable', allowedClasses: ['asset'], group: 'receivables_payables', required: true, descriptionAr: 'حساب الذمم المدينة المستخدم في فواتير المبيعات الآجلة' },
  { code: 'SUPPLIER_PAYABLE', nameAr: 'ذمم الموردين الدائنة', nameEn: 'Supplier Payable', allowedClasses: ['liability'], group: 'receivables_payables', required: true, descriptionAr: 'حساب الذمم الدائنة المستخدم في فواتير المشتريات الآجلة' },

  // — Revenue —
  { code: 'SALES', nameAr: 'إيرادات المبيعات', nameEn: 'Sales Revenue', allowedClasses: ['revenue'], group: 'revenue', required: true, descriptionAr: 'حساب الإيراد الرئيسي لفواتير المبيعات' },
  { code: 'SALES_RETURN', nameAr: 'مردودات المبيعات', nameEn: 'Sales Returns', allowedClasses: ['revenue'], group: 'revenue', required: true, descriptionAr: 'حساب مقابل للإيراد (contra-revenue) لمرتجعات المبيعات' },
  { code: 'SALES_DISCOUNT', nameAr: 'خصم المبيعات المسموح', nameEn: 'Sales Discount Allowed', allowedClasses: ['revenue', 'operating_expense'], group: 'revenue', required: false, descriptionAr: 'حساب مقابل للإيراد يستقبل الخصم على مستوى الفاتورة' },
  { code: 'OTHER_REVENUE', nameAr: 'إيرادات أخرى', nameEn: 'Other Revenue', allowedClasses: ['other_income', 'revenue'], group: 'revenue', required: false, descriptionAr: 'إيرادات غير تشغيلية' },

  // — Cost —
  { code: 'PURCHASE', nameAr: 'المشتريات', nameEn: 'Purchases', allowedClasses: ['cogs', 'asset'], group: 'cost', required: true, descriptionAr: 'حساب المشتريات (نظام دوري) أو المخزون (نظام دائم)' },
  { code: 'PURCHASE_RETURN', nameAr: 'مردودات المشتريات', nameEn: 'Purchase Returns', allowedClasses: ['cogs', 'asset'], group: 'cost', required: false, descriptionAr: 'حساب مقابل للمشتريات لمرتجعات المشتريات' },
  { code: 'COGS', nameAr: 'تكلفة البضاعة المباعة', nameEn: 'Cost of Goods Sold', allowedClasses: ['cogs'], group: 'cost', required: true, descriptionAr: 'تكلفة البضاعة المباعة في نظام الجرد الدائم' },
  { code: 'PRODUCTION_COST', nameAr: 'تكلفة الإنتاج', nameEn: 'Production Cost', allowedClasses: ['cogs'], group: 'cost', required: false, descriptionAr: 'تكاليف التصنيع' },
  { code: 'ROUNDING', nameAr: 'فروق التقريب', nameEn: 'Rounding Difference', allowedClasses: ['other_expense', 'other_income', 'operating_expense'], group: 'technical', required: false, descriptionAr: 'استقبال فروق التقريب لضمان توازن القيد' },

  // — Inventory —
  { code: 'INVENTORY', nameAr: 'المخزون', nameEn: 'Inventory', allowedClasses: ['asset'], group: 'inventory', required: true, descriptionAr: 'حساب المخزون الرئيسي' },
  { code: 'RAW_MATERIALS', nameAr: 'المواد الخام', nameEn: 'Raw Materials', allowedClasses: ['asset'], group: 'inventory', required: false, descriptionAr: 'مخزون المواد الخام' },
  { code: 'FINISHED_GOODS', nameAr: 'البضاعة الجاهزة', nameEn: 'Finished Goods', allowedClasses: ['asset'], group: 'inventory', required: false, descriptionAr: 'مخزون البضاعة تامة الصنع' },
  { code: 'WIP', nameAr: 'تحت التشغيل', nameEn: 'Work in Process', allowedClasses: ['asset'], group: 'inventory', required: false, descriptionAr: 'الإنتاج تحت التشغيل' },
  { code: 'GRNI', nameAr: 'بضاعة مستلمة غير مفوترة', nameEn: 'Goods Received Not Invoiced', allowedClasses: ['liability'], group: 'inventory', required: false, descriptionAr: 'حساب وسيط بين الاستلام والفاتورة' },
  { code: 'INVENTORY_GAIN', nameAr: 'أرباح تسوية المخزون', nameEn: 'Inventory Surplus Gain', allowedClasses: ['other_income', 'revenue'], group: 'inventory', required: false, descriptionAr: 'فائض الجرد' },
  { code: 'INVENTORY_LOSS', nameAr: 'خسائر تسوية المخزون', nameEn: 'Inventory Shortage Loss', allowedClasses: ['other_expense', 'operating_expense', 'cogs'], group: 'inventory', required: false, descriptionAr: 'عجز الجرد' },

  // — Tax —
  { code: 'TAX_RECEIVABLE', nameAr: 'ضريبة المدخلات', nameEn: 'Input Tax Receivable', allowedClasses: ['asset'], group: 'tax', required: true, descriptionAr: 'ضريبة القيمة المضافة القابلة للخصم على المشتريات' },
  { code: 'TAX_PAYABLE', nameAr: 'ضريبة المخرجات', nameEn: 'Output Tax Payable', allowedClasses: ['liability'], group: 'tax', required: true, descriptionAr: 'ضريبة القيمة المضافة المستحقة على المبيعات' },

  // — Treasury —
  { code: 'CASH', nameAr: 'النقدية', nameEn: 'Cash', allowedClasses: ['asset'], group: 'treasury', required: true, descriptionAr: 'حساب النقدية الافتراضي للصناديق' },
  { code: 'BANK', nameAr: 'البنك', nameEn: 'Bank', allowedClasses: ['asset'], group: 'treasury', required: false, descriptionAr: 'حساب البنك الافتراضي' },
  { code: 'FX_GAIN', nameAr: 'أرباح فروق العملة', nameEn: 'FX Gain', allowedClasses: ['other_income'], group: 'treasury', required: false, descriptionAr: 'فروق أسعار الصرف الدائنة' },
  { code: 'FX_LOSS', nameAr: 'خسائر فروق العملة', nameEn: 'FX Loss', allowedClasses: ['other_expense'], group: 'treasury', required: false, descriptionAr: 'فروق أسعار الصرف المدينة' },
  { code: 'SUSPENSE', nameAr: 'حساب معلق', nameEn: 'Suspense', allowedClasses: ['asset', 'liability'], group: 'technical', required: false, descriptionAr: 'حساب وسيط للعمليات غير المصنفة' },

  // — Equity —
  { code: 'RETAINED_EARNINGS', nameAr: 'الأرباح المحتجزة', nameEn: 'Retained Earnings', allowedClasses: ['equity'], group: 'equity', required: true, descriptionAr: 'الأرباح المدورة من سنوات سابقة' },
  { code: 'CURRENT_YEAR_EARNINGS', nameAr: 'أرباح السنة الحالية', nameEn: 'Current Year Earnings', allowedClasses: ['equity'], group: 'equity', required: false, descriptionAr: 'نتيجة أعمال السنة الحالية' },
  { code: 'OPENING_BALANCE', nameAr: 'حساب الأرصدة الافتتاحية', nameEn: 'Opening Balance', allowedClasses: ['equity'], group: 'equity', required: false, descriptionAr: 'الطرف المقابل لقيود الأرصدة الافتتاحية' },

  // — Payroll —
  { code: 'PAYROLL', nameAr: 'مصروف الرواتب', nameEn: 'Payroll Expense', allowedClasses: ['operating_expense'], group: 'payroll', required: false, descriptionAr: 'إجمالي مصروف الرواتب' },
  { code: 'SALARIES_PAYABLE', nameAr: 'رواتب مستحقة', nameEn: 'Salaries Payable', allowedClasses: ['liability'], group: 'payroll', required: false, descriptionAr: 'صافي الرواتب المستحقة للموظفين' },
  { code: 'PAYROLL_DEDUCTIONS_PAYABLE', nameAr: 'استقطاعات مستحقة', nameEn: 'Payroll Deductions Payable', allowedClasses: ['liability'], group: 'payroll', required: false, descriptionAr: 'استقطاعات الرواتب (تأمينات/ضرائب) المستحقة للجهات — التزام لا مصروف' },

  // — Fixed assets —
  { code: 'ASSET', nameAr: 'الأصول الثابتة', nameEn: 'Fixed Assets', allowedClasses: ['asset'], group: 'fixed_assets', required: false, descriptionAr: 'حساب الأصول الثابتة' },
  { code: 'DEPRECIATION', nameAr: 'مصروف الإهلاك', nameEn: 'Depreciation Expense', allowedClasses: ['operating_expense'], group: 'fixed_assets', required: false, descriptionAr: 'مصروف الإهلاك الدوري' },
  { code: 'ACCUMULATED_DEPRECIATION', nameAr: 'مجمع الإهلاك', nameEn: 'Accumulated Depreciation', allowedClasses: ['asset'], group: 'fixed_assets', required: false, descriptionAr: 'حساب مقابل للأصول (contra-asset)' },
] as const satisfies readonly AccountRoleDef[]

export type AccountRole =
  | 'CUSTOMER_RECEIVABLE' | 'SUPPLIER_PAYABLE'
  | 'SALES' | 'SALES_RETURN' | 'SALES_DISCOUNT' | 'OTHER_REVENUE'
  | 'PURCHASE' | 'PURCHASE_RETURN' | 'COGS' | 'PRODUCTION_COST' | 'ROUNDING'
  | 'INVENTORY' | 'RAW_MATERIALS' | 'FINISHED_GOODS' | 'WIP' | 'GRNI' | 'INVENTORY_GAIN' | 'INVENTORY_LOSS'
  | 'TAX_RECEIVABLE' | 'TAX_PAYABLE'
  | 'CASH' | 'BANK' | 'FX_GAIN' | 'FX_LOSS' | 'SUSPENSE'
  | 'RETAINED_EARNINGS' | 'CURRENT_YEAR_EARNINGS' | 'OPENING_BALANCE'
  | 'PAYROLL' | 'SALARIES_PAYABLE' | 'PAYROLL_DEDUCTIONS_PAYABLE'
  | 'ASSET' | 'DEPRECIATION' | 'ACCUMULATED_DEPRECIATION'

export const ACCOUNT_ROLE_CODES: readonly AccountRole[] = ACCOUNT_ROLES.map((r) => r.code)

const ROLE_INDEX = new Map<string, AccountRoleDef>(ACCOUNT_ROLES.map((r) => [r.code, r as AccountRoleDef]))

export function getRoleDef(role: string): AccountRoleDef | undefined {
  return ROLE_INDEX.get(role)
}

export function isValidRole(role: string): role is AccountRole {
  return ROLE_INDEX.has(role)
}

export function requiredRoles(): AccountRole[] {
  return ACCOUNT_ROLES.filter((r) => r.required).map((r) => r.code)
}

/** Guard: a role may only be mapped to an account of an allowed class. */
export function roleAcceptsClass(role: string, accountClass: string): boolean {
  const def = ROLE_INDEX.get(role)
  if (!def) return false
  return (def.allowedClasses as readonly string[]).includes(accountClass)
}
