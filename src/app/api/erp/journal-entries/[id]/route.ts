import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/erp/journal-entries/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const entry = await db.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true, nameAr: true, type: true } } },
          orderBy: { id: 'asc' },
        },
      },
    })
    if (!entry) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    return NextResponse.json(entry)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT — update entry header + replace lines (re-validate balanced)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.journalEntry.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

    const data: any = {}
    if (body.date) data.date = new Date(body.date)
    if (body.description !== undefined) data.description = body.description
    if (body.refType !== undefined) data.refType = body.refType
    if (body.status !== undefined) data.status = body.status

    // If lines provided, replace them
    if (Array.isArray(body.lines)) {
      const normalized = (body.lines as any[]).map((l) => ({
        accountCode: l.accountCode,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description ?? null,
      }))
      const totalDebit = normalized.reduce((s: number, l) => s + l.debit, 0)
      const totalCredit = normalized.reduce((s: number, l) => s + l.credit, 0)
      if (Math.abs(totalDebit - totalCredit) >= 0.01) {
        return NextResponse.json({ error: 'القيد غير متوازن' }, { status: 400 })
      }
      const codes = Array.from(new Set(normalized.map((l) => l.accountCode).filter(Boolean)))
      const accounts = await db.account.findMany({ where: { code: { in: codes } } })
      const codeToId = new Map(accounts.map((a) => [a.code, a.id]))
      for (const l of normalized) {
        if (!l.accountCode || !codeToId.has(l.accountCode)) {
          return NextResponse.json({ error: `حساب غير موجود: ${l.accountCode ?? '—'}` }, { status: 400 })
        }
      }
      data.totalDebit = totalDebit
      data.totalCredit = totalCredit
      // Replace: delete old lines then create new
      await db.journalLine.deleteMany({ where: { entryId: id } })
      await db.journalEntry.update({
        where: { id },
        data,
      })
      await db.journalLine.createMany({
        data: normalized.map((l) => ({
          entryId: id,
          accountId: codeToId.get(l.accountCode)!,
          debit: l.debit,
          credit: l.credit,
          description: l.description,
        })),
      })
    } else {
      await db.journalEntry.update({ where: { id }, data })
    }

    const updated = await db.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true, nameAr: true, type: true } } },
        },
      },
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE — cascade lines
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.journalEntry.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    // Prisma onDelete: Cascade on lines already configured, but explicit delete for safety
    await db.journalLine.deleteMany({ where: { entryId: id } })
    await db.journalEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
