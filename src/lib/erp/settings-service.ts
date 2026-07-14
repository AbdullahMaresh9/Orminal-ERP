// =============================================================================
// Enterprise ERP — Configuration Service
// Cached settings reader with type-safe accessors
// =============================================================================

import { db } from '@/lib/db'

// In-memory cache (5 min TTL)
let cache: Map<string, { value: string; expires: number }> | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function loadAllSettings(): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  try {
    const settings = await db.setting.findMany()
    for (const s of settings) {
      result.set(s.key, s.value)
    }
  } catch {
    // DB not available (e.g. during build)
  }
  return result
}

async function getCache(): Promise<Map<string, string>> {
  if (!cache || Date.now() > (cache as any)._expires) {
    const settings = await loadAllSettings()
    const newCache = new Map<string, { value: string; expires: number }>()
    ;(newCache as any)._expires = Date.now() + CACHE_TTL
    for (const [key, value] of settings) {
      newCache.set(key, { value, expires: Date.now() + CACHE_TTL })
    }
    cache = newCache
    ;(cache as any)._expires = Date.now() + CACHE_TTL
  }

  // Convert to flat map
  const result = new Map<string, string>()
  if (cache) {
    for (const [key, entry] of cache) {
      if (key !== '_expires') {
        result.set(key, entry.value)
      }
    }
  }
  return result
}

function clearCache() {
  cache = null
}

// === Type-safe accessors ===

export async function getSetting(key: string, fallback: string = ''): Promise<string> {
  const settings = await getCache()
  return settings.get(key) ?? fallback
}

export async function getSettingNumber(key: string, fallback: number = 0): Promise<number> {
  const val = await getSetting(key)
  const num = Number(val)
  return isNaN(num) ? fallback : num
}

export async function getSettingBool(key: string, fallback: boolean = false): Promise<boolean> {
  const val = await getSetting(key)
  if (val === 'true' || val === '1') return true
  if (val === 'false' || val === '0') return false
  return fallback
}

export async function getSettingsByPrefix(prefix: string): Promise<Record<string, string>> {
  const settings = await getCache()
  const result: Record<string, string> = {}
  for (const [key, value] of settings) {
    if (key.startsWith(prefix)) {
      result[key] = value
    }
  }
  return result
}

export async function getSettingsByCategory(category: string): Promise<Record<string, string>> {
  try {
    const settings = await db.setting.findMany({ where: { category } })
    const result: Record<string, string> = {}
    for (const s of settings) result[s.key] = s.value
    return result
  } catch {
    return {}
  }
}

// === Write with audit ===

export async function saveSetting(
  key: string,
  value: string,
  userId?: string,
  reason?: string
): Promise<void> {
  const existing = await db.setting.findUnique({ where: { key } })
  const oldValue = existing?.value

  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })

  // Audit log
  if (oldValue !== value) {
    await db.settingAuditLog.create({
      data: {
        settingKey: key,
        oldValue: oldValue ?? null,
        newValue: value,
        userId: userId ?? null,
        category: existing?.category ?? 'general',
        reason: reason ?? null,
      },
    })
  }

  clearCache()
}

export async function saveSettings(
  settings: Record<string, string>,
  userId?: string,
  reason?: string
): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await saveSetting(key, value, userId, reason)
  }
}

// === Default settings definitions ===

export interface SettingDef {
  key: string
  value: string
  category: string
  label: string
  labelEn: string
  type: 'string' | 'number' | 'boolean' | 'select'
  defaultValue: string
  options?: string[]
  description?: string
  isSystem?: boolean
  sortOrder?: number
}

export const DEFAULT_SETTINGS: SettingDef[] = [
  // === General ===
  { key: 'app.name', value: 'أورمنال', category: 'general', label: 'اسم النظام', labelEn: 'System Name', type: 'string', defaultValue: 'أورمنال', isSystem: true, sortOrder: 1 },
  { key: 'company.currency', value: 'SAR', category: 'general', label: 'العملة الافتراضية', labelEn: 'Default Currency', type: 'string', defaultValue: 'SAR', isSystem: true, sortOrder: 2 },
  { key: 'company.timezone', value: 'Asia/Riyadh', category: 'general', label: 'المنطقة الزمنية', labelEn: 'Timezone', type: 'string', defaultValue: 'Asia/Riyadh', isSystem: true, sortOrder: 3 },
  { key: 'app.supportPhone', value: '', category: 'general', label: 'هاتف الدعم', labelEn: 'Support Phone', type: 'string', defaultValue: '', sortOrder: 4 },
  { key: 'app.notifications', value: 'true', category: 'general', label: 'تفعيل الإشعارات', labelEn: 'Enable Notifications', type: 'boolean', defaultValue: 'true', sortOrder: 5 },

  // === Company ===
  { key: 'company.name', value: 'مؤسسة أورمنال التجارية', category: 'company', label: 'اسم الشركة', labelEn: 'Company Name', type: 'string', defaultValue: '', isSystem: true, sortOrder: 1 },
  { key: 'company.legalName', value: '', category: 'company', label: 'الاسم القانوني', labelEn: 'Legal Name', type: 'string', defaultValue: '', sortOrder: 2 },
  { key: 'company.taxNumber', value: '300000000000003', category: 'company', label: 'الرقم الضريبي', labelEn: 'Tax Number', type: 'string', defaultValue: '', isSystem: true, sortOrder: 3 },
  { key: 'company.crNumber', value: '', category: 'company', label: 'الرقم التجاري', labelEn: 'Commercial Registration', type: 'string', defaultValue: '', sortOrder: 4 },
  { key: 'company.phone', value: '0112345678', category: 'company', label: 'الهاتف', labelEn: 'Phone', type: 'string', defaultValue: '', sortOrder: 5 },
  { key: 'company.email', value: 'info@ormenal.io', category: 'company', label: 'البريد الإلكتروني', labelEn: 'Email', type: 'string', defaultValue: '', sortOrder: 6 },
  { key: 'company.address', value: 'الرياض، المملكة العربية السعودية', category: 'company', label: 'العنوان', labelEn: 'Address', type: 'string', defaultValue: '', sortOrder: 7 },
  { key: 'company.website', value: '', category: 'company', label: 'الموقع الإلكتروني', labelEn: 'Website', type: 'string', defaultValue: '', sortOrder: 8 },

  // === Accounting ===
  { key: 'accounting.defaultTaxRate', value: '15', category: 'accounting', label: 'نسبة الضريبة الافتراضية %', labelEn: 'Default Tax Rate %', type: 'number', defaultValue: '15', isSystem: true, sortOrder: 1 },
  { key: 'accounting.vatRate', value: '15', category: 'accounting', label: 'نسبة ضريبة القيمة المضافة %', labelEn: 'VAT Rate %', type: 'number', defaultValue: '15', isSystem: true, sortOrder: 2 },
  { key: 'accounting.fiscalYearStartMonth', value: '1', category: 'accounting', label: 'بداية السنة المالية (شهر)', labelEn: 'Fiscal Year Start Month', type: 'number', defaultValue: '1', isSystem: true, sortOrder: 3 },
  { key: 'accounting.baseCurrency', value: 'SAR', category: 'accounting', label: 'العملة الأساسية', labelEn: 'Base Currency', type: 'string', defaultValue: 'SAR', isSystem: true, sortOrder: 4 },
  { key: 'accounting.autoGroup', value: 'false', category: 'accounting', label: 'تجميع القيود تلقائياً', labelEn: 'Auto Group Journal Entries', type: 'boolean', defaultValue: 'false', sortOrder: 5 },
  { key: 'accounting.blockClosedPeriod', value: 'true', category: 'accounting', label: 'منع الترحيل في فترة مغلقة', labelEn: 'Block Posting in Closed Period', type: 'boolean', defaultValue: 'true', isSystem: true, sortOrder: 6 },

  // === Inventory ===
  { key: 'inventory.defaultUnit', value: 'PCE', category: 'inventory', label: 'الوحدة الافتراضية', labelEn: 'Default Unit', type: 'string', defaultValue: 'PCE', sortOrder: 1 },
  { key: 'inventory.costingMethod', value: 'fifo', category: 'inventory', label: 'طريقة التكلفة الافتراضية', labelEn: 'Default Costing Method', type: 'select', defaultValue: 'fifo', options: ['fifo', 'avco', 'standard'], sortOrder: 2 },
  { key: 'inventory.lowStockAlert', value: 'true', category: 'inventory', label: 'تنبيهات المخزون المنخفض', labelEn: 'Low Stock Alerts', type: 'boolean', defaultValue: 'true', sortOrder: 3 },
  { key: 'inventory.trackLots', value: 'true', category: 'inventory', label: 'تتبع الدفعات (Lots)', labelEn: 'Track Lots', type: 'boolean', defaultValue: 'true', sortOrder: 4 },
  { key: 'inventory.allowNegative', value: 'false', category: 'inventory', label: 'السماح بمخزون سالب', labelEn: 'Allow Negative Stock', type: 'boolean', defaultValue: 'false', sortOrder: 5 },

  // === Sales ===
  { key: 'sales.defaultPaymentTerms', value: 'NET30', category: 'sales', label: 'شروط الدفع الافتراضية', labelEn: 'Default Payment Terms', type: 'string', defaultValue: 'NET30', sortOrder: 1 },
  { key: 'sales.quotationValidityDays', value: '30', category: 'sales', label: 'صلاحية عرض السعر (أيام)', labelEn: 'Quotation Validity (Days)', type: 'number', defaultValue: '30', sortOrder: 2 },
  { key: 'sales.maxDiscountPercent', value: '15', category: 'sales', label: 'حد الموافقة على الخصم %', labelEn: 'Max Discount Approval %', type: 'number', defaultValue: '15', sortOrder: 3 },
  { key: 'sales.enableCreditLimit', value: 'true', category: 'sales', label: 'تفعيل التحقق من حد الائتمان', labelEn: 'Enable Credit Limit Check', type: 'boolean', defaultValue: 'true', sortOrder: 4 },
  { key: 'sales.invoicePrefix', value: 'INV', category: 'sales', label: 'بادئة رقم الفاتورة', labelEn: 'Invoice Number Prefix', type: 'string', defaultValue: 'INV', sortOrder: 5 },
  { key: 'sales.preventBelowCost', value: 'true', category: 'sales', label: 'منع البيع بسعر أقل من التكلفة', labelEn: 'Prevent Selling Below Cost', type: 'boolean', defaultValue: 'true', sortOrder: 6 },

  // === Purchases ===
  { key: 'purchases.enableThreeWayMatch', value: 'true', category: 'purchases', label: 'تفعيل المطابقة الثلاثية', labelEn: 'Enable Three-Way Matching', type: 'boolean', defaultValue: 'true', sortOrder: 1 },
  { key: 'purchases.allowedPriceVariance', value: '5', category: 'purchases', label: 'نسبة تفاوت الأسعار المسموحة %', labelEn: 'Allowed Price Variance %', type: 'number', defaultValue: '5', sortOrder: 2 },
  { key: 'purchases.poPrefix', value: 'PO', category: 'purchases', label: 'بادئة أمر الشراء', labelEn: 'PO Prefix', type: 'string', defaultValue: 'PO', sortOrder: 3 },
  { key: 'purchases.supplierApprovalMode', value: 'manual', category: 'purchases', label: 'وضع اعتماد الموردين', labelEn: 'Supplier Approval Mode', type: 'select', defaultValue: 'manual', options: ['automatic', 'manual'], sortOrder: 4 },
  { key: 'purchases.postingMode', value: 'manual', category: 'purchases', label: 'وضع الترحيل', labelEn: 'Posting Mode', type: 'select', defaultValue: 'manual', options: ['automatic', 'manual'], sortOrder: 5 },

  // === Numbering ===
  { key: 'numbering.quotationPrefix', value: 'SQ', category: 'numbering', label: 'بادئة عرض السعر', labelEn: 'Quotation Prefix', type: 'string', defaultValue: 'SQ', sortOrder: 1 },
  { key: 'numbering.salesOrderPrefix', value: 'SO', category: 'numbering', label: 'بادئة أمر البيع', labelEn: 'Sales Order Prefix', type: 'string', defaultValue: 'SO', sortOrder: 2 },
  { key: 'numbering.invoicePrefix', value: 'INV', category: 'numbering', label: 'بادئة الفاتورة', labelEn: 'Invoice Prefix', type: 'string', defaultValue: 'INV', sortOrder: 3 },
  { key: 'numbering.creditNotePrefix', value: 'CN', category: 'numbering', label: 'بادئة الإشعار الدائن', labelEn: 'Credit Note Prefix', type: 'string', defaultValue: 'CN', sortOrder: 4 },
  { key: 'numbering.poPrefix', value: 'PO', category: 'numbering', label: 'بادئة أمر الشراء', labelEn: 'PO Prefix', type: 'string', defaultValue: 'PO', sortOrder: 5 },
  { key: 'numbering.grnPrefix', value: 'GRN', category: 'numbering', label: 'بادئة سند الاستلام', labelEn: 'GRN Prefix', type: 'string', defaultValue: 'GRN', sortOrder: 6 },
  { key: 'numbering.vendorBillPrefix', value: 'VB', category: 'numbering', label: 'بادئة فاتورة المورد', labelEn: 'Vendor Bill Prefix', type: 'string', defaultValue: 'VB', sortOrder: 7 },
  { key: 'numbering.paymentPrefix', value: 'PV', category: 'numbering', label: 'بادئة سند الصرف', labelEn: 'Payment Prefix', type: 'string', defaultValue: 'PV', sortOrder: 8 },
  { key: 'numbering.receiptPrefix', value: 'RV', category: 'numbering', label: 'بادئة سند القبض', labelEn: 'Receipt Prefix', type: 'string', defaultValue: 'RV', sortOrder: 9 },
  { key: 'numbering.journalPrefix', value: 'JE', category: 'numbering', label: 'بادئة القيد المحاسبي', labelEn: 'Journal Entry Prefix', type: 'string', defaultValue: 'JE', sortOrder: 10 },
  { key: 'numbering.transferPrefix', value: 'ST', category: 'numbering', label: 'بادئة التحويل', labelEn: 'Transfer Prefix', type: 'string', defaultValue: 'ST', sortOrder: 11 },
  { key: 'numbering.adjustmentPrefix', value: 'IA', category: 'numbering', label: 'بادئة التسوية', labelEn: 'Adjustment Prefix', type: 'string', defaultValue: 'IA', sortOrder: 12 },
  { key: 'numbering.productionPrefix', value: 'MO', category: 'numbering', label: 'بادئة أمر الإنتاج', labelEn: 'Production Order Prefix', type: 'string', defaultValue: 'MO', sortOrder: 13 },
  { key: 'numbering.payslipPrefix', value: 'PAY', category: 'numbering', label: 'بادئة قسيمة الراتب', labelEn: 'Payslip Prefix', type: 'string', defaultValue: 'PAY', sortOrder: 14 },
  { key: 'numbering.numberLength', value: '6', category: 'numbering', label: 'عدد أرقام التسلسل', labelEn: 'Number Length', type: 'number', defaultValue: '6', sortOrder: 15 },
  { key: 'numbering.resetPolicy', value: 'yearly', category: 'numbering', label: 'سياسة إعادة الترقيم', labelEn: 'Reset Policy', type: 'select', defaultValue: 'yearly', options: ['yearly', 'monthly', 'never'], sortOrder: 16 },

  // === Printing ===
  { key: 'print.paperSize', value: 'A4', category: 'printing', label: 'حجم الورقة', labelEn: 'Paper Size', type: 'select', defaultValue: 'A4', options: ['A4', 'Letter', 'Legal'], sortOrder: 1 },
  { key: 'print.marginTop', value: '15', category: 'printing', label: 'هامش علوي (مم)', labelEn: 'Top Margin (mm)', type: 'number', defaultValue: '15', sortOrder: 2 },
  { key: 'print.marginBottom', value: '15', category: 'printing', label: 'هامش سفلي (مم)', labelEn: 'Bottom Margin (mm)', type: 'number', defaultValue: '15', sortOrder: 3 },
  { key: 'print.marginLeft', value: '18', category: 'printing', label: 'هامش يسار (مم)', labelEn: 'Left Margin (mm)', type: 'number', defaultValue: '18', sortOrder: 4 },
  { key: 'print.marginRight', value: '18', category: 'printing', label: 'هامش يمين (مم)', labelEn: 'Right Margin (mm)', type: 'number', defaultValue: '18', sortOrder: 5 },
  { key: 'print.showLogo', value: 'true', category: 'printing', label: 'إظهار الشعار', labelEn: 'Show Logo', type: 'boolean', defaultValue: 'true', sortOrder: 6 },
  { key: 'print.showSignatures', value: 'true', category: 'printing', label: 'إظهار التوقيعات', labelEn: 'Show Signatures', type: 'boolean', defaultValue: 'true', sortOrder: 7 },
  { key: 'print.showFooter', value: 'true', category: 'printing', label: 'إظهار التذييل', labelEn: 'Show Footer', type: 'boolean', defaultValue: 'true', sortOrder: 8 },
  { key: 'print.fontFamily', value: 'Cairo', category: 'printing', label: 'عائلة الخط', labelEn: 'Font Family', type: 'select', defaultValue: 'Cairo', options: ['Cairo', 'Tajawal', 'Segoe UI', 'Tahoma'], sortOrder: 9 },
  { key: 'print.fontSize', value: '13', category: 'printing', label: 'حجم الخط', labelEn: 'Font Size', type: 'number', defaultValue: '13', sortOrder: 10 },
  { key: 'print.watermark', value: '', category: 'printing', label: 'علامة مائية', labelEn: 'Watermark', type: 'string', defaultValue: '', sortOrder: 11 },
  { key: 'doc.headerTitle', value: 'أورمنال — نظام إدارة موارد المؤسسات ERP', category: 'printing', label: 'عنوان الترويسة', labelEn: 'Header Title', type: 'string', defaultValue: '', sortOrder: 12 },
  { key: 'doc.footerNote', value: 'شكراً لتعاملكم معنا', category: 'printing', label: 'ملاحظة التذييل', labelEn: 'Footer Note', type: 'string', defaultValue: '', sortOrder: 13 },

  // === Notifications ===
  { key: 'notify.inventory', value: 'true', category: 'notifications', label: 'إشعارات المخزون', labelEn: 'Inventory Notifications', type: 'boolean', defaultValue: 'true', sortOrder: 1 },
  { key: 'notify.sales', value: 'true', category: 'notifications', label: 'إشعارات المبيعات', labelEn: 'Sales Notifications', type: 'boolean', defaultValue: 'true', sortOrder: 2 },
  { key: 'notify.purchasing', value: 'true', category: 'notifications', label: 'إشعارات المشتريات', labelEn: 'Purchasing Notifications', type: 'boolean', defaultValue: 'true', sortOrder: 3 },
  { key: 'notify.finance', value: 'true', category: 'notifications', label: 'إشعارات المالية', labelEn: 'Finance Notifications', type: 'boolean', defaultValue: 'true', sortOrder: 4 },
  { key: 'notify.hr', value: 'true', category: 'notifications', label: 'إشعارات الموارد البشرية', labelEn: 'HR Notifications', type: 'boolean', defaultValue: 'true', sortOrder: 5 },
  { key: 'notify.system', value: 'true', category: 'notifications', label: 'إشعارات النظام', labelEn: 'System Notifications', type: 'boolean', defaultValue: 'true', sortOrder: 6 },
  { key: 'notify.emailEnabled', value: 'false', category: 'notifications', label: 'تفعيل البريد الإلكتروني', labelEn: 'Enable Email', type: 'boolean', defaultValue: 'false', sortOrder: 7 },
  { key: 'notify.smsEnabled', value: 'false', category: 'notifications', label: 'تفعيل SMS', labelEn: 'Enable SMS', type: 'boolean', defaultValue: 'false', sortOrder: 8 },
  { key: 'notify.reminderFrequency', value: '60', category: 'notifications', label: 'تكرار التذكير (دقيقة)', labelEn: 'Reminder Frequency (min)', type: 'number', defaultValue: '60', sortOrder: 9 },
  { key: 'notify.retryAttempts', value: '3', category: 'notifications', label: 'محاولات الإعادة', labelEn: 'Retry Attempts', type: 'number', defaultValue: '3', sortOrder: 10 },

  // === ZATCA ===
  { key: 'zatca.enabled', value: 'false', category: 'zatca', label: 'تفعيل الفوترة الإلكترونية', labelEn: 'Enable E-Invoicing', type: 'boolean', defaultValue: 'false', sortOrder: 1 },
  { key: 'zatca.environment', value: 'sandbox', category: 'zatca', label: 'البيئة', labelEn: 'Environment', type: 'select', defaultValue: 'sandbox', options: ['sandbox', 'production'], sortOrder: 2 },
  { key: 'zatca.apiKey', value: '', category: 'zatca', label: 'مفتاح API', labelEn: 'API Key', type: 'string', defaultValue: '', sortOrder: 3 },
  { key: 'zatca.vatRegistrationNumber', value: '300000000000003', category: 'zatca', label: 'الرقم الضريبي المسجل', labelEn: 'VAT Registration Number', type: 'string', defaultValue: '', sortOrder: 4 },
  { key: 'zatca.enableQRCode', value: 'true', category: 'zatca', label: 'تفعيل رمز QR', labelEn: 'Enable QR Code', type: 'boolean', defaultValue: 'true', sortOrder: 5 },
  { key: 'zatca.enableDigitalSignature', value: 'false', category: 'zatca', label: 'تفعيل التوقيع الرقمي', labelEn: 'Enable Digital Signature', type: 'boolean', defaultValue: 'false', sortOrder: 6 },
  { key: 'zatca.certificateChain', value: '', category: 'zatca', label: 'سلسلة الشهادات', labelEn: 'Certificate Chain', type: 'string', defaultValue: '', sortOrder: 7 },

  // === Email / SMTP ===
  { key: 'email.smtpHost', value: '', category: 'email', label: 'خادم SMTP', labelEn: 'SMTP Host', type: 'string', defaultValue: '', sortOrder: 1 },
  { key: 'email.smtpPort', value: '587', category: 'email', label: 'المنفذ', labelEn: 'Port', type: 'number', defaultValue: '587', sortOrder: 2 },
  { key: 'email.smtpUsername', value: '', category: 'email', label: 'اسم المستخدم', labelEn: 'Username', type: 'string', defaultValue: '', sortOrder: 3 },
  { key: 'email.smtpPassword', value: '', category: 'email', label: 'كلمة المرور', labelEn: 'Password', type: 'string', defaultValue: '', sortOrder: 4 },
  { key: 'email.smtpEncryption', value: 'TLS', category: 'email', label: 'التشفير', labelEn: 'Encryption', type: 'select', defaultValue: 'TLS', options: ['SSL', 'TLS', 'None'], sortOrder: 5 },
  { key: 'email.senderEmail', value: '', category: 'email', label: 'بريد المرسل', labelEn: 'Sender Email', type: 'string', defaultValue: '', sortOrder: 6 },
  { key: 'email.senderName', value: 'أورمنال ERP', category: 'email', label: 'اسم المرسل', labelEn: 'Sender Name', type: 'string', defaultValue: 'أورمنال ERP', sortOrder: 7 },

  // === Import/Export ===
  { key: 'import_export.defaultExportFormat', value: 'csv', category: 'import_export', label: 'تنسيق التصدير الافتراضي', labelEn: 'Default Export Format', type: 'select', defaultValue: 'csv', options: ['csv', 'excel', 'pdf', 'json'], sortOrder: 1 },
  { key: 'import_export.defaultImportFormat', value: 'csv', category: 'import_export', label: 'تنسيق الاستيراد الافتراضي', labelEn: 'Default Import Format', type: 'select', defaultValue: 'csv', options: ['csv', 'excel'], sortOrder: 2 },
  { key: 'import_export.encoding', value: 'UTF-8', category: 'import_export', label: 'الترميز', labelEn: 'Encoding', type: 'select', defaultValue: 'UTF-8', options: ['UTF-8', 'UTF-8 BOM', 'Windows-1256'], sortOrder: 3 },
  { key: 'import_export.delimiter', value: ',', category: 'import_export', label: 'الفاصل', labelEn: 'Delimiter', type: 'select', defaultValue: ',', options: [',', ';', '\t', '|'], sortOrder: 4 },
  { key: 'import_export.decimalSeparator', value: '.', category: 'import_export', label: 'فاصل العشرية', labelEn: 'Decimal Separator', type: 'select', defaultValue: '.', options: ['.', ','], sortOrder: 5 },
  { key: 'import_export.dateFormat', value: 'YYYY-MM-DD', category: 'import_export', label: 'تنسيق التاريخ', labelEn: 'Date Format', type: 'select', defaultValue: 'YYYY-MM-DD', options: ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'], sortOrder: 6 },

  // === Backup ===
  { key: 'backup.frequency', value: 'weekly', category: 'backup', label: 'تكرار النسخ الاحتياطي', labelEn: 'Backup Frequency', type: 'select', defaultValue: 'weekly', options: ['daily', 'weekly', 'monthly', '6months', 'yearly'], sortOrder: 1 },
  { key: 'backup.retentionPeriod', value: '30', category: 'backup', label: 'فترة الاحتفاظ (أيام)', labelEn: 'Retention Period (days)', type: 'number', defaultValue: '30', sortOrder: 2 },
  { key: 'backup.folder', value: '/backups', category: 'backup', label: 'مجلد النسخ الاحتياطي', labelEn: 'Backup Folder', type: 'string', defaultValue: '/backups', sortOrder: 3 },
  { key: 'backup.compression', value: 'true', category: 'backup', label: 'ضغط النسخة', labelEn: 'Compression', type: 'boolean', defaultValue: 'true', sortOrder: 4 },
  { key: 'backup.encryption', value: 'false', category: 'backup', label: 'تشفير النسخة', labelEn: 'Encryption', type: 'boolean', defaultValue: 'false', sortOrder: 5 },
  { key: 'backup.autoCleanup', value: 'true', category: 'backup', label: 'تنظيف تلقائي', labelEn: 'Automatic Cleanup', type: 'boolean', defaultValue: 'true', sortOrder: 6 },

  // === Security ===
  { key: 'security.passwordMinLength', value: '8', category: 'security', label: 'الحد الأدنى لطول كلمة المرور', labelEn: 'Password Min Length', type: 'number', defaultValue: '8', sortOrder: 1 },
  { key: 'security.passwordRequireSpecial', value: 'true', category: 'security', label: 'يتطلب أحرف خاصة', labelEn: 'Require Special Characters', type: 'boolean', defaultValue: 'true', sortOrder: 2 },
  { key: 'security.sessionTimeout', value: '60', category: 'security', label: 'مدة انتهاء الجلسة (دقيقة)', labelEn: 'Session Timeout (min)', type: 'number', defaultValue: '60', sortOrder: 3 },
  { key: 'security.requireMFA', value: 'false', category: 'security', label: 'إجبار المصادقة الثنائية', labelEn: 'Require MFA', type: 'boolean', defaultValue: 'false', sortOrder: 4 },
  { key: 'security.maxLoginAttempts', value: '5', category: 'security', label: 'حد محاولات الدخول الفاشلة', labelEn: 'Max Failed Login Attempts', type: 'number', defaultValue: '5', sortOrder: 5 },

  // === Appearance ===
  { key: 'appearance.theme', value: 'light', category: 'appearance', label: 'السمة', labelEn: 'Theme', type: 'select', defaultValue: 'light', options: ['light', 'dark', 'system'], sortOrder: 1 },
  { key: 'appearance.language', value: 'ar', category: 'appearance', label: 'اللغة', labelEn: 'Language', type: 'select', defaultValue: 'ar', options: ['ar', 'en'], sortOrder: 2 },
  { key: 'appearance.dateCalendar', value: 'gregorian', category: 'appearance', label: 'نظام التاريخ', labelEn: 'Date Calendar', type: 'select', defaultValue: 'gregorian', options: ['gregorian', 'hijri'], sortOrder: 3 },
]

// Seed default settings
export async function seedDefaultSettings() {
  for (const def of DEFAULT_SETTINGS) {
    const existing = await db.setting.findUnique({ where: { key: def.key } })
    if (!existing) {
      await db.setting.create({
        data: {
          key: def.key,
          value: def.value,
          category: def.category,
          label: def.label,
          labelEn: def.labelEn,
          type: def.type,
          defaultValue: def.defaultValue,
          options: def.options ? JSON.stringify(def.options) : null,
          description: def.description ?? null,
          isSystem: def.isSystem ?? false,
          sortOrder: def.sortOrder ?? 0,
        },
      })
    }
  }
}
