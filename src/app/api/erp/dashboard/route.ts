import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ok, serverError } from '@/lib/erp/api-response'
import { n, sumBy } from '@/lib/erp/money'

export async function GET() {
  try {
    const [
      salesOrders, purchaseOrders, partners, products, stockQuants,
      salesPayments, purchasePayments, journalEntries, accounts,
      salesInvoices, purchaseInvoices,
    ] = await Promise.all([
      db.salesOrder.findMany({ include: { partner: { select: { nameAr: true, nameEn: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }),
      db.purchaseOrder.findMany({ select: { total: true, paid: true, status: true, createdAt: true } }),
      db.partner.count(),
      db.product.count(),
      db.stockQuant.findMany({ include: { product: { select: { nameAr: true, nameEn: true, sku: true, costPrice: true, minStock: true } } } }),
      db.salesPayment.findMany({ where: { status: 'posted' }, select: { amount: true, paymentDate: true } }),
      db.purchasePayment.findMany({ where: { status: 'posted' }, select: { amount: true, paymentDate: true } }),
      db.journalEntry.findMany({ include: { lines: { include: { account: { select: { code: true, type: true } } } } }, orderBy: { postingDate: 'desc' } }),
      db.account.findMany(),
      db.salesInvoice.findMany({ select: { total: true, paid: true, status: true, createdAt: true, invoiceDate: true } }),
      db.purchaseInvoice.findMany({ select: { total: true, paid: true, status: true, createdAt: true } }),
    ])

    const totalSales = sumBy(salesOrders, (o) => o.total)
    const totalPurchases = sumBy(purchaseOrders, (o) => o.total)
    const totalReceipts = sumBy(salesPayments, (p) => p.amount)
    const totalPaid = sumBy(purchasePayments, (p) => p.amount)

    const inventoryValue = stockQuants.reduce((s, q) => s + n(q.quantity) * n(q.product?.costPrice ?? 0), 0)

    // Net profit from journal: revenue - expense
    let totalRevenue = 0, totalExpense = 0
    for (const je of journalEntries) {
      if (je.state !== 'posted') continue
      for (const line of je.lines) {
        if (line.account?.type === 'income') totalRevenue += n(line.credit) - n(line.debit)
        if (line.account?.type === 'expense') totalExpense += n(line.debit) - n(line.credit)
      }
    }
    const netProfit = totalRevenue - totalExpense

    // AR and AP
    const arAccount = accounts.find((a) => a.code === '1100')
    const apAccount = accounts.find((a) => a.code === '2000')
    const cashAccount = accounts.find((a) => a.code === '1000')
    const receivables = arAccount?.balance ?? 0
    const payables = apAccount?.balance ?? 0
    const cashBalance = cashAccount?.balance ?? 0

    // Monthly series (last 6 months)
    const now = new Date()
    const months: { label: string; sales: number; purchases: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const monthSales = salesOrders.filter((o) => { const d = new Date(o.createdAt); return d >= start && d < end }).reduce((s, o) => s + n(o.total), 0)
      const monthPurchases = purchaseOrders.filter((o) => { const d = new Date(o.createdAt); return d >= start && d < end }).reduce((s, o) => s + n(o.total), 0)
      const monthsAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
      months.push({ label: monthsAr[start.getMonth()], sales: Math.round(monthSales), purchases: Math.round(monthPurchases) })
    }

    // Top products by sales
    const salesOrderItems = await db.salesOrderLine.findMany({ include: { product: { select: { nameAr: true, nameEn: true, sku: true } } } })
    const productSales = new Map<string, { name: string; sku: string; qty: number; revenue: number }>()
    for (const it of salesOrderItems) {
      const existing = productSales.get(it.productId) ?? { name: it.product?.nameAr ?? it.product?.nameEn ?? '—', sku: it.product?.sku ?? '', qty: 0, revenue: 0 }
      existing.qty += n(it.quantity)
      existing.revenue += n(it.total)
      productSales.set(it.productId, existing)
    }
    const topProducts = Array.from(productSales.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

    // Low stock
    const lowStock = stockQuants.filter((q) => q.quantity <= (q.product?.minStock ?? 0)).map((q) => ({
      name: q.product?.nameAr ?? q.product?.nameEn ?? '—',
      sku: q.product?.sku ?? '',
      quantity: q.quantity,
      minStock: q.product?.minStock ?? 0,
    }))

    // Recent orders
    const recentOrders = salesOrders.map((o) => ({
      id: o.id,
      code: o.code,
      clientName: o.partner?.nameAr ?? o.partner?.nameEn ?? '—',
      total: o.total,
      status: o.status,
      date: o.createdAt,
    }))

    // Customers vs suppliers count
    const customers = await db.partner.count({ where: { isCustomer: true } })
    const suppliers = await db.partner.count({ where: { isSupplier: true } })

    return ok({
      kpis: {
        totalSales,
        totalPurchases,
        netProfit,
        inventoryValue,
        totalPartners: partners,
        totalCustomers: customers,
        totalSuppliers: suppliers,
        totalProducts: products,
        totalReceipts,
        totalPayments: totalPaid,
        netCashFlow: totalReceipts - totalPaid,
        cashBalance,
        receivables,
        payables,
      },
      months,
      topProducts,
      lowStock,
      recentOrders,
    })
  } catch (e: any) {
    console.error('dashboard error', e)
    return serverError(e.message)
  }
}
