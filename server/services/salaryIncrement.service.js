const canonicalPayroll = require('./canonicalPayroll.service');

const getModels = (tenantDB) => ({
    Employee: tenantDB.model('Employee'),
    EmployeeCtcVersion: tenantDB.model('EmployeeCtcVersion')
});

const calculateStatus = (effectiveFrom) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const effective = new Date(effectiveFrom);
    effective.setHours(0, 0, 0, 0);

    return effective > today ? 'SCHEDULED' : 'ACTIVE';
};

const validateSalaryBreakup = (totalCTC, grossA, grossB, grossC) => {
    const sum = (Math.round(grossA || 0) * 12) + Math.round(grossB || 0) + Math.round(grossC || 0);
    const tolerance = 5;

    if (Math.abs(sum - totalCTC) > tolerance) {
        throw new Error(`Invalid Breakup: (Gross A x 12) + Gross B + Gross C = ${sum}, but Total CTC is ${totalCTC}`);
    }

    return true;
};

const createIncrement = async (tenantDB, data) => {
    const {
        employeeId,
        effectiveFrom,
        totalCTC,
        grossA,
        grossB,
        grossC,
        components,
        incrementType = 'INCREMENT',
        reason,
        notes,
        createdBy,
        companyId
    } = data;

    validateSalaryBreakup(totalCTC, grossA, grossB, grossC);

    const { Employee, EmployeeCtcVersion } = getModels(tenantDB);
    const employee = await Employee.findById(employeeId).select('_id firstName lastName employeeId joiningDate').lean();

    if (!employee) {
        throw new Error('Employee not found');
    }

    const currentVersion = await canonicalPayroll.resolveEffectiveSalaryVersion(
        tenantDB,
        companyId,
        employeeId,
        new Date(),
        new Date()
    );

    const latestVersion = await EmployeeCtcVersion.findOne({
        companyId,
        employeeId
    }).sort({ version: -1 }).lean();

    const revisionType = ['INCREMENT', 'REVISION', 'PROMOTION', 'ADJUSTMENT'].includes(String(incrementType || '').toUpperCase())
        ? String(incrementType).toUpperCase()
        : 'REVISION';

    const newCtcVersion = await canonicalPayroll.createSalaryVersion(
        tenantDB,
        companyId,
        employeeId,
        {
            effectiveFrom,
            totalCTC,
            grossA,
            grossB,
            grossC,
            components: Array.isArray(components) ? components : [],
            closePrevious: true,
            source: 'MANUAL',
            revisionType,
            reason: reason || `${revisionType} recorded for ${employee.employeeId || 'employee'}`,
            notes
        },
        createdBy
    );

    const baselineCTC = currentVersion?.totalCTC ?? latestVersion?.totalCTC ?? 0;
    const absoluteChange = baselineCTC ? totalCTC - baselineCTC : totalCTC;
    const percentageChange = baselineCTC
        ? (((totalCTC / baselineCTC) - 1) * 100).toFixed(2)
        : '100.00';

    return {
        success: true,
        status: newCtcVersion.status,
        newCtcVersion,
        change: {
            absolute: absoluteChange,
            percentage: percentageChange
        }
    };
};

module.exports = {
    createIncrement,
    calculateStatus,
    validateSalaryBreakup
};
