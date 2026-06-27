import React, { useState, useEffect } from 'react';
import { Button, Select, Space, message, Tag } from 'antd';
import { Search, Download, Printer, Landmark, FileText, User } from 'lucide-react';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';

export default function PayslipView() {
    const [employees, setEmployees] = useState([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [payslip, setPayslip] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    useEffect(() => {
        loadEmployees();
    }, []);

    useEffect(() => {
        if (selectedEmployeeId) {
            loadPayslip();
        } else {
            setPayslip(null);
        }
    }, [selectedEmployeeId, selectedMonth, selectedYear]);

    async function loadEmployees() {
        try {
            const res = await api.get('/hr/employees');
            const data = res.data?.data || [];
            setEmployees(data);
            if (data.length > 0) {
                setSelectedEmployeeId(data[0]._id);
            }
        } catch (err) {
            message.error('Failed to load employee list');
        }
    }

    async function loadPayslip() {
        setLoading(true);
        try {
            const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
            const res = await api.get(`/payroll/payslips/${selectedEmployeeId}?month=${monthStr}`);
            if (res.data?.success && res.data?.data) {
                setPayslip(res.data.data.payslip || res.data.data);
            } else {
                setPayslip(null);
            }
        } catch (err) {
            setPayslip(null);
        } finally {
            setLoading(false);
        }
    }

    async function handleDownloadPdf() {
        if (!payslip) return;
        setDownloading(true);
        try {
            showToast('info', 'Processing', 'Generating your payslip PDF...');
            const res = await api.post(`/payroll/payslips/${payslip._id}/generate-pdf`, {}, { responseType: 'blob' });
            
            // Trigger browser download
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = `Payslip_${monthNames[selectedMonth - 1]}_${selectedYear}.pdf`;
            link.click();
            message.success('Payslip downloaded successfully');
        } catch (err) {
            message.error('Failed to download payslip PDF');
        } finally {
            setDownloading(false);
        }
    }

    return (
        <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white">Employee Payslip View</h1>
                    <p className="text-slate-500 text-xs mt-1">Search employee and preview generated payslip slips in detail</p>
                </div>
                <Space>
                    <Button 
                        type="primary" 
                        icon={<Download size={16} />} 
                        disabled={!payslip} 
                        loading={downloading}
                        onClick={handleDownloadPdf}
                    >
                        Download PDF
                    </Button>
                    <Button 
                        icon={<Printer size={16} />} 
                        disabled={!payslip}
                        onClick={() => window.print()}
                    >
                        Print
                    </Button>
                </Space>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employee:</span>
                    <Select 
                        showSearch
                        value={selectedEmployeeId}
                        onChange={(val) => setSelectedEmployeeId(val)}
                        placeholder="Select Employee"
                        optionFilterProp="children"
                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={employees.map(e => ({ label: `${e.firstName} ${e.lastName} (${e.employeeId})`, value: e._id }))}
                        className="w-64"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Month:</span>
                    <Select 
                        value={selectedMonth}
                        onChange={(val) => setSelectedMonth(val)}
                        options={monthNames.map((name, i) => ({ label: name, value: i + 1 }))}
                        className="w-36"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Year:</span>
                    <Select 
                        value={selectedYear}
                        onChange={(val) => setSelectedYear(val)}
                        options={[2026, 2025, 2024].map(y => ({ label: String(y), value: y }))}
                        className="w-28"
                    />
                </div>
            </div>

            {/* Payslip Visual Mockup (Card 14 style) */}
            {loading ? (
                <div className="bg-white p-12 rounded-2xl border text-center text-slate-400 shadow-sm">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                    <p>Loading payslip slip...</p>
                </div>
            ) : payslip ? (
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-8 max-w-4xl mx-auto shadow-md space-y-6 text-slate-800 dark:text-slate-300">
                    <div className="text-center border-b pb-4">
                        <h2 className="text-xl font-black text-blue-600 dark:text-blue-500">Gitakshmi IT Solutions Pvt. Ltd.</h2>
                        <p className="text-xs text-slate-400 mt-1">Payslip for the month of {monthNames[payslip.month - 1]} {payslip.year}</p>
                    </div>

                    {/* Employee Info Grid */}
                    <div className="grid grid-cols-2 gap-y-3 gap-x-12 text-sm border-b pb-4">
                        <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Employee ID:</span>
                            <span className="font-bold">{payslip.employeeInfo?.employeeId || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Bank Name:</span>
                            <span className="font-bold">{payslip.employeeInfo?.bankName || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Name:</span>
                            <span className="font-bold">{payslip.employeeInfo?.name || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Account No:</span>
                            <span className="font-bold">{payslip.employeeInfo?.bankAccountNumber || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Department:</span>
                            <span className="font-bold">{payslip.employeeInfo?.department || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">IFSC Code:</span>
                            <span className="font-bold">{payslip.employeeInfo?.bankIFSC || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Designation:</span>
                            <span className="font-bold">{payslip.employeeInfo?.designation || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Joining Date:</span>
                            <span className="font-bold">{payslip.employeeInfo?.joiningDate ? new Date(payslip.employeeInfo.joiningDate).toLocaleDateString() : '-'}</span>
                        </div>
                    </div>

                    {/* Earnings & Deductions Columns */}
                    <div className="grid grid-cols-2 gap-8 border-b pb-4">
                        {/* Earnings */}
                        <div className="space-y-3">
                            <h3 className="text-xs uppercase font-bold text-slate-400 border-b pb-1">Earnings</h3>
                            <div className="space-y-2">
                                {(payslip.earningsSnapshot || []).map((e, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span>{e.name}</span>
                                        <span className="font-medium">₹{e.amount?.toLocaleString() || 0}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Deductions */}
                        <div className="space-y-3">
                            <h3 className="text-xs uppercase font-bold text-slate-400 border-b pb-1">Deductions</h3>
                            <div className="space-y-2">
                                {(payslip.preTaxDeductionsSnapshot || []).map((d, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span>{d.name}</span>
                                        <span className="font-medium">₹{d.amount?.toLocaleString() || 0}</span>
                                    </div>
                                ))}
                                {payslip.incomeTax > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span>Income Tax (TDS)</span>
                                        <span className="font-medium">₹{payslip.incomeTax.toLocaleString()}</span>
                                    </div>
                                )}
                                {(payslip.postTaxDeductionsSnapshot || []).map((d, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span>{d.name}</span>
                                        <span className="font-medium">₹{d.amount?.toLocaleString() || 0}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Summary Totals */}
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400">Gross Earnings</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">₹{payslip.grossEarnings?.toLocaleString() || 0}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400">Total Deductions</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                ₹{((payslip.preTaxDeductionsTotal || 0) + (payslip.incomeTax || 0) + (payslip.postTaxDeductionsTotal || 0)).toLocaleString()}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-blue-500">Net Pay Payout</p>
                            <p className="text-lg font-black text-blue-600 dark:text-blue-500">₹{payslip.netPay?.toLocaleString() || 0}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-16 text-center text-slate-400 shadow-sm flex flex-col items-center justify-center">
                    <FileText size={48} className="stroke-1 mb-2 text-slate-300" />
                    <p className="text-sm font-medium">No payslip generated for the selected employee in this month.</p>
                </div>
            )}
        </div>
    );
}
