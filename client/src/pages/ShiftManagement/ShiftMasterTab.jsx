import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, TimePicker, Switch, message, Space, Popconfirm, Tag, Upload, Descriptions } from 'antd';
import { Plus, Edit2, Trash2, Download, Upload as UploadIcon, Eye } from 'lucide-react';
import dayjs from 'dayjs';
import shiftMasterService from '../../services/shiftMasterService';
import * as XLSX from '@sheetjs/xlsx';

const { Option } = Select;

const predefinedShifts = [
  { id: 'S001', name: 'General Shift', type: 'Regular', start: '09:30', end: '18:30', hours: 8, isNight: false },
  { id: 'S002', name: 'Extended General Shift', type: 'Regular', start: '09:00', end: '18:00', hours: 8, isNight: false },
  { id: 'S003', name: 'Early Morning Shift', type: 'Support', start: '06:00', end: '15:00', hours: 8, isNight: false },
  { id: 'S004', name: 'Morning Shift', type: 'Support', start: '07:00', end: '16:00', hours: 8, isNight: false },
  { id: 'S005', name: 'Mid Shift', type: 'Support', start: '11:00', end: '20:00', hours: 8, isNight: false },
  { id: 'S006', name: 'Afternoon Shift', type: 'Support', start: '13:00', end: '22:00', hours: 8, isNight: false },
  { id: 'S007', name: 'Evening Shift', type: 'Support', start: '14:00', end: '23:00', hours: 8, isNight: false },
  { id: 'S008', name: 'Late Evening Shift', type: 'Support', start: '16:00', end: '01:00', hours: 8, isNight: true },
  { id: 'S009', name: 'Night Shift', type: '24x7 Support', start: '22:00', end: '07:00', hours: 8, isNight: true },
  { id: 'S010', name: 'Overnight Shift', type: '24x7 Support', start: '23:00', end: '08:00', hours: 8, isNight: true },
  { id: 'S011', name: 'US Time Zone Shift', type: 'Client Based', start: '18:30', end: '03:30', hours: 8, isNight: true },
  { id: 'S012', name: 'Europe Time Zone Shift', type: 'Client Based', start: '13:30', end: '22:30', hours: 8, isNight: false },
  { id: 'S013', name: 'Australia Time Zone Shift', type: 'Client Based', start: '05:00', end: '14:00', hours: 8, isNight: false },
  { id: 'S014', name: 'Flexible Shift', type: 'Flexible', start: '08:00', end: '17:00', hours: 8, isNight: false },
  { id: 'S015', name: 'Developer Shift', type: 'Project Based', start: '10:00', end: '19:00', hours: 8, isNight: false },
  { id: 'S016', name: 'Consultant Shift', type: 'Project Based', start: '09:30', end: '18:30', hours: 8, isNight: false },
  { id: 'S017', name: 'Hybrid Shift', type: 'Hybrid Work', start: '09:30', end: '18:30', hours: 8, isNight: false },
  { id: 'S018', name: 'Half Day Shift', type: 'Short Shift', start: '09:30', end: '13:30', hours: 4, isNight: false },
  { id: 'S019', name: 'Training Shift', type: 'Learning', start: '10:00', end: '17:00', hours: 6, isNight: false },
  { id: 'S020', name: 'Weekend Support Shift', type: 'Special Shift', start: '09:30', end: '18:30', hours: 8, isNight: false },
];

export default function ShiftMasterTab() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isCustomShift, setIsCustomShift] = useState(false);
  
  // Preview Modal States
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // View Details Modal States
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedShiftDetails, setSelectedShiftDetails] = useState(null);

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
    setIsCustomShift(false);
    if (record) {
      setEditingId(record._id);
      form.setFieldsValue({
        ...record,
        shiftSelect: record.name,
        customName: record.name,
        startTime: dayjs(record.coreTiming.startTime, 'HH:mm'),
        endTime: dayjs(record.coreTiming.endTime, 'HH:mm'),
        isNightShiftAcrossMidnight: record.coreTiming.isNightShiftAcrossMidnight,
        fullDayHours: record.workingHours?.minimumHoursForFullDay ? Math.floor(record.workingHours.minimumHoursForFullDay / 60) : 0,
        fullDayMinutes: record.workingHours?.minimumHoursForFullDay ? record.workingHours.minimumHoursForFullDay % 60 : 0,
        halfDayHours: record.workingHours?.minimumHoursForHalfDay ? Math.floor(record.workingHours.minimumHoursForHalfDay / 60) : 0,
        halfDayMinutes: record.workingHours?.minimumHoursForHalfDay ? record.workingHours.minimumHoursForHalfDay % 60 : 0,
        validFrom: dayjs(record.validFrom)
      });
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({ 
        shiftSelect: undefined,
        status: 'Active', 
        type: 'General',
        validFrom: dayjs(),
        fullDayHours: 8,
        fullDayMinutes: 0,
        halfDayHours: 4,
        halfDayMinutes: 0
      });
    }
    setIsModalVisible(true);
  };

  const handleViewDetails = (record) => {
    setSelectedShiftDetails(record);
    setDetailsModalVisible(true);
  };

  const handleShiftSelectChange = (value) => {
    if (value === 'Custom') {
      setIsCustomShift(true);
      form.setFieldsValue({ customName: '' });
    } else {
      setIsCustomShift(false);
      const selected = predefinedShifts.find(s => s.name === value);
      if (selected) {
        form.setFieldsValue({
          shiftSelect: selected.name,
          code: selected.id,
          type: selected.type,
          startTime: dayjs(selected.start, 'HH:mm'),
          endTime: dayjs(selected.end, 'HH:mm'),
          isNightShiftAcrossMidnight: selected.isNight,
          fullDayHours: selected.hours,
          fullDayMinutes: 0,
          halfDayHours: selected.hours === 8 ? 4 : Math.floor(selected.hours / 2),
          halfDayMinutes: 0,
        });
      }
    }
  };

  const handleSave = async (values) => {
    try {
      setLoading(true);
      const shiftName = isCustomShift ? values.customName : values.shiftSelect;
      if (!shiftName) {
        message.error("Please provide a shift name");
        return;
      }
      
      const payload = {
        name: shiftName,
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
          minimumHoursForFullDay: (parseInt(values.fullDayHours || 0) * 60) + parseInt(values.fullDayMinutes || 0),
          minimumHoursForHalfDay: (parseInt(values.halfDayHours || 0) * 60) + parseInt(values.halfDayMinutes || 0)
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
      const res = await shiftMasterService.deleteShift(id);
      if (res.success) {
        message.success("Shift deleted successfully");
        fetchShifts();
      }
    } catch (error) {
      message.error("Failed to delete shift");
    }
  };

  const handleToggleStatus = async (record) => {
    try {
      const newStatus = record.status === 'Active' ? 'Inactive' : 'Active';
      const res = await shiftMasterService.updateShift(record._id, { status: newStatus });
      if (res.success) {
        message.success(`Shift status changed to ${newStatus}`);
        fetchShifts();
      }
    } catch (error) {
      message.error("Failed to update shift status");
    }
  };

  const handleDownloadTemplate = () => {
    // Pre-fill the template with all 20 standard shifts so the user can easily upload them
    const templateData = predefinedShifts.map(shift => ({
      "Shift Name": shift.name,
      "Shift Code": shift.id,
      "Shift Type": shift.type,
      "Start Time (HH:mm)": shift.start,
      "End Time (HH:mm)": shift.end,
      "Is Night Shift? (Yes/No)": shift.isNight ? "Yes" : "No",
      "Min Full Day (Hours)": shift.hours,
      "Min Half Day (Hours)": shift.hours === 8 ? 4 : Math.floor(shift.hours / 2),
      "Max Advance Punch In (Min)": 120,
      "Max Late Punch Out (Min)": 120,
      "OT Enabled (Yes/No)": shift.type === 'Support' || shift.type === '24x7 Support' ? "Yes" : "No",
      "Max Permissions Per Month": 2
    }));
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shift Master Template");
    XLSX.writeFile(wb, "Shift_Master_Upload_Template.xlsx");
  };

  const handleUploadExcel = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
          message.error("Uploaded Excel file is empty.");
          return;
        }

        const parsedData = json.map((row, index) => {
          const errors = [];
          const shiftName = row["Shift Name"];
          const shiftCode = row["Shift Code"];
          
          if (!shiftName) errors.push("Missing Shift Name");
          if (!shiftCode) errors.push("Missing Shift Code");

          // Check if code is duplicate within the file
          const isDuplicateInFile = json.some((r, i) => i !== index && r["Shift Code"] === shiftCode);
          if (isDuplicateInFile) errors.push(`Duplicate Code in file: ${shiftCode}`);
          
          // Check if code already exists in existing shifts
          const isDuplicateInDb = shifts.some(s => s.code === shiftCode);
          if (isDuplicateInDb) errors.push(`Code already exists in system: ${shiftCode}`);

          return {
            key: index,
            name: shiftName,
            code: shiftCode,
            type: row["Shift Type"] || 'Regular',
            status: 'Active',
            validFrom: new Date(),
            coreTiming: {
              startTime: String(row["Start Time (HH:mm)"] || "09:30"),
              endTime: String(row["End Time (HH:mm)"] || "18:30"),
              isNightShiftAcrossMidnight: String(row["Is Night Shift? (Yes/No)"] || "No").toLowerCase() === 'yes'
            },
            workingHours: {
              minimumHoursForFullDay: (parseInt(row["Min Full Day (Hours)"]) || 8) * 60,
              minimumHoursForHalfDay: (parseInt(row["Min Half Day (Hours)"]) || 4) * 60
            },
            maxAdvancePunchIn: parseInt(row["Max Advance Punch In (Min)"]) || 120,
            maxLatePunchOut: parseInt(row["Max Late Punch Out (Min)"]) || 120,
            otEnabled: String(row["OT Enabled (Yes/No)"] || "No").toLowerCase() === 'yes',
            maxPermissions: parseInt(row["Max Permissions Per Month"]) || 2,
            errors: errors.join(", ")
          };
        });

        setPreviewData(parsedData);
        setPreviewModalVisible(true);

      } catch (error) {
        console.error("Upload error:", error);
        message.error("Failed to process Excel file. Please ensure the format is correct.");
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Prevent default upload behavior
  };

  const handleConfirmUpload = async () => {
    const validData = previewData.filter(d => !d.errors);
    if (validData.length === 0) {
      message.error("No valid shifts to upload. Please fix errors and try again.");
      return;
    }

    try {
      setIsUploading(true);
      // Remove UI specific fields before sending to API
      const payload = validData.map(({ key, errors, ...rest }) => rest);
      
      const res = await shiftMasterService.bulkCreateShifts(payload);
      if (res.success) {
        message.success(`Successfully uploaded ${res.count} shifts!`);
        setPreviewModalVisible(false);
        fetchShifts();
      }
    } catch (error) {
      console.error("Bulk Upload API error:", error);
      const backendError = error.response?.data?.error;
      message.error(backendError || "Failed to save to database. Check for duplicate codes.");
    } finally {
      setIsUploading(false);
    }
  };

  const previewColumns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100 },
    { title: 'Name', dataIndex: 'name', key: 'name', width: 150 },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 120 },
    { title: 'Timing', key: 'timing', render: (_, r) => `${r.coreTiming?.startTime} - ${r.coreTiming?.endTime}`, width: 120 },
    { 
      title: 'Errors', 
      dataIndex: 'errors', 
      key: 'errors', 
      render: (text) => text ? <Tag color="error">{text}</Tag> : <Tag color="success">Valid</Tag> 
    }
  ];

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
      render: (status, record) => (
        <Switch 
          checkedChildren="Active" 
          unCheckedChildren="Inactive" 
          checked={status === 'Active'} 
          onChange={() => handleToggleStatus(record)}
          className={status === 'Active' ? 'bg-green-500' : 'bg-red-500'}
        />
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<Eye size={16} className="text-gray-500"/>} onClick={() => handleViewDetails(record)} />
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
        <Space>
          <Button icon={<Download size={16} />} onClick={handleDownloadTemplate}>
            Download Template
          </Button>
          <Upload beforeUpload={handleUploadExcel} showUploadList={false} accept=".xlsx, .xls">
            <Button icon={<UploadIcon size={16} />}>Upload Excel</Button>
          </Upload>
          <Button type="primary" icon={<Plus size={16} />} onClick={() => handleOpenModal()}>
            Add Shift
          </Button>
        </Space>
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
            <Form.Item label="Shift Name" required>
              <Input.Group compact>
                <Form.Item name="shiftSelect" noStyle rules={[{ required: !isCustomShift, message: 'Please select a shift' }]}>
                  <Select 
                    placeholder="Select or Create Custom" 
                    onChange={handleShiftSelectChange}
                    style={{ width: isCustomShift ? '30%' : '100%' }}
                  >
                    {predefinedShifts.map(s => (
                      <Option key={s.name} value={s.name}>{s.name} ({s.start} - {s.end})</Option>
                    ))}
                    <Option value="Custom" className="text-indigo-600 font-semibold">+ Custom Shift</Option>
                  </Select>
                </Form.Item>
                {isCustomShift && (
                  <Form.Item name="customName" noStyle rules={[{ required: true, message: 'Enter custom name' }]}>
                    <Input style={{ width: '70%' }} placeholder="Enter Custom Shift Name" />
                  </Form.Item>
                )}
              </Input.Group>
            </Form.Item>
            
            <Form.Item name="code" label="Shift Code" rules={[{ required: true }]}>
              <Input placeholder="e.g. MORN_01" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="type" label="Shift Type" rules={[{ required: true }]}>
              <Select>
                <Option value="Regular">Regular</Option>
                <Option value="Support">Support</Option>
                <Option value="24x7 Support">24x7 Support</Option>
                <Option value="Client Based">Client Based</Option>
                <Option value="Flexible">Flexible</Option>
                <Option value="Project Based">Project Based</Option>
                <Option value="Hybrid Work">Hybrid Work</Option>
                <Option value="Short Shift">Short Shift</Option>
                <Option value="Learning">Learning</Option>
                <Option value="Special Shift">Special Shift</Option>
                
                {/* Legacy options just in case */}
                <Option value="General">General</Option>
                <Option value="Morning">Morning</Option>
                <Option value="Evening">Evening</Option>
                <Option value="Night">Night</Option>
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
            <h3 className="font-semibold mb-3">Working Hours</h3>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="block mb-2">Min Time for Full Day <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <Form.Item name="fullDayHours" className="mb-0 flex-1" rules={[{ required: true }]}>
                    <Select placeholder="Hours">
                      {[...Array(25).keys()].map(h => <Option key={h} value={h}>{h} Hrs</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item name="fullDayMinutes" className="mb-0 flex-1" rules={[{ required: true }]}>
                    <Select placeholder="Mins">
                      {[0, 15, 30, 45].map(m => <Option key={m} value={m}>{m} Mins</Option>)}
                    </Select>
                  </Form.Item>
                </div>
              </div>

              <div>
                <label className="block mb-2">Min Time for Half Day <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <Form.Item name="halfDayHours" className="mb-0 flex-1" rules={[{ required: true }]}>
                    <Select placeholder="Hours">
                      {[...Array(25).keys()].map(h => <Option key={h} value={h}>{h} Hrs</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item name="halfDayMinutes" className="mb-0 flex-1" rules={[{ required: true }]}>
                    <Select placeholder="Mins">
                      {[0, 15, 30, 45].map(m => <Option key={m} value={m}>{m} Mins</Option>)}
                    </Select>
                  </Form.Item>
                </div>
              </div>
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

      {/* Preview Modal for Excel Upload */}
      <Modal
        title="Preview Excel Upload"
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => setPreviewModalVisible(false)}>
            Cancel
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={isUploading} 
            onClick={handleConfirmUpload}
            disabled={previewData.length === 0 || previewData.every(d => d.errors)}
          >
            Confirm & Upload Valid Shifts
          </Button>
        ]}
      >
        <Table 
          columns={previewColumns} 
          dataSource={previewData} 
          rowKey="key" 
          pagination={false}
          scroll={{ y: 400 }}
          size="small"
        />
      </Modal>

      <Modal
        title="Shift Details"
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailsModalVisible(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        {selectedShiftDetails && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Shift Name" span={2}><b>{selectedShiftDetails.name}</b></Descriptions.Item>
            <Descriptions.Item label="Shift Code">{selectedShiftDetails.code}</Descriptions.Item>
            <Descriptions.Item label="Shift Type">{selectedShiftDetails.type}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={selectedShiftDetails.status === 'Active' ? 'success' : 'error'}>
                {selectedShiftDetails.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Valid From">{dayjs(selectedShiftDetails.validFrom).format('DD MMM YYYY')}</Descriptions.Item>
            
            <Descriptions.Item label="Core Timing" span={2}>
              {selectedShiftDetails.coreTiming?.startTime} to {selectedShiftDetails.coreTiming?.endTime} 
              {selectedShiftDetails.coreTiming?.isNightShiftAcrossMidnight ? ' (Night Shift)' : ''}
            </Descriptions.Item>

            <Descriptions.Item label="Min. Full Day Hours">
              {Math.floor((selectedShiftDetails.workingHours?.minimumHoursForFullDay || 0) / 60)}h {(selectedShiftDetails.workingHours?.minimumHoursForFullDay || 0) % 60}m
            </Descriptions.Item>
            <Descriptions.Item label="Min. Half Day Hours">
              {Math.floor((selectedShiftDetails.workingHours?.minimumHoursForHalfDay || 0) / 60)}h {(selectedShiftDetails.workingHours?.minimumHoursForHalfDay || 0) % 60}m
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

    </div>
  );
}
