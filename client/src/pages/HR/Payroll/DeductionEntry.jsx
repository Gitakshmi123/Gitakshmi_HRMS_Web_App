import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, InputNumber, DatePicker, message, Drawer, Tag } from 'antd';
import { Plus, Search, Calendar, Landmark, ChevronRight } from 'lucide-react';
import api from '../../../utils/api';

export default function DeductionEntry() {
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [employeeDeductions, setEmployeeDeductions] = useState([]);
    const [masterDeductions, setMasterDeductions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [form] = Form.useForm();

    useEffect(() => {
        loadInitialData();
    }, []);

    async function loadInitialData() {
        setLoading(true);
        try {
            const [empRes, dedRes] = await Promise.all([
                api.get('/hr/employees'),
                api.get('/deductions')
            ]);
            setEmployees(empRes.data?.data || []);
            // Filter to actual deductions (recurring, one-time, pre-tax, post-tax)
            setMasterDeductions((dedRes.data?.data || []).filter(d => !['LOAN', 'ADVANCE'].includes(d.deductionType || d.category)));
        } catch (err) {
            message.error('Failed to load employee or deduction configs');
        } finally {
            setLoading(false);
        }
    }

    async function handleEmployeeClick(emp) {
        setSelectedEmployee(emp);
        setDrawerVisible(true);
        loadEmployeeDeductions(emp._id);
    }

    async function loadEmployeeDeductions(empId) {
        try {
            const res = await api.get(`/deductions/employee/${empId}`);
            // Filter out loans/advances
            const filtered = (res.data?.data || []).filter(d => 
                !['LOAN', 'ADVANCE'].includes(d.deductionType)
            );
            setEmployeeDeductions(filtered);
        } catch (err) {
            message.error('Failed to load employee deductions');
        }
    }

    async function handleAssignDeduction(values) {
        try {
            const payload = {
                employeeId: selectedEmployee._id,
                deductionId: values.deductionId,
                startDate: values.startDate.format('YYYY-MM-DD'),
                endDate: values.endDate ? values.endDate.format('YYYY-MM-DD') : null,
                customValue: values.amount,
                deductionType: values.type,
                notes: values.notes || '',
                status: 'ACTIVE'
            };

            await api.post('/deductions/assign', payload);
            message.success('Deduction assigned successfully');
            setModalVisible(false);
            form.resetFields();
            loadEmployeeDeductions(selectedEmployee._id);
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to assign deduction');
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
                    Deductions
                </Button>
            )
        }
    ];

    const dedColumns = [
        {
            title: 'Type',
            dataIndex: 'deductionType',
            key: 'deductionType',
            render: (type) => (
                <Tag color={type === 'RECURRING' ? 'blue' : 'purple'}>
                    {type}
                </Tag>
            )
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name'
        },
        {
            title: 'Amount',
            dataIndex: 'amountValue',
            key: 'amountValue',
            render: (val) => `₹${val?.toLocaleString() || 0}`
        },
        {
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
            render: (cat) => <Tag color={cat === 'PRE_TAX' ? 'cyan' : 'magenta'}>{cat}</Tag>
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                let color = 'green';
                if (status === 'INACTIVE') color = 'gray';
                if (status === 'COMPLETED') color = 'blue';
                return <Tag color={color}>{status}</Tag>;
            }
        }
    ];

    return (
        <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white">Deduction Entry</h1>
                    <p className="text-slate-500 text-xs mt-1">Configure recurring and one-time deductions for employees</p>
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

            {/* Employee Deductions Detail Drawer */}
            <Drawer
                title={selectedEmployee ? `Deductions: ${selectedEmployee.firstName} ${selectedEmployee.lastName}` : ''}
                placement="right"
                width={700}
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
                extra={
                    <Button 
                        type="primary" 
                        icon={<Plus size={16} />} 
                        onClick={() => setModalVisible(true)}
                    >
                        New Entry
                    </Button>
                }
            >
                <div className="space-y-6">
                    <Table 
                        columns={dedColumns}
                        dataSource={employeeDeductions}
                        rowKey="_id"
                        pagination={false}
                        className="border rounded-xl overflow-hidden"
                    />
                </div>
            </Drawer>

            {/* Assign Deduction Modal */}
            <Modal
                title="Create Deduction Entry"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={() => form.submit()}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleAssignDeduction}
                    initialValues={{ type: 'RECURRING' }}
                >
                    <Form.Item
                        label="Deduction Type"
                        name="type"
                        rules={[{ required: true }]}
                    >
                        <Select options={[{ label: 'Recurring', value: 'RECURRING' }, { label: 'One Time', value: 'ONE_TIME' }]} />
                    </Form.Item>

                    <Form.Item
                        label="Select Deduction Master Config"
                        name="deductionId"
                        rules={[{ required: true, message: 'Please select config' }]}
                    >
                        <Select 
                            placeholder="Select Configuration"
                            options={masterDeductions.map(d => ({ label: `${d.name} (${d.category})`, value: d._id }))}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Deduction Amount"
                        name="amount"
                        rules={[{ required: true, message: 'Please enter amount' }]}
                    >
                        <InputNumber min={1} className="w-full" formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => value.replace(/\₹\s?|(,*)/g, '')} />
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            label="Start Date"
                            name="startDate"
                            rules={[{ required: true }]}
                        >
                            <DatePicker className="w-full" />
                        </Form.Item>

                        <Form.Item
                            label="End Date (Optional)"
                            name="endDate"
                        >
                            <DatePicker className="w-full" />
                        </Form.Item>
                    </div>

                    <Form.Item
                        label="Notes"
                        name="notes"
                    >
                        <textarea className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" rows={3} placeholder="Add comments or justification..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
