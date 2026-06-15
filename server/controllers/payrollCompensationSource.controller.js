/**
 * Payroll Process Controller - Compensation Source Support
 * 
 * PATCH: Add support for useCompensationSource flag in preview and run endpoints
 * This allows payroll to read from Employee Compensation instead of Salary Templates
 * 
 * Backward compatible: Old requests without flag default to template-based payroll
 */

const mongoose = require('mongoose');
const payrollService = require('../services/payroll.service');
const { selectPayrollSource, extractCompensationBreakdown } = require('../services/payrollCompensationSource.service');

/**
 * PATCH to existing POST /payroll/process/preview
 * 
 * Request body changes:
 * {
 *   month: "YYYY-MM",
 *   useCompensationSource: true,  // NEW: Optional flag
 *   items: [
 *     {
 *       employeeId: "xxx",
 *       salaryTemplateId: "yyy",  // Still required as fallback
 *       // NEW: Can omit if using compensation
 *     }
 *   ]
 * }
 */
exports.previewPayrollWithCompensationSupport = async (req, res) => {
    try {
        const { month, useCompensationSource = false, items } = req.body;
        
        if (!month || !items || items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Month and items array are required" 
            });
        }

        const [year, monthNum] = month.split('-');
        const tenantId = req.tenantId;
        
        const previews = [];

        for (const item of items) {
            const { employeeId, salaryTemplateId } = item;
            
            try {
                // GUARD: Select payroll source (Compensation or Template)
                const sourceSelection = await selectPayrollSource(
                    req.tenantDB,
                    tenantId,
                    employeeId,
                    useCompensationSource
                );

                // console.log(`[Preview] Employee ${employeeId}:`, sourceSelection.message);

                // Get template to use (either from compensation or provided)
                let templateToUse = null;
                
                if (sourceSelection.source === 'COMPENSATION') {
                    // Use converted compensation template
                    templateToUse = sourceSelection.template;
                } else if (salaryTemplateId) {
                    // Use provided template
                    const SalaryTemplate = req.tenantDB.model('SalaryTemplate');
                    templateToUse = await SalaryTemplate.findById(salaryTemplateId).lean();
                } else {
                    throw new Error('No salary template provided and compensation source not available');
                }

                if (!templateToUse) {
                    throw new Error(`Salary template ${salaryTemplateId} not found`);
                }

                // Call existing payroll calculation (works with both template and converted compensation)
                const payslip = await payrollService.calculateEmployeePayroll(
                    req.tenantDB,
                    tenantId,
                    { _id: employeeId },
                    monthNum,
                    year,
                    new Date(year, monthNum - 1, 1),
                    new Date(year, monthNum, 0),
                    new Date(year, monthNum, 0).getDate(),
                    new Set(),
                    null,
                    templateToUse._id,
                    true // dryRun = true for preview
                );

                // Enhance response with source info
                const preview = {
                    employeeId,
                    source: sourceSelection.source, // NEW: Track source
                    useCompensation: sourceSelection.useCompensation,
                    fallback: sourceSelection.fallback || false,
                    fallbackReason: sourceSelection.fallbackReason,
                    gross: payslip.grossEarnings,
                    netPay: payslip.netPay,
                    deductions: payslip.preTaxDeductionsTotal + payslip.postTaxDeductionsTotal + payslip.incomeTax,
                    incomeTax: payslip.incomeTax,
                    
                    // NEW: Include compensation breakdown if used
                    ...(sourceSelection.source === 'COMPENSATION' && {
                        compensationBreakdown: extractCompensationBreakdown(sourceSelection.compensation)
                    })
                };

                previews.push(preview);
            } catch (err) {
                console.error(`[Preview] Error for employee ${employeeId}:`, err.message);
                previews.push({
                    employeeId,
                    error: err.message,
                    success: false
                });
            }
        }

        res.json({
            success: true,
            message: `Preview calculated for ${previews.filter(p => !p.error).length}/${previews.length} employees`,
            data: previews
        });
    } catch (error) {
        console.error('[Preview] Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Preview failed'
        });
    }
};

/**
 * PATCH to existing POST /payroll/process/run
 * 
 * Request body changes:
 * {
 *   month: "YYYY-MM",
 *   useCompensationSource: true,  // NEW: Optional flag
 *   items: [
 *     {
 *       employeeId: "xxx",
 *       salaryTemplateId: "yyy"  // Still required as fallback
 *     }
 *   ]
 * }
 */
exports.runPayrollWithCompensationSupport = async (req, res) => {
    try {
        const { month, useCompensationSource = false, items } = req.body;
        
        if (!month || !items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Month and items array are required"
            });
        }

        const [year, monthNum] = month.split('-');
        const tenantId = req.tenantId;
        const userId = req.user?.id;

        // Prepare items with source selection
        const processItems = [];
        const sourceMap = {}; // Track which source each employee used

        for (const item of items) {
            const { employeeId, salaryTemplateId } = item;
            
            try {
                const sourceSelection = await selectPayrollSource(
                    req.tenantDB,
                    tenantId,
                    employeeId,
                    useCompensationSource
                );

                // console.log(`[Run] Employee ${employeeId}:`, sourceSelection.message);

                sourceMap[employeeId] = {
                    source: sourceSelection.source,
                    useCompensation: sourceSelection.useCompensation,
                    fallback: sourceSelection.fallback,
                    reason: sourceSelection.message
                };

                // Use template from compensation if available
                const templateId = sourceSelection.source === 'COMPENSATION' 
                    ? sourceSelection.template._id 
                    : salaryTemplateId;

                processItems.push({
                    employeeId,
                    salaryTemplateId: templateId
                });
            } catch (err) {
                console.error(`[Run] Source selection error for ${employeeId}:`, err.message);
                // Continue but mark issue
                sourceMap[employeeId] = {
                    error: err.message,
                    fallback: true
                };
            }
        }

        // Call existing payroll service (works with selected sources)
        const payrollRun = await payrollService.runPayroll(
            req.tenantDB,
            tenantId,
            monthNum,
            parseInt(year),
            userId,
            processItems
        );

        res.json({
            success: true,
            message: `Payroll processed successfully using ${useCompensationSource ? 'Compensation + Template fallback' : 'Salary Templates'}`,
            data: {
                payrollRunId: payrollRun._id,
                processedEmployees: payrollRun.processedEmployees,
                failedEmployees: payrollRun.failedEmployees,
                totalGross: payrollRun.totalGross,
                totalNetPay: payrollRun.totalNetPay,
                sourceMap, // NEW: Track which source each employee used
                errors: payrollRun.errors
            }
        });
    } catch (error) {
        console.error('[Run] Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Payroll run failed'
        });
    }
};
