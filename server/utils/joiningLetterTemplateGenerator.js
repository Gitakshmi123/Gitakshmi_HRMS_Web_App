/**
 * Joining Letter Template Generator
 * Creates a professional joining letter with CTC breakdown table
 * Matches the Gitalakshmi Technologies format
 */

const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');

/**
 * Generate a professional joining letter DOCX with CTC table
 * @param {Object} employeeData - Employee/Applicant information
 * @param {Object} salarySnapshot - Salary breakdown from EmployeeSalarySnapshot
 * @param {String} outputPath - Where to save the generated DOCX
 * @returns {String} - Path to generated DOCX file
 */
async function generateJoiningLetterDocx(employeeData, salarySnapshot, outputPath) {
    const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        Table,
        TableCell,
        TableRow,
        WidthType,
        AlignmentType,
        BorderStyle,
        VerticalAlign,
        HeadingLevel
    } = require('docx');

    // Helper to format currency
    const formatCurrency = (amount) => {
        return `₹${Math.round(amount || 0).toLocaleString('en-IN')}`;
    };

    // Helper to format date
    const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const day = d.getDate();
        const month = d.toLocaleString('en-IN', { month: 'short' });
        const year = d.getFullYear();

        let suffix = 'th';
        if (day % 10 === 1 && day !== 11) suffix = 'st';
        else if (day % 10 === 2 && day !== 12) suffix = 'nd';
        else if (day % 10 === 3 && day !== 13) suffix = 'rd';

        return `${day}${suffix} ${month}. ${year}`;
    };

    // Extract salary data
    const earnings = salarySnapshot.earnings || [];
    const employeeDeductions = salarySnapshot.employeeDeductions || salarySnapshot.deductions || [];
    const benefits = salarySnapshot.benefits || [];

    // Calculate totals
    const totalEarningsAnnual = earnings.reduce((sum, e) => sum + (e.annualAmount || (e.monthlyAmount * 12) || 0), 0);
    const totalBenefitsAnnual = benefits.reduce((sum, b) => sum + (b.annualAmount || (b.monthlyAmount * 12) || 0), 0);
    const totalDeductionsAnnual = employeeDeductions.reduce((sum, d) => sum + (d.annualAmount || (d.monthlyAmount * 12) || 0), 0);
    const totalCTCAnnual = totalEarningsAnnual + totalBenefitsAnnual;
    const netAnnual = totalEarningsAnnual - totalDeductionsAnnual;

    // Create table border style
    const tableBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" }
    };

    // Helper to create table cell
    const createCell = (text, options = {}) => {
        return new TableCell({
            children: [
                new Paragraph({
                    children: [
                        new TextRun({
                            text: text,
                            size: options.size || 20,
                            bold: options.bold || false,
                            font: "Arial"
                        })
                    ],
                    alignment: options.alignment || AlignmentType.LEFT
                })
            ],
            verticalAlign: VerticalAlign.CENTER,
            width: options.width || { size: 33, type: WidthType.PERCENTAGE },
            margins: {
                top: 50,
                bottom: 50,
                left: 100,
                right: 100
            },
            shading: options.shading || undefined
        });
    };

    // Build CTC table rows
    const tableRows = [];

    // Header row
    tableRows.push(
        new TableRow({
            children: [
                createCell("", { bold: true, width: { size: 50, type: WidthType.PERCENTAGE } }),
                createCell("Monthly", { bold: true, alignment: AlignmentType.CENTER, width: { size: 25, type: WidthType.PERCENTAGE } }),
                createCell("Yearly", { bold: true, alignment: AlignmentType.CENTER, width: { size: 25, type: WidthType.PERCENTAGE } })
            ]
        })
    );

    // Section A: Monthly Benefits
    tableRows.push(
        new TableRow({
            children: [
                createCell("A – Monthly Benefits", { bold: true, shading: { fill: "E7E6E6" } }),
                createCell("", { shading: { fill: "E7E6E6" } }),
                createCell("", { shading: { fill: "E7E6E6" } })
            ]
        })
    );

    // Earnings
    earnings.forEach(earning => {
        const monthly = earning.monthlyAmount || (earning.annualAmount / 12) || 0;
        const annual = earning.annualAmount || (earning.monthlyAmount * 12) || 0;

        tableRows.push(
            new TableRow({
                children: [
                    createCell(earning.name || earning.code),
                    createCell(formatCurrency(monthly), { alignment: AlignmentType.RIGHT }),
                    createCell(formatCurrency(annual), { alignment: AlignmentType.RIGHT })
                ]
            })
        );
    });

    // Gross A Total
    tableRows.push(
        new TableRow({
            children: [
                createCell("Gross A (Total)", { bold: true }),
                createCell(formatCurrency(totalEarningsAnnual / 12), { bold: true, alignment: AlignmentType.RIGHT }),
                createCell(formatCurrency(totalEarningsAnnual), { bold: true, alignment: AlignmentType.RIGHT })
            ]
        })
    );

    // Empty separator row
    tableRows.push(
        new TableRow({
            children: [
                createCell(""),
                createCell(""),
                createCell("")
            ]
        })
    );

    // Section B: Deductions
    if (employeeDeductions.length > 0) {
        tableRows.push(
            new TableRow({
                children: [
                    createCell("B – Deductions", { bold: true, shading: { fill: "E7E6E6" } }),
                    createCell("", { shading: { fill: "E7E6E6" } }),
                    createCell("", { shading: { fill: "E7E6E6" } })
                ]
            })
        );

        employeeDeductions.forEach(deduction => {
            const monthly = deduction.monthlyAmount || (deduction.annualAmount / 12) || 0;
            const annual = deduction.annualAmount || (deduction.monthlyAmount * 12) || 0;

            tableRows.push(
                new TableRow({
                    children: [
                        createCell(deduction.name || deduction.code),
                        createCell(formatCurrency(monthly), { alignment: AlignmentType.RIGHT }),
                        createCell(formatCurrency(annual), { alignment: AlignmentType.RIGHT })
                    ]
                })
            );
        });

        // Total Deductions
        tableRows.push(
            new TableRow({
                children: [
                    createCell("Total Deductions (B)", { bold: true }),
                    createCell(formatCurrency(totalDeductionsAnnual / 12), { bold: true, alignment: AlignmentType.RIGHT }),
                    createCell(formatCurrency(totalDeductionsAnnual), { bold: true, alignment: AlignmentType.RIGHT })
                ]
            })
        );

        // Net Salary
        tableRows.push(
            new TableRow({
                children: [
                    createCell("Net Salary Payable (A-B)", { bold: true }),
                    createCell(formatCurrency(netAnnual / 12), { bold: true, alignment: AlignmentType.RIGHT }),
                    createCell(formatCurrency(netAnnual), { bold: true, alignment: AlignmentType.RIGHT })
                ]
            })
        );

        // Empty separator row
        tableRows.push(
            new TableRow({
                children: [
                    createCell(""),
                    createCell(""),
                    createCell("")
                ]
            })
        );
    }

    // Section C: Other Benefits
    if (benefits.length > 0) {
        tableRows.push(
            new TableRow({
                children: [
                    createCell("C – Other Benefits", { bold: true, shading: { fill: "E7E6E6" } }),
                    createCell("", { shading: { fill: "E7E6E6" } }),
                    createCell("", { shading: { fill: "E7E6E6" } })
                ]
            })
        );

        benefits.forEach(benefit => {
            const monthly = benefit.monthlyAmount || (benefit.annualAmount / 12) || 0;
            const annual = benefit.annualAmount || (benefit.monthlyAmount * 12) || 0;

            tableRows.push(
                new TableRow({
                    children: [
                        createCell(benefit.name || benefit.code),
                        createCell(formatCurrency(monthly), { alignment: AlignmentType.RIGHT }),
                        createCell(formatCurrency(annual), { alignment: AlignmentType.RIGHT })
                    ]
                })
            );
        });
    }

    // Total CTC
    tableRows.push(
        new TableRow({
            children: [
                createCell("TOTAL CTC (A+C)", { bold: true, shading: { fill: "D9D9D9" } }),
                createCell(formatCurrency(totalCTCAnnual / 12), { bold: true, alignment: AlignmentType.RIGHT, shading: { fill: "D9D9D9" } }),
                createCell(formatCurrency(totalCTCAnnual), { bold: true, alignment: AlignmentType.RIGHT, shading: { fill: "D9D9D9" } })
            ]
        })
    );

    // Create the CTC table
    const ctcTable = new Table({
        rows: tableRows,
        width: {
            size: 100,
            type: WidthType.PERCENTAGE
        },
        borders: tableBorders
    });

    // Create the document
    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1440,
                            right: 1440,
                            bottom: 1440,
                            left: 1440
                        }
                    }
                },
                children: [
                    // Company Header
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Gitalakshmi",
                                bold: true,
                                size: 32,
                                color: "E91E63",
                                font: "Arial"
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "TECHNOLOGIES",
                                bold: true,
                                size: 20,
                                color: "E91E63",
                                font: "Arial"
                            })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 }
                    }),

                    // Reference and Date
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Reference No: ${employeeData.offerRefNo || 'REF/2026/001'}`,
                                size: 20,
                                font: "Arial"
                            })
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Date: ${formatDate(new Date())}`,
                                size: 20,
                                font: "Arial"
                            })
                        ],
                        spacing: { after: 400 }
                    }),

                    // Employee Details
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Name: ${employeeData.name || ''}`,
                                size: 20,
                                font: "Arial"
                            })
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Designation: ${employeeData.designation || ''}`,
                                size: 20,
                                font: "Arial"
                            })
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Location: ${employeeData.location || ''}`,
                                size: 20,
                                font: "Arial"
                            })
                        ],
                        spacing: { after: 400 }
                    }),

                    // CTC Structure Heading
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "CTC Structure",
                                bold: true,
                                size: 24,
                                font: "Arial"
                            })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 200, after: 200 }
                    }),

                    // CTC Table
                    ctcTable,

                    // Footer
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "\n\nBest Regards,",
                                size: 20,
                                font: "Arial"
                            })
                        ],
                        spacing: { before: 400 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Gitalakshmi Technologies Private Limited",
                                bold: true,
                                size: 20,
                                font: "Arial"
                            })
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Address: [Company Address]",
                                size: 18,
                                font: "Arial",
                                italics: true
                            })
                        ]
                    })
                ]
            }
        ]
    });

    // Generate and save the document
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);

    console.log(`✅ Joining letter generated: ${outputPath}`);
    return outputPath;
}

module.exports = {
    generateJoiningLetterDocx
};
