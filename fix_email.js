const fs = require('fs');

let content = fs.readFileSync('server/services/email.service.js', 'utf8');

content = content.replace(
    'async sendOfferLetterEmail(to, candidateName, jobTitle, companyName, offerLetterPdfPath, options = {}) {',
    'async sendOfferLetterEmail(to, candidateName, jobTitle, companyName, offerLetterPdfPath, applicantId = null, options = {}) {'
);

content = content.replace(
    '<p style="margin: 0;">This is an automated email. Please do not reply.</p>\n                </div>\n            </div>',
    `<p style="margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
                \${applicantId ? \`<img src="\${process.env.BACKEND_URL || 'http://localhost:5000'}/api/public/offer/candidate-pixel/\${applicantId}.png" width="1" height="1" style="display:none;" />\` : ''}
            </div>`
);

fs.writeFileSync('server/services/email.service.js', content);
