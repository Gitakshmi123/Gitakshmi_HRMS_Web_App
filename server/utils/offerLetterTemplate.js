// Helper function to generate HTML for offer letter (matching the React preview)
function generateOfferLetterHTML(applicant, offerData, companyInfo) {
    const today = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const joiningDateFormatted = offerData.joiningDate
        ? new Date(offerData.joiningDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
        : '___________';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: Arial, sans-serif; 
            padding: 40px;
            color: #334155;
            line-height: 1.6;
        }
        .container { max-width: 800px; margin: 0 auto; }
        .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start;
            padding-bottom: 20px;
            border-bottom: 3px solid #2563eb;
            margin-bottom: 30px;
        }
        .company-info h1 { 
            color: #2563eb; 
            font-size: 28px;
            margin-bottom: 5px;
        }
        .company-info p { 
            color: #64748b; 
            font-size: 12px;
        }
        .logo img { height: 60px; }
        .ref-number { 
            text-align: right; 
            font-size: 11px;
            color: #64748b;
            margin-bottom: 20px;
        }
        .recipient { margin-bottom: 20px; }
        .recipient p { 
            font-size: 13px;
            margin: 2px 0;
        }
        .subject { 
            font-weight: bold;
            text-decoration: underline;
            margin: 20px 0;
        }
        .salutation { margin: 15px 0; }
        .content { 
            font-size: 13px;
            text-align: justify;
        }
        .content p { margin: 12px 0; }
        .content ol { 
            margin: 15px 0;
            padding-left: 25px;
        }
        .content li { 
            margin: 10px 0;
            padding-left: 5px;
        }
        .content ul {
            margin: 8px 0;
            padding-left: 40px;
        }
        .content ul li {
            margin: 5px 0;
        }
        .signature-section { 
            margin-top: 50px;
        }
        .signature-section p {
            margin: 5px 0;
        }
        .acceptance-section {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #cbd5e1;
        }
        .acceptance-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 20px;
        }
        .acceptance-field {
            border-bottom: 1px solid #64748b;
            padding-bottom: 5px;
            min-height: 50px;
        }
        .acceptance-label {
            font-size: 11px;
            color: #64748b;
            margin-bottom: 30px;
        }
        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #cbd5e1;
            text-align: center;
            font-size: 11px;
            color: #64748b;
        }
        strong { font-weight: 600; }
        em { font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="company-info">
                <h1>${companyInfo.name || 'Company Name'}</h1>
                <p>${companyInfo.tagline || 'TECHNOLOGIES'}</p>
            </div>
            ${companyInfo.logo ? `<div class="logo"><img src="${companyInfo.logo}" alt="Logo"></div>` : ''}
        </div>

        <!-- Reference Number -->
        <div class="ref-number">
            Ref: ${companyInfo.refPrefix || 'OFFER'}/${new Date().getFullYear()}/${Math.floor(Math.random() * 10000)}
        </div>

        <!-- Recipient -->
        <div class="recipient">
            <p><strong>Ms./Mr. ${applicant.name}</strong></p>
            <p>${applicant.address || applicant.currentAddress || ''}</p>
            <p>${applicant.city || ''}, ${applicant.state || ''}</p>
            <p>Pin: ${applicant.pincode || ''}</p>
        </div>

        <!-- Subject -->
        <div class="subject">
            <p>Offer to Join ${companyInfo.name || 'Our Company'}</p>
        </div>

        <!-- Salutation -->
        <div class="salutation">
            <p>Dear Ms./Mr. ${applicant.name?.split(' ')[0]},</p>
        </div>

        <!-- Main Content -->
        <div class="content">
            <p>
                Congratulations! Further to your application for employment with us, and the subsequent selection process, we 
                are pleased to <strong>offer you the position of ${applicant.requirementId?.jobTitle || offerData.position}</strong> at 
                our <strong>${offerData.location || 'Ahmedabad'}</strong> office on the following terms and conditions:
            </p>

            <ol>
                <li>
                    <strong>Appointment:</strong> You will be appointed as <strong>${applicant.requirementId?.jobTitle || offerData.position}</strong>, 
                    with your registered address as the location. The employment is headquartered (HQ) is located 
                    at <strong>${companyInfo.address || 'Company Address'}</strong>. You may be required to work at any of our offices.
                </li>

                <li>
                    <strong>Date of Joining:</strong> You are requested to join on or before <strong>${joiningDateFormatted}</strong>.
                </li>

                <li>
                    <strong>Compensation:</strong> Upon your joining company will have a detailed Appointment letter outlining all terms and conditions 
                    of your employment and a detailed compensation structure along with our Space Manual.
                </li>

                <li>
                    <strong>Probation Period:</strong> You will be on probation for a period of <strong>${offerData.probationPeriod || '3 months'}</strong> from the date of joining.
                </li>

                <li>
                    <strong>Terms & Conditions:</strong> Your appointment and continued employment with the company is subject to you providing:
                    <ul>
                        <li>All original educational certificates along with one set of photocopies of the same.</li>
                        <li>Experience & Relieving letters from previous employers (if applicable).</li>
                        <li>Residence Proof / Aadhaar Card / Telephone Bill / Ration Card.</li>
                        <li>Passport size photographs.</li>
                        <li>PAN Card copy.</li>
                    </ul>
                </li>

                <li>
                    <strong>Background Verification:</strong> Your employment is subject to satisfactory verification of your past 
                    employment, education credentials and character references. All information provided by you during the selection process will be verified.
                </li>
            </ol>

            <p>
                <strong>Note:</strong> Please sign the copy of this letter as token of your acceptance and send the signed copy to 
                us along with the above-mentioned documents. In case you fail to do so, this offer letter shall not be allowed to join the organization.
            </p>

            <p>
                We are sure that you will enjoy working with us and we look forward to a long & mutually beneficial association. 
                We wish you all the very best in your new assignment and sincerely hope that you will contribute significantly to the 
                continued success of our organization.
            </p>

            <p>
                As a new entrant, we would like to advise – <em>fearlessly internalize and uphold the spirit of ${companyInfo.name?.split(' ')[0] || 'our company'}</em>.
            </p>

            <p>
                <strong>Stability, Integrity and Growth.</strong>
            </p>
        </div>

        <!-- Signature -->
        <div class="signature-section">
            <p>Yours Truly,</p>
            <p><strong>For ${companyInfo.name || 'Company Name'}</strong></p>
            <br><br>
            <p style="border-top: 1px solid #64748b; display: inline-block; padding-top: 5px;">
                <strong>Authorized Signatory</strong><br>
                <span style="font-size: 11px;">${companyInfo.signatoryName || 'HR Manager'}</span>
            </p>
        </div>

        <!-- Acceptance -->
        <div class="acceptance-section">
            <p><strong>Acceptance of Offer:</strong></p>
            <p style="margin: 10px 0;">
                I have read and understood all the terms and conditions as set forth in this offer letter and the annexure to 
                the same.
            </p>
            
            <div class="acceptance-grid">
                <div>
                    <p class="acceptance-label">Your name in capital letters</p>
                    <div class="acceptance-field">
                        <strong>${applicant.name?.toUpperCase()}</strong>
                    </div>
                </div>
                
                <div>
                    <p class="acceptance-label">Your Signature</p>
                    <div style="border-bottom:1px solid black; width:150px; margin-top: 40px;"></div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>${companyInfo.address || 'Company Address'}</p>
            <p>
                ${companyInfo.phone ? `Phone: ${companyInfo.phone} | ` : ''}
                ${companyInfo.email ? `Email: ${companyInfo.email} | ` : ''}
                ${companyInfo.website ? `Website: ${companyInfo.website}` : ''}
            </p>
            <p style="margin-top: 10px;">Page 1 of 1</p>
        </div>
    </div>
</body>
</html>
    `;
}

module.exports = { generateOfferLetterHTML };
