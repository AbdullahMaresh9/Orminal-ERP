import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const search = url.searchParams.get('q') || ''
    const categoryId = url.searchParams.get('categoryId') || undefined
    const onlyActive = url.searchParams.get('active')

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameAr: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ]
    }
    if (categoryId) where.categoryId = categoryId
    if (onlyActive === 'true') where.active = true

    const [data, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { name: 'asc' },
        take: 200,
        include: {
          category: { select: { name: true, nameAr: true } },
          stockItems: { select: { quantity: true, storehouseId: true } },
        },
      }),
      db.product.count({ where }),
    ])

    // Flatten stock total per product
    const enriched = data.map((p) => ({
      ...p,
      stock: p.stockItems.reduce((s, si) => s + si.quantity, 0),
      stockItems: undefined,
    }))

    return NextResponse.json({ data: enriched, total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const count = await db.product.count()
    const sku = body.sku?.trim() || `PROD-${String(count + 1).padStart(4, '0')}`

    const created = await db.product.create({
      data: {
        sku,
        barcode: body.barcode || null,
        name: body.name,
        nameAr: body.nameAr || null,
        description: body.description || null,
        categoryId: body.categoryId || null,
        unit: body.unit || 'piece',
        costPrice: Number(body.costPrice ?? 0),
        salePrice: Number(body.salePrice ?? 0),
        taxRate: Number(body.taxRate ?? 15),
        minStock: Number(body.minStock ?? 0),
        type: body.type || 'product',
        image: body.image || null,
        active: body.active ?? true,
      },
      include: { category: true },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
