import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createPurchaseJournalEntry } from '@/lib/erp/accounting-engine'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')

    const where: any = {}
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { note: { contains: q } },
        { supplier: { name: { contains: q } } },
        { supplier: { code: { contains: q } } },
      ]
    }

    const [data, total] = await Promise.all([
      db.purchaseInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, code: true, phone: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, nameAr: true, sku: true, unit: true } },
            },
          },
        },
      }),
      db.purchaseInvoice.count({ where }),
    ])

    return NextResponse.json({ data, total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.supplierId) return NextResponse.json({ error: 'المورد مطلوب' }, { status: 400 })
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'يجب إضافة عنصر واحد على الأقل' }, { status: 400 })
    }

    const supplier = await db.supplier.findUnique({ where: { id: body.supplierId } })
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })

    const items = body.items.map((it: any) => {
      const quantity = Number(it.quantity) || 0
      const unitPrice = Number(it.unitPrice) || 0
      const discount = Number(it.discount) || 0
      const taxRate = Number(it.taxRate) || 0
      const lineNet = Math.max(0, quantity * unitPrice - discount)
      const lineTax = lineNet * (taxRate / 100)
      const total = lineNet + lineTax
      return { productId: it.productId, quantity, unitPrice, discount, taxRate, total }
    })

    const subtotal = items.reduce((s: number, it: any) => s + (it.quantity * it.unitPrice - it.discount), 0)
    const taxTotal = items.reduce((s: number, it: any) => s + ((it.quantity * it.unitPrice - it.discount) * (it.taxRate / 100)), 0)
    const invoiceDiscount = Number(body.discount) || 0
    const total = Math.max(0, subtotal + taxTotal - invoiceDiscount)
    const status = body.status || 'posted'

    const count = await db.purchaseInvoice.count()
    const code = `PINV-${String(count + 1).padStart(4, '0')}`

    const issueDate = body.issueDate ? new Date(body.issueDate) : new Date()
    const dueDate = body.dueDate ? new Date(body.dueDate) : null

    const created = await db.purchaseInvoice.create({
      data: {
        code,
        supplierId: body.supplierId,
        branchId: body.branchId || null,
        orderId: body.orderId || null,
        status,
        issueDate,
        dueDate,
        subtotal,
        taxTotal,
        discount: invoiceDiscount,
        total,
        paid: 0,
        note: body.note || null,
        items: { create: items.map((it: any) => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice, discount: it.discount, taxRate: it.taxRate, total: it.total })) },
      },
      include: {
        supplier: true,
        items: { include: { product: { select: { id: true, name: true, nameAr: true, sku: true, unit: true } } } },
      },
    })

    // Update supplier balance (AP increases)
    await db.supplier.update({
      where: { id: body.supplierId },
      data: { balance: { increment: total } },
    })

    // Auto journal entry: Dr Purchases + Input VAT, Cr AP
    try {
      const entryInput = createPurchaseJournalEntry({
        total,
        taxTotal,
        subtotal: subtotal - invoiceDiscount,
        isCash: false,
        refId: created.id,
        description: `فاتورة شراء ${code} - ${supplier.name}`,
      })

      const codes = [...new Set(entryInput.lines.map((l) => l.accountCode))]
      const accounts = await db.account.findMany({ where: { code: { in: codes } } })
      const codeToId = new Map(accounts.map((a) => [a.code, a.id]))

      const validLines = entryInput.lines
        .map((l) => ({ ...l, accountId: codeToId.get(l.accountCode) }))
        .filter((l) => l.accountId)

      if (validLines.length === entryInput.lines.length) {
        const totalDebit = validLines.reduce((s, l) => s + l.debit, 0)
        const totalCredit = validLines.reduce((s, l) => s + l.credit, 0)
        await db.journalEntry.create({
          data: {
            code: `JE-PINV-${code}`,
            date: issueDate,
            description: entryInput.description,
            refType: 'purchase_invoice',
            refId: created.id,
            status: 'posted',
            totalDebit,
            totalCredit,
            lines: {
              create: validLines.map((l) => ({
                accountId: l.accountId!,
                debit: l.debit,
                credit: l.credit,
                description: l.description,
              })),
            },
          },
        })
        for (const l of validLines) {
          await db.account.update({
            where: { id: l.accountId! },
            data: { balance: { increment: l.debit - l.credit } },
          })
        }
      }
    } catch (journalErr) {
      console.error('Journal creation failed:', journalErr)
    }

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
