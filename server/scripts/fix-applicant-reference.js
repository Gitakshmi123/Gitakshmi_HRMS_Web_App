const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../controllers/letter.controller.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix line 1364: applicant -> target
content = content.replace(
    '        // Update Applicant\n        applicant.joiningLetterPath = finalRelativePath;\n\n        if (!applicant.timeline) applicant.timeline = [];\n        applicant.timeline.push({\n            status: \'Joining Letter Generated\',\n            message: \'Joining letter has been generated and is ready for download.\',\n            updatedBy: req.user?.name || "HR",\n            timestamp: new Date()\n        });\n\n        await applicant.save();',
    '        // Update Applicant/Employee\n        if (targetType === \'applicant\') {\n            target.joiningLetterPath = finalRelativePath;\n\n            if (!target.timeline) target.timeline = [];\n            target.timeline.push({\n                status: \'Joining Letter Generated\',\n                message: \'Joining letter has been generated and is ready for download.\',\n                updatedBy: req.user?.name || "HR",\n                timestamp: new Date()\n            });\n\n            await target.save();\n        }'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed: Changed applicant to target at line 1364');
