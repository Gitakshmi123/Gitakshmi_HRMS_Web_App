# Payroll End-to-End Analysis

## Purpose

This document maps how payroll currently works in the HRMS codebase, what calculations are used, which screens and APIs are active, what data models are involved, and where the current architecture is fragmented.

This is a code-trace of the current implementation, not a desired-state design.

## 1. Active Payroll Surfaces

### HR screens

- `client/src/pages/HR/SalaryStructure.jsx`
  - Builds salary structure for applicant/employee.
  - Calls:
    - `GET /payroll/earnings`
    - `GET /deductions`
    - `GET /payroll/benefits`
    - `GET /salary/current`
    - `POST /salary/preview`
    - `POST /salary/assign`
    - `POST /salary/confirm`
    - `POST /salary/unlock`
    - `POST /salary/auto-balance`

- `client/src/pages/HR/Compensation.jsx`
  - Displays active compensation versions.
  - Calls:
    - `GET /compensation/list`
    - `GET /compensation/history/:employeeId`
    - `POST /compensation/increment`

- `client/src/pages/HR/Payroll/ProcessPayroll.jsx`
  - Selected-employee payroll processing.
  - Calls:
    - `GET /payroll/process/employees`
    - `POST /payroll/process/preview`
    - `POST /payroll/process/run`

- `client/src/pages/HR/Payroll/RunPayroll.jsx`
  - Month-wide payroll run / approve / paid flow.
  - Calls:
    - `GET /payroll/filteredEmployees`
    - `GET /payroll/runs`
    - `POST /payroll/runs`
    - `POST /payroll/runs/:id/calculate`
    - `POST /payroll/runs/:id/approve`
    - `POST /payroll/runs/:id/mark-paid`

- `client/src/pages/HR/Payroll/Payslips.jsx`
  - Lists HR payslips and downloads PDFs.
  - Calls:
    - `GET /payroll/payslips`
    - `GET /payslip-templates`
    - `POST /payslip-templates/render/:payslipId`
    - fallback `POST /payroll/payslips/:id/generate-pdf`

- `client/src/pages/HR/Payroll/PayslipTemplates.jsx`
  - Manages payslip layout templates.

- `client/src/pages/Admin/PayrollRules.jsx`
  - Saves company payroll rules through `GET/PUT /payroll-rules/rules`.

### Employee / ESS screens

- `client/src/pages/ESS/Payslips.jsx`
  - Calls:
    - `GET /payroll/payslips/my`
    - `POST /payroll/payslips/:id/generate-pdf`

## 2. Main Route Mounting

Mounted in `server/app.js`:

- `/api/salary`
- `/api/payroll`
- `/api/payroll/corrections`
- `/api/compensation`
- `/api/salary-structure`
- `/api/payslip-templates`
- `/api/payroll-rules`
- `/api/deductions`

Important: some payroll-related controllers exist in the repo but are not mounted in `app.js`:

- `salaryRevision.routes`
- legacy payroll engine snapshot routes
- salary-template APIs used by `NewSalaryTemplate.jsx`

## 3. Core Data Models

### Master setup models

- `SalaryComponent`
  - Earnings master.
  - Supports:
    - `FLAT_AMOUNT`
    - `PERCENTAGE_OF_BASIC`
    - `PERCENTAGE_OF_CTC`

- `DeductionMaster`
  - Pre-tax / post-tax deduction definitions.
  - Supports fixed or percentage on `BASIC` or `GROSS`.

- `BenefitComponent`
  - Employer-side benefits / contributions.

### Salary setup / source models

- `EmployeeSalarySnapshot`
  - Draft/final salary structure snapshot used by salary assignment flow.

- `EmployeeCompensation`
  - Commented as source-of-truth compensation model.
  - Stores `grossA`, `grossB`, `grossC`, `totalCTC`, and normalized components.

- `EmployeeCtcVersion`
  - Versioned compensation history.
  - Used by compensation/increment workflow.

- `SalaryStructure`
  - Global collection, not tenant-DB collection.
  - Older / parallel salary structure store.

- `SalaryAssignment`
  - Salary-template assignment history.
  - Exists, but current payroll run mostly bypasses it.

### Payroll transaction models

- `PayrollRun`
  - Month/year run header, status, totals, approver/payment metadata.

- `PayrollRunItem`
  - Item rows for selected payroll processing flow.

- `Payslip`
  - Immutable financial snapshot per employee per month/year.
  - Unique by `tenantId + employeeId + month + year`.

- `PayrollAdjustment`
  - Maker-checker adjustments / arrears / corrections.

## 4. Current End-to-End Runtime Flow

### Phase A: Salary structure setup

The salary structure screen uses `SalaryCalculationEngine` through `salary.controller`.

Flow:

1. Fetch master earnings, deductions, and benefits.
2. Fetch current `EmployeeSalarySnapshot` through `GET /salary/current`.
3. Preview breakup via `POST /salary/preview`.
4. Save draft via `POST /salary/assign`.
5. Finalize lock via `POST /salary/confirm`.

Output of this phase:

- `EmployeeSalarySnapshot`
- employee/applicant flags such as `salaryAssigned`, `salaryLocked`, `salarySnapshotId`

### Phase B: Compensation / increment setup

The compensation page uses `EmployeeCtcVersion` as the visible active structure and can auto-bridge from older sources:

Priority used by compensation list sync:

1. `SalaryStructure` (global)
2. `EmployeeSalarySnapshot`
3. Applicant salary snapshot

Then it creates `EmployeeCtcVersion` if missing.

Increment flow creates a new `EmployeeCtcVersion` and also writes history back into Applicant-based fields for backward compatibility.

### Phase C: Payroll processing

There are two active payroll execution paths.

#### Path 1: Run Payroll page

`payrollRun.controller`:

1. Create/reset `PayrollRun`
2. Call `payroll.service.runPayroll(...)`
3. That service loads employees for the month
4. For each employee it calls `calculateEmployeePayroll(...)`
5. Saves `Payslip`
6. Updates `PayrollRun` totals/status
7. Attendance records for the month are locked
8. HR can later approve and mark paid

#### Path 2: Process Payroll page

`payrollProcess.controller`:

1. Fetch employees for a month with simple attendance count + compensation presence
2. Preview selected employees using `calculateEmployeePayroll(..., dryRun = true)`
3. Run selected employees using `calculateEmployeePayroll(..., dryRun = false)`
4. Create `PayrollRunItem` rows

This path is more employee-selection based and more compensation-centric.

### Phase D: Payslip delivery

- Employee self-service reads `Payslip` snapshots via `GET /payroll/payslips/my`
- HR reads all tenant payslips via `GET /payroll/payslips`
- PDF generation is:
  - default PDFKit rendering, or
  - template rendering through `PayslipTemplate`

## 5. Payroll Source Selection in Live Payroll

The main monthly payroll service does not rely on one clean source.

Current source priority inside `server/services/payroll.service.js`:

1. Active `EmployeeCompensation`
2. Active `EmployeeCtcVersion`
3. Direct `EmployeeSalarySnapshot` from employee links
4. Applicant-linked `EmployeeSalarySnapshot`
5. Applicant embedded `salarySnapshot`
6. Global `SalaryStructure`
7. Final zero-value recovery structure

After a source is found, it is normalized and converted into a payroll-time template-like object.

Important behavior:

- Only `EARNING` components are converted into payroll earnings.
- Only `BENEFIT` components are converted into employer contribution snapshot.
- Compensation components of type `DEDUCTION` are not carried into the payroll deduction calculation path.

Actual payroll deductions are driven by:

- statutory logic
- `EmployeeDeduction` assignments linked to `DeductionMaster`

## 6. Salary Calculation Logic Used Before Payroll

The salary setup screen uses `SalaryCalculationEngine`.

### Engine rules

- Annual CTC -> monthly CTC = `annualCTC / 12`
- Basic defaults to `40% of CTC` if not explicitly configured
- Every non-basic, non-special earning is calculated first
- Benefits are calculated next
- Deductions are calculated next
- Special Allowance is auto-balanced as:

`Special Allowance = CTC - (calculated earnings + benefits)`

### Hardcoded rules in `SalaryCalculationEngine`

- PF:
  - `12% of basic`
  - capped at `1800` monthly
- Gratuity:
  - `4.81% of basic`
- Professional Tax:
  - fixed `200` monthly

### Effect of setup engine

- Salary setup is primarily for structure balancing and snapshot creation.
- This is not the same engine that calculates final month payroll.

## 7. Monthly Payroll Calculation Logic

The month payroll logic lives in `server/services/payroll.service.js`.

### Step 1: Attendance summary

Attendance is built from monthly attendance rows.

Rules:

- Holidays count as paid/present days.
- `present`, `half_day`, `work_from_home`, `on_duty` count as payable attendance.
- Paid leave counts as payable attendance.
- Unpaid leave / absent increases `lopDays`.
- If employee joined in the payroll month, total payable days are reduced from join date onward.

Very important current behavior:

- If no attendance exists, employee is treated as full month present.
- If `presentDays` is zero, employee is treated as full month present.
- If payable days are less than `(actualDaysInMonth - lopDays)`, the service forces payable days up to that number.

This means missing attendance is treated as paid unless explicitly marked absent/LOP.

### Step 2: Gross earnings

For each earning component:

- default behavior is pro-rata
- formula:

`proRatedAmount = monthlyAmount / daysInMonth * presentDays`

Notes:

- In practice, all earnings are pro-rated unless `proRata === false`
- taxable gross is sum of earnings where `taxable !== false`
- if no basic component is found, first earning is used as fallback basic for deduction calculations

### Step 3: Pre-tax deductions

Current built-in statutory logic:

- EPF:
  - enabled if EPF deduction exists or template says `includePensionScheme`
  - PF wage = `min(proRatedBasic, 15000)` if wage restriction enabled
  - employee EPF = `12% of PF wage`

- ESI:
  - only if `grossEarnings <= 21000`
  - employee ESI = `0.75% of gross`

Other pre-tax deductions:

- Pulled from `EmployeeDeduction`
- Uses `DeductionMaster`
- Supports:
  - fixed amount
  - percentage on `BASIC`
  - percentage on `GROSS`

### Step 4: Taxable income

`taxableIncome = taxableGross - preTaxDeductions`

If negative, it is forced to `0`.

### Step 5: TDS

Intended behavior:

- Annualize current monthly taxable income
- Apply slab tax
- Add 4% cess
- Divide by 12

Current slabs in `tds.service.js`:

- 0 to 2.5L: 0
- 2.5L to 5L: 5%
- 5L to 10L: 20%
- Above 10L: 30%
- Rebate to zero tax if annual taxable <= 5L

### Step 6: Post-tax deductions

Current post-tax sources:

- Excess Leave Deduction
  - allowed leave defaults to `2 days/month`
  - if leave policy exists, casual leave yearly allowance is converted to monthly allowance
  - daily leave rate defaults to `monthlyCTC / 26`
  - excess leave amount = `dailyRate * excessDays`

- Other employee deductions from `EmployeeDeduction`

Explicit LOP deduction is currently disabled because the service assumes pro-rata earnings already absorbed LOP.

### Step 7: Adjustments

Approved `PayrollAdjustment` entries for `YYYY-MM` are summed and added directly to net pay:

`netPay = taxableIncome - incomeTax - postTaxDeductions + adjustmentTotal`

Negative net pay is then clamped to `0`.

### Step 8: Payslip snapshot

The service stores:

- employee info snapshot
- earnings snapshot
- pre-tax deductions snapshot
- post-tax deductions snapshot
- employer contributions snapshot
- adjustments snapshot
- attendance summary
- totals
- integrity hash

## 8. What Is Actually Used vs Legacy / Parallel Logic

### Clearly active now

- `salary.controller`
- `salaryCalculationEngine`
- `payroll.service`
- `payrollRun.controller`
- `payrollProcess.controller`
- `payslip.controller`
- `compensation.controller`
- `payslipTemplate.controller`

### Present but not clearly active in the mounted app

- `payrollEngine.controller` and `services/payrollEngine`
- `salaryRevision.routes`
- `salaryTemplate.controller` route surface
- `payrollValidator.service`
- `payrollEdgeCaseHandlers.service`
- `PayrollConfiguration`
- `IndianPayrollEngine`

These look like alternate or incomplete payroll designs that are not the current live path.

## 9. Key Risks and Gaps Found

### 1. Too many salary sources

Payroll reads from multiple parallel stores:

- EmployeeCompensation
- EmployeeCtcVersion
- EmployeeSalarySnapshot
- Applicant salary snapshot
- SalaryStructure

This makes payroll behavior dependent on whichever source exists first, not on one explicit source of truth.

### 2. Compensation deductions do not feed live payroll deductions

The live payroll builder converts:

- `EARNING` -> earnings
- `BENEFIT` -> employer contributions

But not `DEDUCTION` -> payroll deductions.

So deduction components stored inside compensation versions are not directly applied in monthly payroll unless separately assigned through `EmployeeDeduction`.

### 3. TDS integration is broken in the current service contract

`payroll.service.js` calls:

- `tdsService.calculateMonthlyTDS(...)`

But `tds.service.js` exports:

- `calculateTDS: calculateMonthlyTDS`

Effect:

- the call path falls into the try/catch failure path
- `incomeTax` becomes `0`
- payroll likely runs with zero TDS unless another alias exists elsewhere

### 4. Missing attendance becomes full salary

Current service intentionally recovers to full payable days when attendance is missing or zero. This can overpay employees if attendance is incomplete.

### 5. Deduction date filtering uses current date, not payroll period

`EmployeeDeduction` filtering uses `new Date()` instead of the payroll month window.

That means:

- backdated payroll can miss deductions that were active in that past month
- future payroll previews can include/exclude the wrong deductions

### 6. Payroll rules UI is not driving the live payroll engine

`PayrollRules.jsx` saves `CompanyPayrollRule`, but the active `payroll.service.js` does not read those rules.

So the HR/Admin payroll rules screen currently behaves more like stored configuration than an active calculation driver.

### 7. Salary template screen is not fully wired

`NewSalaryTemplate.jsx` posts to `/payroll/salary-templates`, but no mounted route for that endpoint was found in `server/app.js` or `server/routes`.

### 8. Salary revision routes are imported but not mounted

`salaryRevision.routes` is required in `app.js`, but no `app.use(...)` mount was found.

### 9. Rerun safety is incomplete

- Payslip has a unique index per employee/month/year.
- Payroll run reset paths clear run stats.
- But payroll recalculation paths do not always remove old payslips before saving new ones.

That creates duplicate-key risk when recalculating an already-generated month unless the run is cancelled first.

### 10. Compensation history / increment storage is still applicant-oriented

Compensation history and increment service still write through `Applicant`-based history fields in places, which is inconsistent with the employee-centric compensation model.

## 10. Practical Current Architecture Summary

If we simplify the current system, payroll today works like this:

1. HR configures component masters.
2. HR creates salary structure snapshots for a candidate/employee.
3. Compensation layer may sync or version that data into `EmployeeCtcVersion`.
4. Payroll month run loads active employees.
5. For each employee, payroll tries several compensation sources until one exists.
6. Earnings are pro-rated by attendance.
7. Statutory + employee deductions are applied.
8. TDS is intended, but current service contract suggests it is falling back to zero.
9. Adjustments are added.
10. Immutable payslip snapshot is saved.
11. HR can approve and mark paid.
12. ESS/HR download PDF from payslip snapshot.

## 11. Best Base for a Full Custom Payroll Rewrite

For a clean custom-logic upgrade, the safest base would be:

1. Pick one source of truth for monthly payroll input.
2. Separate structure design from payroll execution.
3. Replace hardcoded rules with tenant-configurable rule packs.
4. Make attendance-to-pay rules explicit instead of auto-recovering to full attendance.
5. Unify deductions so compensation deductions and employee deductions cannot diverge.
6. Unify run flow so `Process Payroll` and `Run Payroll` are not two partially overlapping engines.
7. Keep `Payslip` immutable, but make rerun/amendment flow explicit.

## 12. Recommended Next Step

Before coding the custom rewrite, define:

- exact source of truth model
- exact attendance policy for payable days
- exact deduction taxonomy
- exact statutory/tax regime behavior
- exact approval/amendment flow
- whether salary setup stays candidate-first or becomes employee-first

Once those decisions are locked, the current code can be simplified heavily.
