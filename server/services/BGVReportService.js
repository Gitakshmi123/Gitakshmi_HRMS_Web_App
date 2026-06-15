const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

/**
 * BGV Report Service
 * Generates comprehensive PDF reports for Background Verification cases
 */
class BGVReportService {
    constructor() {
        this.baseDir = path.join(process.cwd(), 'uploads', 'bgv', 'reports');
        this.ensureDirectory();
    }

    async ensureDirectory() {
        try {
            await fs.mkdir(this.baseDir, { recursive: true });
        } catch (err) {
            console.error('[BGV_REPORT] Error creating directory:', err);
        }
    }

    /**
     * Generate BGV Report HTML
     * Creates a professional HTML report with case details and check results
     */
    generateReportHTML(bgvCase, checks, summary) {
        const reportDate = new Date().toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const getCheckStatusColor = (status) => {
            switch (status) {
                case 'VERIFIED':
                    return '#22c55e';
                case 'FAILED':
                    return '#ef4444';
                case 'DISCREPANCY':
                    return '#f59e0b';
                case 'PENDING':
                    return '#6b7280';
                default:
                    return '#6b7280';
            }
        };

        const getCheckStatusBg = (status) => {
            switch (status) {
                case 'VERIFIED':
                    return '#f0fdf4';
                case 'FAILED':
                    return '#fef2f2';
                case 'DISCREPANCY':
                    return '#fffbeb';
                case 'PENDING':
                    return '#f9fafb';
                default:
                    return '#f9fafb';
            }
        };

        const getRiskColor = (riskLevel) => {
            switch (riskLevel) {
                case 'LOW':
                    return '#059669';
                case 'MEDIUM':
                    return '#f59e0b';
                case 'HIGH':
                    return '#dc2626';
                default:
                    return '#6b7280';
            }
        };

        const checkRows = checks
            .map(
                (check, idx) => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px; text-align: center; font-size: 13px; color: #374151;">${idx + 1}</td>
                    <td style="padding: 12px; font-size: 13px; color: #374151; font-weight: 500;">${check.checkType || check.type}</td>
                    <td style="padding: 12px; font-size: 13px; color: #374151;">${check.description || '-'}</td>
                    <td style="padding: 12px; text-align: center;">
                        <span style="
                            display: inline-block;
                            padding: 6px 12px;
                            border-radius: 6px;
                            font-size: 12px;
                            font-weight: 600;
                            background-color: ${getCheckStatusBg(check.status)};
                            color: ${getCheckStatusColor(check.status)};
                            text-transform: capitalize;
                        ">${check.status?.toLowerCase()}</span>
                    </td>
                    <td style="padding: 12px; font-size: 13px; color: #374151;">${check.remarks || '-'}</td>
                </tr>
            `
            )
            .join('');

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>BGV Report - ${bgvCase.caseId}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Arial', sans-serif;
                    color: #1f2937;
                    line-height: 1.6;
                    background-color: #f9fafb;
                    padding: 20px;
                }
                
                .container {
                    max-width: 900px;
                    margin: 0 auto;
                    background-color: white;
                    padding: 40px;
                    border-radius: 8px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                
                header {
                    text-align: center;
                    margin-bottom: 40px;
                    padding-bottom: 20px;
                    border-bottom: 3px solid #1f2937;
                }
                
                .logo-section {
                    font-size: 28px;
                    font-weight: bold;
                    color: #1f2937;
                    margin-bottom: 10px;
                }
                
                .report-type {
                    font-size: 14px;
                    color: #6b7280;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 15px;
                }
                
                .report-date {
                    font-size: 12px;
                    color: #9ca3af;
                    margin-top: 10px;
                }
                
                section {
                    margin-bottom: 30px;
                }
                
                .section-title {
                    font-size: 16px;
                    font-weight: bold;
                    color: #1f2937;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #e5e7eb;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 20px;
                }
                
                .info-item {
                    background-color: #f9fafb;
                    padding: 15px;
                    border-radius: 6px;
                    border-left: 4px solid #3b82f6;
                }
                
                .info-label {
                    font-size: 11px;
                    font-weight: bold;
                    color: #6b7280;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 5px;
                }
                
                .info-value {
                    font-size: 14px;
                    font-weight: 500;
                    color: #1f2937;
                }
                
                .summary-cards {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 15px;
                    margin-bottom: 30px;
                }
                
                .summary-card {
                    background-color: #f9fafb;
                    padding: 20px;
                    border-radius: 6px;
                    text-align: center;
                    border-top: 4px solid #3b82f6;
                }
                
                .card-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #1f2937;
                    margin-bottom: 5px;
                }
                
                .card-label {
                    font-size: 11px;
                    font-weight: bold;
                    color: #6b7280;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .risk-badge {
                    display: inline-block;
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-weight: bold;
                    font-size: 14px;
                    margin: 20px 0;
                }
                
                .risk-low {
                    background-color: #f0fdf4;
                    color: #059669;
                    border: 2px solid #059669;
                }
                
                .risk-medium {
                    background-color: #fffbeb;
                    color: #d97706;
                    border: 2px solid #d97706;
                }
                
                .risk-high {
                    background-color: #fef2f2;
                    color: #dc2626;
                    border: 2px solid #dc2626;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                    font-size: 13px;
                }
                
                th {
                    background-color: #f3f4f6;
                    padding: 12px;
                    text-align: left;
                    font-weight: bold;
                    color: #1f2937;
                    border-bottom: 2px solid #d1d5db;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                td {
                    padding: 12px;
                    color: #374151;
                }
                
                .decision-section {
                    background-color: #eff6ff;
                    padding: 20px;
                    border-radius: 6px;
                    border-left: 4px solid #3b82f6;
                    margin: 20px 0;
                }
                
                .decision-label {
                    font-size: 12px;
                    font-weight: bold;
                    color: #1e40af;
                    text-transform: uppercase;
                    margin-bottom: 10px;
                }
                
                .decision-value {
                    font-size: 18px;
                    font-weight: bold;
                    color: #1f2937;
                    text-transform: capitalize;
                }
                
                .remarks {
                    font-size: 13px;
                    color: #4b5563;
                    margin-top: 10px;
                    line-height: 1.6;
                }
                
                footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    text-align: center;
                    font-size: 11px;
                    color: #9ca3af;
                }
                
                .page-break {
                    page-break-after: always;
                    margin: 40px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <div class="logo-section">Background Verification Report</div>
                    <div class="report-type">Final Report</div>
                    <div class="report-date">Generated on ${reportDate}</div>
                </header>
                
                <section>
                    <div class="section-title">Candidate Information</div>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Case ID</div>
                            <div class="info-value">${bgvCase.caseId}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Candidate Name</div>
                            <div class="info-value">${bgvCase.candidateId?.name || bgvCase.candidateName || 'N/A'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Email</div>
                            <div class="info-value">${bgvCase.candidateId?.email || 'N/A'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Package</div>
                            <div class="info-value">${bgvCase.package}</div>
                        </div>
                    </div>
                </section>
                
                <section>
                    <div class="section-title">Verification Summary</div>
                    <div class="summary-cards">
                        <div class="summary-card">
                            <div class="card-value">${summary.totalChecks}</div>
                            <div class="card-label">Total Checks</div>
                        </div>
                        <div class="summary-card" style="border-top-color: #22c55e;">
                            <div class="card-value" style="color: #22c55e;">${summary.verifiedChecks}</div>
                            <div class="card-label">Verified</div>
                        </div>
                        <div class="summary-card" style="border-top-color: #ef4444;">
                            <div class="card-value" style="color: #ef4444;">${summary.failedChecks}</div>
                            <div class="card-label">Failed</div>
                        </div>
                        <div class="summary-card" style="border-top-color: #f59e0b;">
                            <div class="card-value" style="color: #f59e0b;">${summary.discrepancyChecks}</div>
                            <div class="card-label">Discrepancies</div>
                        </div>
                    </div>
                </section>
                
                <section>
                    <div class="section-title">Risk Assessment</div>
                    <div class="risk-badge risk-${summary.riskLevel?.toLowerCase()}">
                        Risk Level: ${summary.riskLevel}
                    </div>
                </section>
                
                <section>
                    <div class="section-title">Verification Details</div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 5%;">No.</th>
                                <th style="width: 15%;">Check Type</th>
                                <th style="width: 30%;">Description</th>
                                <th style="width: 15%;">Status</th>
                                <th style="width: 35%;">Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${checkRows}
                        </tbody>
                    </table>
                </section>
                
                <section>
                    <div class="section-title">Final Decision</div>
                    <div class="decision-section">
                        <div class="decision-label">Overall Decision</div>
                        <div class="decision-value">${bgvCase.decision || 'PENDING'}</div>
                        ${bgvCase.decisionRemarks ? `<div class="remarks"><strong>Remarks:</strong> ${bgvCase.decisionRemarks}</div>` : ''}
                    </div>
                </section>
                
                <footer>
                    <p>This is an electronically generated report. It is valid without any signature or seal.</p>
                    <p>Report ID: ${bgvCase.caseId} | Generated Date: ${reportDate}</p>
                </footer>
            </div>
        </body>
        </html>
        `;

        return html;
    }

    /**
     * Generate PDF report from HTML
     */
    async generatePDF(htmlContent, fileName) {
        let browser;
        try {
            console.log('[BGV_REPORT] Generating PDF:', fileName);

            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            const filePath = path.join(this.baseDir, fileName);
            await page.pdf({
                path: filePath,
                format: 'A4',
                margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                }
            });

            console.log('[BGV_REPORT] PDF generated successfully:', filePath);
            return filePath;
        } catch (err) {
            console.error('[BGV_REPORT] Error generating PDF:', err);
            throw err;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Generate complete BGV report
     */
    async generateBGVReport(bgvCase, checks, summary, tenantId) {
        try {
            // Generate HTML
            const htmlContent = this.generateReportHTML(bgvCase, checks, summary);

            // Generate unique file name
            const timestamp = Date.now();
            const fileName = `BGV_Report_${bgvCase.caseId}_${timestamp}.pdf`;

            // Generate PDF
            const filePath = await this.generatePDF(htmlContent, fileName);

            // Return relative path for storage
            const relativePath = `/uploads/bgv/reports/${fileName}`;

            return {
                success: true,
                filePath: relativePath,
                fileName,
                absolutePath: filePath
            };
        } catch (err) {
            console.error('[BGV_REPORT] Report generation failed:', err);
            throw err;
        }
    }

    /**
     * Get report file stream for download
     */
    async getReportFile(filePath) {
        try {
            // Extract filename from URL path
            const fileName = filePath.split('/').pop();
            const fullPath = path.join(this.baseDir, fileName);

            // Check if file exists
            const fileExists = await fs
                .access(fullPath)
                .then(() => true)
                .catch(() => false);

            if (!fileExists) {
                throw new Error('Report file not found');
            }

            return fullPath;
        } catch (err) {
            console.error('[BGV_REPORT] Error getting report file:', err);
            throw err;
        }
    }
}

module.exports = new BGVReportService();
