# Task ID: COMPLETE-MFG-HR
# Agent: main (Z.ai Code)
# Date: 2026-07-08

## Summary
Completed 8 frontend modules + 7 missing APIs for Manufacturing (BOMs, Work Centers, Production Orders) and HR (Employees, Departments, Attendance, Leave Requests, Payroll Runs) groups.

## APIs Created (7 missing, 9 files)
1. `src/app/api/erp/work-centers/route.ts` — GET list+search, POST create with unique code check
2. `src/app/api/erp/work-centers/[id]/route.ts` — GET/PUT/DELETE
3. `src/app/api/erp/boms/[id]/route.ts` — GET/PUT (replace components if provided)/DELETE (soft-archive if has production orders)
4. `src/app/api/erp/production-orders/[id]/route.ts` — GET/PUT with action=release|complete|close|cancel (state-machine transitions)/DELETE (blocks released)
5. `src/app/api/erp/employees/[id]/route.ts` — GET with contracts/PUT/DELETE (soft-terminate if has attendance/payroll)
6. `src/app/api/erp/departments/[id]/route.ts` — GET with parent+children+_count/PUT/DELETE (soft-deactivate if has children/employees)
7. `src/app/api/erp/attendance/route.ts` — GET with employeeId/status/date/from/to filters + employee name search; POST
8. `src/app/api/erp/attendance/[id]/route.ts` — GET/PUT/DELETE
9. `src/app/api/erp/leave-requests/route.ts` — GET filtered by employeeId/status/leaveType; POST with auto days calc
10. `src/app/api/erp/leave-requests/[id]/route.ts` — GET/PUT with action=approve|reject|submit/DELETE (blocks approved)
11. `src/app/api/erp/payroll-runs/route.ts` — GET filtered by status/company; POST default creates new run; POST with action=calculate computes payslips from active employee contracts (gross=baseSalary+allowances, deductions=5%, net=gross-deductions), generates PAY-YYYY-NNNNNN codes via nextNumber, deletes prior payslips for re-calc
12. `src/app/api/erp/payroll-runs/[id]/route.ts` — GET with payslips+employee+department; PUT with action=post (creates journal entry via postJournalEntry: Dr Salaries Expense / Cr Salaries Payable + Cr Operating Expenses for deductions, uses main branch for sequence), action=pay (marks paid), action=review|approve|cancel; DELETE (blocks posted/paid)

## Frontend Modules Created (8 files)
1. `src/components/modules/work-centers-module.tsx` — WorkCentersModule: 4 KPIs (total, active, total capacity, avg cost), table (code, nameAr, nameEn, capacityPerHour, costPerHour, status), add/edit dialog, export CSV
2. `src/components/modules/boms-module.tsx` — BomsModule: 4 KPIs (total, approved, active, by product), table (code, nameAr, product, quantity, version, components count, status), add dialog with dynamic components table (product, quantity, scrapPercent), "Approve" action (status: draft→approved), print BOM, export CSV
3. `src/components/modules/production-orders-module.tsx` — ProductionOrdersModule: 4 KPIs (total, in progress, produced, total cost), table (code, product, BOM, quantity, producedQty, totalCost, status), add dialog (BOM select auto-fills productId), Release/Complete/Close action buttons per status, print production order, export CSV
4. `src/components/modules/employees-module.tsx` — EmployeesModule: 4 KPIs (total, active, top dept, suspended), table (employeeNo, nameAr, department badge, phone, hireDate, status), add/edit dialog (nameAr, nameEn, dept select, jobPosition text, hireDate, gender, phone, email, nationalId), print employee card, export CSV
5. `src/components/modules/departments-module.tsx` — DepartmentsModule: 4 KPIs (total, root, active, employees), tree-view table (indentation by depth, code, nameAr, nameEn, parent, employee count, status), add/edit dialog (code, nameAr, nameEn, parent select), export CSV
6. `src/components/modules/attendance-module.tsx` — AttendanceModule: 4 KPIs (present today, absent, late, on leave), table (employee, dept, date, checkIn, checkOut, status), add/edit dialog (employee select, date, status select, checkIn/checkOut times, notes), filters (date + status), export CSV
7. `src/components/modules/leave-requests-module.tsx` — LeaveRequestsModule: 4 KPIs (total, pending, approved, rejected), table (employee, leaveType badge with color, startDate, endDate, days, status), add dialog (employee, leaveType, dates with auto days calc, reason), Approve/Reject/Submit actions, export CSV
8. `src/components/modules/payroll-runs-module.tsx` — PayrollRunsModule: 4 KPIs (total runs, posted, total net, this month), table (period, startDate, endDate, totalGross, totalDeductions, totalNet, payslips count, status), add dialog (period month picker, dates), Calculate/Post/Pay actions per status, view payslips dialog (with totals footer), print payroll summary, export CSV

## Module Registry Update
`src/components/erp/module-registry.tsx`: replaced 8 stub declarations (`stub('module.xxx', ...)`) with lazy-loaded real modules via the existing `lazy()` helper. Registry map entries for `boms`, `work-centers`, `production-orders`, `employees`, `departments`, `attendance`, `leave-requests`, `payroll-runs` now point to the real components.

## Verification
- All 4 new GET endpoints return 200 with data:
  - `/api/erp/work-centers` → 1 record (WC-001 created during smoke test)
  - `/api/erp/attendance` → 1 record
  - `/api/erp/leave-requests` → 1 record (approved)
  - `/api/erp/payroll-runs` → 1 record (paid)
- Full payroll lifecycle verified:
  1. Create payroll run (draft)
  2. Calculate → status=calculated, totalGross=6000, totalDeductions=300, totalNet=5700, 1 payslip PAY-2026-000002
  3. Post → status=posted, journalEntryCode=JE-2026-000102 (Dr Salaries Expense 6000 / Cr Salaries Payable 5700 / Cr Operating Expenses 300)
  4. Pay → status=paid
- Leave request approve action verified: status=submitted → approved
- Production order state machine: draft → released (action=release) → produced (action=complete) → closed (action=close)
- Lint: 0 errors (exit 0)
- Dev server compiles all modules, page renders in ~19s first-compile

## Notes
- Used `branch?.id` in payroll post to match the existing journal-entry sequence setup (the sequence with branchId=null had stale nextNumber that collided with existing JE-2026-000006)
- Payroll deductions use a 5% GOSI-like calc (configurable in code)
- Departments module implements client-side tree indentation since the API returns flat list
- All modules use `<ModuleShell>`, 4 KPIs, search, table with `table-sticky`+`num-cell`, add/edit dialog, export CSV; manufacturing + employee + payroll modules also have print
