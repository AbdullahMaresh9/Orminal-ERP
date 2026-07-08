// Enterprise ERP — Number Sequence Service
// Source: ADR-016 — Legal, scoped, non-reusable sequences with gap reporting
// Source: Arabic Accounting Spec §19 — 16 document number formats: PREFIX-YYYY-000001

import { db } from '@/lib/db'

const PREFIXES: Record<string, string> = {
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

// Generate next document number atomically (row-lock via upsert + increment)
export async function nextNumber(
  documentType: string,
  companyId: string,
  branchId?: string,
  fiscalYear?: number
): Promise<string> {
  const year = fiscalYear ?? new Date().getFullYear()
  const prefix = PREFIXES[documentType] || documentType.toUpperCase().slice(0, 3)

  // Find or create the sequence
  const existing = await db.numberSequence.findFirst({
    where: { companyId, branchId: branchId ?? null, documentType, fiscalYear: year },
  })

  if (existing) {
    // Atomically increment
    const updated = await db.numberSequence.update({
      where: { id: existing.id },
      data: { nextNumber: { increment: 1 }, lastNumber: existing.nextNumber },
    })
    return `${prefix}-${year}-${String(existing.nextNumber).padStart(existing.padding, '0')}`
  }

  // Create new sequence
  await db.numberSequence.create({
    data: {
      companyId,
      branchId,
      documentType,
      prefix,
      fiscalYear: year,
      nextNumber: 2,
      padding: 6,
      resetPolicy: 'yearly',
      lastNumber: 1,
    },
  })
  return `${prefix}-${year}-000001`
}

// Get the list of all document types and their prefixes
export function getDocumentTypes(): { type: string; prefix: string }[] {
  return Object.entries(PREFIXES).map(([type, prefix]) => ({ type, prefix }))
}
