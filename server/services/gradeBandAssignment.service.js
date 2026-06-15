const mongoose = require('mongoose');

function getTenantId(reqOrTenant) {
  const value = reqOrTenant?.tenantId || reqOrTenant?.user?.tenantId || reqOrTenant?.user?.companyId || reqOrTenant;
  if (!mongoose.Types.ObjectId.isValid(String(value || ''))) {
    const err = new Error('Valid tenant context is required');
    err.statusCode = 400;
    err.code = 'tenant_missing';
    throw err;
  }
  return value;
}

function getUserId(req) {
  const id = req?.user?.id || req?.user?._id;
  return mongoose.Types.ObjectId.isValid(String(id || '')) ? id : null;
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function normalizeSalary(value) {
  const salary = Number(value || 0);
  if (!Number.isFinite(salary) || salary < 0) {
    const err = new Error('Salary must be a valid positive number');
    err.statusCode = 400;
    err.code = 'invalid_salary';
    throw err;
  }
  return salary;
}

function requireModel(models, name) {
  if (!models?.[name]) {
    const err = new Error(`${name} model is not available`);
    err.statusCode = 500;
    err.code = 'model_missing';
    throw err;
  }
  return models[name];
}

async function resolveDesignationGrade({ models, tenantId, departmentId, designationId }) {
  if (!isValidObjectId(departmentId) || !isValidObjectId(designationId)) {
    // If no valid department/designation is provided, simply return null instead of crashing, 
    // as the tenant might not be using the Grade Band feature or the employee may lack these fields.
    return null;
  }

  const DesignationGradeMap = requireModel(models, 'DesignationGradeMap');
  const mapping = await DesignationGradeMap.findOne({
    tenant: tenantId,
    departmentId,
    designationId,
    status: true,
  }).populate('gradeId', 'code name level isActive status')
    .populate('allowedBandIds', 'code name minSalary maxSalary payrollTemplateId bonusPercentage status')
    .lean();

  if (!mapping) {
    const err = new Error('No active grade mapping found for this department and designation');
    err.statusCode = 400;
    err.code = 'designation_grade_mapping_missing';
    throw err;
  }

  if (!mapping.gradeId || mapping.gradeId.isActive === false || mapping.gradeId.status === false) {
    const err = new Error('Mapped grade is inactive or unavailable');
    err.statusCode = 400;
    err.code = 'inactive_grade';
    throw err;
  }

  return mapping;
}

async function detectBandBySalary({ models, tenantId, salary, allowedBandIds = [] }) {
  const Band = requireModel(models, 'Band');
  const normalizedSalary = normalizeSalary(salary);
  const filter = {
    tenant: tenantId,
    minSalary: { $lte: normalizedSalary },
    maxSalary: { $gte: normalizedSalary },
    status: true,
  };

  const allowedIds = (allowedBandIds || []).map((item) => item?._id || item).filter(isValidObjectId);
  if (allowedIds.length > 0) {
    filter._id = { $in: allowedIds };
  }

  const band = await Band.findOne(filter)
    .populate('payrollTemplateId', 'templateName name annualCTC monthlyCTC isActive')
    .sort({ minSalary: -1 })
    .lean();

  if (!band) {
    const err = new Error(
      allowedIds.length > 0
        ? 'Salary does not match any allowed band for this designation'
        : 'Salary does not match any active band'
    );
    err.statusCode = 400;
    err.code = 'band_not_found_for_salary';
    throw err;
  }

  return band;
}

async function resolveAssignment({ models, tenantId, departmentId, designationId, salary }) {
  const mapping = await resolveDesignationGrade({ models, tenantId, departmentId, designationId });
  const band = salary !== undefined && salary !== null && salary !== ''
    ? await detectBandBySalary({
      models,
      tenantId,
      salary,
      allowedBandIds: mapping?.allowedBandIds || [],
    })
    : null;

  return {
    mapping,
    grade: mapping?.gradeId || null,
    band,
    payrollTemplate: band?.payrollTemplateId || null,
    salaryRange: band ? { minSalary: band.minSalary, maxSalary: band.maxSalary } : null,
  };
}

function applyAssignmentToPayload(payload, assignment, { allowGradeOverride = false, allowBandOverride = false } = {}) {
  if (!payload || !assignment) return payload;

  if (assignment.grade && (!allowGradeOverride || !payload.gradeId)) {
    payload.gradeId = assignment.grade._id || assignment.grade;
    payload.grade = assignment.grade.name || assignment.grade.code || payload.grade;
  }

  if (assignment.band && (!allowBandOverride || !payload.bandId)) {
    payload.bandId = assignment.band._id || assignment.band;
    payload.band = assignment.band.code || assignment.band.name || payload.band;
    payload.payrollTemplateId = assignment.band.payrollTemplateId?._id || assignment.band.payrollTemplateId || null;
    payload.salaryTemplateId = payload.payrollTemplateId;
  }

  return payload;
}

async function writeAudit({ models, tenantId, entityId, action, before, after, performedBy, meta }) {
  const AuditLog = models?.AuditLog;
  if (!AuditLog || !entityId) return;
  try {
    await AuditLog.create({
      tenant: tenantId,
      entity: 'EmployeeGradeBand',
      entityId,
      action,
      performedBy: performedBy || null,
      changes: { before, after },
      meta,
    });
  } catch (err) {
    console.warn('[GRADE_BAND_AUDIT] Audit skipped:', err.message);
  }
}

async function promoteEmployee({ models, tenantId, employeeId, designationId, departmentId, salary, effectiveDate, reason, req }) {
  const Employee = requireModel(models, 'Employee');
  const PromotionHistory = requireModel(models, 'PromotionHistory');
  const employee = await Employee.findOne({ _id: employeeId, mainCompanyId: tenantId });
  if (!employee) {
    const err = new Error('Employee not found');
    err.statusCode = 404;
    err.code = 'employee_not_found';
    throw err;
  }

  const before = {
    designationId: employee.designationId || null,
    gradeId: employee.gradeId || null,
    bandId: employee.bandId || null,
    salary: employee.salary || 0,
    payrollTemplateId: employee.payrollTemplateId || employee.salaryTemplateId || null,
  };

  const assignment = await resolveAssignment({
    models,
    tenantId,
    departmentId: departmentId || employee.departmentId,
    designationId,
    salary,
  });

  employee.designationId = designationId;
  employee.departmentId = departmentId || employee.departmentId;
  employee.salary = normalizeSalary(salary);
  applyAssignmentToPayload(employee, assignment);
  employee.lastPromotionDate = effectiveDate ? new Date(effectiveDate) : new Date();
  employee.lastRevisionDate = employee.lastPromotionDate;
  await employee.save();

  const after = {
    designationId: employee.designationId || null,
    gradeId: employee.gradeId || null,
    bandId: employee.bandId || null,
    salary: employee.salary || 0,
    payrollTemplateId: employee.payrollTemplateId || employee.salaryTemplateId || null,
  };

  const history = await PromotionHistory.create({
    tenant: tenantId,
    employeeId: employee._id,
    effectiveDate: employee.lastPromotionDate,
    reason: reason || '',
    previous: before,
    next: after,
    changedBy: getUserId(req),
  });

  await writeAudit({
    models,
    tenantId,
    entityId: employee._id,
    action: 'PROMOTION_UPDATED',
    before,
    after,
    performedBy: getUserId(req),
    meta: { promotionHistoryId: history._id },
  });

  return { employee, history, assignment };
}

module.exports = {
  getTenantId,
  getUserId,
  normalizeSalary,
  resolveDesignationGrade,
  detectBandBySalary,
  resolveAssignment,
  applyAssignmentToPayload,
  promoteEmployee,
  writeAudit,
};
