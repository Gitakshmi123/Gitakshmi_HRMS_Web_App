import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Building2,
    Loader2,
    MapPin,
    Plus,
    Route,
    ShieldCheck,
    Trash2,
    WalletCards
} from 'lucide-react';
import api from '../../utils/api';

const todayValue = () => new Date().toISOString().slice(0, 10);

const emptyProfileForm = {
    effectiveFrom: todayValue(),
    country: 'India',
    branchName: '',
    workState: '',
    workCity: '',
    payrollRegion: '',
    closePrevious: true,
    isMetro: false,
    professionalTaxAmount: '',
    localAllowanceLabel: '',
    localAllowanceAmount: '',
    holidayCalendarCode: '',
    payCalendarCode: '',
    notes: ''
};

const emptyDeductionForm = {
    deductionId: '',
    startDate: todayValue(),
    endDate: '',
    customValue: '',
    deductionType: '',
    categoryOverride: '',
    amountTypeOverride: '',
    calculationBaseOverride: '',
    installmentAmount: '',
    remainingInstallments: '',
    notes: ''
};

const formatDate = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-IN', { dateStyle: 'medium' });
};

const formatInr = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const parseOptionalNumber = (value) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
};

function ToneChip({ value, tone = 'slate' }) {
    const tones = {
        slate: 'bg-slate-100 text-slate-600 border-slate-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-100',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100'
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${tones[tone] || tones.slate}`}>
            {value}
        </span>
    );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', className = '', disabled = false }) {
    return (
        <label className={`flex flex-col gap-1 ${className}`}>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-medium text-slate-700 placeholder:text-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none disabled:opacity-60"
            />
        </label>
    );
}

function SelectField({ label, value, onChange, options, className = '', disabled = false }) {
    return (
        <label className={`flex flex-col gap-1 ${className}`}>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-medium text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none disabled:opacity-60"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function SectionHeader({ icon, title, caption }) {
    return (
        <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{title}</h4>
                {caption && <p className="text-[11px] font-medium text-slate-500 mt-1">{caption}</p>}
            </div>
        </div>
    );
}

export default function PayrollSetupPanel({ employee, canManage = false, onDataChanged }) {
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingDeduction, setSavingDeduction] = useState(false);
    const [message, setMessage] = useState(null);
    const [profileData, setProfileData] = useState({ effectiveProfile: null, segments: [], history: [] });
    const [deductionAssignments, setDeductionAssignments] = useState([]);
    const [deductionPlan, setDeductionPlan] = useState(null);
    const [deductionMasters, setDeductionMasters] = useState([]);
    const [profileForm, setProfileForm] = useState(emptyProfileForm);
    const [deductionForm, setDeductionForm] = useState(emptyDeductionForm);
    const [busyAssignmentId, setBusyAssignmentId] = useState(null);

    const monthQuery = useMemo(() => {
        const now = new Date();
        return {
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            date: todayValue()
        };
    }, []);

    const loadData = useCallback(async ({ preserveMessage = false } = {}) => {
        if (!employee?._id) return;
        setLoading(true);
        if (!preserveMessage) setMessage(null);

        try {
            const [profileRes, assignmentsRes, planRes, mastersRes] = await Promise.all([
                api.get(`/payroll/employees/${employee._id}/payroll-profile?month=${monthQuery.month}&year=${monthQuery.year}`),
                api.get(`/deductions/employee/${employee._id}`),
                api.get(`/deductions/employee/${employee._id}/plan?date=${monthQuery.date}`),
                api.get('/deductions')
            ]);

            setProfileData(profileRes.data?.data || { effectiveProfile: null, segments: [], history: [] });
            setDeductionAssignments(assignmentsRes.data?.data || []);
            setDeductionPlan(planRes.data?.data || null);
            setDeductionMasters(mastersRes.data?.data || []);
        } catch (error) {
            console.error('Payroll setup panel load failed', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.message || error.response?.data?.error || 'Failed to load payroll setup details.'
            });
        } finally {
            setLoading(false);
        }
    }, [employee?._id, monthQuery.date, monthQuery.month, monthQuery.year]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const activeSegments = profileData?.segments || [];
    const planItems = deductionPlan?.items || [];

    const handleProfileChange = (field, value) => {
        setProfileForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleDeductionChange = (field, value) => {
        setDeductionForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleCreateProfile = async () => {
        if (!employee?._id || !profileForm.effectiveFrom || !profileForm.workState || !profileForm.workCity) {
            setMessage({ type: 'error', text: 'Effective date, work state, and work city are required.' });
            return;
        }

        setSavingProfile(true);
        setMessage(null);
        try {
            const payload = {
                effectiveFrom: profileForm.effectiveFrom,
                country: profileForm.country || 'India',
                branchName: profileForm.branchName || '',
                workState: profileForm.workState,
                workCity: profileForm.workCity,
                payrollRegion: profileForm.payrollRegion || profileForm.workState,
                closePrevious: profileForm.closePrevious === true,
                source: 'MANUAL',
                notes: profileForm.notes || '',
                policyOverrides: {
                    isMetro: profileForm.isMetro === true,
                    professionalTaxAmount: parseOptionalNumber(profileForm.professionalTaxAmount),
                    localAllowanceLabel: profileForm.localAllowanceLabel || '',
                    localAllowanceAmount: parseOptionalNumber(profileForm.localAllowanceAmount),
                    holidayCalendarCode: profileForm.holidayCalendarCode || '',
                    payCalendarCode: profileForm.payCalendarCode || ''
                }
            };

            await api.post(`/payroll/employees/${employee._id}/payroll-profile`, payload);
            setProfileForm((prev) => ({
                ...emptyProfileForm,
                country: prev.country || 'India'
            }));
            setMessage({ type: 'success', text: 'Payroll profile segment created successfully.' });
            await loadData({ preserveMessage: true });
            onDataChanged?.();
        } catch (error) {
            console.error('Create payroll profile failed', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.message || 'Failed to create payroll profile segment.'
            });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleAssignDeduction = async () => {
        if (!employee?._id || !deductionForm.deductionId || !deductionForm.startDate) {
            setMessage({ type: 'error', text: 'Select a deduction and a start date first.' });
            return;
        }

        setSavingDeduction(true);
        setMessage(null);
        try {
            const payload = {
                employeeId: employee._id,
                deductionId: deductionForm.deductionId,
                startDate: deductionForm.startDate,
                endDate: deductionForm.endDate || undefined,
                customValue: parseOptionalNumber(deductionForm.customValue),
                deductionType: deductionForm.deductionType || undefined,
                categoryOverride: deductionForm.categoryOverride || undefined,
                amountTypeOverride: deductionForm.amountTypeOverride || undefined,
                calculationBaseOverride: deductionForm.calculationBaseOverride || undefined,
                installmentAmount: parseOptionalNumber(deductionForm.installmentAmount),
                remainingInstallments: parseOptionalNumber(deductionForm.remainingInstallments),
                notes: deductionForm.notes || undefined
            };

            await api.post('/deductions/assign', payload);
            setDeductionForm(emptyDeductionForm);
            setMessage({ type: 'success', text: 'Employee deduction assignment added.' });
            await loadData({ preserveMessage: true });
            onDataChanged?.();
        } catch (error) {
            console.error('Assign deduction failed', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.message || error.response?.data?.error || 'Failed to assign deduction.'
            });
        } finally {
            setSavingDeduction(false);
        }
    };

    const handleDeleteAssignment = async (assignmentId) => {
        if (!assignmentId || !window.confirm('Delete this employee deduction assignment?')) return;
        setBusyAssignmentId(assignmentId);
        setMessage(null);

        try {
            await api.delete(`/deductions/employee-assignment/${assignmentId}`);
            setMessage({ type: 'success', text: 'Employee deduction assignment deleted.' });
            await loadData({ preserveMessage: true });
            onDataChanged?.();
        } catch (error) {
            console.error('Delete deduction assignment failed', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.message || error.response?.data?.error || 'Failed to delete deduction assignment.'
            });
        } finally {
            setBusyAssignmentId(null);
        }
    };

    return (
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-6">
            <SectionHeader
                icon={<Route size={18} strokeWidth={2.2} />}
                title="Payroll Location And Deductions"
                caption="City/state effective dates and a single unified deduction plan now drive the live payroll engine."
            />

            {message && (
                <div className={`rounded-2xl border px-4 py-3 text-[12px] font-semibold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                    {message.text}
                </div>
            )}

            {loading ? (
                <div className="py-10 flex items-center justify-center gap-3 text-slate-500">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-[12px] font-semibold">Loading payroll setup details...</span>
                </div>
            ) : (
                <>
                    <div className="space-y-4">
                        <SectionHeader
                            icon={<MapPin size={18} strokeWidth={2.2} />}
                            title="City-Wise Payroll Segments"
                            caption="When an employee changes location mid-month, payroll uses these effective-dated segments."
                        />

                        {activeSegments.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-[12px] font-semibold text-slate-400">
                                No effective payroll profile segments found for this period.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeSegments.map((segment, index) => (
                                    <div key={`${segment.segmentStart}-${segment.segmentEnd}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-[12px] font-black text-slate-900 uppercase">
                                                        {segment.profile?.workCity || segment.profile?.workState || 'Default Policy Segment'}
                                                    </p>
                                                    <ToneChip value={segment.isGap ? 'Fallback' : 'Profile'} tone={segment.isGap ? 'amber' : 'indigo'} />
                                                    {segment.locationPolicy?.ruleName && (
                                                        <ToneChip value={segment.locationPolicy.ruleName} tone="blue" />
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                    {formatDate(segment.segmentStart)} - {formatDate(segment.segmentEnd)}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <ToneChip value={`${segment.attendanceSummary?.presentDays || 0}/${segment.attendanceSummary?.totalDays || 0} payable`} tone="emerald" />
                                                <ToneChip value={`PT ${formatInr(segment.locationPolicy?.professionalTaxAmount || 0)}`} tone="amber" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                                            <div className="rounded-xl border border-slate-100 bg-white px-3 py-3">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Work Location</p>
                                                <p className="text-[12px] font-semibold text-slate-700 mt-1">
                                                    {[segment.profile?.workCity, segment.profile?.workState, segment.profile?.country].filter(Boolean).join(', ') || '-'}
                                                </p>
                                            </div>
                                            <div className="rounded-xl border border-slate-100 bg-white px-3 py-3">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Branch / Region</p>
                                                <p className="text-[12px] font-semibold text-slate-700 mt-1">
                                                    {segment.profile?.branchName || '-'} {segment.profile?.payrollRegion ? `· ${segment.profile.payrollRegion}` : ''}
                                                </p>
                                            </div>
                                            <div className="rounded-xl border border-slate-100 bg-white px-3 py-3">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Policy Details</p>
                                                <p className="text-[12px] font-semibold text-slate-700 mt-1">
                                                    {segment.locationPolicy?.localAllowanceAmount
                                                        ? `Local allowance ${formatInr(segment.locationPolicy.localAllowanceAmount)}`
                                                        : 'No extra local allowance'}
                                                </p>
                                                <p className="text-[10px] font-semibold text-slate-400 mt-1">
                                                    {segment.locationPolicy?.esiApplicable === false ? 'ESI off' : 'ESI default'} · {segment.locationPolicy?.lwfEnabled ? 'LWF on' : 'LWF off'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {canManage && (
                        <div className="space-y-4">
                            <SectionHeader
                                icon={<Building2 size={18} strokeWidth={2.2} />}
                                title="Add Payroll Profile Segment"
                                caption="Use this when the employee transfers city, branch, or payroll region. The engine will split the month from this date."
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                <Field label="Effective From" type="date" value={profileForm.effectiveFrom} onChange={(value) => handleProfileChange('effectiveFrom', value)} />
                                <Field label="Country" value={profileForm.country} onChange={(value) => handleProfileChange('country', value)} placeholder="India" />
                                <Field label="Branch Name" value={profileForm.branchName} onChange={(value) => handleProfileChange('branchName', value)} placeholder="Ahmedabad HO" />
                                <Field label="Work State" value={profileForm.workState} onChange={(value) => handleProfileChange('workState', value)} placeholder="Gujarat" />
                                <Field label="Work City" value={profileForm.workCity} onChange={(value) => handleProfileChange('workCity', value)} placeholder="Ahmedabad" />
                                <Field label="Payroll Region" value={profileForm.payrollRegion} onChange={(value) => handleProfileChange('payrollRegion', value)} placeholder="West" />
                                <Field label="PT Override" value={profileForm.professionalTaxAmount} onChange={(value) => handleProfileChange('professionalTaxAmount', value)} placeholder="200" />
                                <Field label="Local Allowance Label" value={profileForm.localAllowanceLabel} onChange={(value) => handleProfileChange('localAllowanceLabel', value)} placeholder="City Allowance" />
                                <Field label="Local Allowance" value={profileForm.localAllowanceAmount} onChange={(value) => handleProfileChange('localAllowanceAmount', value)} placeholder="1500" />
                                <Field label="Holiday Calendar Code" value={profileForm.holidayCalendarCode} onChange={(value) => handleProfileChange('holidayCalendarCode', value)} placeholder="GJ-AHD-HOL" />
                                <Field label="Pay Calendar Code" value={profileForm.payCalendarCode} onChange={(value) => handleProfileChange('payCalendarCode', value)} placeholder="MONTH-END" />
                                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 mt-5">
                                    <input
                                        type="checkbox"
                                        checked={profileForm.isMetro}
                                        onChange={(event) => handleProfileChange('isMetro', event.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                    />
                                    <span className="text-[12px] font-semibold text-slate-700">Metro policy override</span>
                                </label>
                                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 mt-5">
                                    <input
                                        type="checkbox"
                                        checked={profileForm.closePrevious}
                                        onChange={(event) => handleProfileChange('closePrevious', event.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                    />
                                    <span className="text-[12px] font-semibold text-slate-700">Close previous overlapping segment</span>
                                </label>
                            </div>

                            <label className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</span>
                                <textarea
                                    rows={3}
                                    value={profileForm.notes}
                                    onChange={(event) => handleProfileChange('notes', event.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-medium text-slate-700 placeholder:text-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none"
                                    placeholder="Transfer memo, branch move, or payroll note."
                                />
                            </label>

                            <div className="flex justify-end">
                                <button
                                    onClick={handleCreateProfile}
                                    disabled={savingProfile}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition text-[11px] font-black uppercase tracking-widest disabled:opacity-60"
                                >
                                    {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    Save Payroll Segment
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <SectionHeader
                            icon={<ShieldCheck size={18} strokeWidth={2.2} />}
                            title="Unified Deduction Plan"
                            caption="Salary-version deductions and employee assignments are merged here before payroll calculation."
                        />

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Lines</p>
                                <p className="text-lg font-black text-slate-900 mt-1">{deductionPlan?.summary?.totalCount || 0}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-amber-50 px-4 py-3">
                                <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Pre-Tax</p>
                                <p className="text-lg font-black text-amber-700 mt-1">{deductionPlan?.summary?.preTaxCount || 0}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-rose-50 px-4 py-3">
                                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Post-Tax</p>
                                <p className="text-lg font-black text-rose-700 mt-1">{deductionPlan?.summary?.postTaxCount || 0}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-blue-50 px-4 py-3">
                                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Merged Duplicates</p>
                                <p className="text-lg font-black text-blue-700 mt-1">{deductionPlan?.duplicates?.length || 0}</p>
                            </div>
                        </div>

                        {(deductionPlan?.duplicates || []).length > 0 && (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle size={16} className="text-amber-600" />
                                    <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest">Merged duplicate deduction sources</p>
                                </div>
                                <div className="space-y-2">
                                    {deductionPlan.duplicates.map((item, index) => (
                                        <p key={`${item.key}-${index}`} className="text-[11px] font-semibold text-amber-800">
                                            {item.discarded} was folded into {item.kept}.
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {planItems.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-[12px] font-semibold text-slate-400">
                                No deduction lines are active for this employee on {formatDate(deductionPlan?.effectiveDate)}.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {planItems.map((item, index) => (
                                    <div key={`${item.name}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-[12px] font-black text-slate-900 uppercase">{item.name}</p>
                                                <ToneChip value={item.category} tone={item.category === 'PRE_TAX' ? 'amber' : 'rose'} />
                                                <ToneChip value={item.source} tone={item.source === 'SALARY_VERSION' ? 'indigo' : 'blue'} />
                                            </div>
                                            <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-widest">
                                                {item.amountType} · {item.calculationBase || 'GROSS'} · {item.statutoryCategory || 'OTHER'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[12px] font-black text-slate-800">
                                                {item.amountType === 'PERCENTAGE' ? `${item.amountValue}%` : formatInr(item.amountValue)}
                                            </p>
                                            {item.employeeDeductionId && (
                                                <p className="text-[10px] font-semibold text-slate-400">Employee assignment active</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <SectionHeader
                            icon={<WalletCards size={18} strokeWidth={2.2} />}
                            title="Employee Deduction Assignments"
                            caption="These are the effective-dated employee-level deductions that now merge into the live payroll deduction plan."
                        />

                        {deductionAssignments.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-[12px] font-semibold text-slate-400">
                                No employee deduction assignments found.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {deductionAssignments.map((assignment) => (
                                    <div key={assignment._id} className="rounded-2xl border border-slate-100 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-[12px] font-black text-slate-900 uppercase">{assignment.name}</p>
                                                <ToneChip value={assignment.category} tone={assignment.category === 'PRE_TAX' ? 'amber' : 'rose'} />
                                                <ToneChip value={assignment.status} tone={assignment.status === 'ACTIVE' ? 'emerald' : 'slate'} />
                                            </div>
                                            <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-widest">
                                                {formatDate(assignment.startDate)}{assignment.endDate ? ` - ${formatDate(assignment.endDate)}` : ' onwards'} · {assignment.source}
                                            </p>
                                            {assignment.notes && (
                                                <p className="text-[11px] font-medium text-slate-500 mt-2">{assignment.notes}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-right">
                                                <p className="text-[12px] font-black text-slate-800">
                                                    {assignment.amountType === 'PERCENTAGE' ? `${assignment.amountValue}%` : formatInr(assignment.amountValue)}
                                                </p>
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{assignment.deductionType}</p>
                                            </div>
                                            {canManage && (
                                                <button
                                                    onClick={() => handleDeleteAssignment(assignment._id)}
                                                    disabled={busyAssignmentId === assignment._id}
                                                    className="w-9 h-9 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition flex items-center justify-center disabled:opacity-60"
                                                    title="Delete assignment"
                                                >
                                                    {busyAssignmentId === assignment._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {canManage && (
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    <SelectField
                                        label="Deduction Master"
                                        value={deductionForm.deductionId}
                                        onChange={(value) => handleDeductionChange('deductionId', value)}
                                        options={[
                                            { value: '', label: 'Select deduction' },
                                            ...deductionMasters.map((master) => ({
                                                value: master._id,
                                                label: `${master.name} (${master.category})`
                                            }))
                                        ]}
                                    />
                                    <Field label="Start Date" type="date" value={deductionForm.startDate} onChange={(value) => handleDeductionChange('startDate', value)} />
                                    <Field label="End Date" type="date" value={deductionForm.endDate} onChange={(value) => handleDeductionChange('endDate', value)} />
                                    <Field label="Custom Value" value={deductionForm.customValue} onChange={(value) => handleDeductionChange('customValue', value)} placeholder="Override amount or percentage" />
                                    <SelectField
                                        label="Deduction Type"
                                        value={deductionForm.deductionType}
                                        onChange={(value) => handleDeductionChange('deductionType', value)}
                                        options={[
                                            { value: '', label: 'Use master default' },
                                            { value: 'RECURRING', label: 'Recurring' },
                                            { value: 'ONE_TIME', label: 'One Time' },
                                            { value: 'LOAN', label: 'Loan' },
                                            { value: 'ADVANCE', label: 'Advance' },
                                            { value: 'STATUTORY', label: 'Statutory' },
                                            { value: 'MANUAL', label: 'Manual' },
                                            { value: 'LEAVE', label: 'Leave' },
                                            { value: 'DISCIPLINARY', label: 'Disciplinary' }
                                        ]}
                                    />
                                    <SelectField
                                        label="Category Override"
                                        value={deductionForm.categoryOverride}
                                        onChange={(value) => handleDeductionChange('categoryOverride', value)}
                                        options={[
                                            { value: '', label: 'Use master category' },
                                            { value: 'PRE_TAX', label: 'Pre-Tax' },
                                            { value: 'POST_TAX', label: 'Post-Tax' }
                                        ]}
                                    />
                                    <SelectField
                                        label="Amount Type Override"
                                        value={deductionForm.amountTypeOverride}
                                        onChange={(value) => handleDeductionChange('amountTypeOverride', value)}
                                        options={[
                                            { value: '', label: 'Use master amount type' },
                                            { value: 'FIXED', label: 'Fixed' },
                                            { value: 'PERCENTAGE', label: 'Percentage' }
                                        ]}
                                    />
                                    <SelectField
                                        label="Calculation Base"
                                        value={deductionForm.calculationBaseOverride}
                                        onChange={(value) => handleDeductionChange('calculationBaseOverride', value)}
                                        options={[
                                            { value: '', label: 'Use master base' },
                                            { value: 'GROSS', label: 'Gross' },
                                            { value: 'BASIC', label: 'Basic' }
                                        ]}
                                    />
                                    <Field label="Installment Amount" value={deductionForm.installmentAmount} onChange={(value) => handleDeductionChange('installmentAmount', value)} placeholder="Optional" />
                                    <Field label="Remaining Installments" value={deductionForm.remainingInstallments} onChange={(value) => handleDeductionChange('remainingInstallments', value)} placeholder="Optional" />
                                </div>

                                <label className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</span>
                                    <textarea
                                        rows={3}
                                        value={deductionForm.notes}
                                        onChange={(event) => handleDeductionChange('notes', event.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-medium text-slate-700 placeholder:text-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none"
                                        placeholder="Recovery note, EMI reference, or approval context."
                                    />
                                </label>

                                <div className="flex justify-end">
                                    <button
                                        onClick={handleAssignDeduction}
                                        disabled={savingDeduction}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition text-[11px] font-black uppercase tracking-widest disabled:opacity-60"
                                    >
                                        {savingDeduction ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                        Add Deduction Assignment
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
