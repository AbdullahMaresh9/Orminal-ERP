import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [salesOrders, purchaseOrders, clients, suppliers, products, stockItems, payments, journalEntries, accounts] = await Promise.all([
      db.salesOrder.findMany({ select: { total: true, paid: true, status: true, createdAt: true, clientId: true, code: true, id: true } }),
      db.purchaseOrder.findMany({ select: { total: true, paid: true, status: true, createdAt: true, supplierId: true, code: true, id: true } }),
      db.client.count(),
      db.supplier.count(),
      db.product.findMany({ select: { id: true, name: true, nameAr: true, sku: true, salePrice: true, costPrice: true, minStock: true, categoryId: true } }),
      db.stockItem.findMany({ include: { product: { select: { name: true, nameAr: true, sku: true, costPrice: true, minStock: true } } } }),
      db.salesPayment.findMany({ select: { amount: true, type: true, date: true } }),
      db.journalEntry.findMany({ include: { lines: { include: { account: { select: { code: true, type: true, subtype: true } } } } }, orderBy: { date: 'desc' } }),
      db.account.findMany(),
    ])

    const totalSales = salesOrders.reduce((s, o) => s + o.total, 0)
    const totalPurchases = purchaseOrders.reduce((s, o) => s + o.total, 0)
    const totalReceipts = payments.filter((p) => p.type === 'receipt').reduce((s, p) => s + p.amount, 0)
    const totalPaid = payments.filter((p) => p.type === 'payment').reduce((s, p) => s + p.amount, 0)

    // Inventory value = sum(quantity * costPrice)
    const inventoryValue = stockItems.reduce((s, si) => s + si.quantity * (si.product?.costPrice ?? 0), 0)

    // Compute net profit from journal: revenue (income accounts credit) - expense (expense accounts debit)
    let totalRevenue = 0
    let totalExpense = 0
    for (const je of journalEntries) {
      if (je.status !== 'posted') continue
      for (const line of je.lines) {
        if (line.account?.type === 'income') totalRevenue += line.credit - line.debit
        if (line.account?.type === 'expense') totalExpense += line.debit - line.credit
      }
    }
    const netProfit = totalRevenue - totalExpense

    // Receivables (AR account balance) and Payables (AP account balance)
    const arAccount = accounts.find((a) => a.code === '1200')
    const apAccount = accounts.find((a) => a.code === '2000')
    let receivables = 0
    let payables = 0
    for (const je of journalEntries) {
      if (je.status !== 'posted') continue
      for (const line of je.lines) {
        if (line.accountId === arAccount?.id) receivables += line.debit - line.credit
        if (line.accountId === apAccount?.id) payables += line.credit - line.debit
      }
    }

    // Monthly series (last 6 months) for sales vs purchases
    const now = new Date()
    const months: { label: string; sales: number; purchases: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const monthSales = salesOrders
        .filter((o) => { const d = new Date(o.createdAt); return d >= start && d < end })
        .reduce((s, o) => s + o.total, 0)
      const monthPurchases = purchaseOrders
        .filter((o) => { const d = new Date(o.createdAt); return d >= start && d < end })
        .reduce((s, o) => s + o.total, 0)
      months.push({
        label: start.toLocaleDateString('ar-SA', { month: 'short' }),
        sales: Math.round(monthSales),
        purchases: Math.round(monthPurchases),
      })
    }

    // Top products by sales — derive from salesOrders is not possible without items, so derive from product frequency approx
    // Better: re-query sales order items
    const salesItems = await db.salesOrderItem.findMany({
      include: { product: { select: { name: true, nameAr: true, sku: true } } },
    })
    const productSales = new Map<string, { name: string; sku: string; qty: number; revenue: number }>()
    for (const it of salesItems) {
      const key = it.productId
      const existing = productSales.get(key) ?? { name: it.product?.nameAr ?? it.product?.name ?? '—', sku: it.product?.sku ?? '', qty: 0, revenue: 0 }
      existing.qty += it.quantity
      existing.revenue += it.total
      productSales.set(key, existing)
    }
    const topProducts = Array.from(productSales.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Sales by category
    const categories = await db.category.findMany({ select: { id: true, name: true, nameAr: true } })
    const catMap = new Map(categories.map((c) => [c.id, c.nameAr ?? c.name]))
    const productCat = new Map(products.map((p) => [p.id, p.categoryId]))
    const salesByCat = new Map<string, number>()
    for (const it of salesItems) {
      const catId = productCat.get(it.productId)
      const catName = catId ? (catMap.get(catId) ?? 'غير مصنف') : 'غير مصنف'
      salesByCat.set(catName, (salesByCat.get(catName) ?? 0) + it.total)
    }
    const salesByCategory = Array.from(salesByCat.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)

    // Low stock alerts
    const lowStock = stockItems
      .filter((si) => si.quantity <= (si.product?.minStock ?? 0))
      .map((si) => ({
        name: si.product?.nameAr ?? si.product?.name ?? '—',
        sku: si.product?.sku ?? '',
        quantity: si.quantity,
        minStock: si.product?.minStock ?? 0,
      }))

    // Recent orders
    const recentOrdersRaw = await db.salesOrder.findMany({
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    const recentOrders = recentOrdersRaw.map((o) => ({
      id: o.id,
      code: o.code,
      clientName: o.client?.name ?? '—',
      total: o.total,
      status: o.status,
      date: o.createdAt,
    }))

    // KPIs with month-over-month delta
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const thisMonthSales = salesOrders.filter((o) => new Date(o.createdAt) >= thisMonthStart).reduce((s, o) => s + o.total, 0)
    const lastMonthSales = salesOrders.filter((o) => { const d = new Date(o.createdAt); return d >= lastMonthStart && d < thisMonthStart }).reduce((s, o) => s + o.total, 0)
    const salesDelta = lastMonthSales > 0 ? ((thisMonthSales - lastMonthSales) / lastMonthSales) * 100 : 0

    return NextResponse.json({
      kpis: {
        totalSales,
        totalPurchases,
        netProfit,
        inventoryValue,
        totalClients: clients,
        totalSuppliers: suppliers,
        totalProducts: products.length,
        totalReceipts,
        totalPayments: totalPaid,
        netCashFlow: totalReceipts - totalPaid,
        receivables,
        payables,
        salesDelta: Math.round(salesDelta * 10) / 10,
      },
      months,
      topProducts,
      salesByCategory,
      lowStock,
      recentOrders,
    })
  } catch (e: any) {
    console.error('dashboard error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
