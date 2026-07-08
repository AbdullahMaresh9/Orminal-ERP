import { db } from '@/lib/db'
import {
  ok,
  created,
  list,
  badRequest,
  serverError,
  parsePagination,
  parseSearch,
} from '@/lib/erp/api-response'
import {
  postJournalEntry,
  reverseJournalEntry,
  validateBalanced,
} from '@/lib/erp/accounting-engine'

// GET /api/erp/journal-entries — list with includes
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const state = url.searchParams.get('state')
    const refType = url.searchParams.get('refType')

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { description: { contains: q } },
        { reference: { contains: q } },
      ]
    }
    if (state) where.state = state
    if (refType) where.refType = refType

    const [data, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          journal: { select: { id: true, code: true, nameAr: true } },
          lines: {
            include: {
              account: { select: { id: true, code: true, nameAr: true, type: true } },
              partner: { select: { id: true, nameAr: true } },
              costCenter: { select: { id: true, code: true, nameAr: true } },
            },
            orderBy: { id: 'asc' },
          },
        },
        orderBy: { postingDate: 'desc' },
      }),
      db.journalEntry.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/journal-entries — create draft OR post directly
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    if (!body.lines || !Array.isArray(body.lines) || body.lines.length < 2) {
      return badRequest('At least 2 lines required')
    }

    // Resolve account codes → input format for posting engine
    const lines: any[] = body.lines.map((l: any) => ({
      accountCode: l.accountCode,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      description: l.description,
      partnerId: l.partnerId,
      costCenterId: l.costCenterId,
      analyticAccountId: l.analyticAccountId,
      taxCodeId: l.taxCodeId,
    }))

    // BR-FIN-001: balanced
    if (!validateBalanced(lines)) {
      return badRequest('UNBALANCED_JOURNAL: debit total must equal credit total', 'BR-FIN-001')
    }

    const state = body.state ?? 'draft'
    const postingDate = body.postingDate ? new Date(body.postingDate) : new Date()

    // BR-FIN-002: check period open
    if (state === 'posted') {
      const period = await db.fiscalPeriod.findFirst({
        where: { startDate: { lte: postingDate }, endDate: { gte: postingDate } },
      })
      if (period && period.state === 'closed') {
        return badRequest('PERIOD_CLOSED: posting date is in a closed period', 'BR-FIN-002')
      }
    }

    if (state === 'posted') {
      // Use the central posting engine (atomic, updates account balances)
      const result = await postJournalEntry({
        companyId: company.id,
        branchId: branch?.id,
        journalType: body.journalType ?? 'general',
        postingDate,
        description: body.description || 'Manual journal entry',
        refType: body.refType ?? 'manual',
        refId: body.refId,
        currencyId: body.currencyId,
        lines,
        userId: body.userId,
      })
      const entry = await db.journalEntry.findUnique({
        where: { id: result.id },
        include: { lines: { include: { account: true } } },
      })
      return created(entry)
    }

    // Draft mode: create without posting
    let journalId = body.journalId
    if (!journalId && body.journalType) {
      const journalMap: Record<string, string> = {
        sale: 'SJ', purchase: 'PJ', cash: 'CJ', bank: 'BJ', general: 'GJ', opening: 'OJ', closing: 'CLJ',
      }
      const j = await db.journal.findUnique({ where: { code: journalMap[body.journalType] || 'GJ' } })
      journalId = j?.id
    }

    const { nextNumber } = await import('@/lib/erp/number-sequence')
    const code = await nextNumber('journal_entry', company.id, branch?.id, postingDate.getFullYear())

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)

    // Resolve account codes
    const codes = [...new Set(lines.map((l) => l.accountCode))]
    const accounts = await db.account.findMany({ where: { code: { in: codes } } })
    const accountMap = new Map(accounts.map((a) => [a.code, a.id]))
    for (const l of lines) {
      if (!accountMap.has(l.accountCode)) return badRequest(`ACCOUNT_NOT_FOUND: ${l.accountCode}`)
    }

    const entry = await db.journalEntry.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        journalId,
        postingDate,
        reference: body.reference,
        description: body.description,
        refType: body.refType,
        refId: body.refId,
        currencyId: body.currencyId,
        state: 'draft',
        totalDebit,
        totalCredit,
        createdBy: body.userId,
        lines: {
          create: lines.map((l) => ({
            accountId: accountMap.get(l.accountCode)!,
            partnerId: l.partnerId,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
            costCenterId: l.costCenterId,
            analyticAccountId: l.analyticAccountId,
            taxCodeId: l.taxCodeId,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    })
    return created(entry)
  } catch (e: any) {
    return serverError(e.message)
  }
}
