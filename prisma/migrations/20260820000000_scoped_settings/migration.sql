-- System Configuration: scope settings per (company, branch).
-- '*' means "all" at that level (NULL would break the unique constraint —
-- Postgres treats NULLs as distinct). Existing rows become global ('*','*'),
-- which preserves current behaviour exactly.

ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "companyId" TEXT NOT NULL DEFAULT '*';
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "branchId"  TEXT NOT NULL DEFAULT '*';

DROP INDEX IF EXISTS "Setting_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Setting_key_companyId_branchId_key"
  ON "Setting"("key", "companyId", "branchId");
CREATE INDEX IF NOT EXISTS "Setting_companyId_branchId_idx"
  ON "Setting"("companyId", "branchId");

ALTER TABLE "SettingAuditLog" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "SettingAuditLog" ADD COLUMN IF NOT EXISTS "branchId"  TEXT;
ALTER TABLE "SettingAuditLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- Deprecated duplicate keys (superseded by numbering.invoicePrefix / numbering.poPrefix)
DELETE FROM "Setting" WHERE "key" IN ('sales.invoicePrefix', 'purchases.poPrefix');
