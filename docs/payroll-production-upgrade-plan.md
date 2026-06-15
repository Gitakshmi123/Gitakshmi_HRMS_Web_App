# Payroll Production Upgrade Plan

This document converts the payroll analysis into an upgrade blueprint. The goal is to move payroll from a mixed hardcoded/legacy flow into a production-grade, configurable, auditable, city-aware payroll platform.

## 1. Biggest Missing Pieces

### 1.1 One salary source of truth

Current payroll can read salary from multiple sources:

- `EmployeeCompensation`
- `EmployeeCtcVersion`
- `EmployeeSalarySnapshot`
- Applicant-linked salary snapshots
- Global `SalaryStructure`

Production payroll should not guess. It should use one canonical, effective-dated salary source and only fall back during controlled migration.

Recommended direction:

- Use an effective-dated employee salary version as the canonical source.
- Store every component with type, taxability, pro-rata behavior, payroll treatment, and employer/employee ownership.
- Keep old models read-only during migration, then remove them from active calculation.

### 1.2 City/state/location-wise rules are missing

Payroll currently calculates mostly without a location policy context. Production payroll needs every employee payroll calculation to know:

- Legal entity
- Branch/office
- Work city
- Work state
- Payroll region
- Effective location during the pay period
- Applicable statutory rule set
- Applicable holiday/weekly-off calendar

Without this, professional tax, holidays, metro/non-metro HRA logic, local allowances, labor welfare fund, overtime rules, and location transfers cannot be handled safely.

### 1.3 Hardcoded statutory logic

Several payroll values are currently hardcoded or simplified, such as PF, gratuity, professional tax, ESI threshold behavior, and TDS assumptions. Production payroll should not keep statutory rules inside service methods.

Recommended direction:

- Move statutory logic to versioned rule sets.
- Store effective dates.
- Store calculation formulas or structured rule parameters.
- Keep country/state/city applicability.
- Preserve the rule version used on each payslip.

Important: statutory rates and slabs must be verified before production release. The system should be built to configure them, not depend on hardcoded values.

### 1.4 Attendance fallback can overpay

Current payroll treats missing attendance as full present. That is dangerous in production.

Recommended direction:

- Add payroll preflight validation.
- Block payroll if required attendance is missing.
- Allow only authorized override with reason and audit trail.
- Show missing attendance count before calculation.

### 1.5 Deductions are split across systems

Salary components can include deduction-type components, but live payroll mainly applies deductions from employee deduction records. This can cause components shown in salary setup to not affect net pay.

Recommended direction:

- Define deduction ownership clearly.
- Support salary-template deductions, recurring employee deductions, one-time deductions, loans, advances, and statutory deductions in one calculation pipeline.
- Show all deductions in the calculation trace and payslip.

### 1.6 TDS/income tax flow is not production-ready

The current TDS integration has a service export mismatch, so monthly TDS can silently become zero. Even after fixing the bug, a production system needs declarations, exemptions, regime selection, projections, and proof verification.

Recommended direction:

- Add employee tax regime/declaration records.
- Add annual projection engine.
- Add monthly TDS smoothing.
- Add proof approval workflow.
- Version tax rules by financial year.

### 1.7 Payroll rules UI is not connected to live payroll

There is a payroll rules UI/model, but the active monthly payroll service does not actually use it as the calculation source.

Recommended direction:

- Connect the rules UI to the calculation engine.
- Add rule preview/simulation before saving.
- Add rule versioning and approval.
- Prevent editing rules already used in approved payroll; create a new effective-dated version instead.

### 1.8 Two payroll execution flows

There are two flows:

- Full monthly run flow
- Selected employee process flow

They do not appear to share the same lifecycle, reset behavior, approval model, or payslip cleanup behavior.

Recommended direction:

- Keep one payroll run engine.
- Allow the same engine to run all employees, selected employees, off-cycle payroll, arrears, or final settlement.
- Use one lifecycle: draft, validated, calculated, reviewed, approved, paid, published, amended/cancelled.

### 1.9 Re-run and duplicate payslip risk

Payslip has a unique employee/month/year index, but some reset/re-run paths do not delete or supersede old payslips first.

Recommended direction:

- Do not overwrite approved payslips.
- For draft recalculation, safely replace draft payslips.
- For approved payroll, use amendment/reversal records.
- Store calculation version and superseded reference.

### 1.10 Auditability is not deep enough

Production payroll must explain every number.

Each payslip should answer:

- Which salary version was used?
- Which attendance snapshot was used?
- Which city/state policy was used?
- Which statutory rule version was used?
- Which deductions were active?
- Who calculated it?
- Who approved it?
- What changed from the previous month?

## 2. Production-Grade Payroll Architecture

### 2.1 Recommended core modules

- Payroll setup: companies, legal entities, branches, cities, states, regions.
- Rule management: earnings, deductions, taxes, statutory rules, city policies, calendars.
- Employee payroll profile: salary version, location, tax regime, bank details, compliance identifiers.
- Payroll input snapshot: attendance, leaves, LOP, overtime, deductions, reimbursements, adjustments.
- Payroll calculation engine: deterministic, versioned, testable.
- Payroll run lifecycle: validate, calculate, review, approve, pay, publish, amend.
- Payslip engine: immutable output with calculation trace.
- Reporting: payroll register, bank file, statutory reports, variance reports, accounting exports.
- Audit/security: maker-checker approval, RBAC, PII masking, immutable logs.

### 2.2 Recommended data model additions

Suggested models:

- `LegalEntity`
- `Branch`
- `PayrollLocation`
- `EmployeePayrollProfile`
- `PayrollRegion`
- `PayrollRuleSet`
- `CityPayrollPolicy`
- `ProfessionalTaxRuleSet`
- `HolidayCalendar`
- `PayCalendar`
- `PayrollInputSnapshot`
- `PayrollCalculationTrace`
- `PayrollRunApproval`
- `PayrollAmendment`

These models should be tenant-scoped and effective-dated wherever rules can change over time.

### 2.3 Calculation should be deterministic

The engine should not read live mutable records during final calculation. It should first create an input snapshot, then calculate from that snapshot.

Recommended flow:

1. Build payroll input snapshot.
2. Resolve employee salary version.
3. Resolve employee location/city policy for the period.
4. Resolve attendance, leave, overtime, deductions, tax declarations, and adjustments.
5. Run validations.
6. Calculate earnings, statutory deductions, tax, post-tax deductions, employer contributions, and net pay.
7. Save calculation trace.
8. Generate draft payslip.
9. Approve and lock.
10. Publish payslip and export payment/reporting files.

## 3. City-Wise Payroll Functionality

### 3.1 What city-wise payroll should control

City-wise payroll should not be only a city dropdown. It should control all payroll behavior that changes by employee location.

City/state/location policy should support:

- Professional tax rules.
- Holiday calendars.
- Weekly-off patterns.
- Metro/non-metro classification for HRA-related tax treatment.
- Local/city compensatory allowances.
- Minimum wage category mapping.
- Overtime rules.
- Labor welfare fund rules where applicable.
- ESI/location applicability where applicable.
- Pay calendar and cutoff dates.
- Leave encashment or LOP behavior where policy differs.
- Branch/legal entity bank and accounting mapping.

### 3.2 Employee location profile

Each employee needs an effective-dated payroll location profile:

- Employee
- Legal entity
- Branch
- Work city
- Work state
- Payroll region
- Effective from
- Effective to
- Override policy, if any

This allows payroll to calculate correctly when an employee transfers city mid-month.

### 3.3 City policy resolution priority

Recommended rule resolution order:

1. Employee-specific override.
2. Employee payroll profile location.
3. Branch policy.
4. Legal entity policy.
5. Tenant default policy.

The resolved policy ID and version must be stored on the payroll input snapshot and payslip trace.

### 3.4 Mid-month city transfer

If an employee moves from one city to another during a payroll month, payroll should split the month into segments.

Example:

- Segment 1: Ahmedabad policy from day 1 to day 15.
- Segment 2: Mumbai policy from day 16 to month end.

Each segment should calculate applicable earnings, PT, holidays, LOP, overtime, and allowances according to that city's policy. The payslip can show combined totals, while the trace stores segment-level calculation.

### 3.5 City-wise UI requirements

Recommended screens:

- Payroll Settings > Locations
- Payroll Settings > Branches
- Payroll Settings > City Policies
- Payroll Settings > Statutory Rule Sets
- Payroll Settings > Holiday Calendars
- Employee Profile > Payroll Location
- Payroll Run > City/Branch Filters
- Payroll Run > Preflight Warnings by City
- Payroll Reports > City-wise Payroll Register

### 3.6 City-wise APIs

Suggested API groups:

- `GET/POST /api/payroll/locations`
- `GET/POST /api/payroll/branches`
- `GET/POST /api/payroll/regions`
- `GET/POST /api/payroll/city-policies`
- `GET/POST /api/payroll/rule-sets`
- `GET/POST /api/payroll/holiday-calendars`
- `GET/PUT /api/payroll/employees/:employeeId/profile`
- `POST /api/payroll/runs/:runId/preflight`
- `POST /api/payroll/runs/:runId/simulate`

## 4. Payroll Validations Needed Before Calculation

Production payroll should block or warn before calculation.

Blockers:

- Missing salary version.
- Missing payroll location.
- Missing city policy.
- Missing attendance for required period.
- Missing bank details for employees included in payout.
- Invalid or overlapping salary versions.
- Invalid or overlapping location profiles.
- Duplicate payslip for locked period.
- Employee joined after payroll period but included incorrectly.
- Employee exited before payroll period but included incorrectly.

Warnings:

- Net pay is zero or negative.
- Net pay changed beyond configured variance threshold.
- Gross pay changed unexpectedly.
- City policy changed mid-month.
- High LOP days.
- Manual adjustment added.
- Deduction exceeds configured limit.

## 5. Production Payroll Lifecycle

Recommended lifecycle:

1. Draft run created.
2. Preflight validation.
3. Input snapshot generated.
4. Payroll simulated.
5. HR review.
6. Finance review.
7. Approval lock.
8. Bank payout export.
9. Paid marking.
10. Payslip publish.
11. Accounting export.
12. Amendment or reversal if correction is required.

Only draft payroll should be recalculated directly. Approved payroll should be corrected through an amendment flow.

## 6. Reports Required For Production

Minimum reports:

- Payroll register.
- Employee payslip.
- Bank transfer file.
- City-wise payroll cost report.
- Branch-wise payroll cost report.
- Department-wise payroll cost report.
- Variance report versus previous month.
- Statutory contribution report.
- Deduction report.
- Loan/advance recovery report.
- Full and final settlement report.
- Payroll audit report.
- Payroll exception report.

## 7. Implementation Roadmap

### Phase 1: Stabilize current payroll

- Fix TDS service method mismatch.
- Use payroll period dates for deduction applicability instead of current date.
- Stop treating missing attendance as full present without approval.
- Apply salary deduction components consistently.
- Fix draft re-run duplicate payslip behavior.
- Mount or remove unused salary revision routes.
- Add missing salary template backend route or remove the UI.
- Connect payroll rules UI to the active engine or mark it inactive.

### Phase 2: Establish canonical payroll data

- Choose one salary source of truth.
- Migrate active salary data.
- Add employee payroll profile.
- Add effective-dated location assignment.
- Add effective-dated salary versioning.
- Add validation for overlaps and gaps.

### Phase 3: Add city-wise foundation

- Add legal entity, branch, payroll location, region, and city policy models.
- Add holiday calendar and pay calendar models.
- Add city/state rule-set assignment.
- Add employee payroll location UI.
- Add city-wise payroll filters and reports.

### Phase 4: Build new calculation engine

- Create snapshot-based payroll calculation.
- Add rule resolver.
- Add city-wise calculation context.
- Add component calculation trace.
- Add validation engine.
- Add test fixtures for multiple cities and edge cases.

### Phase 5: Production controls

- Add maker-checker approvals.
- Add immutable payslip publish flow.
- Add amendment/reversal flow.
- Add bank export.
- Add accounting export.
- Add payroll variance dashboard.
- Add RBAC and audit logs.

## 8. Definition Of Production Grade

Payroll can be considered production-grade when:

- Every payslip is reproducible from stored snapshots and rule versions.
- Every amount has a traceable formula and input.
- Payroll can support location-specific rules.
- Payroll handles joiners, exits, transfers, arrears, LOP, overtime, loans, and manual adjustments.
- Approved payroll is immutable.
- Corrections use amendment/reversal flows.
- HR and finance approval is enforced.
- Reports match payslip totals and bank payout totals.
- Tests cover normal, edge, and compliance scenarios.
- Statutory values are configurable and effective-dated.

## 9. Recommended First Build Target

The best first production-grade target is:

- One canonical employee salary version.
- Employee payroll profile with city/state/branch.
- City policy resolver.
- Preflight validation.
- Snapshot-based calculation.
- Draft payroll preview with trace.
- Approval lock.
- City-wise payroll register.

This gives a strong foundation without trying to rewrite every advanced payroll feature in one risky step.
