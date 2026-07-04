import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, code: true, status: true, total: true, paid: true, createdAt: true },
        },
        purchaseInvoices: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, code: true, status: true, total: true, paid: true, issueDate: true },
        },
        purchasePayments: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, code: true, amount: true, method: true, date: true, status: true, reference: true },
        },
        purchaseCreditNotes: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, code: true, total: true, status: true, issueDate: true, reason: true },
        },
      },
    })

    if (!supplier) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    return NextResponse.json(supplier)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

    const openingBalance = body.openingBalance !== undefined ? Number(body.openingBalance) : existing.openingBalance
    // Adjust balance by delta of opening balance change
    const delta = openingBalance - existing.openingBalance

    const updated = await db.supplier.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? existing.name,
        contactName: body.contactName ?? existing.contactName,
        phone: body.phone ?? existing.phone,
        email: body.email ?? existing.email,
        address: body.address ?? existing.address,
        taxNumber: body.taxNumber ?? existing.taxNumber,
        openingBalance,
        balance: existing.balance + delta,
        active: body.active !== undefined ? body.active : existing.active,
      },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.supplier.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
