const mongoose = require('mongoose');

const QUOTA_FIELDS = [
  'totalPerYear',
  'monthlyAccrual',
  'accrualType',
  'monthlyAccrualRate',
  'carryForwardAllowed',
  'maxCarryForward',
  'maxLeaveCap',
  'expiryMonths',
  'encashmentAllowed',
  'requiresApproval',
  'allowDuringProbation',
  'minimumTenureMonths',
  'prorateForNewJoiners',
  'color',
];

function normalizeLeaveType(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeGradeCode(value) {
  // Strip all whitespace and convert to uppercase for robust matching
  return String(value || '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/^GRAD(?=\d)/, 'GRADE');
}

function objectIdEquals(first, second) {
  if (!first || !second) return false;
  return String(first) === String(second);
}

function getEmployeeGradeIdentity(employee = {}, grade = null) {
  const gradeDoc = grade || (employee.gradeId && typeof employee.gradeId === 'object' ? employee.gradeId : null);
  const gradeCode = normalizeGradeCode(gradeDoc?.code || '');
  const gradeName = String(gradeDoc?.name || employee.grade || '').trim();
  const legacyGrade = String(employee.grade || '').trim();
  return {
    gradeId: gradeDoc?._id || employee.gradeId || null,
    gradeCode: gradeCode || normalizeGradeCode(legacyGrade),
    gradeName,
    gradeAliases: Array.from(new Set([
      gradeCode,
      normalizeGradeCode(gradeName),
      normalizeGradeCode(legacyGrade),
    ].filter(Boolean))),
  };
}

function isPolicyGradeMatch(policy, employee, grade = null) {
  if (policy?.applicableTo !== 'Grade') return false;
  const identity = getEmployeeGradeIdentity(employee, grade);
  const gradeIds = Array.isArray(policy.gradeIds) ? policy.gradeIds : [];
  const gradeCodes = Array.isArray(policy.gradeCodes) ? policy.gradeCodes.map(normalizeGradeCode) : [];

  console.log('--- isPolicyGradeMatch Debug ---');
  console.log(`Employee: ${employee.firstName} ${employee.lastName} (${employee._id})`);
  console.log(`Identity GradeID: ${identity.gradeId}`);
  console.log(`Identity GradeCode: ${identity.gradeCode}`);
  console.log(`Policy GradeIDs: ${JSON.stringify(gradeIds)}`);
  console.log(`Policy GradeCodes: ${JSON.stringify(gradeCodes)}`);

  if (identity.gradeId && gradeIds.some((gradeId) => objectIdEquals(gradeId, identity.gradeId))) {
    console.log('Match found by Grade ID');
    return true;
  }

  const codeMatch = identity.gradeAliases.some((alias) => gradeCodes.includes(alias));
  console.log(`Match found by Grade Code: ${codeMatch}`);
  return codeMatch;
}

function isGradeEffective(grade, date = new Date()) {
  if (!grade || grade.isDeleted || grade.isActive === false) return false;
  const targetDate = new Date(date);
  if (grade.effectiveFrom && new Date(grade.effectiveFrom) > targetDate) return false;
  if (grade.effectiveTo && new Date(grade.effectiveTo) < targetDate) return false;
  return true;
}

async function resolveEmployeeGrade({ employee, Grade, tenantId, date = new Date() }) {
  if (!employee || !Grade) return null;

  const populatedGrade = employee.gradeId && typeof employee.gradeId === 'object' ? employee.gradeId : null;
  if (isGradeEffective(populatedGrade, date)) return populatedGrade;

  if (employee.gradeId && mongoose.Types.ObjectId.isValid(String(employee.gradeId))) {
    const grade = await Grade.findOne({
      _id: employee.gradeId,
      tenant: tenantId,
      isDeleted: false,
      isActive: true,
      $and: [
        { $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: date } }, { effectiveFrom: { $exists: false } }] },
        { $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }, { effectiveTo: { $exists: false } }] },
      ],
    }).lean();
    if (grade) return grade;
  }

  const gradeCodeOrName = String(employee.grade || '').trim();
  if (!gradeCodeOrName) return null;

  const escaped = gradeCodeOrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Grade.findOne({
    tenant: tenantId,
    isDeleted: false,
    isActive: true,
    $or: [
      { code: new RegExp(`^${escaped}$`, 'i') },
      { name: new RegExp(`^${escaped}$`, 'i') },
      { normalizedName: gradeCodeOrName.toLowerCase() },
    ],
    $and: [
      { $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: date } }, { effectiveFrom: { $exists: false } }] },
      { $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }, { effectiveTo: { $exists: false } }] },
    ],
  }).lean();
}

function getMatchingGradeOverride(rule = {}, employee = {}, grade = null) {
  const overrides = Array.isArray(rule.gradeOverrides) ? rule.gradeOverrides : [];
  if (!overrides.length) return null;

  const identity = getEmployeeGradeIdentity(employee, grade);
  return overrides.find((override) => {
    if (identity.gradeId && override.gradeId && objectIdEquals(override.gradeId, identity.gradeId)) {
      return true;
    }
    return !!identity.gradeCode && normalizeGradeCode(override.gradeCode) === identity.gradeCode;
  }) || null;
}

function getMatchingGradeLeaveRule(grade = null, leaveType) {
  const leaveRules = Array.isArray(grade?.leaveRules) ? grade.leaveRules : [];
  const targetLeaveType = normalizeLeaveType(leaveType);
  return leaveRules.find((rule) => normalizeLeaveType(rule.leaveType) === targetLeaveType) || null;
}

function toPlainRuleObject(value = {}) {
  if (!value) return {};
  if (typeof value.toObject === 'function') {
    return value.toObject();
  }
  if (typeof value.toJSON === 'function') {
    return value.toJSON();
  }
  return { ...value };
}

function mergeQuotaFields(baseRule = {}, ...overrides) {
  const normalizedBaseRule = toPlainRuleObject(baseRule);
  const result = { ...normalizedBaseRule };
  for (const override of overrides) {
    if (!override) continue;
    const normalizedOverride = toPlainRuleObject(override);
    for (const field of QUOTA_FIELDS) {
      if (normalizedOverride[field] !== undefined && normalizedOverride[field] !== null && normalizedOverride[field] !== '') {
        result[field] = normalizedOverride[field];
      }
    }
  }
  result.leaveType = normalizeLeaveType(result.leaveType || normalizedBaseRule.leaveType);
  return result;
}

function resolveEffectiveRuleForGrade({ policy, rule, employee, grade }) {
  // Policy rules are the source of truth for HR-created leave policies.
  // Grade master leaveRules are only used to add missing leave types below; they should not
  // silently overwrite SL/CL/PL values entered on the policy form with grade defaults like 0.
  const policyOverride = getMatchingGradeOverride(rule, employee, grade);
  const effectiveRule = mergeQuotaFields(rule, policyOverride);

  return {
    rule: effectiveRule,
    source: policyOverride ? 'policy_grade_override' : 'policy_rule',
    gradeId: grade?._id || null,
    gradeCode: grade?.code || '',
  };
}

function resolvePolicyRulesForEmployee({ policy, employee, grade }) {
  const resolvedRules = (Array.isArray(policy?.rules) ? policy.rules : []).map((rule) =>
    resolveEffectiveRuleForGrade({ policy, rule, employee, grade }).rule
  );
  const existingTypes = new Set(resolvedRules.map((rule) => normalizeLeaveType(rule.leaveType)));

  if (policy?.applicableTo !== 'Grade') {
    return resolvedRules;
  }

  for (const gradeRule of Array.isArray(grade?.leaveRules) ? grade.leaveRules : []) {
    const leaveType = normalizeLeaveType(gradeRule.leaveType);
    if (!leaveType || existingTypes.has(leaveType)) continue;
    resolvedRules.push({
      leaveType,
      totalPerYear: gradeRule.totalPerYear || 0,
      monthlyAccrual: !!gradeRule.monthlyAccrual,
      accrualType: gradeRule.accrualType || 'yearly',
      monthlyAccrualRate: gradeRule.monthlyAccrualRate || 0,
      carryForwardAllowed: !!gradeRule.carryForwardAllowed,
      maxCarryForward: gradeRule.maxCarryForward || 0,
      maxLeaveCap: gradeRule.maxLeaveCap || 0,
      expiryMonths: gradeRule.expiryMonths || 0,
      encashmentAllowed: !!gradeRule.encashmentAllowed,
      requiresApproval: gradeRule.requiresApproval !== false,
      allowDuringProbation: !!gradeRule.allowDuringProbation,
      minimumTenureMonths: gradeRule.minimumTenureMonths || 0,
      prorateForNewJoiners: gradeRule.prorateForNewJoiners !== false,
      color: gradeRule.color || '#3b82f6',
    });
  }

  return resolvedRules;
}

module.exports = {
  getEmployeeGradeIdentity,
  isPolicyGradeMatch,
  normalizeLeaveType,
  resolveEffectiveRuleForGrade,
  resolveEmployeeGrade,
  resolvePolicyRulesForEmployee,
};
