import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/erp/journal-entries — list with filters
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const refType = searchParams.get('refType')
    const q = searchParams.get('q')?.trim()
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: any = {}
    if (status && status !== 'all') where.status = status
    if (refType && refType !== 'all') where.refType = refType
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) where.date.lte = new Date(to)
    }
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { description: { contains: q } },
      ]
    }
    const data = await db.journalEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true, nameAr: true, type: true } } },
          orderBy: { id: 'asc' },
        },
      },
      take: 500,
    })
    return NextResponse.json({ data, total: data.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/erp/journal-entries — create with lines (validate balanced)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { date, description, refType, refId, status, lines } = body as {
      date?: string
      description?: string
      refType?: string
      refId?: string
      status?: string
      lines: { accountCode: string; accountCode?: string; debit?: number; credit?: number; description?: string }[]
    }

    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      return NextResponse.json({ error: 'يجب وجود بندين على الأقل' }, { status: 400 })
    }

    // Normalize line items: accept either accountCode or accountId
    const normalized = lines.map((l) => ({
      accountCode: l.accountCode ?? l.accountCode,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      description: l.description ?? null,
    }))

    // Validate balance
    const totalDebit = normalized.reduce((s, l) => s + l.debit, 0)
    const totalCredit = normalized.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      return NextResponse.json({ error: 'القيد غير متوازن' }, { status: 400 })
    }
    if (totalDebit <= 0) {
      return NextResponse.json({ error: 'يجب أن يكون إجمالي المدين أكبر من صفر' }, { status: 400 })
    }

    // Map accountCode → accountId
    const codes = Array.from(new Set(normalized.map((l) => l.accountCode).filter(Boolean)))
    const accounts = await db.account.findMany({ where: { code: { in: codes } } })
    const codeToId = new Map(accounts.map((a) => [a.code, a.id]))
    for (const l of normalized) {
      if (!l.accountCode || !codeToId.has(l.accountCode)) {
        return NextResponse.json({ error: `حساب غير موجود: ${l.accountCode ?? '—'}` }, { status: 400 })
      }
    }

    // Generate code: JE-XXXX
    const lastEntry = await db.journalEntry.findFirst({ orderBy: { code: 'desc' } })
    let nextNum = 1
    if (lastEntry?.code) {
      const m = lastEntry.code.match(/JE-(\d+)/i)
      if (m) nextNum = parseInt(m[1], 10) + 1
    }
    const code = `JE-${String(nextNum).padStart(4, '0')}`

    const created = await db.journalEntry.create({
      data: {
        code,
        date: date ? new Date(date) : new Date(),
        description: description ?? null,
        refType: refType ?? 'manual',
        refId: refId ?? null,
        status: status ?? 'posted',
        totalDebit,
        totalCredit,
        lines: {
          create: normalized.map((l) => ({
            accountId: codeToId.get(l.accountCode!)!,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
          })),
        },
      },
      include: {
        lines: { include: { account: { select: { id: true, code: true, name: true, nameAr: true, type: true } } } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
