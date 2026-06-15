import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, Card, Typography, Divider } from 'antd';
import { message } from '../../utils/antdGlobal';
import { CheckCircleOutlined, EyeOutlined, LoadingOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

const HRApprovalPage = () => {
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [approving, setApproving] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        fetchPending();
    }, []);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/onboarding-workflow/pending-approvals');
            setPending(res.data.data);
        } catch (err) {
            message.error("Failed to fetch pending onboardings");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (values) => {
        setApproving(true);
        try {
            await axios.post(`/api/onboarding-workflow/approve/${selectedEntry._id}`, values);
            message.success("Employee approved and activated!");
            setModalVisible(false);
            fetchPending();
        } catch (err) {
            message.error(err.response?.data?.message || "Approval failed");
        } finally {
            setApproving(false);
        }
    };

    const columns = [
        {
            title: 'Employee ID',
            dataIndex: ['employee', 'employeeId'],
            key: 'empid',
            render: (text) => <Text strong>{text || 'New'}</Text>
        },
        {
            title: 'Name',
            key: 'name',
            render: (_, record) => `${record.personalDetails?.firstName} ${record.personalDetails?.lastName}`
        },
        {
            title: 'Email',
            dataIndex: ['employee', 'email'],
            key: 'email',
        },
        {
            title: 'Submitted On',
            dataIndex: 'submittedAt',
            key: 'date',
            render: (date) => new Date(date).toLocaleDateString()
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => <Tag color="gold">{status}</Tag>
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <Space>
                    <Button 
                        icon={<EyeOutlined />} 
                        onClick={() => {
                            setSelectedEntry(record);
                            setModalVisible(true);
                            form.setFieldsValue({
                                department: record.employee?.department,
                                role: record.employee?.role || 'employee'
                            });
                        }}
                    >
                        Review
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Card bordered={false} className="shadow-lg rounded-xl">
                <Title level={2} style={{ margin: 0, color: '#1e293b' }}>Onboarding Approvals</Title>
                <Text type="secondary">Review and activate new joiners' accounts.</Text>
                
                <Divider />

                <Table 
                    columns={columns} 
                    dataSource={pending} 
                    rowKey="_id" 
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            <Modal
                title={`Reviewing Onboarding: ${selectedEntry?.personalDetails?.firstName}`}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={800}
                centered
            >
                {selectedEntry && (
                    <Form form={form} layout="vertical" onFinish={handleApprove}>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <Title level={5}>Personal Info</Title>
                                <p><Text type="secondary">Full Name:</Text> {selectedEntry.personalDetails?.firstName} {selectedEntry.personalDetails?.lastName}</p>
                                <p><Text type="secondary">Gender:</Text> {selectedEntry.personalDetails?.gender}</p>
                                <p><Text type="secondary">DOB:</Text> {new Date(selectedEntry.personalDetails?.dob).toDateString()}</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <Title level={5}>Bank Details</Title>
                                <p><Text type="secondary">Bank:</Text> {selectedEntry.bankDetails?.bankName}</p>
                                <p><Text type="secondary">A/C No:</Text> {selectedEntry.bankDetails?.accountNumber}</p>
                                <p><Text type="secondary">IFSC:</Text> {selectedEntry.bankDetails?.ifsc}</p>
                            </div>
                        </div>

                        <Divider>Assignment Details</Divider>
                        
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="department" label="Assign Department" rules={[{ required: true }]}>
                                    <Input placeholder="Engineering, HR, etc." />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="role" label="System Role" rules={[{ required: true }]}>
                                    <Select>
                                        <Select.Option value="employee">Employee</Select.Option>
                                        <Select.Option value="manager">Manager</Select.Option>
                                        <Select.Option value="hr">HR Admin</Select.Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                        </Row>

                        <div className="flex justify-end gap-2 mt-6">
                            <Button onClick={() => setModalVisible(false)}>Cancel</Button>
                            <Button 
                                type="primary" 
                                htmlType="submit" 
                                loading={approving} 
                                icon={<CheckCircleOutlined />}
                                style={{ background: '#10b981', borderColor: '#10b981' }}
                            >
                                Approve & Activate
                            </Button>
                        </div>
                    </Form>
                )}
            </Modal>
        </div>
    );
};

export default HRApprovalPage;
