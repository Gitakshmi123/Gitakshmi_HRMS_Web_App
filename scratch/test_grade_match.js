


// Mock services
function normalizeGradeCode(value) {
    return String(value || '').trim().toUpperCase();
}

function objectIdEquals(first, second) {
    if (!first || !second) return false;
    return String(first) === String(second);
}

function getEmployeeGradeIdentity(employee = {}, grade = null) {
    const gradeDoc = grade || (employee.gradeId && typeof employee.gradeId === 'object' ? employee.gradeId : null);
    return {
        gradeId: gradeDoc?._id || employee.gradeId || null,
        gradeCode: normalizeGradeCode(gradeDoc?.code || employee.grade),
        gradeName: String(gradeDoc?.name || employee.grade || '').trim(),
    };
}

function isPolicyGradeMatch(policy, employee, grade = null) {
    if (policy?.applicableTo !== 'Grade') return false;
    const identity = getEmployeeGradeIdentity(employee, grade);
    const gradeIds = Array.isArray(policy.gradeIds) ? policy.gradeIds : [];
    const gradeCodes = Array.isArray(policy.gradeCodes) ? policy.gradeCodes.map(normalizeGradeCode) : [];

    console.log('--- isPolicyGradeMatch Debug ---');
    console.log('Employee Grade ID:', identity.gradeId);
    console.log('Employee Grade Code:', identity.gradeCode);
    console.log('Policy Grade IDs:', gradeIds);
    console.log('Policy Grade Codes:', gradeCodes);

    if (identity.gradeId && gradeIds.some((gradeId) => objectIdEquals(gradeId, identity.gradeId))) {
        console.log('Match found by Grade ID');
        return true;
    }

    const match = !!identity.gradeCode && gradeCodes.includes(identity.gradeCode);
    console.log('Match found by Grade Code:', match);
    return match;
}

function isPolicyApplicableToEmployee(policy, employee, resolvedGrade = null) {
    if (!policy || !employee) return false;
    if (policy.applicableTo === 'All') return true;
    if (policy.applicableTo === 'Grade') {
        return isPolicyGradeMatch(policy, employee, resolvedGrade);
    }
    return false;
}

// Test Data
const employee = {
    _id: 'emp123',
    grade: 'Grade 1',
    gradeId: null, // As we saw in the update logic
    band: 'Band A'
};

const policy = {
    _id: 'pol456',
    name: 'Grade 1 Policy',
    applicableTo: 'Grade',
    gradeIds: [],
    gradeCodes: ['Grade 1']
};

console.log('Running test for Grade 1 matching...');
const result = isPolicyApplicableToEmployee(policy, employee);
console.log('Final Result:', result);
