import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Select, InputNumber, DatePicker, message, Drawer, Space, Tag, Divider } from 'antd';
import { Search, ChevronRight, FileCheck2, Calculator, Landmark } from 'lucide-react';
import api from '../../../utils/api';
import dayjs from 'dayjs';

export default function TdsDeclarations() {
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [taxProfile, setTaxProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [form] = Form.useForm();

    useEffect(() => {
        loadEmployees();
    }, []);

    async function loadEmployees() {
        setLoading(true);
        try {
            const res = await api.get('/hr/employees');
            setEmployees(res.data?.data || []);
        } catch (err) {
            message.error('Failed to load employee list');
        } finally {
            setLoading(false);
        }
    }

    async function handleEmployeeClick(emp) {
        setSelectedEmployee(emp);
        setDrawerVisible(true);
        loadTaxProfile(emp._id);
    }

    async function loadTaxProfile(empId) {
        try {
            const res = await api.get(`/payroll/employees/${empId}/tax-profile`);
            if (res.data?.success && res.data?.data) {
                const profile = res.data.data;
                setTaxProfile(profile);
                form.setFieldsValue({
                    regime: profile.regime || 'NEW',
                    financialYearLabel: profile.financialYearLabel || '2026-2027',
                    section80C: profile.declarations?.section80C || 0,
                    section80D: profile.declarations?.section80D || 0,
                    section80CCD1B: profile.declarations?.section80CCD1B || 0,
                    hraExemption: profile.declarations?.hraExemption || 0,
                    homeLoanInterest: profile.declarations?.homeLoanInterest || 0,
                    otherExemptions: profile.declarations?.otherExemptions || 0,
                    otherIncome: profile.projections?.otherIncome || 0,
                    previousEmployerIncome: profile.projections?.previousEmployerIncome || 0,
                    taxAlreadyDeducted: profile.projections?.taxAlreadyDeducted || 0,
                    proofStatus: profile.proofStatus || 'NOT_SUBMITTED',
                    notes: profile.notes || ''
                });
            } else {
                setTaxProfile(null);
                form.resetFields();
                form.setFieldsValue({ regime: 'NEW', financialYearLabel: '2026-2027' });
            }
        } catch (err) {
            setTaxProfile(null);
            form.resetFields();
            form.setFieldsValue({ regime: 'NEW', financialYearLabel: '2026-2027' });
        }
    }

    async function handleSaveTaxProfile(values) {
        try {
            const payload = {
                regime: values.regime,
                financialYearLabel: values.financialYearLabel,
                declarations: {
                    section80C: values.section80C || 0,
                    section80D: values.section80D || 0,
                    section80CCD1B: values.section80CCD1B || 0,
                    hraExemption: values.hraExemption || 0,
                    homeLoanInterest: values.homeLoanInterest || 0,
                    otherExemptions: values.otherExemptions || 0
                },
                projections: {
                    previousEmployerIncome: values.previousEmployerIncome || 0,
                    otherIncome: values.otherIncome || 0,
                    taxAlreadyDeducted: values.taxAlreadyDeducted || 0
                },
                proofStatus: values.proofStatus || 'NOT_SUBMITTED',
                effectiveFrom: new Date().toISOString(),
                notes: values.notes || ''
            };

            await api.post(`/payroll/employees/${selectedEmployee._id}/tax-profile`, payload);
            message.success('Tax profile and declarations updated successfully');
            loadTaxProfile(selectedEmployee._id);
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to update tax profile');
        }
    }

    const filteredEmployees = employees.filter(emp => {
        const term = searchTerm.toLowerCase();
        const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
        const code = (emp.employeeId || '').toLowerCase();
        return fullName.includes(term) || code.includes(term);
    });

    const columns = [
        {
            title: 'Employee ID',
            dataIndex: 'employeeId',
            key: 'employeeId',
            sorter: (a, b) => (a.employeeId || '').localeCompare(b.employeeId || '')
        },
        {
            title: 'Name',
            key: 'name',
            render: (_, record) => `${record.firstName || ''} ${record.lastName || ''}`
        },
        {
            title: 'Department',
            dataIndex: 'department',
            key: 'department'
        },
        {
            title: 'Designation',
            dataIndex: 'designation',
            key: 'designation'
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <Button 
                    type="link" 
                    icon={<ChevronRight size={16} />} 
                    onClick={() => handleEmployeeClick(record)}
                >
                    Manage Tax Profile
                </Button>
            )
        }
    ];

    return (
        <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white">TDS Declaration & Tax Settings</h1>
                    <p className="text-slate-500 text-xs mt-1">Manage employee income tax regimes, investment declarations (80C, 80D), and projections</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 w-full max-w-sm">
                    <Search size={18} className="text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search employee by name or ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none outline-none w-full text-sm text-slate-700 dark:text-slate-300"
                    />
                </div>

                <Table 
                    columns={columns}
                    dataSource={filteredEmployees}
                    rowKey="_id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    className="border rounded-xl overflow-hidden"
                />
            </div>

            {/* Tax Profile Drawer */}
            <Drawer
                title={selectedEmployee ? `Tax Declarations: ${selectedEmployee.firstName} ${selectedEmployee.lastName}` : ''}
                placement="right"
                width={650}
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
                extra={
                    <Space>
                        <Button onClick={() => setDrawerVisible(false)}>Cancel</Button>
                        <Button type="primary" onClick={() => form.submit()}>Save Changes</Button>
                    </Space>
                }
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSaveTaxProfile}
                >
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            label="Tax Regime"
                            name="regime"
                            rules={[{ required: true }]}
                        >
                            <Select options={[{ label: 'Old Regime (with deductions)', value: 'OLD' }, { label: 'New Regime (simplified)', value: 'NEW' }]} />
                        </Form.Item>

                        <Form.Item
                            label="Financial Year"
                            name="financialYearLabel"
                            rules={[{ required: true }]}
                        >
                            <Select options={[{ label: 'FY 2026 - 2027', value: '2026-2027' }, { label: 'FY 2025 - 2026', value: '2025-2026' }]} />
                        </Form.Item>
                    </div>

                    <Form.Item
                        label="Proof Verification Status"
                        name="proofStatus"
                    >
                        <Select options={[
                            { label: 'Not Submitted', value: 'NOT_SUBMITTED' },
                            { label: 'Submitted (Pending verification)', value: 'SUBMITTED' },
                            { label: 'Verified & Approved', value: 'VERIFIED' },
                            { label: 'Rejected', value: 'REJECTED' }
                        ]} />
                    </Form.Item>

                    <Divider orientation="left"><span className="text-sm font-black flex items-center gap-1"><FileCheck2 size={16} /> Section 80 Deductions (Old Regime Only)</span></Divider>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item label="Section 80C (Max 1.5L)" name="section80C">
                            <InputNumber className="w-full" min={0} />
                        </Form.Item>

                        <Form.Item label="Section 80D (Medical Ins)" name="section80D">
                            <InputNumber className="w-full" min={0} />
                        </Form.Item>

                        <Form.Item label="Section 80CCD(1B) (NPS)" name="section80CCD1B">
                            <InputNumber className="w-full" min={0} />
                        </Form.Item>
                    </div>

                    <Divider orientation="left"><span className="text-sm font-black flex items-center gap-1"><Landmark size={16} /> Housing & Exemptions</span></Divider>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item label="HRA Exemption / Annual Rent" name="hraExemption">
                            <InputNumber className="w-full" min={0} />
                        </Form.Item>

                        <Form.Item label="Home Loan Interest paid" name="homeLoanInterest">
                            <InputNumber className="w-full" min={0} />
                        </Form.Item>

                        <Form.Item label="Other Exemptions" name="otherExemptions">
                            <InputNumber className="w-full" min={0} />
                        </Form.Item>
                    </div>

                    <Divider orientation="left"><span className="text-sm font-black flex items-center gap-1"><Calculator size={16} /> Projections & Income Adjustments</span></Divider>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item label="Other Taxable Income" name="otherIncome">
                            <InputNumber className="w-full" min={0} />
                        </Form.Item>

                        <Form.Item label="Previous Employer Income" name="previousEmployerIncome">
                            <InputNumber className="w-full" min={0} />
                        </Form.Item>

                        <Form.Item label="TDS Already Deducted" name="taxAlreadyDeducted">
                            <InputNumber className="w-full" min={0} />
                        </Form.Item>
                    </div>

                    <Form.Item
                        label="HR Notes"
                        name="notes"
                    >
                        <textarea className="w-full border rounded-lg p-2 text-sm focus:outline-none" rows={3} placeholder="Add custom notes..." />
                    </Form.Item>
                </Form>
            </Drawer>
        </div>
    );
}
