import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, DatePicker, message, Space, Popconfirm, Tag, Badge, Input } from 'antd';
import { Plus, Trash2, CalendarDays } from 'lucide-react';
import shiftAssignmentService from '../../services/shiftAssignmentService';
import shiftMasterService from '../../services/shiftMasterService';
import dayjs from 'dayjs';

const { Option } = Select;

export default function ShiftAssignmentTab() {
  const [assignments, setAssignments] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  // Watch entityType to show/hide specific dropdowns (mocking Employees/Depts for now)
  const entityType = Form.useWatch('entityType', form);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assignRes, shiftRes] = await Promise.all([
        shiftAssignmentService.getAssignments(),
        shiftMasterService.getAllShifts('Active')
      ]);
      
      if (assignRes.success) setAssignments(assignRes.data);
      if (shiftRes.success) setShifts(shiftRes.data);
    } catch (error) {
      message.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = () => {
    form.resetFields();
    form.setFieldsValue({
      entityType: 'Employee',
      effectiveFrom: dayjs()
    });
    setIsModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      setLoading(true);
      const payload = {
        shiftMasterId: values.shiftMasterId,
        entityType: values.entityType,
        entityId: values.entityId || null, // Company has no entityId
        effectiveFrom: values.effectiveFrom.toDate(),
        effectiveTo: values.effectiveTo ? values.effectiveTo.toDate() : null
      };

      const res = await shiftAssignmentService.createAssignment(payload);
      if(res.success) {
        message.success("Shift Assignment Created");
        setIsModalVisible(false);
        fetchData();
      }
    } catch (error) {
      message.error(error.response?.data?.error || "Failed to assign shift");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await shiftAssignmentService.deleteAssignment(id);
      message.success("Assignment removed");
      fetchData();
    } catch (error) {
      message.error("Failed to remove assignment");
    }
  };

  const getPriorityColor = (type) => {
     switch(type) {
       case 'Employee': return 'red';
       case 'Department': return 'orange';
       case 'Designation': return 'purple';
       case 'Branch': return 'blue';
       case 'Company': return 'green';
       default: return 'default';
     }
  };

  const columns = [
    { 
      title: 'Priority Level', 
      dataIndex: 'entityType', 
      key: 'entityType',
      render: type => <Tag color={getPriorityColor(type)}>{type}</Tag>
    },
    { 
      title: 'Target (ID)', 
      key: 'target',
      render: (_, record) => record.entityType === 'Company' ? 'All Employees (Default)' : record.entityId
    },
    { 
      title: 'Assigned Shift', 
      key: 'shift',
      render: (_, record) => <b>{record.shiftMasterId?.name} ({record.shiftMasterId?.code})</b>
    },
    {
      title: 'Effective Dates',
      key: 'dates',
      render: (_, record) => {
         const from = dayjs(record.effectiveFrom).format('DD MMM YYYY');
         const to = record.effectiveTo ? dayjs(record.effectiveTo).format('DD MMM YYYY') : 'Forever';
         const isFuture = dayjs(record.effectiveFrom).isAfter(dayjs());
         return (
            <div>
              <div>{from} ➔ {to}</div>
              {isFuture && <Badge status="warning" text="Future Queue" className="mt-1" />}
            </div>
         );
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Popconfirm title="Remove this assignment?" onConfirm={() => handleDelete(record._id)}>
          <Button type="text" danger icon={<Trash2 size={16} />} />
        </Popconfirm>
      )
    }
  ];

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
           <h2 className="text-lg font-semibold">Smart Shift Assignment Engine</h2>
           <p className="text-sm text-slate-500">Manage hierarchical priority assignments and future queues.</p>
        </div>
        <Button type="primary" icon={<Plus size={16} />} onClick={handleOpenModal}>New Assignment</Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={assignments} 
        rowKey="_id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
        bordered
      />

      <Modal
        title={
           <div className="flex items-center gap-2">
              <CalendarDays size={18} />
              <span>Create Shift Assignment</span>
           </div>
        }
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg mb-4 text-xs">
            <b>Priority Rule:</b> Employee Level overrides Department. Department overrides Branch. Branch overrides Company Default.
          </div>

          <Form.Item name="shiftMasterId" label="Select Shift to Assign" rules={[{ required: true }]}>
             <Select placeholder="Select a Shift">
               {shifts.map(s => <Option key={s._id} value={s._id}>{s.name} ({s.code}) - {s.coreTiming.startTime} to {s.coreTiming.endTime}</Option>)}
             </Select>
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="entityType" label="Assignment Level (Priority)" rules={[{ required: true }]}>
              <Select>
                <Option value="Employee">Employee Specific (Highest)</Option>
                <Option value="Department">Department Wide</Option>
                <Option value="Designation">Designation Wide</Option>
                <Option value="Branch">Branch Wide</Option>
                <Option value="Company">Company Default (Lowest)</Option>
              </Select>
            </Form.Item>
            
            {entityType !== 'Company' && (
               <Form.Item name="entityId" label={`Select ${entityType}`} rules={[{ required: true }]}>
                  <Input placeholder={`Enter ${entityType} ID (Mock)`} />
               </Form.Item>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
             <Form.Item name="effectiveFrom" label="Effective From" rules={[{ required: true }]}>
                <DatePicker className="w-full" format="YYYY-MM-DD" />
             </Form.Item>
             <Form.Item name="effectiveTo" label="Effective To (Optional)">
                <DatePicker className="w-full" format="YYYY-MM-DD" placeholder="Forever" />
             </Form.Item>
          </div>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={loading}>Schedule Assignment</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
