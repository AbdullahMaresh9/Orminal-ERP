import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const storehouseId = searchParams.get('storehouseId') ?? ''
    const where: any = { type: 'in' }
    if (storehouseId && storehouseId !== 'all') where.storehouseId = storehouseId

    const movements = await db.stockMovement.findMany({
      where,
      include: { product: true, storehouse: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return NextResponse.json({ data: movements, total: movements.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // body: { storehouseId, supplierId?, refType?, refId?, note?, items: [{productId, quantity, batch?, expiry?, cost?}], createInvoice? }
    const storehouseId = body.storehouseId
    if (!storehouseId) return NextResponse.json({ error: 'storehouse required' }, { status: 400 })
    const items: any[] = body.items ?? []
    if (!items.length) return NextResponse.json({ error: 'items required' }, { status: 400 })

    const created = await db.$transaction(async (tx) => {
      const movements = []
      let subtotal = 0
      for (const it of items) {
        const qty = Number(it.quantity ?? 0)
        if (qty <= 0) continue
        const cost = Number(it.cost ?? 0)
        subtotal += qty * cost

        // Create stock movement (in)
        const m = await tx.stockMovement.create({
          data: {
            productId: it.productId,
            storehouseId,
            type: 'in',
            quantity: qty,
            refType: body.refType ?? 'purchase',
            refId: body.refId ?? null,
            note: body.note ?? null,
          },
          include: { product: true },
        })
        movements.push(m)

        // Upsert StockItem (unique on productId+storehouseId+batch)
        const batch = it.batch || null
        const existing = await tx.stockItem.findFirst({
          where: { productId: it.productId, storehouseId, batch },
        })
        if (existing) {
          await tx.stockItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: qty } },
          })
        } else {
          await tx.stockItem.create({
            data: {
              productId: it.productId,
              storehouseId,
              quantity: qty,
              batch,
              expiryDate: it.expiry ? new Date(it.expiry) : null,
            },
          })
        }

        // Optionally update product cost price
        if (cost > 0) {
          await tx.product.update({
            where: { id: it.productId },
            data: { costPrice: cost },
          })
        }
      }

      // Optional: create purchase invoice
      if (body.createInvoice && body.supplierId && subtotal > 0) {
        const count = await tx.purchaseInvoice.count()
        const code = `PINV-${String(count + 1).padStart(4, '0')}`
        const taxRate = 15
        const taxTotal = subtotal * (taxRate / 100)
        await tx.purchaseInvoice.create({
          data: {
            code,
            supplierId: body.supplierId,
            status: 'posted',
            issueDate: new Date(),
            subtotal,
            taxTotal,
            total: subtotal + taxTotal,
            note: body.note ?? 'توريد مخزون',
            items: {
              create: items.filter(i => Number(i.quantity) > 0).map(i => ({
                productId: i.productId,
                quantity: Number(i.quantity),
                unitPrice: Number(i.cost ?? 0),
                taxRate,
                total: Number(i.quantity) * Number(i.cost ?? 0),
              })),
            },
          },
        })
      }

      return movements
    })

    return NextResponse.json({ data: created, count: created.length }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
