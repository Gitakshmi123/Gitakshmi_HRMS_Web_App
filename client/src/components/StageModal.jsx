import React, { useState } from 'react';
import { Modal, Input, Select, Button, Form, Divider, InputNumber } from 'antd';
import { Plus, Clock } from 'lucide-react';

export default function StageModal({ visible, onCancel, onSave, templates, onCreateTemplate }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);
            onSave(values);
            setLoading(false);
            form.resetFields();
        } catch (info) {
            console.log('Validate Failed:', info);
        }
    };

    return (
        <Modal
            open={visible}
            title="Add Pipeline Stage"
            onCancel={onCancel}
            onOk={handleOk}
            confirmLoading={loading}
            okText="Add Stage"
            okButtonProps={{ className: 'bg-indigo-600 hover:bg-indigo-700' }}
        >
            <Form
                form={form}
                layout="vertical"
                name="stage_form"
                initialValues={{
                    durationMinutes: 30,
                    mode: 'Online',
                    stageType: 'Interview'
                }}
            >
                <Form.Item
                    name="name"
                    label="Stage Name"
                    rules={[{ required: true, message: 'Please input the stage name!' }]}
                >
                    <Input placeholder="e.g. Technical Round 2" />
                </Form.Item>

                <div className="grid grid-cols-2 gap-4">
                    <Form.Item
                        name="mode"
                        label="Interview Mode"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Select.Option value="Online">Online</Select.Option>
                            <Select.Option value="In-person">In-person</Select.Option>
                            <Select.Option value="Phone">Phone</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="durationMinutes"
                        label="Duration (Minutes)"
                        rules={[{ required: true }]}
                    >
                        <InputNumber min={15} step={15} style={{ width: '100%' }} />
                    </Form.Item>
                </div>

                <Form.Item
                    name="feedbackTemplateId"
                    label="Feedback Template"
                >
                    <Select
                        placeholder="Select a template (Optional)"
                        popupRender={(menu) => (
                            <>
                                {menu}
                                <Divider style={{ margin: '8px 0' }} />
                                <Button
                                    type="text"
                                    icon={<Plus size={14} />}
                                    className="w-full text-left text-indigo-600 font-bold hover:bg-indigo-50"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCreateTemplate?.(); }}
                                >
                                    Create New Template
                                </Button>
                            </>
                        )}
                    >
                        {templates.map(t => (
                            <Select.Option key={t._id} value={t._id}>{t.templateName}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="isSystemStage"
                    valuePropName="checked"
                    hidden
                >
                    <Input type="hidden" />
                </Form.Item>
            </Form>
        </Modal>
    );
}
