const mongoose = require('mongoose');

function isValidObjectId(value) {
  return Boolean(value && mongoose.Types.ObjectId.isValid(String(value)));
}

function toObjectId(value) {
  return isValidObjectId(value) ? new mongoose.Types.ObjectId(String(value)) : null;
}

function normalizeOrgText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniq(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function tenantScope(tenantId) {
  const scopedId = toObjectId(tenantId) || tenantId;
  return {
    $or: [
      { mainCompanyId: scopedId },
      { tenant: scopedId },
      { tenantId: scopedId },
      { companyId: scopedId },
    ],
  };
}

function scopedFilter(tenantId, extra = {}) {
  return {
    ...extra,
    ...tenantScope(tenantId),
    isDeleted: { $ne: true },
    isActive: { $ne: false },
  };
}

function modelOrNull(models, name) {
  try {
    return models?.[name] || null;
  } catch (_) {
    return null;
  }
}

async function findScopedById(Model, tenantId, id) {
  const objectId = toObjectId(id);
  if (!Model || !objectId) return null;
  return Model.findOne(scopedFilter(tenantId, { _id: objectId })).lean().catch(() => null);
}

function departmentValues(department) {
  return uniq([
    department?.name,
    department?.departmentName,
    department?.code,
    department?.departmentCode,
    department?.entityCode,
  ]);
}

function designationValues(designation) {
  return uniq([
    designation?.title,
    designation?.name,
    designation?.designationName,
    designation?.code,
    designation?.designationCode,
    designation?.entityCode,
  ]);
}

function hasTextMatch(needles, haystacks, { allowContains = true } = {}) {
  const normalizedNeedles = uniq(needles).map(normalizeOrgText).filter(Boolean);
  const normalizedHaystacks = uniq(haystacks).map(normalizeOrgText).filter(Boolean);
  if (normalizedNeedles.length === 0 || normalizedHaystacks.length === 0) return false;

  for (const needle of normalizedNeedles) {
    for (const haystack of normalizedHaystacks) {
      if (needle === haystack) return true;
    }
  }

  if (!allowContains) return false;
  for (const needle of normalizedNeedles) {
    for (const haystack of normalizedHaystacks) {
      if (needle.length >= 4 && haystack.length >= 4 && (needle.includes(haystack) || haystack.includes(needle))) {
        return true;
      }
    }
  }

  return false;
}

async function findDepartmentByText(Department, tenantId, desiredValues) {
  if (!Department) return null;
  const values = uniq(desiredValues);
  if (values.length === 0) return null;

  const candidates = await Department.find(scopedFilter(tenantId))
    .select('_id name departmentName code departmentCode entityCode mainCompanyId subCompanyId branchId divisionId headEmployeeId departmentHeadId')
    .limit(500)
    .lean()
    .catch(() => []);

  return candidates.find((department) => hasTextMatch(values, departmentValues(department), { allowContains: false }))
    || candidates.find((department) => hasTextMatch(values, departmentValues(department), { allowContains: true }))
    || null;
}

async function findDesignationByText(Designation, tenantId, desiredValues, departmentId = null) {
  if (!Designation) return null;
  const values = uniq(desiredValues);
  if (values.length === 0) return null;

  const baseFilter = scopedFilter(tenantId, departmentId ? { departmentId } : {});
  const candidates = await Designation.find(baseFilter)
    .select('_id name title designationName code designationCode entityCode mainCompanyId subCompanyId branchId divisionId departmentId')
    .limit(500)
    .lean()
    .catch(() => []);

  return candidates.find((designation) => hasTextMatch(values, designationValues(designation), { allowContains: false }))
    || candidates.find((designation) => hasTextMatch(values, designationValues(designation), { allowContains: true }))
    || null;
}

function firstValidId(...values) {
  return values.find((value) => isValidObjectId(value)) || null;
}

function docTitle(doc) {
  return doc?.title || doc?.name || doc?.designationName || '';
}

async function resolveOrgAssignment({
  models,
  tenantId,
  subCompanyId,
  branchId,
  divisionId,
  departmentId,
  designationId,
  department,
  designation,
  jobTitle,
  managerId,
  reportingManagerId,
  hiringManager,
  reportingTo,
} = {}) {
  const Department = modelOrNull(models, 'Department');
  const Designation = modelOrNull(models, 'Designation');

  let departmentDoc = await findScopedById(Department, tenantId, departmentId);
  let designationDoc = await findScopedById(Designation, tenantId, designationId);

  if (!departmentDoc) {
    departmentDoc = await findDepartmentByText(Department, tenantId, [department]);
  }

  if (!designationDoc) {
    designationDoc = await findDesignationByText(
      Designation,
      tenantId,
      [designation, jobTitle],
      departmentDoc?._id || null
    );
  }

  if (!designationDoc) {
    designationDoc = await findDesignationByText(Designation, tenantId, [designation, jobTitle], null);
  }

  if (designationDoc?.departmentId && !departmentDoc) {
    departmentDoc = await findScopedById(Department, tenantId, designationDoc.departmentId);
  }

  const scopeSource = designationDoc || departmentDoc || {};
  const resolvedManagerId = firstValidId(managerId, reportingManagerId, hiringManager, reportingTo);

  return {
    mainCompanyId: toObjectId(tenantId) || tenantId,
    subCompanyId: toObjectId(subCompanyId) || scopeSource.subCompanyId || departmentDoc?.subCompanyId || null,
    branchId: toObjectId(branchId) || scopeSource.branchId || departmentDoc?.branchId || null,
    divisionId: toObjectId(divisionId) || scopeSource.divisionId || departmentDoc?.divisionId || null,
    departmentId: departmentDoc?._id || toObjectId(departmentId) || designationDoc?.departmentId || null,
    designationId: designationDoc?._id || toObjectId(designationId) || null,
    department: departmentDoc?.name || department || '',
    designation: docTitle(designationDoc) || designation || jobTitle || '',
    managerId: toObjectId(resolvedManagerId) || null,
    departmentHeadId: departmentDoc?.departmentHeadId || departmentDoc?.headEmployeeId || null,
  };
}

async function syncUserOrgFromEmployee({ models, tenantId, employee }) {
  const User = modelOrNull(models, 'User');
  if (!User || !employee?.email) return null;

  const mainCompanyId = employee.mainCompanyId || toObjectId(tenantId) || tenantId;
  return User.findOneAndUpdate(
    {
      ...tenantScope(mainCompanyId),
      email: { $regex: new RegExp(`^${String(employee.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    },
    {
      $set: {
        name: employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email,
        mainCompanyId,
        subCompanyId: employee.subCompanyId || null,
        branchId: employee.branchId || null,
        divisionId: employee.divisionId || null,
        departmentId: employee.departmentId || null,
        designationId: employee.designationId || null,
        employeeCode: employee.employeeCode || employee.employeeId || '',
        isActive: employee.isActive !== false,
      },
    },
    { new: true }
  ).catch(() => null);
}

module.exports = {
  isValidObjectId,
  normalizeOrgText,
  resolveOrgAssignment,
  syncUserOrgFromEmployee,
};
