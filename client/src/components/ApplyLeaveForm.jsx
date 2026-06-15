import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
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

export default function ApplyLeaveForm({ balances = [], existingLeaves = [], editData = null, isHR = false, targetEmployeeId = null, leavePolicy = null, onCancelEdit, onSuccess }) {
    const [form, setForm] = useState({
        leaveType: '',
        startDate: '',
        endDate: '',
        reason: '',
        isHalfDay: false,
        halfDaySession: 'First Half',
        employeeId: targetEmployeeId || ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState(null);
    const [infoMessage, setInfoMessage] = useState(null);
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
                locked: Boolean(balance?.locked),
                eligible: !balance?.locked,
                eligibleFrom: balance?.eligibleFrom || null
            });
        }

        return mergedOptions;
    }, [balances, leavePolicy]);

    // Populate form if editing
    useEffect(() => {
        if (editData) {
            setForm({
                leaveType: editData.leaveType,
                startDate: editData.startDate.split('T')[0],
                endDate: editData.endDate.split('T')[0],
                reason: editData.reason,
                isHalfDay: editData.isHalfDay || false,
                halfDaySession: editData.halfDaySession || 'First Half',
                employeeId: targetEmployeeId || ''
            });
        }
    }, [editData, targetEmployeeId]);

    // Validation & Duration Calculation
    useEffect(() => {
        setError(null);
        setInfoMessage(null);
        setDuration(0);

        if (!form.startDate || !form.endDate) return;

        const start = dayjs(form.startDate);
        const end = dayjs(form.endDate);

        if (end.isBefore(start, 'day')) {
            setError('To Date cannot be earlier than From Date.');
            return;
        }

        let count = end.diff(start, 'day') + 1;
        if (form.isHalfDay && count > 0) count -= 0.5;
        
        if (count <= 0) {
            setError('Range contains no working days.');
            return;
        }

        setDuration(count);

        if (form.leaveType) {
            const bal = leaveOptions.find(b => b.leaveType === form.leaveType);
            const available = bal ? (bal.available + (editData?.leaveType === form.leaveType ? editData.daysCount : 0)) : 0;
            if (count > available) {
                setInfoMessage(`Note: You have ${available} ${form.leaveType} left. Extra ${count - available} days will be marked as LOP.`);
            }
        }
    }, [form.startDate, form.endDate, form.leaveType, form.isHalfDay, leaveOptions, editData]);

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
        try {
            setIsSubmitting(true);
            const payload = { ...form, daysCount: duration };
            if (editData) await api.put(`/employee/leaves/edit/${editData._id}`, payload);
            else await api.post('/employee/leaves/apply', payload);
            showToast('success', 'Success', editData ? 'Updated' : 'Applied');
            onSuccess?.();
            setForm({ leaveType: '', startDate: '', endDate: '', reason: '', isHalfDay: false, halfDaySession: 'First Half', employeeId: targetEmployeeId || '' });
        } catch (err) {
            showToast('error', 'Error', err.response?.data?.message || 'Failed to submit.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-500 font-inter">
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

                    {/* Half Day Session Selector */}
                    {form.isHalfDay && (
                        <div className="flex gap-2 p-1 bg-white/60 rounded-lg border border-blue-100 animate-in slide-in-from-top-2 duration-300">
                             {['First Half', 'Second Half'].map(s => (
                                 <button key={s} type="button" onClick={() => setForm({...form, halfDaySession: s})}
                                    className={clsx(
                                        "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
                                        form.halfDaySession === s ? "bg-[#2563EB] text-white shadow-sm" : "text-[#64748B] hover:bg-slate-50"
                                    )}>{s}</button>
                             ))}
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

            {/* Calculations & Alerts */}
            {(error || infoMessage || duration > 0) && (
                <div className="space-y-3">
                    {error && (
                        <div className="flex items-center gap-3 bg-[#FEF2F2] p-3.5 rounded-lg border border-[#FEE2E2] animate-in shake duration-500">
                            <AlertCircle size={16} className="text-[#DC2626]" />
                            <span className="text-xs font-semibold text-[#DC2626] uppercase tracking-wider">{error}</span>
                        </div>
                    )}
                    {infoMessage && (
                        <div className="flex items-center gap-3 bg-[#FFFBEB] p-3.5 rounded-lg border border-[#FEF3C7]">
                            <Info size={16} className="text-[#F59E0B]" />
                            <span className="text-[13px] font-medium text-[#B45309] leading-tight">{infoMessage}</span>
                        </div>
                    )}
                    {duration > 0 && !error && (
                        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 rounded-xl border border-[#E2E8F0]">
                           <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center text-[#2563EB]">
                                   <Briefcase size={18} />
                               </div>
                               <div>
                                   <p className="text-[11px] text-[#64748B] font-semibold uppercase tracking-wider mb-0.5">Summary</p>
                                   <p className="text-[18px] font-bold text-[#334155] leading-none">{duration} {duration === 1 ? 'Day' : 'Days'}</p>
                               </div>
                           </div>
                           <CheckCircle size={20} className="text-[#16A34A]" />
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2">
                <button 
                    type="submit" 
                    disabled={isSubmitting || !!error || duration <= 0 || !form.leaveType || !form.startDate || !form.endDate || !form.reason.trim()} 
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

