**تحليل شامل لمكونات النظام المحاسبي وERP**

تخصيص دقيق حسب Odoo و SAP S/4HANA مع الشجرات، الصلاحيات، سير العمل،
القيود المحاسبية، التقارير، قواعد الرقابة، وقواعد قاعدة البيانات

إعداد: M365 Copilot

**مخصص لـ: عبدالله Maresh**

تاريخ الإعداد: 06 يوليو 2026

# **مقدمة وتنبيه منهجي**

هذا الملف يجمع كل ما تم تقديمه في المحادثة حول مكونات النظام المحاسبي
وERP، ثم تخصيصه بدقة حسب Odoo وSAP S/4HANA، مع استكمال مصفوفات الصلاحيات
وسير العمل والقيود المحاسبية وقواعد الرقابة والجداول المقترحة. تم ترتيب
المحتوى في وثيقة Word احترافية ومنسقة، مع الحفاظ على جميع الأفكار
والأوامر والهيكليات التي تم تقديمها سابقًا.

ملاحظة: في Odoo تعتمد البنية غالبًا على التطبيقات Modules / Apps، بينما
في SAP S/4HANA تعتمد على الوحدات الوظيفية Functional Modules وتطبيقات
Fiori وسلاسل العمليات. لذلك توجد اختلافات في التسمية، لكن المنطق
التشغيلي والمحاسبي مترابط.

# **1) مكونات النظام المحاسبي العامة**

## **إدارة المبيعات**

-   الفواتير: فواتير بيع نقدي، فواتير بيع آجل

-   مرتجعات المبيعات: مرتجع كلي، مرتجع جزئي

-   عروض الأسعار

-   أوامر البيع

-   العملاء: بيانات العملاء، تصنيفات العملاء، حدود الائتمان

-   المدفوعات: سندات قبض، شيكات العملاء

-   الخصومات والعروض

-   تقارير المبيعات: المبيعات اليومية، حسب العميل، حسب الصنف

## **إدارة المشتريات**

-   أوامر الشراء

-   فواتير الشراء: نقدية، آجلة

-   مرتجعات المشتريات

-   الموردون: بيانات وتصنيفات الموردين

-   المدفوعات: سندات صرف، شيكات الموردين

-   مصاريف الشراء

-   تقارير المشتريات: حسب المورد، حسب الصنف

## **إدارة المخازن / المستودعات**

-   الأصناف: تعريف الصنف، وحدات القياس، الباركود

-   حركات المخزون: إدخال، إخراج، تحويل بين مخازن

-   الجرد: دوري، مفاجئ

-   تسعير الأصناف: متوسط، FIFO

-   تقارير المخزون: رصيد الصنف، حركة الصنف

## **إدارة الحسابات العامة**

-   دليل الحسابات: الأصول، الخصوم، حقوق الملكية، الإيرادات، المصروفات

-   القيود اليومية: عادية، افتتاحية، إقفال

-   مراكز التكلفة

-   العملات

-   التقارير المالية: الميزانية العمومية، قائمة الدخل، التدفقات النقدية

## **إدارة العملاء / الذمم المدينة**

-   حسابات العملاء

-   أعمار الديون

-   تسويات العملاء

-   إشعارات الخصم والإضافة

-   تقارير العملاء

## **إدارة الموردين / الذمم الدائنة**

-   حسابات الموردين

-   أعمار الديون

-   تسويات الموردين

-   إشعارات الخصم والإضافة

-   تقارير الموردين

## **إدارة الصندوق والبنوك**

-   الصناديق: صندوق رئيسي وصناديق فرعية

-   البنوك: حسابات بنكية

-   الحركات: قبض وصرف

-   التسويات البنكية

-   تقارير النقدية

## **إدارة الأصول الثابتة**

-   تعريف الأصول

-   فئات الأصول

-   الإهلاك: شهري وسنوي

-   إضافة أصل

-   استبعاد أصل

-   تقارير الأصول

## **إدارة الرواتب والموارد البشرية**

-   الموظفون: بيانات الموظف والعقود

-   الرواتب: الراتب الأساسي، البدلات، الخصومات

-   الحضور والانصراف

-   الإجازات

-   تقارير الرواتب

## **إدارة الضرائب**

-   ضريبة المبيعات / VAT

-   الإقرارات الضريبية

-   تسويات ضريبية

-   تقارير الضرائب

## **إدارة التقارير**

-   تقارير مالية

-   تقارير إدارية

-   تقارير تحليلية

-   تقارير مخصصة

# **2) شجرة Odoo ERP بدقة عالية**

## **Accounting / Invoicing --- المحاسبة والفوترة**

Accounting / Invoicing\
├── Dashboard\
│ ├── Bank\
│ ├── Cash\
│ ├── Customer Invoices\
│ ├── Vendor Bills\
│ └── Miscellaneous Operations\
├── Customers\
│ ├── Customer Invoices: Draft, Posted, Paid, Overdue\
│ ├── Credit Notes\
│ ├── Payments\
│ ├── Follow-up Reports\
│ └── Customers Master Data\
├── Vendors\
│ ├── Vendor Bills\
│ ├── Refunds\
│ ├── Payments\
│ ├── Vendor Master Data\
│ └── 3-Way Matching / Bill Control\
├── Accounting\
│ ├── Journal Entries\
│ ├── Journal Items\
│ ├── Journals: Sales, Purchase, Bank, Cash, Miscellaneous\
│ ├── Reconciliation\
│ └── Lock Dates\
├── Bank & Cash\
│ ├── Bank Accounts\
│ ├── Cash Registers\
│ ├── Bank Statements\
│ ├── Bank Synchronization\
│ └── Bank Reconciliation\
├── Configuration\
│ ├── Chart of Accounts\
│ ├── Taxes\
│ ├── Fiscal Positions\
│ ├── Payment Terms\
│ ├── Incoterms\
│ ├── Currencies\
│ ├── Journals\
│ ├── Analytic Accounts / Plans / Distribution\
│ └── Accounting Settings\
├── Assets\
├── Budgets\
├── Closing\
└── Reporting: Balance Sheet, P&L, Aged Receivable, Aged Payable, Trial
Balance, General Ledger, Partner Ledger, Tax Report, Cash Flow

## **Sales --- المبيعات**

Sales\
├── Orders\
│ ├── Quotations: Draft, Sent, Expired\
│ ├── Sales Orders\
│ ├── Orders to Invoice\
│ ├── Upselling Opportunities\
│ └── Locked Orders\
├── Customers: Customer List, Contacts, Addresses, Pricelist Assignment,
Payment Terms, Credit Limit\
├── Products: Products, Variants, Categories, UOM, Pricelists,
Discounts\
├── Invoicing: Create Invoice, Down Payments, Delivered / Ordered
Quantity Invoice, Credit Notes\
├── Delivery Integration: Delivery Orders, Shipping Methods, Tracking,
Backorders\
├── Returns: Return Request, Returned Products, Credit Note, Stock
Return\
└── Reporting: Sales Analysis, Salesperson Performance, Product Sales,
Customer Sales, Forecast

## **CRM --- إدارة علاقات العملاء**

CRM\
├── Leads: New, Assigned, Lost\
├── Opportunities: Pipeline, Activities, Meetings, Calls, Emails,
Probability / Expected Revenue\
├── Sales Teams: Members, Targets, Lead Assignment Rules, Team Pipeline\
├── Customers: Contacts, Communication History, Opportunities History\
└── Reporting: Pipeline Analysis, Activities Analysis, Lost Reasons,
Forecast

## **Purchase --- المشتريات**

Purchase\
├── Orders: RFQ, Purchase Orders, Purchase Agreements, Blanket Orders,
Calls for Tender\
├── Vendors: Master Data, Pricelists, Payment Terms, Lead Time, Vendor
Bills\
├── Products: Purchasable Products, Vendor Product Codes, Categories,
UOM, Reordering Rules\
├── Receipts: Incoming Shipments, Partial Receipts, Backorders, Quality
Checks\
├── Billing: Vendor Bills, Bill Control, Refunds, Payments\
├── Returns: Return to Vendor, Debit Note, Stock Adjustment\
└── Reporting: Purchase Analysis, Vendor Performance, Product Purchases,
RFQ / PO Status

## **Inventory --- المخزون والمستودعات**

Inventory\
├── Products: Products, Variants, Categories, UOM, Barcodes, Lots,
Serial Numbers, Expiration Dates\
├── Operations: Receipts, Deliveries, Internal Transfers, Manufacturing
Transfers, Pickings, Packings, Shipments, Scrap\
├── Warehouses\
│ ├── Warehouses\
│ ├── Locations: Vendor, Internal, Customer, Inventory Loss, Production,
Transit, Virtual\
│ ├── Storage Categories\
│ ├── Putaway Rules\
│ └── Routes\
├── Replenishment: Reordering Rules, Min/Max, Make to Order, Buy,
Manufacture, Replenishment Report\
├── Inventory Adjustments: Physical Inventory, Cycle Counts, Counted
Qty, Differences, Validation\
├── Traceability: Lots, Serial Numbers, Traceability Report, Product
Moves, Expiration Tracking\
├── Valuation: Stock Valuation, Standard Cost, AVCO, FIFO, Valuation
Report, Accounting Entries\
└── Reporting: Inventory Report, Forecasted Inventory, Moves History,
Stock Valuation, Product Moves

## **Manufacturing / MRP --- التصنيع**

Manufacturing\
├── Master Data: Products, BOM (Normal, Kit, Multi-level, Variant), Work
Centers, Routings, Operations\
├── Planning: MPS, Demand Forecast, Replenishment, MRP Rules, Capacity
Planning\
├── Operations: Manufacturing Orders, Work Orders, Shop Floor, Component
Consumption, Finished Goods Receipt, Backorders, Split, Merge, Unbuild\
├── Quality Integration: Checks, Points, Alerts, Nonconformity\
├── Maintenance Integration: Equipment, Preventive/Corrective
Maintenance, Requests\
├── Costing: BOM Cost, Work Center Cost, Labor, Overhead, MO Cost\
└── Reporting: Production Analysis, OEE, Delays, Work Center Loads,
Allocation Reports

## **Point of Sale --- نقاط البيع**

Point of Sale - POS\
├── Sessions: Open, Close, Cash Control, Session Validation\
├── Orders: POS Orders, Receipts, Refunds, Customer Notes\
├── Products: POS Products, Categories, Barcodes, Pricelists, Discounts\
├── Payments: Cash, Bank Card, Online Payment, Gift Cards, Customer
Account\
├── Configuration: POS Shops, Payment Methods, Receipt Layout, Taxes,
Cash Rounding\
└── Reporting: Sales Details, Cash Report, Product Sales, Session Report

## **Human Resources --- الموارد البشرية**

Human Resources\
├── Employees: Records, Private Information, Work Information,
Departments, Job Positions, Contracts\
├── Recruitment: Applications, Pipeline, Interviews, Job Offers\
├── Attendance: Check In, Check Out, Logs, Reports\
├── Time Off: Leave Requests, Allocations, Types, Approval Workflow\
├── Payroll: Salary Structures, Rules, Payslips, Batches, Reports\
├── Expenses: Claims, Approvals, Reimbursements, Accounting Entries\
└── Appraisals: Forms, Goals, Feedback, Performance Reports

## **Projects / Services --- المشاريع والخدمات**

Projects\
├── Projects: List, Stages, Members, Settings\
├── Tasks: Pipeline, Subtasks, Deadlines, Tags, Activities\
├── Timesheets: Entries, Billable / Non-billable Hours, Approval\
├── Billing: Fixed Price, Timesheet Billing, Milestone Billing,
Invoices\
└── Reporting: Profitability, Task Analysis, Timesheet Analysis,
Resource Utilization

# **3) شجرة SAP S/4HANA بدقة عالية**

## **SAP FI --- Financial Accounting / المحاسبة المالية**

SAP FI - Financial Accounting\
├── FI-GL General Ledger: Chart of Accounts, G/L Accounts, Journal
Entries, Recurring Entries, Accruals, Period Closing, FSV, Universal
Journal ACDOCA\
├── FI-AR Accounts Receivable: Business Partner / Customer, Invoices,
Incoming Payments, Dunning, Credit Memos, Clearing, Aging, Balance
Reports\
├── FI-AP Accounts Payable: Supplier, Vendor Invoices, Outgoing
Payments, APP, Debit Memos, Clearing, Aging, Balance Reports\
├── FI-AA Asset Accounting: Asset Classes, Master Data, Acquisition,
Transfer, Depreciation, Retirement, History Sheet\
├── FI-BL Bank Accounting: House Banks, Accounts, Statements, EBS, Cash
Journal, Reconciliation\
├── Tax Accounting: Input, Output, Withholding, Tax Codes, Tax Reports\
└── Financial Closing: Month-End, Year-End, FX Valuation, GR/IR
Clearing, Balance Carryforward, Statements

## **SAP CO --- Controlling / التكاليف والرقابة**

SAP CO\
├── Cost Element Accounting: Primary, Secondary, Groups\
├── Cost Center Accounting: Centers, Groups, Actual, Plan, Allocations,
Reports\
├── Profit Center Accounting: Centers, Groups, Assignments, Reports\
├── Internal Orders: Types, Master, Budgeting, Actual Costs, Settlement,
Reports\
├── Product Costing: Cost Estimate, Standard Cost, Actual Costing,
Material Ledger, Variance\
├── CO-PA: Market Segments, Characteristics, Value Fields, Margin,
Reports\
└── Budgeting / Planning: Cost, Revenue, Availability Control, Plan vs
Actual

## **SAP SD --- Sales and Distribution / المبيعات والتوزيع**

SAP SD\
├── Master Data: Business Partner / Customer, Material Sales Views,
Customer-Material Info, Pricing Conditions, Output Records, Credit
Master\
├── Pre-Sales: Inquiry, Quotation, Sales Contract, Scheduling Agreement\
├── Sales Order Processing: Sales Order, Item Categories, Schedule
Lines, ATP, Pricing, Taxes, Credit Check, Incompletion Log\
├── Shipping: Outbound Delivery, Picking, Packing, Transportation
Planning, PGI, POD\
├── Billing: Billing Documents, Invoice, Credit Memo, Debit Memo,
Cancellation, Accounting Posting\
├── Returns: Return Order, Return Delivery, Goods Receipt, Credit Memo
Request, Refund\
└── Reporting: Orders, Deliveries, Billing, Customer Analysis, Sales
Analytics

## **SAP MM --- Materials Management / المشتريات وإدارة المواد**

SAP MM\
├── Master Data: Material Master, Supplier, Purchasing Info Record,
Source List, Quota Arrangement, Service Master\
├── Purchasing: PR, RFQ, Quotation Comparison, PO, Contract, Scheduling
Agreement, Release Strategy\
├── Inventory Management MM-IM: GR, GI, Stock Transfer, Transfer
Posting, Reservation, Batch, Special Stocks\
├── Invoice Verification LIV: Vendor Invoice, Credit Memo, Three-Way
Match, Price/Quantity Variance, GR/IR Clearing\
├── Valuation: Material Valuation, Moving Average, Standard Price, Split
Valuation, Account Determination\
└── Reporting: PO Reports, Vendor Evaluation, Stock Reports, Material
Documents, Inventory Valuation

## **SAP Inventory Management --- MM-IM**

SAP Inventory Management\
├── Stock Management: Unrestricted, Quality Inspection, Blocked,
Transfer, Consignment, Project Stock\
├── Goods Movements: GR for PO/Production/without PO, GI for Sales/Cost
Center/Production/Scrapping, Transfer Posting, Stock Transfer\
├── Physical Inventory: Inventory Document, Counting, Differences, Cycle
Counting, Reports\
├── Batch / Serial: Batch Master, Classification, Serial Profile,
Traceability\
└── Integration: Purchasing, SD, PP, QM, PM, FI

## **SAP EWM / WM --- إدارة المستودعات المتقدمة**

SAP EWM / WM\
├── Warehouse Structure: Warehouse Number, Storage Type, Section, Bin,
Activity Area, Queue\
├── Inbound: Inbound Delivery, GR, Putaway, Deconsolidation, Quality
Integration\
├── Outbound: Outbound Delivery, Waves, Picking, Packing, Staging,
Loading, GI\
├── Internal Processes: Replenishment, Slotting, Rearrangement, Physical
Inventory, Posting Changes, Tasks\
├── Handling Units: Creation, Packing, Movement, Tracking\
└── Reporting: Warehouse Monitor, Stock Overview, Open Tasks, Resource
Utilization, KPIs

## **SAP PP --- Production Planning / تخطيط الإنتاج**

SAP PP\
├── Master Data: Material Master MRP Views, BOM, Work Center, Routing,
Production Version, Costing Integration\
├── Demand Management: PIR, Sales Order Demand, Forecast, Demand
Program\
├── MRP: MRP Run, Planned Orders, Purchase Requisitions, Exception
Messages, MRP List\
├── Production Execution: Orders, Release, Material Staging,
Confirmation, GI, GR, Settlement\
├── Capacity Planning: Requirements, Evaluation, Leveling, Work Center
Load\
└── Reporting: Production Orders, MRP, Capacity, Variance

## **SAP QM --- Quality Management / إدارة الجودة**

SAP QM\
├── Quality Planning: Inspection Plans, MIC, Sampling, Quality Info
Records\
├── Quality Inspection: Inspection Lot, Results, Usage Decision, Stock
Posting, Defects\
├── Notifications: Customer Complaint, Vendor Complaint, Internal
Problem, Tasks, Corrective Actions\
├── Integration: Procurement, Production, Delivery, Inventory Stock
Type\
└── Reporting: Defects, Vendor Quality, Customer Complaints, Inspection
Results

## **SAP PM --- Plant Maintenance / الصيانة**

SAP PM\
├── Technical Objects: Functional Locations, Equipment, Equipment BOM,
Measuring Points\
├── Processing: Notification, Order, Work Approval, Reservation,
Confirmation, TECO\
├── Preventive: Plans, Items, Task Lists, Scheduling, Call Objects\
├── Corrective: Breakdown Notification, Repair Order, Spare Parts Issue,
Cost Settlement\
└── Reporting: Equipment History, Breakdown, Cost, Backlog

## **SAP HCM / SuccessFactors --- الموارد البشرية**

SAP HCM / SuccessFactors\
├── Organization Management: Org Units, Positions, Jobs, Reporting
Structure\
├── Personnel Administration: Employee Master, Personal, Employment,
Contract, Personnel Actions\
├── Time Management: Attendance, Absences, Work Schedules, Time
Evaluation, Overtime\
├── Payroll: Wage Types, Payroll Areas, Payroll Run, Posting to
Accounting, Reports\
├── Recruitment: Job Requisition, Candidate, Interviews, Hiring\
└── Talent: Goals, Performance, Learning, Succession

## **SAP PS --- Project System / المشاريع**

SAP PS\
├── Project Structure: Project Definition, WBS, Networks, Activities,
Milestones\
├── Planning: Cost, Revenue, Material, Workforce, Scheduling\
├── Budgeting: Original Budget, Supplements, Returns, Availability
Control\
├── Execution: PRs, Reservations, Confirmations, Goods Movements,
Service Entry\
├── Settlement: Rules, Cost, Asset, Profitability\
└── Reporting: Cost, Budget, Progress, Cash Flow

# **4) مقارنة Odoo و SAP حسب الإدارات**

  -----------------------------------------------------------------------
  **الإدارة**             **في Odoo**             **في SAP S/4HANA**
  ----------------------- ----------------------- -----------------------
  المحاسبة                Accounting / Invoicing  FI + جزء من CO

  المبيعات                Sales + CRM + POS       SD

  المشتريات               Purchase                MM-PUR

  المخزون                 Inventory               MM-IM + EWM/WM

  التصنيع                 Manufacturing / MRP     PP

  الجودة                  Quality                 QM

  الصيانة                 Maintenance             PM

  الموارد البشرية         Employees / Payroll /   HCM / SuccessFactors
                          Time Off                

  المشاريع                Project + Timesheets    PS

  التكاليف                Analytic Accounting /   CO
                          Budgets                 

  البنوك والخزينة         Accounting Bank & Cash  FI-BL + Treasury

  الأصول                  Assets                  FI-AA

  التقارير                Reporting داخل كل تطبيق Embedded Analytics +
                                                  Fiori Reports
  -----------------------------------------------------------------------

# **5) الشجرة الموحدة المقترحة لمن يريد بناء ERP**

ERP System\
├── Finance: GL, AR, AP, Cash/Bank, Assets, Taxes, Budgeting, Cost
Centers, Profit Centers, Reports\
├── Sales: CRM, Customers, Quotations, Sales Orders, Deliveries,
Invoices, Returns, Reports\
├── Procurement: Suppliers, Purchase Requisitions, RFQ, PO, GR, Vendor
Bills, Payments, Reports\
├── Inventory and Warehouse: Products, Warehouses, Locations, Receipts,
Deliveries, Transfers, Adjustments, Valuation, Reports\
├── Manufacturing: BOM, Work Centers, Routings, Production Orders,
Consumption, Finished Goods, Costing, Reports\
├── Quality: Plans, Inspections, Defects, Corrective Actions, Reports\
├── Maintenance: Equipment, Preventive, Corrective, Work Orders,
Reports\
├── Human Resources: Employees, Contracts, Attendance, Leaves, Payroll,
Reports\
└── Management and Analytics: Dashboards, KPIs, BI, Audit Logs,
Approvals, Permissions

# **6) جدول الصلاحيات المقترح لنظام ERP**

الصلاحيات الأساسية المستخدمة في التحليل: Create إنشاء، Read عرض، Update
تعديل، Delete حذف، Approve اعتماد، Post ترحيل، Print طباعة، Export
تصدير، Cancel إلغاء، Reverse عكس/إرجاع، Import استيراد.

## **صلاحيات الإدارة المالية Finance**

Finance\
├── General Ledger\
│ ├── Chart of Accounts: View, Create, Edit, Delete, Archive\
│ ├── Journal Entries: Create Draft, Edit Draft, Post, Reverse, Cancel,
Print, Export\
│ ├── Journals: Sales, Purchase, Bank, Cash, Miscellaneous\
│ └── Closing: Month Closing, Year Closing, Lock/Unlock Period, Opening
Balance\
├── Accounts Receivable: Customer Invoices, Payments, Customer Reports\
├── Accounts Payable: Vendor Bills, Vendor Payments, Vendor Reports\
├── Cash and Bank: Cash Boxes, Bank Accounts, Statements,
Reconciliation, Transfers, Cash Flow\
├── Fixed Assets: Categories, Master, Acquisition, Depreciation,
Transfer, Disposal, Reports\
├── Taxes: Tax Codes, Input/Output, Withholding, Declaration, Reports\
└── Financial Reports: Trial Balance, GL, P&L, Balance Sheet, Cash Flow,
Partner Ledger, Tax Report

## **أدوار المالية**

Finance Manager: Full approval/posting/reports with restricted delete\
Accountant: Create/Edit draft entries and invoices, limited report
access, no posting unless authorized\
Cashier: Create receipt/payment drafts and print, no
approval/posting/cancel

## **صلاحيات المبيعات Sales**

Sales\
├── Customers: View, Create, Edit, Credit Limit, Block, Statement\
├── Quotations: Create, Edit, Send, Approve, Convert to Sales Order,
Cancel\
├── Sales Orders: Create, Edit, Confirm, Approve Discount, Check
Availability, Create Delivery, Cancel\
├── Invoices: Create from SO, Edit Draft, Post, Register Payment, Credit
Note, Print\
├── Returns: Request, Approve, Receive Goods, Credit Note, Close\
└── Reports: by Customer/Product/Salesperson, Target, Margin, Forecast\
Roles: Sales Representative owns records with limited discount; Sales
Manager full sales, approvals, returns and reports.

## **صلاحيات المشتريات Procurement / Purchase**

Purchase\
├── Suppliers: View, Create, Edit, Approve, Block, Statement\
├── Purchase Requisitions: Create, Edit, Submit, Approve, Reject,
Convert to RFQ\
├── RFQ: Create, Send, Receive Quotation, Compare, Select Supplier,
Convert to PO\
├── Purchase Orders: Create, Edit Draft, Approve, Send, Confirm, Cancel,
Close\
├── Goods Receipt: Receive, Partial Receipt, Quality, Reject, Return to
Vendor, Post Receipt\
├── Vendor Bills: Create from PO, Match PO/GR/Bill, Approve, Post, Debit
Note\
└── Reports: by Supplier/Product, Pending RFQs/POs, Supplier
Performance, Price Variance

## **صلاحيات المخزون والمستودعات Inventory**

Inventory\
├── Products: View, Create, Edit, Set Cost, Set Sales Price, Barcode,
UOM, Archive\
├── Warehouses: View, Create, Edit, Configure Locations, Routes\
├── Receipts: View, Receive, Validate, Print GRN, Cancel\
├── Deliveries: View, Pick, Pack, Validate, Print, Cancel\
├── Internal Transfers: Create, Approve, Validate Source/Destination,
Cancel\
├── Inventory Adjustment: Create Count, Enter Count, Review Difference,
Approve, Post, Print\
├── Lot / Serial: Create Lot, Assign Serial, Trace, History, Block Lot\
├── Valuation: Stock Value, Change Costing Method, Post Valuation,
Accounting Entries\
└── Reports: Stock On Hand, Forecast, Stock Card, Movement, Valuation,
Slow Moving, Expired

## **صلاحيات التصنيع Manufacturing**

Manufacturing\
├── Master Data: BOM, Work Centers, Routings\
├── Planning: Demand Forecast, MPS, MRP Run, Planned Orders, Convert
Planned Order\
├── Production Orders: Create, Confirm, Reserve, Release, Start,
Consumption, Finished Goods, Close, Cancel\
├── Shop Floor: Work Orders, Start/Pause/Finish, Scrap, Report Issue\
├── Production Costing: BOM/Work Center Cost, Variance, Post Cost,
Settle Order\
└── Reports: Production Orders, Efficiency, Variance, Scrap, OEE,
Manufacturing Cost

## **صلاحيات الجودة Quality**

Quality\
├── Master Data: Points, Plans, Criteria, Sampling, Teams\
├── Incoming: Inspect, Accept, Reject, Rework, Vendor Complaint\
├── Production: Inspect Work Order, Measurement, Approve In-process,
Reject Batch, Alert\
├── Outgoing: Inspect Delivery, Approve Shipment, Block, Customer
Complaint\
├── Nonconformance: NCR, Corrective Action, CAPA, Close\
└── Reports: Inspection, Defect, Supplier Quality, Complaints, KPI

## **صلاحيات الصيانة Maintenance**

Maintenance\
├── Equipment: Create, Edit, Assign Location/Responsible, History\
├── Preventive: Plans, Schedule, Generate Work Order, Approve Plan,
Close Cycle\
├── Corrective: Breakdown Request, Assign Technician, Work Order, Spare
Parts, Repair, Close\
├── Spare Parts: Request, Issue, Return, Track Consumption\
└── Reports: Downtime, Cost, Aging, Preventive Compliance, Breakdown

## **صلاحيات الموارد البشرية HR**

HR\
├── Employees: Create, Edit, Private Data, Salary Data, Archive,
Documents\
├── Contracts: Create, Edit, Approve, Renew, End\
├── Attendance: View, Edit, Correction, Reports\
├── Leaves: Create, Approve, Refuse, Allocate Balance, Reports\
├── Payroll: Salary Rules, Payslip, Review, Approve, Post to Accounting,
Print\
└── Reports: Employee List, Attendance, Leave Balance, Payroll, End of
Service

## **صلاحيات المشاريع Projects**

Projects\
├── Project Master: Create, Edit, Assign Manager/Team, Close\
├── Tasks: Create, Assign, Progress, Deadline, Close, Reopen\
├── Timesheets: Create, Submit, Approve, Reject\
├── Costing: Estimate, Actual, Compare Budget, Approve Additional Cost,
Settlement\
├── Billing: Milestone, Timesheet, Fixed Price, Customer Invoice\
└── Reports: Profitability, Cost, Progress, Resource Utilization, Budget
vs Actual

# **7) مصفوفة الصلاحيات حسب الدور**

System Administrator\
├── Users: Create, Edit, Disable, Reset Password, Assign Roles\
├── Roles and Permissions: Create/Edit/Delete Restricted/Assign/Remove\
├── System Settings: Company, Branch, Number Sequences Restricted,
Integrations, Backup\
└── Restrictions: لا يرحل قيود محاسبية دون دور مالي، لا يعتمد مدفوعات،
لا يحذف سجلات التدقيق، لا يعدل معاملات مالية مرحلة.\
\
CEO / Executive Viewer\
├── Dashboards: Financial, Sales, Inventory, Purchase, HR\
├── Reports: P&L, Balance Sheet, Cash Flow, Sales, Valuation, Budget vs
Actual\
└── Restrictions: No create/edit/delete/post; approve optional; export
controlled.\
\
Auditor\
├── Finance Read: Journal Entries, GL, Trial Balance, Tax, Statements\
├── Operations Read: Sales, Purchase, Inventory, Manufacturing, Payroll
Summary Restricted\
├── Audit Tools Read: Audit Logs, Approval History, User Activity,
Document Changes\
└── No Create/Edit/Delete/Approve/Post/Cancel.

# **8) Workflows مهمة جدًا في ERP**

دورة البيع Sales Cycle\
Quotation → Sales Order → Delivery Order → Customer Invoice → Payment
Receipt → Accounting Posting → Reports\
Odoo: Quotation → Confirm SO → Delivery → Invoice → Payment → Journal
Entry\
SAP: Inquiry/Quotation → Sales Order → Outbound Delivery →
Picking/Packing → PGI → Billing → FI Posting\
\
دورة الشراء Procurement Cycle\
Purchase Request → RFQ → Supplier Quotation → Purchase Order → Goods
Receipt → Vendor Bill → Payment → Accounting Posting\
Odoo: RFQ → PO → Receipt → Vendor Bill → Payment → Journal Entry\
SAP: PR → RFQ → Quotation Comparison → PO → GR → Invoice Verification →
Vendor Payment\
\
دورة المخزون Inventory Cycle\
Product Master → Purchase/Production Receipt → Internal Transfer →
Delivery/Consumption → Inventory Adjustment → Stock Valuation →
Accounting Entry\
\
دورة التصنيع Manufacturing Cycle\
BOM → MRP/MPS → Production Order → Component Reservation → GI to
Production → Work Order Execution → Finished Goods Receipt → Production
Costing → Order Closing

# **9) هيكل ملف Excel المقترح لتحليل ERP**

System \| Module \| Sub Module \| Parent Menu \| Child Menu \| Sub Child
Menu \| Screen / Form \| Document Type \| Action \| Workflow Step \|
Status From \| Status To \| Role \| Permission Level \| Create \| Read
\| Update \| Delete \| Approve \| Post \| Cancel \| Reverse \| Print \|
Export \| Import \| Company Scope \| Branch Scope \| Warehouse Scope \|
Cost Center Scope \| Data Ownership \| Audit Required \| Accounting
Impact \| Inventory Impact \| Approval Required \| Risk Level \| Notes

شرح أهم الأعمدة: System للنظام المرجعي، Module للوحدة الرئيسية، Sub
Module للوحدة الفرعية، Parent/Child/Sub Child للقوائم، Screen/Form
للشاشة، Document Type لنوع المستند، Action للإجراء، Workflow Step
للمرحلة، Status From/To للانتقال، Role للدور، Permission Level لمستوى
الصلاحية، Scope لتحديد نطاق الشركة/الفرع/المخزن/مركز التكلفة،
Audit/Accounting/Inventory/Approval/Risk للتحكم والرقابة.

# **10) نماذج صفوف جاهزة لمصفوفة الصلاحيات**

1\) المالية --- إنشاء قيد يومية\
System: Unified ERP \| Module: Finance \| Sub Module: General Ledger \|
Action: Create \| Role: Accountant\
Permission: Create Draft Only \| Create/Read/Update: Yes \|
Delete/Approve/Post/Cancel/Reverse: No \| Print: Yes \| Export/Import:
No\
Accounting Impact: Draft Accounting Impact \| Approval: Chief Accountant
Approval \| Risk: High\
Notes: المحاسب ينشئ القيد كمسودة ولا يستطيع ترحيله.\
\
2) المالية --- ترحيل القيد\
Role: Chief Accountant \| Action: Post \| From: Approved \| To: Posted\
Approve/Post/Reverse/Print/Export: Yes \| Update/Delete/Cancel: No \|
Audit: Critical \| Risk: Critical\
Notes: لا يسمح بتعديل القيد بعد الترحيل إلا بعكس قيد.\
\
3) المبيعات --- عرض السعر\
Role: Sales Representative \| Action: Create \| From: None \| To: Draft\
Create/Read/Update/Print: Yes \| Cancel Draft Only \| No
Accounting/Inventory Impact \| Risk: Medium\
Notes: لا ينتج قيد محاسبي ولا حركة مخزون من عرض السعر.\
\
4) المبيعات --- تأكيد أمر بيع\
Role: Sales Manager \| Action: Confirm \| From: Quotation Accepted \|
To: Sales Order Confirmed\
Inventory Impact: Reserved Quantity \| Approval: Required if credit
limit exceeded \| Risk: High\
\
5) المخزون --- تسليم بضاعة للعميل\
Role: Warehouse Manager \| Action: Validate Delivery \| From: Ready \|
To: Done\
Accounting: COGS Entry if perpetual inventory \| Inventory: Quantity and
Value Movement \| Risk: Critical\
\
6) المشتريات --- إنشاء أمر شراء\
Role: Purchase Officer \| Action: Create \| From: RFQ Accepted \| To:
Draft PO\
Approval: Purchase Manager Approval \| No Accounting/Inventory Impact
before receipt/bill \| Risk: High\
\
7) المشتريات --- استلام بضاعة\
Role: Warehouse Keeper \| Action: Validate Receipt \| PO must be
approved\
Accounting: Inventory/GRNI entry if automated valuation \| Inventory:
Quantity and Value Movement \| Risk: Critical\
\
8) الحسابات الدائنة --- ترحيل فاتورة مورد\
Role: AP Accountant \| Action: Post \| From: Approved \| To: Posted\
Accounting: Vendor Liability Entry \| Approval: Three-Way Match if
linked to PO \| Risk: Critical

# **11) سير الاعتمادات Approval Workflows**

اعتماد فاتورة مبيعات:\
Draft Invoice → Review by Accountant → Approval by Chief Accountant →
Post Invoice → Send to Customer → Register Payment → Reconcile Payment →
Close Invoice\
≤ 1,000: Accountant submit → Chief Accountant post\
\> 1,000 و≤ 10,000: Accountant submit → Chief Accountant approve →
Finance Manager post\
\> 10,000: Accountant submit → Chief Accountant review → Finance Manager
approve → General Manager approval → Posting\
\
اعتماد أمر شراء:\
Purchase Request → Department Manager → RFQ → Supplier Comparison →
Purchase Manager → Finance Budget Check → GM if high value → PO
Confirmation\
≤ 500: Department Manager\
\> 500 و≤ 5,000: Department Manager + Purchase Manager\
\> 5,000 و≤ 20,000: Department Manager + Purchase Manager + Finance
Manager\
\> 20,000: Department Manager + Purchase Manager + Finance Manager +
General Manager\
\
اعتماد سند صرف:\
Draft Payment Voucher → AP Accountant Review → Chief Accountant →
Finance Manager → Cashier/Bank Officer Execution → Posting →
Reconciliation\
Cashier should not approve payment; AP Accountant should not execute
bank transfer; approval and execution separated.\
\
اعتماد خصم مبيعات:\
Quotation/SO → Sales Rep Discount → Check Limit → Sales Manager if
exceeded → Finance if margin below threshold → Confirm SO\
Sales Rep 5%, Sales Manager 15%, Finance if margin \<10%, GM if discount
\>25%.\
\
اعتماد تسوية مخزون:\
Inventory Count → Warehouse Keeper → Inventory Controller → Warehouse
Manager → Finance Value Review → Adjustment Posted → Accounting Entry\
Small difference: Warehouse Manager. High value: Warehouse + Finance.
Critical item: Warehouse + Finance + Internal Audit.

# **12) القيود المحاسبية الناتجة عن العمليات**

فاتورة مبيعات آجلة:\
Debit: Accounts Receivable\
Credit: Sales Revenue\
Credit: Output VAT / Tax Payable\
وإذا كان الجرد مستمرًا:\
Debit: Cost of Goods Sold\
Credit: Inventory\
\
تحصيل من عميل:\
Debit: Bank / Cash\
Credit: Accounts Receivable\
\
مرتجع مبيعات:\
Debit: Sales Returns\
Debit: Output VAT / Tax Payable\
Credit: Accounts Receivable / Cash\
ومخزنيًا:\
Debit: Inventory\
Credit: Cost of Goods Sold\
\
فاتورة شراء آجلة:\
Debit: Purchases / Inventory / Expense\
Debit: Input VAT / Tax Receivable\
Credit: Accounts Payable\
\
سداد لمورد:\
Debit: Accounts Payable\
Credit: Bank / Cash\
\
مرتجع مشتريات:\
Debit: Accounts Payable / Cash\
Credit: Inventory / Purchases\
Credit: Input VAT / Tax Receivable\
\
استلام بضاعة قبل فاتورة المورد:\
Debit: Inventory\
Credit: Goods Received Not Invoiced - GRNI\
وعند الفاتورة:\
Debit: GRNI\
Debit/Credit: Price Difference if any\
Credit: Accounts Payable\
\
إهلاك أصل ثابت:\
Debit: Depreciation Expense\
Credit: Accumulated Depreciation\
\
شراء أصل ثابت:\
Debit: Fixed Asset\
Debit: Input VAT if applicable\
Credit: Accounts Payable / Bank\
\
إثبات الرواتب:\
Debit: Salaries Expense\
Debit: Allowances Expense\
Credit: Employee Payables\
Credit: Social Insurance Payable\
Credit: Tax Payable\
Credit: Other Deductions Payable\
وعند السداد:\
Debit: Employee Payables\
Credit: Bank / Cash\
\
أمر تصنيع:\
صرف مواد: Debit WIP / Credit Raw Materials Inventory\
تحميل أجور وتكاليف: Debit WIP / Credit Labor Cost / Manufacturing
Overhead\
استلام منتج نهائي: Debit Finished Goods Inventory / Credit WIP

# **13) ربط العمليات بين الوحدات**

المبيعات + المخزون + المالية:\
Sales Order → Reserves Stock → Delivery Order → Reduces Inventory →
Customer Invoice → Receivable → Payment → Closes Receivable\
\
المشتريات + المخزون + المالية:\
Purchase Order → Expected Receipt → Goods Receipt → Increases Inventory
→ Vendor Bill → Payable → Payment → Closes Payable\
\
التصنيع + المخزون + التكاليف:\
BOM → Production Order → Raw Material Consumption → WIP → Finished Goods
Receipt → Cost Calculation → Inventory Valuation\
\
الموارد البشرية + المالية:\
Employee Contract → Attendance/Leaves → Payroll Calculation → Payslip
Approval → Accounting Entry → Bank Payment\
\
المشاريع + المبيعات + المالية:\
Project → Tasks → Timesheets → Milestones → Customer Invoice → Revenue
Recognition → Project Profitability

# **14) Mapping بين Odoo و SAP**

  -----------------------------------------------------------------------
  **Unified ERP**         **Odoo**                **SAP S/4HANA**
  ----------------------- ----------------------- -----------------------
  General Ledger          Accounting / Journal    FI-GL / Universal
                          Entries                 Journal

  Accounts Receivable     Customers / Invoices /  FI-AR
                          Payments                

  Accounts Payable        Vendors / Bills /       FI-AP
                          Payments                

  Fixed Assets            Assets                  FI-AA

  Bank and Cash           Bank & Cash /           FI-BL / Cash Management
                          Reconciliation          

  Quotation               Sales / Quotations      SD / Quotation

  Sales Order             Sales Orders            SD / Sales Order

  Delivery                Inventory / Delivery    SD / Outbound Delivery
                          Order                   

  Invoice                 Customer Invoice        SD Billing + FI Posting

  Purchase Request        Purchase Requests if    MM / Purchase
                          installed/customized    Requisition

  RFQ                     Purchase / RFQ          MM / RFQ

  Purchase Order          Purchase Order          MM / Purchase Order

  Goods Receipt           Inventory Receipt       MM-IM / Goods Receipt

  Vendor Bill             Vendor Bill             LIV / Invoice
                                                  Verification

  Product Master          Products / Variants     Material Master

  Warehouse               Warehouse               Plant + Storage
                                                  Location + Warehouse
                                                  Number

  Location                Stock Location          Storage Location / Bin
                                                  in EWM

  Stock Move              Stock Move / Move Line  Material Document

  Inventory Adjustment    Inventory Adjustment    Physical Inventory
                                                  Difference Posting

  BOM                     Bill of Materials       BOM

  Work Center             Work Center             Work Center

  Routing                 Routing / Operations    Routing

  Production Order        Manufacturing Order     Production Order

  Finished Goods Receipt  Mark as Done / Finished Goods Receipt from
                          Move                    Production
  -----------------------------------------------------------------------

# **15) حالات المستندات التفصيلية**

Customer Invoice: Draft → Submitted → Approved → Posted → Partially Paid
→ Paid / Overdue / Reversed / Cancelled\
Vendor Bill: Draft → Pending Match → Matched → Approved → Posted →
Partially Paid → Paid / Blocked / Reversed / Cancelled\
Sales Order: Draft → Quotation Sent → Customer Accepted → Confirmed →
Partially Delivered → Fully Delivered → Partially Invoiced → Fully
Invoiced → Closed / Cancelled\
Purchase Order: Draft → Submitted → Approved → Sent to Supplier →
Confirmed → Partially Received → Fully Received → Partially Billed →
Fully Billed → Closed / Cancelled\
Stock Transfer: Draft → Waiting → Ready → Partially Available → Done /
Cancelled\
Production Order: Draft → Planned → Confirmed → Materials Reserved →
Released → In Progress → Partially Produced → Produced → Costed → Closed
/ Cancelled\
Payroll: Draft → Calculated → Reviewed → Approved → Posted to Accounting
→ Paid / Cancelled

# **16) التقارير المطلوبة لكل إدارة**

Finance Reports: Trial Balance, General Ledger, Journal Entries, Journal
Items, Balance Sheet, P&L, Cash Flow, Aged Receivable/Payable,
Customer/Vendor Statement, Tax, Bank Reconciliation, Fixed Assets
Register, Depreciation, Budget vs Actual, Cost/Profit Center.\
Sales Reports: Sales by
Customer/Product/Salesperson/Region/Branch/Period, Margin, Quotation
Conversion, Order Status, Delivery Status, Invoice Status, Returns,
Discount Analysis, Credit Limit.\
Procurement Reports: Purchase by Supplier/Product/Category, Pending
PR/RFQ/PO, Quotation Comparison, PO Status, Goods Receipt Status, Vendor
Bill Matching, Purchase Price Variance, Supplier
Performance/Delay/Returns.\
Inventory Reports: Stock On Hand, Forecasted Stock, Stock Card, Product
Movement, Warehouse/Location Balance, Valuation, Aging, Slow/Fast
Moving, Expired, Lot/Serial Traceability, Negative Stock, Reorder,
Adjustments.\
Manufacturing Reports: Production Order Status, Production Plan, MRP,
BOM Cost, Material Consumption, WIP, Finished Goods, Work Center
Efficiency, OEE, Variance, Scrap, Manufacturing Cost, Capacity
Utilization.\
HR Reports: Employee List, Contracts, Attendance, Late Attendance,
Absence, Leave Balance, Payroll Summary, Payslip, End of Service,
Headcount, Turnover, Recruitment Pipeline.\
Management Dashboard: Revenue, Gross Profit, Net Profit, Cash/Bank
Balance, Receivables, Payables, Inventory Value, Sales Target, Purchase
Commitments, Production Efficiency, Payroll Cost, Top
Customers/Suppliers, Low Stock Alerts, Overdue Invoices, Pending
Approvals.

# **17) قواعد الرقابة الداخلية Internal Controls**

فصل المهام:\
- من ينشئ المورد لا يعتمد مدفوعاته.\
- من ينشئ الدفع لا يعتمد نفس الدفع.\
- أمين المخزن لا يغير تكلفة المنتج.\
- مندوب المبيعات لا يعتمد الخصومات العالية.\
- المحاسب لا يفتح الفترات المغلقة.\
- مسؤول النظام لا يرحل قيودًا محاسبية افتراضيًا.\
- أمين الصندوق لا يطابق البنوك منفردًا.\
- مسؤول المشتريات لا يعتمد بيانات المورد منفردًا.\
\
ضوابط مالية:\
- المستندات المرحلة لا تحذف.\
- القيود المرحلة تعكس فقط.\
- الإلغاء يجب أن يحتفظ بسبب.\
- كل مستند مرحل له Audit Trail.\
- الحركات بتاريخ سابق تحتاج صلاحية خاصة.\
- الفترات المقفلة لا تقبل ترحيلًا.\
- القيود اليدوية تحتاج اعتمادًا.\
- العمليات عالية القيمة تحتاج اعتمادًا متعدد المستويات.\
\
ضوابط المخزون:\
- المخزون السالب يحتاج اعتمادًا.\
- التسوية المخزنية تحتاج اعتمادًا.\
- تغيير تكلفة المنتج يحتاج موافقة مالية.\
- التحويل المخزني يجب اعتماده من المصدر والوجهة.\
- الهالك يحتاج سببًا.\
- المنتجات المتتبعة لا تتحرك دون Lot/Serial.\
- المنتجات المنتهية لا تباع إلا بتصريح.\
\
ضوابط المبيعات:\
- فحص حد الائتمان قبل تأكيد أمر البيع.\
- العميل المحظور لا يستقبل أوامر بيع جديدة.\
- الخصم العالي يحتاج اعتمادًا.\
- البيع تحت التكلفة يحتاج موافقة مالية.\
- لا تسليم قبل تأكيد أمر البيع.\
- لا ترحيل فاتورة إذا كان أمر البيع محظورًا.\
- المرتجع يجب أن يشير للفاتورة أو التسليم الأصلي.\
\
ضوابط المشتريات:\
- المورد يجب أن يكون معتمدًا قبل PO.\
- PO فوق الحد يحتاج اعتمادًا.\
- فاتورة المورد تطابق PO وGR.\
- فرق السعر/الكمية يحتاج مراجعة.\
- الدفع لا يتجاوز الفاتورة المعتمدة.\
- منع تكرار رقم فاتورة المورد.

# **18) الجداول الرئيسية للصلاحيات وقاعدة البيانات**

الجداول العامة:\
companies, branches, departments, users, roles, permissions,
approval_workflows, documents, attachments, audit_logs, currencies,
exchange_rates\
\
مالية:\
chart_of_accounts, account_groups, journals, journal_entries,
journal_entry_lines, fiscal_years, periods, taxes, tax_groups,
payment_terms, cost_centers, profit_centers, analytic_accounts, budgets,
budget_lines\
\
عملاء وموردون:\
partners, partner_categories, customer_profiles, supplier_profiles,
partner_contacts, partner_addresses, partner_bank_accounts,
partner_credit_limits, partner_statements\
\
مبيعات:\
sales_quotations, sales_quotation_lines, sales_orders,
sales_order_lines, sales_invoices, sales_invoice_lines, sales_returns,
sales_return_lines, sales_payments, commissions, targets\
\
مشتريات:\
purchase_requests, purchase_request_lines, rfqs, rfq_lines,
supplier_quotations, supplier_quotation_lines, purchase_orders,
purchase_order_lines, goods_receipts, goods_receipt_lines, vendor_bills,
vendor_bill_lines, purchase_returns\
\
مخزون:\
products, product_variants, product_categories, units_of_measure,
barcodes, warehouses, stock_locations, stock_moves, stock_move_lines,
stock_quants, stock_lots, serial_numbers, inventory_adjustments,
stock_valuation_layers\
\
تصنيع:\
boms, bom_lines, work_centers, routings, routing_operations,
manufacturing_orders, work_orders, production_consumptions,
finished_goods_receipts, scrap_orders, production_costs\
\
موارد بشرية:\
employees, contracts, job_positions, departments, attendance_logs,
leave_types, leave_requests, payroll_structures, salary_rules, payslips,
payslip_lines, employee_documents\
\
صلاحيات:\
users(id, username, password_hash, employee_id, email, phone,
default_company_id, default_branch_id, is_active, last_login_at,
created_at, updated_at)\
roles(id, code, name_ar, name_en, description, is_system_role,
is_active, created_at, updated_at)\
permissions(id, module_code, menu_code, action_code, name_ar, name_en,
risk_level, requires_audit, is_active, created_at)\
role_permissions(id, role_id, permission_id, can_create, can_read,
can_update, can_delete, can_approve, can_post, can_cancel, can_reverse,
can_print, can_export, can_import, data_scope, company_scope,
branch_scope, warehouse_scope, created_at)\
user_roles(id, user_id, role_id, company_id, branch_id, warehouse_id,
valid_from, valid_to, is_active, created_at)\
audit_logs(id, user_id, module_code, document_type, document_id, action,
old_value, new_value, ip_address, device_info, action_at, notes)

# **19) إعداد Number Sequences لكل مستند**

Sales Quotation: SQ-YYYY-000001\
Sales Order: SO-YYYY-000001\
Customer Invoice: INV-YYYY-000001\
Credit Note: CN-YYYY-000001\
Purchase Request: PR-YYYY-000001\
RFQ: RFQ-YYYY-000001\
Purchase Order: PO-YYYY-000001\
Goods Receipt: GRN-YYYY-000001\
Vendor Bill: VB-YYYY-000001\
Payment Voucher: PV-YYYY-000001\
Receipt Voucher: RV-YYYY-000001\
Journal Entry: JE-YYYY-000001\
Stock Transfer: ST-YYYY-000001\
Inventory Adjustment: IA-YYYY-000001\
Production Order: MO-YYYY-000001\
Payslip: PAY-YYYY-000001\
\
قواعد الترقيم:\
- لكل شركة Sequence مستقل.\
- لكل فرع Sequence مستقل عند الحاجة.\
- لا تعدل الأرقام بعد الترحيل.\
- أرقام الإلغاء لا يعاد استخدامها.\
- الترقيم اليدوي مقيد.\
- فجوات الترقيم تظهر في تقرير.\
- إعادة التصفير سنويًا أو شهريًا أو لا تتم حسب السياسة.

# **20) الحقول الإلزامية وقواعد منع الأخطاء**

حقول إلزامية:\
Sales Order: Customer, Order Date, Pricelist, Payment Terms, Warehouse,
Salesperson, Product, Quantity, Unit Price, Taxes, Delivery Address,
Invoice Address\
Customer Invoice: Customer, Invoice Date, Due Date, Journal, Currency,
Lines, Revenue Account, Tax, Payment Terms, Reference\
Purchase Order: Supplier, Date, Currency, Payment Terms,
Warehouse/Receiving Location, Product, Quantity, Unit Price, Taxes,
Expected Date, Buyer\
Vendor Bill: Supplier, Bill Date, Accounting Date, Vendor Bill Number,
PO Reference, Journal, Currency, Lines, Account, Tax, Due Date\
Stock Transfer: Source, Destination, Operation Type, Product, Demand
Qty, Done Qty, Lot/Serial, Scheduled Date, Responsible\
Journal Entry: Journal, Accounting Date, Reference, Debit Account,
Credit Account, Debit, Credit, Currency, Cost Center, Description\
\
Validation Rules:\
Financial: Debit=Credit, open period, active account, tax configured,
currency rate exists, partner required for AR/AP, cost center required
for expenses, due date follows terms, duplicate vendor bill blocked.\
Sales: active/non-blocked customer, credit limit check, sellable
product, qty \> 0, price not below minimum unless approved, discount
within limit, warehouse required, delivery not exceeding ordered qty
unless allowed.\
Purchases: approved supplier, purchasable product, qty \> 0, price
variance checked, PO approval by amount, receipt tolerance, vendor bill
not exceeding received qty unless allowed.\
Inventory: location required, lot/serial required when tracked, unique
serial, sufficient stock unless negative allowed, adjustment reason,
valuation account configured, source ≠ destination, expired lot blocked
unless authorized.\
Manufacturing: BOM required, components available/procurement triggered,
active work center, qty \> 0, consumption variance approval, finished
qty variance approval, cannot close before costing.

# **21) الصلاحيات الحرجة حسب الوحدة**

Finance Critical: Post Journal Entry, Reverse Posted Entry, Unlock
Period, Change CoA, Tax Configuration, Bank Account, Post Payment,
Cancel Posted Invoice, Export Statements, Change FX Rate.\
Sales Critical: Approve High Discount, Sell Below Cost, Override Credit
Limit, Cancel Confirmed SO, Create Credit Note, Approve Return, Change
Credit Limit, Edit Confirmed SO.\
Procurement Critical: Approve Supplier, Approve PO, Change Supplier Bank
Account, Approve Price/Quantity Variance, Cancel Confirmed PO, Create
Vendor Without Approval, Approve Payment.\
Inventory Critical: Validate Adjustment, Allow Negative Stock, Change
Product Cost, Scrap Stock, Transfer Between Warehouses, Create Lot
Manually, Change Valuation, Backdate Movement.\
Manufacturing Critical: Approve BOM, Change BOM Version, Release/Close
Production Order, Approve Overconsumption/Scrap, Change Work Center
Cost, Settle Production Cost.\
HR Critical: View/Edit Salary, Approve Payroll, Post Payroll, View
Private Info, Terminate Employee, Change Contract, Export Payroll.

# **22) أفضل هيكل نهائي للنظام بصيغة تنفيذية**

ERP\
├── Core Setup: Companies, Branches, Departments, Cost Centers,
Warehouses, Currencies, Taxes, Number Sequences, Approval Rules\
├── Master Data: Business Partners, Customers, Suppliers, Contacts,
Products, Categories, UOM, Price Lists, Payment Terms, Banks\
├── Operations: Sales, Procurement, Inventory, Manufacturing, Quality,
Maintenance, Projects, HR\
├── Finance: GL, Receivables, Payables, Cash/Bank, Assets, Taxes,
Budgets, Closing\
├── Control: Roles, Permissions, Workflows, Audit Logs, Data Access
Rules, Internal Controls\
└── Reporting: Operational, Financial, Management, BI Dashboards, Audit
Reports\
\
النتيجة النهائية التي يجب اعتمادها:\
1. Core Setup\
2. Master Data\
3. Finance\
4. Sales\
5. CRM\
6. Procurement\
7. Inventory\
8. Warehouse\
9. Manufacturing\
10. Quality\
11. Maintenance\
12. Human Resources\
13. Projects\
14. Administration\
15. Audit and Compliance\
16. Business Intelligence\
\
كل وحدة يجب أن تحتوي على:\
Menus, Screens, Documents, Actions, Roles, Permissions, Workflows,
Statuses, Accounting Impact, Inventory Impact, Reports, Audit Logs,
Validation Rules, Approval Rules.

# **23) ملحق: مصادر عامة تم استخدامها عند التخصيص**

Odoo Documentation 19.0: Accounting and Invoicing, Supply Chain,
Inventory Management, Manufacturing, Master Production Schedule.

SAP Help Portal / SAP S/4HANA: Finance, Procurement, Inventory
Management and Physical Inventory MM-IM، بالإضافة إلى وصف SAP S/4HANA
Sales architecture كمرجع سياقي لدورة المبيعات والتوزيع.
