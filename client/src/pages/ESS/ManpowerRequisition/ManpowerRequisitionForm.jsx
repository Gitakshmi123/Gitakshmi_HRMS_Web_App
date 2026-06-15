import React, { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Select, DatePicker, Button, Radio, Divider, App, Row, Col, Typography } from 'antd';
import { Save, ArrowLeft, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function ManpowerRequisitionForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [requirementType, setRequirementType] = useState('New');
  
  const navigate = useNavigate();
  const { id } = useParams();
  const { message } = App.useApp();
  const isEdit = !!id && id !== 'new';

  useEffect(() => {
    fetchOptions();
    if (isEdit) {
      fetchRequisition();
    } else {
      form.setFieldsValue({
        requirementDate: dayjs(),
        requirementType: 'New'
      });
    }
  }, [id]);

  const fetchOptions = async () => {
    try {
      const [deptRes, desigRes] = await Promise.all([
        api.get('/departments'),
        api.get('/designations') // Assuming this endpoint exists, or similar
      ]);
      if (deptRes.data?.success) setDepartments(deptRes.data.data);
      
      // Fallback if designations API is different
      const dsgs = desigRes.data?.data || desigRes.data || [];
      if (Array.isArray(dsgs)) {
          setDesignations(dsgs);
      }
    } catch (err) {
      console.error('Error fetching options', err);
    }
  };

  const fetchRequisition = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/manpower-requisition/${id}`);
      if (res.data?.success) {
        const data = res.data.data;
        form.setFieldsValue({
          ...data,
          requirementDate: data.requirementDate ? dayjs(data.requirementDate) : null,
          positionToBeFilledByDate: data.positionToBeFilledByDate ? dayjs(data.positionToBeFilledByDate) : null,
          department: data.department?._id || data.department,
          designation: data.designation?._id || data.designation,
          replacementAgainstDesignation: data.replacementAgainstDesignation?._id || data.replacementAgainstDesignation,
        });
        setRequirementType(data.requirementType);
      }
    } catch (err) {
      console.error('Failed to fetch requisition', err);
      message.error('Failed to load requisition details');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const payload = { ...values };
      
      if (isEdit) {
        // Usually, employees can't edit after submission, maybe just view
        message.info('Editing is not implemented yet. Draft mode coming soon.');
      } else {
        const res = await api.post('/manpower-requisition', payload);
        if (res.data?.success) {
          message.success('Manpower Requisition submitted successfully for approval!');
          navigate('/employee/manpower-requisition');
        }
      }
    } catch (err) {
      console.error('Failed to submit requisition', err);
      message.error(err.response?.data?.message || 'Failed to submit requisition');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          type="text" 
          icon={<ArrowLeft size={20} />} 
          onClick={() => navigate('/employee/manpower-requisition')}
          className="text-slate-500 hover:bg-slate-100"
        />
        <div>
          <Title level={4} className="!mb-1 text-slate-800">
            {isEdit ? 'View Manpower Requisition' : 'New Manpower Requisition'}
          </Title>
          <Text className="text-slate-500">
            Submit a request for new headcount or replacement.
          </Text>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200 rounded-xl">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          disabled={isEdit} // Disable form if viewing
          initialValues={{ requirementType: 'New' }}
        >
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="requirementDate"
                label="Requirement Raised On Date"
                rules={[{ required: true, message: 'Please select date' }]}
              >
                <DatePicker className="w-full" format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="department"
                label="Department Name"
                rules={[{ required: true, message: 'Please select department' }]}
              >
                <Select placeholder="Select Department">
                  {departments.map(d => (
                    <Option key={d._id} value={d._id}>{d.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="approvedHeadCount"
                label="Approved Head Count"
                rules={[{ required: true, message: 'Required' }]}
              >
                <InputNumber min={0} className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="availableCount"
                label="Available Count"
                rules={[{ required: true, message: 'Required' }]}
              >
                <InputNumber min={0} className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="totalRequiredNumber"
                label="Total Required Number"
                rules={[{ required: true, message: 'Required' }]}
              >
                <InputNumber min={1} className="w-full" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="designation"
                label="Designation/Job Role"
                rules={[{ required: true, message: 'Please select designation' }]}
              >
                <Select placeholder="Select Designation">
                  {designations.map(d => (
                    <Option key={d._id} value={d._id}>{d.name || d.title}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="positionToBeFilledByDate"
                label="Position To Be Filled By Date"
                rules={[{ required: true, message: 'Please select date' }]}
              >
                <DatePicker className="w-full" format="DD MMM YYYY" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="jobLocation"
                label="Job Location"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="e.g. Mumbai, Remote" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="minimumQualification"
                label="Minimum Qualification"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="e.g. B.Tech, MBA" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="minimumExperience"
                label="Minimum Experience (Years)"
                rules={[{ required: true, message: 'Required' }]}
              >
                <InputNumber min={0} max={50} className="w-full" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" className="!my-6">Requirement Type</Divider>

          <Form.Item
            name="requirementType"
            label="Type of Requirement"
            rules={[{ required: true, message: 'Please select requirement type' }]}
          >
            <Radio.Group onChange={(e) => setRequirementType(e.target.value)}>
              <Radio value="New">NEW</Radio>
              <Radio value="Replacement">REPLACEMENT</Radio>
            </Radio.Group>
          </Form.Item>

          {requirementType === 'New' && (
            <Form.Item
              name="newRequirementReason"
              label="Reason of Additional Requirement"
              rules={[{ required: requirementType === 'New', message: 'Please provide reason' }]}
            >
              <TextArea rows={3} placeholder="Please provide reason for this new requirement..." />
            </Form.Item>
          )}

          {requirementType === 'Replacement' && (
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="replacementAgainstName"
                  label="Required Against - Name"
                  rules={[{ required: requirementType === 'Replacement', message: 'Required' }]}
                >
                  <Input placeholder="Name of employee being replaced" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="replacementAgainstDesignation"
                  label="Required Against - Designation"
                  rules={[{ required: requirementType === 'Replacement', message: 'Required' }]}
                >
                  <Select placeholder="Select Designation">
                    {designations.map(d => (
                      <Option key={d._id} value={d._id}>{d.name || d.title}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}

          <Divider orientation="left" className="!my-6">Job Description & Skills</Divider>

          <Form.Item
            name="jobDescription"
            label="Brief Job Description of Open Position"
            rules={[{ required: true, message: 'Please provide job description' }]}
          >
            <TextArea rows={4} placeholder="Describe the open position..." />
          </Form.Item>

          <Form.Item
            name="skillsRequired"
            label="IT & Other Skills Required"
            rules={[{ required: true, message: 'Please list required skills' }]}
          >
            <TextArea rows={3} placeholder="List required skills (a., b., c...)" />
          </Form.Item>

          <Form.Item
            name="remarks"
            label="Remarks if any"
          >
            <TextArea rows={2} />
          </Form.Item>

          {!isEdit && (
            <div className="flex justify-end gap-3 mt-8">
              <Button onClick={() => navigate('/employee/manpower-requisition')}>
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                icon={<Save size={16} />}
                className="bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                Submit for Approval
              </Button>
            </div>
          )}
        </Form>
      </Card>
    </div>
  );
}
