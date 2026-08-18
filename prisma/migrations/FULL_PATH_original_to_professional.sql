-- DropForeignKey
ALTER TABLE "Branch" DROP CONSTRAINT "Branch_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Partner" DROP CONSTRAINT "Partner_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Warehouse" DROP CONSTRAINT "Warehouse_branchId_fkey";

-- DropForeignKey
ALTER TABLE "FiscalYear" DROP CONSTRAINT "FiscalYear_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SalesQuotation" DROP CONSTRAINT "SalesQuotation_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrder" DROP CONSTRAINT "SalesOrder_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "SalesInvoice" DROP CONSTRAINT "SalesInvoice_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "SalesCreditNote" DROP CONSTRAINT "SalesCreditNote_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "SalesPayment" DROP CONSTRAINT "SalesPayment_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseInvoice" DROP CONSTRAINT "PurchaseInvoice_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseCreditNote" DROP CONSTRAINT "PurchaseCreditNote_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "PurchasePayment" DROP CONSTRAINT "PurchasePayment_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "Contract" DROP CONSTRAINT "Contract_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "LeaveRequest" DROP CONSTRAINT "LeaveRequest_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "Payslip" DROP CONSTRAINT "Payslip_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "SalesReturn" DROP CONSTRAINT "SalesReturn_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseReturn" DROP CONSTRAINT "PurchaseReturn_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_branchId_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Revenue" DROP CONSTRAINT "Revenue_companyId_fkey";

-- AlterTable
ALTER TABLE "ExchangeRate" ALTER COLUMN "rate" SET DATA TYPE DECIMAL(20,10);

-- AlterTable
ALTER TABLE "TaxCode" ALTER COLUMN "rate" SET DATA TYPE DECIMAL(20,10);

-- AlterTable
ALTER TABLE "PaymentTerm" ALTER COLUMN "earlyPaymentDiscount" SET DATA TYPE DECIMAL(9,4);

-- AlterTable
ALTER TABLE "Partner" ALTER COLUMN "creditLimit" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "openingBalance" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "currentBalance" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "costPrice" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "salePrice" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "minStock" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "maxStock" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "reorderPoint" SET DATA TYPE DECIMAL(20,6);

-- AlterTable
ALTER TABLE "StockQuant" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "reservedQty" SET DATA TYPE DECIMAL(20,6);

-- AlterTable
ALTER TABLE "StockMove" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "valuationAmount" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "costPrice" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "StockValuationLayer" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "totalValue" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "remainingQty" SET DATA TYPE DECIMAL(20,6);

-- AlterTable
ALTER TABLE "StockReservation" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6);

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "accountClass" TEXT NOT NULL DEFAULT 'asset',
ADD COLUMN     "allowManualEntry" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowReconciliation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "currencyId" TEXT,
ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "deactivatedBy" TEXT,
ADD COLUMN     "fsSection" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "normalBalance" TEXT NOT NULL DEFAULT 'debit',
ADD COLUMN     "path" TEXT,
ADD COLUMN     "reportCategory" TEXT,
ADD COLUMN     "reportSubcategory" TEXT,
ADD COLUMN     "reportTags" TEXT,
ADD COLUMN     "requireBranch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requireCostCenter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requireProject" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shortName" TEXT,
ADD COLUMN     "taxBehavior" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "taxCodeId" TEXT,
ADD COLUMN     "updatedBy" TEXT,
ALTER COLUMN "balance" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "totalDebit" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "totalCredit" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "JournalLine" ALTER COLUMN "debit" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "credit" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "BankAccount" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "Safe" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "SalesQuotation" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxTotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "SalesQuotationLine" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "discountPercent" SET DATA TYPE DECIMAL(9,4),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(9,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "SalesOrder" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxTotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "paid" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "SalesOrderLine" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "deliveredQty" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "invoicedQty" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "discountPercent" SET DATA TYPE DECIMAL(9,4),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(9,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "SalesInvoice" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxTotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "paid" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "SalesInvoiceLine" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "discountPercent" SET DATA TYPE DECIMAL(9,4),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(9,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "SalesCreditNote" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxTotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "SalesPayment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "PurchaseRequestLine" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6);

-- AlterTable
ALTER TABLE "PurchaseOrder" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxTotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "paid" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "receivedQty" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "invoicedQty" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "discountPercent" SET DATA TYPE DECIMAL(9,4),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(9,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "GoodsReceiptLine" ALTER COLUMN "orderedQty" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "receivedQty" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "PurchaseInvoice" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxTotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "paid" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "PurchaseInvoiceLine" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "discountPercent" SET DATA TYPE DECIMAL(9,4),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(9,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "PurchaseCreditNote" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxTotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "PurchasePayment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "DeliveryLine" ALTER COLUMN "orderedQty" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "deliveredQty" SET DATA TYPE DECIMAL(20,6);

-- AlterTable
ALTER TABLE "StockTransferLine" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "doneQty" SET DATA TYPE DECIMAL(20,6);

-- AlterTable
ALTER TABLE "InventoryAdjustmentLine" ALTER COLUMN "systemQty" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "countedQty" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "variance" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "Bom" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6);

-- AlterTable
ALTER TABLE "BomComponent" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "scrapPercent" SET DATA TYPE DECIMAL(9,4);

-- AlterTable
ALTER TABLE "WorkCenter" ALTER COLUMN "capacityPerHour" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "costPerHour" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "ProductionOrder" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "producedQty" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "scrapQty" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "totalCost" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "Contract" ALTER COLUMN "baseSalary" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "allowances" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "LeaveRequest" ALTER COLUMN "days" SET DATA TYPE DECIMAL(9,2);

-- AlterTable
ALTER TABLE "PayrollRun" ALTER COLUMN "totalGross" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "totalDeductions" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "totalNet" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "Payslip" ALTER COLUMN "grossSalary" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "allowances" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "deductions" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "netSalary" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "SalesReturn" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxTotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "SalesReturnLine" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(9,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "PurchaseReturn" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxTotal" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "PurchaseReturnLine" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(20,6),
ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(20,4),
ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(9,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(20,4);

-- AlterTable
ALTER TABLE "Revenue" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(20,4);

-- CreateTable
CREATE TABLE "AccountRoleMapping" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL DEFAULT '*',
    "branchId" TEXT NOT NULL DEFAULT '*',
    "role" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountRoleMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesCreditNoteLine" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(20,6) NOT NULL,
    "uomId" TEXT,
    "unitPrice" DECIMAL(20,4) NOT NULL,
    "discountPercent" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "taxCodeId" TEXT,
    "taxRate" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(20,4) NOT NULL DEFAULT 0,

    CONSTRAINT "SalesCreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseCreditNoteLine" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(20,6) NOT NULL,
    "uomId" TEXT,
    "unitCost" DECIMAL(20,4) NOT NULL,
    "discountPercent" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "taxCodeId" TEXT,
    "taxRate" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(20,4) NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseCreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountRoleMapping_role_idx" ON "AccountRoleMapping"("role");

-- CreateIndex
CREATE INDEX "AccountRoleMapping_accountId_idx" ON "AccountRoleMapping"("accountId");

-- CreateIndex
CREATE INDEX "AccountRoleMapping_branchId_idx" ON "AccountRoleMapping"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountRoleMapping_companyId_branchId_role_key" ON "AccountRoleMapping"("companyId", "branchId", "role");

-- CreateIndex
CREATE INDEX "SalesCreditNoteLine_creditNoteId_idx" ON "SalesCreditNoteLine"("creditNoteId");

-- CreateIndex
CREATE INDEX "SalesCreditNoteLine_productId_idx" ON "SalesCreditNoteLine"("productId");

-- CreateIndex
CREATE INDEX "PurchaseCreditNoteLine_creditNoteId_idx" ON "PurchaseCreditNoteLine"("creditNoteId");

-- CreateIndex
CREATE INDEX "PurchaseCreditNoteLine_productId_idx" ON "PurchaseCreditNoteLine"("productId");

-- CreateIndex
CREATE INDEX "Company_currencyId_idx" ON "Company"("currencyId");

-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE INDEX "Branch_managerId_idx" ON "Branch"("managerId");

-- CreateIndex
CREATE INDEX "User_defaultCompanyId_idx" ON "User"("defaultCompanyId");

-- CreateIndex
CREATE INDEX "User_defaultBranchId_idx" ON "User"("defaultBranchId");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE INDEX "UserRole_companyId_idx" ON "UserRole"("companyId");

-- CreateIndex
CREATE INDEX "UserRole_branchId_idx" ON "UserRole"("branchId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_documentId_idx" ON "AuditLog"("documentId");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateId_idx" ON "OutboxEvent"("aggregateId");

-- CreateIndex
CREATE INDEX "OutboxEvent_userId_idx" ON "OutboxEvent"("userId");

-- CreateIndex
CREATE INDEX "Notification_correlationId_idx" ON "Notification"("correlationId");

-- CreateIndex
CREATE INDEX "ApprovalStep_documentId_idx" ON "ApprovalStep"("documentId");

-- CreateIndex
CREATE INDEX "ApprovalStep_status_idx" ON "ApprovalStep"("status");

-- CreateIndex
CREATE INDEX "NumberSequence_branchId_idx" ON "NumberSequence"("branchId");

-- CreateIndex
CREATE INDEX "SettingAuditLog_userId_idx" ON "SettingAuditLog"("userId");

-- CreateIndex
CREATE INDEX "ExchangeRate_baseCurrencyId_idx" ON "ExchangeRate"("baseCurrencyId");

-- CreateIndex
CREATE INDEX "Partner_companyId_idx" ON "Partner"("companyId");

-- CreateIndex
CREATE INDEX "Partner_countryId_idx" ON "Partner"("countryId");

-- CreateIndex
CREATE INDEX "Partner_paymentTermId_idx" ON "Partner"("paymentTermId");

-- CreateIndex
CREATE INDEX "Partner_receivableAccountId_idx" ON "Partner"("receivableAccountId");

-- CreateIndex
CREATE INDEX "Partner_payableAccountId_idx" ON "Partner"("payableAccountId");

-- CreateIndex
CREATE INDEX "PartnerContact_partnerId_idx" ON "PartnerContact"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerAddress_partnerId_idx" ON "PartnerAddress"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerBankAccount_partnerId_idx" ON "PartnerBankAccount"("partnerId");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_uomId_idx" ON "Product"("uomId");

-- CreateIndex
CREATE INDEX "Product_taxCodeId_idx" ON "Product"("taxCodeId");

-- CreateIndex
CREATE INDEX "Product_valuationAccountId_idx" ON "Product"("valuationAccountId");

-- CreateIndex
CREATE INDEX "Product_cogsAccountId_idx" ON "Product"("cogsAccountId");

-- CreateIndex
CREATE INDEX "Product_revenueAccountId_idx" ON "Product"("revenueAccountId");

-- CreateIndex
CREATE INDEX "Warehouse_branchId_idx" ON "Warehouse"("branchId");

-- CreateIndex
CREATE INDEX "StockLocation_warehouseId_idx" ON "StockLocation"("warehouseId");

-- CreateIndex
CREATE INDEX "StockLocation_parentId_idx" ON "StockLocation"("parentId");

-- CreateIndex
CREATE INDEX "StockQuant_warehouseId_idx" ON "StockQuant"("warehouseId");

-- CreateIndex
CREATE INDEX "StockQuant_locationId_idx" ON "StockQuant"("locationId");

-- CreateIndex
CREATE INDEX "StockQuant_lotId_idx" ON "StockQuant"("lotId");

-- CreateIndex
CREATE INDEX "StockLot_productId_idx" ON "StockLot"("productId");

-- CreateIndex
CREATE INDEX "StockMove_companyId_idx" ON "StockMove"("companyId");

-- CreateIndex
CREATE INDEX "StockMove_documentId_idx" ON "StockMove"("documentId");

-- CreateIndex
CREATE INDEX "StockMove_documentLineId_idx" ON "StockMove"("documentLineId");

-- CreateIndex
CREATE INDEX "StockMove_sourceWarehouseId_idx" ON "StockMove"("sourceWarehouseId");

-- CreateIndex
CREATE INDEX "StockMove_sourceLocationId_idx" ON "StockMove"("sourceLocationId");

-- CreateIndex
CREATE INDEX "StockMove_destWarehouseId_idx" ON "StockMove"("destWarehouseId");

-- CreateIndex
CREATE INDEX "StockMove_destLocationId_idx" ON "StockMove"("destLocationId");

-- CreateIndex
CREATE INDEX "StockMove_lotId_idx" ON "StockMove"("lotId");

-- CreateIndex
CREATE INDEX "StockMove_uomId_idx" ON "StockMove"("uomId");

-- CreateIndex
CREATE INDEX "StockValuationLayer_productId_idx" ON "StockValuationLayer"("productId");

-- CreateIndex
CREATE INDEX "StockValuationLayer_stockMoveId_idx" ON "StockValuationLayer"("stockMoveId");

-- CreateIndex
CREATE INDEX "StockReservation_productId_idx" ON "StockReservation"("productId");

-- CreateIndex
CREATE INDEX "StockReservation_warehouseId_idx" ON "StockReservation"("warehouseId");

-- CreateIndex
CREATE INDEX "StockReservation_documentId_idx" ON "StockReservation"("documentId");

-- CreateIndex
CREATE INDEX "StockReservation_state_idx" ON "StockReservation"("state");

-- CreateIndex
CREATE INDEX "Account_parentId_idx" ON "Account"("parentId");

-- CreateIndex
CREATE INDEX "Account_accountClass_idx" ON "Account"("accountClass");

-- CreateIndex
CREATE INDEX "Account_type_idx" ON "Account"("type");

-- CreateIndex
CREATE INDEX "Account_isPosting_active_idx" ON "Account"("isPosting", "active");

-- CreateIndex
CREATE INDEX "Account_path_idx" ON "Account"("path");

-- CreateIndex
CREATE INDEX "Account_currencyId_idx" ON "Account"("currencyId");

-- CreateIndex
CREATE INDEX "Account_taxCodeId_idx" ON "Account"("taxCodeId");

-- CreateIndex
CREATE INDEX "FiscalYear_companyId_idx" ON "FiscalYear"("companyId");

-- CreateIndex
CREATE INDEX "FiscalYear_state_idx" ON "FiscalYear"("state");

-- CreateIndex
CREATE INDEX "FiscalPeriod_fiscalYearId_idx" ON "FiscalPeriod"("fiscalYearId");

-- CreateIndex
CREATE INDEX "FiscalPeriod_state_idx" ON "FiscalPeriod"("state");

-- CreateIndex
CREATE INDEX "CostCenter_parentId_idx" ON "CostCenter"("parentId");

-- CreateIndex
CREATE INDEX "AnalyticAccount_parentId_idx" ON "AnalyticAccount"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversedById_key" ON "JournalEntry"("reversedById");

-- CreateIndex
CREATE INDEX "JournalEntry_companyId_idx" ON "JournalEntry"("companyId");

-- CreateIndex
CREATE INDEX "JournalEntry_branchId_idx" ON "JournalEntry"("branchId");

-- CreateIndex
CREATE INDEX "JournalEntry_journalId_idx" ON "JournalEntry"("journalId");

-- CreateIndex
CREATE INDEX "JournalEntry_refId_idx" ON "JournalEntry"("refId");

-- CreateIndex
CREATE INDEX "JournalEntry_currencyId_idx" ON "JournalEntry"("currencyId");

-- CreateIndex
CREATE INDEX "JournalEntry_state_idx" ON "JournalEntry"("state");

-- CreateIndex
CREATE INDEX "JournalEntry_fiscalPeriodId_idx" ON "JournalEntry"("fiscalPeriodId");

-- CreateIndex
CREATE INDEX "JournalEntry_reversedById_idx" ON "JournalEntry"("reversedById");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- CreateIndex
CREATE INDEX "JournalLine_partnerId_idx" ON "JournalLine"("partnerId");

-- CreateIndex
CREATE INDEX "JournalLine_costCenterId_idx" ON "JournalLine"("costCenterId");

-- CreateIndex
CREATE INDEX "JournalLine_analyticAccountId_idx" ON "JournalLine"("analyticAccountId");

-- CreateIndex
CREATE INDEX "JournalLine_taxCodeId_idx" ON "JournalLine"("taxCodeId");

-- CreateIndex
CREATE INDEX "BankAccount_companyId_idx" ON "BankAccount"("companyId");

-- CreateIndex
CREATE INDEX "BankAccount_currencyId_idx" ON "BankAccount"("currencyId");

-- CreateIndex
CREATE INDEX "BankAccount_accountId_idx" ON "BankAccount"("accountId");

-- CreateIndex
CREATE INDEX "Safe_companyId_idx" ON "Safe"("companyId");

-- CreateIndex
CREATE INDEX "Safe_branchId_idx" ON "Safe"("branchId");

-- CreateIndex
CREATE INDEX "Safe_currencyId_idx" ON "Safe"("currencyId");

-- CreateIndex
CREATE INDEX "Safe_accountId_idx" ON "Safe"("accountId");

-- CreateIndex
CREATE INDEX "SalesQuotation_companyId_idx" ON "SalesQuotation"("companyId");

-- CreateIndex
CREATE INDEX "SalesQuotation_branchId_idx" ON "SalesQuotation"("branchId");

-- CreateIndex
CREATE INDEX "SalesQuotation_partnerId_idx" ON "SalesQuotation"("partnerId");

-- CreateIndex
CREATE INDEX "SalesQuotation_priceListId_idx" ON "SalesQuotation"("priceListId");

-- CreateIndex
CREATE INDEX "SalesQuotation_currencyId_idx" ON "SalesQuotation"("currencyId");

-- CreateIndex
CREATE INDEX "SalesQuotation_paymentTermId_idx" ON "SalesQuotation"("paymentTermId");

-- CreateIndex
CREATE INDEX "SalesQuotation_status_idx" ON "SalesQuotation"("status");

-- CreateIndex
CREATE INDEX "SalesQuotation_convertedSalesOrderId_idx" ON "SalesQuotation"("convertedSalesOrderId");

-- CreateIndex
CREATE INDEX "SalesQuotationLine_quotationId_idx" ON "SalesQuotationLine"("quotationId");

-- CreateIndex
CREATE INDEX "SalesQuotationLine_productId_idx" ON "SalesQuotationLine"("productId");

-- CreateIndex
CREATE INDEX "SalesQuotationLine_uomId_idx" ON "SalesQuotationLine"("uomId");

-- CreateIndex
CREATE INDEX "SalesQuotationLine_taxCodeId_idx" ON "SalesQuotationLine"("taxCodeId");

-- CreateIndex
CREATE INDEX "SalesOrder_companyId_idx" ON "SalesOrder"("companyId");

-- CreateIndex
CREATE INDEX "SalesOrder_branchId_idx" ON "SalesOrder"("branchId");

-- CreateIndex
CREATE INDEX "SalesOrder_partnerId_idx" ON "SalesOrder"("partnerId");

-- CreateIndex
CREATE INDEX "SalesOrder_quotationId_idx" ON "SalesOrder"("quotationId");

-- CreateIndex
CREATE INDEX "SalesOrder_priceListId_idx" ON "SalesOrder"("priceListId");

-- CreateIndex
CREATE INDEX "SalesOrder_currencyId_idx" ON "SalesOrder"("currencyId");

-- CreateIndex
CREATE INDEX "SalesOrder_paymentTermId_idx" ON "SalesOrder"("paymentTermId");

-- CreateIndex
CREATE INDEX "SalesOrder_warehouseId_idx" ON "SalesOrder"("warehouseId");

-- CreateIndex
CREATE INDEX "SalesOrder_salespersonId_idx" ON "SalesOrder"("salespersonId");

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status");

-- CreateIndex
CREATE INDEX "SalesOrderLine_orderId_idx" ON "SalesOrderLine"("orderId");

-- CreateIndex
CREATE INDEX "SalesOrderLine_productId_idx" ON "SalesOrderLine"("productId");

-- CreateIndex
CREATE INDEX "SalesOrderLine_uomId_idx" ON "SalesOrderLine"("uomId");

-- CreateIndex
CREATE INDEX "SalesOrderLine_taxCodeId_idx" ON "SalesOrderLine"("taxCodeId");

-- CreateIndex
CREATE INDEX "SalesInvoice_companyId_idx" ON "SalesInvoice"("companyId");

-- CreateIndex
CREATE INDEX "SalesInvoice_branchId_idx" ON "SalesInvoice"("branchId");

-- CreateIndex
CREATE INDEX "SalesInvoice_partnerId_idx" ON "SalesInvoice"("partnerId");

-- CreateIndex
CREATE INDEX "SalesInvoice_salesOrderId_idx" ON "SalesInvoice"("salesOrderId");

-- CreateIndex
CREATE INDEX "SalesInvoice_journalId_idx" ON "SalesInvoice"("journalId");

-- CreateIndex
CREATE INDEX "SalesInvoice_currencyId_idx" ON "SalesInvoice"("currencyId");

-- CreateIndex
CREATE INDEX "SalesInvoice_paymentTermId_idx" ON "SalesInvoice"("paymentTermId");

-- CreateIndex
CREATE INDEX "SalesInvoice_status_idx" ON "SalesInvoice"("status");

-- CreateIndex
CREATE INDEX "SalesInvoice_journalEntryId_idx" ON "SalesInvoice"("journalEntryId");

-- CreateIndex
CREATE INDEX "SalesInvoiceLine_invoiceId_idx" ON "SalesInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "SalesInvoiceLine_productId_idx" ON "SalesInvoiceLine"("productId");

-- CreateIndex
CREATE INDEX "SalesInvoiceLine_uomId_idx" ON "SalesInvoiceLine"("uomId");

-- CreateIndex
CREATE INDEX "SalesInvoiceLine_taxCodeId_idx" ON "SalesInvoiceLine"("taxCodeId");

-- CreateIndex
CREATE INDEX "SalesCreditNote_companyId_idx" ON "SalesCreditNote"("companyId");

-- CreateIndex
CREATE INDEX "SalesCreditNote_branchId_idx" ON "SalesCreditNote"("branchId");

-- CreateIndex
CREATE INDEX "SalesCreditNote_partnerId_idx" ON "SalesCreditNote"("partnerId");

-- CreateIndex
CREATE INDEX "SalesCreditNote_invoiceId_idx" ON "SalesCreditNote"("invoiceId");

-- CreateIndex
CREATE INDEX "SalesCreditNote_status_idx" ON "SalesCreditNote"("status");

-- CreateIndex
CREATE INDEX "SalesCreditNote_journalEntryId_idx" ON "SalesCreditNote"("journalEntryId");

-- CreateIndex
CREATE INDEX "SalesPayment_companyId_idx" ON "SalesPayment"("companyId");

-- CreateIndex
CREATE INDEX "SalesPayment_branchId_idx" ON "SalesPayment"("branchId");

-- CreateIndex
CREATE INDEX "SalesPayment_partnerId_idx" ON "SalesPayment"("partnerId");

-- CreateIndex
CREATE INDEX "SalesPayment_invoiceId_idx" ON "SalesPayment"("invoiceId");

-- CreateIndex
CREATE INDEX "SalesPayment_bankAccountId_idx" ON "SalesPayment"("bankAccountId");

-- CreateIndex
CREATE INDEX "SalesPayment_safeId_idx" ON "SalesPayment"("safeId");

-- CreateIndex
CREATE INDEX "SalesPayment_journalEntryId_idx" ON "SalesPayment"("journalEntryId");

-- CreateIndex
CREATE INDEX "SalesPayment_status_idx" ON "SalesPayment"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_companyId_idx" ON "PurchaseRequest"("companyId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_branchId_idx" ON "PurchaseRequest"("branchId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_requesterId_idx" ON "PurchaseRequest"("requesterId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequestLine_requestId_idx" ON "PurchaseRequestLine"("requestId");

-- CreateIndex
CREATE INDEX "PurchaseRequestLine_productId_idx" ON "PurchaseRequestLine"("productId");

-- CreateIndex
CREATE INDEX "PurchaseRequestLine_uomId_idx" ON "PurchaseRequestLine"("uomId");

-- CreateIndex
CREATE INDEX "PurchaseRequestLine_costCenterId_idx" ON "PurchaseRequestLine"("costCenterId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_idx" ON "PurchaseOrder"("companyId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_branchId_idx" ON "PurchaseOrder"("branchId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_partnerId_idx" ON "PurchaseOrder"("partnerId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_currencyId_idx" ON "PurchaseOrder"("currencyId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_paymentTermId_idx" ON "PurchaseOrder"("paymentTermId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_warehouseId_idx" ON "PurchaseOrder"("warehouseId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_orderId_idx" ON "PurchaseOrderLine"("orderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_productId_idx" ON "PurchaseOrderLine"("productId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_uomId_idx" ON "PurchaseOrderLine"("uomId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_taxCodeId_idx" ON "PurchaseOrderLine"("taxCodeId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_companyId_idx" ON "GoodsReceipt"("companyId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_branchId_idx" ON "GoodsReceipt"("branchId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_partnerId_idx" ON "GoodsReceipt"("partnerId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_warehouseId_idx" ON "GoodsReceipt"("warehouseId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_status_idx" ON "GoodsReceipt"("status");

-- CreateIndex
CREATE INDEX "GoodsReceipt_journalEntryId_idx" ON "GoodsReceipt"("journalEntryId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_receiptId_idx" ON "GoodsReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_productId_idx" ON "GoodsReceiptLine"("productId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_purchaseOrderLineId_idx" ON "GoodsReceiptLine"("purchaseOrderLineId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_uomId_idx" ON "GoodsReceiptLine"("uomId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_companyId_idx" ON "PurchaseInvoice"("companyId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_branchId_idx" ON "PurchaseInvoice"("branchId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_partnerId_idx" ON "PurchaseInvoice"("partnerId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_purchaseOrderId_idx" ON "PurchaseInvoice"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_journalId_idx" ON "PurchaseInvoice"("journalId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_currencyId_idx" ON "PurchaseInvoice"("currencyId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_paymentTermId_idx" ON "PurchaseInvoice"("paymentTermId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_status_idx" ON "PurchaseInvoice"("status");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_journalEntryId_idx" ON "PurchaseInvoice"("journalEntryId");

-- CreateIndex
CREATE INDEX "PurchaseInvoiceLine_invoiceId_idx" ON "PurchaseInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "PurchaseInvoiceLine_productId_idx" ON "PurchaseInvoiceLine"("productId");

-- CreateIndex
CREATE INDEX "PurchaseInvoiceLine_uomId_idx" ON "PurchaseInvoiceLine"("uomId");

-- CreateIndex
CREATE INDEX "PurchaseInvoiceLine_taxCodeId_idx" ON "PurchaseInvoiceLine"("taxCodeId");

-- CreateIndex
CREATE INDEX "PurchaseCreditNote_companyId_idx" ON "PurchaseCreditNote"("companyId");

-- CreateIndex
CREATE INDEX "PurchaseCreditNote_branchId_idx" ON "PurchaseCreditNote"("branchId");

-- CreateIndex
CREATE INDEX "PurchaseCreditNote_partnerId_idx" ON "PurchaseCreditNote"("partnerId");

-- CreateIndex
CREATE INDEX "PurchaseCreditNote_invoiceId_idx" ON "PurchaseCreditNote"("invoiceId");

-- CreateIndex
CREATE INDEX "PurchaseCreditNote_status_idx" ON "PurchaseCreditNote"("status");

-- CreateIndex
CREATE INDEX "PurchaseCreditNote_journalEntryId_idx" ON "PurchaseCreditNote"("journalEntryId");

-- CreateIndex
CREATE INDEX "PurchasePayment_companyId_idx" ON "PurchasePayment"("companyId");

-- CreateIndex
CREATE INDEX "PurchasePayment_branchId_idx" ON "PurchasePayment"("branchId");

-- CreateIndex
CREATE INDEX "PurchasePayment_partnerId_idx" ON "PurchasePayment"("partnerId");

-- CreateIndex
CREATE INDEX "PurchasePayment_invoiceId_idx" ON "PurchasePayment"("invoiceId");

-- CreateIndex
CREATE INDEX "PurchasePayment_bankAccountId_idx" ON "PurchasePayment"("bankAccountId");

-- CreateIndex
CREATE INDEX "PurchasePayment_safeId_idx" ON "PurchasePayment"("safeId");

-- CreateIndex
CREATE INDEX "PurchasePayment_journalEntryId_idx" ON "PurchasePayment"("journalEntryId");

-- CreateIndex
CREATE INDEX "PurchasePayment_status_idx" ON "PurchasePayment"("status");

-- CreateIndex
CREATE INDEX "Delivery_companyId_idx" ON "Delivery"("companyId");

-- CreateIndex
CREATE INDEX "Delivery_branchId_idx" ON "Delivery"("branchId");

-- CreateIndex
CREATE INDEX "Delivery_salesOrderId_idx" ON "Delivery"("salesOrderId");

-- CreateIndex
CREATE INDEX "Delivery_partnerId_idx" ON "Delivery"("partnerId");

-- CreateIndex
CREATE INDEX "Delivery_warehouseId_idx" ON "Delivery"("warehouseId");

-- CreateIndex
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");

-- CreateIndex
CREATE INDEX "Delivery_journalEntryId_idx" ON "Delivery"("journalEntryId");

-- CreateIndex
CREATE INDEX "DeliveryLine_deliveryId_idx" ON "DeliveryLine"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryLine_productId_idx" ON "DeliveryLine"("productId");

-- CreateIndex
CREATE INDEX "DeliveryLine_salesOrderLineId_idx" ON "DeliveryLine"("salesOrderLineId");

-- CreateIndex
CREATE INDEX "DeliveryLine_lotId_idx" ON "DeliveryLine"("lotId");

-- CreateIndex
CREATE INDEX "DeliveryLine_uomId_idx" ON "DeliveryLine"("uomId");

-- CreateIndex
CREATE INDEX "StockTransfer_companyId_idx" ON "StockTransfer"("companyId");

-- CreateIndex
CREATE INDEX "StockTransfer_fromWarehouseId_idx" ON "StockTransfer"("fromWarehouseId");

-- CreateIndex
CREATE INDEX "StockTransfer_toWarehouseId_idx" ON "StockTransfer"("toWarehouseId");

-- CreateIndex
CREATE INDEX "StockTransfer_status_idx" ON "StockTransfer"("status");

-- CreateIndex
CREATE INDEX "StockTransferLine_transferId_idx" ON "StockTransferLine"("transferId");

-- CreateIndex
CREATE INDEX "StockTransferLine_productId_idx" ON "StockTransferLine"("productId");

-- CreateIndex
CREATE INDEX "StockTransferLine_uomId_idx" ON "StockTransferLine"("uomId");

-- CreateIndex
CREATE INDEX "StockTransferLine_lotId_idx" ON "StockTransferLine"("lotId");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_companyId_idx" ON "InventoryAdjustment"("companyId");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_warehouseId_idx" ON "InventoryAdjustment"("warehouseId");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_reasonCodeId_idx" ON "InventoryAdjustment"("reasonCodeId");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_status_idx" ON "InventoryAdjustment"("status");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_journalEntryId_idx" ON "InventoryAdjustment"("journalEntryId");

-- CreateIndex
CREATE INDEX "InventoryAdjustmentLine_adjustmentId_idx" ON "InventoryAdjustmentLine"("adjustmentId");

-- CreateIndex
CREATE INDEX "InventoryAdjustmentLine_productId_idx" ON "InventoryAdjustmentLine"("productId");

-- CreateIndex
CREATE INDEX "InventoryAdjustmentLine_lotId_idx" ON "InventoryAdjustmentLine"("lotId");

-- CreateIndex
CREATE INDEX "Bom_companyId_idx" ON "Bom"("companyId");

-- CreateIndex
CREATE INDEX "Bom_productId_idx" ON "Bom"("productId");

-- CreateIndex
CREATE INDEX "Bom_status_idx" ON "Bom"("status");

-- CreateIndex
CREATE INDEX "BomComponent_bomId_idx" ON "BomComponent"("bomId");

-- CreateIndex
CREATE INDEX "BomComponent_productId_idx" ON "BomComponent"("productId");

-- CreateIndex
CREATE INDEX "BomComponent_uomId_idx" ON "BomComponent"("uomId");

-- CreateIndex
CREATE INDEX "ProductionOrder_companyId_idx" ON "ProductionOrder"("companyId");

-- CreateIndex
CREATE INDEX "ProductionOrder_branchId_idx" ON "ProductionOrder"("branchId");

-- CreateIndex
CREATE INDEX "ProductionOrder_bomId_idx" ON "ProductionOrder"("bomId");

-- CreateIndex
CREATE INDEX "ProductionOrder_productId_idx" ON "ProductionOrder"("productId");

-- CreateIndex
CREATE INDEX "ProductionOrder_status_idx" ON "ProductionOrder"("status");

-- CreateIndex
CREATE INDEX "ProductionOrder_journalEntryId_idx" ON "ProductionOrder"("journalEntryId");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE INDEX "Employee_branchId_idx" ON "Employee"("branchId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_jobPositionId_idx" ON "Employee"("jobPositionId");

-- CreateIndex
CREATE INDEX "Employee_partnerId_idx" ON "Employee"("partnerId");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_nationalId_idx" ON "Employee"("nationalId");

-- CreateIndex
CREATE INDEX "Department_parentId_idx" ON "Department"("parentId");

-- CreateIndex
CREATE INDEX "Department_managerId_idx" ON "Department"("managerId");

-- CreateIndex
CREATE INDEX "Contract_employeeId_idx" ON "Contract"("employeeId");

-- CreateIndex
CREATE INDEX "Contract_currencyId_idx" ON "Contract"("currencyId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "Attendance_employeeId_idx" ON "Attendance"("employeeId");

-- CreateIndex
CREATE INDEX "Attendance_status_idx" ON "Attendance"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_approverId_idx" ON "LeaveRequest"("approverId");

-- CreateIndex
CREATE INDEX "PayrollRun_companyId_idx" ON "PayrollRun"("companyId");

-- CreateIndex
CREATE INDEX "PayrollRun_status_idx" ON "PayrollRun"("status");

-- CreateIndex
CREATE INDEX "PayrollRun_journalEntryId_idx" ON "PayrollRun"("journalEntryId");

-- CreateIndex
CREATE INDEX "Payslip_payrollRunId_idx" ON "Payslip"("payrollRunId");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_idx" ON "Payslip"("employeeId");

-- CreateIndex
CREATE INDEX "Payslip_status_idx" ON "Payslip"("status");

-- CreateIndex
CREATE INDEX "SalesReturn_companyId_idx" ON "SalesReturn"("companyId");

-- CreateIndex
CREATE INDEX "SalesReturn_branchId_idx" ON "SalesReturn"("branchId");

-- CreateIndex
CREATE INDEX "SalesReturn_partnerId_idx" ON "SalesReturn"("partnerId");

-- CreateIndex
CREATE INDEX "SalesReturn_originalInvoiceId_idx" ON "SalesReturn"("originalInvoiceId");

-- CreateIndex
CREATE INDEX "SalesReturn_status_idx" ON "SalesReturn"("status");

-- CreateIndex
CREATE INDEX "SalesReturn_journalEntryId_idx" ON "SalesReturn"("journalEntryId");

-- CreateIndex
CREATE INDEX "SalesReturnLine_returnId_idx" ON "SalesReturnLine"("returnId");

-- CreateIndex
CREATE INDEX "SalesReturnLine_productId_idx" ON "SalesReturnLine"("productId");

-- CreateIndex
CREATE INDEX "SalesReturnLine_uomId_idx" ON "SalesReturnLine"("uomId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_companyId_idx" ON "PurchaseReturn"("companyId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_branchId_idx" ON "PurchaseReturn"("branchId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_partnerId_idx" ON "PurchaseReturn"("partnerId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_originalInvoiceId_idx" ON "PurchaseReturn"("originalInvoiceId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_status_idx" ON "PurchaseReturn"("status");

-- CreateIndex
CREATE INDEX "PurchaseReturn_journalEntryId_idx" ON "PurchaseReturn"("journalEntryId");

-- CreateIndex
CREATE INDEX "PurchaseReturnLine_returnId_idx" ON "PurchaseReturnLine"("returnId");

-- CreateIndex
CREATE INDEX "PurchaseReturnLine_productId_idx" ON "PurchaseReturnLine"("productId");

-- CreateIndex
CREATE INDEX "PurchaseReturnLine_uomId_idx" ON "PurchaseReturnLine"("uomId");

-- CreateIndex
CREATE INDEX "Activity_branchId_idx" ON "Activity"("branchId");

-- CreateIndex
CREATE INDEX "Expense_companyId_idx" ON "Expense"("companyId");

-- CreateIndex
CREATE INDEX "Expense_branchId_idx" ON "Expense"("branchId");

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "Expense"("status");

-- CreateIndex
CREATE INDEX "Expense_bankAccountId_idx" ON "Expense"("bankAccountId");

-- CreateIndex
CREATE INDEX "Expense_safeId_idx" ON "Expense"("safeId");

-- CreateIndex
CREATE INDEX "Revenue_companyId_idx" ON "Revenue"("companyId");

-- CreateIndex
CREATE INDEX "Revenue_branchId_idx" ON "Revenue"("branchId");

-- CreateIndex
CREATE INDEX "Revenue_status_idx" ON "Revenue"("status");

-- CreateIndex
CREATE INDEX "Revenue_bankAccountId_idx" ON "Revenue"("bankAccountId");

-- CreateIndex
CREATE INDEX "Revenue_safeId_idx" ON "Revenue"("safeId");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockValuationLayer" ADD CONSTRAINT "StockValuationLayer_stockMoveId_fkey" FOREIGN KEY ("stockMoveId") REFERENCES "StockMove"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountRoleMapping" ADD CONSTRAINT "AccountRoleMapping_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Safe" ADD CONSTRAINT "Safe_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuotation" ADD CONSTRAINT "SalesQuotation_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesCreditNote" ADD CONSTRAINT "SalesCreditNote_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPayment" ADD CONSTRAINT "SalesPayment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseCreditNote" ADD CONSTRAINT "PurchaseCreditNote_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revenue" ADD CONSTRAINT "Revenue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesCreditNoteLine" ADD CONSTRAINT "SalesCreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "SalesCreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesCreditNoteLine" ADD CONSTRAINT "SalesCreditNoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseCreditNoteLine" ADD CONSTRAINT "PurchaseCreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "PurchaseCreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseCreditNoteLine" ADD CONSTRAINT "PurchaseCreditNoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

