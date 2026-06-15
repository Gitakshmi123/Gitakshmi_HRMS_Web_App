const mongoose = require('mongoose');

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const clone = (value) => JSON.parse(JSON.stringify(value || {}));

const numberOr = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeTimingType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'flexible' ? 'flexible' : 'fixed';
};

const validTimeOrNull = (value) => {
  const normalized = String(value || '').trim();
  return TIME_PATTERN.test(normalized) ? normalized : null;
};

const addMinutesToHHMM = (time, minutes) => {
  const normalized = validTimeOrNull(time);
  if (!normalized) return null;
  const [hours, mins] = normalized.split(':').map(Number);
  const total = Math.max(0, Math.min(1439, (hours * 60) + mins + numberOr(minutes, 0)));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

function isGradeEffective(grade, date = new Date()) {
  if (!grade || grade.isDeleted || grade.isActive === false) return false;
  const target = new Date(date);
  if (grade.effectiveFrom && new Date(grade.effectiveFrom) > target) return false;
  if (grade.effectiveTo && new Date(grade.effectiveTo) < target) return false;
  return true;
}

async function fetchEmployeeGrade({ employee, Grade, tenantId, date = new Date() }) {
  if (!employee || !Grade) return null;

  if (employee.gradeId && mongoose.Types.ObjectId.isValid(String(employee.gradeId))) {
    const byId = await Grade.findOne({
      _id: employee.gradeId,
      tenant: tenantId,
      isDeleted: false,
      isActive: true,
      $and: [
        { $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: date } }, { effectiveFrom: { $exists: false } }] },
        { $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }, { effectiveTo: { $exists: false } }] },
      ],
    }).lean();
    if (byId) return byId;
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

function buildGradeAttendanceSettings(baseSettings, grade) {
  const settings = clone(baseSettings);
  const rules = grade?.attendanceRules || {};

  if (!isGradeEffective(grade) || !rules || Object.keys(rules).length === 0) {
    return {
      settings,
      grade: grade || null,
      timing: null,
      source: 'tenant',
    };
  }

  const timingType = normalizeTimingType(rules.timingType || rules.timingMode);
  const shiftStartTime = validTimeOrNull(rules.shiftStartTime || rules.startTime);
  const shiftEndTime = validTimeOrNull(rules.shiftEndTime || rules.endTime);
  const flexibleWindowStart = validTimeOrNull(rules.flexibleWindowStart || rules.flexStartTime || shiftStartTime);
  const flexibleWindowEnd = validTimeOrNull(rules.flexibleWindowEnd || rules.latestCheckInTime);
  const workingHoursPerDay = numberOr(rules.workingHoursPerDay, null);
  const requiredWorkMinutes = numberOr(rules.requiredWorkMinutes, workingHoursPerDay !== null ? workingHoursPerDay * 60 : null);

  if (shiftStartTime) settings.shiftStartTime = shiftStartTime;
  if (shiftEndTime) settings.shiftEndTime = shiftEndTime;
  if (rules.graceLateMinutes !== undefined) settings.graceTimeMinutes = numberOr(rules.graceLateMinutes, settings.graceTimeMinutes);
  if (rules.halfDayThresholdHours !== undefined) settings.halfDayThresholdHours = numberOr(rules.halfDayThresholdHours, settings.halfDayThresholdHours);
  if (rules.fullDayThresholdHours !== undefined) settings.fullDayThresholdHours = numberOr(rules.fullDayThresholdHours, settings.fullDayThresholdHours);
  if (Array.isArray(rules.weeklyOffDays)) settings.weeklyOffDays = rules.weeklyOffDays;
  if (rules.autoMarkAbsentOnNoPunch !== undefined) settings.autoAbsent = !!rules.autoMarkAbsentOnNoPunch;
  if (rules.overtimeEligible !== undefined) settings.overtimeAllowed = !!rules.overtimeEligible;

  settings.advancedPolicy = settings.advancedPolicy || {};
  settings.advancedPolicy.gradeTiming = {
    enabled: true,
    gradeId: grade._id,
    gradeCode: grade.code || '',
    timingType,
    shiftStartTime: shiftStartTime || settings.shiftStartTime,
    shiftEndTime: shiftEndTime || settings.shiftEndTime,
    flexibleWindowStart: flexibleWindowStart || settings.shiftStartTime,
    flexibleWindowEnd: flexibleWindowEnd || addMinutesToHHMM(flexibleWindowStart || settings.shiftStartTime, settings.graceTimeMinutes || 0),
    requiredWorkMinutes: requiredWorkMinutes !== null ? requiredWorkMinutes : numberOr(settings.fullDayThresholdHours, 7) * 60,
  };

  settings.advancedPolicy.lateMarkRules = {
    ...(settings.advancedPolicy.lateMarkRules || {}),
    enabled: rules.lateMarkEnabled !== undefined ? !!rules.lateMarkEnabled : true,
    allowedLateMinutesPerDay: numberOr(rules.allowedLateMinutesPerDay, numberOr(rules.graceLateMinutes, settings.graceTimeMinutes || 0)),
    lateMarksToHalfDay: numberOr(rules.lateMarksToHalfDay, settings.advancedPolicy.lateMarkRules?.lateMarksToHalfDay || 0),
    lateMarksToFullDay: numberOr(rules.lateMarksToFullDay, settings.advancedPolicy.lateMarkRules?.lateMarksToFullDay || 0),
    autoLeaveDeductionEnabled: !!rules.autoLeaveDeductionEnabled,
  };

  settings.advancedPolicy.earlyExitRules = {
    ...(settings.advancedPolicy.earlyExitRules || {}),
    enabled: rules.earlyExitEnabled !== undefined ? !!rules.earlyExitEnabled : true,
    allowedEarlyMinutesPerDay: numberOr(rules.graceEarlyMinutes, settings.advancedPolicy.earlyExitRules?.allowedEarlyMinutesPerDay || 0),
    earlyExitsToHalfDay: numberOr(rules.earlyExitsToHalfDay, settings.advancedPolicy.earlyExitRules?.earlyExitsToHalfDay || 0),
    earlyExitsToFullDay: numberOr(rules.earlyExitsToFullDay, settings.advancedPolicy.earlyExitRules?.earlyExitsToFullDay || 0),
  };

  settings.advancedPolicy.absentRules = {
    ...(settings.advancedPolicy.absentRules || {}),
    noPunchConsideredAbsent: rules.autoMarkAbsentOnNoPunch !== undefined ? !!rules.autoMarkAbsentOnNoPunch : true,
  };

  if (Array.isArray(rules.leaveDeductionOrder)) {
    settings.advancedPolicy.leaveIntegration = {
      ...(settings.advancedPolicy.leaveIntegration || {}),
      autoLeaveDeductionOrder: rules.leaveDeductionOrder,
    };
  }

  return {
    settings,
    grade,
    timing: settings.advancedPolicy.gradeTiming,
    source: 'grade',
  };
}

module.exports = {
  buildGradeAttendanceSettings,
  fetchEmployeeGrade,
  isGradeEffective,
  normalizeTimingType,
};
