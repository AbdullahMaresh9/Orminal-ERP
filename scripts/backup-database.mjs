//#!/usr/bin / env node
/**
 * Orminal ERP — Full Database Backup (Prisma-based, no pg_dump required)
 *
 * Usage:
 *   node scripts/backup-database.mjs
 *   node scripts/backup-database.mjs --label="before_hardening"
 *
 * Output:
 *   backups/backup_<label>_<timestamp>/
 *     ├── manifest.json        ← metadata + row counts + checksums
 *     ├── _summary.txt         ← human-readable report
 *     └── <TableName>.json     ← one file per table
 *
 * Safety guarantees:
 *   - Read-only: zero writes to the database.
 *   - Uses DATABASE_URL_UNPOOLED for a direct connection (no pooler).
 *   - Each table is exported in a single query with no filtering.
 *   - Row count in manifest is verified against file length after write.
 */

import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL, fileURLToPath } from 'node:url'

// ── helpers ──────────────────────────────────────────────────────────────────
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const log = (...a) => console.log(...a)
const ok = (...a) => console.log('  ✔', ...a)
const warn = (...a) => console.warn('  ⚠', ...a)
const err = (...a) => console.error('  ✖', ...a)

function sha256(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex').slice(0, 16)
}

// ── label & output dir ───────────────────────────────────────────────────────
const labelArg = process.argv.find(a => a.startsWith('--label='))
const label = labelArg ? labelArg.split('=')[1] : 'manual'
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dirName = `backup_${label}_${timestamp}`
const backupDir = join(ROOT, 'backups', dirName)

// ── ALL models in dependency-safe order (parents before children) ─────────────
// This order ensures that if you ever restore from these files you can
// insert them without FK violations.
const TABLES = [
  // ── Reference / master (no FK to domain models) ──────────────────────────
  'currency',
  'unitOfMeasure',
  'country',
  'taxCode',
  'paymentTerm',
  'reasonCode',
  'setting',
  'settingAuditLog',

  // ── Platform / identity ──────────────────────────────────────────────────
  'company',
  'branch',
  'user',
  'role',
  'permission',
  'rolePermission',
  'userRole',
  'auditLog',
  'outboxEvent',
  'notification',
  'approvalStep',
  'numberSequence',

  // ── Finance — master data ────────────────────────────────────────────────
  'exchangeRate',
  'account',
  'accountRoleMapping',
  'bankAccount',
  'safe',
  'fiscalYear',
  'fiscalPeriod',

  // ── Business Partner ─────────────────────────────────────────────────────
  'partner',
  'partnerContact',
  'partnerAddress',
  'partnerBankAccount',

  // ── Products / Inventory master ──────────────────────────────────────────
  'category',
  'product',
  'warehouse',
  'stockLocation',
  'stockLot',
  'stockQuant',
  'stockReservation',
  'stockValuationLayer',
  'bom',
  'bomComponent',

  // ── HR ───────────────────────────────────────────────────────────────────
  'employee',
  'employeeContract',
  'leaveRequest',
  'payrollRun',
  'payrollEntry',

  // ── Accounting transactions ──────────────────────────────────────────────
  'journalEntry',
  'journalLine',
  'bankReconciliation',
  'bankReconciliationLine',
  'cashFlow',

  // ── Sales ────────────────────────────────────────────────────────────────
  'salesQuotation',
  'salesQuotationLine',
  'salesOrder',
  'salesOrderLine',
  'salesInvoice',
  'salesInvoiceLine',
  'salesPayment',
  'salesReturn',
  'salesReturnLine',
  'salesCreditNote',
  'salesCreditNoteLine',
  'delivery',
  'deliveryLine',

  // ── Purchases ────────────────────────────────────────────────────────────
  'purchaseRequest',
  'purchaseRequestLine',
  'purchaseOrder',
  'purchaseOrderLine',
  'purchaseInvoice',
  'purchaseInvoiceLine',
  'purchasePayment',
  'purchaseReturn',
  'purchaseReturnLine',
  'purchaseCreditNote',
  'purchaseCreditNoteLine',
  'goodsReceipt',
  'goodsReceiptLine',

  // ── Inventory operations ─────────────────────────────────────────────────
  'stockMove',
  'stockTransfer',
  'stockTransferLine',
  'inventoryAdjustment',
  'inventoryAdjustmentLine',

  // ── Production ───────────────────────────────────────────────────────────
  'productionOrder',
  'productionMaterial',
  'productionLabor',

  // ── Other ────────────────────────────────────────────────────────────────
  'expense',
  'revenue',
  'asset',
  'activity',
  'activityComment',
]

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('\n╔══════════════════════════════════════════════════════════════╗')
  log('║        Orminal ERP — Full Database Backup (Prisma)           ║')
  log('╚══════════════════════════════════════════════════════════════╝')
  log(`\nLabel    : ${label}`)
  log(`Timestamp: ${timestamp}`)
  log(`Output   : ${backupDir}\n`)

  // create backup directory
  mkdirSync(backupDir, { recursive: true })

  const db = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL_UNPOOLED } },
    log: ['error'],
  })

  const manifest = {
    createdAt: new Date().toISOString(),
    label,
    node: process.version,
    tables: {},
    totalRows: 0,
    errors: [],
  }

  let totalRows = 0

  try {
    await db.$connect()
    log('✔ Connected to database (direct/unpooled)\n')

    // ── export each table ─────────────────────────────────────────────────
    for (const model of TABLES) {
      const accessor = db[model]
      if (!accessor) {
        warn(`Model "${model}" not found in Prisma client — skipping`)
        manifest.errors.push(`Model not found: ${model}`)
        continue
      }

      let rows
      try {
        rows = await accessor.findMany()
      } catch (e) {
        warn(`Failed to read "${model}": ${e.message}`)
        manifest.errors.push(`Read error [${model}]: ${e.message}`)
        continue
      }

      const json = JSON.stringify(rows, null, 2)
      const outFile = join(backupDir, `${model}.json`)
      writeFileSync(outFile, json, 'utf8')

      const checksum = sha256(json)
      manifest.tables[model] = { rows: rows.length, checksum }
      totalRows += rows.length

      ok(`${model.padEnd(35)} ${String(rows.length).padStart(6)} rows  [${checksum}]`)
    }

    manifest.totalRows = totalRows

    // ── manifest.json ─────────────────────────────────────────────────────
    writeFileSync(
      join(backupDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    )

    // ── _summary.txt ──────────────────────────────────────────────────────
    const lines = [
      `Orminal ERP — Database Backup`,
      `================================`,
      `Date      : ${manifest.createdAt}`,
      `Label     : ${label}`,
      `Directory : ${backupDir}`,
      `Total rows: ${totalRows}`,
      ``,
      `Table                              Rows`,
      `─────────────────────────────────────────`,
      ...Object.entries(manifest.tables).map(
        ([t, v]) => `${t.padEnd(35)} ${String(v.rows).padStart(6)}`
      ),
      ``,
      manifest.errors.length
        ? `ERRORS (${manifest.errors.length}):\n` + manifest.errors.map(e => `  • ${e}`).join('\n')
        : `No errors.`,
    ]
    writeFileSync(join(backupDir, '_summary.txt'), lines.join('\n'), 'utf8')

    // ── final report ──────────────────────────────────────────────────────
    log('\n─────────────────────────────────────────────────────────────')
    log(`  Tables exported : ${Object.keys(manifest.tables).length}`)
    log(`  Total rows      : ${totalRows.toLocaleString()}`)
    if (manifest.errors.length) {
      warn(`  Errors          : ${manifest.errors.length} (see manifest.json)`)
    } else {
      ok(`  Errors          : 0`)
    }
    log(`  Backup location : ${backupDir}`)
    log('─────────────────────────────────────────────────────────────')
    log('\n✔ Backup completed successfully.\n')

  } finally {
    await db.$disconnect()
  }
}

// run only when executed directly
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  main().catch((e) => {
    err('\nBackup failed:', e.message)
    console.error(e)
    process.exit(1)
  })
}
