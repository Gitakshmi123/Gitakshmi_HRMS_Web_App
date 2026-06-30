import React, { useState, useEffect } from 'react';
import { Table, Button, Select, Space, Tag, message } from 'antd';
import { Search, Download, RefreshCw, FileText } from 'lucide-react';
import api from '../../../utils/api';

export default function Form16() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generatingId, setGeneratingId] = useState(null);
    const [selectedFy, setSelectedFy] = useState('2026-2027');
    const [searchTerm, setSearchTerm] = useState('');

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

    async function handleGenerateForm16(emp) {
        setGeneratingId(emp._id);
        try {
            // Mock generating time
            await new Promise(resolve => setTimeout(resolve, 1500));
            message.success(`Form 16 generated successfully for ${emp.firstName} ${emp.lastName}`);
            
            // Store generation status in local storage or state
            localStorage.setItem(`form16:${emp._id}:${selectedFy}`, 'Generated');
            loadEmployees();
        } catch (err) {
            message.error('Failed to generate Form 16');
        } finally {
            setGeneratingId(null);
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
            title: 'Employee Name',
            key: 'name',
            render: (_, record) => `${record.firstName || ''} ${record.lastName || ''}`
        },
        {
            title: 'Department',
            dataIndex: 'department',
            key: 'department'
        },
        {
            title: 'Form 16 Status',
            key: 'status',
            render: (_, record) => {
                const status = localStorage.getItem(`form16:${record._id}:${selectedFy}`) || 'Not Generated';
                return (
                    <Tag color={status === 'Generated' ? 'green' : 'orange'}>
                        {status}
                    </Tag>
                );
            }
        },
        {
            title: 'Generated On',
            key: 'generatedOn',
            render: (_, record) => {
                const status = localStorage.getItem(`form16:${record._id}:${selectedFy}`);
                return status === 'Generated' ? '10-06-2026' : '-';
            }
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => {
                const status = localStorage.getItem(`form16:${record._id}:${selectedFy}`);
                if (status === 'Generated') {
                    return (
                        <Space>
                            <Button 
                                type="primary" 
                                size="small"
                                className="bg-blue-600 border-none"
                                icon={<Download size={14} />}
                                onClick={() => message.info('Downloading Form 16 PDF...')}
                            >
                                Download
                            </Button>
                            <Button 
                                size="small"
                                icon={<RefreshCw size={14} />}
                                loading={generatingId === record._id}
                                onClick={() => handleGenerateForm16(record)}
                            >
                                Re-generate
                            </Button>
                        </Space>
                    );
                }
                return (
                    <Button 
                        type="primary" 
                        size="small"
                        icon={<FileText size={14} />}
                        loading={generatingId === record._id}
                        onClick={() => handleGenerateForm16(record)}
                    >
                        Generate Form 16
                    </Button>
                );
            }
        }
    ];

    return (
        <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white">Form 16 & Tax Certificates</h1>
                    <p className="text-slate-500 text-xs mt-1">Generate and distribute TDS certificate (Form 16) for employees annually</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 w-full max-w-sm">
                        <Search size={18} className="text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search employee..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent border-none outline-none w-full text-sm text-slate-700 dark:text-slate-300"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Financial Year:</span>
                        <Select 
                            value={selectedFy} 
                            onChange={(val) => setSelectedFy(val)}
                            options={[{ label: 'FY 2026 - 2027', value: '2026-2027' }, { label: 'FY 2025 - 2026', value: '2025-2026' }]} 
                            className="w-44"
                        />
                    </div>
                </div>

                <Table 
                    columns={columns}
                    dataSource={filteredEmployees}
                    rowKey="_id"
                    loading={loading}
                    className="border rounded-xl overflow-hidden"
                />
            </div>
        </div>
    );
}
