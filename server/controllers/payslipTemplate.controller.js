const PayslipTemplate = require('../models/PayslipTemplate');
const Payslip = require('../models/Payslip');
const puppeteer = require('puppeteer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const libreOfficeService = require('../services/LibreOfficeService');

// Configure multer for Payslip Word templates
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '../uploads/payslip_templates');
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.docx';
        const timestamp = Date.now();
        cb(null, `payslip-template-${timestamp}${ext}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (ext === '.docx') {
            cb(null, true);
        } else {
            cb(new Error('Only .docx files are allowed'));
        }
    }
});

/**
 * Extract placeholders from Word file
 */
async function extractDocxPlaceholders(filePath) {
    try {
        const buffer = await fsPromises.readFile(filePath);
        const zip = new PizZip(buffer);
        const docXml = zip.file("word/document.xml");
        if (!docXml) return [];

        const text = docXml.asText();
        const placeholderRegex = /\{\{([^}]+)\}\}/g;
        const placeholders = new Set();
        let match;
        while ((match = placeholderRegex.exec(text)) !== null) {
            placeholders.add(match[1].trim());
        }

        return Array.from(placeholders);
    } catch (error) {
        console.warn('⚠️ Error extracting docx placeholders:', error.message);
        return [];
    }
}

/**
 * Convert Number to Words (Indian Format)
 */
function convertNumberToWords(num) {
    if (!num || isNaN(num)) return 'Zero Rupees Only';

    // Convert to positive integer (we only care about the absolute value for words)
    const n = Math.abs(Math.round(num));
    if (n === 0) return 'Zero Rupees Only';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const scales = ['', 'Thousand', 'Lakh', 'Crore'];

    const convertBelow1000 = (val) => {
        if (val === 0) return '';
        if (val < 10) return ones[val];
        if (val < 20) return teens[val - 10];
        if (val < 100) {
            return tens[Math.floor(val / 10)] + (val % 10 ? ' ' + ones[val % 10] : '');
        }
        return ones[Math.floor(val / 100)] + ' Hundred' + (val % 100 ? ' ' + convertBelow1000(val % 100) : '');
    };

    let words = '';
    let scaleIndex = 0;
    let remaining = n;

    while (remaining > 0) {
        if (scaleIndex === 0) {
            const part = remaining % 1000;
            if (part !== 0) {
                words = convertBelow1000(part) + ' ' + words;
            }
            remaining = Math.floor(remaining / 1000);
        } else {
            const part = remaining % 100;
            if (part !== 0) {
                words = convertBelow1000(part) + ' ' + scales[scaleIndex] + ' ' + words;
            }
            remaining = Math.floor(remaining / 100);
        }
        scaleIndex++;
    }

    return words.trim() + ' Rupees Only';
}

/**
 * Extract placeholders from HTML content
 */
function extractPlaceholders(html) {
    const regex = /\{\{([A-Z_]+)\}\}/g;
    const placeholders = new Set();
    let match;

    while ((match = regex.exec(html)) !== null) {
        placeholders.add(match[1]);
    }

    return Array.from(placeholders);
}

/**
 * GET /api/payslip-templates
 */
exports.getTemplates = async (req, res) => {
    try {
        const PayslipTemplateModel = req.tenantDB.model('PayslipTemplate');

        // Since we're already using tenant-specific DB, no need to filter by tenant
        const templates = await PayslipTemplateModel.find()
            .sort({ isDefault: -1, createdAt: -1 });

        res.json({
            success: true,
            data: templates
        });
    } catch (error) {
        console.error('[PAYSLIP_TEMPLATE] Error fetching templates:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch templates' });
    }
};

/**
 * GET /api/payslip-templates/:id
 */
exports.getTemplateById = async (req, res) => {
    try {
        const PayslipTemplateModel = req.tenantDB.model('PayslipTemplate');

        const template = await PayslipTemplateModel.findOne({
            _id: req.params.id
        });

        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        res.json({ success: true, data: template });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch template' });
    }
};

/**
 * POST /api/payslip-templates
 */
exports.createTemplate = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, htmlContent, isDefault, templateType, builderConfig } = req.body;
        const PayslipTemplateModel = req.tenantDB.model('PayslipTemplate');

        // Extract placeholders from htmlContent (for HTML and CUSTOM types)
        const placeholders = (htmlContent) ? extractPlaceholders(htmlContent) : [];

        if (isDefault) {
            await PayslipTemplateModel.updateMany(
                { isDefault: true },
                { $set: { isDefault: false } }
            );
        }

        const templateData = {
            tenant: tenantId,
            name,
            templateType: templateType || 'HTML',
            htmlContent: templateType === 'HTML' ? htmlContent : '',
            builderConfig: templateType === 'BUILDER' ? builderConfig : null,
            placeholders,
            isDefault: isDefault || false,
            createdBy: req.user.id,
            updatedBy: req.user.id
        };

        const template = new PayslipTemplateModel(templateData);
        await template.save();
        res.status(201).json({ success: true, data: template });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Template name already exists. Please choose a different name.' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/payslip-templates/upload-word
 */
exports.uploadWordTemplate = [
    upload.single('wordFile'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }

            const tenantId = req.user.tenantId;
            const PayslipTemplateModel = req.tenantDB.model('PayslipTemplate');
            const { name, isDefault } = req.body;

            const placeholders = await extractDocxPlaceholders(req.file.path);

            if (isDefault === 'true') {
                await PayslipTemplateModel.updateMany(
                    { isDefault: true },
                    { $set: { isDefault: false } }
                );
            }

            const template = new PayslipTemplateModel({
                tenant: tenantId,
                name: name || req.file.originalname,
                templateType: 'WORD',
                filePath: req.file.path,
                placeholders,
                isDefault: isDefault === 'true',
                createdBy: req.user.id,
                updatedBy: req.user.id
            });

            await template.save();
            res.status(201).json({ success: true, data: template });
        } catch (error) {
            console.error('[PAYSLIP_TEMPLATE] Upload error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
];

/**
 * PUT /api/payslip-templates/:id
 */
exports.updateTemplate = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, htmlContent, isDefault, isActive, builderConfig } = req.body;
        const PayslipTemplateModel = req.tenantDB.model('PayslipTemplate');

        const template = await PayslipTemplateModel.findOne({ _id: req.params.id });
        if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

        if (isDefault && !template.isDefault) {
            await PayslipTemplateModel.updateMany({ isDefault: true }, { $set: { isDefault: false } });
        }

        if (name) template.name = name;
        if (htmlContent) {
            template.htmlContent = htmlContent;
            template.placeholders = extractPlaceholders(htmlContent);
        }
        if (builderConfig) {
            template.builderConfig = builderConfig;
            // Ensure Mixed type is marked as modified
            template.markModified('builderConfig');
        }
        if (typeof isDefault !== 'undefined') template.isDefault = isDefault;
        if (typeof isActive !== 'undefined') template.isActive = isActive;
        template.updatedBy = req.user.id;

        await template.save();
        res.json({ success: true, data: template });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Template name already exists. Please choose a different name.' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * DELETE /api/payslip-templates/:id
 */
exports.deleteTemplate = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const PayslipTemplateModel = req.tenantDB.model('PayslipTemplate');

        const template = await PayslipTemplateModel.findOne({ _id: req.params.id });
        if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

        // Delete file if it's a WORD template
        if (template.templateType === 'WORD' && template.filePath) {
            if (fs.existsSync(template.filePath)) {
                fs.unlinkSync(template.filePath);
            }
        }

        await PayslipTemplateModel.deleteOne({ _id: req.params.id });
        res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/payslip-templates/render/:payslipId
 */
exports.renderPayslipPDF = async (req, res) => {
    try {
        // console.log(`[PAYSLIP_RENDER] Starting render for payslip: ${req.params.payslipId}`);
        const tenantId = req.user.tenantId;
        const { payslipId } = req.params;
        const { templateId } = req.body;

        const PayslipModel = req.tenantDB.model('Payslip');
        const PayslipTemplateModel = req.tenantDB.model('PayslipTemplate');

        if (!req.tenantDB.models.Employee) {
            req.tenantDB.model('Employee', require('../models/Employee'));
        }
        const EmployeeModel = req.tenantDB.model('Employee');

        const payslip = await PayslipModel.findOne({ _id: payslipId, tenantId });
        if (!payslip) return res.status(404).json({ success: false, message: 'Payslip not found' });
        // console.log(`[PAYSLIP_RENDER] Payslip found, searching for employee with ID: ${payslip.employeeId}`);

        let employee = await EmployeeModel.findById(payslip.employeeId).populate('departmentId');
        if (!employee) {
            console.warn(`[PAYSLIP_RENDER] Employee NOT FOUND for ID: ${payslip.employeeId}, using snapshot data only`);
            employee = {}; // Fallback to empty so template generation doesn't crash
        }

        let template;
        if (templateId && templateId !== 'undefined') {
            template = await PayslipTemplateModel.findOne({ _id: templateId });
        } else {
            template = await PayslipTemplateModel.findOne({ isDefault: true, isActive: true });
        }

        if (!template) return res.status(404).json({ success: false, message: 'No active template found. Please create or set a default template.' });

        // console.log(`[PAYSLIP_RENDER] Using template: ${template.name} (${template.templateType})`);

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthIndex = parseInt(payslip.month) - 1;
        const monthName = (monthIndex >= 0 && monthIndex < 12) ? monthNames[monthIndex] : 'N/A';

        // Fetch Tenant for Company Details
        const mongoose = require('mongoose');
        const TenantModel = mongoose.model('Tenant');
        const tenant = await TenantModel.findById(tenantId);

        // --- 🎯 NEW: LOGO PROCESSING ---
        let logoBase64 = "";
        try {
            let logoPath = tenant?.meta?.logo;

            // FALLBACK 1: Check if tenant has any logo in their upload folder if DB is missing it
            if (!logoPath && tenantId) {
                const tenantUploadDir = path.join(__dirname, '..', 'uploads', tenantId.toString());
                if (fs.existsSync(tenantUploadDir)) {
                    const files = await fsPromises.readdir(tenantUploadDir);
                    const logoFile = files.find(f => f.toLowerCase().includes('logo') || f.toLowerCase().includes('comp'));
                    if (logoFile) {
                        logoPath = `/uploads/${tenantId}/${logoFile}`;
                        // console.log(`[PAYSLIP_RENDER] Found fallback logo in folder: ${logoPath}`);
                    }
                }
            }

            if (logoPath) {
                // Determine absolute path - SAFE FOR WINDOWS
                const relativePath = logoPath.startsWith('/') ? logoPath.slice(1) : logoPath;
                const fullPath = path.resolve(__dirname, '..', relativePath);

                // console.log(`[PAYSLIP_RENDER] Resolving logo: ${logoPath} -> ${fullPath}`);

                if (fs.existsSync(fullPath)) {
                    const logoBuffer = await fsPromises.readFile(fullPath);
                    const ext = path.extname(fullPath).toLowerCase().replace('.', '');
                    const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext || 'png'}`;
                    logoBase64 = `data:${mimeType};base64,${logoBuffer.toString('base64')}`;
                    // console.log(`[PAYSLIP_RENDER] Logo converted to base64. Mime: ${mimeType}`);
                } else {
                    console.warn(`[PAYSLIP_RENDER] Logo file NOT found at: ${fullPath}`);
                }
            }
        } catch (logoErr) {
            console.error(`[PAYSLIP_RENDER] Logo processing failed:`, logoErr.message);
        }

        // --- 🎯 NEW: YTD CALCULATION ---
        // Financial Year in India: April to March
        const currentMonthNum = parseInt(payslip.month);
        const currentYearNum = parseInt(payslip.year);
        let fyStartYear = currentMonthNum >= 4 ? currentYearNum : currentYearNum - 1;

        // console.log(`[PAYSLIP_RENDER] Calculating YTD from April ${fyStartYear} to ${monthName} ${currentYearNum}`);

        // Fetch all payslips for the current FY up to the current month
        const fyPayslips = await PayslipModel.find({
            tenantId,
            employeeId: payslip.employeeId,
            $or: [
                { year: fyStartYear, month: { $gte: 4 } }, // April to Dec of start year
                { year: currentYearNum, month: { $lte: currentMonthNum } } // Jan to current month of end year
            ]
        }).lean();

        const calculateYTD = (componentName, type = 'earning') => {
            let total = 0;
            fyPayslips.forEach(ps => {
                let list = [];
                if (type === 'earning') list = ps.earningsSnapshot || [];
                else if (type === 'deduction') list = [...(ps.preTaxDeductionsSnapshot || []), ...(ps.postTaxDeductionsSnapshot || []), { name: 'Income Tax', amount: ps.incomeTax || 0 }];

                const item = list.find(l => l.name.toLowerCase() === componentName.toLowerCase());
                if (item) total += (item.amount || 0);
            });
            return total.toFixed(2);
        };

        // Detailed placeholder data
        const earnings = payslip.earningsSnapshot || [];
        const basicEarning = earnings.find(e => /basic/i.test(e.name));
        const specialEarning = earnings.find(e => /special|allowance/i.test(e.name));
        const hraEarning = earnings.find(e => /hra|house/i.test(e.name));

        const deductions = payslip.preTaxDeductionsSnapshot || [];
        const allDeductions = [...deductions, ...(payslip.postTaxDeductionsSnapshot || [])];
        if (payslip.incomeTax > 0) allDeductions.push({ name: 'Income Tax', amount: payslip.incomeTax });

        const epfDeduction = allDeductions.find(d => /epf|pf|provident/i.test(d.name));
        const esiDeduction = allDeductions.find(d => /esi|insurance/i.test(d.name));
        const ptDeduction = allDeductions.find(d => /professional tax|pt/i.test(d.name));

        const placeholderData = {
            // Company Info
            COMPANY_NAME: tenant?.name || 'Your Company',
            COMPANY_ADDRESS: tenant?.meta?.address || 'Company Address',
            COMPANY_EMAIL: tenant?.meta?.primaryEmail || tenant?.meta?.email || (tenant?.emailDomain ? `hr@${tenant.emailDomain}` : 'hr@company.com'),
            COMPANY_PHONE: tenant?.meta?.phone || 'N/A',
            COMPANY_LOGO: logoBase64 ? `<img src="${logoBase64}" style="max-height: 80px; max-width: 200px; display: block; margin-bottom: 10px;" />` : '',
            LOGO_URL: logoBase64, // Just in case they want the raw base64

            // Employee Basic (Prioritize Snapshot, fallback to Master)
            EMPLOYEE_NAME: payslip.employeeInfo?.name || `${employee.firstName} ${employee.lastName || ''}`.trim(),
            EMPLOYEE_CODE: payslip.employeeInfo?.employeeId || employee.employeeId || '',
            EMPLOYEE_ID: payslip.employeeInfo?.employeeId || employee.employeeId || '',
            DESIGNATION: payslip.employeeInfo?.designation || employee.designation || 'N/A',
            JOB_TITLE: payslip.employeeInfo?.designation || employee.designation || 'N/A',
            DEPARTMENT: payslip.employeeInfo?.department || employee.departmentId?.name || employee.department || 'General',
            GENDER: payslip.employeeInfo?.gender || employee.gender || 'N/A',
            DOB: (payslip.employeeInfo?.dob || employee.dob) ? new Date(payslip.employeeInfo?.dob || employee.dob).toLocaleDateString('en-IN') : 'N/A',
            DOJ: (payslip.employeeInfo?.joiningDate || employee.joiningDate) ? new Date(payslip.employeeInfo?.joiningDate || employee.joiningDate).toLocaleDateString('en-IN') : 'N/A',
            DATE_OF_JOINING: (payslip.employeeInfo?.joiningDate || employee.joiningDate) ? new Date(payslip.employeeInfo?.joiningDate || employee.joiningDate).toLocaleDateString('en-IN') : 'N/A',

            // Identification & Bank
            PAN_NO: (payslip.employeeInfo?.panNumber && !payslip.employeeInfo.panNumber.startsWith('/uploads')) ? payslip.employeeInfo.panNumber : (employee.documents?.panCard && !employee.documents.panCard.startsWith('/uploads') ? employee.documents.panCard : 'N/A'),
            PAN_CARD: (payslip.employeeInfo?.panNumber && !payslip.employeeInfo.panNumber.startsWith('/uploads')) ? payslip.employeeInfo.panNumber : (employee.documents?.panCard && !employee.documents.panCard.startsWith('/uploads') ? employee.documents.panCard : 'N/A'),
            PAN_NUMBER: (payslip.employeeInfo?.panNumber && !payslip.employeeInfo.panNumber.startsWith('/uploads')) ? payslip.employeeInfo.panNumber : (employee.documents?.panCard && !employee.documents.panCard.startsWith('/uploads') ? employee.documents.panCard : 'N/A'),

            PF_NO: payslip.employeeInfo?.pfNumber || employee.meta?.pfNo || employee.pfNo || 'N/A',
            UAN_NO: payslip.employeeInfo?.uanNumber || employee.meta?.uanNo || employee.uanNo || 'N/A',

            BANK_NAME: payslip.employeeInfo?.bankName || employee.bankDetails?.bankName || 'N/A',
            BANK: payslip.employeeInfo?.bankName || employee.bankDetails?.bankName || 'N/A',

            BANK_ACCOUNT_NO: payslip.employeeInfo?.bankAccountNumber || employee.bankDetails?.accountNumber || 'N/A',
            ACCOUNT_NO: payslip.employeeInfo?.bankAccountNumber || employee.bankDetails?.accountNumber || 'N/A',
            BANK_ACCOUNT: payslip.employeeInfo?.bankAccountNumber || employee.bankDetails?.accountNumber || 'N/A',
            ACCOUNT_NUMBER: payslip.employeeInfo?.bankAccountNumber || employee.bankDetails?.accountNumber || 'N/A',

            IFSC_CODE: payslip.employeeInfo?.bankIFSC || employee.bankDetails?.ifsc || 'N/A',
            IFSC: payslip.employeeInfo?.bankIFSC || employee.bankDetails?.ifsc || 'N/A',

            // Period & Date
            MONTH: monthName,
            MONTH_YEAR: `${monthName} ${payslip.year}`,
            PERIOD: `${monthName} ${payslip.year}`,
            YEAR: (payslip.year || '').toString(),
            GENERATED_ON: new Date().toLocaleDateString('en-IN'),

            // Financial Summary
            GROSS_EARNINGS: (payslip.grossEarnings || 0).toFixed(2),
            GROSS: (payslip.grossEarnings || 0).toFixed(2),
            GROSS_TOTAL: (payslip.grossEarnings || 0).toFixed(2),
            TOTAL_DEDUCTIONS: ((payslip.preTaxDeductionsTotal || 0) + (payslip.incomeTax || 0) + (payslip.postTaxDeductionsTotal || 0)).toFixed(2),
            DEDUCTION_TOTAL: ((payslip.preTaxDeductionsTotal || 0) + (payslip.incomeTax || 0) + (payslip.postTaxDeductionsTotal || 0)).toFixed(2),
            NET_PAY: (payslip.netPay || 0).toFixed(2),
            NET_PAYABLE: (payslip.netPay || 0).toFixed(2),
            TOTAL_NET_PAYABLE: (payslip.netPay || 0).toFixed(2),

            // Attendance
            PRESENT_DAYS: (payslip.attendanceSummary?.presentDays || 0).toString(),
            PAID_DAYS: (payslip.attendanceSummary?.presentDays || 0).toString(),
            LEAVE_DAYS: (payslip.attendanceSummary?.leaveDays || 0).toString(),
            LOP_DAYS: (payslip.attendanceSummary?.lopDays || 0).toString(),
            TOTAL_WORKING_DAYS: (payslip.attendanceSummary?.totalDays || 0).toString(),

            // Specific Components
            BASIC: (basicEarning?.amount || 0).toFixed(2),
            HRA: (hraEarning?.amount || 0).toFixed(2),
            SPECIAL: (specialEarning?.amount || 0).toFixed(2),
            EPF: (epfDeduction?.amount || 0).toFixed(2),
            PF: (epfDeduction?.amount || 0).toFixed(2),
            ESI: (esiDeduction?.amount || 0).toFixed(2),
            PT: (ptDeduction?.amount || 0).toFixed(2),
            INCOME_TAX: (payslip.incomeTax || 0).toFixed(2),
            TDS: (payslip.incomeTax || 0).toFixed(2),
            COST_CENTER: payslip.employeeInfo?.department || employee.departmentId?.name || 'General',
            NET_PAY_WORDS: convertNumberToWords(payslip.netPay || 0)
        };

        // --- 🎯 NEW: DYNAMIC VARIABLE MAPPING FROM SNAPSHOTS ---
        // This ensures that any component added in HRMS (like CONVEYANCE) is automatically available as {{CONVEYANCE}} and {{YTD_CONVEYANCE}}
        earnings.forEach(e => {
            const varName = e.name.toUpperCase().replace(/\s+/g, '_');
            if (!placeholderData[varName]) {
                placeholderData[varName] = (e.amount || 0).toFixed(2);
            }
            // Add YTD variant
            if (!placeholderData[`YTD_${varName}`]) {
                placeholderData[`YTD_${varName}`] = calculateYTD(e.name, 'earning');
            }
        });

        allDeductions.forEach(d => {
            const varName = d.name.toUpperCase().replace(/\s+/g, '_');
            if (!placeholderData[varName]) {
                placeholderData[varName] = (d.amount || 0).toFixed(2);
            }
            // Add YTD variant
            if (!placeholderData[`YTD_${varName}`]) {
                placeholderData[`YTD_${varName}`] = calculateYTD(d.name, 'deduction');
            }
        });

        // Add dynamic Earnings (EARNING_NAME_1, EARNING_AMOUNT_1, EARNING_YTD_1, etc.)
        earnings.forEach((e, idx) => {
            const i = idx + 1;
            placeholderData[`EARNING_NAME_${i}`] = e.name;
            placeholderData[`EARNING_AMOUNT_${i}`] = (e.amount || 0).toFixed(2);
            placeholderData[`EARNING_YTD_${i}`] = calculateYTD(e.name, 'earning');
        });
        // Fill empty slots up to 10
        for (let i = earnings.length + 1; i <= 10; i++) {
            placeholderData[`EARNING_NAME_${i}`] = '';
            placeholderData[`EARNING_AMOUNT_${i}`] = '';
            placeholderData[`EARNING_YTD_${i}`] = '';
        }

        // Add dynamic Deductions
        allDeductions.sort((a, b) => b.amount - a.amount).forEach((d, idx) => {
            const i = idx + 1;
            placeholderData[`DEDUCTION_NAME_${i}`] = d.name;
            placeholderData[`DEDUCTION_AMOUNT_${i}`] = (d.amount || 0).toFixed(2);
            placeholderData[`DEDUCTION_YTD_${i}`] = calculateYTD(d.name, 'deduction');
        });
        for (let i = allDeductions.length + 1; i <= 10; i++) {
            placeholderData[`DEDUCTION_NAME_${i}`] = '';
            placeholderData[`DEDUCTION_AMOUNT_${i}`] = '';
            placeholderData[`DEDUCTION_YTD_${i}`] = '';
        }

        // Add raw snapshot data for dynamic builder components
        placeholderData.RAW_EARNINGS = earnings;
        placeholderData.RAW_DEDUCTIONS = allDeductions;

        // console.log(`[PAYSLIP_RENDER] Final Placeholder Map Keys:`, Object.keys(placeholderData).length);

        if (template.templateType === 'WORD') {
            if (!template.filePath || !fs.existsSync(template.filePath)) {
                throw new Error('Template Word file not found on server. Please re-upload the template.');
            }

            // console.log(`[PAYSLIP_RENDER] Reading Word file: ${template.filePath}`);
            const PizZip = require('pizzip');
            const Docxtemplater = require('docxtemplater');
            const content = await fsPromises.readFile(template.filePath, 'binary');
            const zip = new PizZip(content);
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true
            });

            doc.render(placeholderData);
            const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const tempDocxPath = path.join(tempDir, `payslip-${payslipId}-${Date.now()}.docx`);
            await fsPromises.writeFile(tempDocxPath, buf);

            try {
                // console.log(`[PAYSLIP_RENDER] Converting Word to PDF via Mammoth + Puppeteer...`);
                const pdfPath = await libreOfficeService.convertToPdf(tempDocxPath, tempDir);
                const pdfBuffer = await fsPromises.readFile(pdfPath);

                // Cleanup
                await fsPromises.unlink(tempDocxPath).catch(e => console.warn('Failed to delete temp docx:', e.message));
                await fsPromises.unlink(pdfPath).catch(e => console.warn('Failed to delete temp pdf:', e.message));

                // Verify PDF signature
                const signature = pdfBuffer.slice(0, 5).toString();
                // console.log(`[PAYSLIP_RENDER] Word-to-PDF signature: ${signature}, size: ${pdfBuffer.length} bytes`);

                const safeFileName = `Payslip_${employee.employeeId}_${monthName}.pdf`.replace(/"/g, '');
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Length', pdfBuffer.length);
                res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);

                return res.end(pdfBuffer, 'binary');
            } catch (pdfErr) {
                console.error(`[PAYSLIP_RENDER] PDF Conversion failed:`, pdfErr);
                throw new Error(`PDF Conversion failed: ${pdfErr.message}. Ensure LibreOffice is installed.`);
            }

        } else {
            // HTML, CUSTOM, or BUILDER Rendering
            // console.log(`[PAYSLIP_RENDER] Rendering ${template.templateType} template...`);
            let html = '';

            if (template.templateType === 'BUILDER' && template.builderConfig) {
                html = convertBuilderConfigToHtml(template.builderConfig, placeholderData);
            } else {
                html = template.htmlContent || '';
            }

            if (!html) {
                throw new Error('Template has no content. Please edit the template in the builder.');
            }

            // Replace basic placeholders (for HTML templates or fallback)
            for (const [key, value] of Object.entries(placeholderData)) {
                const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
                html = html.replace(regex, value !== undefined && value !== null ? value : '');
            }

            // --- 🎯 EXTREME SINGLE PAGE CSS ---
            const pageStyle = `
                <style>
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        height: 296mm !important; /* Slightly less than A4 height to be safe */
                        max-height: 296mm !important;
                        width: 210mm !important;
                        overflow: hidden !important; /* NO SCROLLING, NO OVERFLOW */
                    }
                    * {
                        box-sizing: border-box !important;
                    }
                    @media print {
                        body {
                            zoom: 0.82 !important; /* Aggressive shrink */
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            width: 100% !important;
                        }
                        .no-print { display: none !important; }
                        
                        /* Fix common container issues */
                        .container, .wrapper, .wrapper-inner, .main-container {
                            height: auto !important;
                            max-height: 4000px !important; /* Unlimit inner, but clip outer */
                            margin-bottom: 0 !important;
                            padding-bottom: 0 !important;
                        }

                        table, div, section {
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                        }
                        
                        @page {
                            size: A4;
                            margin: 5mm !important;
                        }
                    }
                    /* General reset for PDF */
                    body {
                        font-family: 'Inter', Arial, sans-serif;
                        line-height: 1.15;
                        color: #333;
                    }
                </style>
            `;
            if (html.includes('</head>')) {
                html = html.replace('</head>', `${pageStyle}</head>`);
            } else {
                html = pageStyle + html;
            }

            // console.log(`[PAYSLIP_RENDER] HTML prepared, length: ${html.length}. Starting Puppeteer...`);

            const browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--font-render-hinting=none'
                ]
            });
            try {
                const page = await browser.newPage();
                // Set reasonable timeout and wait for network to be idle
                await page.setContent(html, {
                    waitUntil: 'networkidle0',
                    timeout: 45000
                });

                const pdfOptions = {
                    format: 'A4',
                    printBackground: true,
                    preferCSSPageSize: true,
                    displayHeaderFooter: false,
                    margin: { top: '5mm', right: '5mm', bottom: '5mm', left: '5mm' }
                };

                const pdfBuffer = await page.pdf(pdfOptions);

                await browser.close();

                if (!pdfBuffer || pdfBuffer.length === 0) {
                    throw new Error('Generated PDF buffer is empty.');
                }

                // Verify PDF signature
                const signature = pdfBuffer.slice(0, 5).toString();
                // console.log(`[PAYSLIP_RENDER] PDF signature: ${signature}, size: ${pdfBuffer.length} bytes`);

                if (signature !== '%PDF-') {
                    console.error('[PAYSLIP_RENDER] WARNING: Generated buffer does not start with %PDF-');
                }

                const safeFileName = `Payslip_${employee.employeeId}_${monthName}.pdf`.replace(/"/g, '');
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Length', pdfBuffer.length);
                res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);

                return res.end(pdfBuffer, 'binary');
            } catch (pageErr) {
                console.error(`[PAYSLIP_RENDER] Puppeteer Page Error:`, pageErr);
                if (browser) await browser.close();
                throw pageErr;
            }
        }
    } catch (error) {
        console.error('[PAYSLIP_TEMPLATE] Render error:', error);
        // Important: return JSON even if we expected binary, the frontend will now handle it properly
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/payslip-templates/preview
 */
exports.previewTemplate = async (req, res) => {
    try {
        const { htmlContent } = req.body;
        const tenantId = req.user.tenantId;
        const CompanyProfileModel = req.tenantDB.model('CompanyProfile');

        // Fetch real company branding if available
        const profile = await CompanyProfileModel.findOne({ tenantId });

        const backendUrl = process.env.BACKEND_URL || 'http://localhost:5003';
        let logoUrl = profile?.companyLogo || '';

        // Resolve relative upload paths
        if (logoUrl.startsWith('/uploads')) {
            logoUrl = `${backendUrl}${logoUrl}`;
        } else if (!logoUrl) {
            logoUrl = 'https://via.placeholder.com/150x50?text=LOGO';
        }

        const sampleData = {
            // Company info
            COMPANY_NAME: profile?.companyName || 'Gitakshmi HRMS',
            COMPANY_ADDRESS: profile?.address ? `${profile.address.line1}, ${profile.address.city}` : 'Ahmedabad, Gujarat',
            COMPANY_LOGO: logoUrl,
            COMPANY_EMAIL: profile?.contactEmail || 'hr@gitakshmi.com',
            COMPANY_PHONE: profile?.contactPhone || '+91 79 1234 5678',

            // Employee info
            EMPLOYEE_NAME: 'John Doe',
            EMPLOYEE_ID: 'EMP001',
            DEPARTMENT: 'Engineering',
            DESIGNATION: 'Full Stack Developer',

            // Date info
            MONTH: 'January 2026',
            YEAR: '2026',
            GENERATED_ON: new Date().toLocaleDateString('en-IN'),

            // Earnings
            BASIC: '30000.00',
            HRA: '10000.00',
            SPECIAL: '5000.00',
            GROSS: '45000.00',
            GROSS_EARNINGS: '45000.00',

            // Deductions
            EPF: '1800.00',
            ESI: '0.00',
            PT: '200.00',
            INCOME_TAX: '0.00',
            TOTAL_DEDUCTIONS: '2000.00',

            // Totals
            NET_PAY: '43000.00',
            PRESENT: '22',
            LEAVES: '0',
            LOP: '0',
            TOTAL_DAYS: '31'
        };

        let html = htmlContent || '';
        for (const [key, value] of Object.entries(sampleData)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            html = html.replace(regex, value);
        }

        res.json({
            success: true,
            data: {
                html,
                placeholders: extractPlaceholders(htmlContent || '')
            }
        });
    } catch (error) {
        console.error('[PREVIEW_TEMPLATE] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Helper function to convert Builder Config JSON to HTML string
 */
function convertBuilderConfigToHtml(config, data) {
    if (!config || !config.sections) return '';

    const styles = config.styles || {};
    const bodyStyles = `
        font-family: '${styles.fontFamily || 'Inter'}', sans-serif;
        font-size: ${styles.fontSize || '12px'};
        color: ${styles.color || '#000000'};
        padding: ${styles.padding || '30px'};
        background-color: #ffffff;
    `;

    let html = `<div style="${bodyStyles}">`;

    config.sections.forEach(section => {
        const content = section.content || {};
        const style = section.styles || {};
        const margin = `margin-top: ${style.marginTop || '0px'}; margin-bottom: ${style.marginBottom || '0px'};`;
        const padding = `padding-top: ${style.paddingTop || '0px'}; padding-bottom: ${style.paddingBottom || '0px'};`;

        html += `<div style="${margin} ${padding}">`;

        switch (section.type) {
            case 'company-header':
                const align = content.logoAlign || 'left';
                const flexDir = align === 'right' ? 'row-reverse' : align === 'center' ? 'column' : 'row';
                const textAlign = align === 'center' ? 'center' : 'left';

                html += `<div style="display: flex; flex-direction: ${flexDir}; align-items: start; gap: 20px; text-align: ${textAlign};">`;

                if (content.showLogo && content.logoImage) {
                    html += `<img src="${content.logoImage}" style="height: ${content.logoSize || '80px'}; width: auto; object-fit: contain;" alt="Logo" />`;
                }

                html += `<div style="flex: 1;">
                            <h1 style="font-size: ${content.companyNameSize || '24px'}; font-weight: 800; margin: 0; line-height: 1.2;">
                                ${content.companyName || data.COMPANY_NAME}
                            </h1>`;

                if (content.showAddress) {
                    html += `<p style="margin: 5px 0 0; color: #6b7280; font-size: 12px; white-space: pre-line;">
                                ${content.companyAddress || data.COMPANY_ADDRESS}
                             </p>`;
                }
                html += `</div></div>`;
                break;

            case 'payslip-title':
                // Replace variables in title
                let titleText = content.text || 'PAYSLIP';
                Object.keys(data).forEach(key => {
                    const regex = new RegExp(`{{${key}}}`, 'g');
                    titleText = String(titleText || '').replace(regex, data[key]);
                });

                const titleStyles = `
                    text-align: ${content.align || 'center'};
                    ${content.showBorders !== false ? 'border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb;' : ''}
                    padding: 8px 0;
                    margin: 15px 0 20px 0;
                `;

                html += `<div style="${titleStyles}">
                            <h2 style="margin: 0; font-size: ${content.size || '14px'}; font-weight: ${content.weight === 'bold' ? '800' : 'normal'}; color: #111827; letter-spacing: -0.01em;">
                                ${titleText}
                            </h2>
                         </div>`;
                break;

            case 'employee-details-grid':
                const cols = content.columns || 2;
                html += `<div style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 5px 30px; font-size: 11px; margin-bottom: 20px;">`;
                (content.fields || []).forEach(field => {
                    let label = '';
                    let value = '';

                    if (typeof field === 'object') {
                        label = field.label;
                        value = field.value;
                        // Replace variables in value
                        Object.keys(data).forEach(key => {
                            const regex = new RegExp(`{{${key}}}`, 'g');
                            value = String(value || '').replace(regex, data[key]);
                        });
                    } else {
                        label = field.replace(/_/g, ' ');
                        value = data[field] || '';
                    }

                    html += `<div style="display: flex; align-items: start;">
                                <span style="min-width: 120px; color: #6b7280; font-weight: 500;">${label}</span>
                                <span style="margin: 0 8px; font-weight: 500;">:</span>
                                <span style="flex: 1; color: #111827; font-weight: 600;">${value}</span>
                             </div>`;
                });
                html += `</div>`;
                break;

            case 'split-payroll-table':
                const earningsData = content.customEarnings || [];
                const deductionsData = content.customDeductions || [];

                const replaceAllVars = (str) => {
                    if (!str || typeof str !== 'string') return str;
                    let result = str;
                    Object.keys(data).forEach(key => {
                        const regex = new RegExp(`{{${key}}}`, 'g');
                        result = String(result || '').replace(regex, data[key]);
                    });
                    return result;
                };

                const formatVal = (val, isYtd = false) => {
                    const replaced = replaceAllVars(val);
                    if (!replaced || replaced === 'N/A') return isYtd ? '-' : replaced;
                    if (replaced.includes('{{')) return isYtd ? '-' : replaced;

                    const num = parseFloat(replaced.replace(/[₹\s,]/g, ''));
                    if (isNaN(num)) return replaced;
                    if (num === 0) return isYtd ? '-' : `₹ 0.00`;

                    return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                };

                const isMissingVar = (str) => {
                    if (!str) return false;
                    const replaced = replaceAllVars(str);
                    return replaced && replaced.includes('{{');
                };

                // Prepare dynamic data if requested
                const finalEarnings = content.dynamic ? (data.RAW_EARNINGS || []).map(e => ({
                    name: e.name,
                    amount: `{{${e.name.toUpperCase().replace(/\s+/g, '_')}}}`,
                    ytd: `₹ ${((e.ytd || 0)).toFixed(2)}` // Assume YTD might be pre-calculated or needs calculateYTD call
                })) : earningsData;

                const finalDeductions = content.dynamic ? (data.RAW_DEDUCTIONS || []).map(d => ({
                    name: d.name,
                    amount: `{{${d.name.toUpperCase().replace(/\s+/g, '_')}}}`,
                    ytd: `₹ ${((d.ytd || 0)).toFixed(2)}`
                })) : deductionsData;

                html += `<div style="display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #e5e7eb; border-radius: 2px; overflow: hidden; margin-bottom: 20px;">
                    <!-- Earnings -->
                    <div style="border-right: 1px solid #e5e7eb; display: flex; flex-direction: column;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                            <thead style="background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                                <tr>
                                    <th style="padding: 6px 8px; text-align: left; color: #111827; font-weight: 800;">EARNINGS</th>
                                    <th style="padding: 6px 8px; text-align: right; color: #111827; font-weight: 800;">AMOUNT</th>
                                    <th style="padding: 6px 8px; text-align: right; color: #111827; font-weight: 800;">YTD</th>
                                </tr>
                            </thead>
                            <tbody>`;

                finalEarnings.forEach(item => {
                    // Skip if the amount variable was not replaced (employee doesn't have this component)
                    if (isMissingVar(item.amount)) return;

                    html += `<tr>
                        <td style="padding: 4px 8px; font-weight: 500; color: #374151;">${replaceAllVars(item.name)}</td>
                        <td style="padding: 4px 8px; text-align: right; font-weight: 600; color: #111827;">${formatVal(item.amount)}</td>
                        <td style="padding: 4px 8px; text-align: right; color: #6b7280;">${formatVal(item.ytd, true)}</td>
                    </tr>`;
                });

                html += `</tbody>
                        <tfoot style="background-color: #f9fafb; font-weight: 800; border-top: 1px solid #e5e7eb;">
                            <tr>
                                <td style="padding: 8px;">Gross Earnings</td>
                                <td style="padding: 8px; text-align: right;">₹ ${data.GROSS_EARNINGS || '0.00'}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                    </div>
                    <!-- Deductions -->
                    <div style="display: flex; flex-direction: column;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                            <thead style="background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                                <tr>
                                    <th style="padding: 6px 8px; text-align: left; color: #111827; font-weight: 800;">DEDUCTIONS</th>
                                    <th style="padding: 6px 8px; text-align: right; color: #111827; font-weight: 800;">AMOUNT</th>
                                    <th style="padding: 6px 8px; text-align: right; color: #111827; font-weight: 800;">YTD</th>
                                </tr>
                            </thead>
                            <tbody>`;

                finalDeductions.forEach(item => {
                    if (isMissingVar(item.amount)) return;

                    html += `<tr>
                        <td style="padding: 4px 8px; font-weight: 500; color: #374151;">${replaceAllVars(item.name)}</td>
                        <td style="padding: 4px 8px; text-align: right; font-weight: 600; color: #111827;">${formatVal(item.amount)}</td>
                        <td style="padding: 4px 8px; text-align: right; color: #6b7280;">${formatVal(item.ytd, true)}</td>
                    </tr>`;
                });

                html += `</tbody>
                        <tfoot style="background-color: #f9fafb; font-weight: 800; border-top: 1px solid #e5e7eb;">
                            <tr>
                                <td style="padding: 8px;">Total Deductions</td>
                                <td style="padding: 8px; text-align: right;">₹ ${data.TOTAL_DEDUCTIONS || '0.00'}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                    </div>
                </div>`;
                break;

            case 'earnings-table':
            case 'deductions-table':
            case 'reimbursements-table':
                const isEarnings = section.type === 'earnings-table';
                const isDeductions = section.type === 'deductions-table';
                const titleColor = isEarnings ? '#2563eb' : isDeductions ? '#ef4444' : '#16a34a'; // blue, red, green
                const sectionTitle = content.title || (isEarnings ? 'EARNINGS' : isDeductions ? 'DEDUCTIONS' : 'REIMBURSEMENTS');

                html += `<div style="margin-bottom: 20px;">
                            <h3 style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: ${titleColor}; margin-bottom: 10px;">
                                ${sectionTitle}
                            </h3>
                            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                                <thead style="background-color: #f9fafb; color: #6b7280; font-weight: 800; text-transform: uppercase;">
                                    <tr>
                                        <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Description</th>
                                        <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">Amount</th>
                                        ${content.showYTD ? `<th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">YTD</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>`;

                // Rows logic
                if (content.customRows && content.customRows.length > 0) {
                    // Custom static rows
                    content.customRows.forEach(row => {
                        html += `<tr>
                            <td style="padding: 8px; border: 1px solid #f3f4f6;">${row.name || ''}</td>
                            <td style="padding: 8px; border: 1px solid #f3f4f6; text-align: right;">₹ ${(parseFloat(row.amount) || 0).toFixed(2)}</td>
                            ${content.showYTD ? `<td style="padding: 8px; border: 1px solid #f3f4f6; text-align: right; color: #9ca3af;">₹ ${(parseFloat(row.ytd) || 0).toFixed(2)}</td>` : ''}
                        </tr>`;
                    });
                } else {
                    // Dynamic rows from data
                    // We assume up to 20 potential items to be safe, or just iterate through data keys?
                    // The standard approach is to loop 1..N
                    for (let i = 1; i <= 20; i++) {
                        const prefix = isEarnings ? 'EARNING' : isDeductions ? 'DEDUCTION' : 'REIMB';
                        const nameKey = `${prefix}_NAME_${i}`;
                        const amountKey = `${prefix}_AMOUNT_${i}`;
                        const ytdKey = `${prefix}_YTD_${i}`;

                        // Check if data exists for this item
                        if (data[nameKey] && data[nameKey].trim() !== '') {
                            html += `<tr>
                                        <td style="padding: 8px; border: 1px solid #f3f4f6;">${data[nameKey]}</td>
                                        <td style="padding: 8px; border: 1px solid #f3f4f6; text-align: right;">₹ ${data[amountKey] || '0.00'}</td>
                                        ${content.showYTD ? `<td style="padding: 8px; border: 1px solid #f3f4f6; text-align: right; color: #9ca3af;">₹ ${data[ytdKey] || '0.00'}</td>` : ''}
                                      </tr>`;
                        }
                    }
                }

                // Total Row
                const totalLabel = isEarnings ? 'Total Earnings' : isDeductions ? 'Total Deductions' : 'Total Reimbursements';
                const totalValue = isEarnings ? data.GROSS_EARNINGS : isDeductions ? data.TOTAL_DEDUCTIONS : data.TOTAL_REIMBURSEMENTS;
                const rowBgColor = isEarnings ? '#eff6ff' : isDeductions ? '#fef2f2' : '#f0fdf4';

                html += `<tr style="background-color: ${rowBgColor}; font-weight: 700;">
                            <td style="padding: 8px; border: 1px solid #e5e7eb; text-transform: uppercase;">${totalLabel}</td>
                            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">₹ ${totalValue || '0.00'}</td>
                            ${content.showYTD ? `<td style="padding: 8px; border: 1px solid #e5e7eb;"></td>` : ''}
                         </tr>`;

                html += `</tbody></table></div>`;
                break;

            case 'net-pay-box':
                html += `<div style="background-color: #f9fafb; color: #111827; padding: 15px 20px; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; margin: 20px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="display: flex; align-items: baseline;">
                                    <span style="font-size: 14px; font-weight: 900; text-transform: uppercase;">Total Net Payable</span>
                                    <span style="font-size: 14px; font-weight: 900; margin-left: 20px;">₹ ${data.NET_PAY || '0.00'}</span>
                                    <span style="font-size: 11px; font-weight: 500; font-style: italic; margin-left: 10px; color: #6b7280;">(${data.NET_PAY_WORDS})</span>
                                </div>
                                <div style="font-size: 9px; color: #9ca3af; font-style: italic; margin-top: 5px;">
                                    **Total Net Payable = Gross Earnings - Total Deductions
                                </div>
                            </div>
                         </div>`;
                break;

            case 'text':
                let textContent = content.text || '';
                Object.keys(data).forEach(key => {
                    const regex = new RegExp(`{{${key}}}`, 'g');
                    textContent = String(textContent || '').replace(regex, data[key]);
                });

                html += `<div style="text-align: ${content.align || 'left'}; font-size: ${content.size || '14px'}; font-weight: ${content.weight || 'normal'}; color: ${content.color || 'inherit'}; white-space: pre-wrap;">
                            ${textContent}
                         </div>`;
                break;

            case 'divider':
            case 'separator':
                html += `<div style="height: ${content.thickness || '1px'}; background-color: ${content.color || '#e5e7eb'}; width: 100%; margin: 8px 0;"></div>`;
                break;

            case 'spacer':
                html += `<div style="height: ${content.height || '20px'}; width: 100%;"></div>`;
                break;

            case 'image':
                if (content.url) {
                    html += `<div style="text-align: ${content.align || 'left'}; margin: 10px 0;">
                                <img src="${content.url}" style="width: ${content.width || '100px'}; height: auto;" />
                              </div>`;
                }
                break;
        }

        html += `</div>`;
    });

    html += `</div>`;
    return html;
}
