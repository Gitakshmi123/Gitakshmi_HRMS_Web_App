/**
 * Payslip PDF Generation Service
 * Generates professional payslips in PDF format
 */

const PDFDocument = require('pdfkit');

function generatePayslipPDF(payslipData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                margin: 30,
                size: 'A4'
            });

            // Collect PDF data in memory
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                resolve(Buffer.concat(buffers));
            });
            doc.on('error', reject);

            // Header
            doc.fontSize(20).font('Helvetica-Bold').text('PAYSLIP', { align: 'center' });
            doc.moveDown(0.5);

            // Company Name (could be dynamic from settings)
            doc.fontSize(11).font('Helvetica').text('Company Name', { align: 'center' });
            doc.fontSize(9).text('Payroll Management System', { align: 'center' });

            doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke('#999999');
            doc.moveDown(1);

            // Employee Information Section
            const info = payslipData.employeeInfo || {};
            const salaryTemplate = payslipData.salaryTemplateSnapshot || {};
            const attendance = payslipData.attendanceSummary || {};

            doc.fontSize(10).font('Helvetica-Bold').text('Employee Information', { underline: true });
            doc.fontSize(9).font('Helvetica');
            
            const empInfoLeft = 50;
            const empInfoRight = 300;
            
            doc.text(`Employee ID: ${info.employeeId || 'N/A'}`, empInfoLeft);
            doc.text(`Name: ${info.name || 'N/A'}`, empInfoLeft);
            doc.text(`Department: ${info.department || 'N/A'}`, empInfoLeft);
            doc.text(`Designation: ${info.designation || 'N/A'}`, empInfoLeft);

            // Month/Year info on right
            const monthYear = new Date(payslipData.year, payslipData.month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
            doc.text(`Period: ${monthYear}`, empInfoRight, doc.y - 76, { width: 200 });
            doc.text(`Bank: ${info.bankName || 'N/A'}`, empInfoRight);
            doc.text(`Account: ${maskAccountNumber(info.bankAccountNumber)}`, empInfoRight);

            doc.moveDown(1);
            doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke('#999999');
            doc.moveDown(1);

            // Attendance Summary
            doc.fontSize(10).font('Helvetica-Bold').text('Attendance Summary', { underline: true });
            doc.fontSize(9).font('Helvetica');
            
            const attendanceLeft = 50;
            const attendanceRight = 300;
            
            doc.text(`Total Days: ${attendance.totalDays || 0}`, attendanceLeft);
            doc.text(`Present Days: ${attendance.presentDays || 0}`, attendanceLeft);
            doc.text(`Leave Days: ${attendance.leaveDays || 0}`, attendanceLeft);
            doc.text(`LOP Days: ${attendance.lopDays || 0}`, attendanceLeft);
            doc.text(`Holiday Days: ${attendance.holidayDays || 0}`, attendanceRight, doc.y - 76);

            doc.moveDown(1.5);
            doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke('#999999');
            doc.moveDown(1);

            // Salary Breakdown
            doc.fontSize(10).font('Helvetica-Bold').text('Salary Breakdown', { underline: true });
            doc.moveDown(0.5);

            // Earnings Table
            const tableTop = doc.y;
            const col1 = 50;
            const col2 = 350;
            const col3 = 500;
            const rowHeight = 20;

            // Earnings Header
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('EARNINGS', col1, tableTop);
            doc.text('Amount', col3, tableTop, { align: 'right' });
            doc.moveTo(col1 - 10, tableTop + 15).lineTo(520, tableTop + 15).stroke('#cccccc');

            let y = tableTop + 20;
            const earnings = payslipData.earningsSnapshot || [];
            earnings.forEach(earning => {
                doc.fontSize(8).font('Helvetica');
                doc.text(earning.name, col1, y);
                doc.text(`₹${(earning.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, col3, y, { align: 'right' });
                y += rowHeight;
            });

            doc.moveTo(col1 - 10, y).lineTo(520, y).stroke('#cccccc');
            y += 5;

            // Gross Earnings Total
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('GROSS EARNINGS', col1, y);
            doc.text(`₹${(payslipData.grossEarnings || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, col3, y, { align: 'right' });
            y += rowHeight + 5;

            // Deductions Header
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('DEDUCTIONS', col1, y);
            doc.text('Amount', col3, y, { align: 'right' });
            doc.moveTo(col1 - 10, y + 15).lineTo(520, y + 15).stroke('#cccccc');
            y += 20;

            // Pre-Tax Deductions
            const preTaxDeds = payslipData.preTaxDeductionsSnapshot || [];
            preTaxDeds.forEach(ded => {
                doc.fontSize(8).font('Helvetica');
                doc.text(ded.name, col1, y);
                doc.text(`₹${(ded.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, col3, y, { align: 'right' });
                y += rowHeight;
            });

            // Taxable Income
            doc.fontSize(8).font('Helvetica-Bold');
            doc.text('Taxable Income', col1, y);
            doc.text(`₹${(payslipData.taxableIncome || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, col3, y, { align: 'right' });
            y += rowHeight;

            // Income Tax
            if (payslipData.incomeTax) {
                doc.fontSize(8).font('Helvetica-Bold');
                doc.text('Income Tax (TDS)', col1, y);
                doc.text(`₹${(payslipData.incomeTax || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, col3, y, { align: 'right' });
                y += rowHeight;
            }

            // Post-Tax Deductions
            const postTaxDeds = payslipData.postTaxDeductionsSnapshot || [];
            postTaxDeds.forEach(ded => {
                doc.fontSize(8).font('Helvetica');
                doc.text(ded.name, col1, y);
                doc.text(`₹${(ded.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, col3, y, { align: 'right' });
                y += rowHeight;
            });

            doc.moveTo(col1 - 10, y).lineTo(520, y).stroke('#cccccc');
            y += 5;

            // Total Deductions
            const totalDeds = (payslipData.preTaxDeductionsTotal || 0) + (payslipData.postTaxDeductionsTotal || 0) + (payslipData.incomeTax || 0);
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('TOTAL DEDUCTIONS', col1, y);
            doc.text(`₹${totalDeds.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, col3, y, { align: 'right' });
            y += rowHeight + 5;

            // Net Pay
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#2ecc71');
            doc.text('NET PAY (TAKE HOME)', col1, y);
            doc.text(`₹${(payslipData.netPay || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, col3, y, { align: 'right' });
            doc.fillColor('#000000');
            y += rowHeight + 10;

            // Employer Contributions (if any)
            const empContribs = payslipData.employerContributionsSnapshot || [];
            if (empContribs.length > 0) {
                doc.moveTo(30, y).lineTo(565, y).stroke('#999999');
                y += 10;

                doc.fontSize(9).font('Helvetica-Bold').text('Employer Contributions (Informational)', { underline: true });
                y += 15;

                empContribs.forEach(contrib => {
                    doc.fontSize(8).font('Helvetica');
                    doc.text(contrib.name, col1, y);
                    doc.text(`₹${(contrib.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, col3, y, { align: 'right' });
                    y += rowHeight;
                });
            }

            // Footer
            y = 750;
            doc.moveTo(30, y).lineTo(565, y).stroke('#999999');
            y += 10;

            doc.fontSize(8).font('Helvetica').fillColor('#666666');
            doc.text('This is a system-generated document. No signature required.', 30, y, { align: 'center' });
            doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 30, y + 15, { align: 'center' });

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Mask bank account number for security
 */
function maskAccountNumber(accountNumber) {
    if (!accountNumber) return '****';
    if (accountNumber.length <= 4) return accountNumber;
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

module.exports = {
    generatePayslipPDF
};
