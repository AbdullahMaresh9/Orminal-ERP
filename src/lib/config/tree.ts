// =============================================================================
// System Configuration — navigation tree (14 domains)
//
// The tree is the single source of the configuration center's navigation.
// Every ConfigDef.category must be a leaf id here (governance-tested).
// Legacy categories from the old settings module map onto these leaves so no
// existing key is orphaned.
// =============================================================================

export interface ConfigTreeLeaf {
  id: string
  labelAr: string
  labelEn: string
  /** Legacy Setting.category values that live in this leaf. */
  legacyCategories?: string[]
}

export interface ConfigTreeSection {
  id: string
  labelAr: string
  labelEn: string
  icon: string // lucide icon name, resolved in the UI
  leaves: ConfigTreeLeaf[]
}

export const CONFIG_TREE: ConfigTreeSection[] = [
  {
    id: 'general',
    labelAr: 'الإعدادات العامة',
    labelEn: 'General Settings',
    icon: 'Settings',
    leaves: [
      { id: 'general', labelAr: 'المتغيرات العامة', labelEn: 'General Variables', legacyCategories: ['general'] },
      { id: 'company', labelAr: 'إعدادات المؤسسة', labelEn: 'Organization', legacyCategories: ['company'] },
      { id: 'currencies', labelAr: 'العملات', labelEn: 'Currencies' },
      { id: 'fiscal_periods', labelAr: 'الفترات المالية', labelEn: 'Fiscal Periods' },
      { id: 'payment_methods', labelAr: 'طرق الدفع', labelEn: 'Payment Methods' },
      { id: 'document_types', labelAr: 'أنواع المستندات', labelEn: 'Document Types' },
      { id: 'numbering', labelAr: 'تسلسلات أرقام المستندات', labelEn: 'Document Numbering', legacyCategories: ['numbering'] },
      { id: 'datetime', labelAr: 'التاريخ والوقت', labelEn: 'Date & Time' },
      { id: 'org_structure', labelAr: 'الهيكل التنظيمي', labelEn: 'Organizational Structure' },
    ],
  },
  {
    id: 'finance',
    labelAr: 'الحسابات والمالية',
    labelEn: 'Finance & Accounting',
    icon: 'BookOpen',
    leaves: [
      { id: 'accounting', labelAr: 'المحاسبة العامة', labelEn: 'General Accounting', legacyCategories: ['accounting'] },
      { id: 'posting', labelAr: 'الترحيل المحاسبي', labelEn: 'Posting Rules' },
      { id: 'opening_balances', labelAr: 'الأرصدة الافتتاحية', labelEn: 'Opening Balances' },
      { id: 'closing', labelAr: 'الإقفال المالي', labelEn: 'Financial Closing' },
      { id: 'multi_currency', labelAr: 'إعدادات العملات', labelEn: 'Multi-Currency' },
      { id: 'cost_centers', labelAr: 'مراكز التكلفة', labelEn: 'Cost Centers' },
      { id: 'analytic_accounts', labelAr: 'الحسابات التحليلية', labelEn: 'Analytic Accounts' },
    ],
  },
  {
    id: 'sales',
    labelAr: 'المبيعات',
    labelEn: 'Sales',
    icon: 'ShoppingCart',
    leaves: [
      { id: 'sales', labelAr: 'إعدادات المبيعات العامة', labelEn: 'General Sales', legacyCategories: ['sales'] },
      { id: 'payment_terms', labelAr: 'شروط الدفع', labelEn: 'Payment Terms' },
      { id: 'pricing', labelAr: 'مستويات الأسعار والخصومات', labelEn: 'Pricing & Discounts' },
      { id: 'credit', labelAr: 'حدود الائتمان', labelEn: 'Credit Limits' },
      { id: 'sales_invoicing', labelAr: 'إعدادات الفواتير', labelEn: 'Invoicing' },
    ],
  },
  {
    id: 'purchasing',
    labelAr: 'المشتريات',
    labelEn: 'Purchasing',
    icon: 'Truck',
    leaves: [
      { id: 'purchases', labelAr: 'إعدادات المشتريات العامة', labelEn: 'General Purchasing', legacyCategories: ['purchases'] },
      { id: 'purchase_matching', labelAr: 'المطابقة والتفاوت', labelEn: 'Matching & Variance' },
      { id: 'landed_costs', labelAr: 'مصاريف الشراء', labelEn: 'Landed Costs' },
      { id: 'supplier_pricing', labelAr: 'قوائم أسعار الموردين', labelEn: 'Supplier Price Lists' },
    ],
  },
  {
    id: 'inventory',
    labelAr: 'المخزون',
    labelEn: 'Inventory',
    icon: 'Boxes',
    leaves: [
      { id: 'inventory', labelAr: 'إعدادات المخزون', labelEn: 'Inventory Settings', legacyCategories: ['inventory'] },
      { id: 'valuation', labelAr: 'تقييم المخزون', labelEn: 'Inventory Valuation' },
      { id: 'warehouses_cfg', labelAr: 'المخازن ومجموعاتها', labelEn: 'Warehouses & Groups' },
      { id: 'uom', labelAr: 'وحدات القياس', labelEn: 'Units of Measure' },
      { id: 'items', labelAr: 'الأصناف ومجموعاتها', labelEn: 'Items & Groups' },
      { id: 'barcode', labelAr: 'الباركود والموازين', labelEn: 'Barcode & Scales' },
    ],
  },
  {
    id: 'tax',
    labelAr: 'الضرائب والفوترة الإلكترونية',
    labelEn: 'Tax & E-Invoicing',
    icon: 'FileText',
    leaves: [
      { id: 'taxes', labelAr: 'الضرائب والتصنيفات', labelEn: 'Taxes & Classifications' },
      { id: 'zatca', labelAr: 'الفوترة الإلكترونية', labelEn: 'E-Invoicing', legacyCategories: ['zatca'] },
    ],
  },
  {
    id: 'hr',
    labelAr: 'الموارد البشرية',
    labelEn: 'Human Resources',
    icon: 'Users',
    leaves: [
      { id: 'hr_general', labelAr: 'الإدارات والمسميات', labelEn: 'Departments & Positions' },
      { id: 'hr_time', labelAr: 'الدوام والإجازات', labelEn: 'Attendance & Leave' },
      { id: 'hr_payroll', labelAr: 'الرواتب والعقود', labelEn: 'Payroll & Contracts' },
    ],
  },
  {
    id: 'manufacturing',
    labelAr: 'التصنيع',
    labelEn: 'Manufacturing',
    icon: 'Factory',
    leaves: [
      { id: 'mfg_general', labelAr: 'إعدادات التصنيع', labelEn: 'Manufacturing Settings' },
      { id: 'mfg_accounts', labelAr: 'حسابات التصنيع', labelEn: 'Manufacturing Accounts' },
      { id: 'mfg_bom', labelAr: 'قوائم التركيب ومراكز العمل', labelEn: 'BOM & Work Centers' },
    ],
  },
  {
    id: 'pos',
    labelAr: 'نقاط البيع',
    labelEn: 'Point of Sale',
    icon: 'Store',
    leaves: [
      { id: 'pos_general', labelAr: 'إعدادات نقاط البيع', labelEn: 'POS Settings' },
      { id: 'pos_sessions', labelAr: 'الجلسات والفواتير', labelEn: 'Sessions & Invoices' },
      { id: 'pos_payments', labelAr: 'أنواع القبض والصرف', labelEn: 'Tender Types' },
    ],
  },
  {
    id: 'notifications',
    labelAr: 'الإشعارات والتواصل',
    labelEn: 'Notifications & Communication',
    icon: 'Bell',
    leaves: [
      { id: 'notifications', labelAr: 'الإشعارات', labelEn: 'Notifications', legacyCategories: ['notifications'] },
      { id: 'email', labelAr: 'البريد (SMTP)', labelEn: 'Email (SMTP)', legacyCategories: ['email'] },
      { id: 'sms_whatsapp', labelAr: 'SMS / WhatsApp', labelEn: 'SMS / WhatsApp' },
    ],
  },
  {
    id: 'printing',
    labelAr: 'الطباعة والمستندات',
    labelEn: 'Printing & Documents',
    icon: 'Printer',
    leaves: [
      { id: 'printing', labelAr: 'إعدادات الطباعة', labelEn: 'Print Settings', legacyCategories: ['printing'] },
      { id: 'export', labelAr: 'إعدادات التصدير', labelEn: 'Export Settings', legacyCategories: ['import_export'] },
    ],
  },
  {
    id: 'backup',
    labelAr: 'النسخ الاحتياطي',
    labelEn: 'Backup & Restore',
    icon: 'Database',
    leaves: [{ id: 'backup', labelAr: 'النسخ والاستعادة', labelEn: 'Backup & Restore', legacyCategories: ['backup'] }],
  },
  {
    id: 'integrations',
    labelAr: 'التكاملات والواجهات',
    labelEn: 'Integrations & APIs',
    icon: 'Plug',
    leaves: [
      { id: 'api_keys', labelAr: 'مفاتيح الواجهات', labelEn: 'API Keys' },
      { id: 'webhooks', labelAr: 'Webhooks', labelEn: 'Webhooks' },
      { id: 'ext_services', labelAr: 'الخدمات الخارجية', labelEn: 'External Services' },
    ],
  },
  {
    id: 'workflow',
    labelAr: 'سير العمل والاعتمادات',
    labelEn: 'Workflow & Approvals',
    icon: 'GitBranch',
    leaves: [
      { id: 'approvals', labelAr: 'سياسات ومسارات الاعتماد', labelEn: 'Approval Policies & Routes' },
      { id: 'security', labelAr: 'الأمان والجلسات', labelEn: 'Security & Sessions', legacyCategories: ['security', 'appearance'] },
    ],
  },
]

const leafIds = new Set<string>()
for (const s of CONFIG_TREE) for (const l of s.leaves) leafIds.add(l.id)

export function isValidCategory(id: string): boolean {
  return leafIds.has(id)
}

/** Map a legacy Setting.category to its tree leaf id (identity when already a leaf). */
export function resolveLegacyCategory(category: string): string {
  if (leafIds.has(category)) return category
  for (const s of CONFIG_TREE) {
    for (const l of s.leaves) {
      if (l.legacyCategories?.includes(category)) return l.id
    }
  }
  return 'general'
}
