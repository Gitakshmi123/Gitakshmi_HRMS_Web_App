import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, InputNumber, Input, message, Tag, Space } from 'antd';
import { Plus, Search, Calendar, Landmark, Check, X } from 'lucide-react';
import api from '../../../utils/api';

export default function Arrears() {
    const [employees, setEmployees] = useState([]);
    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [form] = Form.useForm();

    const currentMonthLabel = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    useEffect(() => {
        loadEmployees();
        loadAdjustments();
    }, []);

    async function loadEmployees() {
        try {
            const res = await api.get('/hr/employees');
            setEmployees(res.data?.data || []);
        } catch (err) {
            console.error('Failed to load employee list', err);
        }
    }

    async function loadAdjustments() {
        setLoading(true);
        try {
            const res = await api.get(`/payroll/corrections/pending?month=${currentMonthLabel}`);
            setAdjustments(res.data?.data || []);
        } catch (err) {
            message.error('Failed to load payroll adjustments');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateAdjustment(values) {
        try {
            const payload = {
                employeeId: values.employeeId,
                adjustmentMonth: currentMonthLabel,
                adjustmentType: values.type, // 'ARREAR' or 'BONUS_CORRECTION' etc.
                adjustmentAmount: values.type === 'DEBIT' ? -Math.abs(values.amount) : Math.abs(values.amount),
                reason: values.reason,
                metadata: {}
            };

            await api.post('/payroll/corrections', payload);
            message.success('Payroll adjustment created successfully and sent for approval');
            setModalVisible(false);
            form.resetFields();
            loadAdjustments();
        } catch (err) {
            message.error(err.response?.data?.message || err.response?.data?.error || 'Failed to create adjustment');
        }
    }

    async function handleApprove(id) {
        try {
            await api.patch(`/payroll/corrections/${id}/approve`, {});
            message.success('Adjustment approved successfully');
            loadAdjustments();
        } catch (err) {
            message.error('Failed to approve adjustment');
        }
    }

    async function handleReject(id) {
        try {
            await api.patch(`/payroll/corrections/${id}/reject`, {});
            message.success('Adjustment rejected successfully');
            loadAdjustments();
        } catch (err) {
            message.error('Failed to reject adjustment');
        }
    }

    const filteredAdjustments = adjustments.filter(adj => {
        const term = searchTerm.toLowerCase();
        const emp = adj.employeeId || {};
        const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
        const code = (emp.employeeId || '').toLowerCase();
        return fullName.includes(term) || code.includes(term);
    });

    const columns = [
        {
            title: 'Employee ID',
            key: 'employeeId',
            render: (_, record) => record.employeeId?.employeeId || '-'
        },
        {
            title: 'Employee Name',
            key: 'employeeName',
            render: (_, record) => record.employeeId ? `${record.employeeId.firstName} ${record.employeeId.lastName}` : '-'
        },
        {
            title: 'Month',
            dataIndex: 'adjustmentMonth',
            key: 'adjustmentMonth'
        },
        {
            title: 'Type',
            dataIndex: 'adjustmentType',
            key: 'adjustmentType',
            render: (type) => (
                <Tag color={type === 'DEBIT' ? 'red' : 'green'}>
                    {type}
                </Tag>
            )
        },
        {
            title: 'Amount',
            dataIndex: 'adjustmentAmount',
            key: 'adjustmentAmount',
            render: (amt) => (
                <span className={amt < 0 ? 'text-red-500 font-bold' : 'text-green-500 font-bold'}>
                    {amt < 0 ? '-' : '+'}₹{Math.abs(amt).toLocaleString()}
                </span>
            )
        },
        {
            title: 'Reason',
            dataIndex: 'reason',
            key: 'reason'
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                let color = 'gold';
                if (status === 'APPROVED') color = 'green';
                if (status === 'REJECTED') color = 'red';
                return <Tag color={color}>{status}</Tag>;
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => {
                if (record.status === 'PENDING_APPROVAL') {
                    return (
                        <Space>
                            <Button 
                                size="small" 
                                type="primary" 
                                className="bg-green-600 hover:bg-green-700 border-none"
                                icon={<Check size={14} />} 
                                onClick={() => handleApprove(record._id)}
                            >
                                Approve
                            </Button>
                            <Button 
                                size="small" 
                                type="primary" 
                                danger
                                icon={<X size={14} />} 
                                onClick={() => handleReject(record._id)}
                            >
                                Reject
                            </Button>
                        </Space>
                    );
                }
                return '-';
            }
        }
    ];

    return (
        <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white">Arrears & One-time Payments</h1>
                    <p className="text-slate-500 text-xs mt-1">Request and approve one-time credits, debits, or salary arrears for the current payout month</p>
                </div>
                <Button type="primary" icon={<Plus size={16} />} onClick={() => setModalVisible(true)}>
                    New Adjustment / Arrear
                </Button>
            </div>

            <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 w-full max-w-sm">
                    <Search size={18} className="text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search by name or ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none outline-none w-full text-sm text-slate-700 dark:text-slate-300"
                    />
                </div>

                <Table 
                    columns={columns}
                    dataSource={filteredAdjustments}
                    rowKey="_id"
                    loading={loading}
                    className="border rounded-xl overflow-hidden"
                />
            </div>

            {/* Create Adjustment Modal */}
            <Modal
                title="Create Arrear / Payout Adjustment"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={() => form.submit()}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleCreateAdjustment}
                    initialValues={{ type: 'CREDIT' }}
                >
                    <Form.Item
                        label="Employee"
                        name="employeeId"
                        rules={[{ required: true, message: 'Please select employee' }]}
                    >
                        <Select 
                            showSearch
                            placeholder="Select Employee"
                            optionFilterProp="children"
                            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                            options={employees.map(e => ({ label: `${e.firstName} ${e.lastName} (${e.employeeId})`, value: e._id }))}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Adjustment Type"
                        name="type"
                        rules={[{ required: true }]}
                    >
                        <Select options={[{ label: 'Credit (Arrear / Addition)', value: 'CREDIT' }, { label: 'Debit (One-time Recovery / Deduction)', value: 'DEBIT' }]} />
                    </Form.Item>

                    <Form.Item
                        label="Adjustment Amount"
                        name="amount"
                        rules={[{ required: true, message: 'Please enter amount' }]}
                    >
                        <InputNumber min={1} className="w-full" formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => value.replace(/\₹\s?|(,*)/g, '')} />
                    </Form.Item>

                    <Form.Item
                        label="Audit Reason (Min 5 characters)"
                        name="reason"
                        rules={[{ required: true, min: 5, message: 'A detailed reason (min 5 chars) is mandatory for audit.' }]}
                    >
                        <textarea className="w-full border rounded-lg p-2 text-sm focus:outline-none" rows={3} placeholder="Please provide specific reasoning for this adjustment (e.g. Arrear for April month performance bonus error correction)..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
