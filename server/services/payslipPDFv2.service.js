/**
 * Professional Payslip PDF Generator V2
 * Enterprise-grade payslip with compliance, improved layout, and professional design
 */

const PDFDocument = require('pdfkit');

/**
 * Generate professional payslip PDF
 * Compliant with Indian tax regulations and accounting standards
 */
function generatePayslipPDFProfessional(payslipData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                margin: 40,
                size: 'A4',
                bufferPages: true
            });

            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                resolve(Buffer.concat(buffers));
            });
            doc.on('error', reject);

            const info = payslipData.employeeInfo || {};
            const salaryTemplate = payslipData.salaryTemplateSnapshot || {};
            const attendance = payslipData.attendanceSummary || {};

            // ════════════════════════════════════════════════════════════════
            // PAGE 1: PAYSLIP
            // ════════════════════════════════════════════════════════════════

            // HEADER SECTION
            doc.rect(40, 40, 515, 65).fillAndStroke('#1e3a8a', '#1e3a8a');
            
            doc.fillColor('#ffffff')
                .fontSize(22).font('Helvetica-Bold')
                .text('PAYSLIP', 50, 52)
                .fontSize(9).font('Helvetica')
                .text(getFormattedMonthYear(payslipData.month, payslipData.year), 50, 78);

            // Company info on right
            doc.fillColor('#ffffff')
                .fontSize(11).font('Helvetica-Bold')
                .text(payslipData.companyInfo?.name || 'COMPANY NAME', 300, 52, { width: 240, align: 'right' })
                .fontSize(8).font('Helvetica')
                .text('HR & Payroll Management System', 300, 68, { width: 240, align: 'right' });

            doc.moveDown(2.8);

            // EMPLOYEE INFORMATION SECTION
            doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold')
                .text('EMPLOYEE INFORMATION', 40);
            drawLine(doc, 40, doc.y, 555, doc.y, '#2563eb', 0.5);
            doc.moveDown(0.2);

            const empData = [
                [`Employee ID: ${info.employeeId || 'N/A'}`, `Pan Number: ${info.panNumber || 'N/A'}`],
                [`Name: ${info.name || 'N/A'}`, `Bank: ${info.bankName || 'N/A'}`],
                [`Department: ${info.department || 'N/A'}`, `Account: ${maskAccountNumber(info.bankAccountNumber)}`],
                [`Designation: ${info.designation || 'N/A'}`, `IFSC: ${info.bankIFSC || 'N/A'}`]
            ];

            doc.fontSize(8).font('Helvetica');
            empData.forEach(row => {
                doc.text(row[0], 50, doc.y, { width: 220 });
                doc.text(row[1], 300, doc.y - 11, { width: 220 });
                doc.moveDown(0.3);
            });

            doc.moveDown(0.5);
            drawLine(doc, 40, doc.y, 555, doc.y, '#cccccc', 0.5);
            doc.moveDown(0.3);

            // ATTENDANCE SECTION
            doc.fontSize(10).font('Helvetica-Bold')
                .text('ATTENDANCE & LEAVE', 40);
            drawLine(doc, 40, doc.y, 555, doc.y, '#2563eb', 0.5);
            doc.moveDown(0.2);

            const attData = [
                [`Total Days: ${attendance.totalDays || 0}`, `Present Days: ${attendance.presentDays || 0}`, `Leave Days: ${attendance.leaveDays || 0}`],
                [`LOP Days: ${attendance.lopDays || 0}`, `Holiday Days: ${attendance.holidayDays || 0}`, '']
            ];

            doc.fontSize(8).font('Helvetica');
            attData.forEach(row => {
                doc.text(row[0], 50, doc.y, { width: 140 });
                doc.text(row[1], 220, doc.y - 11, { width: 140 });
                if (row[2]) doc.text(row[2], 390, doc.y - 11, { width: 140 });
                doc.moveDown(0.3);
            });

            doc.moveDown(0.8);

            // EARNINGS TABLE
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a8a')
                .text('EARNINGS', 40);
            doc.moveDown(0.15);

            const earningsTable = createTableData(
                ['Description', 'Percentage', 'Amount'],
                (payslipData.earningsSnapshot || []).map(e => [
                    e.name,
                    e.isProRata ? `${(e.daysWorked || 0)}/${e.totalDays || 0} days` : 'Fixed',
                    `₹${(e.amount || 0).toLocaleString('en-IN')}`
                ])
            );

            drawTable(doc, earningsTable, 40);
            doc.moveDown(0.3);

            // GROSS BOX
            const grossY = doc.y;
            doc.rect(40, grossY - 2, 515, 20).stroke('#2563eb');
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#2563eb')
                .text('GROSS EARNINGS', 50, grossY + 2);
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000')
                .text(`₹${(payslipData.grossEarnings || 0).toLocaleString('en-IN')}`, 450, grossY + 2, { align: 'right' });

            doc.moveDown(1.5);

            // DEDUCTIONS SECTION
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#dc2626')
                .text('DEDUCTIONS', 40);
            doc.moveDown(0.15);

            const preTaxData = [
                ['PRE-TAX DEDUCTIONS', 'Amount'],
                ...(payslipData.preTaxDeductionsSnapshot || []).map(d => [
                    d.name,
                    `₹${(d.amount || 0).toLocaleString('en-IN')}`
                ]),
                ['', ''],
                ['Taxable Income', `₹${(payslipData.taxableIncome || 0).toLocaleString('en-IN')}`],
                ['Income Tax (TDS)', `₹${(payslipData.incomeTax || 0).toLocaleString('en-IN')}`]
            ];

            doc.fontSize(8).font('Helvetica');
            drawTableSimple(doc, preTaxData, 40);

            const postTaxData = [
                ['POST-TAX DEDUCTIONS', 'Amount'],
                ...(payslipData.postTaxDeductionsSnapshot || []).map(d => [
                    d.name,
                    `₹${(d.amount || 0).toLocaleString('en-IN')}`
                ])
            ];

            if (postTaxData.length > 1) {
                doc.moveDown(0.3);
                drawTableSimple(doc, postTaxData, 40);
            }

            doc.moveDown(0.8);

            // NET PAY BOX (Prominent)
            const netY = doc.y;
            doc.rect(40, netY - 2, 515, 25).fillAndStroke('#10b981', '#059669');
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff')
                .text('NET PAY (TAKE HOME)', 50, netY + 4);
            doc.fontSize(14).font('Helvetica-Bold').fillColor('#ffffff')
                .text(`₹${(payslipData.netPay || 0).toLocaleString('en-IN')}`, 450, netY + 2, { align: 'right' });

            doc.moveDown(2.2);

            // EMPLOYER CONTRIBUTIONS (Informational)
            if (payslipData.employerContributionsSnapshot && payslipData.employerContributionsSnapshot.length > 0) {
                drawLine(doc, 40, doc.y, 555, doc.y, '#999999', 0.5);
                doc.moveDown(0.3);

                doc.fontSize(9).font('Helvetica-Bold').fillColor('#666666')
                    .text('Employer Contributions (Informational)', 40);
                doc.moveDown(0.15);

                const empContribData = [
                    ['Description', 'Amount'],
                    ...(payslipData.employerContributionsSnapshot || []).map(c => [
                        c.name,
                        `₹${(c.amount || 0).toLocaleString('en-IN')}`
                    ])
                ];

                doc.fontSize(8).font('Helvetica').fillColor('#000000');
                drawTableSimple(doc, empContribData, 40);
            }

            // FOOTER
            doc.moveDown(1);
            drawLine(doc, 40, doc.y, 555, doc.y, '#999999', 0.5);
            doc.moveDown(0.3);

            doc.fontSize(7).font('Helvetica').fillColor('#666666');
            doc.text('This is a system-generated payslip. No signature required.', 40, doc.y, { align: 'center' });
            doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')} | Payslip Hash: ${(payslipData.hash || 'N/A').substring(0, 16)}...`, 40, doc.y + 8, { align: 'center' });

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

// ════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════

function getFormattedMonthYear(month, year) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[month - 1]} ${year}`;
}

function maskAccountNumber(accountNumber) {
    if (!accountNumber || accountNumber.length <= 4) return '****';
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

function drawLine(doc, x1, y, x2, y2, color = '#000000', width = 1) {
    doc.strokeColor(color).lineWidth(width).moveTo(x1, y).lineTo(x2, y2).stroke();
}

function createTableData(headers, rows) {
    return [headers, ...rows];
}

function drawTable(doc, data, startX) {
    const colWidth = [200, 150, 165];
    const rowHeight = 16;
    let y = doc.y;

    // Header
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e3a8a');
    data[0].forEach((cell, i) => {
        doc.text(cell, startX + (colWidth.slice(0, i).reduce((a, b) => a + b, 0)), y, { width: colWidth[i] });
    });

    y += rowHeight;
    drawLine(doc, startX, y, startX + 515, y, '#cccccc', 0.5);

    // Rows
    doc.font('Helvetica').fillColor('#000000');
    for (let i = 1; i < data.length; i++) {
        y += 2;
        data[i].forEach((cell, j) => {
            doc.text(cell, startX + (colWidth.slice(0, j).reduce((a, b) => a + b, 0)), y, {
                width: colWidth[j],
                align: j === 2 ? 'right' : 'left'
            });
        });
        y += rowHeight;
    }

    doc.y = y + 5;
}

function drawTableSimple(doc, data, startX) {
    const colWidth = [350, 165];
    const rowHeight = 14;
    let y = doc.y;

    data.forEach((row, idx) => {
        if (row[0] === '') return; // Skip empty rows

        // Bold header row
        if (idx === 0 || row[0].includes('Gross') || row[0].includes('Net') || row[0].includes('PRE-TAX') || row[0].includes('POST-TAX')) {
            doc.font('Helvetica-Bold').fillColor('#333333');
        } else {
            doc.font('Helvetica').fillColor('#666666');
        }

        doc.fontSize(7.5).text(row[0], startX, y, { width: colWidth[0] });
        doc.text(row[1], startX + colWidth[0], y, { width: colWidth[1], align: 'right' });
        y += rowHeight;
    });

    doc.y = y + 3;
}

/**
 * Generate the original payslip (kept for backward compatibility)
 */
function generatePayslipPDF(payslipData) {
    // Delegate to professional version
    return generatePayslipPDFProfessional(payslipData);
}

module.exports = {
    generatePayslipPDF,
    generatePayslipPDFProfessional
};
