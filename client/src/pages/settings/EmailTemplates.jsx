import React, { useState, useEffect, useRef } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Switch, Tabs, message, Space, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import api from '../../utils/api';

const { TabPane } = Tabs;
const { Option } = Select;

export default function EmailTemplates() {
  const [activeTab, setActiveTab] = useState('templates');

  // Templates State
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState(null);
  
  const [htmlContent, setHtmlContent] = useState('');

  // SMTP State
  const [smtpConfig, setSmtpConfig] = useState({});
  const [smtpForm] = Form.useForm();
  const [smtpLoading, setSmtpLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchSmtpConfig();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/email-templates');
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (err) {
      message.error('Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchSmtpConfig = async () => {
    try {
      const { data } = await api.get('/email-templates/smtp');
      if (data.success && data.smtpConfig) {
        setSmtpConfig(data.smtpConfig);
        smtpForm.setFieldsValue(data.smtpConfig);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSmtpSave = async (values) => {
    setSmtpLoading(true);
    try {
      const { data } = await api.put('/email-templates/smtp', values);
      if (data.success) {
        message.success('SMTP Configuration saved successfully');
        setSmtpConfig(data.smtpConfig);
      }
    } catch (err) {
      message.error('Failed to save SMTP configuration');
    } finally {
      setSmtpLoading(false);
    }
  };

  const openModal = (record = null) => {
    if (record) {
      setEditingId(record._id);
      form.setFieldsValue(record);
      setHtmlContent(record.bodyHtml || '');
    } else {
      setEditingId(null);
      form.resetFields();
      setHtmlContent('');
    }
    setIsEditingMode(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const values = await form.validateFields();
      
      const payload = {
        ...values,
        bodyHtml: htmlContent
      };

      if (editingId) {
        await api.put(`/email-templates/${editingId}`, payload);
        message.success('Template updated successfully');
      } else {
        await api.post('/email-templates', payload);
        message.success('Template created successfully');
      }
      setIsEditingMode(false);
      fetchTemplates();
    } catch (error) {
      console.log('Validation/Save failed:', error);
      message.error('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await api.delete(`/email-templates/${id}`);
      message.success('Template deleted successfully');
      fetchTemplates();
    } catch (err) {
      message.error('Failed to delete template');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Module', dataIndex: 'module', key: 'module' },
    { title: 'Trigger Type', dataIndex: 'triggerType', key: 'triggerType' },
    { title: 'Active', dataIndex: 'isActive', key: 'isActive', render: (val) => val ? 'Yes' : 'No' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteTemplate(record._id)} />
        </Space>
      )
    }
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{isEditingMode ? (editingId ? 'Edit Template' : 'Create Template') : 'Email Configuration'}</h1>

      {!isEditingMode ? (
        <>

      <Alert 
        message={<span className="font-bold text-base">System Manual: Connecting Templates to Automations</span>}
        description={<div className="mt-2 text-gray-700">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Design:</strong> Create your email here and assign it a unique <strong>Trigger Type</strong> (e.g., <code>WELCOME_EMAIL</code>).</li>
            <li><strong>Connect:</strong> Go to the <a href="/hr/organization" className="text-blue-600 underline">Organization</a> page and open the <strong>Automations Engine</strong>.</li>
            <li><strong>Trigger:</strong> In the Automation Action, specify the exact same <strong>Trigger Type</strong> so the system knows to send this specific template.</li>
          </ul>
        </div>}
        type="info"
        showIcon
        className="mb-6 shadow-sm rounded-lg border-blue-200 bg-blue-50/50"
      />

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Email Templates" key="templates">
          <Card
            title="Templates"
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Create Template</Button>}
          >
            <Table
              dataSource={templates}
              columns={columns}
              rowKey="_id"
              loading={loading}
            />
          </Card>
        </TabPane>
        <TabPane tab="SMTP Settings" key="smtp">
          <Card title="SMTP Configuration" className="max-w-2xl">
            <Form layout="vertical" form={smtpForm} onFinish={handleSmtpSave}>
              <Form.Item label="SMTP Host" name="host" rules={[{ required: true }]}>
                <Input placeholder="smtp.gmail.com" />
              </Form.Item>
              <Form.Item label="SMTP Port" name="port" rules={[{ required: true }]}>
                <Input type="number" placeholder="587" />
              </Form.Item>
              <Form.Item label="Use Secure (TLS/SSL)" name="secure" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item label="Username" name="user" rules={[{ required: true }]}>
                <Input placeholder="youremail@example.com" />
              </Form.Item>
              <Form.Item label="Password" name="pass" rules={[{ required: true }]}>
                <Input.Password placeholder="Enter password or app password" />
              </Form.Item>
              <Form.Item label="From Email" name="fromEmail">
                <Input placeholder="noreply@yourcompany.com" />
              </Form.Item>
              <Form.Item label="From Name" name="fromName">
                <Input placeholder="Your Company HR" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={smtpLoading}>
                Save SMTP Settings
              </Button>
            </Form>
          </Card>
        </TabPane>
      </Tabs>
        </>
      ) : (
        <Card title={editingId ? 'Edit Template' : 'Create Template'} extra={
          <Space>
            <Button onClick={() => setIsEditingMode(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSaveTemplate}>Save Template</Button>
          </Space>
        }>
          <Form form={form} layout="vertical" initialValues={{ isActive: true }}>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Active" name="isActive" valuePropName="checked">
                <Switch />
              </Form.Item>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item label="Module" name="module" rules={[{ required: true }]}>
                <Select>
                  <Option value="Recruitment">Recruitment</Option>
                  <Option value="Leave">Leave</Option>
                  <Option value="Onboarding">Onboarding</Option>
                  <Option value="General">General</Option>
                </Select>
              </Form.Item>
              <Form.Item label="Trigger Type" name="triggerType" rules={[{ required: true }]}>
                <Input placeholder="e.g. OFFER_LETTER, LEAVE_APPROVED" />
              </Form.Item>
            </div>
            <Form.Item label="Subject" name="subject" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            
            <div className="mb-4">
              <label className="block mb-2 font-medium">Email Content</label>
              <div className="bg-white" style={{ minHeight: '400px' }}>
                <ReactQuill
                  theme="snow"
                  value={htmlContent}
                  onChange={setHtmlContent}
                  style={{ height: '350px' }}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      ['link', 'image'],
                      ['clean']
                    ],
                  }}
                />
              </div>
            </div>
          </Form>
        </Card>
      )}
    </div>
  );
}
