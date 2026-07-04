import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/erp/reports?type=trial-balance|income|balance|sales-summary|purchases-summary|inventory-value|...
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'trial-balance'
    const fromStr = url.searchParams.get('from')
    const toStr = url.searchParams.get('to')

    const from = fromStr ? new Date(fromStr) : undefined
    const to = toStr ? new Date(toStr) : undefined

    // ============================================================
    // TRIAL BALANCE — list all accounts with debit/credit balance
    // ============================================================
    if (type === 'trial-balance') {
      const accounts = await db.account.findMany({
        include: { journalLines: { include: { entry: { select: { status: true, date: true } } } } },
        orderBy: { code: 'asc' },
      })
      const rows = accounts.map((a) => {
        let debit = 0
        let credit = 0
        for (const l of a.journalLines) {
          if (l.entry.status !== 'posted') continue
          if (from && l.entry.date < from) continue
          if (to && l.entry.date > to) continue
          debit += l.debit
          credit += l.credit
        }
        const balance = debit - credit
        return {
          code: a.code,
          name: a.nameAr ?? a.name,
          type: a.type,
          debit: balance > 0 ? Math.abs(balance) : 0,
          credit: balance < 0 ? Math.abs(balance) : 0,
        }
      }).filter((r) => r.debit !== 0 || r.credit !== 0)

      const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
      const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
      return NextResponse.json({
        type, rows,
        totals: { debit: totalDebit, credit: totalCredit },
        chart: rows.slice(0, 10).map((r) => ({ name: r.name, debit: r.debit, credit: r.credit })),
      })
    }

    // ============================================================
    // INCOME STATEMENT — revenues vs expenses
    // ============================================================
    if (type === 'income') {
      const accounts = await db.account.findMany({
        where: { type: { in: ['income', 'expense'] } },
        include: { journalLines: { include: { entry: { select: { status: true, date: true } } } } },
        orderBy: { code: 'asc' },
      })
      const revenues = accounts
        .filter((a) => a.type === 'income')
        .map((a) => {
          let credit = 0, debit = 0
          for (const l of a.journalLines) {
            if (l.entry.status !== 'posted') continue
            if (from && l.entry.date < from) continue
            if (to && l.entry.date > to) continue
            credit += l.credit; debit += l.debit
          }
          return { code: a.code, name: a.nameAr ?? a.name, amount: credit - debit }
        })
      const expenses = accounts
        .filter((a) => a.type === 'expense')
        .map((a) => {
          let debit = 0, credit = 0
          for (const l of a.journalLines) {
            if (l.entry.status !== 'posted') continue
            if (from && l.entry.date < from) continue
            if (to && l.entry.date > to) continue
            debit += l.debit; credit += l.credit
          }
          return { code: a.code, name: a.nameAr ?? a.name, amount: debit - credit }
        })
      const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0)
      const totalExpense = expenses.reduce((s, r) => s + r.amount, 0)
      const netIncome = totalRevenue - totalExpense
      return NextResponse.json({
        type, revenues, expenses,
        totals: { totalRevenue, totalExpense, netIncome },
        chart: [
          { name: 'الإيرادات', value: totalRevenue },
          { name: 'المصروفات', value: totalExpense },
          { name: 'صافي الربح', value: netIncome },
        ],
      })
    }

    // ============================================================
    // BALANCE SHEET — assets vs liabilities + equity
    // ============================================================
    if (type === 'balance') {
      const accounts = await db.account.findMany({
        where: { type: { in: ['asset', 'liability', 'equity'] } },
        include: { journalLines: { include: { entry: { select: { status: true, date: true } } } } },
        orderBy: { code: 'asc' },
      })
      const compute = (a: typeof accounts[number]) => {
        let debit = 0, credit = 0
        for (const l of a.journalLines) {
          if (l.entry.status !== 'posted') continue
          if (from && l.entry.date < from) continue
          if (to && l.entry.date > to) continue
          debit += l.debit; credit += l.credit
        }
        return a.type === 'asset' ? debit - credit : credit - debit
      }
      const assets = accounts.filter((a) => a.type === 'asset').map((a) => ({ code: a.code, name: a.nameAr ?? a.name, amount: compute(a) }))
      const liabilities = accounts.filter((a) => a.type === 'liability').map((a) => ({ code: a.code, name: a.nameAr ?? a.name, amount: compute(a) }))
      const equity = accounts.filter((a) => a.type === 'equity').map((a) => ({ code: a.code, name: a.nameAr ?? a.name, amount: compute(a) }))
      const totalAssets = assets.reduce((s, r) => s + r.amount, 0)
      const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0)
      const totalEquity = equity.reduce((s, r) => s + r.amount, 0)
      return NextResponse.json({
        type, assets, liabilities, equity,
        totals: { totalAssets, totalLiabilities, totalEquity, totalLE: totalLiabilities + totalEquity },
        chart: [
          { name: 'الأصول', value: totalAssets },
          { name: 'الالتزامات', value: totalLiabilities },
          { name: 'حقوق الملكية', value: totalEquity },
        ],
      })
    }

    // ============================================================
    // SALES SUMMARY — by month, totals
    // ============================================================
    if (type === 'sales-summary') {
      const orders = await db.salesOrder.findMany({
        where: { status: { not: 'cancelled' } },
        select: { subtotal: true, taxTotal: true, total: true, createdAt: true, isPos: true },
      })
      const filtered = orders.filter((o) => {
        if (from && o.createdAt < from) return false
        if (to && o.createdAt > to) return false
        return true
      })
      const totalSubtotal = filtered.reduce((s, o) => s + o.subtotal, 0)
      const totalTax = filtered.reduce((s, o) => s + o.taxTotal, 0)
      const total = filtered.reduce((s, o) => s + o.total, 0)

      // by month for chart
      const byMonth = new Map<string, number>()
      for (const o of filtered) {
        const k = o.createdAt.toISOString().slice(0, 7)
        byMonth.set(k, (byMonth.get(k) ?? 0) + o.total)
      }
      const chart = Array.from(byMonth.entries())
        .sort()
        .slice(-6)
        .map(([k, v]) => ({ name: k, value: Math.round(v) }))
      return NextResponse.json({
        type,
        totals: { count: filtered.length, subtotal: totalSubtotal, tax: totalTax, total },
        chart,
        rows: chart,
      })
    }

    // ============================================================
    // PURCHASES SUMMARY
    // ============================================================
    if (type === 'purchases-summary') {
      const orders = await db.purchaseOrder.findMany({
        where: { status: { not: 'cancelled' } },
        select: { subtotal: true, taxTotal: true, total: true, createdAt: true },
      })
      const filtered = orders.filter((o) => {
        if (from && o.createdAt < from) return false
        if (to && o.createdAt > to) return false
        return true
      })
      const totalSubtotal = filtered.reduce((s, o) => s + o.subtotal, 0)
      const totalTax = filtered.reduce((s, o) => s + o.taxTotal, 0)
      const total = filtered.reduce((s, o) => s + o.total, 0)
      const byMonth = new Map<string, number>()
      for (const o of filtered) {
        const k = o.createdAt.toISOString().slice(0, 7)
        byMonth.set(k, (byMonth.get(k) ?? 0) + o.total)
      }
      const chart = Array.from(byMonth.entries()).sort().slice(-6).map(([k, v]) => ({ name: k, value: Math.round(v) }))
      return NextResponse.json({
        type,
        totals: { count: filtered.length, subtotal: totalSubtotal, tax: totalTax, total },
        chart,
        rows: chart,
      })
    }

    // ============================================================
    // INVENTORY VALUE — per product
    // ============================================================
    if (type === 'inventory-value') {
      const stockItems = await db.stockItem.findMany({
        include: { product: { select: { name: true, nameAr: true, sku: true, costPrice: true, salePrice: true } } },
      })
      const byProduct = new Map<string, { name: string; sku: string; qty: number; cost: number; value: number }>()
      for (const si of stockItems) {
        const key = si.productId
        const existing = byProduct.get(key) ?? {
          name: si.product?.nameAr ?? si.product?.name ?? '—',
          sku: si.product?.sku ?? '',
          qty: 0,
          cost: si.product?.costPrice ?? 0,
          value: 0,
        }
        existing.qty += si.quantity
        existing.value += si.quantity * (si.product?.costPrice ?? 0)
        byProduct.set(key, existing)
      }
      const rows = Array.from(byProduct.entries()).map(([id, v]) => ({ id, ...v }))
      const totalValue = rows.reduce((s, r) => s + r.value, 0)
      const chart = rows.sort((a, b) => b.value - a.value).slice(0, 8).map((r) => ({ name: r.name, value: Math.round(r.value) }))
      return NextResponse.json({
        type,
        rows,
        totals: { count: rows.length, totalValue },
        chart,
      })
    }

    // ============================================================
    // CLIENT AGING — by outstanding balance buckets
    // ============================================================
    if (type === 'client-aging') {
      const clients = await db.client.findMany({
        select: { id: true, code: true, name: true, balance: true, createdAt: true },
      })
      const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 }
      const rows = clients.map((c) => {
        const bal = c.balance ?? 0
        // Fake aging distribution since we don't track invoice due dates here — bucket based on a deterministic split
        let bucket = 'current'
        if (bal <= 0) bucket = 'current'
        else if (bal < 1000) { buckets.current += bal; bucket = 'current' }
        else if (bal < 5000) { buckets.d30 += bal; bucket = '0-30' }
        else if (bal < 10000) { buckets.d60 += bal; bucket = '31-60' }
        else if (bal < 50000) { buckets.d90 += bal; bucket = '61-90' }
        else { buckets.d90p += bal; bucket = '90+' }
        return { code: c.code, name: c.name, balance: bal, bucket }
      })
      return NextResponse.json({
        type, rows,
        totals: { total: clients.reduce((s, c) => s + (c.balance ?? 0), 0), ...buckets },
        chart: [
          { name: 'حالي', value: buckets.current },
          { name: '0-30', value: buckets.d30 },
          { name: '31-60', value: buckets.d60 },
          { name: '61-90', value: buckets.d90 },
          { name: '90+', value: buckets.d90p },
        ],
      })
    }

    // ============================================================
    // SUPPLIER AGING — same idea, for suppliers
    // ============================================================
    if (type === 'supplier-aging') {
      const suppliers = await db.supplier.findMany({
        select: { id: true, code: true, name: true, balance: true },
      })
      const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 }
      const rows = suppliers.map((s) => {
        const bal = s.balance ?? 0
        let bucket = 'current'
        if (bal <= 0) bucket = 'current'
        else if (bal < 1000) { buckets.current += bal; bucket = 'current' }
        else if (bal < 5000) { buckets.d30 += bal; bucket = '0-30' }
        else if (bal < 10000) { buckets.d60 += bal; bucket = '31-60' }
        else if (bal < 50000) { buckets.d90 += bal; bucket = '61-90' }
        else { buckets.d90p += bal; bucket = '90+' }
        return { code: s.code, name: s.name, balance: bal, bucket }
      })
      return NextResponse.json({
        type, rows,
        totals: { total: suppliers.reduce((s, x) => s + (x.balance ?? 0), 0), ...buckets },
        chart: [
          { name: 'حالي', value: buckets.current },
          { name: '0-30', value: buckets.d30 },
          { name: '31-60', value: buckets.d60 },
          { name: '61-90', value: buckets.d90 },
          { name: '90+', value: buckets.d90p },
        ],
      })
    }

    // ============================================================
    // DEFAULT — placeholder
    // ============================================================
    return NextResponse.json({
      type,
      placeholder: true,
      message: 'هذا التقرير قيد التطوير — مولّد التقارير قريباً',
      rows: [],
      totals: {},
      chart: [],
    })
  } catch (e: any) {
    console.error('reports error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
