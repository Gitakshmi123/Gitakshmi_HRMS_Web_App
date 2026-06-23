function cloneObject(value) {
    return JSON.parse(JSON.stringify(value || {}));
}

function normalizePunchMode(mode) {
    if (mode === 'multi') return 'multiple';
    if (mode === 'multiple') return 'multiple';
    return 'single';
}

function deriveLocationRestrictionMode(locationCfg = {}) {
    const hasGeo = !!locationCfg.geoFencingEnabled;
    const hasIp = !!locationCfg.ipRestrictionEnabled;
    if (hasGeo && hasIp) return 'both';
    if (hasGeo) return 'geo';
    if (hasIp) return 'ip';
    return 'none';
}

function buildEffectiveAttendanceSettings(baseSettings, shiftConfig) {
    const settings = cloneObject(baseSettings);
    if (!shiftConfig) {
        return settings;
    }

    const workingHoursCfg = shiftConfig.workingHoursCfg || {};
    const punchModeCfg = shiftConfig.punchMode || {};
    const overtimeCfg = shiftConfig.overtimeCfg || {};
    const locationCfg = shiftConfig.locationCfg || {};
    const absentCfg = shiftConfig.absentCfg || {};
    const weeklyOffCfg = shiftConfig.weeklyOffCfg || {};
    const lateMarkRules = shiftConfig.lateMarkRules || {};
    const earlyExitRules = shiftConfig.earlyExitRules || {};
    const halfDayRules = shiftConfig.halfDayRules || {};
    const leaveIntegration = shiftConfig.leaveIntegration || {};
    const wfhSettings = shiftConfig.wfhSettings || {};
    const odSettings = shiftConfig.odSettings || {};
    const compOffSettings = shiftConfig.compOffSettings || {};
    const nightShiftRules = shiftConfig.nightShiftRules || {};

    settings.shiftStartTime = shiftConfig.startTime ?? settings.shiftStartTime;
    settings.shiftEndTime = shiftConfig.endTime ?? settings.shiftEndTime;
    settings.graceTimeMinutes = workingHoursCfg.graceLateMinutes ?? shiftConfig.graceMinutes ?? settings.graceTimeMinutes;
    settings.lateMarkThresholdMinutes = shiftConfig.lateThreshold ?? settings.lateMarkThresholdMinutes;
    settings.halfDayThresholdHours = workingHoursCfg.halfDayThresholdHours ?? settings.halfDayThresholdHours;
    settings.fullDayThresholdHours = workingHoursCfg.fullDayThresholdHours ?? settings.fullDayThresholdHours;
    settings.weeklyOffDays = Array.isArray(weeklyOffCfg.days)
        ? weeklyOffCfg.days
        : (Array.isArray(shiftConfig.weeklyOffs) ? shiftConfig.weeklyOffs : settings.weeklyOffDays);
    settings.punchMode = normalizePunchMode(punchModeCfg.mode ?? settings.punchMode);
    settings.sandwichLeave = !!absentCfg.sandwichLeaveEnabled;

    const allowedIPs = Array.isArray(locationCfg.allowedIPs) ? locationCfg.allowedIPs : [];
    settings.geoFencingEnabled = !!locationCfg.geoFencingEnabled;
    settings.ipRestrictionEnabled = !!locationCfg.ipRestrictionEnabled;
    settings.officeLatitude = locationCfg.geoFenceLatitude ?? settings.officeLatitude;
    settings.officeLongitude = locationCfg.geoFenceLongitude ?? settings.officeLongitude;
    settings.allowedRadiusMeters = locationCfg.geoFenceRadiusMeters ?? settings.allowedRadiusMeters;
    settings.allowedIPs = allowedIPs;
    settings.locationRestrictionMode = deriveLocationRestrictionMode(locationCfg);

    settings.overtimeAllowed = !!overtimeCfg.enabled;
    settings.overtimeAfterShiftHours = !!overtimeCfg.enabled;

    settings.advancedPolicy = settings.advancedPolicy || {};
    settings.advancedPolicy.weeklyOff = {
        ...(settings.advancedPolicy.weeklyOff || {}),
        mode: weeklyOffCfg.mode || 'basic',
        saturdayHalfDayEnabled: weeklyOffCfg.saturdayMode === 'half_day',
        alternateSaturday: {
            ...((settings.advancedPolicy.weeklyOff || {}).alternateSaturday || {}),
            offWeeks: Array.isArray(weeklyOffCfg.alternateSaturdayOffWeeks) ? weeklyOffCfg.alternateSaturdayOffWeeks : [2, 4],
        },
    };
    settings.advancedPolicy.lateMarkRules = {
        ...(settings.advancedPolicy.lateMarkRules || {}),
        enabled: !!lateMarkRules.enabled,
        allowedLateMinutesPerDay: lateMarkRules.allowedLateMinutesPerDay ?? 0,
        lateMarksToHalfDay: lateMarkRules.lateMarksToHalfDay ?? 0,
        lateMarksToFullDay: lateMarkRules.lateMarksToFullDay ?? 0,
        autoLeaveDeductionEnabled: !!lateMarkRules.autoLeaveDeduction,
    };
    settings.advancedPolicy.earlyExitRules = {
        ...(settings.advancedPolicy.earlyExitRules || {}),
        enabled: !!earlyExitRules.enabled,
        allowedEarlyMinutesPerDay: earlyExitRules.allowedEarlyMinutesPerDay ?? 0,
        earlyExitsToHalfDay: earlyExitRules.earlyExitsToHalfDay ?? 0,
        earlyExitsToFullDay: earlyExitRules.earlyExitsToFullDay ?? 0,
    };
    settings.advancedPolicy.halfDayRules = {
        ...(settings.advancedPolicy.halfDayRules || {}),
        enabled: !!halfDayRules.enabled,
        workingHoursThreshold: halfDayRules.halfDayIfWorkedLessThanHours ?? 0,
        lateMinutesThreshold: halfDayRules.halfDayIfLateMoreThanMinutes ?? 0,
        saturdayHalfDayEnabled: weeklyOffCfg.saturdayMode === 'half_day',
    };
    settings.advancedPolicy.absentRules = {
        ...(settings.advancedPolicy.absentRules || {}),
        noPunchConsideredAbsent: !!absentCfg.autoMarkAbsentOnNoPunch,
        singlePunchBehaviour: halfDayRules.onlyInNoOutBehaviour === 'half_day' ? 'half_day' : 'absent',
        autoLeaveDeductionEnabled: !!leaveIntegration.autoLeaveDeductionEnabled,
        convertToLopWhenNoLeave: !!halfDayRules.convertToLOPIfNoLeave,
    };
    settings.advancedPolicy.leaveIntegration = {
        ...(settings.advancedPolicy.leaveIntegration || {}),
        autoLeaveDeductionOrder: Array.isArray(leaveIntegration.deductionPriority) ? leaveIntegration.deductionPriority : ['CL', 'SL', 'EL', 'Optional', 'LOP'],
        sandwichRuleEnabled: !!absentCfg.sandwichLeaveEnabled,
    };
    settings.advancedPolicy.wfhSettings = {
        ...(settings.advancedPolicy.wfhSettings || {}),
        enabled: !!wfhSettings.enabled,
        gpsRestrictionEnabled: !!wfhSettings.gpsValidationRequired,
        ipRestrictionEnabled: !!wfhSettings.ipRestrictionRequired,
        autoPresentMode: wfhSettings.autoPresentMode === 'half_day' ? 'half_day' : 'auto_present',
    };
    settings.advancedPolicy.odSettings = {
        ...(settings.advancedPolicy.odSettings || {}),
        enabled: !!odSettings.enabled,
        approvalRequired: !!odSettings.approvalRequired,
        countAsPresent: odSettings.countAsPresent !== false,
    };
    settings.advancedPolicy.compOffSettings = {
        ...(settings.advancedPolicy.compOffSettings || {}),
        enabled: !!compOffSettings.enabled,
        autoCreditOnHolidayWork: compOffSettings.autoCreditOnHolidayWork !== false,
        autoCreditOnWeeklyOffWork: compOffSettings.autoCreditOnWeeklyOffWork !== false,
        expiryDays: compOffSettings.expiryDays ?? 90,
    };
    settings.advancedPolicy.nightShiftRules = {
        ...(settings.advancedPolicy.nightShiftRules || {}),
        shiftSpansMidnight: !!shiftConfig.isNightShift,
        attendanceDateAsShiftStart: nightShiftRules.attendanceDateAsShiftStart !== false,
        overtimeSeparateForNightShift: !!nightShiftRules.separateOTForNight,
        nightShiftAllowanceEnabled: !!nightShiftRules.allowanceEnabled,
        nightShiftAllowanceCode: nightShiftRules.allowanceCode || '',
    };

    return settings;
}

function translateShiftPolicyToLegacyConfig(shiftMaster, shiftPolicy) {
    if (!shiftMaster) return null;

    const legacyConfig = {
        startTime: shiftMaster.coreTiming?.startTime,
        endTime: shiftMaster.coreTiming?.endTime,
        graceMinutes: shiftMaster.coreTiming?.graceMinutes,
        isNightShift: shiftMaster.isNightShift,
        punchMode: { mode: shiftMaster.punchMode || 'single' },
        
        workingHoursCfg: {
            halfDayThresholdHours: shiftPolicy?.attendanceRules?.absentThresholdMinutes ? (shiftPolicy.attendanceRules.absentThresholdMinutes / 60) : 4,
            fullDayThresholdHours: 8,
            graceLateMinutes: shiftMaster.coreTiming?.graceMinutes,
        },
        
        lateMarkRules: {
            enabled: shiftPolicy?.attendanceRules?.lateMarks?.length > 0 || shiftPolicy?.attendanceRules?.monthlyLateToHalfDayConversion > 0,
            allowedLateMinutesPerDay: shiftPolicy?.attendanceRules?.lateMarks?.[0]?.minutes || 0,
            lateMarksToHalfDay: (shiftPolicy?.attendanceRules?.monthlyLateAction === 'HALF_DAY') ? shiftPolicy.attendanceRules.monthlyLateToHalfDayConversion : 0,
            lateMarksToFullDay: (shiftPolicy?.attendanceRules?.monthlyLateAction === 'FULL_DAY' || shiftPolicy?.attendanceRules?.monthlyLateAction === 'LWP') ? shiftPolicy.attendanceRules.monthlyLateToHalfDayConversion : 0,
            autoLeaveDeduction: shiftPolicy?.attendanceRules?.monthlyLateAction === 'DEDUCT_LEAVE',
            leaveDeductionType: shiftPolicy?.attendanceRules?.monthlyLateLeaveDeductType || ''
        },
        
        earlyExitRules: {
            enabled: shiftPolicy?.attendanceRules?.earlyExit?.length > 0,
            allowedEarlyMinutesPerDay: shiftPolicy?.attendanceRules?.earlyExit?.[0]?.minutes || 0,
        },

        overtimeCfg: {
            enabled: !!shiftPolicy?.overtimeEngine?.isEligible,
            trackingEnabled: !!shiftPolicy?.overtimeEngine?.isEligible,
            startAfterMinutes: shiftPolicy?.overtimeEngine?.minimumMinutesToQualify || 30,
            multiplier: shiftPolicy?.overtimeEngine?.normalMultiplier || 1.0,
            compensationMode: 'MULTIPLIER', // Tell Phase 2 to use the multiplier
            earningLabel: 'Overtime Pay'
        },

        absentCfg: {
            autoMarkAbsentOnNoPunch: shiftPolicy?.attendanceRules?.absentCfg?.autoMarkAbsentOnNoPunch ?? true,
            sandwichLeaveEnabled: shiftPolicy?.attendanceRules?.absentCfg?.sandwichLeaveEnabled ?? false,
            sandwichWeekendFill: shiftPolicy?.attendanceRules?.absentCfg?.sandwichWeekendFill ?? false,
            sandwichHolidayFill: shiftPolicy?.attendanceRules?.absentCfg?.sandwichHolidayFill ?? false
        },

        locationCfg: {
            geoFencingEnabled: false,
            ipRestrictionEnabled: false
        }
    };

    return legacyConfig;
}

module.exports = {
    buildEffectiveAttendanceSettings,
    normalizePunchMode,
    translateShiftPolicyToLegacyConfig,
};
