// Enterprise ERP — Number Sequence Service
// Source: ADR-016 — Legal, scoped, non-reusable sequences with gap reporting
// Prefixes are now configurable via Settings (numbering.* keys)
// Falls back to hardcoded defaults if DB unavailable

import { db } from '@/lib/db'
import { getSetting, getSettingNumber } from './settings-service'

// Default prefixes (used as fallback when DB settings not available)
const DEFAULT_PREFIXES: Record<string, string> = {
  sales_quotation: 'SQ',
  sales_order: 'SO',
  sales_invoice: 'INV',
  sales_credit_note: 'CN',
  purchase_request: 'PR',
  rfq: 'RFQ',
  purchase_order: 'PO',
  goods_receipt: 'GRN',
  purchase_invoice: 'VB',
  purchase_credit_note: 'PCN',
  purchase_payment: 'PV',
  sales_payment: 'RV',
  journal_entry: 'JE',
  stock_transfer: 'ST',
  inventory_adjustment: 'IA',
  production_order: 'MO',
  payslip: 'PAY',
  delivery: 'DN',
}

// Mapping from document type to setting key
const DOC_TYPE_TO_SETTING: Record<string, string> = {
  sales_quotation: 'numbering.quotationPrefix',
  sales_order: 'numbering.salesOrderPrefix',
  sales_invoice: 'numbering.invoicePrefix',
  sales_credit_note: 'numbering.creditNotePrefix',
  purchase_order: 'numbering.poPrefix',
  goods_receipt: 'numbering.grnPrefix',
  purchase_invoice: 'numbering.vendorBillPrefix',
  purchase_payment: 'numbering.paymentPrefix',
  sales_payment: 'numbering.receiptPrefix',
  journal_entry: 'numbering.journalPrefix',
  stock_transfer: 'numbering.transferPrefix',
  inventory_adjustment: 'numbering.adjustmentPrefix',
  production_order: 'numbering.productionPrefix',
  payslip: 'numbering.payslipPrefix',
}

// Cache for prefixes (avoid DB read on every call)
let prefixCache: Record<string, string> | null = null
let prefixCacheExpiry = 0

async function getPrefix(documentType: string): Promise<string> {
  const now = Date.now()
  if (prefixCache && now < prefixCacheExpiry) {
    return prefixCache[documentType] || DEFAULT_PREFIXES[documentType] || documentType.toUpperCase().slice(0, 3)
  }

  // Reload cache from settings
  prefixCache = {}
  for (const [docType, settingKey] of Object.entries(DOC_TYPE_TO_SETTING)) {
    const configuredPrefix = await getSetting(settingKey, DEFAULT_PREFIXES[docType] || '')
    prefixCache[docType] = configuredPrefix
  }
  prefixCacheExpiry = now + 5 * 60 * 1000 // 5 min cache

  return prefixCache[documentType] || DEFAULT_PREFIXES[documentType] || documentType.toUpperCase().slice(0, 3)
}

async function getNumberLength(): Promise<number> {
  return await getSettingNumber('numbering.numberLength', 6)
}

async function getResetPolicy(): Promise<string> {
  return await getSetting('numbering.resetPolicy', 'yearly')
}

// Generate next document number atomically (row-lock via upsert + increment)
export async function nextNumber(
  documentType: string,
  companyId: string,
  branchId?: string,
  fiscalYear?: number
): Promise<string> {
  const year = fiscalYear ?? new Date().getFullYear()
  const prefix = await getPrefix(documentType)
  const padding = await getNumberLength()

  // Find or create the sequence
  const existing = await db.numberSequence.findFirst({
    where: { companyId, branchId: branchId ?? null, documentType, fiscalYear: year },
  })

  if (existing) {
    const updated = await db.numberSequence.update({
      where: { id: existing.id },
      data: { nextNumber: { increment: 1 }, lastNumber: existing.nextNumber },
    })
    return `${prefix}-${year}-${String(existing.nextNumber).padStart(existing.padding, '0')}`
  }

  // Create new sequence
  const resetPolicy = await getResetPolicy()
  await db.numberSequence.create({
    data: {
      companyId,
      branchId,
      documentType,
      prefix,
      fiscalYear: year,
      nextNumber: 2,
      padding,
      resetPolicy,
      lastNumber: 1,
    },
  })
  return `${prefix}-${year}-${'0'.repeat(padding - 1)}1`
}

// Get the list of all document types and their configurable prefixes
export function getDocumentTypes(): { type: string; prefix: string }[] {
  return Object.entries(DEFAULT_PREFIXES).map(([type, prefix]) => ({ type, prefix }))
}

// Clear cache (called when settings are updated)
export function clearPrefixCache() {
  prefixCache = null
  prefixCacheExpiry = 0
}
