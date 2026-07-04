import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const product = await db.product.findUnique({
      where: { id },
      include: { category: true, stockItems: { include: { storehouse: true } } },
    })
    if (!product) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(product)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const updated = await db.product.update({
      where: { id },
      data: {
        sku: body.sku,
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
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.product.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
