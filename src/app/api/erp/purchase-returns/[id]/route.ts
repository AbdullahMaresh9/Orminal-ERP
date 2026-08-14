import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'
import { postJournalEntry, purchaseReturnPosting } from '@/lib/erp/accounting-engine'
import { nextNumber } from '@/lib/erp/number-sequence'

// GET /api/erp/purchase-returns/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.purchaseReturn.findUnique({
      where: { id },
      include: {
        partner: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Purchase return not found')

    let journalEntry: any = null
    if (item.journalEntryId) {
      journalEntry = await db.journalEntry.findUnique({
        where: { id: item.journalEntryId },
        include: {
          lines: { include: { account: { select: { code: true, nameAr: true, nameEn: true } } } },
        },
      })
    }

    return ok({ ...item, journalEntry })
  } catch (e: any) {
    return serverError(e.message)
  }
}

// PUT — update (only draft) OR action=approve|ship|debit|close|cancel
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const action = body.action

    const exists = await db.purchaseReturn.findUnique({ where: { id } })
    if (!exists) return notFound('Purchase return not found')

    if (action === 'approve') {
      if (exists.status !== 'draft') return badRequest('Only draft returns can be approved')
      const updated = await db.purchaseReturn.update({ where: { id }, data: { status: 'approved' } })
      return ok(updated)
    }
    if (action === 'ship') {
      if (exists.status !== 'approved') return badRequest('Only approved returns can be shipped')
      const updated = await db.purchaseReturn.update({ where: { id }, data: { status: 'shipped' } })
      return ok(updated)
    }
    if (action === 'debit') {
      // Issue actual Debit Note: post balanced accounting journal entry + update supplier balance
      if (exists.status === 'debited' || exists.status === 'closed' || exists.status === 'cancelled') {
        return badRequest('Return already debited or cancelled')
      }

      // Journal posting + credit note record + status + partner balance must all
      // be atomic to avoid half-applied debit notes.
      const result = await db.$transaction(async (tx) => {
        const je = await postJournalEntry(
          {
            companyId: exists.companyId,
            branchId: exists.branchId ?? undefined,
            journalType: 'purchase',
            postingDate: exists.date ? new Date(exists.date) : new Date(),
            description: `إشعار مدين — مرتجع مشتريات ${exists.code}`,
            refType: 'purchase_return',
            refId: exists.id,
            lines: purchaseReturnPosting({
              total: exists.total,
              subtotal: exists.subtotal,
              taxTotal: exists.taxTotal,
              partnerId: exists.partnerId,
            }),
            userId: body.userId,
          },
          tx
        )
        const journalEntryId = je.id

        const pcnCode = await nextNumber('purchase_credit_note', exists.companyId, exists.branchId ?? undefined)
        await tx.purchaseCreditNote.create({
          data: {
            companyId: exists.companyId,
            branchId: exists.branchId,
            code: pcnCode,
            partnerId: exists.partnerId,
            invoiceId: exists.originalInvoiceId ?? null,
            date: exists.date ? new Date(exists.date) : new Date(),
            reason: exists.reason || 'إشعار مدين عن مرتجع مشتريات',
            status: 'posted',
            subtotal: exists.subtotal,
            taxTotal: exists.taxTotal,
            total: exists.total,
            journalEntryId,
            notes: exists.notes || null,
          },
        })

        await tx.purchaseReturn.update({
          where: { id },
          data: { status: 'debited', journalEntryId },
        })

        // Decrease AP (partner balance — supplier is owed less)
        await tx.partner.update({
          where: { id: exists.partnerId },
          data: { currentBalance: { decrement: exists.total } },
        })

        return tx.purchaseReturn.findUnique({
          where: { id },
          include: { partner: true, lines: { include: { product: true } } },
        })
      })

      return ok(result)
    }
    if (action === 'close') {
      if (exists.status !== 'debited') return badRequest('Only debited returns can be closed')
      const updated = await db.purchaseReturn.update({ where: { id }, data: { status: 'closed' } })
      return ok(updated)
    }
    if (action === 'cancel') {
      if (exists.status === 'debited' || exists.status === 'closed') {
        return badRequest('Cannot cancel debited/closed returns')
      }
      const updated = await db.purchaseReturn.update({ where: { id }, data: { status: 'cancelled' } })
      return ok(updated)
    }

    // Default: simple field update (only allowed for draft status)
    if (exists.status !== 'draft') {
      return badRequest('لا يمكن تعديل المرتجع المرحّل أو المغلق أو الملغي. التعديل متاح للمسودات فقط.')
    }
    const { id: _id, lines, createdAt: _c, updatedAt: _u, status: _s, ...rest } = body

    if (rest.date) {
      rest.date = new Date(rest.date)
    }

    const targetInvoiceId = rest.originalInvoiceId ?? exists.originalInvoiceId
    const validLines = Array.isArray(lines) ? lines.filter((l: any) => l.productId && Number(l.quantity) > 0) : []

    // Validate quantities if linked to an original invoice
    if (targetInvoiceId) {
      const invoiceLines = await db.purchaseInvoiceLine.findMany({
        where: { invoiceId: targetInvoiceId },
      })
      const invQtyMap = new Map<string, number>()
      for (const il of invoiceLines) {
        invQtyMap.set(il.productId, (invQtyMap.get(il.productId) ?? 0) + il.quantity)
      }
      for (const l of validLines) {
        if (!invQtyMap.has(l.productId)) {
          return badRequest(`المنتج المحدد غير موجود في الفاتورة الأصلية المرتبطة`)
        }
        const maxQty = invQtyMap.get(l.productId) ?? 0
        const retQty = Number(l.quantity) || 0
        if (retQty > maxQty) {
          return badRequest(`ا��كمية المرجعة (${retQty}) تتجاوز الكمية المشتراة في الفاتورة الأصلية (${maxQty})`)
        }
      }
    }

    // Recalculate totals from lines
    let subtotal = 0, taxTotal = 0
    for (const l of validLines) {
      const lineSub = (Number(l.quantity) || 0) * (Number(l.unitCost) || 0)
      const lineTax = lineSub * ((Number(l.taxRate) || 0) / 100)
      subtotal += lineSub
      taxTotal += lineTax
    }
    const total = subtotal + taxTotal

    const updated = await db.$transaction(async (tx) => {
      // Update main record fields + totals
      await tx.purchaseReturn.update({
        where: { id },
        data: { ...rest, subtotal, taxTotal, total },
      })

      // Replace lines: delete old lines, create new lines if provided
      if (Array.isArray(lines)) {
        await tx.purchaseReturnLine.deleteMany({ where: { returnId: id } })
        if (validLines.length > 0) {
          await tx.purchaseReturnLine.createMany({
            data: validLines.map((l: any) => {
              const qty = Number(l.quantity) || 0
              const cost = Number(l.unitCost) || 0
              const tax = Number(l.taxRate) || 0
              return {
                returnId: id,
                productId: l.productId,
                quantity: qty,
                unitCost: cost,
                taxRate: tax,
                total: qty * cost * (1 + tax / 100),
              }
            }),
          })
        }
      }

      return tx.purchaseReturn.findUnique({
        where: { id },
        include: { partner: true, lines: { include: { product: true } } },
      })
    })

    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// DELETE — only draft (or cancelled if never posted)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.purchaseReturn.findUnique({ where: { id } })
    if (!exists) return notFound('Purchase return not found')
    if (exists.status !== 'draft') {
      return badRequest('لا يمكن حذف المرتجع المرحّل أو المعالج لحماية القيود المحاسبية ورصيد المخزون وحساب المورد.')
    }

    await db.$transaction(async (tx) => {
      await tx.purchaseReturnLine.deleteMany({ where: { returnId: id } })
      await tx.purchaseReturn.delete({ where: { id } })
    })

    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}

