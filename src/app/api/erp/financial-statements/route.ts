import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ok, serverError } from '@/lib/erp/api-response'

// GET /api/erp/financial-statements?type=trial-balance|income|balance-sheet|sales-summary|purchases-summary|inventory-value
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'trial-balance'
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const dateFilter: any = {}
    if (from || to) {
      dateFilter.postingDate = {}
      if (from) dateFilter.postingDate.gte = new Date(from)
      if (to) dateFilter.postingDate.lte = new Date(to)
    }

    // Only posted entries
    const entries = await db.journalEntry.findMany({
      where: { state: 'posted', ...dateFilter },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, nameAr: true, type: true, subtype: true } },
            partner: { select: { id: true, code: true, nameAr: true } },
          },
        },
      },
    })

    // Aggregate by account
    const accountMap = new Map<string, {
      code: string
      nameAr: string
      type: string
      subtype: string | null
      debit: number
      credit: number
    }>()

    for (const e of entries) {
      for (const l of e.lines) {
        if (!l.account) continue
        const k = l.account.code
        const cur = accountMap.get(k) ?? {
          code: l.account.code,
          nameAr: l.account.nameAr,
          type: l.account.type,
          subtype: l.account.subtype ?? null,
          debit: 0,
          credit: 0,
        }
        cur.debit += l.debit
        cur.credit += l.credit
        accountMap.set(k, cur)
      }
    }

    const allAccounts = Array.from(accountMap.values())

    if (type === 'trial-balance') {
      const rows = allAccounts.map((a) => ({
        code: a.code,
        nameAr: a.nameAr,
        type: a.type,
        debit: a.debit > a.credit ? a.debit - a.credit : 0,
        credit: a.credit > a.debit ? a.credit - a.debit : 0,
      }))
      const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
      const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
      return ok({ rows, totalDebit, totalCredit })
    }

    if (type === 'income') {
      const revenues = allAccounts.filter((a) => a.type === 'income')
        .map((a) => ({ code: a.code, nameAr: a.nameAr, amount: a.credit - a.debit }))
      const expenses = allAccounts.filter((a) => a.type === 'expense')
        .map((a) => ({ code: a.code, nameAr: a.nameAr, amount: a.debit - a.credit }))
      const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0)
      const totalExpense = expenses.reduce((s, r) => s + r.amount, 0)
      return ok({
        revenues,
        expenses,
        totals: {
          revenue: totalRevenue,
          expense: totalExpense,
          netProfit: totalRevenue - totalExpense,
        },
      })
    }

    if (type === 'balance-sheet') {
      const assets = allAccounts.filter((a) => a.type === 'asset')
        .map((a) => ({ code: a.code, nameAr: a.nameAr, amount: a.debit - a.credit }))
      const liabilities = allAccounts.filter((a) => a.type === 'liability')
        .map((a) => ({ code: a.code, nameAr: a.nameAr, amount: a.credit - a.debit }))
      // Equity + net income
      const equity = allAccounts.filter((a) => a.type === 'equity')
        .map((a) => ({ code: a.code, nameAr: a.nameAr, amount: a.credit - a.debit }))
      const totalRevenue = allAccounts.filter((a) => a.type === 'income').reduce((s, a) => s + (a.credit - a.debit), 0)
      const totalExpense = allAccounts.filter((a) => a.type === 'expense').reduce((s, a) => s + (a.debit - a.credit), 0)
      const netIncome = totalRevenue - totalExpense
      const totalAssets = assets.reduce((s, a) => s + a.amount, 0)
      const totalLiabilities = liabilities.reduce((s, a) => s + a.amount, 0)
      const totalEquity = equity.reduce((s, a) => s + a.amount, 0) + netIncome
      return ok({
        assets,
        liabilities,
        equity,
        netIncome,
        totals: {
          assets: totalAssets,
          liabilities: totalLiabilities,
          equity: totalEquity,
        },
      })
    }

    if (type === 'sales-summary') {
      const salesOrders = await db.salesOrder.findMany({
        where: { ...dateFilter.createdAt ? { createdAt: dateFilter.postingDate } : {} },
        select: { total: true, paid: true, status: true, createdAt: true, partnerId: true },
      })
      const invoices = await db.salesInvoice.findMany({
        where: { ...dateFilter.postingDate ? { invoiceDate: dateFilter.postingDate } : {} },
        select: { total: true, paid: true, status: true },
      })
      const totalSales = salesOrders.reduce((s, o) => s + o.total, 0)
      const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0)
      const totalPaid = invoices.reduce((s, i) => s + i.paid, 0)
      const outstanding = totalInvoiced - totalPaid
      return ok({
        totalSales,
        totalInvoiced,
        totalPaid,
        outstanding,
        ordersCount: salesOrders.length,
        invoicesCount: invoices.length,
      })
    }

    if (type === 'purchases-summary') {
      const purchaseOrders = await db.purchaseOrder.findMany({
        select: { total: true, paid: true, status: true },
      })
      const invoices = await db.purchaseInvoice.findMany({
        select: { total: true, paid: true, status: true },
      })
      const totalPurchases = purchaseOrders.reduce((s, o) => s + o.total, 0)
      const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0)
      const totalPaid = invoices.reduce((s, i) => s + i.paid, 0)
      const outstanding = totalInvoiced - totalPaid
      return ok({
        totalPurchases,
        totalInvoiced,
        totalPaid,
        outstanding,
        ordersCount: purchaseOrders.length,
        invoicesCount: invoices.length,
      })
    }

    if (type === 'inventory-value') {
      const quants = await db.stockQuant.findMany({
        include: {
          product: { select: { sku: true, nameAr: true, nameEn: true, costPrice: true, salePrice: true, minStock: true, category: { select: { nameAr: true } } } },
          warehouse: { select: { code: true, nameAr: true } },
        },
      })
      const rows = quants.map((q) => ({
        sku: q.product?.sku ?? '',
        name: q.product?.nameAr ?? q.product?.nameEn ?? '—',
        warehouse: q.warehouse?.nameAr ?? '—',
        quantity: q.quantity,
        costPrice: q.product?.costPrice ?? 0,
        value: q.quantity * (q.product?.costPrice ?? 0),
        isLowStock: q.quantity <= (q.product?.minStock ?? 0),
      }))
      const totalValue = rows.reduce((s, r) => s + r.value, 0)
      const totalQuantity = rows.reduce((s, r) => s + r.quantity, 0)
      return ok({ rows, totalValue, totalQuantity, count: rows.length })
    }

    return ok({ error: 'Unknown report type' })
  } catch (e: any) {
    return serverError(e.message)
  }
}
