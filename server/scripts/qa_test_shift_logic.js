const { 
    applyAttendanceRules, 
    evaluateLateAndEarly,
} = require('../services/attendanceRulesEngine');
const {
    calculateAttendance,
    buildAttendanceWindow
} = require('../services/shiftPolicyEngine');

// Mock Settings (Legacy rules)
const baseSettings = {
    shiftStartTime: "09:00",
    shiftEndTime: "18:00",
    graceTimeMinutes: 15,
    lateMarkThresholdMinutes: 30,
    punchMode: "multiple",
    advancedPolicy: {
        lateMarkRules: {
            enabled: true,
            lateMarksToHalfDay: 3
        },
        halfDayRules: {
            enabled: true
        }
    }
};

// Mock Shift Policy Config (New Engine)
const shiftConfig = {
    _id: "shift_123",
    startTime: "09:00",
    endTime: "18:00",
    graceMinutes: 15,
    lateThreshold: 30,
    workingHoursCfg: {
        halfDayThresholdHours: 4,
        fullDayThresholdHours: 8,
    },
    lateMarkRules: {
        enabled: true,
        allowedLateMinutesPerDay: 15,
        lateMarksToHalfDay: 3
    },
    earlyExitRules: {
        enabled: true,
        allowedEarlyMinutesPerDay: 0
    },
    overtimeCfg: {
        enabled: true,
        startAfterMinutes: 30
    }
};

function createPunchLog(timeStrArray, date = new Date()) {
    const logs = [];
    timeStrArray.forEach((t, i) => {
        const [h, m] = t.split(':').map(Number);
        const logTime = new Date(date);
        logTime.setHours(h, m, 0, 0);
        logs.push({
            type: i % 2 === 0 ? 'IN' : 'OUT',
            time: logTime
        });
    });
    return logs;
}

function calcWorkingHours(logs) {
    if (logs.length < 2) return 0;
    let totalMins = 0;
    let inTime = null;
    for (const log of logs) {
        if (log.type === 'IN') inTime = log.time;
        else if (log.type === 'OUT' && inTime) {
            totalMins += (log.time - inTime) / 60000;
            inTime = null;
        }
    }
    return totalMins / 60;
}

function runScenario(name, timeStrArray, accumulatedLateCount = 0) {
    const date = new Date();
    date.setHours(0,0,0,0);
    const logs = createPunchLog(timeStrArray, date);
    const workingHours = calcWorkingHours(logs);
    
    const shiftWindow = buildAttendanceWindow(shiftConfig, date);
    const shiftOutcome = calculateAttendance({
        shift: shiftConfig,
        window: shiftWindow,
        date: date,
        punchLogs: logs,
        accumulatedLateCount: accumulatedLateCount,
        accumulatedEarlyCount: 0,
    });

    console.log(`\n--- ${name} ---`);
    console.log(`Punches: ${timeStrArray.join(' -> ')}`);
    console.log(`Working Hours: ${workingHours.toFixed(2)} hrs`);
    console.log(`Status: ${shiftOutcome.status}`);
    console.log(`isLate: ${shiftOutcome.isLate} (Late Mins: ${shiftOutcome.lateMinutes})`);
    console.log(`isEarlyOut: ${shiftOutcome.isEarlyOut} (Early Mins: ${shiftOutcome.earlyExitMinutes})`);
    console.log(`Overtime Mins: ${shiftOutcome.overtimeMinutes}`);
}

try {
    console.log("Starting Shift Logic QA Testing...");

    // Scenario 1: Perfect Attendance
    runScenario("Scenario 1: Perfect Attendance", ["08:50", "18:05"]);

    // Scenario 2: Grace Period (Punch in at 09:10, Grace is 15m)
    runScenario("Scenario 2: Grace Period Late Punch", ["09:10", "18:00"]);

    // Scenario 3: Late Mark (Punch in at 09:45, past 30m threshold)
    runScenario("Scenario 3: Late Mark Punch", ["09:45", "18:00"]);

    // Scenario 4: Half Day due to extreme late punch
    runScenario("Scenario 4: Half Day (Working less than 4 hrs)", ["14:15", "18:00"]);

    // Scenario 5: Early Out
    runScenario("Scenario 5: Early Out Punch", ["09:00", "17:00"]);

    // Scenario 6: Overtime (More than 8 hours + 30m OT start threshold)
    runScenario("Scenario 6: Overtime Punch", ["09:00", "19:30"]);

    // Scenario 7: Night Shift Simulation (mocking shiftConfig)
    const nightShiftConfig = { ...shiftConfig, startTime: "22:00", endTime: "06:00", isNightShift: true };
    const nightDate = new Date();
    nightDate.setHours(0,0,0,0);
    const nWindow = buildAttendanceWindow(nightShiftConfig, nightDate);
    
    const nLogs = [];
    const inTime = new Date(nightDate); inTime.setHours(21, 50, 0, 0);
    const outTime = new Date(nightDate); outTime.setDate(outTime.getDate() + 1); outTime.setHours(6, 10, 0, 0);
    nLogs.push({ type: 'IN', time: inTime });
    nLogs.push({ type: 'OUT', time: outTime });
    
    const nOutcome = calculateAttendance({
        shift: nightShiftConfig,
        window: nWindow,
        date: nightDate,
        punchLogs: nLogs,
        accumulatedLateCount: 0,
        accumulatedEarlyCount: 0,
    });
    console.log(`\n--- Scenario 7: Night Shift (22:00 to 06:00) ---`);
    console.log(`Punches: 21:50 -> 06:10 (Next Day)`);
    console.log(`Status: ${nOutcome.status}`);
    console.log(`isLate: ${nOutcome.isLate}`);

} catch (e) {
    console.error("Test Error:", e);
}
