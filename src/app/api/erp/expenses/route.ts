import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const q = url.searchParams.get('q')

    const where: any = {}
    
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) where.date.lte = new Date(to)
    }

    if (q) {
      where.OR = [
        { code: { contains: q } },
        { payee: { contains: q } },
        { category: { contains: q } },
        { note: { contains: q } },
        { reference: { contains: q } },
      ]
    }

    const [data, total] = await Promise.all([
      db.expense.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          bankAccount: { select: { id: true, nameAr: true, bankName: true } },
          safe: { select: { id: true, nameAr: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.expense.count({ where }),
    ])

    // Map nameAr to name for frontend safe mapping if needed
    const mappedData = data.map((item: any) => ({
      ...item,
      bankAccount: item.bankAccount ? {
        id: item.bankAccount.id,
        name: item.bankAccount.nameAr,
        bankName: item.bankAccount.bankName,
      } : null,
      safe: item.safe ? {
        id: item.safe.id,
        name: item.safe.nameAr,
        code: item.safe.code,
      } : null,
    }))

    return list(mappedData, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (body.amount === undefined || body.amount === null) return badRequest('amount is required')
    if (!body.category) return badRequest('category is required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    const amount = Number(body.amount)
    const count = await db.expense.count()
    const code = `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

    const expense = await db.expense.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        date: body.date ? new Date(body.date) : new Date(),
        amount,
        payee: body.payee || '',
        category: body.category,
        reference: body.reference || '',
        note: body.note || '',
        status: body.status ?? 'posted',
        bankAccountId: body.bankAccountId || null,
        safeId: body.safeId || null,
      },
    })

    // Deduct balance
    if (body.status !== 'draft') {
      if (body.bankAccountId) {
        await db.bankAccount.update({
          where: { id: body.bankAccountId },
          data: { balance: { decrement: amount } },
        })
      } else if (body.safeId) {
        await db.safe.update({
          where: { id: body.safeId },
          data: { balance: { decrement: amount } },
        })
      }
    }

    const result = await db.expense.findUnique({
      where: { id: expense.id },
      include: {
        bankAccount: { select: { id: true, nameAr: true, bankName: true } },
        safe: { select: { id: true, nameAr: true, code: true } },
      },
    })

    const mapped = result ? {
      ...result,
      bankAccount: result.bankAccount ? {
        id: result.bankAccount.id,
        name: result.bankAccount.nameAr,
        bankName: result.bankAccount.bankName,
      } : null,
      safe: result.safe ? {
        id: result.safe.id,
        name: result.safe.nameAr,
        code: result.safe.code,
      } : null,
    } : null

    return created(mapped)
  } catch (e: any) {
    return serverError(e.message)
  }
}
