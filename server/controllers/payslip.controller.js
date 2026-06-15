/**
 * Payslip Controller
 * Helper to get models from tenant database
 */
const mongoose = require('mongoose');
const { normalizeRoleName } = require('../middleware/auth.jwt');

function canAccessPayslip(req, payslip) {
    const userRole = normalizeRoleName(req.user?.role || '');
    const elevatedRoles = new Set([
        'psa',
        'super_admin',
        'admin',
        'company_super_admin',
        'company_admin',
        'hr',
        'hr_admin',
        'human_resource',
    ]);

    if (elevatedRoles.has(userRole)) {
        return true;
    }

    const requestIdentity = new Set(
        [
            req.user?.id,
            req.user?._id,
            req.user?.employeeId,
            req.user?.employeeCode,
        ]
            .filter(Boolean)
            .map((value) => String(value).trim().toLowerCase())
    );

    const payslipIdentity = new Set(
        [
            payslip?.employeeId,
            payslip?.employeeInfo?.employeeId,
            payslip?.employeeInfo?.employeeCode,
        ]
            .filter(Boolean)
            .map((value) => String(value).trim().toLowerCase())
    );

    return Array.from(requestIdentity).some((value) => payslipIdentity.has(value));
}

function getModels(req) {
    if (!req.tenantDB) {
        throw new Error("Tenant database connection not available");
    }
    const db = req.tenantDB;
    try {
        return {
            Payslip: db.model("Payslip"),
            PayrollRun: db.model("PayrollRun"),
            Employee: db.model("Employee")
        };
    } catch (err) {
        console.error("[payslip.controller] Error retrieving models:", err.message);
        throw new Error(`Failed to retrieve models from tenant database: ${err.message}`);
    }
}

/**
 * Get all payslips for HR admin view
 * GET /api/payroll/payslips
 */
exports.getPayslips = async (req, res) => {
    try {
        const tenantDB = req.tenantDB;
        const Payslip = tenantDB.model('Payslip');

        // Fetch all payslips for the tenant
        const payslips = await Payslip.find({})
            .sort({ year: -1, month: -1, createdAt: -1 });

        res.json({ success: true, data: payslips });
    } catch (error) {
        console.error("[GET_PAYSLIPS] Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get payslip for a specific employee and period
 * GET /api/payslip/:employeeId/:period
 */
exports.getPayslip = async (req, res) => {
    try {
        const { employeeId, period } = req.params;
        const tenantId = req.user.tenantId;

        const { Payslip, Employee } = getModels(req);

        // Find the payslip for the period
        const payslip = await Payslip.findOne({ tenantId, employeeId, period }).lean();

        if (!payslip) {
            return res.status(404).json({ success: false, message: "Payslip not found for this period" });
        }

        // Populate employee details for display
        const employee = await Employee.findById(employeeId).select('firstName lastName employeeId department designation bankDetails').lean();

        res.json({
            success: true,
            data: {
                employee,
                period,
                earnings: payslip.earnings,
                deductions: payslip.deductions,
                benefits: payslip.benefits,
                attendance: payslip.attendance,
                totals: {
                    grossEarnings: payslip.grossEarnings,
                    totalDeductions: payslip.totalDeductions,
                    netPay: payslip.netPay
                }
            }
        });

        // Start of replaced content
    } catch (error) {
        console.error("[GET_PAYSLIP] Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get payslip for a specific employee and period (query param support)
 * GET /api/payroll/payslips/:employeeId?month=YYYY-MM
 */
exports.getPayslipByEmployeeAndMonth = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { month } = req.query; // format: "2026-02"
        const tenantId = req.user.tenantId;

        if (!month) {
            return res.status(400).json({ success: false, message: "Month query parameter is required (YYYY-MM)" });
        }

        const [currYear, currMonth] = month.split('-');

        const { Payslip, Employee } = getModels(req);

        // Find the payslip for the period
        const payslip = await Payslip.findOne({
            tenantId,
            employeeId,
            month: parseInt(currMonth),
            year: parseInt(currYear)
        }).lean();

        if (!payslip) {
            return res.status(404).json({ success: false, message: "Payslip not found for this period" });
        }

        // Populate employee details for display
        const employee = await Employee.findById(employeeId).select('firstName lastName employeeId department designation bankDetails').lean();

        // Populate department name if needed
        if (employee.department) {
            const Department = req.tenantDB.model('Department');
            const dept = await Department.findById(employee.department);
            if (dept) employee.departmentName = dept.name;
        }

        res.json({
            success: true,
            data: {
                employeeDetails: employee,
                payslipDate: new Date(payslip.year, payslip.month - 1, 1),
                earnings: payslip.earningsSnapshot || payslip.earnings || [],
                deductions: [
                    ...(payslip.preTaxDeductionsSnapshot || []),
                    ...(payslip.incomeTax > 0 ? [{ name: 'Income Tax (TDS)', amount: payslip.incomeTax }] : []),
                    ...(payslip.postTaxDeductionsSnapshot || [])
                ],
                reimbursements: payslip.reimbursements || [],
                attendance: payslip.attendanceSummary || payslip.attendance,
                grossEarnings: payslip.grossEarnings,
                totalDeductions: (payslip.preTaxDeductionsTotal || 0) + (payslip.incomeTax || 0) + (payslip.postTaxDeductionsTotal || 0),
                netPay: payslip.netPay
            }
        });

    } catch (error) {
        console.error("[GET_PAYSLIP_PREVIEW] Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// End of replaced content

/**
 * Get all payslips for the logged-in employee
 * GET /api/payroll/payslips/my
 */
exports.getMyPayslips = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const empCode = req.user.employeeId;
        const { year, month } = req.query;

        const { Payslip } = getModels(req);

        // ULTRA ROBUST SEARCH: Use $or to catch ObjectId, String, or even the EMP-XXXX code
        // [RESOLVE TENANT] - Ensure we have a valid tenant context
        const tenantId = req.user?.tenantId || req.tenantId;

        const filter = {
            tenantId: tenantId, // Always filter by tenant for schema safety (though DB-level isolated)
            $or: [
                { employeeId: userId },
                { employeeId: String(userId) },
                { 'employeeInfo.employeeId': empCode }
            ]
        };

        // If userId is a valid ObjectId string, add it to the $or as an actual ObjectId
        if (mongoose.Types.ObjectId.isValid(String(userId))) {
            filter.$or.push({ employeeId: new mongoose.Types.ObjectId(String(userId)) });
        }

        if (year) filter.year = parseInt(year);
        if (month) filter.month = parseInt(month);

        const payslips = await Payslip.find(filter)
            .populate('payrollRunId', 'status month year')
            .sort({ year: -1, month: -1 })
            .lean();

        // Transform data to match frontend expectations
        const formattedData = payslips.map(p => ({
            ...p,
            totals: {
                netSalary: p.netPay || 0,
                totalEarnings: p.grossEarnings || 0,
                totalDeductions: (p.preTaxDeductionsTotal || 0) + (p.incomeTax || 0) + (p.postTaxDeductionsTotal || 0),
                tax: p.incomeTax || 0
            },
            earnings: p.earningsSnapshot || [],
            deductions: [
                ...(p.preTaxDeductionsSnapshot || []),
                ...(p.incomeTax > 0 ? [{ name: 'Income Tax (TDS)', label: 'Income Tax (TDS)', amount: p.incomeTax }] : []),
                ...(p.postTaxDeductionsSnapshot || [])
            ],
            // Map labels for UI compatibility
            earningsFormatted: (p.earningsSnapshot || []).map(e => ({ ...e, label: e.name || e.label })),
            deductionsFormatted: [
                ...(p.preTaxDeductionsSnapshot || []).map(d => ({ ...d, label: d.name || d.label })),
                ...(p.incomeTax > 0 ? [{ name: 'Income Tax (TDS)', label: 'Income Tax (TDS)', amount: p.incomeTax }] : []),
                ...(p.postTaxDeductionsSnapshot || []).map(d => ({ ...d, label: d.name || d.label }))
            ]
        }));

        res.json({
            success: true,
            count: payslips.length,
            data: formattedData
        });

    } catch (error) {
        console.error('[getMyPayslips] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Generate and download payslip PDF (On-the-fly)
 * POST /api/payroll/payslips/:id/generate-pdf
 */
/**
 * Generate and download payslip PDF (System Default Layout)
 * POST /api/payroll/payslips/:id/generate-pdf
 */
exports.generatePayslipPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantDB = req.tenantDB;
        const Payslip = tenantDB.model('Payslip');

        const payslip = await Payslip.findById(id);
        if (!payslip) {
            return res.status(404).json({ success: false, message: 'Payslip not found' });
        }

        if (!canAccessPayslip(req, payslip)) {
            return res.status(403).json({
                success: false,
                message: 'You are not allowed to access this payslip.',
            });
        }

        // Use PDFKit to generate PDF
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        // Buffer the PDF to avoid sending corrupted files if an error happens mid-stream
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));

        const pdfGenerated = new Promise((resolve, reject) => {
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            doc.on('error', reject);
        });

        // --- DRAWING LOGIC ---
        // Header
        doc.fontSize(20).text('PAYSLIP', { align: 'center' });
        doc.moveDown();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthStr = monthNames[payslip.month - 1] || 'N/A';
        doc.fontSize(12).text(`${monthStr} ${payslip.year}`, { align: 'center' });
        doc.moveDown(2);

        // Employee Info
        doc.fontSize(14).text('Employee Information', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);
        doc.text(`Name: ${payslip.employeeInfo?.name || 'N/A'}`);
        doc.text(`Employee ID: ${payslip.employeeInfo?.employeeId || 'N/A'}`);
        doc.text(`Department: ${payslip.employeeInfo?.department || 'N/A'}`);
        doc.text(`Designation: ${payslip.employeeInfo?.designation || 'N/A'}`);
        doc.moveDown(2);

        // Earnings Section
        doc.fontSize(14).text('Earnings', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);

        if (payslip.earningsSnapshot && payslip.earningsSnapshot.length > 0) {
            payslip.earningsSnapshot.forEach(e => {
                const startY = doc.y;
                doc.text(`${e.name || 'Earning'}`, 50, startY);
                doc.text(`₹${(e.amount || 0).toLocaleString()}`, 50, startY, { align: 'right' });
            });
        }
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold');
        const grossY = doc.y;
        doc.text('Gross Earnings', 50, grossY);
        doc.text(`₹${(payslip.grossEarnings || 0).toLocaleString()}`, 50, grossY, { align: 'right' });
        doc.font('Helvetica');
        doc.moveDown(2);

        // Deductions Section
        doc.fontSize(14).text('Deductions', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);

        if (payslip.preTaxDeductionsSnapshot && payslip.preTaxDeductionsSnapshot.length > 0) {
            payslip.preTaxDeductionsSnapshot.forEach(d => {
                const startY = doc.y;
                doc.text(`${d.name || 'Deduction'}`, 50, startY);
                doc.text(`₹${(d.amount || 0).toLocaleString()}`, 50, startY, { align: 'right' });
            });
        }

        if (payslip.incomeTax > 0) {
            const taxY = doc.y;
            doc.text('Income Tax (TDS)', 50, taxY);
            doc.text(`₹${(payslip.incomeTax || 0).toLocaleString()}`, 50, taxY, { align: 'right' });
        }

        if (payslip.postTaxDeductionsSnapshot && payslip.postTaxDeductionsSnapshot.length > 0) {
            payslip.postTaxDeductionsSnapshot.forEach(d => {
                const startY = doc.y;
                doc.text(`${d.name || 'Deduction'}`, 50, startY);
                doc.text(`₹${(d.amount || 0).toLocaleString()}`, 50, startY, { align: 'right' });
            });
        }

        const totalDeductions = (payslip.preTaxDeductionsTotal || 0) + (payslip.incomeTax || 0) + (payslip.postTaxDeductionsTotal || 0);
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold');
        const dedY = doc.y;
        doc.text('Total Deductions', 50, dedY);
        doc.text(`₹${totalDeductions.toLocaleString()}`, 50, dedY, { align: 'right' });
        doc.font('Helvetica');
        doc.moveDown(2);

        // Net Pay
        doc.fontSize(16).fillColor('#059669');
        doc.font('Helvetica-Bold');
        const netY = doc.y;
        doc.text('Net Pay', 50, netY);
        doc.text(`₹${(payslip.netPay || 0).toLocaleString()}`, 50, netY, { align: 'right' });
        doc.fillColor('#000000');
        doc.font('Helvetica');
        doc.moveDown(2);

        // Attendance Summary
        if (payslip.attendanceSummary) {
            doc.fontSize(14).text('Attendance Summary', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10);
            doc.text(`Total Days: ${payslip.attendanceSummary.totalDays || 0}`);
            doc.text(`Present Days: ${payslip.attendanceSummary.presentDays || 0}`);
            doc.text(`Leave Days: ${payslip.attendanceSummary.leaveDays || 0}`);
            doc.text(`LOP Days: ${payslip.attendanceSummary.lopDays || 0}`);
        }

        // Footer
        doc.moveDown(3);
        doc.fontSize(8).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.text('This is a system-generated document', { align: 'center' });

        // Finalize
        doc.end();

        // Wait for buffer completion
        const finalPdfBuffer = await pdfGenerated;

        // Verify PDF signature
        const signature = finalPdfBuffer.slice(0, 5).toString();
        // console.log(`[GENERATE_PDF] PDF signature: ${signature}, size: ${finalPdfBuffer.length} bytes`);

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', finalPdfBuffer.length);

        // QUOTE THE FILENAME to handle spaces
        const safeFileName = `Payslip_${payslip.employeeInfo?.name || 'Emp'}_${payslip.month}-${payslip.year}.pdf`.replace(/"/g, '');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);

        return res.end(finalPdfBuffer, 'binary');

    } catch (error) {
        console.error('[GENERATE_PDF] Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

/**
 * Get payslip by ID (for employee self-service)
 * GET /api/payroll/payslips/:id
 */
exports.getPayslipById = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const { id } = req.params;
        const tenantDB = req.tenantDB;
        const Payslip = tenantDB.model('Payslip');

        // Note: You might want to ensure the user owns this payslip or is HR
        const payslip = await Payslip.findById(id);

        if (!payslip) {
            return res.status(404).json({ success: false, error: "Payslip not found" });
        }

        res.json({
            success: true,
            data: payslip
        });

    } catch (error) {
        console.error('[getPayslipById] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * LEGACY/SERVICE: Download payslip PDF using payslipPDF.service
 * GET /api/payroll/payslips/:id/download
 */
exports.downloadPayslipPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantDB = req.tenantDB;
        const Payslip = tenantDB.model('Payslip');

        const filter = { _id: id };
        // If employee, limit to own
        if (req.user.role === 'Employee') {
            filter.employeeId = req.user.id || req.user._id;
        }

        const payslip = await Payslip.findOne(filter);
        if (!payslip) {
            return res.status(404).json({ success: false, error: "Payslip not found" });
        }

        try {
            // Generate PDF using service
            const payslipPDFService = require('../services/payslipPDF.service');
            const pdfBuffer = await payslipPDFService.generatePayslipPDF(payslip.toObject());

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Payslip_${payslip.month}-${payslip.year}_${payslip.employeeInfo?.employeeId || 'Unknown'}.pdf"`);
            res.send(pdfBuffer);

        } catch (pdfError) {
            console.error('[downloadPayslipPDF] PDF Generation Error:', pdfError);
            res.status(500).json({
                success: false,
                error: "PDF generation failed",
                message: pdfError.message
            });
        }

    } catch (error) {
        console.error('[downloadPayslipPDF] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
