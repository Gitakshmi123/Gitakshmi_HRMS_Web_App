import React, { useState, useEffect } from 'react';
import { 
    Steps, Button, Card, Form, Input, InputNumber, 
    Select, Switch, Row, Col, Divider, Typography, 
    Space, Alert, Badge, Tooltip 
} from 'antd';
import { 
    Info, ChevronRight, ChevronLeft, Save, 
    Calendar, Users, Shield, Settings, CheckCircle2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';

const { Title, Text } = Typography;
const { Step } = Steps;

/**
 * LeavePolicyWizard Component
 * A multi-step form to create complex leave policies (Zoho-style).
 */
export default function LeavePolicyWizard() {
    const [currentStep, setCurrentStep] = useState(0);
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [grades, setGrades] = useState([]);
    const [departments, setDepartments] = useState([]);
    
    // Live Preview State
    const [formData, setFormData] = useState({
        name: 'New Leave Policy',
        leaveType: 'PAID',
        entitlement: { daysPerYear: 0, accrualType: 'YEARLY' },
        applicability: { targetType: 'ALL' }
    });

    useEffect(() => {
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const [gradeRes, deptRes] = await Promise.all([
                api.get('/hr/grades'),
                api.get('/hr/departments')
            ]);
            setGrades(gradeRes.data?.data || []);
            setDepartments(deptRes.data?.data || []);
        } catch (err) {
            console.error('Failed to fetch metadata:', err);
        }
    };

    const handleValuesChange = (_, allValues) => {
        setFormData(prev => ({ ...prev, ...allValues }));
    };

    const next = async () => {
        try {
            await form.validateFields();
            setCurrentStep(currentStep + 1);
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const prev = () => setCurrentStep(currentStep - 1);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            await api.post('/zoho-leave-policies', values);
            showToast('success', 'Policy Created', 'Leave policy has been successfully created.');
            // Redirect or reset
        } catch (err) {
            showToast('error', 'Creation Failed', err.response?.data?.message || 'Failed to create policy');
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        {
            title: 'Basic Details',
            icon: <Info size={18} />,
            content: (
                <div className="space-y-4">
                    <Form.Item name="name" label="Policy Name" rules={[{ required: true }]}>
                        <Input placeholder="e.g. Annual Paid Leave 2026" size="large" />
                    </Form.Item>
                    <Form.Item name="leaveType" label="Leave Type" initialValue="PAID">
                        <Select size="large">
                            <Select.Option value="PAID">Paid Leave</Select.Option>
                            <Select.Option value="SICK">Sick Leave</Select.Option>
                            <Select.Option value="CASUAL">Casual Leave</Select.Option>
                            <Select.Option value="UNPAID">Unpaid Leave</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={3} placeholder="Briefly describe the policy's purpose..." />
                    </Form.Item>
                </div>
            )
        },
        {
            title: 'Entitlement',
            icon: <Calendar size={18} />,
            content: (
                <div className="space-y-4">
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name={['entitlement', 'daysPerYear']} label="Days Per Year" rules={[{ required: true }]}>
                                <InputNumber min={0} className="w-full" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name={['entitlement', 'accrualType']} label="Accrual Type" initialValue="YEARLY">
                                <Select size="large">
                                    <Select.Option value="YEARLY">Yearly</Select.Option>
                                    <Select.Option value="MONTHLY">Monthly Accrual</Select.Option>
                                    <Select.Option value="QUARTERLY">Quarterly</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    
                    <Divider orientation="left">Grade-based Overrides (Optional)</Divider>
                    <Form.List name={['entitlement', 'gradeEntitlements']}>
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => (
                                    <Row key={key} gutter={8} align="middle" className="mb-2">
                                        <Col span={12}>
                                            <Form.Item {...restField} name={[name, 'grade']} rules={[{ required: true }]}>
                                                <Select placeholder="Select Grade">
                                                    {grades.map(g => <Select.Option key={g._id} value={g._id}>{g.name}</Select.Option>)}
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                        <Col span={10}>
                                            <Form.Item {...restField} name={[name, 'days']} rules={[{ required: true }]}>
                                                <InputNumber placeholder="Days" className="w-full" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={2}>
                                            <Button type="text" danger onClick={() => remove(name)}>×</Button>
                                        </Col>
                                    </Row>
                                ))}
                                <Button type="dashed" onClick={() => add()} block icon={<Plus size={14} />}>Add Grade Override</Button>
                            </>
                        )}
                    </Form.List>
                </div>
            )
        },
        {
            title: 'Applicability',
            icon: <Users size={18} />,
            content: (
                <div className="space-y-4">
                    <Form.Item name={['applicability', 'targetType']} label="Applicability Target" initialValue="ALL">
                        <Select size="large">
                            <Select.Option value="ALL">All Employees</Select.Option>
                            <Select.Option value="GRADE">Specific Grades</Select.Option>
                            <Select.Option value="DEPARTMENT">Specific Departments</Select.Option>
                            <Select.Option value="DESIGNATION">Specific Designations</Select.Option>
                        </Select>
                    </Form.Item>
                    
                    {formData.applicability?.targetType !== 'ALL' && (
                        <Form.Item name={['applicability', 'targetValues']} label="Selection" rules={[{ required: true }]}>
                            <Select mode="multiple" placeholder="Select targets..." size="large">
                                {formData.applicability?.targetType === 'GRADE' && grades.map(g => <Select.Option key={g._id} value={g._id}>{g.name}</Select.Option>)}
                                {formData.applicability?.targetType === 'DEPARTMENT' && departments.map(d => <Select.Option key={d._id} value={d._id}>{d.name}</Select.Option>)}
                            </Select>
                        </Form.Item>
                    )}
                </div>
            )
        },
        {
            title: 'Restrictions',
            icon: <Shield size={18} />,
            content: (
                <div className="space-y-6">
                    <Row gutter={[24, 16]}>
                        <Col span={12}>
                            <Form.Item name={['restrictions', 'maxPerMonth']} label="Max Per Month">
                                <InputNumber min={0} className="w-full" placeholder="No limit" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name={['restrictions', 'minGapBetweenLeaves']} label="Min Gap (Days)">
                                <InputNumber min={0} className="w-full" placeholder="No gap" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name={['restrictions', 'requireApproval']} valuePropName="checked" initialValue={true}>
                                <Switch checkedChildren="Requires Approval" unCheckedChildren="Auto Approve" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name={['advanced', 'allowHalfDay']} valuePropName="checked" initialValue={true}>
                                <Switch checkedChildren="Half Day Allowed" unCheckedChildren="Full Day Only" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name={['advanced', 'sandwichRule']} valuePropName="checked" initialValue={false}>
                                <Switch checkedChildren="Sandwich Rule ON" unCheckedChildren="Sandwich Rule OFF" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name={['advanced', 'allowNegativeBalance']} valuePropName="checked" initialValue={false}>
                                <Switch checkedChildren="Negative Allowed" unCheckedChildren="Negative Blocked" />
                            </Form.Item>
                        </Col>
                    </Row>
                </div>
            )
        }
    ];

    return (
        <div className="max-w-7xl mx-auto p-6 bg-white min-h-screen">
            <header className="mb-8 border-b pb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <Title level={2} className="!m-0 text-slate-800 flex items-center gap-3">
                            <Settings className="text-indigo-600" /> Create Leave Policy
                        </Title>
                        <Text className="text-slate-500">Configure rules, entitlements, and targeting for your organization.</Text>
                    </div>
                </div>
            </header>

            <Row gutter={32}>
                {/* Main Wizard */}
                <Col span={16}>
                    <Card className="shadow-sm border-slate-100 rounded-2xl overflow-hidden">
                        <div className="p-6 bg-slate-50/50 border-b">
                            <Steps current={currentStep} size="small">
                                {steps.map(item => <Step key={item.title} title={item.title} icon={item.icon} />)}
                            </Steps>
                        </div>

                        <div className="p-8">
                            <Form 
                                form={form} 
                                layout="vertical" 
                                onValuesChange={handleValuesChange}
                                onFinish={onFinish}
                                scrollToFirstError
                            >
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentStep}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {steps[currentStep].content}
                                    </motion.div>
                                </AnimatePresence>

                                <div className="mt-12 flex justify-between pt-6 border-t">
                                    <Button 
                                        disabled={currentStep === 0} 
                                        onClick={prev}
                                        icon={<ChevronLeft size={16} />}
                                        className="flex items-center gap-2"
                                    >
                                        Back
                                    </Button>
                                    {currentStep < steps.length - 1 ? (
                                        <Button 
                                            type="primary" 
                                            onClick={next}
                                            className="bg-indigo-600 flex items-center gap-2"
                                        >
                                            Continue <ChevronRight size={16} />
                                        </Button>
                                    ) : (
                                        <Button 
                                            type="primary" 
                                            loading={loading}
                                            onClick={() => form.submit()}
                                            className="bg-emerald-600 border-emerald-600 flex items-center gap-2"
                                        >
                                            Save Policy <Save size={16} />
                                        </Button>
                                    )}
                                </div>
                            </Form>
                        </div>
                    </Card>
                </Col>

                {/* Live Preview Card */}
                <Col span={8}>
                    <div className="sticky top-6">
                        <Title level={4} className="mb-4 flex items-center gap-2">
                            <CheckCircle2 size={18} className="text-emerald-500" /> Policy Preview
                        </Title>
                        <Card className="bg-slate-900 text-white rounded-2xl shadow-xl border-none p-2">
                            <div className="space-y-6">
                                <div className="border-b border-slate-800 pb-4">
                                    <Badge status="processing" text={<span className="text-emerald-400 text-xs uppercase font-bold tracking-wider">Active Policy</span>} />
                                    <h3 className="text-xl font-bold mt-1 text-white truncate">{formData.name || 'Untitle Policy'}</h3>
                                    <Tag color="indigo" className="mt-2 border-none px-3 py-0.5 rounded-full">{formData.leaveType}</Tag>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                        <Text className="text-slate-400 block text-xs mb-1 uppercase tracking-tight">Quota</Text>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-bold text-white">{formData.entitlement?.daysPerYear || 0}</span>
                                            <span className="text-slate-400 text-sm">Days</span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                        <Text className="text-slate-400 block text-xs mb-1 uppercase tracking-tight">Accrual</Text>
                                        <span className="text-white font-medium">{formData.entitlement?.accrualType}</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                                        <Text className="text-slate-400 italic">Targeting:</Text>
                                        <Text className="text-indigo-300 font-medium">{formData.applicability?.targetType}</Text>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                                        <Text className="text-slate-400 italic">Half Day:</Text>
                                        <Badge status={formData.advanced?.allowHalfDay ? 'success' : 'error'} text={<span className="text-white">{formData.advanced?.allowHalfDay ? 'Allowed' : 'Blocked'}</span>} />
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                                        <Text className="text-slate-400 italic">Approval:</Text>
                                        <Text className="text-white">{formData.restrictions?.requireApproval ? 'Required' : 'Automatic'}</Text>
                                    </div>
                                </div>

                                <Alert 
                                    className="bg-indigo-500/10 border-indigo-500/20 text-indigo-200 text-xs"
                                    message="Live preview reflects changes in real-time."
                                    type="info"
                                    showIcon
                                />
                            </div>
                        </Card>
                    </div>
                </Col>
            </Row>
        </div>
    );
}

const Plus = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
