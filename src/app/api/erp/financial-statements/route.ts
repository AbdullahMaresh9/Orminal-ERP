import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/erp/financial-statements — returns trialBalance, incomeStatement, balanceSheet
export async function GET() {
  try {
    const [accounts, journalEntries] = await Promise.all([
      db.account.findMany({ orderBy: { code: 'asc' } }),
      db.journalEntry.findMany({
        where: { status: 'posted' },
        include: { lines: true },
      }),
    ])

    // Aggregate per account
    const map = new Map<string, { debit: number; credit: number }>()
    for (const je of journalEntries) {
      for (const line of je.lines) {
        const acc = map.get(line.accountId) ?? { debit: 0, credit: 0 }
        acc.debit += line.debit
        acc.credit += line.credit
        map.set(line.accountId, acc)
      }
    }

    const accById = new Map(accounts.map((a) => [a.id, a]))

    // === Trial balance: list of {account, debit, credit} ===
    const trialBalance = accounts
      .map((a) => {
        const sums = map.get(a.id) ?? { debit: 0, credit: 0 }
        const debit = sums.debit > sums.credit ? sums.debit - sums.credit : 0
        const credit = sums.credit > sums.debit ? sums.credit - sums.debit : 0
        return {
          id: a.id,
          code: a.code,
          name: a.name,
          nameAr: a.nameAr,
          type: a.type,
          subtype: a.subtype,
          debit: Math.round(debit * 100) / 100,
          credit: Math.round(credit * 100) / 100,
        }
      })
      .filter((r) => r.debit > 0 || r.credit > 0)

    // === Income statement ===
    const revenues: any[] = []
    const expenses: any[] = []
    let totalRevenue = 0
    let totalExpense = 0
    for (const a of accounts) {
      const sums = map.get(a.id) ?? { debit: 0, credit: 0 }
      const net = sums.credit - sums.debit // revenue positive (credit normal)
      if (a.type === 'income' && Math.abs(net) > 0.001) {
        revenues.push({
          code: a.code,
          name: a.name,
          nameAr: a.nameAr,
          amount: Math.round(net * 100) / 100,
        })
        totalRevenue += net
      }
      if (a.type === 'expense') {
        const exp = sums.debit - sums.credit // expense positive (debit normal)
        if (Math.abs(exp) > 0.001) {
          expenses.push({
            code: a.code,
            name: a.name,
            nameAr: a.nameAr,
            amount: Math.round(exp * 100) / 100,
          })
          totalExpense += exp
        }
      }
    }
    const netIncome = totalRevenue - totalExpense

    // === Balance sheet ===
    const assets: any[] = []
    const liabilities: any[] = []
    const equity: any[] = []
    let totalAssets = 0
    let totalLiabilities = 0
    let totalEquity = 0
    for (const a of accounts) {
      const sums = map.get(a.id) ?? { debit: 0, credit: 0 }
      if (a.type === 'asset') {
        const bal = sums.debit - sums.credit
        if (Math.abs(bal) > 0.001) {
          assets.push({
            code: a.code,
            name: a.name,
            nameAr: a.nameAr,
            amount: Math.round(bal * 100) / 100,
          })
          totalAssets += bal
        }
      }
      if (a.type === 'liability') {
        const bal = sums.credit - sums.debit
        if (Math.abs(bal) > 0.001) {
          liabilities.push({
            code: a.code,
            name: a.name,
            nameAr: a.nameAr,
            amount: Math.round(bal * 100) / 100,
          })
          totalLiabilities += bal
        }
      }
      if (a.type === 'equity') {
        const bal = sums.credit - sums.debit
        if (Math.abs(bal) > 0.001) {
          equity.push({
            code: a.code,
            name: a.name,
            nameAr: a.nameAr,
            amount: Math.round(bal * 100) / 100,
          })
          totalEquity += bal
        }
      }
    }
    // Add net income to equity for balancing
    if (Math.abs(netIncome) > 0.001) {
      equity.push({
        code: '—',
        name: 'صافي الدخل (الفترة)',
        nameAr: 'صافي الدخل (الفترة)',
        amount: Math.round(netIncome * 100) / 100,
      })
      totalEquity += netIncome
    }

    return NextResponse.json({
      trialBalance: {
        rows: trialBalance,
        totalDebit: Math.round(trialBalance.reduce((s, r) => s + r.debit, 0) * 100) / 100,
        totalCredit: Math.round(trialBalance.reduce((s, r) => s + r.credit, 0) * 100) / 100,
      },
      incomeStatement: {
        revenues,
        expenses,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalExpense: Math.round(totalExpense * 100) / 100,
        netIncome: Math.round(netIncome * 100) / 100,
      },
      balanceSheet: {
        assets,
        liabilities,
        equity,
        totalAssets: Math.round(totalAssets * 100) / 100,
        totalLiabilities: Math.round(totalLiabilities * 100) / 100,
        totalEquity: Math.round(totalEquity * 100) / 100,
        totalLiabilitiesEquity: Math.round((totalLiabilities + totalEquity) * 100) / 100,
      },
      meta: {
        entriesCount: journalEntries.length,
        accountsCount: accounts.length,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
