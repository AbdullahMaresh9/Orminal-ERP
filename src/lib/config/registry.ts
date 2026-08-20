// =============================================================================
// System Configuration — THE registry (single source of truth)
//
// Every setting the system understands is declared here, exactly once.
// The configuration UI, the write-path validation, the seeding logic and the
// legacy DEFAULT_SETTINGS export are ALL derived from this file.
//
// Contract per entry (see types.ts):
// - `enforcement.status: 'enforced'` requires `readBy` files that really read
//   the key — verified literally by tests/config-governance.test.ts.
// - `enforcement.status: 'ui_only'` renders a visible badge in the UI so a
//   screen can never silently pretend to control behaviour it doesn't.
//
// Two legacy duplicate keys were removed (sales.invoicePrefix, purchases.poPrefix
// — superseded by numbering.invoicePrefix / numbering.poPrefix); the seeder
// deletes their DB rows. See DEPRECATED_KEYS.
// =============================================================================

import type { ConfigDef } from './types'
import { isValidCategory } from './tree'

/** Keys that used to exist and must be removed from the DB on sync. */
export const DEPRECATED_KEYS: string[] = ['sales.invoicePrefix', 'purchases.poPrefix']

export const CONFIG_REGISTRY: ConfigDef[] = [

  // === general ===
  { key: 'app.name', category: 'general', type: 'string', labelAr: 'اسم النظام', labelEn: 'System Name', defaultValue: 'أورمنال', scope: 'company', isSystem: true, sortOrder: 1, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'company.currency', category: 'general', type: 'string', labelAr: 'العملة الافتراضية', labelEn: 'Default Currency', defaultValue: 'SAR', scope: 'company', isSystem: true, sortOrder: 2, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'company.timezone', category: 'general', type: 'string', labelAr: 'المنطقة الزمنية', labelEn: 'Timezone', defaultValue: 'Asia/Riyadh', scope: 'company', isSystem: true, sortOrder: 3, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'app.supportPhone', category: 'general', type: 'string', labelAr: 'هاتف الدعم', labelEn: 'Support Phone', defaultValue: '', scope: 'company', sortOrder: 4, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'app.notifications', category: 'general', type: 'boolean', labelAr: 'تفعيل الإشعارات', labelEn: 'Enable Notifications', defaultValue: 'true', scope: 'company', sortOrder: 5, enforcement: { status: 'ui_only', plannedPhase: 2 } },

  // === company ===
  { key: 'company.name', category: 'company', type: 'string', labelAr: 'اسم الشركة', labelEn: 'Company Name', defaultValue: '', scope: 'company', isSystem: true, sortOrder: 1, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'company.legalName', category: 'company', type: 'string', labelAr: 'الاسم القانوني', labelEn: 'Legal Name', defaultValue: '', scope: 'company', sortOrder: 2, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'company.taxNumber', category: 'company', type: 'string', labelAr: 'الرقم الضريبي', labelEn: 'Tax Number', defaultValue: '', scope: 'company', isSystem: true, sortOrder: 3, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'company.crNumber', category: 'company', type: 'string', labelAr: 'الرقم التجاري', labelEn: 'Commercial Registration', defaultValue: '', scope: 'company', sortOrder: 4, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'company.phone', category: 'company', type: 'string', labelAr: 'الهاتف', labelEn: 'Phone', defaultValue: '', scope: 'company', sortOrder: 5, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'company.email', category: 'company', type: 'string', labelAr: 'البريد الإلكتروني', labelEn: 'Email', defaultValue: '', scope: 'company', sortOrder: 6, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'company.address', category: 'company', type: 'string', labelAr: 'العنوان', labelEn: 'Address', defaultValue: '', scope: 'company', sortOrder: 7, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'company.website', category: 'company', type: 'string', labelAr: 'الموقع الإلكتروني', labelEn: 'Website', defaultValue: '', scope: 'company', sortOrder: 8, enforcement: { status: 'ui_only', plannedPhase: 2 } },

  // === accounting ===
  { key: 'accounting.defaultTaxRate', category: 'accounting', type: 'number', labelAr: 'نسبة الضريبة الافتراضية %', labelEn: 'Default Tax Rate %', defaultValue: '15', scope: 'company', isSystem: true, sortOrder: 1, number: {"min":0,"max":100}, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'accounting.vatRate', category: 'accounting', type: 'number', labelAr: 'نسبة ضريبة القيمة المضافة %', labelEn: 'VAT Rate %', defaultValue: '15', scope: 'company', isSystem: true, sortOrder: 2, number: {"min":0,"max":100}, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'accounting.fiscalYearStartMonth', category: 'accounting', type: 'number', labelAr: 'بداية السنة المالية (شهر)', labelEn: 'Fiscal Year Start Month', defaultValue: '1', scope: 'company', isSystem: true, sortOrder: 3, number: {"min":1,"max":12,"integer":true}, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'accounting.baseCurrency', category: 'accounting', type: 'string', labelAr: 'العملة الأساسية', labelEn: 'Base Currency', defaultValue: 'SAR', scope: 'company', isSystem: true, sortOrder: 4, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'accounting.autoGroup', category: 'accounting', type: 'boolean', labelAr: 'تجميع القيود تلقائياً', labelEn: 'Auto Group Journal Entries', defaultValue: 'false', scope: 'company', sortOrder: 5, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'accounting.blockClosedPeriod', category: 'accounting', type: 'boolean', labelAr: 'منع الترحيل في فترة مغلقة', labelEn: 'Block Posting in Closed Period', defaultValue: 'true', scope: 'company', isSystem: true, sortOrder: 6, enforcement: { status: 'ui_only', plannedPhase: 2 } },

  // === inventory ===
  { key: 'inventory.defaultUnit', category: 'inventory', type: 'string', labelAr: 'الوحدة الافتراضية', labelEn: 'Default Unit', defaultValue: 'PCE', scope: 'company', sortOrder: 1, enforcement: { status: 'ui_only', plannedPhase: 4 } },
  { key: 'inventory.costingMethod', category: 'inventory', type: 'select', labelAr: 'طريقة التكلفة الافتراضية', labelEn: 'Default Costing Method', defaultValue: 'fifo', scope: 'company', options: ["fifo","avco","standard"], sortOrder: 2, enforcement: { status: 'ui_only', plannedPhase: 4 } },
  { key: 'inventory.lowStockAlert', category: 'inventory', type: 'boolean', labelAr: 'تنبيهات المخزون المنخفض', labelEn: 'Low Stock Alerts', defaultValue: 'true', scope: 'company', sortOrder: 3, number: {"min":0}, enforcement: { status: 'ui_only', plannedPhase: 4 } },
  { key: 'inventory.trackLots', category: 'inventory', type: 'boolean', labelAr: 'تتبع الدفعات (Lots)', labelEn: 'Track Lots', defaultValue: 'true', scope: 'company', sortOrder: 4, enforcement: { status: 'ui_only', plannedPhase: 4 } },
  { key: 'inventory.allowNegative', category: 'inventory', type: 'boolean', labelAr: 'السماح بمخزون سالب', labelEn: 'Allow Negative Stock', defaultValue: 'false', scope: 'company', sortOrder: 5, enforcement: { status: 'ui_only', plannedPhase: 4 } },

  // === sales ===
  { key: 'sales.defaultPaymentTerms', category: 'sales', type: 'string', labelAr: 'شروط الدفع الافتراضية', labelEn: 'Default Payment Terms', defaultValue: 'NET30', scope: 'company', sortOrder: 1, enforcement: { status: 'ui_only', plannedPhase: 3 } },
  { key: 'sales.quotationValidityDays', category: 'sales', type: 'number', labelAr: 'صلاحية عرض السعر (أيام)', labelEn: 'Quotation Validity (Days)', defaultValue: '30', scope: 'company', sortOrder: 2, number: {"min":0,"integer":true}, enforcement: { status: 'ui_only', plannedPhase: 3 } },
  { key: 'sales.maxDiscountPercent', category: 'sales', type: 'number', labelAr: 'حد الموافقة على الخصم %', labelEn: 'Max Discount Approval %', defaultValue: '15', scope: 'company', sortOrder: 3, number: {"min":0,"max":100}, enforcement: { status: 'ui_only', plannedPhase: 3 } },
  { key: 'sales.enableCreditLimit', category: 'sales', type: 'boolean', labelAr: 'تفعيل التحقق من حد الائتمان', labelEn: 'Enable Credit Limit Check', defaultValue: 'true', scope: 'company', sortOrder: 4, enforcement: { status: 'ui_only', plannedPhase: 3 } },
  { key: 'sales.preventBelowCost', category: 'sales', type: 'boolean', labelAr: 'منع البيع بسعر أقل من التكلفة', labelEn: 'Prevent Selling Below Cost', defaultValue: 'true', scope: 'company', sortOrder: 6, enforcement: { status: 'ui_only', plannedPhase: 3 } },

  // === purchases ===
  { key: 'purchases.enableThreeWayMatch', category: 'purchases', type: 'boolean', labelAr: 'تفعيل المطابقة الثلاثية', labelEn: 'Enable Three-Way Matching', defaultValue: 'true', scope: 'company', sortOrder: 1, enforcement: { status: 'ui_only', plannedPhase: 3 } },
  { key: 'purchases.allowedPriceVariance', category: 'purchases', type: 'number', labelAr: 'نسبة تفاوت الأسعار المسموحة %', labelEn: 'Allowed Price Variance %', defaultValue: '5', scope: 'company', sortOrder: 2, number: {"min":0,"max":100}, enforcement: { status: 'ui_only', plannedPhase: 3 } },
  { key: 'purchases.supplierApprovalMode', category: 'purchases', type: 'select', labelAr: 'وضع اعتماد الموردين', labelEn: 'Supplier Approval Mode', defaultValue: 'manual', scope: 'company', options: ["automatic","manual"], sortOrder: 4, enforcement: { status: 'ui_only', plannedPhase: 3 } },
  { key: 'purchases.postingMode', category: 'purchases', type: 'select', labelAr: 'وضع الترحيل', labelEn: 'Posting Mode', defaultValue: 'manual', scope: 'company', options: ["automatic","manual"], sortOrder: 5, enforcement: { status: 'ui_only', plannedPhase: 3 } },

  // === numbering ===
  { key: 'numbering.quotationPrefix', category: 'numbering', type: 'string', labelAr: 'بادئة عرض السعر', labelEn: 'Quotation Prefix', defaultValue: 'SQ', scope: 'branch', sortOrder: 1, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.salesOrderPrefix', category: 'numbering', type: 'string', labelAr: 'بادئة أمر البيع', labelEn: 'Sales Order Prefix', defaultValue: 'SO', scope: 'branch', sortOrder: 2, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.invoicePrefix', category: 'numbering', type: 'string', labelAr: 'بادئة الفاتورة', labelEn: 'Invoice Prefix', defaultValue: 'INV', scope: 'branch', sortOrder: 3, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.creditNotePrefix', category: 'numbering', type: 'string', labelAr: 'بادئة الإشعار الدائن', labelEn: 'Credit Note Prefix', defaultValue: 'CN', scope: 'branch', sortOrder: 4, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.poPrefix', category: 'numbering', type: 'string', labelAr: 'بادئة أمر الشراء', labelEn: 'PO Prefix', defaultValue: 'PO', scope: 'branch', sortOrder: 5, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.grnPrefix', category: 'numbering', type: 'string', labelAr: 'بادئة سند الاستلام', labelEn: 'GRN Prefix', defaultValue: 'GRN', scope: 'branch', sortOrder: 6, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.vendorBillPrefix', category: 'numbering', type: 'string', labelAr: 'بادئة فاتورة المورد', labelEn: 'Vendor Bill Prefix', defaultValue: 'VB', scope: 'branch', sortOrder: 7, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.paymentPrefix', category: 'numbering', type: 'string', labelAr: 'بادئة سند الصرف', labelEn: 'Payment Prefix', defaultValue: 'PV', scope: 'branch', sortOrder: 8, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.receiptPrefix', category: 'numbering', type: 'string', labelAr: 'بادئة سند القبض', labelEn: 'Receipt Prefix', defaultValue: 'RV', scope: 'branch', sortOrder: 9, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.journalPrefix', category: 'numbering', type: 'string', labelAr: 'بادئة القيد المحاسبي', labelEn: 'Journal Entry Prefix', defaultValue: 'JE', scope: 'branch', sortOrder: 10, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.transferPrefix', category: 'numbering', type: 'string', labelAr: 'بادئة التحويل', labelEn: 'Transfer Prefix', defaultValue: 'ST', scope: 'branch', sortOrder: 11, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.adjustmentPrefix', category: 'numbering', type: 'string', labelAr: 'بادئة التسوية', labelEn: 'Adjustment Prefix', defaultValue: 'IA', scope: 'branch', sortOrder: 12, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.productionPrefix', category: 'numbering', type: 'string', labelAr: 'بادئة أمر الإنتاج', labelEn: 'Production Order Prefix', defaultValue: 'MO', scope: 'branch', sortOrder: 13, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.payslipPrefix', category: 'numbering', type: 'string', labelAr: 'بادئة قسيمة الراتب', labelEn: 'Payslip Prefix', defaultValue: 'PAY', scope: 'branch', sortOrder: 14, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.numberLength', category: 'numbering', type: 'number', labelAr: 'عدد أرقام التسلسل', labelEn: 'Number Length', defaultValue: '6', scope: 'branch', sortOrder: 15, number: {"min":3,"max":10,"integer":true}, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },
  { key: 'numbering.resetPolicy', category: 'numbering', type: 'select', labelAr: 'سياسة إعادة الترقيم', labelEn: 'Reset Policy', defaultValue: 'yearly', scope: 'branch', options: ["yearly","monthly","never"], sortOrder: 16, enforcement: { status: 'enforced', readBy: ["src/lib/erp/number-sequence.ts"], effectAr: 'توليد أرقام المستندات', effectEn: 'Document number generation' } },

  // === printing ===
  { key: 'print.paperSize', category: 'printing', type: 'select', labelAr: 'حجم الورقة', labelEn: 'Paper Size', defaultValue: 'A4', scope: 'company', options: ["A4","Letter","Legal"], sortOrder: 1, enforcement: { status: 'enforced', readBy: ["src/lib/export.ts"], effectAr: 'المستندات والتقارير المطبوعة والمصدَّرة', effectEn: 'Printed & exported documents' } },
  { key: 'print.marginTop', category: 'printing', type: 'number', labelAr: 'هامش علوي (مم)', labelEn: 'Top Margin (mm)', defaultValue: '15', scope: 'company', sortOrder: 2, number: {"min":0,"max":100}, enforcement: { status: 'enforced', readBy: ["src/lib/export.ts"], effectAr: 'المستندات والتقارير المطبوعة والمصدَّرة', effectEn: 'Printed & exported documents' } },
  { key: 'print.marginBottom', category: 'printing', type: 'number', labelAr: 'هامش سفلي (مم)', labelEn: 'Bottom Margin (mm)', defaultValue: '15', scope: 'company', sortOrder: 3, number: {"min":0,"max":100}, enforcement: { status: 'enforced', readBy: ["src/lib/export.ts"], effectAr: 'المستندات والتقارير المطبوعة والمصدَّرة', effectEn: 'Printed & exported documents' } },
  { key: 'print.marginLeft', category: 'printing', type: 'number', labelAr: 'هامش يسار (مم)', labelEn: 'Left Margin (mm)', defaultValue: '18', scope: 'company', sortOrder: 4, number: {"min":0,"max":100}, enforcement: { status: 'enforced', readBy: ["src/lib/export.ts"], effectAr: 'المستندات والتقارير المطبوعة والمصدَّرة', effectEn: 'Printed & exported documents' } },
  { key: 'print.marginRight', category: 'printing', type: 'number', labelAr: 'هامش يمين (مم)', labelEn: 'Right Margin (mm)', defaultValue: '18', scope: 'company', sortOrder: 5, number: {"min":0,"max":100}, enforcement: { status: 'enforced', readBy: ["src/lib/export.ts"], effectAr: 'المستندات والتقارير المطبوعة والمصدَّرة', effectEn: 'Printed & exported documents' } },
  { key: 'print.showLogo', category: 'printing', type: 'boolean', labelAr: 'إظهار الشعار', labelEn: 'Show Logo', defaultValue: 'true', scope: 'company', sortOrder: 6, enforcement: { status: 'enforced', readBy: ["src/lib/export.ts"], effectAr: 'المستندات والتقارير المطبوعة والمصدَّرة', effectEn: 'Printed & exported documents' } },
  { key: 'print.showSignatures', category: 'printing', type: 'boolean', labelAr: 'إظهار التوقيعات', labelEn: 'Show Signatures', defaultValue: 'true', scope: 'company', sortOrder: 7, enforcement: { status: 'enforced', readBy: ["src/lib/export.ts"], effectAr: 'المستندات والتقارير المطبوعة والمصدَّرة', effectEn: 'Printed & exported documents' } },
  { key: 'print.showFooter', category: 'printing', type: 'boolean', labelAr: 'إظهار التذييل', labelEn: 'Show Footer', defaultValue: 'true', scope: 'company', sortOrder: 8, enforcement: { status: 'enforced', readBy: ["src/lib/export.ts"], effectAr: 'المستندات والتقارير المطبوعة والمصدَّرة', effectEn: 'Printed & exported documents' } },
  { key: 'print.fontFamily', category: 'printing', type: 'select', labelAr: 'عائلة الخط', labelEn: 'Font Family', defaultValue: 'Cairo', scope: 'company', options: ["Cairo","Tajawal","Segoe UI","Tahoma"], sortOrder: 9, enforcement: { status: 'enforced', readBy: ["src/lib/export.ts"], effectAr: 'المستندات والتقارير المطبوعة والمصدَّرة', effectEn: 'Printed & exported documents' } },
  { key: 'print.fontSize', category: 'printing', type: 'number', labelAr: 'حجم الخط', labelEn: 'Font Size', defaultValue: '13', scope: 'company', sortOrder: 10, number: {"min":8,"max":32,"integer":true}, enforcement: { status: 'enforced', readBy: ["src/lib/export.ts"], effectAr: 'المستندات والتقارير المطبوعة والمصدَّرة', effectEn: 'Printed & exported documents' } },
  { key: 'print.watermark', category: 'printing', type: 'string', labelAr: 'علامة مائية', labelEn: 'Watermark', defaultValue: '', scope: 'company', sortOrder: 11, enforcement: { status: 'enforced', readBy: ["src/lib/export.ts"], effectAr: 'المستندات والتقارير المطبوعة والمصدَّرة', effectEn: 'Printed & exported documents' } },
  { key: 'doc.headerTitle', category: 'printing', type: 'string', labelAr: 'عنوان الترويسة', labelEn: 'Header Title', defaultValue: '', scope: 'company', sortOrder: 12, enforcement: { status: 'enforced', readBy: ["src/lib/export.ts"], effectAr: 'المستندات والتقارير المطبوعة والمصدَّرة', effectEn: 'Printed & exported documents' } },
  { key: 'doc.footerNote', category: 'printing', type: 'string', labelAr: 'ملاحظة التذييل', labelEn: 'Footer Note', defaultValue: '', scope: 'company', sortOrder: 13, enforcement: { status: 'enforced', readBy: ["src/lib/export.ts"], effectAr: 'المستندات والتقارير المطبوعة والمصدَّرة', effectEn: 'Printed & exported documents' } },

  // === notifications ===
  { key: 'notify.inventory', category: 'notifications', type: 'boolean', labelAr: 'إشعارات المخزون', labelEn: 'Inventory Notifications', defaultValue: 'true', scope: 'company', sortOrder: 1, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'notify.sales', category: 'notifications', type: 'boolean', labelAr: 'إشعارات المبيعات', labelEn: 'Sales Notifications', defaultValue: 'true', scope: 'company', sortOrder: 2, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'notify.purchasing', category: 'notifications', type: 'boolean', labelAr: 'إشعارات المشتريات', labelEn: 'Purchasing Notifications', defaultValue: 'true', scope: 'company', sortOrder: 3, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'notify.finance', category: 'notifications', type: 'boolean', labelAr: 'إشعارات المالية', labelEn: 'Finance Notifications', defaultValue: 'true', scope: 'company', sortOrder: 4, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'notify.hr', category: 'notifications', type: 'boolean', labelAr: 'إشعارات الموارد البشرية', labelEn: 'HR Notifications', defaultValue: 'true', scope: 'company', sortOrder: 5, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'notify.system', category: 'notifications', type: 'boolean', labelAr: 'إشعارات النظام', labelEn: 'System Notifications', defaultValue: 'true', scope: 'company', sortOrder: 6, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'notify.emailEnabled', category: 'notifications', type: 'boolean', labelAr: 'تفعيل البريد الإلكتروني', labelEn: 'Enable Email', defaultValue: 'false', scope: 'company', sortOrder: 7, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'notify.smsEnabled', category: 'notifications', type: 'boolean', labelAr: 'تفعيل SMS', labelEn: 'Enable SMS', defaultValue: 'false', scope: 'company', sortOrder: 8, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'notify.reminderFrequency', category: 'notifications', type: 'number', labelAr: 'تكرار التذكير (دقيقة)', labelEn: 'Reminder Frequency (min)', defaultValue: '60', scope: 'company', sortOrder: 9, number: {"min":1,"integer":true}, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'notify.retryAttempts', category: 'notifications', type: 'number', labelAr: 'محاولات الإعادة', labelEn: 'Retry Attempts', defaultValue: '3', scope: 'company', sortOrder: 10, number: {"min":0,"max":10,"integer":true}, enforcement: { status: 'ui_only', plannedPhase: 5 } },

  // === zatca ===
  { key: 'zatca.enabled', category: 'zatca', type: 'boolean', labelAr: 'تفعيل الفوترة الإلكترونية', labelEn: 'Enable E-Invoicing', defaultValue: 'false', scope: 'company', sortOrder: 1, enforcement: { status: 'ui_only', plannedPhase: 3 } },
  { key: 'zatca.environment', category: 'zatca', type: 'select', labelAr: 'البيئة', labelEn: 'Environment', defaultValue: 'sandbox', scope: 'company', options: ["sandbox","production"], sortOrder: 2, enforcement: { status: 'ui_only', plannedPhase: 3 } },
  { key: 'zatca.apiKey', category: 'zatca', type: 'secret', labelAr: 'مفتاح API', labelEn: 'API Key', defaultValue: '', scope: 'company', sortOrder: 3, secret: true, enforcement: { status: 'ui_only', plannedPhase: 3 } },
  { key: 'zatca.vatRegistrationNumber', category: 'zatca', type: 'string', labelAr: 'الرقم الضريبي المسجل', labelEn: 'VAT Registration Number', defaultValue: '', scope: 'company', sortOrder: 4, enforcement: { status: 'ui_only', plannedPhase: 3 } },
  { key: 'zatca.enableQRCode', category: 'zatca', type: 'boolean', labelAr: 'تفعيل رمز QR', labelEn: 'Enable QR Code', defaultValue: 'true', scope: 'company', sortOrder: 5, enforcement: { status: 'ui_only', plannedPhase: 3 } },
  { key: 'zatca.enableDigitalSignature', category: 'zatca', type: 'boolean', labelAr: 'تفعيل التوقيع الرقمي', labelEn: 'Enable Digital Signature', defaultValue: 'false', scope: 'company', sortOrder: 6, enforcement: { status: 'ui_only', plannedPhase: 3 } },
  { key: 'zatca.certificateChain', category: 'zatca', type: 'secret', labelAr: 'سلسلة الشهادات', labelEn: 'Certificate Chain', defaultValue: '', scope: 'company', sortOrder: 7, secret: true, enforcement: { status: 'ui_only', plannedPhase: 3 } },

  // === email ===
  { key: 'email.smtpHost', category: 'email', type: 'string', labelAr: 'خادم SMTP', labelEn: 'SMTP Host', defaultValue: '', scope: 'company', sortOrder: 1, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'email.smtpPort', category: 'email', type: 'number', labelAr: 'المنفذ', labelEn: 'Port', defaultValue: '587', scope: 'company', sortOrder: 2, number: {"min":1,"max":65535,"integer":true}, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'email.smtpUsername', category: 'email', type: 'string', labelAr: 'اسم المستخدم', labelEn: 'Username', defaultValue: '', scope: 'company', sortOrder: 3, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'email.smtpPassword', category: 'email', type: 'secret', labelAr: 'كلمة المرور', labelEn: 'Password', defaultValue: '', scope: 'company', sortOrder: 4, secret: true, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'email.smtpEncryption', category: 'email', type: 'select', labelAr: 'التشفير', labelEn: 'Encryption', defaultValue: 'TLS', scope: 'company', options: ["SSL","TLS","None"], sortOrder: 5, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'email.senderEmail', category: 'email', type: 'string', labelAr: 'بريد المرسل', labelEn: 'Sender Email', defaultValue: '', scope: 'company', sortOrder: 6, enforcement: { status: 'ui_only', plannedPhase: 5 } },
  { key: 'email.senderName', category: 'email', type: 'string', labelAr: 'اسم المرسل', labelEn: 'Sender Name', defaultValue: 'أورمنال ERP', scope: 'company', sortOrder: 7, enforcement: { status: 'ui_only', plannedPhase: 5 } },

  // === export ===
  { key: 'import_export.defaultExportFormat', category: 'export', type: 'select', labelAr: 'تنسيق التصدير الافتراضي', labelEn: 'Default Export Format', defaultValue: 'csv', scope: 'company', options: ["csv","excel","pdf","json"], sortOrder: 1, enforcement: { status: 'ui_only', plannedPhase: 6 } },
  { key: 'import_export.defaultImportFormat', category: 'export', type: 'select', labelAr: 'تنسيق الاستيراد الافتراضي', labelEn: 'Default Import Format', defaultValue: 'csv', scope: 'company', options: ["csv","excel"], sortOrder: 2, enforcement: { status: 'ui_only', plannedPhase: 6 } },
  { key: 'import_export.encoding', category: 'export', type: 'select', labelAr: 'الترميز', labelEn: 'Encoding', defaultValue: 'UTF-8', scope: 'company', options: ["UTF-8","UTF-8 BOM","Windows-1256"], sortOrder: 3, enforcement: { status: 'ui_only', plannedPhase: 6 } },
  { key: 'import_export.delimiter', category: 'export', type: 'select', labelAr: 'الفاصل', labelEn: 'Delimiter', defaultValue: ',', scope: 'company', options: [",",";","\t","|"], sortOrder: 4, enforcement: { status: 'ui_only', plannedPhase: 6 } },
  { key: 'import_export.decimalSeparator', category: 'export', type: 'select', labelAr: 'فاصل العشرية', labelEn: 'Decimal Separator', defaultValue: '.', scope: 'company', options: [".",","], sortOrder: 5, enforcement: { status: 'ui_only', plannedPhase: 6 } },
  { key: 'import_export.dateFormat', category: 'export', type: 'select', labelAr: 'تنسيق التاريخ', labelEn: 'Date Format', defaultValue: 'YYYY-MM-DD', scope: 'company', options: ["YYYY-MM-DD","DD/MM/YYYY","MM/DD/YYYY"], sortOrder: 6, enforcement: { status: 'ui_only', plannedPhase: 6 } },

  // === backup ===
  { key: 'backup.frequency', category: 'backup', type: 'select', labelAr: 'تكرار النسخ الاحتياطي', labelEn: 'Backup Frequency', defaultValue: 'weekly', scope: 'company', options: ["daily","weekly","monthly","6months","yearly"], sortOrder: 1, enforcement: { status: 'ui_only', plannedPhase: 6 } },
  { key: 'backup.retentionPeriod', category: 'backup', type: 'number', labelAr: 'فترة الاحتفاظ (أيام)', labelEn: 'Retention Period (days)', defaultValue: '30', scope: 'company', sortOrder: 2, number: {"min":1,"integer":true}, enforcement: { status: 'ui_only', plannedPhase: 6 } },
  { key: 'backup.folder', category: 'backup', type: 'string', labelAr: 'مجلد النسخ الاحتياطي', labelEn: 'Backup Folder', defaultValue: '/backups', scope: 'company', sortOrder: 3, enforcement: { status: 'ui_only', plannedPhase: 6 } },
  { key: 'backup.compression', category: 'backup', type: 'boolean', labelAr: 'ضغط النسخة', labelEn: 'Compression', defaultValue: 'true', scope: 'company', sortOrder: 4, enforcement: { status: 'ui_only', plannedPhase: 6 } },
  { key: 'backup.encryption', category: 'backup', type: 'boolean', labelAr: 'تشفير النسخة', labelEn: 'Encryption', defaultValue: 'false', scope: 'company', sortOrder: 5, enforcement: { status: 'ui_only', plannedPhase: 6 } },
  { key: 'backup.autoCleanup', category: 'backup', type: 'boolean', labelAr: 'تنظيف تلقائي', labelEn: 'Automatic Cleanup', defaultValue: 'true', scope: 'company', sortOrder: 6, enforcement: { status: 'ui_only', plannedPhase: 6 } },

  // === security ===
  { key: 'security.passwordMinLength', category: 'security', type: 'number', labelAr: 'الحد الأدنى لطول كلمة المرور', labelEn: 'Password Min Length', defaultValue: '8', scope: 'global', sortOrder: 1, number: {"min":6,"max":128,"integer":true}, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'security.passwordRequireSpecial', category: 'security', type: 'boolean', labelAr: 'يتطلب أحرف خاصة', labelEn: 'Require Special Characters', defaultValue: 'true', scope: 'global', sortOrder: 2, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'security.sessionTimeout', category: 'security', type: 'number', labelAr: 'مدة انتهاء الجلسة (دقيقة)', labelEn: 'Session Timeout (min)', defaultValue: '60', scope: 'global', sortOrder: 3, number: {"min":5,"integer":true}, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'security.requireMFA', category: 'security', type: 'boolean', labelAr: 'إجبار المصادقة الثنائية', labelEn: 'Require MFA', defaultValue: 'false', scope: 'global', sortOrder: 4, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'security.maxLoginAttempts', category: 'security', type: 'number', labelAr: 'حد محاولات الدخول الفاشلة', labelEn: 'Max Failed Login Attempts', defaultValue: '5', scope: 'global', sortOrder: 5, number: {"min":1,"max":20,"integer":true}, enforcement: { status: 'ui_only', plannedPhase: 2 } },

  // === general ===
  { key: 'appearance.theme', category: 'general', type: 'select', labelAr: 'السمة', labelEn: 'Theme', defaultValue: 'light', scope: 'company', options: ["light","dark","system"], sortOrder: 1, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'appearance.language', category: 'general', type: 'select', labelAr: 'اللغة', labelEn: 'Language', defaultValue: 'ar', scope: 'company', options: ["ar","en"], sortOrder: 2, enforcement: { status: 'ui_only', plannedPhase: 2 } },
  { key: 'appearance.dateCalendar', category: 'general', type: 'select', labelAr: 'نظام التاريخ', labelEn: 'Date Calendar', defaultValue: 'gregorian', scope: 'company', options: ["gregorian","hijri"], sortOrder: 3, enforcement: { status: 'ui_only', plannedPhase: 2 } },
]

// === Derived lookups ===

const byKey = new Map<string, ConfigDef>()
for (const def of CONFIG_REGISTRY) {
  if (byKey.has(def.key)) throw new Error(`Duplicate config key in registry: ${def.key}`)
  if (!isValidCategory(def.category)) throw new Error(`Unknown category '${def.category}' for key ${def.key}`)
  byKey.set(def.key, def)
}

export function getConfigDef(key: string): ConfigDef | undefined {
  return byKey.get(key)
}

export function listConfigDefs(category?: string): ConfigDef[] {
  return category ? CONFIG_REGISTRY.filter((d) => d.category === category) : CONFIG_REGISTRY
}

export const SECRET_KEYS: ReadonlySet<string> = new Set(
  CONFIG_REGISTRY.filter((d) => d.secret).map((d) => d.key)
)
