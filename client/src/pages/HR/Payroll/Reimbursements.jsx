import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, InputNumber, Input, message, Tag, Space } from 'antd';
import { Plus, Search, Coins, Receipt } from 'lucide-react';
import api from '../../../utils/api';

export default function Reimbursements() {
    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [addItemModalVisible, setAddItemModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [itemForm] = Form.useForm();

    const selectedMonth = new Date().getMonth() + 1;
    const selectedYear = new Date().getFullYear();

    useEffect(() => {
        loadEmployees();
        loadBatches();
    }, []);

    async function loadEmployees() {
        try {
            const res = await api.get('/hr/employees');
            setEmployees(res.data?.data || []);
        } catch (err) {
            console.error('Failed to load employee list', err);
        }
    }

    async function loadBatches() {
        setLoading(true);
        try {
            const res = await api.get(`/payroll/input-batches?month=${selectedMonth}&year=${selectedYear}`);
            const data = res.data?.data || [];
            // Filter batches that have reimbursements or are manual
            setBatches(data);
            if (data.length > 0) {
                setSelectedBatch(data.find(b => b.source === 'REIMBURSEMENT' || b.source === 'MANUAL') || data[0]);
            }
        } catch (err) {
            message.error('Failed to load input batches');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateBatch(values) {
        try {
            const payload = {
                name: values.name,
                batchCode: `REI-${Date.now().toString().slice(-6)}`,
                source: 'REIMBURSEMENT',
                month: selectedMonth,
                year: selectedYear,
                periodStart: new Date(Date.UTC(selectedYear, selectedMonth - 1, 1)).toISOString(),
                periodEnd: new Date(Date.UTC(selectedYear, selectedMonth, 0, 23, 59, 59)).toISOString(),
                runScope: 'ANY',
                usagePolicy: 'ONE_TIME',
                items: []
            };

            await api.post('/payroll/input-batches', payload);
            message.success('Reimbursement batch created successfully');
            setModalVisible(false);
            form.resetFields();
            loadBatches();
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to create reimbursement batch');
        }
    }

    async function handleAddReimbursementItem(values) {
        if (!selectedBatch) {
            message.error('Please select or create a reimbursement batch first');
            return;
        }

        try {
            const newItem = {
                employeeId: values.employeeId,
                inputType: 'REIMBURSEMENT',
                classification: 'REIMBURSEMENT',
                name: values.name || 'Expense Reimbursement',
                amount: values.amount,
                quantity: 1,
                rate: values.amount,
                taxable: false,
                notes: values.notes || ''
            };

            const updatedItems = [...(selectedBatch.items || []), newItem];
            
            const payload = {
                action: 'CREATED',
                comment: 'Adding manual reimbursement item',
                items: updatedItems
            };

            await api.post(`/payroll/input-batches/${selectedBatch._id}/transition`, payload);
            message.success('Reimbursement item added successfully');
            setAddItemModalVisible(false);
            itemForm.resetFields();
            loadBatches();
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to add reimbursement item');
        }
    }

    const itemsColumns = [
        {
            title: 'Employee ID',
            key: 'employeeId',
            render: (_, record) => {
                const emp = employees.find(e => e._id === record.employeeId);
                return emp?.employeeId || '-';
            }
        },
        {
            title: 'Employee Name',
            key: 'employeeName',
            render: (_, record) => {
                const emp = employees.find(e => e._id === record.employeeId);
                return emp ? `${emp.firstName} ${emp.lastName}` : '-';
            }
        },
        {
            title: 'Description',
            dataIndex: 'name',
            key: 'name'
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            render: (val) => `₹${val.toLocaleString()}`
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes'
        }
    ];

    return (
        <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white">Reimbursement Entries</h1>
                    <p className="text-slate-500 text-xs mt-1">Configure and manage employee business expense reimbursements</p>
                </div>
                <Space>
                    <Button icon={<Plus size={16} />} onClick={() => setModalVisible(true)}>
                        Create Reimbursement Batch
                    </Button>
                    <Button type="primary" icon={<Coins size={16} />} disabled={!selectedBatch} onClick={() => setAddItemModalVisible(true)}>
                        Add Entry
                    </Button>
                </Space>
            </div>

            <div className="grid grid-cols-4 gap-6">
                {/* Left Panel - Batches List */}
                <div className="col-span-1 bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm space-y-3">
                    <h3 className="text-xs uppercase font-bold text-slate-400">Current Month Batches</h3>
                    <div className="space-y-2">
                        {batches.length === 0 ? (
                            <div className="text-center text-slate-400 text-xs py-8">No batches found</div>
                        ) : (
                            batches.map(b => (
                                <div 
                                    key={b._id} 
                                    onClick={() => setSelectedBatch(b)}
                                    className={`p-3 border rounded-xl cursor-pointer hover:border-blue-500 transition-all ${selectedBatch?._id === b._id ? 'border-blue-500 bg-blue-50/20' : 'border-slate-100'}`}
                                >
                                    <div className="font-semibold text-sm text-slate-800">{b.name}</div>
                                    <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{b.batchCode} ({b.source})</div>
                                    <div className="flex justify-between items-center mt-2">
                                        <Tag color={b.status === 'APPROVED' ? 'green' : 'orange'}>{b.status}</Tag>
                                        <span className="text-xs font-bold text-slate-600">₹{b.summary?.totalReimbursements?.toLocaleString() || b.summary?.totalEarnings?.toLocaleString() || 0}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Panel - Batch Items Detail */}
                <div className="col-span-3 bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-4">
                    {selectedBatch ? (
                        <>
                            <div className="flex justify-between items-center border-b pb-3">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">{selectedBatch.name} Details</h2>
                                    <p className="text-slate-400 text-xs mt-0.5">Status: <Tag color="blue">{selectedBatch.status}</Tag> | Code: {selectedBatch.batchCode}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Total Batch Reimbursement</p>
                                    <h3 className="text-xl font-black text-slate-800">₹{selectedBatch.summary?.totalReimbursements?.toLocaleString() || selectedBatch.summary?.totalEarnings?.toLocaleString() || 0}</h3>
                                </div>
                            </div>

                            <Table 
                                columns={itemsColumns}
                                dataSource={selectedBatch.items || []}
                                rowKey="_id"
                                loading={loading}
                                className="border rounded-xl overflow-hidden"
                            />
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Receipt size={48} className="stroke-1 mb-2" />
                            <p className="text-sm">Select or create a reimbursement batch to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Batch Modal */}
            <Modal
                title="Create Reimbursement Batch"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={() => form.submit()}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleCreateBatch}
                >
                    <Form.Item
                        label="Batch Name"
                        name="name"
                        rules={[{ required: true, message: 'Please enter batch name' }]}
                    >
                        <Input placeholder="e.g. Travel & Fuel Reimbursements June 2026" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Add Earning Item Modal */}
            <Modal
                title="Add Reimbursement Entry"
                open={addItemModalVisible}
                onCancel={() => setAddItemModalVisible(false)}
                onOk={() => itemForm.submit()}
                destroyOnClose
            >
                <Form
                    form={itemForm}
                    layout="vertical"
                    onFinish={handleAddReimbursementItem}
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
                        label="Description/Label"
                        name="name"
                        rules={[{ required: true, message: 'Please enter description' }]}
                    >
                        <Input placeholder="e.g. Client Dinner Expenses" />
                    </Form.Item>

                    <Form.Item
                        label="Amount"
                        name="amount"
                        rules={[{ required: true, message: 'Please enter reimbursement amount' }]}
                    >
                        <InputNumber min={1} className="w-full" formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => value.replace(/\₹\s?|(,*)/g, '')} />
                    </Form.Item>

                    <Form.Item
                        label="Notes"
                        name="notes"
                    >
                        <textarea className="w-full border rounded-lg p-2 text-sm focus:outline-none" rows={3} placeholder="Add comments or bills reference..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
