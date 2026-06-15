import React, { useState, useEffect } from 'react';
import {
    Table, Card, Select, Button, DatePicker,
    Statistic, Row, Col, Divider, Tag, Space, Modal,
    Form, Input, Popconfirm, Spin, Empty,
    Tooltip, Avatar
} from 'antd';
import { message } from '../../../utils/antdGlobal';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';
import {
    Download, FileJson, Send, CheckCircle, AlertCircle,
    TrendingUp, Users, IndianRupee, Activity
} from 'lucide-react';
import api from '../../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;

const PayrollReport = () => {
    const [payrollRuns, setPayrollRuns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [year, setYear] = useState(dayjs().year());
    const [selectedRun, setSelectedRun] = useState(null);
    const [runDetails, setRunDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    useEffect(() => {
        fetchPayrollRuns();
    }, [year]);

    const fetchPayrollRuns = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/payroll/runs?year=${year}`);
            setPayrollRuns(res.data?.data || []);
        } catch (err) {
            message.error("Failed to fetch payroll runs");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRunDetails = async (runId) => {
        setDetailsLoading(true);
        try {
            const res = await api.get(`/payroll/runs/${runId}`);
            setRunDetails(res.data?.data);
        } catch (err) {
            message.error("Failed to fetch payroll run details");
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleSelectRun = (run) => {
        setSelectedRun(run);
        fetchRunDetails(run._id);
    };

    const columns = [
        {
            title: 'Period',
            key: 'period',
            render: (_, record) => {
                const monthName = new Date(0, record.month - 1).toLocaleString('default', { month: 'short' });
                return `${monthName} ${record.year}`;
            },
            width: 120
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                const statusConfig = {
                    'INITIATED': { color: 'blue', icon: '▬' },
                    'CALCULATED': { color: 'gold', icon: '⚙' },
                    'APPROVED': { color: 'green', icon: '✓' },
                    'PAID': { color: 'green', icon: '✓✓' },
                    'CANCELLED': { color: 'red', icon: '✗' }
                };
                const config = statusConfig[status] || { color: 'gray', icon: '?' };
                return <Tag color={config.color}>{config.icon} {status}</Tag>;
            }
        },
        {
            title: 'Employees',
            key: 'employees',
            render: (_, record) => (
                <div className="text-sm">
                    <div className="font-medium">{record.processedEmployees}/{record.totalEmployees}</div>
                    <div className="text-gray-500">
                        {record.failedEmployees > 0 && ` • ${record.failedEmployees} failed`}
                    </div>
                </div>
            )
        },
        {
            title: 'Total Gross',
            key: 'gross',
            render: (_, record) => (
                <div className="text-right font-mono">
                    ₹{(record.totalGross || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
            )
        },
        {
            title: 'Total Deductions',
            key: 'deductions',
            render: (_, record) => (
                <div className="text-right font-mono">
                    ₹{(record.totalDeductions || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
            )
        },
        {
            title: 'Total Net Pay',
            key: 'netpay',
            render: (_, record) => (
                <div className="text-right font-mono font-bold text-green-600">
                    ₹{(record.totalNetPay || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space size="small">
                    <Button
                        type="primary"
                        size="small"
                        onClick={() => handleSelectRun(record)}
                    >
                        Details
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-2.5">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-blue-600" />
                        Payroll Reports
                    </h1>
                    <p className="text-sm text-slate-500">View payroll runs and detailed analytics</p>
                </div>
                <Select
                    value={year}
                    onChange={setYear}
                    style={{ width: 150 }}
                    placeholder="Select Year"
                >
                    {[2024, 2025, 2026, 2027].map(y => (
                        <Option key={y} value={y}>{y}</Option>
                    ))}
                </Select>
            </div>

            {/* Main Table */}
            <Card loading={loading} className="shadow-sm border-slate-200">
                <Table
                    columns={columns}
                    dataSource={payrollRuns.map(run => ({ ...run, key: run._id }))}
                    pagination={{ pageSize: 12 }}
                    size="middle"
                    locale={{ emptyText: <Empty description="No payroll runs found for this year" /> }}
                />
            </Card>

            {/* Details Modal */}
            {selectedRun && (
                <Modal
                    title={`Payroll Run Details — ${new Date(0, selectedRun.month - 1).toLocaleString('default', { month: 'long' })} ${selectedRun.year}`}
                    visible={!!selectedRun}
                    onCancel={() => {
                        setSelectedRun(null);
                        setRunDetails(null);
                    }}
                    width={1000}
                    footer={null}
                >
                    <Spin spinning={detailsLoading}>
                        {runDetails && (
                            <div className="space-y-6">
                                {/* Summary Cards */}
                                <Row gutter={16}>
                                    <Col span={6}>
                                        <Card className="text-center">
                                            <Statistic
                                                title="Status"
                                                value={runDetails.status}
                                                prefix={<Activity size={16} />}
                                                valueStyle={{ fontSize: '14px', color: '#1890ff' }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card className="text-center">
                                            <Statistic
                                                title="Processed"
                                                value={runDetails.processedEmployees || 0}
                                                suffix={`/${runDetails.totalEmployees || 0}`}
                                                valueStyle={{ color: '#52c41a' }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card className="text-center">
                                            <Statistic
                                                title="Failed"
                                                value={runDetails.failedEmployees || 0}
                                                valueStyle={{ color: runDetails.failedEmployees > 0 ? '#ff4d4f' : '#52c41a' }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card className="text-center">
                                            <Statistic
                                                title="Generated On"
                                                value={runDetails.calculatedAt ? new Date(runDetails.calculatedAt).toLocaleDateString('en-IN') : '--'}
                                                valueStyle={{ fontSize: '12px' }}
                                            />
                                        </Card>
                                    </Col>
                                </Row>

                                <Divider />

                                {/* Financial Summary */}
                                <div className="grid grid-cols-3 gap-4">
                                    <Card className="bg-blue-50 border-blue-200">
                                        <Statistic
                                            title="Total Gross Earnings"
                                            value={runDetails.totalGross || 0}
                                            prefix="₹"
                                            precision={2}
                                            valueStyle={{ color: '#1890ff' }}
                                        />
                                    </Card>
                                    <Card className="bg-orange-50 border-orange-200">
                                        <Statistic
                                            title="Total Deductions"
                                            value={runDetails.totalDeductions || 0}
                                            prefix="₹"
                                            precision={2}
                                            valueStyle={{ color: '#ff7a45' }}
                                        />
                                    </Card>
                                    <Card className="bg-green-50 border-green-200">
                                        <Statistic
                                            title="Total Net Pay"
                                            value={runDetails.totalNetPay || 0}
                                            prefix="₹"
                                            precision={2}
                                            valueStyle={{ color: '#52c41a', fontSize: '20px' }}
                                        />
                                    </Card>
                                </div>

                                <Divider />

                                {/* Charts */}
                                {runDetails.processedEmployees > 0 && (
                                    <div className="grid grid-cols-2 gap-6">
                                        {/* Pie Chart for Employee Status */}
                                        <Card title="Employee Processing Status">
                                            <ResponsiveContainer width="100%" height={300}>
                                                <PieChart>
                                                    <Pie
                                                        data={[
                                                            { name: 'Processed', value: runDetails.processedEmployees, fill: '#52c41a' },
                                                            { name: 'Failed', value: runDetails.failedEmployees || 0, fill: '#ff4d4f' }
                                                        ]}
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={false}
                                                        label={({ name, value }) => `${name}: ${value}`}
                                                        outerRadius={100}
                                                        dataKey="value"
                                                    >
                                                        <Cell fill="#52c41a" />
                                                        <Cell fill="#ff4d4f" />
                                                    </Pie>
                                                    <RechartsTooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </Card>

                                        {/* Bar Chart for Financial Distribution */}
                                        <Card title="Financial Distribution">
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart
                                                    data={[
                                                        {
                                                            name: 'Payroll Summary',
                                                            'Gross': runDetails.totalGross || 0,
                                                            'Deductions': runDetails.totalDeductions || 0,
                                                            'NetPay': runDetails.totalNetPay || 0
                                                        }
                                                    ]}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <RechartsTooltip />
                                                    <Legend />
                                                    <Bar dataKey="Gross" fill="#1890ff" />
                                                    <Bar dataKey="Deductions" fill="#ff7a45" />
                                                    <Bar dataKey="NetPay" fill="#52c41a" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </Card>
                                    </div>
                                )}

                                {/* Errors Section */}
                                {runDetails.errors && runDetails.errors.length > 0 && (
                                    <>
                                        <Divider />
                                        <Card title="Processing Errors" type="inner" className="bg-red-50 border-red-300">
                                            <div className="space-y-2">
                                                {runDetails.errors.map((err, idx) => (
                                                    <div key={idx} className="text-sm bg-red-100 p-2 rounded flex items-start gap-2">
                                                        <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <strong>Employee:</strong> {err.employeeId}
                                                            <br />
                                                            <strong>Error:</strong> {err.message}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    </>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-2 justify-end">
                                    <Button icon={<Download size={16} />}>
                                        Export Report
                                    </Button>
                                    <Button icon={<FileJson size={16} />}>
                                        Export JSON
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Spin>
                </Modal>
            )}
        </div>
    );
};

export default PayrollReport;
