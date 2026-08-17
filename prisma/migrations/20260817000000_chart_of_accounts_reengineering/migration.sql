-- =====================================================================
-- Chart of Accounts re-engineering — schema migration
-- Safe to run on an existing database with live data:
--   * every ALTER uses IF NOT EXISTS
--   * every new column is nullable or has a DEFAULT, so existing rows stay valid
--   * no column is dropped and no row is deleted
--   * backfills are idempotent (re-running changes nothing)
-- Apply with `prisma migrate deploy`, or directly via psql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Account: enterprise master-data columns
-- ---------------------------------------------------------------------
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "shortName"           TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "accountClass"        TEXT NOT NULL DEFAULT 'asset';
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "normalBalance"       TEXT NOT NULL DEFAULT 'debit';
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "currencyId"          TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "allowReconciliation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "allowManualEntry"    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "taxBehavior"         TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "taxCodeId"           TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "fsSection"           TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "reportCategory"      TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "reportSubcategory"   TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "reportTags"          TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "requireCostCenter"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "requireBranch"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "requireProject"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "level"               INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "path"                TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "deactivatedAt"       TIMESTAMP(3);
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "deactivatedBy"       TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "createdBy"           TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "updatedBy"           TEXT;

-- Foreign keys for the new optional relations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_currencyId_fkey') THEN
    ALTER TABLE "Account"
      ADD CONSTRAINT "Account_currencyId_fkey"
      FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_taxCodeId_fkey') THEN
    ALTER TABLE "Account"
      ADD CONSTRAINT "Account_taxCodeId_fkey"
      FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Backfill accountClass / normalBalance / fsSection from legacy `type`
--    Only rows still holding the default are touched, so re-runs are no-ops.
-- ---------------------------------------------------------------------
UPDATE "Account" SET "accountClass" =
  CASE
    WHEN "type" = 'asset'     THEN 'asset'
    WHEN "type" = 'liability' THEN 'liability'
    WHEN "type" = 'equity'    THEN 'equity'
    WHEN "type" = 'income'    THEN CASE WHEN COALESCE("subtype",'') ILIKE '%other%' THEN 'other_income' ELSE 'revenue' END
    WHEN "type" = 'expense'   THEN CASE
                                    WHEN COALESCE("subtype",'') IN ('cogs','purchases') THEN 'cogs'
                                    WHEN COALESCE("subtype",'') IN ('other_expense','fx_loss','finance_cost') THEN 'other_expense'
                                    ELSE 'operating_expense'
                                  END
    ELSE 'asset'
  END
WHERE "accountClass" = 'asset' AND "type" <> 'asset';

UPDATE "Account" SET "normalBalance" =
  CASE WHEN "accountClass" IN ('liability','equity','revenue','other_income') THEN 'credit' ELSE 'debit' END
WHERE "normalBalance" = 'debit' AND "accountClass" IN ('liability','equity','revenue','other_income');

UPDATE "Account" SET "fsSection" =
  CASE WHEN "accountClass" IN ('asset','liability','equity') THEN 'balance_sheet' ELSE 'income_statement' END
WHERE "fsSection" = 'none';

-- ---------------------------------------------------------------------
-- 3. Backfill the materialized hierarchy (path / level) for existing rows
-- ---------------------------------------------------------------------
WITH RECURSIVE tree AS (
  SELECT "id", "parentId", '/' || "id" AS path, 0 AS lvl
  FROM "Account" WHERE "parentId" IS NULL
  UNION ALL
  SELECT a."id", a."parentId", t.path || '/' || a."id", t.lvl + 1
  FROM "Account" a JOIN tree t ON a."parentId" = t."id"
)
UPDATE "Account" a
SET "path" = t.path, "level" = t.lvl
FROM tree t
WHERE a."id" = t."id" AND (a."path" IS DISTINCT FROM t.path OR a."level" IS DISTINCT FROM t.lvl);

-- Any row left without a path (orphaned parentId) is treated as a root.
UPDATE "Account" SET "path" = '/' || "id", "level" = 0 WHERE "path" IS NULL;

-- ---------------------------------------------------------------------
-- 4. Account determination table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AccountRoleMapping" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT NOT NULL DEFAULT '*',
  "branchId"  TEXT NOT NULL DEFAULT '*',
  "role"      TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountRoleMapping_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccountRoleMapping_accountId_fkey') THEN
    ALTER TABLE "AccountRoleMapping"
      ADD CONSTRAINT "AccountRoleMapping_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- One account per role per scope. '*' sentinels (instead of NULL) make this
-- constraint actually bite — Postgres treats NULLs as distinct.
CREATE UNIQUE INDEX IF NOT EXISTS "AccountRoleMapping_companyId_branchId_role_key"
  ON "AccountRoleMapping"("companyId", "branchId", "role");
CREATE INDEX IF NOT EXISTS "AccountRoleMapping_role_idx"      ON "AccountRoleMapping"("role");
CREATE INDEX IF NOT EXISTS "AccountRoleMapping_accountId_idx" ON "AccountRoleMapping"("accountId");

-- ---------------------------------------------------------------------
-- 5. Indexes the chart, ledger and trial balance actually need
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "Account_parentId_idx"          ON "Account"("parentId");
CREATE INDEX IF NOT EXISTS "Account_accountClass_idx"      ON "Account"("accountClass");
CREATE INDEX IF NOT EXISTS "Account_type_idx"              ON "Account"("type");
CREATE INDEX IF NOT EXISTS "Account_isPosting_active_idx"  ON "Account"("isPosting", "active");
CREATE INDEX IF NOT EXISTS "Account_path_idx"              ON "Account"("path");
CREATE INDEX IF NOT EXISTS "JournalLine_accountId_idx"     ON "JournalLine"("accountId");
CREATE INDEX IF NOT EXISTS "JournalLine_entryId_idx"       ON "JournalLine"("entryId");
CREATE INDEX IF NOT EXISTS "JournalLine_partnerId_idx"     ON "JournalLine"("partnerId");
