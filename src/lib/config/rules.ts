// =============================================================================
// System Configuration — cross-setting consistency rules
//
// A rule sees the EFFECTIVE values (proposed changes merged over current
// values) and rejects the save when settings would contradict each other.
// Every referenced key must exist in the registry (governance-tested).
// =============================================================================

export interface ConfigRule {
  id: string
  /** Keys this rule reads. */
  keys: string[]
  /** Return null when consistent, or a bilingual error. */
  check(values: Record<string, string>): { messageAr: string; messageEn: string } | null
}

const bool = (v: string | undefined) => v === 'true' || v === '1'

export const CONFIG_RULES: ConfigRule[] = [
  {
    id: 'zatca-requires-vat-registration',
    keys: ['zatca.enabled', 'zatca.vatRegistrationNumber'],
    check(v) {
      if (bool(v['zatca.enabled']) && !v['zatca.vatRegistrationNumber']?.trim()) {
        return {
          messageAr: 'لا يمكن تفعيل الفوترة الإلكترونية بدون رقم التسجيل الضريبي',
          messageEn: 'E-invoicing cannot be enabled without a VAT registration number',
        }
      }
      return null
    },
  },
  {
    id: 'email-notifications-require-smtp',
    keys: ['notify.emailEnabled', 'email.smtpHost', 'email.senderEmail'],
    check(v) {
      if (bool(v['notify.emailEnabled']) && (!v['email.smtpHost']?.trim() || !v['email.senderEmail']?.trim())) {
        return {
          messageAr: 'تفعيل إشعارات البريد يتطلب ضبط خادم SMTP والبريد المُرسِل أولاً',
          messageEn: 'Email notifications require SMTP host and sender email to be configured first',
        }
      }
      return null
    },
  },
  {
    id: 'vat-rates-consistent',
    keys: ['accounting.defaultTaxRate', 'accounting.vatRate'],
    check(v) {
      const a = Number(v['accounting.defaultTaxRate'])
      const b = Number(v['accounting.vatRate'])
      if (!Number.isNaN(a) && !Number.isNaN(b) && a !== b) {
        return {
          messageAr: 'نسبة الضريبة الافتراضية ونسبة القيمة المضافة متعارضتان — وحّدهما أو اترك الافتراضية مساوية للقيمة المضافة',
          messageEn: 'Default tax rate and VAT rate conflict — align them',
        }
      }
      return null
    },
  },
  {
    id: 'negative-stock-vs-costing',
    keys: ['inventory.allowNegative', 'inventory.costingMethod'],
    check(v) {
      if (bool(v['inventory.allowNegative']) && v['inventory.costingMethod'] === 'fifo') {
        return {
          messageAr: 'لا يمكن السماح بالمخزون السالب مع تقييم الوارد أولاً (FIFO) — لا توجد طبقة تكلفة للسحب منها',
          messageEn: 'Negative stock cannot be combined with FIFO valuation — there is no cost layer to consume',
        }
      }
      return null
    },
  },
  {
    id: 'backup-retention-positive-when-scheduled',
    keys: ['backup.frequency', 'backup.retentionPeriod'],
    check(v) {
      if (v['backup.frequency'] && v['backup.frequency'] !== 'manual') {
        const days = Number(v['backup.retentionPeriod'])
        if (Number.isNaN(days) || days < 1) {
          return {
            messageAr: 'الجدولة التلقائية للنسخ الاحتياطي تتطلب مدة احتفاظ لا تقل عن يوم واحد',
            messageEn: 'Scheduled backups require a retention period of at least 1 day',
          }
        }
      }
      return null
    },
  },
]
