import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ok, serverError } from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'

// NOTE ON HIERARCHY: every figure below is aggregated from JournalLine, and group
// accounts never carry journal lines (the posting engine rejects postings to a
// group). Group accounts therefore contribute exactly 0 here, so introducing the
// account hierarchy cannot double-count. Group totals are exposed separately in
// `byGroup` for hierarchical presentation.

// GET /api/erp/financial-statements?type=trial-balance|income|balance-sheet|sales-summary|purchases-summary|inventory-value
export async function GET(req: Request) {
  const auth = await requireCapability(COA_ACTIONS.LEDGER, 'canRead')
  if (isAuthFailure(auth)) return auth

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
            account: {
              select: {
                id: true, code: true, nameAr: true, nameEn: true, type: true, subtype: true,
                accountClass: true, normalBalance: true, fsSection: true, isPosting: true,
                parent: { select: { code: true, nameAr: true } },
              },
            },
            partner: { select: { id: true, code: true, nameAr: true } },
          },
        },
      },
    })

    // Aggregate by account
    const accountMap = new Map<string, {
      code: string
      nameAr: string
      nameEn: string | null
      type: string
      subtype: string | null
      accountClass: string
      normalBalance: string
      fsSection: string
      groupCode: string | null
      groupNameAr: string | null
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
          nameEn: l.account.nameEn ?? null,
          type: l.account.type,
          subtype: l.account.subtype ?? null,
          accountClass: l.account.accountClass,
          normalBalance: l.account.normalBalance,
          fsSection: l.account.fsSection,
          groupCode: l.account.parent?.code ?? null,
          groupNameAr: l.account.parent?.nameAr ?? null,
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

      // Hierarchical rollup: posting accounts summed under their immediate group.
      const byGroup = new Map<string, { groupCode: string; groupNameAr: string; debit: number; credit: number; accounts: number }>()
      for (const a of allAccounts) {
        const key = a.groupCode ?? '—'
        const cur = byGroup.get(key) ?? {
          groupCode: key,
          groupNameAr: a.groupNameAr ?? 'بدون مجموعة',
          debit: 0,
          credit: 0,
          accounts: 0,
        }
        cur.debit += a.debit
        cur.credit += a.credit
        cur.accounts += 1
        byGroup.set(key, cur)
      }

      return ok({
        rows,
        totalDebit,
        totalCredit,
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
        byGroup: Array.from(byGroup.values()).sort((x, y) => x.groupCode.localeCompare(y.groupCode, 'en', { numeric: true })),
      })
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

    if (type === 'general-journal') {
      const rows = entries.map((e) => ({
        number: e.code,
        date: e.postingDate,
        journalName: e.journalId,
        ref: e.reference ?? '—',
        description: e.description ?? '—',
        state: e.state,
        totalDebit: e.lines.reduce((s, l) => s + l.debit, 0),
        totalCredit: e.lines.reduce((s, l) => s + l.credit, 0),
        linesCount: e.lines.length,
      }))
      const totalDebit = rows.reduce((s, r) => s + r.totalDebit, 0)
      const totalCredit = rows.reduce((s, r) => s + r.totalCredit, 0)
      return ok({ rows, totalDebit, totalCredit, count: rows.length })
    }

    if (type === 'account-statement') {
      const accountId = url.searchParams.get('accountId')
      const lines = entries.flatMap((e) =>
        e.lines
          .filter((l) => !accountId || l.accountId === accountId || l.account.code === accountId)
          .map((l) => ({
            date: e.postingDate,
            entryNumber: e.code,
            description: l.description || e.description || '—',
            accountCode: l.account.code,
            accountName: l.account.nameAr,
            debit: l.debit,
            credit: l.credit,
            partner: l.partner?.nameAr ?? null,
          }))
      )
      let runningBalance = 0
      const rows = lines.map((l) => {
        runningBalance += l.debit - l.credit
        return { ...l, balance: runningBalance }
      })
      const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
      const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
      return ok({ rows, totalDebit, totalCredit, endingBalance: runningBalance })
    }

    if (type === 'cash-flow') {
      const cashAccounts = allAccounts.filter((a) => a.accountClass === 'CASH' || a.subtype === 'bank' || a.code.startsWith('1101') || a.code.startsWith('1102'))
      const rows = cashAccounts.map((a) => ({
        code: a.code,
        nameAr: a.nameAr,
        type: a.type,
        inflow: a.debit,
        outflow: a.credit,
        netChange: a.debit - a.credit,
      }))
      const totalInflow = rows.reduce((s, r) => s + r.inflow, 0)
      const totalOutflow = rows.reduce((s, r) => s + r.outflow, 0)
      return ok({ rows, totalInflow, totalOutflow, netCashChange: totalInflow - totalOutflow })
    }

    if (type === 'cost-center-report') {
      const costCenters = await db.costCenter.findMany({
        select: { id: true, code: true, nameAr: true, active: true },
      })
      const ccMap = new Map<string, { code: string; nameAr: string; debit: number; credit: number }>()
      for (const cc of costCenters) {
        ccMap.set(cc.id, { code: cc.code, nameAr: cc.nameAr, debit: 0, credit: 0 })
      }
      for (const e of entries) {
        for (const l of e.lines) {
          if (l.costCenterId && ccMap.has(l.costCenterId)) {
            const cur = ccMap.get(l.costCenterId)!
            cur.debit += l.debit
            cur.credit += l.credit
          }
        }
      }
      const rows = Array.from(ccMap.values())
      return ok({ rows })
    }

    if (type === 'customer-statement' || type === 'ar-aging') {
      const customers = await db.partner.findMany({
        where: { isCustomer: true },
        select: {
          id: true, code: true, nameAr: true, phone: true,
          salesInvoices: { select: { id: true, code: true, total: true, paid: true, dueDate: true, status: true } },
        },
      })
      const rows = customers.map((c) => {
        const totalInvoiced = c.salesInvoices.reduce((s, i) => s + i.total, 0)
        const totalPaid = c.salesInvoices.reduce((s, i) => s + i.paid, 0)
        const balance = totalInvoiced - totalPaid

        let current = 0, m30 = 0, m60 = 0, m90Plus = 0
        const now = new Date()
        for (const inv of c.salesInvoices) {
          const due = inv.paid < inv.total ? inv.total - inv.paid : 0
          if (due <= 0) continue
          const days = Math.floor((now.getTime() - new Date(inv.dueDate || Date.now()).getTime()) / (1000 * 3600 * 24))
          if (days <= 30) current += due
          else if (days <= 60) m30 += due
          else if (days <= 90) m60 += due
          else m90Plus += due
        }

        return {
          id: c.id,
          code: c.code,
          name: c.nameAr,
          phone: c.phone ?? '—',
          invoiced: totalInvoiced,
          paid: totalPaid,
          balance,
          current,
          days30: m30,
          days60: m60,
          days90Plus: m90Plus,
        }
      })
      const totalBalance = rows.reduce((s, r) => s + r.balance, 0)
      return ok({ rows, totalBalance })
    }

    if (type === 'supplier-statement' || type === 'ap-aging') {
      const suppliers = await db.partner.findMany({
        where: { isSupplier: true },
        select: {
          id: true, code: true, nameAr: true, phone: true,
          purchaseInvoices: { select: { id: true, code: true, total: true, paid: true, dueDate: true, status: true } },
        },
      })
      const rows = suppliers.map((s) => {
        const totalInvoiced = s.purchaseInvoices.reduce((x, i) => x + i.total, 0)
        const totalPaid = s.purchaseInvoices.reduce((x, i) => x + i.paid, 0)
        const balance = totalInvoiced - totalPaid

        let current = 0, m30 = 0, m60 = 0, m90Plus = 0
        const now = new Date()
        for (const inv of s.purchaseInvoices) {
          const due = inv.paid < inv.total ? inv.total - inv.paid : 0
          if (due <= 0) continue
          const days = Math.floor((now.getTime() - new Date(inv.dueDate || Date.now()).getTime()) / (1000 * 3600 * 24))
          if (days <= 30) current += due
          else if (days <= 60) m30 += due
          else if (days <= 90) m60 += due
          else m90Plus += due
        }

        return {
          id: s.id,
          code: s.code,
          name: s.nameAr,
          phone: s.phone ?? '—',
          invoiced: totalInvoiced,
          paid: totalPaid,
          balance,
          current,
          days30: m30,
          days60: m60,
          days90Plus: m90Plus,
        }
      })
      const totalBalance = rows.reduce((s, r) => s + r.balance, 0)
      return ok({ rows, totalBalance })
    }

    if (type === 'low-stock') {
      const products = await db.product.findMany({
        where: { active: true },
        include: {
          category: { select: { nameAr: true } },
          stockQuants: { select: { quantity: true, warehouse: { select: { nameAr: true } } } },
        },
      })
      const rows = products.map((p) => {
        const qtyOn = p.stockQuants.reduce((s, q) => s + q.quantity, 0)
        return {
          sku: p.sku,
          name: p.nameAr,
          category: p.category?.nameAr ?? '—',
          minStock: p.minStock,
          currentStock: qtyOn,
          shortage: p.minStock > qtyOn ? p.minStock - qtyOn : 0,
          costPrice: p.costPrice,
          salePrice: p.salePrice,
        }
      }).filter((r) => r.currentStock <= r.minStock)
      return ok({ rows, count: rows.length })
    }

    if (type === 'payroll-summary') {
      const payrollRuns = await db.payrollRun.findMany({
        include: {
          payslips: {
            include: { employee: { select: { employeeNo: true, nameAr: true, department: { select: { nameAr: true } } } } },
          },
        },
      })
      const rows = payrollRuns.flatMap((pr) =>
        pr.payslips.map((ps) => ({
          period: pr.period,
          empCode: ps.employee.employeeNo,
          empName: ps.employee.nameAr,
          dept: ps.employee.department?.nameAr ?? '—',
          basic: ps.grossSalary - ps.allowances,
          allowances: ps.allowances,
          deductions: ps.deductions,
          net: ps.netSalary,
          status: pr.status,
        }))
      )
      const totalNet = rows.reduce((s, r) => s + r.net, 0)
      return ok({ rows, totalNet, count: rows.length })
    }

    if (type === 'audit-trail') {
      const logs = await db.auditLog.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { username: true } } },
      })
      const rows = logs.map((l) => ({
        id: l.id,
        user: l.user?.username ?? 'النظام',
        action: l.action,
        module: l.moduleCode ?? 'عام',
        entity: l.documentType,
        ip: l.ipAddress ?? '—',
        date: l.createdAt,
      }))
      return ok({ rows, count: rows.length })
    }

    if (type === 'receipt-vouchers' || type === 'customer-collections') {
      const payments = await db.salesPayment.findMany({
        orderBy: { paymentDate: 'desc' },
        include: { partner: { select: { nameAr: true, code: true } } },
      })
      const rows = payments.map((p) => ({
        id: p.id,
        code: p.code,
        partner: p.partner?.nameAr ?? '—',
        partnerCode: p.partner?.code ?? '—',
        amount: p.amount,
        method: p.method,
        reference: p.reference ?? '—',
        date: p.paymentDate,
        status: p.status,
      }))
      const totalAmount = rows.reduce((s, r) => s + r.amount, 0)
      return ok({ rows, totalAmount, count: rows.length })
    }

    if (type === 'payment-vouchers' || type === 'supplier-payments' || type === 'supplier-payments-rep') {
      const payments = await db.purchasePayment.findMany({
        orderBy: { paymentDate: 'desc' },
        include: { partner: { select: { nameAr: true, code: true } } },
      })
      const rows = payments.map((p) => ({
        id: p.id,
        code: p.code,
        partner: p.partner?.nameAr ?? '—',
        partnerCode: p.partner?.code ?? '—',
        amount: p.amount,
        method: p.method,
        reference: p.reference ?? '—',
        date: p.paymentDate,
        status: p.status,
      }))
      const totalAmount = rows.reduce((s, r) => s + r.amount, 0)
      return ok({ rows, totalAmount, count: rows.length })
    }

    if (type === 'debit-credit-notes' || type === 'sales-credit-notes' || type === 'sales-credit-notes-rep') {
      const notes = await db.salesCreditNote.findMany({
        orderBy: { createdAt: 'desc' },
        include: { partner: { select: { nameAr: true, code: true } } },
      })
      const rows = notes.map((n) => ({
        id: n.id,
        code: n.code,
        partner: n.partner?.nameAr ?? '—',
        date: n.date,
        reason: n.reason ?? '—',
        status: n.status,
        subtotal: n.subtotal,
        taxTotal: n.taxTotal,
        total: n.total,
      }))
      const totalValue = rows.reduce((s, r) => s + r.total, 0)
      return ok({ rows, totalValue, count: rows.length })
    }

    if (type === 'tax-invoices' || type === 'net-sales') {
      const invoices = await db.salesInvoice.findMany({
        orderBy: { invoiceDate: 'desc' },
        include: { partner: { select: { nameAr: true, code: true } } },
      })
      const rows = invoices.map((i) => ({
        id: i.id,
        code: i.code,
        partner: i.partner?.nameAr ?? '—',
        partnerCode: i.partner?.code ?? '—',
        date: i.invoiceDate,
        subtotal: i.subtotal,
        taxTotal: i.taxTotal,
        discount: i.discount,
        total: i.total,
        paid: i.paid,
        status: i.status,
      }))
      const totalSales = rows.reduce((s, r) => s + r.total, 0)
      const totalTax = rows.reduce((s, r) => s + r.taxTotal, 0)
      return ok({ rows, totalSales, totalTax, count: rows.length })
    }

    if (type === 'sales-quotations-rep' || type === 'sales-quotations') {
      const items = await db.salesQuotation.findMany({
        orderBy: { createdAt: 'desc' },
        include: { partner: { select: { nameAr: true } } },
      })
      const rows = items.map((q) => ({
        id: q.id,
        code: q.code,
        partner: q.partner?.nameAr ?? '—',
        date: q.quotationDate,
        total: q.total,
        status: q.status,
      }))
      return ok({ rows, totalAmount: rows.reduce((s, r) => s + r.total, 0), count: rows.length })
    }

    if (type === 'sales-orders-rep' || type === 'sales-orders') {
      const items = await db.salesOrder.findMany({
        orderBy: { createdAt: 'desc' },
        include: { partner: { select: { nameAr: true } } },
      })
      const rows = items.map((o) => ({
        id: o.id,
        code: o.code,
        partner: o.partner?.nameAr ?? '—',
        date: o.orderDate,
        total: o.total,
        status: o.status,
      }))
      return ok({ rows, totalAmount: rows.reduce((s, r) => s + r.total, 0), count: rows.length })
    }

    if (type === 'sales-returns-rep' || type === 'sales-returns') {
      const items = await db.salesReturn.findMany({
        orderBy: { createdAt: 'desc' },
        include: { partner: { select: { nameAr: true } } },
      })
      const rows = items.map((r) => ({
        id: r.id,
        code: r.code,
        partner: r.partner?.nameAr ?? '—',
        date: r.date,
        reason: r.reason ?? '—',
        total: r.total,
        status: r.status,
      }))
      return ok({ rows, totalAmount: rows.reduce((s, r) => s + r.total, 0), count: rows.length })
    }

    if (type === 'sales-by-customer') {
      const partners = await db.partner.findMany({
        where: { isCustomer: true },
        include: { salesInvoices: { select: { total: true, paid: true } } },
      })
      const rows = partners.map((p) => {
        const invoiced = p.salesInvoices.reduce((s, i) => s + i.total, 0)
        const paid = p.salesInvoices.reduce((s, i) => s + i.paid, 0)
        return {
          code: p.code,
          name: p.nameAr,
          invoicesCount: p.salesInvoices.length,
          totalInvoiced: invoiced,
          totalPaid: paid,
          balance: invoiced - paid,
        }
      })
      return ok({ rows, totalSales: rows.reduce((s, r) => s + r.totalInvoiced, 0) })
    }

    if (type === 'sales-by-product' || type === 'purchases-by-product') {
      const lines = type === 'sales-by-product'
        ? await db.salesInvoiceLine.findMany({ include: { product: { select: { sku: true, nameAr: true, costPrice: true } } } })
        : await db.purchaseInvoiceLine.findMany({ include: { product: { select: { sku: true, nameAr: true, costPrice: true } } } })

      const prodMap = new Map<string, { sku: string; name: string; quantity: number; total: number }>()
      for (const l of lines) {
        const key = l.productId
        const cur = prodMap.get(key) || { sku: l.product?.sku ?? '—', name: l.product?.nameAr ?? '—', quantity: 0, total: 0 }
        cur.quantity += l.quantity
        cur.total += l.total
        prodMap.set(key, cur)
      }
      const rows = Array.from(prodMap.values())
      return ok({ rows, totalAmount: rows.reduce((s, r) => s + r.total, 0) })
    }

    if (type === 'purchase-requests-rep' || type === 'purchase-requests') {
      const items = await db.purchaseRequest.findMany({ orderBy: { createdAt: 'desc' } })
      const rows = items.map((pr) => ({
        id: pr.id,
        code: pr.code,
        department: pr.department ?? '—',
        requiredDate: pr.requiredDate,
        status: pr.status,
      }))
      return ok({ rows, count: rows.length })
    }

    if (type === 'purchase-orders-rep' || type === 'purchase-orders') {
      const items = await db.purchaseOrder.findMany({
        orderBy: { createdAt: 'desc' },
        include: { partner: { select: { nameAr: true } } },
      })
      const rows = items.map((po) => ({
        id: po.id,
        code: po.code,
        supplier: po.partner?.nameAr ?? '—',
        date: po.orderDate,
        total: po.total,
        status: po.status,
      }))
      return ok({ rows, totalAmount: rows.reduce((s, r) => s + r.total, 0), count: rows.length })
    }

    if (type === 'purchase-invoices-rep' || type === 'purchase-invoices' || type === 'net-purchases') {
      const items = await db.purchaseInvoice.findMany({
        orderBy: { billDate: 'desc' },
        include: { partner: { select: { nameAr: true } } },
      })
      const rows = items.map((pi) => ({
        id: pi.id,
        code: pi.code,
        supplier: pi.partner?.nameAr ?? '—',
        date: pi.billDate,
        total: pi.total,
        paid: pi.paid,
        taxTotal: pi.taxTotal,
        status: pi.status,
      }))
      return ok({ rows, totalPurchases: rows.reduce((s, r) => s + r.total, 0), count: rows.length })
    }

    if (type === 'purchases-by-supplier') {
      const suppliers = await db.partner.findMany({
        where: { isSupplier: true },
        include: { purchaseInvoices: { select: { total: true, paid: true } } },
      })
      const rows = suppliers.map((s) => {
        const invoiced = s.purchaseInvoices.reduce((x, i) => x + i.total, 0)
        const paid = s.purchaseInvoices.reduce((x, i) => x + i.paid, 0)
        return {
          code: s.code,
          name: s.nameAr,
          invoicesCount: s.purchaseInvoices.length,
          totalInvoiced: invoiced,
          totalPaid: paid,
          balance: invoiced - paid,
        }
      })
      return ok({ rows, totalPurchases: rows.reduce((s, r) => s + r.totalInvoiced, 0) })
    }

    if (type === 'stock-moves-rep' || type === 'stock-moves') {
      const moves = await db.stockMove.findMany({
        take: 100,
        orderBy: { postingDate: 'desc' },
        include: {
          product: { select: { sku: true, nameAr: true } },
          sourceWarehouse: { select: { nameAr: true } },
          destWarehouse: { select: { nameAr: true } },
        },
      })
      const rows = moves.map((m) => ({
        id: m.id,
        date: m.postingDate,
        sku: m.product?.sku ?? '—',
        productName: m.product?.nameAr ?? '—',
        sourceWarehouse: m.sourceWarehouse?.nameAr ?? '—',
        destWarehouse: m.destWarehouse?.nameAr ?? '—',
        documentType: m.documentType,
        quantity: m.quantity,
        status: m.state,
      }))
      return ok({ rows, count: rows.length })
    }

    if (type === 'employees-directory') {
      const employees = await db.employee.findMany({
        include: { department: { select: { nameAr: true } }, jobPosition: { select: { nameAr: true } } },
      })
      const rows = employees.map((e) => ({
        code: e.employeeNo,
        name: e.nameAr,
        dept: e.department?.nameAr ?? '—',
        job: e.jobPosition?.nameAr ?? '—',
        phone: e.phone ?? '—',
        email: e.email ?? '—',
        status: e.status,
      }))
      return ok({ rows, count: rows.length })
    }

    if (type === 'attendance-summary') {
      const logs = await db.attendance.findMany({
        take: 100,
        orderBy: { date: 'desc' },
        include: { employee: { select: { employeeNo: true, nameAr: true } } },
      })
      const rows = logs.map((a) => ({
        id: a.id,
        date: a.date,
        empCode: a.employee.employeeNo,
        empName: a.employee.nameAr,
        checkIn: a.checkIn,
        checkOut: a.checkOut,
        status: a.status,
      }))
      return ok({ rows, count: rows.length })
    }

    if (type === 'leave-summary') {
      const leaves = await db.leaveRequest.findMany({
        orderBy: { startDate: 'desc' },
        include: { employee: { select: { employeeNo: true, nameAr: true } } },
      })
      const rows = leaves.map((l) => ({
        id: l.id,
        empCode: l.employee.employeeNo,
        empName: l.employee.nameAr,
        leaveType: l.leaveType,
        startDate: l.startDate,
        endDate: l.endDate,
        days: l.days,
        status: l.status,
      }))
      return ok({ rows, count: rows.length })
    }

    return ok({ error: 'Unknown report type' })
  } catch (e: any) {
    return serverError(e.message)
  }
}

