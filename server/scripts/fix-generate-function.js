const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../controllers/letter.controller.js');

// Read file
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the problematic section
const oldCode = `        // NEW: Check for embedded snapshot first (Applicant 2.0 flow)
        let snapshot = null;
        if (targetType === 'applicant' && target.salarySnapshot) {
            console.log('[JOINING LETTER] Using embedded salarySnapshot from Applicant');
            snapshot = target.salarySnapshot.breakdown || target.salarySnapshot;
        }

        if (!snapshot) {
            const query = employeeId ? { employee: employeeId } : { applicant: applicantId };
            snapshot = await EmployeeSalarySnapshot.findOne(query).sort({ createdAt: -1 }).lean();
        }`;

const newCode = `        // ALWAYS fetch from database - embedded snapshots may be incomplete
        console.log('🔍 [JOINING LETTER] Fetching snapshot from database...');
        const query = employeeId ? { employee: employeeId } : { applicant: applicantId };
        let snapshot = await EmployeeSalarySnapshot.findOne(query).sort({ createdAt: -1 }).lean();
        
        if (snapshot) {
            console.log('✅ [JOINING LETTER] Found DB Snapshot:', {
                id: snapshot._id,
                locked: snapshot.locked,
                earningsCount: (snapshot.earnings || []).length,
                deductionsCount: (snapshot.employeeDeductions || []).length,
                benefitsCount: (snapshot.benefits || []).length,
                ctc: snapshot.ctc
            });
        }`;

// Replace
if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Successfully fixed generateJoiningLetter function!');
    console.log('✅ Backend will auto-restart with nodemon');
} else {
    console.log('❌ Could not find the code to replace');
    console.log('The code might have already been changed or is different than expected');
}
