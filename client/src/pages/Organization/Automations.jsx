import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Switch, Space, message, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlusCircleOutlined, MinusCircleOutlined } from '@ant-design/icons';
import api from '../../utils/api';

const { Option } = Select;

export default function Automations() {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/automations');
      if (data.success) {
        setAutomations(data.automations);
      }
    } catch (err) {
      message.error('Failed to fetch automations');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (record = null) => {
    if (record) {
      setEditingId(record._id);
      form.setFieldsValue({
        ...record,
        conditions: record.conditions?.length ? record.conditions : [{}],
        actions: record.actions?.length ? record.actions : [{}]
      });
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({
        isActive: true,
        conditions: [{}],
        actions: [{ order: 1 }]
      });
    }
    setIsModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      // Ensure arrays are formatted correctly
      const payload = {
        ...values,
        conditions: values.conditions?.filter(c => c.field && c.operator) || [],
        actions: values.actions?.filter(a => a.type) || []
      };

      if (editingId) {
        await api.put(`/automations/${editingId}`, payload);
        message.success('Automation updated successfully');
      } else {
        await api.post('/automations', payload);
        message.success('Automation created successfully');
      }
      setIsModalVisible(false);
      fetchAutomations();
    } catch (err) {
      message.error('Failed to save automation');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/automations/${id}`);
      message.success('Automation deleted successfully');
      fetchAutomations();
    } catch (err) {
      message.error('Failed to delete automation');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Trigger Event', dataIndex: 'triggerEvent', key: 'triggerEvent' },
    { 
      title: 'Active', 
      dataIndex: 'isActive', 
      key: 'isActive', 
      render: (val) => val ? <span className="text-emerald-600 font-bold">Yes</span> : <span className="text-gray-400">No</span>
    },
    {
      title: 'Actions Count',
      key: 'actionCount',
      render: (_, record) => record.actions?.length || 0
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record._id)} />
        </Space>
      )
    }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Automation Engine</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Create Workflow
        </Button>
      </div>

      <Alert 
        message={<span className="font-bold text-base">System Manual: How to use Automations</span>}
        description={<div className="mt-2 text-gray-700">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Trigger Event:</strong> Choose the system event that starts this automation (e.g., <i>Employee Joined</i>).</li>
            <li><strong>Conditions:</strong> Set filters if this should only apply to certain people (e.g., <i>department equals IT</i>). Leave empty to apply to everyone.</li>
            <li><strong>Actions:</strong> Define what happens next. If you add a <strong>Send Email</strong> action, make sure the <i>Email Trigger</i> matches the <strong>Trigger Type</strong> set in your <a href="/hr/settings/email-templates" className="text-blue-600 underline">Email Templates</a>.</li>
          </ul>
        </div>}
        type="info"
        showIcon
        className="mb-6 shadow-sm rounded-lg border-blue-200 bg-blue-50/50"
      />

      <Card>
        <Table
          dataSource={automations}
          columns={columns}
          rowKey="_id"
          loading={loading}
        />
      </Card>

      <Modal
        title={editingId ? 'Edit Workflow' : 'Create Workflow'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={800}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Name" name="name" rules={[{ required: true }]}>
              <Input placeholder="e.g., Offer Letter Welcome Email" />
            </Form.Item>
            <Form.Item label="Active" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Card title="1. When this happens (Trigger)" size="small" className="mb-4 bg-gray-50">
            <Form.Item label="Trigger Event" name="triggerEvent" rules={[{ required: true }]} className="mb-0">
              <Select placeholder="Select an event">
                <Option value="OFFER_LETTER_REQUESTED">Offer Letter Requested</Option>
                <Option value="EMPLOYEE_JOINED">Employee Joined</Option>
                <Option value="LEAVE_APPROVED">Leave Approved</Option>
                <Option value="TICKET_CREATED">Ticket Created</Option>
              </Select>
            </Form.Item>
          </Card>

          <Card title="2. If these conditions match" size="small" className="mb-4 bg-gray-50">
            <Form.List name="conditions">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} className="flex gap-2 items-start mb-2">
                      <Form.Item
                        {...restField}
                        name={[name, 'field']}
                        className="mb-0 flex-1"
                      >
                        <Input placeholder="Field (e.g., department)" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'operator']}
                        className="mb-0 flex-1"
                      >
                        <Select placeholder="Operator">
                          <Option value="equals">Equals</Option>
                          <Option value="not_equals">Not Equals</Option>
                          <Option value="contains">Contains</Option>
                          <Option value="greater_than">Greater Than</Option>
                          <Option value="less_than">Less Than</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'value']}
                        className="mb-0 flex-1"
                      >
                        <Input placeholder="Value" />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                    </div>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusCircleOutlined />}>
                    Add Condition
                  </Button>
                </>
              )}
            </Form.List>
          </Card>

          <Card title="3. Then do this (Actions)" size="small" className="mb-4 bg-gray-50">
            <Form.List name="actions">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} className="flex gap-2 items-start mb-2">
                      <Form.Item
                        {...restField}
                        name={[name, 'order']}
                        className="mb-0 w-16"
                      >
                        <Input type="number" placeholder="Order" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'type']}
                        className="mb-0 flex-1"
                      >
                        <Select placeholder="Action Type">
                          <Option value="SEND_EMAIL">Send Email</Option>
                          <Option value="TRIGGER_APPROVAL">Trigger Approval</Option>
                          <Option value="WEBHOOK">Call Webhook</Option>
                          <Option value="ASSIGN_TASK">Assign Task</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'config', 'triggerType']}
                        className="mb-0 flex-1"
                      >
                        <Input placeholder="Email Trigger (e.g. OFFER_LETTER)" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'config', 'toEmailField']}
                        className="mb-0 flex-1"
                      >
                        <Input placeholder="To Email Field (e.g. employee.email)" />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                    </div>
                  ))}
                  <Button type="dashed" onClick={() => add({ order: fields.length + 1 })} block icon={<PlusCircleOutlined />}>
                    Add Action
                  </Button>
                </>
              )}
            </Form.List>
          </Card>

        </Form>
      </Modal>
    </div>
  );
}
