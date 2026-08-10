import { db } from '../src/lib/db'
async function countAllRecords() {
    console.log('--- DB SUMMARY COUNTS ---')
    const results: Record<string, number> = {
        Company: await db.company.count(),
        Branch: await db.branch.count(),
        User: await db.user.count(),
        Role: await db.role.count(),
        UserRole: await db.userRole.count(),
        Account: await db.account.count(),
        Journal: await db.journal.count(),
        FiscalYear: await db.fiscalYear.count(),
        FiscalPeriod: await db.fiscalPeriod.count(),
        Partner: await db.partner.count(),
        Category: await db.category.count(),
        Product: await db.product.count(),
        Warehouse: await db.warehouse.count(),
        StockLocation: await db.stockLocation.count(),
        StockQuant: await db.stockQuant.count(),
        StockMove: await db.stockMove.count(),
        JournalEntry: await db.journalEntry.count(),
        JournalLine: await db.journalLine.count(),
        SalesQuotation: await db.salesQuotation.count(),
        SalesOrder: await db.salesOrder.count(),
        SalesInvoice: await db.salesInvoice.count(),
        PurchaseOrder: await db.purchaseOrder.count(),
        PurchaseInvoice: await db.purchaseInvoice.count(),
        AuditLog: await db.auditLog.count(),
        Setting: await db.setting.count(),
    }
    console.log(JSON.stringify(results, null, 2))
}
countAllRecords()
    .catch((e) => console.error(e))
    .finally(async () => {
        await db.$disconnect()
    })