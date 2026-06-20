import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, TimePicker, Switch, message, Space, Popconfirm, Tag } from 'antd';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import shiftMasterService from '../../services/shiftMasterService';
import dayjs from 'dayjs';

const { Option } = Select;

export default function ShiftMasterTab() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const res = await shiftMasterService.getAllShifts();
      if (res.success) {
        setShifts(res.data);
      }
    } catch (error) {
      message.error(error.response?.data?.error || "Failed to fetch shifts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleOpenModal = (record = null) => {
    setEditingId(record ? record._id : null);
    if (record) {
      form.setFieldsValue({
        ...record,
        startTime: dayjs(record.coreTiming.startTime, 'HH:mm'),
        endTime: dayjs(record.coreTiming.endTime, 'HH:mm'),
        isNightShiftAcrossMidnight: record.coreTiming.isNightShiftAcrossMidnight,
        minimumHoursForFullDay: record.workingHours.minimumHoursForFullDay,
        minimumHoursForHalfDay: record.workingHours.minimumHoursForHalfDay,
        validFrom: dayjs(record.validFrom)
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        status: 'Active',
        type: 'General',
        validFrom: dayjs()
      });
    }
    setIsModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      setLoading(true);
      const payload = {
        name: values.name,
        code: values.code,
        type: values.type,
        status: values.status,
        validFrom: values.validFrom ? values.validFrom.toDate() : new Date(),
        coreTiming: {
          startTime: values.startTime.format('HH:mm'),
          endTime: values.endTime.format('HH:mm'),
          isNightShiftAcrossMidnight: values.isNightShiftAcrossMidnight || false
        },
        workingHours: {
          minimumHoursForFullDay: values.minimumHoursForFullDay,
          minimumHoursForHalfDay: values.minimumHoursForHalfDay
        }
      };

      if (editingId) {
        await shiftMasterService.updateShift(editingId, payload);
        message.success("Shift updated successfully");
      } else {
        await shiftMasterService.createShift(payload, null);
        message.success("Shift created successfully");
      }
      setIsModalVisible(false);
      fetchShifts();
    } catch (error) {
      message.error(error.response?.data?.error || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await shiftMasterService.deleteShift(id);
      message.success("Shift deleted successfully");
      fetchShifts();
    } catch (error) {
      message.error("Failed to delete shift");
    }
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code', render: text => <b>{text}</b> },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { 
      title: 'Timing', 
      key: 'timing', 
      render: (_, record) => `${record.coreTiming?.startTime} - ${record.coreTiming?.endTime}` 
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: status => <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<Edit2 size={16} className="text-blue-500"/>} onClick={() => handleOpenModal(record)} />
          <Popconfirm title="Delete this shift?" onConfirm={() => handleDelete(record._id)}>
            <Button type="text" icon={<Trash2 size={16} className="text-red-500"/>} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Shift Master Configuration</h2>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => handleOpenModal()}>Add Shift</Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={shifts} 
        rowKey="_id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
        bordered
      />

      <Modal
        title={editingId ? "Edit Shift" : "Create New Shift"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="name" label="Shift Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Morning Shift" />
            </Form.Item>
            <Form.Item name="code" label="Shift Code" rules={[{ required: true }]}>
              <Input placeholder="e.g. MORN_01" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="type" label="Shift Type" rules={[{ required: true }]}>
              <Select>
                <Option value="General">General</Option>
                <Option value="Morning">Morning</Option>
                <Option value="Evening">Evening</Option>
                <Option value="Night">Night</Option>
                <Option value="Flexible">Flexible</Option>
              </Select>
            </Form.Item>
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select>
                <Option value="Active">Active</Option>
                <Option value="Inactive">Inactive</Option>
              </Select>
            </Form.Item>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg mb-4">
            <h3 className="font-semibold mb-3">Core Timing</h3>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="startTime" label="Start Time" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" className="w-full" />
              </Form.Item>
              <Form.Item name="endTime" label="End Time" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" className="w-full" />
              </Form.Item>
            </div>
            <Form.Item name="isNightShiftAcrossMidnight" valuePropName="checked" label="Is Night Shift (Crosses Midnight)?">
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg mb-4">
            <h3 className="font-semibold mb-3">Working Hours (Minutes)</h3>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="minimumHoursForFullDay" label="Min Mins for Full Day" rules={[{ required: true }]}>
                <Input type="number" placeholder="e.g. 480" />
              </Form.Item>
              <Form.Item name="minimumHoursForHalfDay" label="Min Mins for Half Day" rules={[{ required: true }]}>
                <Input type="number" placeholder="e.g. 240" />
              </Form.Item>
            </div>
          </div>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={loading}>Save Shift</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
