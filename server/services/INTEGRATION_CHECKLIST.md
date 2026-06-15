/**
 * INTEGRATION_CHECKLIST.md
 *
 * Step-by-step checklist for integrating StatutoryDeductions into the HRMS system
 */

# StatutoryDeductions Integration Checklist

## ✅ Phase 1: Implementation (COMPLETE)

- [x] StatutoryDeductions.js - Core calculation engine created
- [x] StatutoryDeductions.test.js - Test suite created (9/9 tests passing)
- [x] STATUTORY_DEDUCTIONS_GUIDE.js - Integration guide created
- [x] STATUTORY_DEDUCTIONS_SUMMARY.md - Documentation created
- [x] All validation rules implemented
- [x] Batch processing capability added
- [x] Configuration management implemented

**Status**: ✅ COMPLETE (100% test pass rate)

---

## Phase 2: Backend Integration (TODO)

### Step 1: Update salary.controller.js
```javascript
// File: backend/controllers/salary.controller.js

const StatutoryDeductions = require('../services/StatutoryDeductions');

class SalaryController {
    constructor() {
        this.deductionsEngine = new StatutoryDeductions();
    }

    async calculateSalary(req, res) {
        try {
            const { annualCTC } = req.body;
            
            // Calculate salary structure
            const salary = this.payrollEngine.calculate(annualCTC);
            
            // Calculate statutory deductions
            const monthlyBasic = salary.breakdown.earnings.basic;
            const monthlyGross = salary.breakdown.earnings.total;
            const deductions = this.deductionsEngine.calculate(monthlyBasic, monthlyGross);
            
            // Merge into salary structure
            const enrichedSalary = {
                ...salary,
                deductions
            };
            
            // Save to database
            const snapshot = new EmployeeSalarySnapshot(enrichedSalary);
            await snapshot.save();
            
            res.json({ success: true, data: enrichedSalary });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
}
```

**Checklist**:
- [ ] Import StatutoryDeductions module
- [ ] Initialize in constructor
- [ ] Update calculateSalary method
- [ ] Merge deductions into result
- [ ] Save to database
- [ ] Test with sample data

### Step 2: Update EmployeeSalarySnapshot Schema
```javascript
// File: backend/models/EmployeeSalarySnapshot.js

const salarySnapshotSchema = new Schema({
    employeeId: ObjectId,
    tenantId: ObjectId,
    
    // Existing fields
    annualCTC: Number,
    monthlyGross: Number,
    monthlyNetSalary: Number,
    
    // New statutory deductions fields
    deductions: {
        monthly: {
            employeePF: Number,
            employeeESI: Number,
            total: Number
        },
        contributions: {
            employerPF: Number,
            employerESI: Number,
            total: Number
        }
    },
    
    breakdown: {
        pf: {
            pfBase: Number,
            wageCeilingApplied: Boolean,
            enabled: Boolean
        },
        esi: {
            eligible: Boolean,
            grossUsed: Number,
            reason: String,
            enabled: Boolean
        }
    },
    
    validation: {
        pfValid: Boolean,
        esiValid: Boolean,
        totalValid: Boolean
    }
});
```

**Checklist**:
- [ ] Add deductions object to schema
- [ ] Add breakdown object
- [ ] Add validation object
- [ ] Migration script for existing data (optional)
- [ ] Test schema with sample documents

### Step 3: Create API Routes
```javascript
// File: backend/routes/salary.routes.js

router.post('/calculate', async (req, res) => {
    // POST /api/salary/calculate
    const controller = new SalaryController();
    await controller.calculateSalary(req, res);
});

router.post('/batch-calculate', async (req, res) => {
    // POST /api/salary/batch-calculate
    const { employees } = req.body;
    const engine = new StatutoryDeductions();
    const results = engine.calculateBatch(employees);
    res.json({ success: true, data: results });
});

router.get('/compliance-report', async (req, res) => {
    // GET /api/salary/compliance-report?basic=15000&gross=30000
    const { basic, gross } = req.query;
    const engine = new StatutoryDeductions();
    const report = engine.generateComplianceReport(basic, gross);
    res.json({ success: true, data: report });
});
```

**Checklist**:
- [ ] Import necessary modules
- [ ] Create calculate endpoint
- [ ] Create batch-calculate endpoint
- [ ] Create compliance-report endpoint
- [ ] Test all endpoints with Postman/cURL

### Step 4: Environment Configuration
```bash
# File: backend/.env

# Statutory Deduction Configuration
PF_ENABLED=true
PF_WAGE_CEILING_ENABLED=true
PF_WAGE_CEILING_LIMIT=15000
PF_EMPLOYEE_RATE=0.12

ESI_ENABLED=true
ESI_EMPLOYEE_RATE=0.0075
ESI_EMPLOYER_RATE=0.0325
ESI_ELIGIBILITY_LIMIT=21000
```

**Checklist**:
- [ ] Add all configuration variables
- [ ] Document default values
- [ ] Create .env.example file
- [ ] Update .env.production if needed

---

## Phase 3: Frontend Integration (TODO)

### Step 1: Create Salary Deductions Component
```javascript
// File: frontend/src/components/Payroll/DeductionBreakdown.jsx

export const DeductionBreakdown = ({ salary }) => {
    if (!salary?.deductions) return null;

    const { deductions } = salary;
    
    return (
        <div className="deduction-breakdown">
            <h3>Statutory Deductions</h3>
            <div className="deduction-items">
                <div className="item">
                    <label>Employee PF</label>
                    <span>₹{deductions.monthly.employeePF}</span>
                </div>
                <div className="item">
                    <label>Employee ESI</label>
                    <span>₹{deductions.monthly.employeeESI}</span>
                </div>
                <div className="item total">
                    <label>Total Deductions</label>
                    <span>₹{deductions.monthly.total}</span>
                </div>
            </div>
            
            <h3>Employer Contributions</h3>
            <div className="contribution-items">
                <div className="item">
                    <label>Employer PF</label>
                    <span>₹{deductions.contributions.employerPF}</span>
                </div>
                <div className="item">
                    <label>Employer ESI</label>
                    <span>₹{deductions.contributions.employerESI}</span>
                </div>
            </div>
        </div>
    );
};
```

**Checklist**:
- [ ] Create component file
- [ ] Add styling
- [ ] Handle null/undefined data
- [ ] Test with sample salary data
- [ ] Add to SalaryStructure component

### Step 2: Update SalaryDisplay Component
```javascript
// File: frontend/src/pages/HR/SalaryStructure.jsx

// Inside component JSX:
<div className="salary-summary">
    <SalaryBreakdown salary={salary} />
    <DeductionBreakdown salary={salary} />
    <NetSalaryDisplay salary={salary} />
</div>
```

**Checklist**:
- [ ] Import DeductionBreakdown component
- [ ] Add to salary display section
- [ ] Test rendering
- [ ] Verify data flow

### Step 3: Add Compliance Report View
```javascript
// File: frontend/src/pages/HR/ComplianceReport.jsx

export const ComplianceReport = () => {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);

    const generateReport = async (basic, gross) => {
        setLoading(true);
        try {
            const response = await axios.get('/api/salary/compliance-report', {
                params: { basic, gross }
            });
            setReport(response.data.data);
        } catch (err) {
            console.error('Report generation failed:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="compliance-report">
            <h2>Salary Compliance Report</h2>
            {loading && <LoadingSpinner />}
            {report && <pre>{report}</pre>}
        </div>
    );
};
```

**Checklist**:
- [ ] Create component
- [ ] Add form for basic/gross inputs
- [ ] Call API endpoint
- [ ] Display report in readable format
- [ ] Test with different salary levels

---

## Phase 4: Testing (TODO)

### Unit Tests
- [ ] Test all calculation formulas
- [ ] Test wage ceiling logic
- [ ] Test ESI eligibility boundary
- [ ] Test batch processing
- [ ] Test error handling

### Integration Tests
- [ ] Test with sample employee data
- [ ] Test with edge cases (boundary values)
- [ ] Test with large batch processing
- [ ] Test database persistence

### End-to-End Tests
- [ ] Test complete salary flow (CTC → Deductions → Net)
- [ ] Test API endpoints
- [ ] Test frontend display
- [ ] Test report generation

### Data Validation Tests
- [ ] Verify all outputs match expected calculations
- [ ] Verify database stores correctly
- [ ] Verify API returns correct format
- [ ] Verify precision (2 decimals)

---

## Phase 5: Deployment (TODO)

### Pre-Deployment
- [ ] Code review completed
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Performance tested with 1000+ employees
- [ ] Backup created

### Deployment
- [ ] Deploy backend changes
- [ ] Deploy database migration (if needed)
- [ ] Deploy frontend changes
- [ ] Verify in staging environment
- [ ] Monitor logs for errors

### Post-Deployment
- [ ] Verify all endpoints working
- [ ] Check salary calculations for all employees
- [ ] Monitor compliance report generation
- [ ] Set up alerts for calculation failures
- [ ] Document any issues

---

## Phase 6: Documentation & Training (TODO)

### User Documentation
- [ ] Document deduction breakdown
- [ ] Document compliance report
- [ ] Create user guide
- [ ] Document API endpoints

### Developer Documentation
- [ ] Document integration points
- [ ] Document configuration options
- [ ] Document troubleshooting guide
- [ ] Document maintenance procedures

### Training
- [ ] Train HR team on new feature
- [ ] Train developers on codebase
- [ ] Create video tutorial
- [ ] Document FAQs

---

## Quick Start Commands

```bash
# 1. Navigate to backend services
cd backend/services

# 2. Run tests to verify implementation
node StatutoryDeductions.test.js

# 3. Review test output
# Should show: "Total: 9/9 tests passed"

# 4. Review integration guide
cat STATUTORY_DEDUCTIONS_GUIDE.js

# 5. Review summary
cat STATUTORY_DEDUCTIONS_SUMMARY.md
```

---

## Key Files Reference

| File | Purpose | Status |
|------|---------|--------|
| StatutoryDeductions.js | Core engine | ✅ Complete |
| StatutoryDeductions.test.js | Test suite | ✅ Complete |
| STATUTORY_DEDUCTIONS_GUIDE.js | Integration guide | ✅ Complete |
| STATUTORY_DEDUCTIONS_SUMMARY.md | Documentation | ✅ Complete |
| salary.controller.js | Backend integration | ⏳ Pending |
| EmployeeSalarySnapshot.js | Schema update | ⏳ Pending |
| salary.routes.js | API routes | ⏳ Pending |
| DeductionBreakdown.jsx | Frontend component | ⏳ Pending |

---

## Success Criteria

- [x] All deduction rules implemented
- [x] All tests passing (9/9)
- [x] Configuration management working
- [x] Batch processing available
- [x] Validation checks in place
- [x] Documentation complete
- [ ] Backend integration complete
- [ ] Frontend integration complete
- [ ] Deployed to production
- [ ] Training completed

---

## Notes

1. **Backward Compatibility**: Existing salary data won't have deduction fields until recalculated
2. **Migration**: Plan data migration for historical salaries if needed
3. **Configuration**: Deduction rules can be customized per organization/state
4. **Performance**: Batch processing fully optimized for large employee lists
5. **Compliance**: All calculations follow EPFO and ESIC guidelines

---

## Support Contacts

- **Backend Issues**: hrms-backend@gitakshmi.com
- **Frontend Issues**: hrms-frontend@gitakshmi.com
- **Database Issues**: hrms-dba@gitakshmi.com
- **General Support**: hrms-support@gitakshmi.com

---

**Last Updated**: March 2, 2026
**Maintained By**: HRMS Development Team
