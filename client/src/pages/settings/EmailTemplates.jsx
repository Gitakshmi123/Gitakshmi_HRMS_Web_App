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
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const reactQuillRef = useRef(null);

  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState({ subject: '', body: '' });

  const handlePreview = () => {
    // Validate or just read current form values
    const formValues = form.getFieldsValue();
    const currentSubject = formValues.subject || '';
    const currentBody = htmlContent || '';

    const mockDetails = {
      candidateName: 'John Doe',
      candidateEmail: 'johndoe@example.com',
      ctcYearly: '₹8,50,000',
      designation: 'Senior Software Engineer',
      department: 'Engineering',
      joiningDate: '1st July, 2026',
      offerExpiry: '25th June, 2026',
      companyName: 'Gitakshmi Enterprises',
      approvalUrl: '#',
      ctcBreakdown: `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; text-align: left; border: 1px solid #e0e0e0; font-family: sans-serif;">
          <thead>
            <tr style="background-color: #f8f9fa; border-bottom: 2px solid #e0e0e0;">
              <th style="padding: 10px; border: 1px solid #e0e0e0;">Salary Component</th>
              <th style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">Monthly (₹)</th>
              <th style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">Yearly (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color: #f1f3f5; font-weight: bold;">
              <td colspan="3" style="padding: 8px 10px; border: 1px solid #e0e0e0;">A. Earnings (Gross Pay)</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Basic Salary</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">35,417</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">4,25,000</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">House Rent Allowance (HRA)</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">17,708</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">2,12,500</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Special Allowance</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">12,500</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">1,50,000</td>
            </tr>
            <tr style="font-weight: bold; background-color: #f8f9fa;">
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Total Gross Earnings (A)</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">65,625</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">7,87,500</td>
            </tr>
            <tr style="background-color: #f1f3f5; font-weight: bold;">
              <td colspan="3" style="padding: 8px 10px; border: 1px solid #e0e0e0;">B. Employer Contributions & Retirals</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Employer Provident Fund (PF)</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">4,250</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">51,000</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Gratuity (Provisional)</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">958</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">11,500</td>
            </tr>
            <tr style="font-weight: bold; background-color: #f8f9fa;">
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Total Benefits (B)</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">5,208</td>
              <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">62,500</td>
            </tr>
            <tr style="font-weight: bold; background-color: #e9ecef; border-top: 2px solid #ced4da;">
              <td style="padding: 10px; border: 1px solid #e0e0e0;">Total Cost to Company (CTC)</td>
              <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">70,833</td>
              <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">8,50,000</td>
            </tr>
          </tbody>
        </table>
      `
    };

    let parsedSubject = currentSubject;
    let parsedBody = currentBody;

    Object.keys(mockDetails).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      parsedSubject = parsedSubject.replace(regex, mockDetails[key]);
      parsedBody = parsedBody.replace(regex, mockDetails[key]);
    });

    setPreviewData({ subject: parsedSubject, body: parsedBody });
    setIsPreviewVisible(true);
  };

  const insertPlaceholder = (tag) => {
    const quill = reactQuillRef.current?.getEditor();
    if (quill) {
      const range = quill.getSelection(true);
      quill.insertText(range.index, tag);
      quill.setSelection(range.index + tag.length);
    }
  };

  const handleDragStart = (e, tag) => {
    e.dataTransfer.setData('text/plain', tag);
  };

  const placeholders = [
    { name: 'Candidate Name', tag: '{{candidateName}}', desc: 'Full name of the candidate' },
    { name: 'Candidate Email', tag: '{{candidateEmail}}', desc: 'Email address of the candidate' },
    { name: 'Current CTC', tag: '{{currentCTC}}', desc: 'Current Annual CTC of the candidate' },
    { name: 'Offered CTC Yearly', tag: '{{ctcYearly}}', desc: 'Total Offered Annual CTC' },
    { name: '% Hike', tag: '{{hikePercentage}}', desc: 'Percentage increase from current CTC' },
    { name: 'CTC Breakdown Table', tag: '{{ctcBreakdown}}', desc: 'Full dynamic HTML table breakdown of CTC' },
    { name: 'Current Designation', tag: '{{currentDesignation}}', desc: 'Current role of the candidate' },
    { name: 'Offered Designation', tag: '{{designation}}', desc: 'Offered designation or role' },
    { name: 'Department', tag: '{{department}}', desc: 'Offered department' },
    { name: 'Joining Date', tag: '{{joiningDate}}', desc: 'Date of joining the company' },
    { name: 'Offer Expiry', tag: '{{offerExpiry}}', desc: 'Expiry date of the offer' },
    { name: 'Approval Link', tag: '{{approvalUrl}}', desc: 'URL for CEO to approve the offer' },
    { name: 'Company Name', tag: '{{companyName}}', desc: 'Name of your organization' },
  ];

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
        message={<span className="font-bold text-base">System Manual: Connecting Templates to System Events</span>}
        description={<div className="mt-2 text-gray-700">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Design:</strong> Create your email here and assign it a unique <strong>Trigger Type</strong> (e.g., <code>WELCOME_EMAIL</code>).</li>
            <li><strong>Trigger:</strong> System events will automatically use this template matching the specified <strong>Trigger Type</strong>.</li>
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
            <Button type="default" onClick={handlePreview}>Preview Template</Button>
            <Button type="primary" onClick={handleSaveTemplate}>Save Template</Button>
          </Space>
        }>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Editor Form */}
            <div className="col-span-1 lg:col-span-9">
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
                  <Input placeholder="e.g. Offer Letter - {{candidateName}}" />
                </Form.Item>
                
                 <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-medium">Email Content</label>
                    <Button 
                      size="small" 
                      onClick={() => setIsHtmlMode(!isHtmlMode)}
                      type={isHtmlMode ? "primary" : "default"}
                    >
                      {isHtmlMode ? "Switch to Visual Editor" : "Switch to HTML Editor"}
                    </Button>
                  </div>
                  <div className="bg-white" style={{ minHeight: '400px' }}>
                    {isHtmlMode ? (
                      <Input.TextArea
                        value={htmlContent}
                        onChange={(e) => setHtmlContent(e.target.value)}
                        style={{ height: '350px', fontFamily: 'monospace', fontSize: '13px' }}
                        placeholder="Paste your HTML code here..."
                      />
                    ) : (
                      <ReactQuill
                        ref={reactQuillRef}
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
                    )}
                  </div>
                </div>
              </Form>
            </div>

            {/* Right Column: Placeholders Panel */}
            <div className="col-span-1 lg:col-span-3">
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl shadow-sm sticky top-4">
                <h3 className="font-bold text-slate-800 text-sm mb-1">Placeholders Panel</h3>
                <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                  💡 Drag a placeholder directly into the subject or editor, or click to insert at cursor position.
                </p>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {placeholders.map((p) => (
                    <div
                      key={p.tag}
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, p.tag)}
                      onClick={() => insertPlaceholder(p.tag)}
                      className="cursor-grab select-none active:cursor-grabbing border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 p-2.5 rounded-lg flex flex-col gap-0.5 text-xs text-slate-700 shadow-sm hover:shadow transition-all duration-200 text-left group"
                      title="Drag into the editor or click to insert"
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold text-slate-800">{p.name}</span>
                        <span className="font-mono text-[9px] bg-slate-100 group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-600 px-1.5 py-0.5 rounded transition-colors">{p.tag}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 group-hover:text-indigo-400/80 transition-colors leading-tight">{p.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Modal
        title={<span className="font-bold text-lg text-slate-800 font-sans">Email Format Preview</span>}
        open={isPreviewVisible}
        onCancel={() => setIsPreviewVisible(false)}
        footer={[
          <Button key="close" type="primary" className="bg-indigo-600 border-none rounded-lg" onClick={() => setIsPreviewVisible(false)}>
            Close Preview
          </Button>
        ]}
        width={800}
        bodyStyle={{ padding: '24px', backgroundColor: '#f8f9fa' }}
      >
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm font-sans">
          {/* Email Header */}
          <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-2">
            <div className="flex text-sm">
              <span className="font-bold text-slate-500 w-20">Subject:</span>
              <span className="text-slate-800 font-semibold">{previewData.subject}</span>
            </div>
            <div className="flex text-sm">
              <span className="font-bold text-slate-500 w-20">From:</span>
              <span className="text-slate-600 font-medium">noreply@notifications.gitakshmi.com</span>
            </div>
            <div className="flex text-sm">
              <span className="font-bold text-slate-500 w-20">To:</span>
              <span className="text-slate-600 font-medium">johndoe@example.com</span>
            </div>
          </div>

          {/* Email Body */}
          <div className="p-6 overflow-auto max-h-[500px]">
            <div 
              className="prose max-w-none text-slate-800"
              dangerouslySetInnerHTML={{ __html: previewData.body }} 
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
