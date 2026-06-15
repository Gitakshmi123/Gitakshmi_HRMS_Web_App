import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Table, Input, InputNumber, Select, Space, Modal } from 'antd';
import { message } from '../../utils/antdGlobal';
import { History, Save, X, CheckCircle2, XCircle } from 'lucide-react';
import api from '../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;

const PayrollCorrectionModal = ({ visible, onCancel, payrollRun }) => {
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    // Correction State
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
    const [correctionType, setCorrectionType] = useState('MANUAL_ADJUSTMENT');
    const [correctionAmount, setCorrectionAmount] = useState(0);
    const [reason, setReason] = useState('');
    const [targetMonth, setTargetMonth] = useState('');

    // Audit History state
    const [existingCorrections, setExistingCorrections] = useState([]);
    const [approving, setApproving] = useState(false);

    useEffect(() => {
        if (visible && payrollRun) {
            fetchPayslips();
            fetchExistingCorrections();

            // Default target month is next month
            const nextMonth = dayjs(`${payrollRun.year}-${payrollRun.month}-01`).add(1, 'month').format('YYYY-MM');
            setTargetMonth(nextMonth);

            // Reset form
            setSelectedEmployeeId(null);
            setCorrectionAmount(0);
            setReason('');
        }
    }, [visible, payrollRun]);

    const fetchPayslips = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/payroll/payslips?payrollRunId=${payrollRun._id}`);
            const data = res.data?.data || [];
            setEmployees(data);
        } catch (err) {
            message.error("Failed to load employee list from this payroll run");
        } finally {
            setLoading(false);
        }
    };

    const fetchExistingCorrections = async () => {
        try {
            const res = await api.get(`/payroll/corrections/run/${payrollRun._id}`);
            setExistingCorrections(res.data?.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmitCorrection = async () => {
        if (!selectedEmployeeId) return message.warning("Please select an employee");
        if (correctionAmount === 0) return message.warning("Correction amount cannot be zero");
        if (!reason || reason.trim().length < 5) return message.warning("Please provide a detailed reason (min 5 chars)");

        const employee = employees.find(e => e.employeeId === selectedEmployeeId || e._id === selectedEmployeeId);

        setSubmitting(true);
        try {
            await api.post('/payroll/corrections', {
                employeeId: employee.employeeId?._id || employee.employeeId,
                payrollRunId: payrollRun._id,
                adjustmentMonth: targetMonth,
                adjustmentType: correctionType,
                adjustmentAmount: correctionAmount,
                reason: reason.trim(),
                metadata: {
                    originalGross: employee.grossEarnings,
                    originalNet: employee.netPay,
                    correctedBy: 'Admin'
                }
            });

            message.success("Adjustment scheduled for " + targetMonth);
            fetchExistingCorrections();

            // Reset form
            setSelectedEmployeeId(null);
            setCorrectionAmount(0);
            setReason('');
        } catch (err) {
            message.error(err.response?.data?.message || "Failed to create correction");
        } finally {
            setSubmitting(false);
        }
    };

    const handleApprove = async (id) => {
        setApproving(true);
        try {
            await api.patch(`/payroll/corrections/${id}/approve`);
            message.success("Adjustment approved");
            fetchExistingCorrections();
        } catch (err) {
            message.error(err.response?.data?.message || "Failed to approve");
        } finally {
            setApproving(false);
        }
    };

    const handleReject = async (id) => {
        Modal.confirm({
            title: 'Reject Adjustment',
            content: (
                <div className="mt-4">
                    <label className="block text-xs font-bold mb-1">Rejection Reason (Required)</label>
                    <Input.TextArea id="rejection_reason" rows={3} />
                </div>
            ),
            okText: 'Reject',
            okType: 'danger',
            onOk: async () => {
                const reason = document.getElementById('rejection_reason').value;
                if (!reason || reason.length < 5) {
                    message.error("Please provide a valid rejection reason");
                    return Promise.reject();
                }
                try {
                    await api.patch(`/payroll/corrections/${id}/reject`, { approvalReason: reason });
                    message.success("Adjustment rejected");
                    fetchExistingCorrections();
                } catch (err) {
                    message.error(err.response?.data?.message || "Failed to reject");
                }
            }
        });
    };

    const getEmployeeName = (record) => {
        return record.employeeInfo?.name || record.employeeId?.name || "Unknown";
    };

    // ── Status chip (replaces Ant Tag in audit table) ──────────────────────────
    function StatusChip({ status }) {
        const cfg = {
            PENDING_APPROVAL: { dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700 border-amber-100' },
            APPROVED: { dot: 'bg-indigo-500', pill: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
            APPLIED: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            REJECTED: { dot: 'bg-rose-500', pill: 'bg-rose-50 text-rose-600 border-rose-100' },
            CANCELLED: { dot: 'bg-slate-400', pill: 'bg-slate-50 text-slate-500 border-slate-100' },
        };
        const s = cfg[status] || cfg.PENDING_APPROVAL;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${s.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {status?.replace('_', ' ')}
            </span>
        );
    }

    // ── Type badge (replaces Ant Tag) ──────────────────────────────────────────
    function TypeBadge({ type }) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100">
                {type?.replace(/_/g, ' ')}
            </span>
        );
    }

    const correctionColumns = [
        {
            title: 'Employee',
            key: 'employee',
            render: (_, record) => (
                <div>
                    <div className="text-[10px] font-black text-slate-700 uppercase">
                        {record.employeeId?.firstName} {record.employeeId?.lastName}
                    </div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">
                        {record.employeeId?.employeeId}
                    </div>
                </div>
            )
        },
        {
            title: 'Type',
            dataIndex: 'adjustmentType',
            key: 'type',
            render: (type) => <TypeBadge type={type} />
        },
        {
            title: 'Amount',
            dataIndex: 'adjustmentAmount',
            key: 'amount',
            render: (amt) => (
                <span className={`text-[10px] font-black ${amt >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {amt >= 0 ? '+' : ''}₹{amt.toLocaleString()}
                </span>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => <StatusChip status={status} />
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space size={4}>
                    {record.status === 'PENDING_APPROVAL' && (
                        <>
                            <button
                                onClick={() => handleApprove(record._id)}
                                disabled={approving}
                                className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-500 hover:text-white rounded-lg border border-emerald-100 text-[8px] font-black uppercase tracking-widest transition"
                            >
                                <CheckCircle2 size={9} /> Approve
                            </button>
                            <button
                                onClick={() => handleReject(record._id)}
                                className="flex items-center gap-1 px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg border border-rose-100 text-[8px] font-black uppercase tracking-widest transition"
                            >
                                <XCircle size={9} /> Reject
                            </button>
                        </>
                    )}
                </Space>
            )
        }
    ];

    if (!visible) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />

            {/* Modal */}
            <div className="relative bg-white dark:bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">

                {/* ── Modal Header ─────────────────────────────── */}
                <div className="flex-none flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-[#4F46E5] flex items-center justify-center border border-indigo-100 dark:border-indigo-800/40">
                            <History size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">
                                Payroll Correction
                            </h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {dayjs(new Date(0, payrollRun?.month - 1)).format('MMMM')} {payrollRun?.year}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600 rounded-xl transition"
                    >
                        <X size={16} />
                    </button>
                </div>


                {/* ── Body ──────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-0 p-6">

                        {/* ─ Left: Form ─────────────────────────── */}
                        <div className="md:col-span-1 md:pr-6 md:border-r border-slate-100 dark:border-slate-800 space-y-4">
                            {/* Section title */}
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-indigo-50 text-[#4F46E5] flex items-center justify-center border border-indigo-100">
                                    <Save size={11} strokeWidth={2.5} />
                                </div>
                                <h4 className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                                    New Adjustment
                                </h4>
                            </div>

                            {/* Select Employee */}
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                    Select Employee
                                </label>
                                <Select
                                    className="w-full"
                                    placeholder="Choose employee..."
                                    value={selectedEmployeeId}
                                    onChange={setSelectedEmployeeId}
                                    showSearch
                                    dropdownStyle={{ zIndex: 99999 }}
                                    filterOption={(input, option) =>
                                        option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                                    }
                                >
                                    {employees.map(emp => (
                                        <Option key={emp._id} value={emp._id}>
                                            {getEmployeeName(emp)} (Net: ₹{emp.netPay?.toLocaleString()})
                                        </Option>
                                    ))}
                                </Select>
                            </div>

                            {/* Original pay snapshot */}
                            {selectedEmployeeId && (
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'Original Gross', value: employees.find(e => e._id === selectedEmployeeId)?.grossEarnings },
                                        { label: 'Original Net', value: employees.find(e => e._id === selectedEmployeeId)?.netPay },
                                    ].map(f => (
                                        <div key={f.label} className="bg-slate-50 dark:bg-slate-950 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-800">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{f.label}</p>
                                            <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 mt-0.5">₹{f.value?.toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Correction Type */}
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                    Correction Type
                                </label>
                                <Select className="w-full" value={correctionType} onChange={setCorrectionType} dropdownStyle={{ zIndex: 99999 }}>
                                    <Option value="ATTENDANCE_CORRECTION">Attendance Correction</Option>
                                    <Option value="ALLOWANCE_MISSED">Allowance Missed</Option>
                                    <Option value="ALLOWANCE_EXTRA_RECOVERY">Extra Allowance Recovery</Option>
                                    <Option value="DEDUCTION_ERROR">Deduction Error</Option>
                                    <Option value="SALARY_INCREMENT_BACKDATED">Backdated Increment Arrear</Option>
                                    <Option value="MANUAL_ADJUSTMENT">Manual Adjustment</Option>
                                    <Option value="OTHER">Other</Option>
                                </Select>
                            </div>

                            {/* Adjustment Amount */}
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                    Adjustment Amount (+/-)
                                </label>
                                <InputNumber
                                    className="w-full"
                                    placeholder="0.00"
                                    value={correctionAmount}
                                    onChange={setCorrectionAmount}
                                    formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={value => value.replace(/\₹\s?|(,*)/g, '')}
                                />
                                <p className="text-[9px] font-bold text-slate-400 mt-1 italic">
                                    Note: Negative values will be deducted from next net pay.
                                </p>
                            </div>

                            {/* Mandatory Reason */}
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                    Mandatory Reason
                                </label>
                                <Input.TextArea
                                    placeholder="Why is this correction needed?"
                                    rows={3}
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                />
                            </div>

                            {/* Payout Month */}
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                    Payout Month
                                </label>
                                <Input
                                    value={targetMonth}
                                    onChange={e => setTargetMonth(e.target.value)}
                                    placeholder="YYYY-MM"
                                />
                            </div>

                            {/* Submit */}
                            <button
                                onClick={handleSubmitCorrection}
                                disabled={submitting || !selectedEmployeeId}
                                className="w-full py-2.5 bg-gradient-to-r from-[#4F46E5] to-[#0d9488] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm flex items-center justify-center gap-2"
                            >
                                {submitting
                                    ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : <Save size={12} strokeWidth={2.5} />
                                }
                                Schedule Adjustment
                            </button>
                        </div>

                        {/* ─ Right: Audit Log ────────────────────── */}
                        <div className="md:col-span-2 md:pl-6 space-y-4 mt-6 md:mt-0">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center border border-orange-100">
                                    <History size={11} strokeWidth={2.5} />
                                </div>
                                <h4 className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                                    Correction Audit Log
                                </h4>
                            </div>

                            <Table
                                dataSource={existingCorrections}
                                columns={correctionColumns}
                                rowKey="_id"
                                size="small"
                                pagination={{ pageSize: 5, size: 'small' }}
                                locale={{ emptyText: 'No corrections found for this payroll run.' }}
                            />

                            {existingCorrections.length > 0 && (
                                <div className="flex items-start gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                                    <AlertCircle size={13} className="text-[#4F46E5] mt-0.5 shrink-0" />
                                    <p className="text-[9px] font-bold text-indigo-700 dark:text-indigo-400/80 leading-relaxed">
                                        <strong>Impact:</strong> These adjustments will appear automatically when you run payroll for the respective scheduled months. Original payslips for{' '}
                                        {dayjs(new Date(0, payrollRun?.month - 1)).format('MMMM')} remain locked and untouched.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Modal Footer ──────────────────────────────── */}
                <div className="flex-none flex items-center justify-end px-6 py-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black uppercase tracking-widest transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
        , document.body);
};

export default PayrollCorrectionModal;
