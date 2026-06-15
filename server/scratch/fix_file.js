const fs = require('fs');
const filePath = 'c:/Users/baldaniya nitesh/Desktop/GT_HRMS/GT_HRMS/server/controllers/letter.controller.js';
let content = fs.readFileSync(filePath, 'utf8');

const searchRegex = /const \{ applicantId, employeeId, templateId, refNo, issueDate, signaturePosition, customData = \{\}, dateFormat = 'Do MMM\. YYYY' \} = req\.body;[\s\S]*?return res\.status\(400\)\.json\(\{ message: "Salary must be confirmed and locked before generating joining letter\." \}\);\s*\}/;

const replacement = `const { applicantId, employeeId, templateId, refNo, issueDate, signaturePosition, customData = {}, dateFormat = 'Do MMM. YYYY' } = req.body;
        const Applicant = getApplicantModel(req);
        const { Employee, LetterTemplate } = getModels(req);

        // Fetch target
        let target;
        let targetType;
        if (employeeId) {
            target = await Employee.findById(employeeId);
            targetType = 'employee';
        } else {
            target = await Applicant.findById(applicantId).populate('requirementId');
            targetType = 'applicant';
        }

        if (!target) {
            return res.status(404).json({ message: "Employee/Applicant not found" });
        }

        // Check if salary is finalized (unless Intern)
        if (!target.salaryLocked && target.jobCategory !== 'Intern') {
            console.error('🔥 [PREVIEW JOINING LETTER] Warning: Salary not locked for', targetType, target._id);
            // We still allow previewing for unlocked salaries to let HR see the template
        }`;

content = content.replace(searchRegex, replacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('File updated successfully.');
