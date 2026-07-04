import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const where: any = {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { nameAr: { contains: q } },
      ]
    }
    const categories = await db.category.findMany({
      where,
      include: {
        parent: true,
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: categories, total: categories.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const created = await db.category.create({
      data: {
        name: body.name,
        nameAr: body.nameAr || null,
        parentId: body.parentId || null,
        active: body.active ?? true,
      },
      include: { parent: true },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
