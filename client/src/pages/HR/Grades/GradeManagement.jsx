import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Table, Button, Modal, Form, Input, InputNumber, 
  Select, Switch, Card, Tag, Space, Tooltip, 
  Empty, Skeleton, Popconfirm, Divider 
} from 'antd';
import { 
  Plus, Edit2, Trash2, Shield, Search, Layers, Target, 
  CheckCircle, XCircle, Info, Briefcase, User, Users, Building2
} from 'lucide-react';
import { showToast } from '../../../utils/uiNotifications';
import api from '../../../utils/api';
import { AnimatePresence, motion } from 'framer-motion';
import GradeExcelUploadModal from '../../../components/HR/GradeExcelUploadModal';

/**
 * GradeManagement Component
 * 
 * Features:
 * - Grade CRUD with premium UI
 * - Policy Target Selection logic demo
 * - Multi-select integration
 */
export default function GradeManagement() {
  const [grades, setGrades] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Policy Selection Demo State
  const [targetType, setTargetType] = useState('ALL');
  const [selectedTargets, setSelectedTargets] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [gradeRes, deptRes, posRes] = await Promise.all([
        api.get('/grades'),
        api.get('/hr/departments'),
        api.get('/positions')
      ]);
      
      const gradeData = Array.isArray(gradeRes.data?.data) ? gradeRes.data.data : (Array.isArray(gradeRes.data) ? gradeRes.data : []);
      const deptData = Array.isArray(deptRes.data?.data) ? deptRes.data.data : (Array.isArray(deptRes.data) ? deptRes.data : []);
      const posData = Array.isArray(posRes.data?.data) ? posRes.data.data : (Array.isArray(posRes.data) ? posRes.data : []);

      setGrades(gradeData);
      setDepartments(deptData);
      setDesignations(posData);
      
      // Demo fallbacks removed to ensure valid MongoDB ObjectIds are used

    } catch (err) {
      console.error('Failed to fetch data:', err);
      showToast('info', 'Demo Mode', 'Loading targeting data...');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/grades/${id}`);
      showToast('success', 'Success', 'Grade deleted successfully');
      fetchData();
    } catch {
      showToast('error', 'Error', 'Failed to delete grade');
    }
  };

  const handleOpenModal = (grade = null) => {
    setEditingGrade(grade);
    setIsModalOpen(true);
  };

  const filteredGrades = useMemo(() => {
    return grades.filter(g => 
      (g.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (g.code || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [grades, searchTerm]);

  const columns = [
    {
      title: 'GRADE IDENTITY',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-slate-600 border border-indigo-100 shadow-sm">
            <Layers size={18} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-slate-900">{text}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{record.code}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'HIERARCHY LEVEL',
      dataIndex: 'level',
      key: 'level',
      render: (level) => (
        <Tag color="blue" className="rounded-lg px-3 py-0.5 font-bold border-none bg-blue-50 text-blue-600">
          LEVEL {level}
        </Tag>
      ),
    },
    {
      title: 'STATUS',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active) => (
        <div className={`flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-widest ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
          {active ? <CheckCircle size={12} /> : <XCircle size={12} />}
          {active ? 'Active' : 'Inactive'}
        </div>
      ),
    },
    {
      title: 'DESCRIPTION',
      dataIndex: 'description',
      key: 'description',
      className: 'text-slate-500 text-[12px] font-medium max-w-[200px] truncate',
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="Edit Grade">
            <Button 
              type="text" 
              icon={<Edit2 size={16} className="text-slate-600" />} 
              onClick={() => handleOpenModal(record)}
              className="hover:bg-indigo-50 rounded-lg flex items-center justify-center"
            />
          </Tooltip>
          <Popconfirm
            title="Delete Grade"
            onConfirm={() => handleDelete(record._id)}
          >
            <Button 
              type="text" 
              danger 
              icon={<Trash2 size={16} />} 
              className="hover:bg-rose-50 rounded-lg flex items-center justify-center"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-10 bg-[#F8FAFC] min-h-screen font-sans space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-slate-800 rounded-lg text-white shadow-lg shadow-indigo-200">
              <Shield size={18} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Grade System</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium">Configure organization levels, benefits, and hierarchical structure.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search grades..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all w-[240px]"
            />
          </div>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={18} />
            Create Grade
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8">
          <Card className="rounded-[2rem] border-slate-200/60 shadow-sm overflow-hidden" bodyStyle={{ padding: 0 }}>
            <Table 
              columns={columns} 
              dataSource={filteredGrades} 
              loading={loading}
              rowKey="_id"
              pagination={{ pageSize: 10, className: "px-6 py-4" }}
            />
          </Card>
        </div>

        <div className="xl:col-span-4 space-y-6">
          <Card className="rounded-[2rem] border-slate-200/60 shadow-sm p-6 bg-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
                <Target size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Policy Targeting</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Apply logic to specific groups</p>
              </div>
            </div>

            <PolicyTargetSelector 
              grades={grades}
              departments={departments}
              designations={designations}
              targetType={targetType}
              setTargetType={setTargetType}
              selectedTargets={selectedTargets}
              setSelectedTargets={setSelectedTargets}
            />

            <Divider className="my-6 border-slate-100" />

            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Info size={14} className="text-indigo-500" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Target Summary</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {targetType === 'ALL' ? (
                  <Tag className="rounded-lg px-2 py-1 bg-emerald-50 text-emerald-600 border-emerald-100 font-bold text-[10px]">ALL EMPLOYEES</Tag>
                ) : selectedTargets.length === 0 ? (
                  <span className="text-xs text-slate-400 font-medium italic">No specific targets selected</span>
                ) : (
                  selectedTargets.map(id => (
                    <Tag key={id} closable onClose={() => setSelectedTargets(prev => prev.filter(t => t !== id))} className="rounded-lg px-2 py-1 bg-indigo-50 text-slate-600 border-indigo-100 font-bold text-[10px]">
                      {id}
                    </Tag>
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <GradeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchData} grade={editingGrade} />
      <GradeExcelUploadModal 
        isOpen={showUploadModal} 
        onClose={() => setShowUploadModal(false)} 
        onSuccess={(result) => {
          if (result.uploadedCount > 0) {
            fetchData();
          }
        }} 
      />
    </div>
  );
}

const ActiveSwitch = ({ value, onChange }) => (
  <div className="h-11 flex items-center px-3 bg-white rounded-xl border border-slate-200">
    <Switch size="small" checked={!!value} onChange={onChange} />
    <span className="ml-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Active Status</span>
  </div>
);

function GradeModal({ isOpen, onClose, onSuccess, grade }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (grade) {
        form.setFieldsValue({
          name: grade.name,
          code: grade.code,
          level: grade.level,
          description: grade.description,
          isActive: grade.isActive
        });
      } else {
        form.resetFields();
      }
    }
  }, [isOpen, grade, form]);

  const handleFinish = async (values) => {
    setSaving(true);
    try {
      if (grade) {
        await api.put(`/grades/${grade._id}`, values);
        showToast('success', 'Updated', 'Grade configuration saved');
      } else {
        await api.post('/grades', values);
        showToast('success', 'Created', 'New grade created successfully');
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error("API Error Response:", err.response?.data || err.message || err);
      let errorMessage = err.response?.data?.message || 'Failed to save grade configuration';
      if (err.response?.data?.details && Array.isArray(err.response.data.details)) {
        errorMessage = err.response.data.details.map(d => d.message).join(', ');
      }
      showToast('error', 'Validation Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={null}
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={500}
      centered
      className="premium-modal"
      destroyOnClose
    >
      <div className="p-2">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Layers size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
              {grade ? 'Edit Grade' : 'New Grade'}
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configure tier properties</p>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{ isActive: true, level: 1 }}
          requiredMark={false}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="name"
              label={<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grade Name</span>}
              rules={[
                { required: true, message: 'Required' },
                { min: 2, message: 'Must be at least 2 characters' }
              ]}
            >
              <Input placeholder="e.g. Senior Associate" className="rounded-xl border-slate-200 h-11 font-medium" />
            </Form.Item>
            <Form.Item
              name="code"
              label={<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Short Code</span>}
              rules={[{ required: true, message: 'Required' }]}
            >
              <Input placeholder="e.g. G2" className="rounded-xl border-slate-200 h-11 font-medium uppercase" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="level"
              label={<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hierarchy Level</span>}
              rules={[{ required: true, message: 'Required' }]}
            >
              <InputNumber min={1} max={999} className="w-full rounded-xl border-slate-200 h-11 flex items-center font-medium" />
            </Form.Item>
            <Form.Item
              name="isActive"
              label={<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visibility</span>}
            >
              <ActiveSwitch />
            </Form.Item>
          </div>

          <Form.Item
            name="description"
            label={<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</span>}
          >
            <Input.TextArea rows={3} placeholder="Describe the responsibilities or scope of this grade..." className="rounded-xl border-slate-200 font-medium" />
          </Form.Item>

          <div className="flex gap-3 pt-6">
            <Button 
              onClick={onClose} 
              className="flex-1 h-12 rounded-xl font-bold text-xs uppercase tracking-widest border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={saving}
              className="flex-1 h-12 rounded-xl font-bold text-xs uppercase tracking-widest bg-slate-800 hover:bg-indigo-700 shadow-lg shadow-indigo-100 border-none"
            >
              {grade ? 'Update Grade' : 'Save Grade'}
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
}

function PolicyTargetSelector({ grades, departments, designations, targetType, setTargetType, selectedTargets, setSelectedTargets }) {
  const options = [
    { label: 'All Employee', value: 'ALL', icon: <Users size={14} /> },
    { label: 'Selective Grades', value: 'GRADE', icon: <Layers size={14} /> },
    { label: 'Job Band Wise', value: 'JOB_TYPE', icon: <Briefcase size={14} /> },
    { label: 'Designation Wise', value: 'DESIGNATION', icon: <User size={14} /> },
    { label: 'By Department', value: 'DEPARTMENT', icon: <Building2 size={14} /> },
  ];

  const jobTypes = ['Full-time', 'Part-time', 'Intern', 'Contract', 'Probationer'];
  const bands = ['Band A', 'Band B', 'Band C', 'Band D', 'Band E'];

  const currentLabel = options.find(o => o.value === targetType)?.label || 'All Employee';

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Header Title from Image */}
        <div className="text-center">
            <h2 className="text-[18px] font-black text-slate-900 mb-6">{currentLabel}</h2>
        </div>

        <div className="bg-white border border-slate-900 rounded-sm overflow-hidden shadow-sm">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                setTargetType(opt.value);
                setSelectedTargets([]);
              }}
              className={`w-full px-6 py-3.5 text-left transition-all font-bold text-[15px] border-b border-slate-100 last:border-none
                ${targetType === opt.value 
                  ? 'bg-[#2563EB] text-white' 
                  : 'bg-white text-slate-700 hover:bg-slate-50'}
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {targetType !== 'ALL' && (
          <motion.div
            key={targetType}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-5 bg-white rounded-2xl border border-slate-200 space-y-4 shadow-inner"
          >
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Select {targetType.replace('_', ' ')}s</label>
                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{selectedTargets.length} selected</span>
            </div>
            {targetType === 'JOB_TYPE' ? (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Job Types</label>
                  <Select
                    mode="multiple"
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="Select job types..."
                    value={selectedTargets.filter(t => jobTypes.includes(t))}
                    onChange={(vals) => {
                      const otherVals = selectedTargets.filter(t => !jobTypes.includes(t));
                      setSelectedTargets([...otherVals, ...vals]);
                    }}
                    className="premium-select-box"
                  >
                    {jobTypes.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Job Bands</label>
                  <Select
                    mode="multiple"
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="Select bands..."
                    value={selectedTargets.filter(t => bands.includes(t))}
                    onChange={(vals) => {
                      const otherVals = selectedTargets.filter(t => !bands.includes(t));
                      setSelectedTargets([...otherVals, ...vals]);
                    }}
                    className="premium-select-box"
                  >
                    {bands.map(b => <Select.Option key={b} value={b}>{b}</Select.Option>)}
                  </Select>
                </div>
              </div>
            ) : (
              <Select
                mode="multiple"
                allowClear
                style={{ width: '100%' }}
                placeholder={`Choose ${targetType.toLowerCase().replace('_', ' ')} options...`}
                value={selectedTargets}
                onChange={setSelectedTargets}
                className="premium-select-box"
                maxTagCount="responsive"
              >
                {targetType === 'GRADE' && grades.map(g => (
                  <Select.Option key={g._id} value={g.name}>{g.name}</Select.Option>
                ))}
                {targetType === 'DESIGNATION' && designations.map(d => (
                  <Select.Option key={d._id} value={d.jobTitle}>{d.jobTitle}</Select.Option>
                ))}
                {targetType === 'DEPARTMENT' && departments.map(d => (
                  <Select.Option key={d._id} value={d.name}>{d.name}</Select.Option>
                ))}
              </Select>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADD Button from Image */}
      <div className="flex justify-center pt-2">
          <button 
            className="flex items-center gap-3 px-8 py-3 bg-[#9CA3AF]/20 text-[#2563EB] rounded-2xl font-black text-[14px] uppercase tracking-widest transition-all hover:bg-[#2563EB] hover:text-white group border border-transparent active:scale-95 shadow-sm"
            onClick={() => showToast('success', 'Targets Locked', 'Policy scope has been updated.')}
          >
            <Plus size={20} className="stroke-[3px]" />
            Add
          </button>
      </div>
    </div>
  );
}
