import React, { useState, useEffect } from 'react';
import { notification } from '../../utils/antdGlobal';
import usePagePermissions from '../../hooks/usePagePermissions';
import { Eye } from 'lucide-react';
import api from '../../utils/api';
import {
    Save,
    Clock,
    Calendar,
    ToggleLeft,
    ToggleRight,
    ShieldCheck,
    MapPin,
    Globe,
    Lock,
    Plus,
    X,
    Settings2,
    Clock3,
    LogOut,
    UserCheck,
    Home,
    Briefcase,
    Gift,
    Cpu,
    Pencil,
    Trash2,
    Power,
    RefreshCw
} from 'lucide-react';


export default function AttendanceSettings({ onShiftFormChange }) {
    const { canEdit, canCreate } = usePagePermissions('attendance.settings');
    const hasEditAccess = canEdit || canCreate;
    const [shiftFormActive, setShiftFormActive] = useState(false);

    useEffect(() => {
        if (onShiftFormChange) onShiftFormChange(shiftFormActive);
    }, [shiftFormActive, onShiftFormChange]);
    const [settings, setSettings] = useState({
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        graceTimeMinutes: 15,
        lateMarkThresholdMinutes: 30,
        halfDayThresholdHours: 4,
        fullDayThresholdHours: 7,
        weeklyOffDays: [0],
        sandwichLeave: false,
        autoAbsent: true,
        attendanceLockDay: 25,
        // Punch Policy
        punchMode: 'single',
        maxPunchesPerDay: 10,
        maxPunchAction: 'block',
        breakTrackingEnabled: false,
        overtimeAllowed: false,
        overtimeAfterShiftHours: true,
        overtimeToPayroll: false,
        geoFencingEnabled: false,
        officeLatitude: null,
        officeLongitude: null,
        allowedRadiusMeters: 100,
        ipRestrictionEnabled: false,
        allowedIPs: [],
        allowedIPRanges: [],
        locationRestrictionMode: 'none',
        geofance: [],
        // Advanced Policy – keep structure in sync with backend schema
        advancedPolicy: {
            weeklyOff: {
                mode: 'basic',
                saturdayHalfDayEnabled: false,
                alternateSaturday: {
                    workingWeeks: [1, 3],
                    offWeeks: [2, 4]
                },
                employeeOverrides: []
            },
            lateMarkRules: {
                enabled: false,
                allowedLateMinutesPerDay: 0,
                lateMarksToHalfDay: 0,
                lateMarksToFullDay: 0,
                autoLeaveDeductionEnabled: false
            },
            earlyExitRules: {
                enabled: false,
                allowedEarlyMinutesPerDay: 0,
                earlyExitsToHalfDay: 0,
                earlyExitsToFullDay: 0
            },
            halfDayRules: {
                enabled: false,
                workingHoursThreshold: 0,
                lateMinutesThreshold: 0,
                saturdayHalfDayEnabled: false
            },
            absentRules: {
                noPunchConsideredAbsent: true,
                singlePunchBehaviour: 'half_day',
                autoLeaveDeductionEnabled: false,
                convertToLopWhenNoLeave: false
            },
            leaveIntegration: {
                autoLeaveDeductionOrder: ['CL', 'SL', 'EL', 'Optional', 'LOP'],
                sandwichRuleEnabled: false,
                wfhPresentMode: 'present'
            },
            wfhSettings: {
                enabled: false,
                gpsRestrictionEnabled: false,
                ipRestrictionEnabled: false,
                autoPresentMode: 'requires_approval'
            },
            odSettings: {
                enabled: false,
                approvalRequired: true,
                odCountMode: 'present'
            },
            compOffSettings: {
                enabled: false,
                autoCreditOnHolidayWork: false,
                expiryDays: 30,
                approvalRequired: true
            },
            deviceSettings: {
                allowedSources: [],
                faceRecognitionMandatory: false,
                webCheckinAllowed: true
            },
            manualCorrectionWorkflow: {
                enabled: true,
                requireManagerApproval: true,
                requireHrApproval: true
            },
            nightShiftRules: {
                enabled: false,
                shiftSpansMidnight: false,
                nightShiftAllowanceEnabled: false,
                nightShiftAllowanceCode: '',
                overtimeSeparateForNightShift: false
            }
        }
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/attendance/settings');
            if (res.data) setSettings(res.data);
        } catch (err) {
            console.error("Failed to load settings", err);
        }
    };

    const handleSave = async () => {
        if (!hasEditAccess) return notification.error({ message: 'Access Denied', description: 'You only have view access.', placement: 'topRight' });
        try {
            setSaving(true);
            await api.put('/attendance/settings', settings);
            notification.success({ message: 'Success', description: "Settings saved successfully!", placement: 'topRight' });
        } catch {
            notification.error({ message: 'Error', description: "Failed to save settings", placement: 'topRight' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`p-2.5 ${shiftFormActive ? 'space-y-0 -m-2.5 overflow-hidden' : 'space-y-8'} animate-in slide-in-from-bottom-5 duration-500`}>
            {/* ======================= SHIFT MANAGEMENT SECTION — TOP ======================= */}
            <ShiftsSection onStateChange={setShiftFormActive} hasEditAccess={hasEditAccess} />

            {!shiftFormActive && (
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${!hasEditAccess ? 'pointer-events-none opacity-80' : ''}`}>

                {/* Shift Configuration */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 overflow-hidden relative">
                    <div className="absolute top-0 right-0 h-32 w-32 bg-slate-50 dark:bg-slate-800/50 rounded-bl-full -mr-16 -mt-16 opacity-20"></div>

                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-3 mb-8">
                        <Clock className="text-slate-600" />
                        Shift & Grace Time
                    </h3>

                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Shift Start" type="time" value={settings.shiftStartTime} onChange={(e) => setSettings({ ...settings, shiftStartTime: e.target.value })} />
                            <InputGroup label="Shift End" type="time" value={settings.shiftEndTime} onChange={(e) => setSettings({ ...settings, shiftEndTime: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Grace Minutes" type="number" value={settings.graceTimeMinutes} onChange={(e) => setSettings({ ...settings, graceTimeMinutes: parseInt(e.target.value) })} />
                            <InputGroup label="Late Threshold" type="number" value={settings.lateMarkThresholdMinutes} onChange={(e) => setSettings({ ...settings, lateMarkThresholdMinutes: parseInt(e.target.value) })} />
                        </div>
                    </div>
                </div>

                {/* Threshold Configuration */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 overflow-hidden relative">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-3 mb-8">
                        <ShieldCheck className="text-slate-600" />
                        Presence Thresholds
                    </h3>

                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="HD Threshold (Hrs)" type="number" value={settings.halfDayThresholdHours} onChange={(e) => setSettings({ ...settings, halfDayThresholdHours: parseInt(e.target.value) })} />
                            <InputGroup label="P Threshold (Hrs)" type="number" value={settings.fullDayThresholdHours} onChange={(e) => setSettings({ ...settings, fullDayThresholdHours: parseInt(e.target.value) })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Monthly Lock Day" type="number" value={settings.attendanceLockDay} onChange={(e) => setSettings({ ...settings, attendanceLockDay: parseInt(e.target.value) })} />
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block px-1">Leave Cycle Start</label>
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all dark:text-white"
                                    value={settings.leaveCycleStartMonth || 0}
                                    onChange={(e) => setSettings({ ...settings, leaveCycleStartMonth: parseInt(e.target.value) })}
                                >
                                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, idx) => (
                                        <option key={month} value={idx}>{month}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Punch Mode Configuration */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 col-span-1 md:col-span-2">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-3 mb-8">
                        <Lock className="text-slate-600" />
                        Punch Mode Configuration
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Punch Mode</label>
                            <select
                                value={settings.punchMode}
                                onChange={(e) => setSettings({ ...settings, punchMode: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition"
                            >
                                <option value="single">Single Punch Mode (1 IN, 1 OUT per day)</option>
                                <option value="multiple">Multiple Punch Mode (Multiple IN/OUT for breaks)</option>
                            </select>
                        </div>

                        {settings.punchMode === 'multiple' && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup
                                        label="Max Punches Per Day"
                                        type="number"
                                        value={settings.maxPunchesPerDay}
                                        onChange={(e) => setSettings({ ...settings, maxPunchesPerDay: parseInt(e.target.value) })}
                                    />
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Action on Limit</label>
                                        <select
                                            value={settings.maxPunchAction}
                                            onChange={(e) => setSettings({ ...settings, maxPunchAction: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition"
                                        >
                                            <option value="block">Block Further Punches</option>
                                            <option value="warn">Show Warning (Allow)</option>
                                        </select>
                                    </div>
                                </div>
                            </>
                        )}

                        <ToggleItem
                            label="Break Tracking"
                            description="Deduct break time from working hours calculation"
                            active={settings.breakTrackingEnabled}
                            onClick={() => setSettings({ ...settings, breakTrackingEnabled: !settings.breakTrackingEnabled })}
                        />
                    </div>
                </div>

                {/* Overtime Configuration */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 col-span-1 md:col-span-2">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-3 mb-8">
                        <Clock className="text-slate-600" />
                        Overtime Configuration
                    </h3>

                    <div className="space-y-6">
                        <ToggleItem
                            label="Overtime Allowed"
                            description="Enable overtime tracking and calculation"
                            active={settings.overtimeAllowed}
                            onClick={() => setSettings({ ...settings, overtimeAllowed: !settings.overtimeAllowed })}
                        />

                        {settings.overtimeAllowed && (
                            <>
                                <ToggleItem
                                    label="Overtime After Shift Hours Only"
                                    description="Only count overtime after scheduled shift hours"
                                    active={settings.overtimeAfterShiftHours}
                                    onClick={() => setSettings({ ...settings, overtimeAfterShiftHours: !settings.overtimeAfterShiftHours })}
                                />
                                <ToggleItem
                                    label="Send Overtime to Payroll"
                                    description="Export overtime hours to payroll system"
                                    active={settings.overtimeToPayroll}
                                    onClick={() => setSettings({ ...settings, overtimeToPayroll: !settings.overtimeToPayroll })}
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* Location Restrictions */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 col-span-1 md:col-span-2">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-3 mb-8">
                        <MapPin className="text-slate-600" />
                        Location Restrictions
                    </h3>

                    <div className="space-y-6">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Location based restrictions (Geo / IP) are currently disabled for this tenant.
                            Use the advanced policy rules below to control attendance through working hours,
                            late marks, WFH and OD rules instead.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InputGroup
                                label="Full Day Threshold (Hrs)"
                                type="number"
                                value={settings.fullDayThresholdHours}
                                onChange={(e) => setSettings({ ...settings, fullDayThresholdHours: parseFloat(e.target.value || '0') })}
                            />
                            <InputGroup
                                label="Half Day Threshold (Hrs)"
                                type="number"
                                value={settings.halfDayThresholdHours}
                                onChange={(e) => setSettings({ ...settings, halfDayThresholdHours: parseFloat(e.target.value || '0') })}
                            />
                            <InputGroup
                                label="Grace Minutes"
                                type="number"
                                value={settings.graceTimeMinutes}
                                onChange={(e) => setSettings({ ...settings, graceTimeMinutes: parseInt(e.target.value || '0', 10) })}
                            />
                        </div>
                    </div>
                </div>

                {/* Policy Toggles */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 col-span-1 md:col-span-2">
                    <div className="flex flex-wrap gap-8">
                        <ToggleItem
                            label="Sandwich Leave Rules"
                            description="Apply leave to weekends between absences"
                            active={settings.sandwichLeave}
                            onClick={() => setSettings({ ...settings, sandwichLeave: !settings.sandwichLeave })}
                        />
                        <ToggleItem
                            label="Auto-Mark Absent"
                            description="Mark absent if no punch log exists"
                            active={settings.autoAbsent}
                            onClick={() => setSettings({ ...settings, autoAbsent: !settings.autoAbsent })}
                        />
                    </div>
                </div>

                {/* === ADVANCED ATTENDANCE POLICY SECTIONS (COLLAPSIBLE) === */}

                {/* Weekly Off & Half-Day Logic */}
                <CollapsibleCard
                    title="Weekly Off & Saturday Rules"
                    icon={<Calendar className="text-slate-600" />}
                    description="Configure weekly off combinations, alternate Saturdays, and Saturday half-day behavior"
                >
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Weekly Off Mode
                                </label>
                                <select
                                    value={settings.advancedPolicy?.weeklyOff?.mode || 'basic'}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            weeklyOff: {
                                                ...settings.advancedPolicy.weeklyOff,
                                                mode: e.target.value
                                            }
                                        }
                                    })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-slate-500 transition"
                                >
                                    <option value="basic">Use Weekly Off Days Only</option>
                                    <option value="sunday">Sunday Off</option>
                                    <option value="saturday_sunday">Saturday + Sunday Off</option>
                                    <option value="alternate_saturday">Alternate Saturday Off (1st &amp; 3rd Saturday Off)</option>
                                    <option value="alternate_saturday">Alternate Saturday Off (2nd &amp; 4th Saturday Off)</option>
                                    <option value="custom">Custom (Use Weekly Off + Overrides)</option>
                                </select>
                            </div>
                            <ToggleItem
                                label="Saturday Half Day"
                                description="Treat Saturdays as half-day working instead of weekly off"
                                active={!!settings.advancedPolicy?.weeklyOff?.saturdayHalfDayEnabled}
                                onClick={() => setSettings({
                                    ...settings,
                                    advancedPolicy: {
                                        ...settings.advancedPolicy,
                                        weeklyOff: {
                                            ...settings.advancedPolicy.weeklyOff,
                                            saturdayHalfDayEnabled: !settings.advancedPolicy.weeklyOff.saturdayHalfDayEnabled
                                        }
                                    }
                                })}
                            />
                        </div>

                        {settings.advancedPolicy?.weeklyOff?.mode === 'alternate_saturday' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputGroup
                                    label="Working Saturdays (Weeks)"
                                    type="text"
                                    value={(settings.advancedPolicy.weeklyOff.alternateSaturday.workingWeeks || []).join(',')}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const list = val.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));
                                        setSettings({
                                            ...settings,
                                            advancedPolicy: {
                                                ...settings.advancedPolicy,
                                                weeklyOff: {
                                                    ...settings.advancedPolicy.weeklyOff,
                                                    alternateSaturday: {
                                                        ...settings.advancedPolicy.weeklyOff.alternateSaturday,
                                                        workingWeeks: list
                                                    }
                                                }
                                            }
                                        });
                                    }}
                                />
                                <InputGroup
                                    label="Off Saturdays (Weeks)"
                                    type="text"
                                    value={(settings.advancedPolicy.weeklyOff.alternateSaturday.offWeeks || []).join(',')}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const list = val.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));
                                        setSettings({
                                            ...settings,
                                            advancedPolicy: {
                                                ...settings.advancedPolicy,
                                                weeklyOff: {
                                                    ...settings.advancedPolicy.weeklyOff,
                                                    alternateSaturday: {
                                                        ...settings.advancedPolicy.weeklyOff.alternateSaturday,
                                                        offWeeks: list
                                                    }
                                                }
                                            }
                                        });
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </CollapsibleCard>

                {/* Late Mark Rules */}
                <CollapsibleCard
                    title="Late Mark Rules"
                    icon={<Clock3 className="text-slate-600" />}
                    description="Define allowed late minutes and conversion of late marks into half-day or LOP"
                >
                    <div className="space-y-6">
                        <ToggleItem
                            label="Enable Late Mark Rules"
                            description="Apply advanced late mark thresholds and auto leave deduction"
                            active={!!settings.advancedPolicy?.lateMarkRules?.enabled}
                            onClick={() => setSettings({
                                ...settings,
                                advancedPolicy: {
                                    ...settings.advancedPolicy,
                                    lateMarkRules: {
                                        ...settings.advancedPolicy.lateMarkRules,
                                        enabled: !settings.advancedPolicy.lateMarkRules.enabled
                                    }
                                }
                            })}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InputGroup
                                label="Allowed Late Minutes / Day"
                                type="number"
                                value={settings.advancedPolicy.lateMarkRules.allowedLateMinutesPerDay}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    advancedPolicy: {
                                        ...settings.advancedPolicy,
                                        lateMarkRules: {
                                            ...settings.advancedPolicy.lateMarkRules,
                                            allowedLateMinutesPerDay: parseInt(e.target.value || '0', 10)
                                        }
                                    }
                                })}
                            />
                            <InputGroup
                                label="Late Marks = Half Day"
                                type="number"
                                value={settings.advancedPolicy.lateMarkRules.lateMarksToHalfDay}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    advancedPolicy: {
                                        ...settings.advancedPolicy,
                                        lateMarkRules: {
                                            ...settings.advancedPolicy.lateMarkRules,
                                            lateMarksToHalfDay: parseInt(e.target.value || '0', 10)
                                        }
                                    }
                                })}
                            />
                            <InputGroup
                                label="Late Marks = 1 Day LOP"
                                type="number"
                                value={settings.advancedPolicy.lateMarkRules.lateMarksToFullDay}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    advancedPolicy: {
                                        ...settings.advancedPolicy,
                                        lateMarkRules: {
                                            ...settings.advancedPolicy.lateMarkRules,
                                            lateMarksToFullDay: parseInt(e.target.value || '0', 10)
                                        }
                                    }
                                })}
                            />
                        </div>
                        <ToggleItem
                            label="Auto Leave Deduction on Late"
                            description="Automatically deduct leave when late thresholds are breached"
                            active={!!settings.advancedPolicy.lateMarkRules.autoLeaveDeductionEnabled}
                            onClick={() => setSettings({
                                ...settings,
                                advancedPolicy: {
                                    ...settings.advancedPolicy,
                                    lateMarkRules: {
                                        ...settings.advancedPolicy.lateMarkRules,
                                        autoLeaveDeductionEnabled: !settings.advancedPolicy.lateMarkRules.autoLeaveDeductionEnabled
                                    }
                                }
                            })}
                        />
                    </div>
                </CollapsibleCard>

                {/* Early Exit Rules */}
                <CollapsibleCard
                    title="Early Exit Rules"
                    icon={<LogOut className="text-slate-600" />}
                    description="Track early exits and configure when they contribute to half-day or LOP"
                >
                    <div className="space-y-6">
                        <ToggleItem
                            label="Enable Early Exit Rules"
                            description="Apply early exit thresholds and conversions"
                            active={!!settings.advancedPolicy?.earlyExitRules?.enabled}
                            onClick={() => setSettings({
                                ...settings,
                                advancedPolicy: {
                                    ...settings.advancedPolicy,
                                    earlyExitRules: {
                                        ...settings.advancedPolicy.earlyExitRules,
                                        enabled: !settings.advancedPolicy.earlyExitRules.enabled
                                    }
                                }
                            })}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InputGroup
                                label="Allowed Early Minutes / Day"
                                type="number"
                                value={settings.advancedPolicy.earlyExitRules.allowedEarlyMinutesPerDay}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    advancedPolicy: {
                                        ...settings.advancedPolicy,
                                        earlyExitRules: {
                                            ...settings.advancedPolicy.earlyExitRules,
                                            allowedEarlyMinutesPerDay: parseInt(e.target.value || '0', 10)
                                        }
                                    }
                                })}
                            />
                            <InputGroup
                                label="Early Exits = Half Day"
                                type="number"
                                value={settings.advancedPolicy.earlyExitRules.earlyExitsToHalfDay}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    advancedPolicy: {
                                        ...settings.advancedPolicy,
                                        earlyExitRules: {
                                            ...settings.advancedPolicy.earlyExitRules,
                                            earlyExitsToHalfDay: parseInt(e.target.value || '0', 10)
                                        }
                                    }
                                })}
                            />
                            <InputGroup
                                label="Early Exits = 1 Day LOP"
                                type="number"
                                value={settings.advancedPolicy.earlyExitRules.earlyExitsToFullDay}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    advancedPolicy: {
                                        ...settings.advancedPolicy,
                                        earlyExitRules: {
                                            ...settings.advancedPolicy.earlyExitRules,
                                            earlyExitsToFullDay: parseInt(e.target.value || '0', 10)
                                        }
                                    }
                                })}
                            />
                        </div>
                    </div>
                </CollapsibleCard>

                {/* Half-Day & Absent Rules */}
                <CollapsibleCard
                    title="Half-Day & Absent Rules"
                    icon={<UserCheck className="text-slate-600" />}
                    description="Control when a day is treated as half-day or absent based on work hours and punches"
                >
                    <div className="space-y-6">
                        <ToggleItem
                            label="Enable Half-Day Rules"
                            description="Apply additional thresholds on top of basic presence rules"
                            active={!!settings.advancedPolicy?.halfDayRules?.enabled}
                            onClick={() => setSettings({
                                ...settings,
                                advancedPolicy: {
                                    ...settings.advancedPolicy,
                                    halfDayRules: {
                                        ...settings.advancedPolicy.halfDayRules,
                                        enabled: !settings.advancedPolicy.halfDayRules.enabled
                                    }
                                }
                            })}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InputGroup
                                label="Half-Day if Hours &lt;"
                                type="number"
                                value={settings.advancedPolicy.halfDayRules.workingHoursThreshold}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    advancedPolicy: {
                                        ...settings.advancedPolicy,
                                        halfDayRules: {
                                            ...settings.advancedPolicy.halfDayRules,
                                            workingHoursThreshold: parseFloat(e.target.value || '0')
                                        }
                                    }
                                })}
                            />
                            <InputGroup
                                label="Half-Day if Late &gt; (mins)"
                                type="number"
                                value={settings.advancedPolicy.halfDayRules.lateMinutesThreshold}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    advancedPolicy: {
                                        ...settings.advancedPolicy,
                                        halfDayRules: {
                                            ...settings.advancedPolicy.halfDayRules,
                                            lateMinutesThreshold: parseInt(e.target.value || '0', 10)
                                        }
                                    }
                                })}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <ToggleItem
                                label="No Punch = Absent"
                                description="Automatically mark absent if no punches are recorded"
                                active={!!settings.advancedPolicy.absentRules.noPunchConsideredAbsent}
                                onClick={() => setSettings({
                                    ...settings,
                                    advancedPolicy: {
                                        ...settings.advancedPolicy,
                                        absentRules: {
                                            ...settings.advancedPolicy.absentRules,
                                            noPunchConsideredAbsent: !settings.advancedPolicy.absentRules.noPunchConsideredAbsent
                                        }
                                    }
                                })}
                            />
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Only IN / No OUT
                                </label>
                                <select
                                    value={settings.advancedPolicy.absentRules.singlePunchBehaviour}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            absentRules: {
                                                ...settings.advancedPolicy.absentRules,
                                                singlePunchBehaviour: e.target.value
                                            }
                                        }
                                    })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 transition"
                                >
                                    <option value="half_day">Treat as Half-Day</option>
                                    <option value="absent">Treat as Absent</option>
                                </select>
                            </div>
                            <ToggleItem
                                label="Convert to LOP if No Leave"
                                description="When auto leave deduction fails, convert deficit to Loss of Pay"
                                active={!!settings.advancedPolicy.absentRules.convertToLopWhenNoLeave}
                                onClick={() => setSettings({
                                    ...settings,
                                    advancedPolicy: {
                                        ...settings.advancedPolicy,
                                        absentRules: {
                                            ...settings.advancedPolicy.absentRules,
                                            convertToLopWhenNoLeave: !settings.advancedPolicy.absentRules.convertToLopWhenNoLeave
                                        }
                                    }
                                })}
                            />
                        </div>
                    </div>
                </CollapsibleCard>

                {/* Leave & Attendance Integration + WFH / OD / Comp-off */}
                <CollapsibleCard
                    title="Leave, WFH, OD & Comp-Off Integration"
                    icon={<Home className="text-slate-600" />}
                    description="Control how leave, WFH, on-duty and comp-off interact with attendance"
                >
                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                Auto Leave Deduction Priority
                            </label>
                            <input
                                type="text"
                                value={(settings.advancedPolicy.leaveIntegration.autoLeaveDeductionOrder || []).join(',')}
                                onChange={(e) => {
                                    const list = e.target.value
                                        .split(',')
                                        .map(v => v.trim())
                                        .filter(Boolean);
                                    setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            leaveIntegration: {
                                                ...settings.advancedPolicy.leaveIntegration,
                                                autoLeaveDeductionOrder: list
                                            }
                                        }
                                    });
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-sky-500 transition"
                                placeholder="CL,SL,EL,Optional,LOP"
                            />
                            <ToggleItem
                                label="Holiday + Weekend Sandwich Rule"
                                description="Count weekends between two leaves as leave as per company policy"
                                active={!!settings.advancedPolicy.leaveIntegration.sandwichRuleEnabled}
                                onClick={() => setSettings({
                                    ...settings,
                                    advancedPolicy: {
                                        ...settings.advancedPolicy,
                                        leaveIntegration: {
                                            ...settings.advancedPolicy.leaveIntegration,
                                            sandwichRuleEnabled: !settings.advancedPolicy.leaveIntegration.sandwichRuleEnabled
                                        }
                                    }
                                })}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* WFH */}
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 space-y-4 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                                    <Home size={16} className="text-slate-600" />
                                    Work From Home
                                </div>
                                <ToggleItem
                                    label="Enable WFH"
                                    description="Allow employees to be marked present while working remotely"
                                    active={!!settings.advancedPolicy.wfhSettings.enabled}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            wfhSettings: {
                                                ...settings.advancedPolicy.wfhSettings,
                                                enabled: !settings.advancedPolicy.wfhSettings.enabled
                                            }
                                        }
                                    })}
                                />
                                <ToggleItem
                                    label="GPS Restriction"
                                    description="Apply GPS validation when on WFH"
                                    active={!!settings.advancedPolicy.wfhSettings.gpsRestrictionEnabled}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            wfhSettings: {
                                                ...settings.advancedPolicy.wfhSettings,
                                                gpsRestrictionEnabled: !settings.advancedPolicy.wfhSettings.gpsRestrictionEnabled
                                            }
                                        }
                                    })}
                                />
                                <ToggleItem
                                    label="IP Restriction"
                                    description="Restrict WFH to specific IPs/VPNs"
                                    active={!!settings.advancedPolicy.wfhSettings.ipRestrictionEnabled}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            wfhSettings: {
                                                ...settings.advancedPolicy.wfhSettings,
                                                ipRestrictionEnabled: !settings.advancedPolicy.wfhSettings.ipRestrictionEnabled
                                            }
                                        }
                                    })}
                                />
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                        WFH Treated As
                                    </label>
                                    <select
                                        value={settings.advancedPolicy.leaveIntegration.wfhPresentMode}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            advancedPolicy: {
                                                ...settings.advancedPolicy,
                                                leaveIntegration: {
                                                    ...settings.advancedPolicy.leaveIntegration,
                                                    wfhPresentMode: e.target.value
                                                }
                                            }
                                        })}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-sky-500 transition"
                                    >
                                        <option value="present">Present (Full Day)</option>
                                        <option value="half_day">Half Day</option>
                                    </select>
                                </div>
                            </div>

                            {/* On Duty */}
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 space-y-4 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                                    <Briefcase size={16} className="text-slate-600" />
                                    On-Duty
                                </div>
                                <ToggleItem
                                    label="Enable On-Duty"
                                    description="Allow OD days to count as presence as per policy"
                                    active={!!settings.advancedPolicy.odSettings.enabled}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            odSettings: {
                                                ...settings.advancedPolicy.odSettings,
                                                enabled: !settings.advancedPolicy.odSettings.enabled
                                            }
                                        }
                                    })}
                                />
                                <ToggleItem
                                    label="Approval Required"
                                    description="Require manager/HR approval for OD requests"
                                    active={!!settings.advancedPolicy.odSettings.approvalRequired}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            odSettings: {
                                                ...settings.advancedPolicy.odSettings,
                                                approvalRequired: !settings.advancedPolicy.odSettings.approvalRequired
                                            }
                                        }
                                    })}
                                />
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                        OD Counted As
                                    </label>
                                    <select
                                        value={settings.advancedPolicy.odSettings.odCountMode}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            advancedPolicy: {
                                                ...settings.advancedPolicy,
                                                odSettings: {
                                                    ...settings.advancedPolicy.odSettings,
                                                    odCountMode: e.target.value
                                                }
                                            }
                                        })}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-amber-500 transition"
                                    >
                                        <option value="present">Present</option>
                                        <option value="half_day">Half Day</option>
                                        <option value="custom">Custom (Reporting only)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Comp-Off */}
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 space-y-4 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                                    <Gift size={16} className="text-slate-600" />
                                    Comp-Off
                                </div>
                                <ToggleItem
                                    label="Enable Comp-Off"
                                    description="Track compensatory off for working on holidays/week-offs"
                                    active={!!settings.advancedPolicy.compOffSettings.enabled}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            compOffSettings: {
                                                ...settings.advancedPolicy.compOffSettings,
                                                enabled: !settings.advancedPolicy.compOffSettings.enabled
                                            }
                                        }
                                    })}
                                />
                                <ToggleItem
                                    label="Auto Credit on Holiday Work"
                                    description="Automatically credit comp-off when employees work on holidays/weekly-offs"
                                    active={!!settings.advancedPolicy.compOffSettings.autoCreditOnHolidayWork}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            compOffSettings: {
                                                ...settings.advancedPolicy.compOffSettings,
                                                autoCreditOnHolidayWork: !settings.advancedPolicy.compOffSettings.autoCreditOnHolidayWork
                                            }
                                        }
                                    })}
                                />
                                <InputGroup
                                    label="Comp-Off Expiry (Days)"
                                    type="number"
                                    value={settings.advancedPolicy.compOffSettings.expiryDays}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            compOffSettings: {
                                                ...settings.advancedPolicy.compOffSettings,
                                                expiryDays: parseInt(e.target.value || '0', 10)
                                            }
                                        }
                                    })}
                                />
                            </div>
                        </div>
                    </div>
                </CollapsibleCard>

                {/* Device & Punch Source + Night Shift & Manual Correction */}
                <CollapsibleCard
                    title="Device, Punch Source & Night Shift Rules"
                    icon={<Cpu className="text-slate-600" />}
                    description="Control which devices can punch and configure night-shift specific rules"
                >
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Device & Source */}
                            <div className="space-y-4">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Allowed Punch Sources
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {['biometric', 'mobile', 'web'].map(source => {
                                        const active = (settings.advancedPolicy.deviceSettings.allowedSources || []).includes(source);
                                        return (
                                            <button
                                                key={source}
                                                type="button"
                                                onClick={() => {
                                                    const current = settings.advancedPolicy.deviceSettings.allowedSources || [];
                                                    const exists = current.includes(source);
                                                    const next = exists ? current.filter(s => s !== source) : [...current, source];
                                                    setSettings({
                                                        ...settings,
                                                        advancedPolicy: {
                                                            ...settings.advancedPolicy,
                                                            deviceSettings: {
                                                                ...settings.advancedPolicy.deviceSettings,
                                                                allowedSources: next
                                                            }
                                                        }
                                                    });
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border transition ${active
                                                    ? 'bg-purple-600 text-white border-purple-600'
                                                    : 'bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800'
                                                    }`}
                                            >
                                                {source === 'biometric' && 'Biometric'}
                                                {source === 'mobile' && 'Mobile App'}
                                                {source === 'web' && 'Web'}
                                            </button>
                                        );
                                    })}
                                </div>

                                <ToggleItem
                                    label="Face Recognition Mandatory"
                                    description="Require face verification for allowed punch sources"
                                    active={!!settings.advancedPolicy.deviceSettings.faceRecognitionMandatory}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            deviceSettings: {
                                                ...settings.advancedPolicy.deviceSettings,
                                                faceRecognitionMandatory: !settings.advancedPolicy.deviceSettings.faceRecognitionMandatory
                                            }
                                        }
                                    })}
                                />
                                <ToggleItem
                                    label="Allow Web Check-In"
                                    description="Permit browser-based check-in (subject to IP/geo restrictions)"
                                    active={!!settings.advancedPolicy.deviceSettings.webCheckinAllowed}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            deviceSettings: {
                                                ...settings.advancedPolicy.deviceSettings,
                                                webCheckinAllowed: !settings.advancedPolicy.deviceSettings.webCheckinAllowed
                                            }
                                        }
                                    })}
                                />
                            </div>

                            {/* Night Shift & Manual Correction */}
                            <div className="space-y-4">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Night Shift & Correction Workflow
                                </div>
                                <ToggleItem
                                    label="Enable Night Shift Rules"
                                    description="Treat shifts that span midnight with special rules"
                                    active={!!settings.advancedPolicy.nightShiftRules.enabled}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            nightShiftRules: {
                                                ...settings.advancedPolicy.nightShiftRules,
                                                enabled: !settings.advancedPolicy.nightShiftRules.enabled
                                            }
                                        }
                                    })}
                                />
                                <ToggleItem
                                    label="Shift Spans Midnight"
                                    description="Mark default shift as spanning past midnight"
                                    active={!!settings.advancedPolicy.nightShiftRules.shiftSpansMidnight}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            nightShiftRules: {
                                                ...settings.advancedPolicy.nightShiftRules,
                                                shiftSpansMidnight: !settings.advancedPolicy.nightShiftRules.shiftSpansMidnight
                                            }
                                        }
                                    })}
                                />
                                <ToggleItem
                                    label="Night Shift Allowance"
                                    description="Tag eligibility for night shift allowance (code driven in payroll)"
                                    active={!!settings.advancedPolicy.nightShiftRules.nightShiftAllowanceEnabled}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            nightShiftRules: {
                                                ...settings.advancedPolicy.nightShiftRules,
                                                nightShiftAllowanceEnabled: !settings.advancedPolicy.nightShiftRules.nightShiftAllowanceEnabled
                                            }
                                        }
                                    })}
                                />
                                <InputGroup
                                    label="Night Shift Allowance Code"
                                    type="text"
                                    value={settings.advancedPolicy.nightShiftRules.nightShiftAllowanceCode || ''}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            nightShiftRules: {
                                                ...settings.advancedPolicy.nightShiftRules,
                                                nightShiftAllowanceCode: e.target.value
                                            }
                                        }
                                    })}
                                />
                                <ToggleItem
                                    label="Separate OT for Night Shift"
                                    description="Track overtime for night shifts separately"
                                    active={!!settings.advancedPolicy.nightShiftRules.overtimeSeparateForNightShift}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            nightShiftRules: {
                                                ...settings.advancedPolicy.nightShiftRules,
                                                overtimeSeparateForNightShift: !settings.advancedPolicy.nightShiftRules.overtimeSeparateForNightShift
                                            }
                                        }
                                    })}
                                />
                                <ToggleItem
                                    label="3-Level Correction Workflow"
                                    description="Employee → Manager → HR approval via Regularization module"
                                    active={!!settings.advancedPolicy.manualCorrectionWorkflow.enabled}
                                    onClick={() => setSettings({
                                        ...settings,
                                        advancedPolicy: {
                                            ...settings.advancedPolicy,
                                            manualCorrectionWorkflow: {
                                                ...settings.advancedPolicy.manualCorrectionWorkflow,
                                                enabled: !settings.advancedPolicy.manualCorrectionWorkflow.enabled
                                            }
                                        }
                                    })}
                                />
                            </div>
                        </div>
                    </div>
                </CollapsibleCard>

                {/* Global Save Button at Bottom */}
                {hasEditAccess && (
                    <div className="col-span-1 md:col-span-2 flex justify-end mt-4 mb-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-slate-800 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-slate-500/20 hover:bg-slate-900 hover:-translate-y-1 transition disabled:opacity-50 disabled:translate-y-0"
                        >
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                )}
                </div>
            )}
        </div>
    );
}

// ======================= SHIFT MANAGEMENT COMPONENT =======================
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHIFT_TYPES = ['General Shift', 'Day Shift', 'Night Shift', 'Rotational Shift', 'Custom Shift'];
const LEAVE_PRIORITY_OPTIONS = ['CL', 'SL', 'EL', 'Optional', 'LOP'];
const PUNCH_SOURCES = ['biometric', 'mobile', 'web'];

const SHIFT_SECTIONS = [
    { id: 1, label: 'Basic Details' },
    { id: 2, label: 'Punch Mode' },
    { id: 3, label: 'Overtime' },
    { id: 4, label: 'Location & Source' },
    { id: 5, label: 'Working Hours' },
    { id: 6, label: 'Auto Absent & Sandwich' },
    { id: 7, label: 'Weekly Off & Saturday' },
    { id: 8, label: 'Late Mark Rules' },
    { id: 9, label: 'Early Exit Rules' },
    { id: 10, label: 'Half Day & Absent' },
    { id: 11, label: 'Leave / WFH / OD / Comp-Off' },
    { id: 12, label: 'Validity & Status' },
];

const EMPTY_SHIFT_FORM = {
    name: 'General Shift', code: '', shiftType: 'General Shift', description: '',
    startTime: '09:00', endTime: '18:00', breakMinutes: 30,
    punchMode: { mode: 'single', breakTrackingEnabled: false, deductBreakFromHours: true, autoDetectBreakFromGaps: false, autoBreakGapMinutes: 30 },
    overtimeCfg: { enabled: false, trackingEnabled: false, startAfterMinutes: 30, separateNightOT: false, roundingMode: 'none' },
    locationCfg: { allowedSources: ['biometric', 'mobile', 'web'], webCheckinAllowed: true, faceRecognitionMandatory: false, geoFencingEnabled: false, geoFenceRadiusMeters: 100, ipRestrictionEnabled: false, allowedIPs: '' },
    workingHoursCfg: { fullDayThresholdHours: 7, halfDayThresholdHours: 4, graceLateMinutes: 15, graceEarlyMinutes: 15 },
    absentCfg: { autoMarkAbsentOnNoPunch: true, sandwichLeaveEnabled: false, sandwichWeekendFill: false, sandwichHolidayFill: false },
    weeklyOffCfg: { mode: 'basic', days: [0], saturdayMode: 'full_off', alternateSaturdayOffWeeks: [2, 4], employeeOverrideAllowed: false },
    lateMarkRules: { enabled: false, allowedLateMinutesPerDay: 0, lateMarksToHalfDay: 3, lateMarksToFullDay: 6, autoLeaveDeduction: false, leaveDeductionPriority: ['CL', 'SL', 'EL', 'Optional', 'LOP'] },
    earlyExitRules: { enabled: false, allowedEarlyMinutesPerDay: 0, earlyExitsToHalfDay: 3, earlyExitsToFullDay: 6 },
    halfDayRules: { enabled: false, halfDayIfWorkedLessThanHours: 4, halfDayIfLateMoreThanMinutes: 120, noPunchEqualsAbsent: true, onlyInNoOutBehaviour: 'half_day', convertToLOPIfNoLeave: true },
    leaveIntegration: { autoLeaveDeductionEnabled: false, deductionPriority: ['CL', 'SL', 'EL', 'Optional', 'LOP'], convertDeficitToLOP: true },
    wfhSettings: { enabled: false, gpsValidationRequired: false, ipRestrictionRequired: false, autoPresentMode: 'full_day' },
    odSettings: { enabled: false, approvalRequired: true, approvalLevels: ['manager', 'hr'], countAsPresent: true },
    compOffSettings: { enabled: false, autoCreditOnHolidayWork: true, autoCreditOnWeeklyOffWork: true, expiryDays: 90 },
    nightShiftRules: { enabled: false, shiftSpansMidnight: false, attendanceDateAsShiftStart: true, separateOTForNight: false, allowanceEnabled: false, allowanceCode: '' },
    correctionWorkflow: { regularizationLevels: ['employee', 'manager', 'hr'], cutoffDays: 7 },
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
    status: 'Active',
};

// ── Small reusable primitives ──────────────────────────────────────────────
const SLabel = ({ children }) => (
    <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{children}</label>
);
const SInput = ({ label, ...props }) => (
    <div className="space-y-1">
        {label && <SLabel>{label}</SLabel>}
        <input {...props} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-[13px] font-medium outline-none focus:border-slate-500 transition" />
    </div>
);
const SToggle = ({ label, desc, value, onChange }) => (
    <div className="flex items-center justify-between gap-3 py-2">
        <div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</div>
            {desc && <div className="text-xs text-slate-400 mt-0.5">{desc}</div>}
        </div>
        <button 
            type="button" 
            onClick={() => onChange(!value)} 
            className={`w-12 h-6 rounded-full transition-colors duration-300 ${value ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-200 dark:bg-slate-700'} relative flex-shrink-0 overflow-hidden border-2 border-transparent`}
        >
            <div 
                className="absolute top-1 w-4 h-4 bg-blue-600 rounded-full shadow-sm transition-transform duration-300 ease-in-out"
                style={{ transform: value ? 'translateX(28px)' : 'translateX(4px)' }}
            />
        </button>
    </div>
);
const SSelect = ({ label, value, onChange, options }) => (
    <div className="space-y-1">
        {label && <SLabel>{label}</SLabel>}
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-[13px] font-medium outline-none focus:border-slate-500 transition">
            {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
    </div>
);
const SNumber = ({ label, ...props }) => (
    <div className="space-y-1">
        {label && <SLabel>{label}</SLabel>}
        <input type="number" min="0" {...props} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-[13px] font-medium outline-none focus:border-slate-500 transition" />
    </div>
);
const SSection = ({ title, children }) => (
    <div className="space-y-3">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">{title}</h4>
        {children}
    </div>
);
const SGrid = ({ cols = 2, children }) => (
    <div className={`grid grid-cols-1 sm:grid-cols-${cols} gap-3`}>{children}</div>
);
const DayPill = ({ day, idx, selected, onToggle }) => (
    <button type="button" onClick={() => onToggle(idx)} className={`px-2.5 py-1 rounded-xl text-[9px] font-semibold uppercase tracking-widest transition-all ${selected ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200'}`}>{day}</button>
);

function detectNightShift(start, end) {
    if (!start || !end) return false;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return (eh * 60 + em) < (sh * 60 + sm);
}

function ShiftsSection({ onStateChange, hasEditAccess }) {
    const [shifts, setShifts] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const [editId, setEditId] = React.useState(null);
    const [form, setForm] = React.useState(EMPTY_SHIFT_FORM);
    const [activeSection, setActiveSection] = React.useState(1);
    const [saving, setSaving] = React.useState(false);
    const [deleting, setDeleting] = React.useState(null);
    const [toggling, setToggling] = React.useState(null);

    const isNight = detectNightShift(form.startTime, form.endTime);

    // ── helpers ──────────────────────────────────────────────────────────────
    const set = (path, val) => setForm(prev => {
        const keys = path.split('.');
        if (keys.length === 1) return { ...prev, [keys[0]]: val };
        return { ...prev, [keys[0]]: { ...prev[keys[0]], [keys[1]]: val } };
    });
    const toggleDay = (idx) => setForm(prev => {
        const days = prev.weeklyOffCfg.days;
        const next = days.includes(idx) ? days.filter(d => d !== idx) : [...days, idx];
        return { ...prev, weeklyOffCfg: { ...prev.weeklyOffCfg, days: next } };
    });
    const toggleSource = (src) => setForm(prev => {
        const srcs = prev.locationCfg.allowedSources;
        const next = srcs.includes(src) ? srcs.filter(s => s !== src) : [...srcs, src];
        return { ...prev, locationCfg: { ...prev.locationCfg, allowedSources: next } };
    });
    const toggleLeaveOrder = (item, path) => setForm(prev => {
        const arr = prev[path[0]][path[1]];
        const next = arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
        return { ...prev, [path[0]]: { ...prev[path[0]], [path[1]]: next } };
    });

    // ── fetch ─────────────────────────────────────────────────────────────────
    const fetchShifts = React.useCallback(async () => {
        try {
            setLoading(true);
            const r = await api.get('/attendance/shifts');
            setShifts(Array.isArray(r.data?.data) ? r.data.data : []);
        } catch (e) {
            console.error('[ShiftsSection] fetch error', e);
            if (e.response?.status === 401) notification.error({ message: 'Session expired', description: 'Please log in again.', placement: 'topRight' });
            else if (e.response?.status !== 404) notification.error({ message: 'Failed to load shifts', description: e.response?.data?.message || e.message, placement: 'topRight' });
            setShifts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { fetchShifts(); }, [fetchShifts]);

    // ── open drawer ───────────────────────────────────────────────────────────
    const openAdd = () => { 
        setEditId(null); 
        setForm(EMPTY_SHIFT_FORM); 
        setActiveSection(1); 
        setDrawerOpen(true); 
        onStateChange?.(true);
    };
    const openEdit = (s) => {
        setEditId(s._id);
        setForm({
            ...EMPTY_SHIFT_FORM, ...s,
            locationCfg: { ...EMPTY_SHIFT_FORM.locationCfg, ...s.locationCfg, allowedIPs: (s.locationCfg?.allowedIPs || []).join(', ') },
            effectiveFrom: s.effectiveFrom ? new Date(s.effectiveFrom).toISOString().slice(0, 10) : '',
            effectiveTo: s.effectiveTo ? new Date(s.effectiveTo).toISOString().slice(0, 10) : '',
        });
        setActiveSection(1); 
        setDrawerOpen(true);
        onStateChange?.(true);
    };
    const closeDrawer = () => { 
        setDrawerOpen(false); 
        setEditId(null); 
        setForm(EMPTY_SHIFT_FORM); 
        setActiveSection(1); 
        onStateChange?.(false);
    };

    // ── save ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!hasEditAccess) return notification.error({ message: 'Access Denied', placement: 'topRight' });
        if (!form.name?.trim()) return notification.error({ message: 'Shift Name is required', placement: 'topRight' });
        if (!form.startTime || !form.endTime) return notification.error({ message: 'Start and End time required', placement: 'topRight' });
        if (!form.effectiveFrom) return notification.error({ message: 'Effective From date is required', placement: 'topRight' });
        try {
            setSaving(true);
            const payload = {
                ...form,
                locationCfg: {
                    ...form.locationCfg,
                    allowedIPs: Array.isArray(form.locationCfg?.allowedIPs)
                        ? form.locationCfg.allowedIPs
                        : (form.locationCfg?.allowedIPs || '').toString().split(',').map(s => s.trim()).filter(Boolean),
                },
                effectiveFrom: form.effectiveFrom,
                effectiveTo: form.effectiveTo || null,
            };
            if (editId) {
                await api.put(`/attendance/shifts/${editId}`, payload);
                notification.success({ message: 'Shift updated', placement: 'topRight' });
            } else {
                await api.post('/attendance/shifts', payload);
                notification.success({ message: 'Shift created', placement: 'topRight' });
            }
            closeDrawer();
            fetchShifts();
        } catch (e) {
            const msg = e.response?.data?.message || e.message || 'Failed to save shift';
            const desc = e.response?.status === 401 ? 'Please log in again.' : e.response?.status === 403 ? 'You do not have permission.' : e.response?.data?.error || '';
            notification.error({ message: msg, description: desc || undefined, placement: 'topRight', duration: 4 });
        } finally { setSaving(false); }
    };

    // ── delete / toggle ───────────────────────────────────────────────────────
    const handleDelete = async (id) => {
        if (!hasEditAccess) return;
        if (!window.confirm('Delete this shift? Employees on it will fall back to default settings.')) return;
        try {
            setDeleting(id);
            await api.delete(`/attendance/shifts/${id}`);
            notification.success({ message: 'Shift deleted', placement: 'topRight' });
            fetchShifts();
        } catch (e) {
            notification.error({ message: 'Failed to delete', description: e.response?.data?.message || e.message, placement: 'topRight' });
        } finally { setDeleting(null); }
    };
    const handleToggleStatus = async (s) => {
        if (!hasEditAccess) return;
        try {
            setToggling(s._id);
            await api.patch(`/attendance/shifts/${s._id}/status`);
            fetchShifts();
        } catch (e) {
            notification.error({ message: 'Status update failed', description: e.response?.data?.message || e.message, placement: 'topRight' });
        } finally { setToggling(null); }
    };

    // ── TYPE BADGE COLORS ─────────────────────────────────────────────────────
    const typeBadge = (t) => ({ 'General Shift': 'bg-emerald-100 text-emerald-700', 'Day Shift': 'bg-amber-100 text-amber-700', 'Night Shift': 'bg-slate-100 text-slate-700', 'Rotational Shift': 'bg-purple-100 text-purple-700', 'Custom Shift': 'bg-sky-100 text-sky-700' })[t] || 'bg-slate-100 text-slate-500';

    // ── SECTION CONTENT ───────────────────────────────────────────────────────
    const renderSection = () => {
        switch (activeSection) {
            case 1: return (
                <div className="space-y-5">
                    <SSection title="Basic Details">
                        <div className="space-y-1">
                            <SLabel>Shift Name {form.shiftType !== 'Custom Shift' ? <span className="ml-1 text-[9px] text-slate-400 font-semibold normal-case">(auto-set from type)</span> : <span className="text-slate-600">*</span>}</SLabel>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => { if (form.shiftType === 'Custom Shift') set('name', e.target.value); }}
                                readOnly={form.shiftType !== 'Custom Shift'}
                                placeholder={form.shiftType === 'Custom Shift' ? 'e.g. Morning Shift' : form.shiftType}
                                className={`w-full border p-2.5 rounded-xl text-sm font-semibold outline-none transition
                                    ${form.shiftType !== 'Custom Shift'
                                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none'
                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-slate-500 text-slate-800 dark:text-white'
                                    }`}
                            />
                        </div>

                        <SSelect label="Shift Type" value={form.shiftType} onChange={v => {
                            setForm(prev => ({
                                ...prev,
                                shiftType: v,
                                // Auto-fill name for all types; for Custom Shift keep existing name or clear it
                                name: v === 'Custom Shift' ? (SHIFT_TYPES.includes(prev.name) ? '' : prev.name) : v,
                            }));
                        }} options={SHIFT_TYPES} />

                        <SInput label="Description (optional)" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short description…" />
                    </SSection>
                    <SSection title="Core Timing">
                        <SGrid>
                            <SInput label="Start Time *" type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} />
                            <SInput label="End Time *" type="time" value={form.endTime} onChange={e => set('endTime', e.target.value)} />
                        </SGrid>
                        <SNumber label="Break Duration (minutes)" value={form.breakMinutes} onChange={e => set('breakMinutes', +e.target.value)} />
                        {isNight && <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-700 dark:text-amber-300 text-xs font-bold"><span>🌙</span> Night Shift auto-detected — end time treated as next day</div>}
                    </SSection>
                </div>
            );
            case 2: return (
                <div className="space-y-5">
                    <SSection title="Punch Mode Configuration">
                        <SSelect label="Punch Mode" value={form.punchMode.mode} onChange={v => set('punchMode.mode', v)} options={[{ value: 'single', label: 'Single Punch (1 IN + 1 OUT)' }, { value: 'multi', label: 'Multi Punch (multiple IN/OUT)' }]} />
                        <SToggle label="Enable Break Tracking" desc="Track employee break punches" value={form.punchMode.breakTrackingEnabled} onChange={v => set('punchMode.breakTrackingEnabled', v)} />
                        {form.punchMode.breakTrackingEnabled && <>
                            <SToggle label="Deduct Break from Working Hours" value={form.punchMode.deductBreakFromHours} onChange={v => set('punchMode.deductBreakFromHours', v)} />

                        </>}
                    </SSection>
                </div>
            );
            case 3: return (
                <div className="space-y-5">
                    <SSection title="Overtime Configuration">
                        <SToggle label="Overtime Allowed" value={form.overtimeCfg.enabled} onChange={v => set('overtimeCfg.enabled', v)} />
                        {form.overtimeCfg.enabled && <>
                            <SToggle label="Enable OT Tracking & Calculation" value={form.overtimeCfg.trackingEnabled} onChange={v => set('overtimeCfg.trackingEnabled', v)} />
                            <SNumber label="Overtime Starts After (minutes past shift end)" value={form.overtimeCfg.startAfterMinutes} onChange={e => set('overtimeCfg.startAfterMinutes', +e.target.value)} />
                            <SToggle label="Separate Overtime for Night Shift" value={form.overtimeCfg.separateNightOT} onChange={v => set('overtimeCfg.separateNightOT', v)} />
                            <SSelect label="OT Rounding Rule" value={form.overtimeCfg.roundingMode} onChange={v => set('overtimeCfg.roundingMode', v)} options={[{ value: 'none', label: 'No Rounding' }, { value: 'round_up_15', label: 'Round Up 15 min' }, { value: 'round_up_30', label: 'Round Up 30 min' }, { value: 'round_down_15', label: 'Round Down 15 min' }, { value: 'round_down_30', label: 'Round Down 30 min' }]} />
                        </>}
                    </SSection>
                </div>
            );
            case 4: return (
                <div className="space-y-5">
                    <SSection title="Allowed Punch Sources">
                        <div className="flex gap-3 flex-wrap">
                            {PUNCH_SOURCES.map(src => (
                                <button key={src} type="button" onClick={() => toggleSource(src)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest capitalize transition-all ${form.locationCfg.allowedSources.includes(src) ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{src}</button>
                            ))}
                        </div>
                        <SToggle label="Web Check-in Allowed" value={form.locationCfg.webCheckinAllowed} onChange={v => set('locationCfg.webCheckinAllowed', v)} />

                    </SSection>
                    <SSection title="Location Rules">
                        <SToggle label="Geo-Fencing (GPS Based)" value={form.locationCfg.geoFencingEnabled} onChange={v => set('locationCfg.geoFencingEnabled', v)} />
                        {form.locationCfg.geoFencingEnabled && <SNumber label="Geo-Fence Radius (metres)" value={form.locationCfg.geoFenceRadiusMeters} onChange={e => set('locationCfg.geoFenceRadiusMeters', +e.target.value)} />}
                        <SToggle label="IP-Based Restriction" value={form.locationCfg.ipRestrictionEnabled} onChange={v => set('locationCfg.ipRestrictionEnabled', v)} />
                        {form.locationCfg.ipRestrictionEnabled && <SInput label="Allowed IPs (comma-separated)" value={form.locationCfg.allowedIPs} onChange={e => set('locationCfg.allowedIPs', e.target.value)} placeholder="192.168.1.1, 10.0.0.1" />}
                    </SSection>
                </div>
            );
            case 5: return (
                <div className="space-y-5">
                    <SSection title="Working Hours & Thresholds">
                        <SGrid>
                            <SNumber label="Full Day Threshold (hours)" value={form.workingHoursCfg.fullDayThresholdHours} onChange={e => set('workingHoursCfg.fullDayThresholdHours', +e.target.value)} />
                            <SNumber label="Half Day Threshold (hours)" value={form.workingHoursCfg.halfDayThresholdHours} onChange={e => set('workingHoursCfg.halfDayThresholdHours', +e.target.value)} />
                            <SNumber label="Grace Minutes (Late)" value={form.workingHoursCfg.graceLateMinutes} onChange={e => set('workingHoursCfg.graceLateMinutes', +e.target.value)} />
                            <SNumber label="Grace Minutes (Early Leave)" value={form.workingHoursCfg.graceEarlyMinutes} onChange={e => set('workingHoursCfg.graceEarlyMinutes', +e.target.value)} />
                        </SGrid>
                    </SSection>
                </div>
            );
            case 6: return (
                <div className="space-y-5">
                    <SSection title="Auto Absent Rules">
                        <SToggle label="Auto-Mark Absent if No Punch" value={form.absentCfg.autoMarkAbsentOnNoPunch} onChange={v => set('absentCfg.autoMarkAbsentOnNoPunch', v)} />
                    </SSection>
                    <SSection title="Sandwich Leave Rule">
                        <SToggle label="Enable Sandwich Leave Rule" desc="Fill gaps between absences" value={form.absentCfg.sandwichLeaveEnabled} onChange={v => set('absentCfg.sandwichLeaveEnabled', v)} />
                        {form.absentCfg.sandwichLeaveEnabled && <>
                            <SToggle label="Apply to Weekends Between Absences" value={form.absentCfg.sandwichWeekendFill} onChange={v => set('absentCfg.sandwichWeekendFill', v)} />
                            <SToggle label="Apply to Holidays Between Absences" value={form.absentCfg.sandwichHolidayFill} onChange={v => set('absentCfg.sandwichHolidayFill', v)} />
                        </>}
                    </SSection>
                </div>
            );
            case 7: return (
                <div className="space-y-5">
                    <SSection title="Weekly Off Mode">
                        <SSelect label="Mode" value={form.weeklyOffCfg.mode} onChange={v => set('weeklyOffCfg.mode', v)} options={[{ value: 'basic', label: 'Basic (fixed days)' }, { value: 'custom', label: 'Custom Combination' }, { value: 'alternate_saturday', label: 'Alternate Saturday Off' }]} />
                        <div className="space-y-2">
                            <SLabel>Weekly Off Days</SLabel>
                            <div className="flex gap-2 flex-wrap">{DAY_NAMES.map((d, i) => <DayPill key={i} day={d} idx={i} selected={form.weeklyOffCfg.days.includes(i)} onToggle={toggleDay} />)}</div>
                        </div>
                    </SSection>
                    <SSection title="Saturday Rules">
                        <SSelect label="Saturday Policy" value={form.weeklyOffCfg.saturdayMode} onChange={v => set('weeklyOffCfg.saturdayMode', v)} options={[{ value: 'full_off', label: 'Full Weekly Off' }, { value: 'half_day', label: 'Half-Day Working' }, { value: 'alternate_2nd_4th', label: 'Alternate (2nd & 4th Off)' }, { value: 'alternate_1st_3rd', label: 'Alternate (1st & 3rd Off)' }, { value: 'full_working', label: 'Full Working' }, { value: 'custom', label: 'Custom' }]} />
                        {form.weeklyOffCfg.saturdayMode === 'custom' && (
                            <SInput label="Custom Saturday Policy Description" value={form.weeklyOffCfg.customSaturdayPolicy || ''} onChange={e => set('weeklyOffCfg.customSaturdayPolicy', e.target.value)} placeholder="e.g. 1st Saturday off, others working" />
                        )}
                        <SToggle label="Allow Employee-Level Weekly Off Override" value={form.weeklyOffCfg.employeeOverrideAllowed} onChange={v => set('weeklyOffCfg.employeeOverrideAllowed', v)} />
                    </SSection>
                </div>
            );
            case 8: return (
                <div className="space-y-5">
                    <SSection title="Late Mark Rules">
                        <SToggle label="Enable Late Mark Rules" value={form.lateMarkRules.enabled} onChange={v => set('lateMarkRules.enabled', v)} />
                        {form.lateMarkRules.enabled && <>
                            <SNumber label="Allowed Late Minutes Per Day (before marking)" value={form.lateMarkRules.allowedLateMinutesPerDay} onChange={e => set('lateMarkRules.allowedLateMinutesPerDay', +e.target.value)} />
                            <SGrid>
                                <SNumber label="X Late Marks = Half Day" value={form.lateMarkRules.lateMarksToHalfDay} onChange={e => set('lateMarkRules.lateMarksToHalfDay', +e.target.value)} />
                                <SNumber label="X Late Marks = 1 Day LOP" value={form.lateMarkRules.lateMarksToFullDay} onChange={e => set('lateMarkRules.lateMarksToFullDay', +e.target.value)} />
                            </SGrid>
                            <SToggle label="Auto Leave Deduction on Late" value={form.lateMarkRules.autoLeaveDeduction} onChange={v => set('lateMarkRules.autoLeaveDeduction', v)} />
                            {form.lateMarkRules.autoLeaveDeduction && (
                                <div className="space-y-2">
                                    <SLabel>Leave Deduction Priority</SLabel>
                                    <div className="flex gap-2 flex-wrap">{LEAVE_PRIORITY_OPTIONS.map(opt => (
                                        <button key={opt} type="button" onClick={() => toggleLeaveOrder(opt, ['lateMarkRules', 'leaveDeductionPriority'])} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${form.lateMarkRules.leaveDeductionPriority.includes(opt) ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{opt}</button>
                                    ))}</div>
                                </div>
                            )}
                        </>}
                    </SSection>
                </div>
            );
            case 9: return (
                <div className="space-y-5">
                    <SSection title="Early Exit Rules">
                        <SToggle label="Enable Early Exit Rules" value={form.earlyExitRules.enabled} onChange={v => set('earlyExitRules.enabled', v)} />
                        {form.earlyExitRules.enabled && <>
                            <SNumber label="Allowed Early Minutes Per Day" value={form.earlyExitRules.allowedEarlyMinutesPerDay} onChange={e => set('earlyExitRules.allowedEarlyMinutesPerDay', +e.target.value)} />
                            <SGrid>
                                <SNumber label="X Early Exits = Half Day" value={form.earlyExitRules.earlyExitsToHalfDay} onChange={e => set('earlyExitRules.earlyExitsToHalfDay', +e.target.value)} />
                                <SNumber label="X Early Exits = 1 Day LOP" value={form.earlyExitRules.earlyExitsToFullDay} onChange={e => set('earlyExitRules.earlyExitsToFullDay', +e.target.value)} />
                            </SGrid>
                        </>}
                    </SSection>
                </div>
            );
            case 10: return (
                <div className="space-y-5">
                    <SSection title="Half Day Rules">
                        <SToggle label="Enable Half Day Rules" value={form.halfDayRules.enabled} onChange={v => set('halfDayRules.enabled', v)} />
                        {form.halfDayRules.enabled && <>
                            <SGrid>
                                <SNumber label="Half Day if Worked Less Than (hrs)" value={form.halfDayRules.halfDayIfWorkedLessThanHours} onChange={e => set('halfDayRules.halfDayIfWorkedLessThanHours', +e.target.value)} />
                                <SNumber label="Half Day if Late More Than (min)" value={form.halfDayRules.halfDayIfLateMoreThanMinutes} onChange={e => set('halfDayRules.halfDayIfLateMoreThanMinutes', +e.target.value)} />
                            </SGrid>
                            <SToggle label="No Punch = Absent" value={form.halfDayRules.noPunchEqualsAbsent} onChange={v => set('halfDayRules.noPunchEqualsAbsent', v)} />
                            <SSelect label="Only IN / No OUT Behaviour" value={form.halfDayRules.onlyInNoOutBehaviour} onChange={v => set('halfDayRules.onlyInNoOutBehaviour', v)} options={[{ value: 'half_day', label: 'Treat as Half Day' }, { value: 'lop', label: 'Convert to LOP' }, { value: 'absent', label: 'Mark Absent' }]} />
                            <SToggle label="Convert to LOP if No Leave Balance" value={form.halfDayRules.convertToLOPIfNoLeave} onChange={v => set('halfDayRules.convertToLOPIfNoLeave', v)} />
                        </>}
                    </SSection>
                </div>
            );
            case 11: return (
                <div className="space-y-5">
                    <SSection title="Leave Integration">
                        <SToggle label="Auto Leave Deduction Enabled" value={form.leaveIntegration.autoLeaveDeductionEnabled} onChange={v => set('leaveIntegration.autoLeaveDeductionEnabled', v)} />
                        {form.leaveIntegration.autoLeaveDeductionEnabled && <>
                            <div className="space-y-2"><SLabel>Deduction Priority (click to toggle)</SLabel>
                                <div className="flex gap-2 flex-wrap">{LEAVE_PRIORITY_OPTIONS.map(opt => (
                                    <button key={opt} type="button" onClick={() => toggleLeaveOrder(opt, ['leaveIntegration', 'deductionPriority'])} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${form.leaveIntegration.deductionPriority.includes(opt) ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{opt}</button>
                                ))}</div>
                            </div>
                            <SToggle label="Convert Leave Deficit to LOP" value={form.leaveIntegration.convertDeficitToLOP} onChange={v => set('leaveIntegration.convertDeficitToLOP', v)} />
                        </>}
                    </SSection>
                    <SSection title="Work From Home (WFH)">
                        <SToggle label="Enable WFH" value={form.wfhSettings.enabled} onChange={v => set('wfhSettings.enabled', v)} />
                        {form.wfhSettings.enabled && <>
                            <SToggle label="GPS Validation Required" value={form.wfhSettings.gpsValidationRequired} onChange={v => set('wfhSettings.gpsValidationRequired', v)} />
                            <SToggle label="IP Restriction Required" value={form.wfhSettings.ipRestrictionRequired} onChange={v => set('wfhSettings.ipRestrictionRequired', v)} />
                            <SSelect label="WFH Treated As" value={form.wfhSettings.autoPresentMode} onChange={v => set('wfhSettings.autoPresentMode', v)} options={[{ value: 'full_day', label: 'Full Day Present' }, { value: 'half_day', label: 'Half Day Present' }]} />
                        </>}
                    </SSection>
                    <SSection title="On Duty (OD)">
                        <SToggle label="Enable OD" value={form.odSettings.enabled} onChange={v => set('odSettings.enabled', v)} />
                        {form.odSettings.enabled && <>
                            <SToggle label="Approval Required" value={form.odSettings.approvalRequired} onChange={v => set('odSettings.approvalRequired', v)} />
                            <SToggle label="OD Counted as Present" value={form.odSettings.countAsPresent} onChange={v => set('odSettings.countAsPresent', v)} />
                        </>}
                    </SSection>
                    <SSection title="Comp-Off">
                        <SToggle label="Enable Comp-Off" value={form.compOffSettings.enabled} onChange={v => set('compOffSettings.enabled', v)} />
                        {form.compOffSettings.enabled && <>
                            <SToggle label="Auto Credit on Holiday Work" value={form.compOffSettings.autoCreditOnHolidayWork} onChange={v => set('compOffSettings.autoCreditOnHolidayWork', v)} />
                            <SToggle label="Auto Credit on Weekly Off Work" value={form.compOffSettings.autoCreditOnWeeklyOffWork} onChange={v => set('compOffSettings.autoCreditOnWeeklyOffWork', v)} />
                            <SNumber label="Comp-Off Expiry (days)" value={form.compOffSettings.expiryDays} onChange={e => set('compOffSettings.expiryDays', +e.target.value)} />
                        </>}
                    </SSection>
                </div>
            );
            case 12: return (
                <div className="space-y-5">
                    <SSection title="Validity & Status">
                        <SGrid>
                            <SInput label="Effective From *" type="date" value={form.effectiveFrom} onChange={e => set('effectiveFrom', e.target.value)} />
                            <SInput label="Effective To (optional)" type="date" value={form.effectiveTo} onChange={e => set('effectiveTo', e.target.value)} />
                        </SGrid>
                        <div className="space-y-2">
                            <SLabel>Status</SLabel>
                            <div className="flex gap-3">
                                {['Active', 'Inactive'].map(s => (
                                    <button key={s} type="button" onClick={() => set('status', s)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${form.status === s ? (s === 'Active' ? 'bg-slate-800 text-white shadow-md' : 'bg-rose-500 text-white shadow-md') : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{s}</button>
                                ))}
                            </div>
                        </div>
                    </SSection>
                </div>
            );
            default: return null;
        }
    };

    // ── RENDER ────────────────────────────────────────────────────────────────
    return (
        <div className="col-span-1 md:col-span-2">
            {!drawerOpen ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border-0">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            {loading ? 'Loading…' : `${shifts.length} shift${shifts.length !== 1 ? 's' : ''} configured`}
                        </p>
                        {hasEditAccess && (
                            <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 shadow-lg shadow-slate-800/20 active:scale-95 transition-all">
                                <Plus size={14} /> Add Shift
                            </button>
                        )}
                    </div>

                    {/* Empty state */}
                    {shifts.length === 0 && !loading && (
                        <div className="text-center py-10 text-slate-400 text-sm">No shifts yet. Click <strong>+ Add Shift</strong> to create one.</div>
                    )}

                    {/* Shift Table */}
                    {shifts.length > 0 && (
                        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="text-left px-4 py-3">Shift</th>
                                        <th className="text-left px-4 py-3">Type</th>
                                        <th className="text-left px-4 py-3">Timing</th>
                                        <th className="text-left px-4 py-3">Weekly Off</th>
                                        <th className="text-left px-4 py-3">Status</th>
                                        <th className="text-right px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {shifts.map(s => (
                                        <tr key={s._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-black text-slate-800 dark:text-white text-sm">{s.name}</div>
                                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{s.code}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${typeBadge(s.shiftType)}`}>{s.shiftType?.replace(' Shift', '') || '—'}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{s.startTime} – {s.endTime}{s.isNightShift && <span className="ml-1 text-slate-600">🌙</span>}</div>
                                                <div className="text-[10px] text-slate-400">Break: {s.breakMinutes || 0}m</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1 flex-wrap">{DAY_NAMES.map((d, i) => (
                                                    <span key={i} className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-lg ${(s.weeklyOffCfg?.days || s.weeklyOffs || []).includes(i) ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{d}</span>
                                                ))}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${s.status === 'Active' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {hasEditAccess && (
                                                        <button onClick={() => handleToggleStatus(s)} disabled={toggling === s._id} title={s.status === 'Active' ? 'Deactivate' : 'Activate'} className={`p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 transition-all ${s.status === 'Active' ? 'text-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600'}`}>
                                                            {toggling === s._id ? <RefreshCw size={13} className="animate-spin" /> : <Power size={13} />}
                                                        </button>
                                                    )}
                                                    <button onClick={() => openEdit(s)} title={hasEditAccess ? "Edit" : "View"} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                                                        {hasEditAccess ? <Pencil size={13} /> : <Eye size={13} />}
                                                    </button>
                                                    {hasEditAccess && (
                                                        <button onClick={() => handleDelete(s._id)} disabled={deleting === s._id} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all disabled:opacity-40"><Trash2 size={13} /></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-full bg-white dark:bg-slate-900 flex flex-col h-[calc(100vh-65px)] animate-in fade-in transition-all duration-300 overflow-hidden relative border-l border-slate-100 dark:border-slate-800">
                    {/* Body: left nav + right content */}
                    <div className="flex flex-1 overflow-hidden">
                        {/* Left section nav */}
                        <div className="w-56 flex-shrink-0 border-r border-slate-100 dark:border-slate-800 overflow-y-auto py-4 bg-slate-50/30 dark:bg-slate-900/50">
                            {SHIFT_SECTIONS.map(sec => (
                                <button key={sec.id} type="button" onClick={() => setActiveSection(sec.id)} className={`w-full text-left pl-10 py-2.5 text-[11px] font-medium transition-all flex items-center gap-2.5 relative group ${activeSection === sec.id ? 'text-slate-950 dark:text-white bg-slate-50 dark:bg-slate-800/50' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'}`}>
                                    {activeSection === sec.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900 dark:bg-slate-400" />}
                                    <span className={activeSection === sec.id ? 'font-black' : ''}>{sec.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Right content */}
                        <div className="flex-1 overflow-y-auto px-5 py-8 bg-white dark:bg-slate-900 scrollbar-thin scrollbar-thumb-slate-200">
                            <div className="w-full flex flex-col min-h-full">
                                <div className={`flex-1 ${!hasEditAccess ? 'pointer-events-none' : ''}`}>
                                    {renderSection()}
                                </div>
                                
                                {/* Form Actions - now integrated into content flow */}
                                <div className="flex items-center justify-end gap-4 mt-12 pb-6 border-t border-slate-50 dark:border-slate-800/50 pt-8">
                                    <button onClick={closeDrawer} className="px-8 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">{hasEditAccess ? 'Cancel' : 'Close'}</button>
                                    {hasEditAccess && (
                                        <button onClick={handleSave} disabled={saving} className="px-10 py-3 rounded-2xl bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-900 disabled:opacity-50 transition-all font-bold">
                                            {saving ? 'Processing…' : editId ? 'Update Shift' : 'Save Shift'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}






function InputGroup({ label, ...props }) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{label}</label>
            <input {...props} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition" />
        </div>
    );
}

function ToggleItem({ label, description, active, onClick }) {
    return (
        <div className="flex items-center gap-4 cursor-pointer group" onClick={onClick}>
            <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${active ? 'bg-slate-900 dark:bg-slate-800' : 'bg-slate-200 dark:bg-slate-700'} overflow-hidden flex-shrink-0 border-2 border-transparent`}>
                <div 
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ease-in-out"
                    style={{ transform: active ? 'translateX(28px)' : 'translateX(4px)' }}
                />
            </div>
            <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400">{description}</div>
            </div>
        </div>
    );
}

function CollapsibleCard({ title, icon, description, children }) {
    const [open, setOpen] = useState(true);
    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800 col-span-1 md:col-span-2">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between gap-4 text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-200">
                        {icon || <Settings2 className="text-slate-500" />}
                    </div>
                    <div>
                        <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-white uppercase tracking-widest">
                            {title}
                        </h3>
                        {description && (
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                                {description}
                            </p>
                        )}
                    </div>
                </div>
                <div className="text-slate-400">
                    {open ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </div>
            </button>

            {open && (
                <div className="mt-6 space-y-4">
                    {children}
                </div>
            )}
        </div>
    );
}
