/**
 * FRONTEND: Payroll Compensation Source Toggle
 * 
 * Add to ProcessPayroll.jsx component
 * 
 * Changes:
 * 1. Add state for compensation source toggle
 * 2. Add toggle UI in header
 * 3. Pass flag to preview and run endpoints
 * 4. Show source indicator in results
 */

// ============================================================================
// STATE ADDITIONS (in ProcessPayroll functional component)
// ============================================================================

/*
// Add these states at the top of the ProcessPayroll component:

const [useCompensationSource, setUseCompensationSource] = useState(false);
const [sourceWarnings, setSourceWarnings] = useState({});

*/

// ============================================================================
// UI COMPONENT: Toggle Switch
// ============================================================================

export const PayrollSourceToggle = ({ 
    useCompensationSource, 
    onToggle, 
    loading = false 
}) => {
    return (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900">Payroll Data Source</h3>
                        <p className="text-xs text-slate-500">
                            {useCompensationSource 
                                ? '✓ Using Employee Compensation (with Salary Template fallback)'
                                : '→ Using Salary Templates'}
                        </p>
                    </div>
                </div>
                
                <label className="flex items-center gap-3 cursor-pointer">
                    <span className="text-sm font-medium text-slate-700">
                        {useCompensationSource ? 'ON' : 'OFF'}
                    </span>
                    <div className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                        useCompensationSource ? 'bg-green-500' : 'bg-slate-300'
                    }`}>
                        <input
                            type="checkbox"
                            checked={useCompensationSource}
                            onChange={(e) => onToggle(e.target.checked)}
                            disabled={loading}
                            className="sr-only"
                        />
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                            useCompensationSource ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                    </div>
                </label>
            </div>
            
            {/* Info Box */}
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <p className="font-medium mb-1">💡 About Payroll Sources:</p>
                <ul className="space-y-1 ml-3 list-disc">
                    <li><strong>OFF (Template):</strong> Uses traditional Salary Templates for calculation</li>
                    <li><strong>ON (Compensation):</strong> Reads from Employee Compensation records, falls back to Template if unavailable</li>
                    <li>Both methods support attendance adjustment, deductions, and tax calculation</li>
                    <li>Payslip always shows which source was used</li>
                </ul>
            </div>
        </div>
    );
};

// ============================================================================
// HELPER FUNCTION: Updated API Calls
// ============================================================================

/*
// Update calculatePreview function:

const calculatePreview = async () => {
    const itemsToPreview = employees
        .filter(e => selectedRowKeys.includes(e._id))
        .filter(e => e.selectedTemplateId)
        .map(e => ({ employeeId: e._id, salaryTemplateId: e.selectedTemplateId }));

    if (itemsToPreview.length === 0) {
        messageApi.warning("Select employees to preview");
        return;
    }

    setCalculating(true);
    try {
        const res = await api.post('/payroll/process/preview', {
            month: month.format('YYYY-MM'),
            useCompensationSource,  // NEW: Pass flag
            items: itemsToPreview
        });

        console.log('Preview Response:', res.data.data);

        const newPreviews = {};
        const warnings = {};
        
        res.data.data.forEach(p => {
            newPreviews[p.employeeId] = p;
            
            // Track fallbacks
            if (p.fallback) {
                warnings[p.employeeId] = {
                    type: 'fallback',
                    message: p.fallbackReason
                };
            }
        });
        
        setPreviews(newPreviews);
        setSourceWarnings(warnings);
        
        messageApi.success(`Calculated for ${itemsToPreview.length} employee(s)`);
    } catch (err) {
        console.error('Calculation Error:', err);
        messageApi.error(err.response?.data?.message || "Calculation failed");
    } finally {
        setCalculating(false);
    }
};

// Update runPayroll function:

const runPayroll = async () => {
    const itemsToProcess = employees
        .filter(e => selectedRowKeys.includes(e._id))
        .filter(e => e.selectedTemplateId)
        .map(e => ({
            employeeId: e._id,
            salaryTemplateId: e.selectedTemplateId
        }));

    if (itemsToProcess.length === 0) {
        messageApi.error("No valid employees selected");
        return;
    }

    if (!window.confirm(
        `Process payroll for ${itemsToProcess.length} employees using ${
            useCompensationSource ? 'Compensation' : 'Templates'
        }?`
    )) return;

    setPayrollRunning(true);
    try {
        const response = await api.post('/payroll/process/run', {
            month: month.format('YYYY-MM'),
            useCompensationSource,  // NEW: Pass flag
            items: itemsToProcess
        });

        const result = response.data.data;
        setPayrollResult(result);
        setSelectedRowKeys([]);
        setPreviews({});

        messageApi.success(
            `Payroll processed for ${result.processedEmployees} employees via ${
                useCompensationSource ? 'Compensation' : 'Templates'
            }`
        );

        // Log source map for audit
        console.log('Payroll Source Mapping:', result.sourceMap);

        await fetchEmployees();
    } catch (err) {
        messageApi.error(err.response?.data?.message || "Payroll run failed");
    } finally {
        setPayrollRunning(false);
    }
};

*/

// ============================================================================
// TABLE COLUMN UPDATE: Show Source Indicator
// ============================================================================

/*
// Add column to table to show which source will be used:

{
    title: 'Payroll Source',
    key: 'source',
    render: (_, record) => {
        const warning = sourceWarnings[record._id];
        return (
            <div>
                {useCompensationSource ? (
                    <Tag 
                        color={warning ? 'orange' : 'green'}
                        className="text-xs"
                    >
                        {warning ? `⚠ ${warning.message.split(':')[0]}` : '✓ Compensation'}
                    </Tag>
                ) : (
                    <Tag color="blue" className="text-xs">
                        Template
                    </Tag>
                )}
            </div>
        );
    }
}

*/

// ============================================================================
// INTEGRATION INTO EXISTING ProcessPayroll.jsx
// ============================================================================

/*

Add this after the month picker and before the employee table:

<PayrollSourceToggle 
    useCompensationSource={useCompensationSource}
    onToggle={setUseCompensationSource}
    loading={loading}
/>

*/
