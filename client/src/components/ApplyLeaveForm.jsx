import React, { useState, useEffect, useMemo } from 'react';
import api, { HRMS_API_ROOT } from '../utils/api';
import { showToast } from '../utils/uiNotifications';
import {
    Calendar as CalendarIcon,
    AlertCircle,
    CheckCircle,
    Info,
    Send,
    Briefcase,
    ChevronDown,
    FileText
} from 'lucide-react';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { DatePicker } from 'antd';
import clsx from 'clsx';

dayjs.extend(isBetween);

export default function ApplyLeaveForm({ balances = [], existingLeaves = [], editData = null, isHR = false, targetEmployeeId = null, leavePolicy = null, onCancelEdit, onSuccess, profile, holidays }) {
    const [form, setForm] = useState({
        leaveType: '',
        startDate: '',
        endDate: '',
        reason: '',
        isHalfDay: false,
        halfDaySession: 'First Half',
        halfDayTarget: 'Start',
        halfDayMode: 'first',
        firstDaySession: 'Second Half',
        lastDaySession: 'First Half',
        employeeId: targetEmployeeId || ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState(null);
    const [infoMessage, setInfoMessage] = useState(null);
    const [medicalCertFile, setMedicalCertFile] = useState(null);
    const [medicalCertUrl, setMedicalCertUrl] = useState('');
    const [calcDetails, setCalcDetails] = useState({
        totalDays: 0,
        weeklyOffs: 0,
        holidaysInBetween: 0,
        netDays: 0
    });
    const [validationErrors, setValidationErrors] = useState([]);
    const [validationWarnings, setValidationWarnings] = useState([]);

    const activeRule = useMemo(() => {
        if (!form.leaveType || !leavePolicy?.rules) return null;
        return leavePolicy.rules.find(r => String(r.leaveType).toUpperCase() === String(form.leaveType).toUpperCase());
    }, [form.leaveType, leavePolicy]);

    const medicalCertRequired = useMemo(() => {
        if (!activeRule || !activeRule.medicalCertRequiredAfterDays) return false;
        return duration >= activeRule.medicalCertRequiredAfterDays;
    }, [activeRule, duration]);

    const leaveOptions = useMemo(() => {
        const balanceMap = new Map(
            (Array.isArray(balances) ? balances : [])
                .filter((balance) => balance?.leaveType)
                .map((balance) => [String(balance.leaveType).trim().toUpperCase(), balance])
        );
        const policyRules = Array.isArray(leavePolicy?.rules) ? leavePolicy.rules : [];
        const mergedOptions = [];

        for (const rule of policyRules) {
            const leaveType = String(rule?.leaveType || '').trim().toUpperCase();
            if (!leaveType || mergedOptions.some((option) => option.leaveType === leaveType)) {
                continue;
            }

            const balance = balanceMap.get(leaveType);
            const ruleTotal = Number(rule?.totalPerYear ?? 0);
            const balanceTotal = Number(balance?.total ?? rule?.balance?.total ?? 0);
            const used = Number(balance?.used ?? rule?.balance?.used ?? 0);
            const pending = Number(balance?.pending ?? rule?.balance?.pending ?? 0);
            const total = balanceTotal > 0 ? balanceTotal : ruleTotal;
            const available = total > 0
                ? Math.max(0, total - used - pending)
                : Number(balance?.available ?? rule?.balance?.available ?? 0);

            mergedOptions.push({
                leaveType,
                available,
                total,
                used,
                pending,
                locked: Boolean(balance?.locked ?? rule?.balance?.locked ?? !rule?.eligible),
                eligible: rule?.eligible !== false,
                eligibleFrom: rule?.eligibleFrom || balance?.eligibleFrom || null
            });
        }

        for (const balance of Array.isArray(balances) ? balances : []) {
            const leaveType = String(balance?.leaveType || '').trim().toUpperCase();
            if (!leaveType || mergedOptions.some((option) => option.leaveType === leaveType)) {
                continue;
            }

            mergedOptions.push({
                leaveType,
                available: Number(balance?.available ?? 0),
                total: Number(balance?.total ?? 0),
                used: Number(balance?.used ?? 0),
                pending: Number(balance?.pending ?? 0),
                locked: Boolean(balance?.locked),
                eligible: !balance?.locked,
                eligibleFrom: balance?.eligibleFrom || null
            });
        }

        // ── Maternity / Paternity eligibility filter ──────────────────────────────
        // MATERNITY only for Married Female, PATERNITY only for Married Male
        const profileGender = String(profile?.gender || '').trim().toLowerCase();
        const profileMarital = String(profile?.maritalStatus || '').trim().toLowerCase();
        const profileIsMarried = profileMarital === 'married';

        return mergedOptions.filter(opt => {
            const lt = String(opt.leaveType || '').toUpperCase();
            if (lt === 'MATERNITY') {
                return profileGender === 'female' && profileIsMarried;
            }
            if (lt === 'PATERNITY') {
                return profileGender === 'male' && profileIsMarried;
            }
            return true;
        });
    }, [balances, leavePolicy, profile]);

    // Populate form if editing
    useEffect(() => {
        if (editData) {
            const custom = editData.meta?.customHalfDays;
            let mode = 'first';
            if (custom) {
                if (custom.firstDayHalf && custom.lastDayHalf) mode = 'both';
                else if (custom.lastDayHalf) mode = 'last';
            } else if (editData.halfDayTarget === 'End') {
                mode = 'last';
            }

            setForm({
                leaveType: editData.leaveType,
                startDate: editData.startDate.split('T')[0],
                endDate: editData.endDate.split('T')[0],
                reason: editData.reason,
                isHalfDay: editData.isHalfDay || false,
                halfDaySession: editData.halfDaySession || 'First Half',
                halfDayTarget: editData.halfDayTarget || 'Start',
                halfDayMode: mode,
                firstDaySession: custom?.firstDaySession || editData.halfDaySession || 'Second Half',
                lastDaySession: custom?.lastDaySession || editData.halfDaySession || 'First Half',
                employeeId: targetEmployeeId || ''
            });
            setMedicalCertUrl(editData.medicalCertUrl || '');
            setMedicalCertFile(null);
        } else {
            setMedicalCertUrl('');
            setMedicalCertFile(null);
        }
    }, [editData, targetEmployeeId]);

    // Reset halfDayTarget and halfDayMode if it's a single day leave
    useEffect(() => {
        if (form.startDate && form.endDate && form.startDate === form.endDate) {
            if (form.halfDayTarget !== 'Start' || form.halfDayMode !== 'first') {
                setForm(f => ({ ...f, halfDayTarget: 'Start', halfDayMode: 'first' }));
            }
        }
    }, [form.startDate, form.endDate, form.halfDayTarget, form.halfDayMode]);

    // Validation & Duration Calculation
    useEffect(() => {
        const errors = [];
        const warnings = [];
        setDuration(0);
        setCalcDetails({
            totalDays: 0,
            weeklyOffs: 0,
            holidaysInBetween: 0,
            netDays: 0
        });

        if (!form.startDate || !form.endDate) {
            setValidationErrors([]);
            setValidationWarnings([]);
            return;
        }

        const start = dayjs(form.startDate);
        const end = dayjs(form.endDate);

        if (end.isBefore(start, 'day')) {
            errors.push('To Date cannot be earlier than From Date.');
            setValidationErrors(errors);
            setValidationWarnings([]);
            return;
        }

        // Iterate day-by-day to calculate breakdown
        let total = 0;
        let sundays = 0;
        let holidayCount = 0;
        
        let curr = start.clone();
        const holidaysList = Array.isArray(holidays) ? holidays : [];

        while (curr.isBefore(end, 'day') || curr.isSame(end, 'day')) {
            total++;
            const isSun = curr.day() === 0;
            const isHol = holidaysList.some(h => dayjs(h.date).isSame(curr, 'day'));
            
            if (isSun) {
                sundays++;
            } else if (isHol) {
                holidayCount++;
            }
            curr = curr.add(1, 'day');
        }

        let net = total - sundays - holidayCount;
        if (form.isHalfDay && net > 0) {
            const isSingleDay = start.isSame(end, 'day');
            if (isSingleDay) {
                net -= 0.5;
            } else if (form.halfDayMode === 'both') {
                net -= 1.0;
            } else {
                net -= 0.5;
            }
        }

        if (net < 0) net = 0;

        setCalcDetails({
            totalDays: total,
            weeklyOffs: sundays,
            holidaysInBetween: holidayCount,
            netDays: net
        });
        setDuration(net);

        if (net <= 0) {
            errors.push('Range contains no working days.');
        }

        if (form.leaveType) {
            const bal = leaveOptions.find(b => b.leaveType === form.leaveType);
            const available = bal ? (bal.available + (editData?.leaveType === form.leaveType ? editData.daysCount : 0)) : 0;
            
            // 1. Balance sufficiency warning
            if (form.leaveType !== 'Personal Leave' && net > available) {
                warnings.push(`Warning: You have only ${available} ${form.leaveType} available. Requesting ${net} days will put you in negative balance by ${net - available} days, which will be marked as Loss of Pay (LOP).`);
            }

            // 2. Overlap checks
            const hasOverlap = existingLeaves.some(leave => {
                if (editData && editData._id === leave._id) return false;
                if (leave.status === 'Approved' || leave.status === 'Pending') {
                    const leaveStart = dayjs(leave.startDate).startOf('day');
                    const leaveEnd = dayjs(leave.endDate || leave.startDate).endOf('day');
                    return (start.isSame(leaveStart, 'day') || start.isAfter(leaveStart, 'day')) && (start.isBefore(leaveEnd, 'day') || start.isSame(leaveEnd, 'day')) ||
                           (end.isSame(leaveStart, 'day') || end.isAfter(leaveStart, 'day')) && (end.isBefore(leaveEnd, 'day') || end.isSame(leaveEnd, 'day')) ||
                           (start.isBefore(leaveStart, 'day') && end.isAfter(leaveEnd, 'day'));
                }
                return false;
            });
            if (hasOverlap) {
                errors.push('Overlap Error: Selected dates overlap with an existing pending or approved leave request.');
            }

            // 3. Notice Period check
            if (activeRule && activeRule.advanceNoticeDays > 0) {
                const noticeDays = start.diff(dayjs().startOf('day'), 'day');
                if (noticeDays < activeRule.advanceNoticeDays) {
                    errors.push(`Notice Period Error: This leave type requires at least ${activeRule.advanceNoticeDays} days of advance notice. Currently requested ${noticeDays < 0 ? 0 : noticeDays} days in advance.`);
                }
            }

            // 4. Gender restriction check
            if (activeRule && activeRule.applicableGender && activeRule.applicableGender !== 'All') {
                const empGender = String(profile?.gender || '').trim().toLowerCase();
                const reqGender = String(activeRule.applicableGender).trim().toLowerCase();
                if (empGender && empGender !== reqGender) {
                    errors.push(`Gender Ineligibility: This leave type is configured for ${activeRule.applicableGender} employees only.`);
                }
            }

            // 4b. Marital status restriction for MATERNITY and PATERNITY
            const leaveTypeUpper = String(form.leaveType || '').toUpperCase();
            const empGender = String(profile?.gender || '').trim().toLowerCase();
            const empMarital = String(profile?.maritalStatus || '').trim().toLowerCase();
            const empIsMarried = empMarital === 'married';

            if (leaveTypeUpper === 'MATERNITY') {
                if (empGender !== 'female') {
                    errors.push('⛔ Maternity Leave is only applicable to female employees.');
                } else if (!empIsMarried) {
                    errors.push('⛔ Maternity Leave is only applicable to married female employees. Please update your marital status in your profile.');
                }
            }
            if (leaveTypeUpper === 'PATERNITY') {
                if (empGender !== 'male') {
                    errors.push('⛔ Paternity Leave is only applicable to male employees.');
                } else if (!empIsMarried) {
                    errors.push('⛔ Paternity Leave is only applicable to married male employees. Please update your marital status in your profile.');
                }
            }

            // 5. Probation lock check
            const joiningDate = profile?.joiningDate ? dayjs(profile.joiningDate) : null;
            const tenureMonths = joiningDate ? dayjs().diff(joiningDate, 'month') : 0;
            if (activeRule && activeRule.allowDuringProbation === false) {
                const minTenure = activeRule.minimumTenureMonths || 3;
                if (tenureMonths < minTenure) {
                    errors.push(`Probation Lock: Not eligible for this leave type during probation (minimum tenure: ${minTenure} months. Your tenure: ${tenureMonths} months).`);
                }
            }
        }

        setValidationErrors(errors);
        setValidationWarnings(warnings);
    }, [form.startDate, form.endDate, form.leaveType, form.isHalfDay, leaveOptions, editData, holidays, existingLeaves, activeRule, profile]);

    const disabledDate = (current) => {
        if (!current) return false;
        if (!isHR && current.isBefore(dayjs().startOf('day'))) return true;
        if (current.day() === 0) return true;
        return existingLeaves.some(leave => {
            if (editData && editData._id === leave._id) return false;
            if (leave.status === 'Approved' || leave.status === 'Pending') {
                const start = dayjs(leave.startDate).startOf('day');
                const end = dayjs(leave.endDate || leave.startDate).endOf('day');
                return current.isBetween(start, end, 'day', '[]');
            }
            return false;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (error || isSubmitting || !form.leaveType || duration <= 0) return;
        if (medicalCertRequired && !medicalCertFile && !medicalCertUrl) {
            showToast('error', 'Error', 'Medical certificate is mandatory.');
            return;
        }
        try {
            setIsSubmitting(true);
            let uploadedUrl = medicalCertUrl;
            if (medicalCertRequired && medicalCertFile) {
                const uploadFormData = new FormData();
                uploadFormData.append('file', medicalCertFile);
                const uploadRes = await api.post('/uploads/medical-cert', uploadFormData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                uploadedUrl = uploadRes.data.url;
            }
            const customHalfDays = form.startDate !== form.endDate && form.isHalfDay ? {
                firstDayHalf: form.halfDayMode === 'first' || form.halfDayMode === 'both',
                firstDaySession: form.firstDaySession,
                lastDayHalf: form.halfDayMode === 'last' || form.halfDayMode === 'both',
                lastDaySession: form.lastDaySession
            } : null;

            const payload = { 
                ...form, 
                halfDayTarget: form.halfDayMode === 'last' ? 'End' : 'Start',
                halfDaySession: form.halfDayMode === 'last' ? form.lastDaySession : form.firstDaySession,
                daysCount: duration, 
                medicalCertUrl: uploadedUrl,
                meta: {
                    ...(editData?.meta || {}),
                    customHalfDays
                }
            };
            if (editData) await api.put(`/employee/leaves/edit/${editData._id}`, payload);
            else await api.post('/employee/leaves/apply', payload);
            showToast('success', 'Success', editData ? 'Updated' : 'Applied');
            setMedicalCertFile(null);
            setMedicalCertUrl('');
            onSuccess?.();
            setForm({ 
                leaveType: '', 
                startDate: '', 
                endDate: '', 
                reason: '', 
                isHalfDay: false, 
                halfDaySession: 'First Half', 
                halfDayTarget: 'Start', 
                halfDayMode: 'first',
                firstDaySession: 'Second Half',
                lastDaySession: 'First Half',
                employeeId: targetEmployeeId || '' 
            });
        } catch (err) {
            showToast('error', 'Error', err.response?.data?.error || err.response?.data?.message || 'Failed to submit.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedOption = useMemo(() => {
        if (!form.leaveType) return null;
        return leaveOptions.find(opt => opt.leaveType === form.leaveType);
    }, [form.leaveType, leaveOptions]);

    return (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-500 font-inter">
            {/* Step 1: Profile Header */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 transition-all">
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-200/50">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Briefcase size={16} />
                    </div>
                    <div>
                        <h4 className="text-[13px] font-bold text-slate-800">Applicant Profile</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Auto-fetched from employee records</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Employee Name</span>
                        <span className="font-semibold text-slate-700">{`${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || 'N/A'}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Employee Code</span>
                        <span className="font-semibold text-slate-700">{profile?.employeeId || 'N/A'}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Department & Title</span>
                        <span className="font-semibold text-slate-700 truncate block max-w-[170px]">
                            {profile?.department || profile?.departmentId?.name || 'N/A'} - {profile?.designation || profile?.designationId?.name || 'N/A'}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Leave Policy</span>
                        <span className="font-semibold text-slate-700">{leavePolicy?.name || 'Default Policy'}</span>
                    </div>
                </div>
            </div>

            {/* COMPACT UNIFIED FORM */}
            <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="space-y-4">
                    {/* Category Selection */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-medium text-[#64748B]">Leave Category</label>
                        <div className="relative">
                            <select
                                required
                                className="w-full h-[42px] bg-slate-50/50 border border-[#E2E8F0] rounded-lg pl-4 pr-10 text-[14px] font-medium text-[#334155] outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] transition-all cursor-pointer appearance-none"
                                value={form.leaveType}
                                onChange={e => setForm({ ...form, leaveType: e.target.value })}
                            >
                                <option value="">Select category...</option>
                                {leaveOptions
                                    .filter(option => option.available > 0 || option.leaveType === form.leaveType)
                                    .map((option) => (
                                    <option key={option.leaveType} value={option.leaveType} disabled={option.locked}>
                                        {option.leaveType} ({option.available > 0 ? `${option.available} Available` : 'Exhausted'}{option.locked ? ', Locked' : ''})
                                    </option>
                                ))}
                                <option value="Personal Leave">Personal / LOP (Unpaid)</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Step 2: Selected Category Balance Summary */}
                        {selectedOption && (
                            <div className="mt-2.5 p-3 bg-indigo-50/30 border border-indigo-100/60 rounded-xl animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">
                                        {selectedOption.leaveType} Balance Summary
                                    </span>
                                    <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                        Active Balance
                                    </span>
                                </div>
                                <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                                    <div className="bg-white p-1.5 rounded border border-slate-100">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Total</p>
                                        <p className="font-bold text-slate-700">{selectedOption.total}</p>
                                    </div>
                                    <div className="bg-white p-1.5 rounded border border-slate-100">
                                        <p className="text-[8px] font-bold text-emerald-500 uppercase mb-0.5">Used</p>
                                        <p className="font-bold text-emerald-600">{selectedOption.used}</p>
                                    </div>
                                    <div className="bg-white p-1.5 rounded border border-slate-100">
                                        <p className="text-[8px] font-bold text-amber-500 uppercase mb-0.5">Pending</p>
                                        <p className="font-bold text-amber-600">{selectedOption.pending}</p>
                                    </div>
                                    <div className="bg-white p-1.5 rounded border border-indigo-100 bg-indigo-50/20">
                                        <p className="text-[8px] font-bold text-indigo-500 uppercase mb-0.5">Available</p>
                                        <p className="font-bold text-indigo-600">{selectedOption.available}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Date Grid + Half Day - Single Row */}
                    <div className="grid grid-cols-3 gap-4 items-end">
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-medium text-[#64748B]">Start Date</label>
                            <DatePicker
                                disabledDate={disabledDate}
                                placeholder="DD-MM-YYYY"
                                className="w-full h-[42px] bg-slate-50/50 border border-[#E2E8F0] hover:border-[#2563EB] focus:border-[#2563EB] rounded-lg px-3 text-[14px] font-medium text-[#334155] shadow-none"
                                value={form.startDate ? dayjs(form.startDate) : null}
                                onChange={(date) => setForm({ ...form, startDate: date ? date.format('YYYY-MM-DD') : '' })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-medium text-[#64748B]">End Date</label>
                            <DatePicker
                                disabledDate={(current) => (form.startDate && current && current.isBefore(dayjs(form.startDate), 'day')) || disabledDate(current)}
                                placeholder="DD-MM-YYYY"
                                className="w-full h-[42px] bg-slate-50/50 border border-[#E2E8F0] hover:border-[#2563EB] focus:border-[#2563EB] rounded-lg px-3 text-[14px] font-medium text-[#334155] shadow-none"
                                value={form.endDate ? dayjs(form.endDate) : null}
                                onChange={(date) => setForm({ ...form, endDate: date ? date.format('YYYY-MM-DD') : '' })}
                            />
                        </div>
                        <div className={clsx(
                            "h-[42px] px-3 rounded-lg border transition-all flex items-center",
                            form.isHalfDay ? "bg-blue-50/30 border-blue-200" : "bg-slate-50 border-slate-100"
                        )}>
                            <label className="flex items-center gap-2.5 cursor-pointer select-none w-full">
                                <div className={clsx(
                                    "w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0",
                                    form.isHalfDay ? "bg-[#2563EB] border-[#2563EB]" : "bg-white border-slate-300"
                                )}>
                                    {form.isHalfDay && <CheckCircle size={10} className="text-white" />}
                                </div>
                                <input type="checkbox" className="hidden" checked={form.isHalfDay} onChange={e => setForm({ ...form, isHalfDay: e.target.checked })} />
                                <span className={clsx("text-[13px] font-medium whitespace-nowrap", form.isHalfDay ? "text-[#2563EB]" : "text-[#64748B]")}>Half Day</span>
                            </label>
                        </div>
                    </div>

                    {/* Half Day Settings */}
                    {form.isHalfDay && (
                        <div className="space-y-4 p-4 bg-blue-50/20 border border-blue-100/60 rounded-xl animate-in slide-in-from-top-2 duration-300">
                            {/* If multi-day range, choose Mode */}
                            {form.startDate && form.endDate && form.startDate !== form.endDate ? (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Half Day Configuration</label>
                                        <div className="flex gap-2 p-1 bg-white rounded-lg border border-slate-200">
                                             {[
                                                 { label: 'First Day Only', value: 'first' },
                                                 { label: 'Last Day Only', value: 'last' },
                                                 { label: 'Both Days', value: 'both' }
                                             ].map(opt => (
                                                 <button key={opt.value} type="button" onClick={() => setForm({...form, halfDayMode: opt.value})}
                                                    className={clsx(
                                                        "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
                                                        form.halfDayMode === opt.value ? "bg-[#2563EB] text-white shadow-sm" : "text-[#64748B] hover:bg-slate-50"
                                                    )}>{opt.label}</button>
                                             ))}
                                        </div>
                                    </div>

                                    {/* First Day Session Selector */}
                                    {(form.halfDayMode === 'first' || form.halfDayMode === 'both') && (
                                        <div className="space-y-1.5 p-2 bg-white rounded-lg border border-slate-100">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">First Day Session ({dayjs(form.startDate).format('DD-MM')})</label>
                                            <div className="flex gap-2 p-1 bg-slate-50 rounded-md">
                                                 {['First Half', 'Second Half'].map(s => (
                                                     <button key={s} type="button" onClick={() => setForm({...form, firstDaySession: s})}
                                                        className={clsx(
                                                            "flex-1 py-1 text-xs font-semibold rounded transition-all",
                                                            form.firstDaySession === s ? "bg-[#2563EB] text-white shadow-sm" : "text-[#64748B] hover:bg-white/80"
                                                        )}>{s}</button>
                                                 ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Last Day Session Selector */}
                                    {(form.halfDayMode === 'last' || form.halfDayMode === 'both') && (
                                        <div className="space-y-1.5 p-2 bg-white rounded-lg border border-slate-100">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Last Day Session ({dayjs(form.endDate).format('DD-MM')})</label>
                                            <div className="flex gap-2 p-1 bg-slate-50 rounded-md">
                                                 {['First Half', 'Second Half'].map(s => (
                                                     <button key={s} type="button" onClick={() => setForm({...form, lastDaySession: s})}
                                                        className={clsx(
                                                            "flex-1 py-1 text-xs font-semibold rounded transition-all",
                                                            form.lastDaySession === s ? "bg-[#2563EB] text-white shadow-sm" : "text-[#64748B] hover:bg-white/80"
                                                        )}>{s}</button>
                                                 ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* Single Day Selector */
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Half Day Session</label>
                                    <div className="flex gap-2 p-1 bg-white rounded-lg border border-slate-200">
                                         {['First Half', 'Second Half'].map(s => (
                                             <button key={s} type="button" onClick={() => setForm({...form, firstDaySession: s, halfDaySession: s})}
                                                className={clsx(
                                                    "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
                                                    (form.firstDaySession === s || form.halfDaySession === s) ? "bg-[#2563EB] text-white shadow-sm" : "text-[#64748B] hover:bg-slate-50"
                                                )}>{s}</button>
                                         ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Medical Certificate Upload */}
                    {medicalCertRequired && (
                        <div className="space-y-1.5 p-4 bg-emerald-50/50 border border-emerald-100 rounded-lg animate-in slide-in-from-top-2 duration-300">
                            <label className="text-[12px] font-bold text-emerald-800 flex items-center gap-1.5">
                                <FileText size={14} />
                                Medical Certificate Required (Duration &ge; {activeRule.medicalCertRequiredAfterDays} Days)
                            </label>
                            <div className="mt-2 flex flex-col sm:flex-row items-center gap-3">
                                <label className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 border border-emerald-200 hover:border-emerald-400 bg-white text-emerald-700 text-xs font-bold rounded-lg cursor-pointer transition-all active:scale-95 shadow-sm">
                                    <span>Choose File</span>
                                    <input 
                                        type="file" 
                                        accept=".png,.jpg,.jpeg,.pdf" 
                                        className="hidden" 
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                setMedicalCertFile(e.target.files[0]);
                                            }
                                        }}
                                    />
                                </label>
                                <span className="text-xs font-medium text-slate-500 truncate max-w-[200px]">
                                    {medicalCertFile ? medicalCertFile.name : (medicalCertUrl ? 'Current Certificate Uploaded' : 'No file chosen')}
                                </span>
                                {medicalCertUrl && !medicalCertFile && (
                                    <a 
                                        href={medicalCertUrl.startsWith('http') ? medicalCertUrl : `${HRMS_API_ROOT}${medicalCertUrl}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1 shrink-0 ml-auto"
                                    >
                                        [View Current]
                                    </a>
                                )}
                            </div>
                            <p className="text-[10px] text-emerald-600 font-medium mt-1">Allowed formats: PNG, JPG, JPEG, PDF (Max 5MB)</p>
                        </div>
                    )}

                    {/* Reason Section */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-medium text-[#64748B]">Justification / Reason</label>
                        <textarea
                            required
                            placeholder="Please provide a brief reason for your request..."
                            className="w-full bg-slate-50/50 border border-[#E2E8F0] rounded-lg p-4 text-[14px] font-medium text-[#334155] outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] transition-all resize-none shadow-none min-h-[100px]"
                            value={form.reason}
                            onChange={e => setForm({ ...form, reason: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* Step 3: Duration Breakdown */}
            {duration > 0 && validationErrors.length === 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 animate-in fade-in duration-300">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <CalendarIcon size={12} />
                        Duration Breakdown
                    </h5>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                            <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Total Days</span>
                            <span className="font-semibold text-slate-700">{calcDetails.totalDays}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                            <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Sundays</span>
                            <span className="font-semibold text-slate-700">{calcDetails.weeklyOffs}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                            <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Holidays</span>
                            <span className="font-semibold text-slate-700">{calcDetails.holidaysInBetween}</span>
                        </div>
                        <div className="bg-indigo-50/20 p-2 rounded-lg border border-indigo-100">
                            <span className="text-[8px] font-bold text-indigo-500 block mb-0.5">Net Days</span>
                            <span className="font-bold text-indigo-600">{calcDetails.netDays}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 5: Leave Impact Preview */}
            {selectedOption && duration > 0 && validationErrors.length === 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 animate-in fade-in duration-300">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Leave Impact & Workflow Preview</h5>
                    <div className="grid grid-cols-3 gap-3 items-center text-center text-xs mb-3">
                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                            <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Current Balance</span>
                            <span className="font-semibold text-slate-700">{selectedOption.available}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest block mb-0.5">Requested</span>
                            <div className="flex items-center gap-1">
                                <div className="h-0.5 w-4 bg-indigo-300"></div>
                                <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">-{duration}</span>
                                <div className="h-0.5 w-4 bg-indigo-300"></div>
                            </div>
                        </div>
                        <div className="bg-indigo-50/10 p-2 rounded-lg border border-indigo-100">
                            <span className="text-[8px] font-bold text-indigo-500 block mb-0.5">Remaining</span>
                            <span className="font-bold text-indigo-700">
                                {Math.max(0, selectedOption.available - duration)}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-100 text-[10px] font-medium text-slate-500">
                        <span className="font-bold text-[9px] text-slate-400 uppercase">Approval Path:</span>
                        <div className="flex items-center gap-1.5">
                            <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-700">Manager Approval</span>
                            <span className="text-slate-400">&rarr;</span>
                            <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-700">HR Processing</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Calculations & Alerts */}
            {(validationErrors.length > 0 || validationWarnings.length > 0) && (
                <div className="space-y-2">
                    {validationErrors.map((errText, idx) => (
                        <div key={`err-${idx}`} className="flex items-start gap-2.5 bg-[#FEF2F2] p-3 rounded-lg border border-[#FEE2E2] animate-in shake duration-500">
                            <AlertCircle size={15} className="text-[#DC2626] shrink-0 mt-0.5" />
                            <span className="text-xs font-semibold text-[#DC2626] leading-relaxed">{errText}</span>
                        </div>
                    ))}
                    {validationWarnings.map((warnText, idx) => (
                        <div key={`warn-${idx}`} className="flex items-start gap-2.5 bg-[#FFFBEB] p-3 rounded-lg border border-[#FEF3C7] animate-in fade-in duration-300">
                            <Info size={15} className="text-[#F59E0B] shrink-0 mt-0.5" />
                            <span className="text-[12px] font-medium text-[#B45309] leading-relaxed">{warnText}</span>
                        </div>
                    ))}
                </div>
            )}

             {/* Actions */}
            <div className="flex flex-col gap-3 pt-2">
                <button 
                    type="submit" 
                    disabled={isSubmitting || validationErrors.length > 0 || duration <= 0 || !form.leaveType || !form.startDate || !form.endDate || !form.reason.trim() || (medicalCertRequired && !medicalCertFile && !medicalCertUrl)} 
                    className="w-full flex items-center justify-center gap-2 h-[44px] rounded-lg bg-[#2563EB] text-white text-[14px] font-semibold transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40 shadow-sm shadow-blue-500/10"
                >
                    <Send size={16} />
                    <span>Apply for Leave</span>
                </button>
                {editData && (
                    <button type="button" onClick={onCancelEdit} className="w-full py-2 text-sm font-medium text-[#64748B] hover:text-[#334155] transition-all">Discard Changes</button>
                )}
            </div>
        </form>
    );
}

