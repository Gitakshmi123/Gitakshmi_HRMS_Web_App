import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, DatePicker, message, Space, Popconfirm, Tag, Badge } from 'antd';
import { Plus, Trash2, CalendarDays, UserCheck, ShieldCheck, Activity, Users, Building2, Briefcase, Zap, CheckCircle2 } from 'lucide-react';
import shiftAssignmentService from '../../services/shiftAssignmentService';
import shiftMasterService from '../../services/shiftMasterService';
import api from '../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;

export default function ShiftAssignmentTab() {
  const [assignments, setAssignments] = useState([]);
  const [shifts, setShifts] = useState([]);
  
  // Organization Data for Dropdowns
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [grades, setGrades] = useState([]);
  const [locations, setLocations] = useState([]);

  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  const entityType = Form.useWatch('entityType', form);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assignRes, shiftRes, empRes, deptRes, desigRes, branchRes, gradeRes, locRes] = await Promise.all([
        shiftAssignmentService.getAssignments(),
        shiftMasterService.getAllShifts('Active'),
        api.get('/hr/employees?limit=1000').then(res => ({ success: true, data: res.data?.data || res.data })).catch(() => ({ success: false })),
        api.get('/hierarchy/departments').then(res => res.data).catch(() => ({ success: false })),
        api.get('/hierarchy/designations').then(res => res.data).catch(() => ({ success: false })),
        api.get('/hierarchy/branches').then(res => res.data).catch(() => ({ success: false })),
        api.get('/grades').then(res => res.data).catch(() => ({ success: false })),
        api.get('/locations').then(res => res.data).catch(() => ({ success: false }))
      ]);
      
      if (assignRes.success) setAssignments(assignRes.data);
      if (shiftRes.success) setShifts(shiftRes.data);
      if (empRes.success) setEmployees(empRes.data);
      if (deptRes.success) setDepartments(deptRes.data);
      if (desigRes.success) setDesignations(desigRes.data);
      if (branchRes.success) setBranches(branchRes.data);
      if (gradeRes.success) setGrades(gradeRes.data);
      if (locRes.success) setLocations(locRes.data);
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
        entityId: values.entityId || null, 
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

  const getPriorityConfig = (type) => {
     switch(type) {
       case 'Employee':    return { color: '#ef4444', bg: '#fef2f2', icon: <UserCheck size={14}/> };
       case 'Department':  return { color: '#f59e0b', bg: '#fffbeb', icon: <Users size={14}/> };
       case 'Designation': return { color: '#8b5cf6', bg: '#f5f3ff', icon: <Briefcase size={14}/> };
       case 'Branch':      return { color: '#3b82f6', bg: '#eff6ff', icon: <Building2 size={14}/> };
       case 'Company':     return { color: '#10b981', bg: '#ecfdf5', icon: <ShieldCheck size={14}/> };
       default:            return { color: '#64748b', bg: '#f8fafc', icon: <Activity size={14}/> };
     }
  };

  const columns = [
    { 
      title: 'Assignment Level', 
      dataIndex: 'entityType', 
      key: 'entityType',
      width: 180,
      render: type => {
        const cfg = getPriorityConfig(type);
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs border" style={{ color: cfg.color, background: cfg.bg, borderColor: `${cfg.color}33` }}>
            {cfg.icon} {type}
          </span>
        );
      }
    },
    { 
      title: 'Target Entity', 
      key: 'target',
      render: (_, record) => {
        if (record.entityType === 'Company') return <span className="font-semibold text-slate-700">All Employees (Company Default)</span>;
        
        let label = record.entityId;
        if (record.entityType === 'Employee') {
          const emp = employees.find(e => e._id === record.entityId);
          if(emp) label = `${emp.firstName} ${emp.lastName} (${emp.employeeId})`;
        } else if (record.entityType === 'Department') {
          const dept = departments.find(d => d._id === record.entityId);
          if(dept) label = dept.name;
        } else if (record.entityType === 'Designation') {
          const desig = designations.find(d => d._id === record.entityId);
          if(desig) label = desig.name;
        } else if (record.entityType === 'Branch') {
          const branch = branches.find(b => b._id === record.entityId);
          if(branch) label = branch.name;
        }
        return <span className="font-semibold text-slate-700">{label}</span>;
      }
    },
    { 
      title: 'Assigned Shift', 
      key: 'shift',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
             <CalendarDays size={14} className="text-indigo-600"/>
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm leading-tight">{record.shiftMasterId?.name}</p>
            <p className="font-mono text-xs text-slate-400">{record.shiftMasterId?.code}</p>
          </div>
        </div>
      )
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
              <div className="text-sm font-medium text-slate-700">{from} <span className="text-slate-400 mx-1">→</span> {to}</div>
              {isFuture && <Badge color="orange" text={<span className="text-xs text-orange-600 font-medium">Future Queue</span>} className="mt-1" />}
            </div>
         );
      }
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Popconfirm title="Remove this assignment?" onConfirm={() => handleDelete(record._id)}>
          <Button type="text" danger icon={<Trash2 size={16} />} className="hover:bg-red-50" />
        </Popconfirm>
      )
    }
  ];

  return (
    <div className="p-2 md:p-6 max-w-[1200px] mx-auto">
      
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl flex items-center justify-center border border-indigo-100 flex-shrink-0">
            <Zap size={24} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Smart Shift Assignment Engine</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">Manage hierarchical priority assignments and future queues. Higher level overrides lower level.</p>
          </div>
        </div>
        
        <Button 
          type="primary" 
          icon={<Plus size={16} />} 
          onClick={handleOpenModal}
          size="large"
          className="rounded-xl shadow-md shadow-indigo-500/20 font-semibold"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none' }}
        >
          New Assignment
        </Button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <Table 
          columns={columns} 
          dataSource={assignments} 
          rowKey="_id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
          className="shift-assignment-table"
        />
      </div>

      <Modal
        title={
          <div className="flex items-center gap-3 pb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
               <CalendarDays size={20} className="text-indigo-600" />
            </div>
            <div>
               <p className="font-bold text-slate-800 text-lg leading-tight">Create Shift Assignment</p>
               <p className="text-xs text-slate-500 font-normal mt-0.5">Define target entity and effective dates.</p>
            </div>
          </div>
        }
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
        styles={{ header: { borderBottom: '1px solid #f1f5f9', marginBottom: 16 } }}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-2">
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
            <div className="flex items-start gap-3">
               <ShieldCheck size={18} className="text-slate-400 mt-0.5" />
               <div>
                  <p className="text-sm font-bold text-slate-700 mb-1">Priority Hierarchy Rule</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Employee overrides Department. Department overrides Branch. Branch overrides Company Default. Future assignments automatically take effect when their start date is reached.
                  </p>
               </div>
            </div>
          </div>

          <Form.Item name="shiftMasterId" label={<span className="font-semibold text-slate-700">1. Select Target Shift <span className="text-red-500">*</span></span>} rules={[{ required: true }]}>
             <Select placeholder="Search and select a Shift..." showSearch optionFilterProp="children" size="large" className="rounded-lg">
               {shifts.map(s => (
                 <Option key={s._id} value={s._id}>
                   <div className="flex justify-between items-center py-1">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{s.coreTiming.startTime} → {s.coreTiming.endTime}</span>
                   </div>
                 </Option>
               ))}
             </Select>
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 border-t border-slate-100 pt-6">
            <Form.Item name="entityType" label={<span className="font-semibold text-slate-700">2. Assignment Level <span className="text-red-500">*</span></span>} rules={[{ required: true }]}>
              <Select size="large">
                <Option value="Employee"><span className="flex items-center gap-2"><UserCheck size={14}/> Employee Specific</span></Option>
                <Option value="Department"><span className="flex items-center gap-2"><Users size={14}/> Department Wide</span></Option>
                <Option value="Designation"><span className="flex items-center gap-2"><Briefcase size={14}/> Designation Wide</span></Option>
                <Option value="Branch"><span className="flex items-center gap-2"><Building2 size={14}/> Branch Wide</span></Option>
                <Option value="Location"><span className="flex items-center gap-2"><Activity size={14}/> Location Wide</span></Option>
                <Option value="Grade"><span className="flex items-center gap-2"><Briefcase size={14}/> Grade Wide</span></Option>
                <Option value="Company"><span className="flex items-center gap-2"><ShieldCheck size={14}/> Company Default</span></Option>
              </Select>
            </Form.Item>
            
            {entityType !== 'Company' && entityType !== undefined ? (
               <Form.Item name="entityId" label={<span className="font-semibold text-slate-700">Select {entityType} <span className="text-red-500">*</span></span>} rules={[{ required: true }]}>
                  {entityType === 'Employee' && (
                    <Select showSearch placeholder="Search Employee" optionFilterProp="children" size="large">
                      {employees.map(e => <Option key={e._id} value={e._id}>{e.firstName} {e.lastName} ({e.employeeId})</Option>)}
                    </Select>
                  )}
                  {entityType === 'Department' && (
                    <Select showSearch placeholder="Select Department" optionFilterProp="children" size="large">
                      {departments.map(d => <Option key={d._id} value={d._id}>{d.name}</Option>)}
                    </Select>
                  )}
                  {entityType === 'Designation' && (
                    <Select showSearch placeholder="Select Designation" optionFilterProp="children" size="large">
                      {designations.map(d => <Option key={d._id} value={d._id}>{d.name}</Option>)}
                    </Select>
                  )}
                  {entityType === 'Branch' && (
                    <Select showSearch placeholder="Select Branch" optionFilterProp="children" size="large">
                      {branches.map(b => <Option key={b._id} value={b._id}>{b.name}</Option>)}
                    </Select>
                  )}
                  {entityType === 'Location' && (
                    <Select showSearch placeholder="Select Location" optionFilterProp="children" size="large">
                      {locations.map(l => <Option key={l._id} value={l._id}>{l.name}</Option>)}
                    </Select>
                  )}
                  {entityType === 'Grade' && (
                    <Select showSearch placeholder="Select Grade" optionFilterProp="children" size="large">
                      {grades.map(g => <Option key={g._id} value={g._id}>{g.name}</Option>)}
                    </Select>
                  )}
               </Form.Item>
            ) : (
               <div className="pt-[34px] text-sm text-emerald-600 font-medium flex items-center gap-2">
                 <CheckCircle2 size={16}/> Applies to ALL employees
               </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 mt-4">
             <p className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><CalendarDays size={16}/> 3. Effective Dates</p>
             <div className="grid grid-cols-2 gap-4">
               <Form.Item name="effectiveFrom" label="Start Date" rules={[{ required: true }]} className="mb-0">
                  <DatePicker className="w-full" format="DD MMM YYYY" size="large" />
               </Form.Item>
               <Form.Item name="effectiveTo" label="End Date (Optional)" className="mb-0">
                  <DatePicker className="w-full" format="DD MMM YYYY" placeholder="Forever" size="large" />
               </Form.Item>
             </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-slate-100">
             <Button onClick={() => setIsModalVisible(false)} size="large" className="rounded-xl">Cancel</Button>
             <Button 
               type="primary" 
               htmlType="submit" 
               loading={loading}
               size="large"
               className="rounded-xl font-semibold shadow-md shadow-indigo-500/20"
               style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none' }}
             >
               Schedule Assignment
             </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
