import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SYSTEM_ACCOUNTS } from '@/lib/erp/accounting-engine'

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
        { reason: { contains: q } },
        { note: { contains: q } },
        { supplier: { name: { contains: q } } },
        { supplier: { code: { contains: q } } },
      ]
    }

    const [data, total] = await Promise.all([
      db.purchaseCreditNote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, code: true, phone: true } },
        },
      }),
      db.purchaseCreditNote.count({ where }),
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

    const supplier = await db.supplier.findUnique({ where: { id: body.supplierId } })
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })

    // Credit note amount: either sum of items, or direct total
    let subtotal = 0
    let taxTotal = 0
    let total = Number(body.total) || 0

    if (Array.isArray(body.items) && body.items.length > 0) {
      subtotal = body.items.reduce((s: number, it: any) => {
        const qty = Number(it.quantity) || 0
        const price = Number(it.unitPrice) || 0
        const disc = Number(it.discount) || 0
        const tax = Number(it.taxRate) || 0
        const lineNet = Math.max(0, qty * price - disc)
        taxTotal += lineNet * (tax / 100)
        return s + lineNet
      }, 0)
      if (!total) total = subtotal + taxTotal
    } else {
      subtotal = total
    }

    const status = body.status || 'posted'
    const count = await db.purchaseCreditNote.count()
    const code = `PCN-${String(count + 1).padStart(4, '0')}`
    const issueDate = body.issueDate ? new Date(body.issueDate) : new Date()

    const created = await db.purchaseCreditNote.create({
      data: {
        code,
        supplierId: body.supplierId,
        invoiceId: body.invoiceId || null,
        status,
        issueDate,
        subtotal,
        taxTotal,
        total,
        reason: body.reason || null,
        note: body.note || null,
      },
      include: { supplier: true },
    })

    // Update supplier balance (reduce AP — credit note reduces what we owe)
    await db.supplier.update({
      where: { id: body.supplierId },
      data: { balance: { decrement: total } },
    })

    // Reverse original journal: Dr AP, Cr Purchases + Input VAT
    try {
      const codes = [SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE, SYSTEM_ACCOUNTS.PURCHASES, SYSTEM_ACCOUNTS.INPUT_VAT]
      const accounts = await db.account.findMany({ where: { code: { in: codes } } })
      const codeToId = new Map(accounts.map((a) => [a.code, a.id]))

      const apAcc = codeToId.get(SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE)
      const purAcc = codeToId.get(SYSTEM_ACCOUNTS.PURCHASES)
      const vatAcc = codeToId.get(SYSTEM_ACCOUNTS.INPUT_VAT)

      if (apAcc && purAcc && vatAcc) {
        const lines = [
          { accountId: apAcc, debit: total, credit: 0, description: `إشعار دائن ${code} - تخفيض ذمم دائنة` },
          { accountId: purAcc, debit: 0, credit: subtotal, description: `عكس مشتريات - إشعار دائن ${code}` },
          { accountId: vatAcc, debit: 0, credit: taxTotal, description: `عكس ضريبة مدخلات - إشعار دائن ${code}` },
        ]
        const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
        const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
        await db.journalEntry.create({
          data: {
            code: `JE-PCN-${code}`,
            date: issueDate,
            description: `إشعار دائن شراء ${code} - ${supplier.name}`,
            refType: 'purchase_credit_note',
            refId: created.id,
            status: 'posted',
            totalDebit,
            totalCredit,
            lines: { create: lines },
          },
        })
        for (const l of lines) {
          await db.account.update({
            where: { id: l.accountId },
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
