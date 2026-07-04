import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const active = searchParams.get('active')

    const where: any = {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { phone: { contains: q } },
        { contactName: { contains: q } },
        { email: { contains: q } },
      ]
    }
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false

    const [data, total] = await Promise.all([
      db.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { salesOrders: true, salesInvoices: true, salesPayments: true } },
        },
      }),
      db.client.count({ where }),
    ])

    const totalBalance = data.reduce((s, c) => s + (c.balance ?? 0), 0)
    const totalCreditLimit = data.reduce((s, c) => s + (c.creditLimit ?? 0), 0)
    const activeClients = data.filter((c) => c.active).length

    return NextResponse.json({
      data,
      total,
      stats: {
        totalBalance,
        totalCreditLimit,
        activeClients,
      },
    })
  } catch (e: any) {
    console.error('clients GET error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const count = await db.client.count()
    const code = body.code ?? `CL-${String(count + 1).padStart(4, '0')}`

    const created = await db.client.create({
      data: {
        code,
        name: body.name,
        contactName: body.contactName ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        taxNumber: body.taxNumber ?? null,
        openingBalance: Number(body.openingBalance ?? 0),
        balance: Number(body.openingBalance ?? 0),
        creditLimit: Number(body.creditLimit ?? 0),
        active: body.active ?? true,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('clients POST error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
