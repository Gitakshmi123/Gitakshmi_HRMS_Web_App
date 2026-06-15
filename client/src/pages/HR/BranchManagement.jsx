import React, { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { 
  Building2, 
  MapPin, 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  User,
  LayoutGrid,
  List,
  Filter,
  ArrowRight
} from 'lucide-react';
import { showToast, showConfirmToast } from '../../utils/uiNotifications';
import { Select, Modal, Input, Button, Tag, Space, Table, Empty } from 'antd';

const { Option } = Select;

export default function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentBranch, setCurrentBranch] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    branchCode: '',
    address: '',
    city: '',
    state: '',
    headUserId: null,
    status: 'active'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [branchRes, empRes] = await Promise.all([
        api.get('/branch/list'),
        api.get('/hr/employees?limit=1000')
      ]);
      
      setBranches(branchRes.data?.items || []);
      setEmployees(empRes.data?.data || empRes.data || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      showToast('error', 'Error', 'Failed to load branches and employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredBranches = useMemo(() => {
    return branches.filter(b => 
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.branchCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.city?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [branches, searchTerm]);

  const handleOpenModal = (branch = null) => {
    if (branch) {
      setCurrentBranch(branch);
      setIsEditing(true);
      setFormData({
        name: branch.name,
        branchCode: branch.branchCode,
        address: branch.address || '',
        city: branch.city || '',
        state: branch.state || '',
        headUserId: branch.headUserId?._id || branch.headUserId || null,
        status: branch.status || 'active'
      });
    } else {
      setCurrentBranch(null);
      setIsEditing(false);
      setFormData({
        name: '',
        branchCode: '',
        address: '',
        city: '',
        state: '',
        headUserId: null,
        status: 'active'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.branchCode) {
      showToast('warning', 'Missing Fields', 'Name and Branch Code are required');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        await api.put(`/branch/${currentBranch._id}`, formData);
        showToast('success', 'Updated', 'Branch updated successfully');
      } else {
        await api.post('/branch/create', formData);
        showToast('success', 'Created', 'Branch created successfully');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save branch';
      showToast('error', 'Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    showConfirmToast({
      title: 'Delete Branch',
      description: 'Are you sure you want to delete this branch? This action cannot be undone.',
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/branch/${id}`);
          showToast('success', 'Deleted', 'Branch removed successfully');
          loadData();
        } catch (err) {
          showToast('error', 'Error', 'Failed to delete branch');
        }
      }
    });
  };

  const getHeadName = (headId) => {
    const head = employees.find(e => e._id === headId);
    if (!head) return 'Not Assigned';
    return `${head.firstName} ${head.lastName}`;
  };

  return (
    <div className="animate-in fade-in p-6">
      {/* Header Section */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Branch Management</h1>
          <p className="mt-1 text-slate-500">Manage your company's physical locations and branch heads.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 hover:shadow-indigo-300 active:scale-95"
        >
          <Plus size={18} />
          <span>Add New Branch</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Search by name, code or city..."
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          <button 
            onClick={() => setViewMode('grid')}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LayoutGrid size={20} />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <List size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            <p className="text-sm font-medium text-slate-500">Loading branches...</p>
          </div>
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 py-20 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Building2 size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">No Branches Found</h3>
          <p className="mt-2 text-slate-500">Start by adding your first company branch location.</p>
          <button 
            onClick={() => handleOpenModal()}
            className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 px-6 py-2 text-sm font-bold text-indigo-600 transition hover:bg-indigo-100"
          >
            Create Your First Branch
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBranches.map(branch => (
            <div 
              key={branch._id} 
              className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1"
            >
              {/* Status Badge */}
              <div className="absolute right-6 top-6">
                {branch.status === 'active' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    <CheckCircle2 size={12} />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-600">
                    <XCircle size={12} />
                    Inactive
                  </span>
                )}
              </div>

              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                <Building2 size={28} />
              </div>

              <h2 className="text-xl font-bold text-slate-800">{branch.name}</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{branch.branchCode}</p>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex-shrink-0 text-slate-400">
                    <MapPin size={16} />
                  </div>
                  <div className="text-sm text-slate-600 font-medium">
                    <p className="truncate">{branch.address || 'No address'}</p>
                    <p className="text-slate-400">{branch.city}{branch.state ? `, ${branch.state}` : ''}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 text-slate-400">
                    <User size={16} />
                  </div>
                  <div className="text-sm font-semibold text-slate-700">
                    <span className="text-xs text-slate-400 font-normal mr-1">Head:</span>
                    {branch.headUserId?.name || getHeadName(branch.headUserId)}
                  </div>
                </div>
              </div>

              {/* Hover Actions */}
              <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-4">
                <button 
                  onClick={() => handleOpenModal(branch)}
                  className="flex items-center gap-2 text-sm font-bold text-indigo-600 transition hover:text-indigo-800"
                >
                  Edit Details
                  <ArrowRight size={14} />
                </button>
                <button 
                  onClick={() => handleDelete(branch._id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-premium p-0">
          <Table 
            dataSource={filteredBranches}
            rowKey="_id"
            pagination={{ pageSize: 10 }}
            className="premium-table"
            columns={[
              {
                title: 'Branch Name',
                dataIndex: 'name',
                render: (text, record) => (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Building2 size={16} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{text}</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">{record.branchCode}</div>
                    </div>
                  </div>
                )
              },
              {
                title: 'Location',
                render: (_, record) => (
                  <div className="text-sm font-medium text-slate-600">
                    {record.city}, {record.state}
                  </div>
                )
              },
              {
                title: 'Branch Head',
                dataIndex: 'headUserId',
                render: (val) => (
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <User size={12} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{val?.name || getHeadName(val)}</span>
                  </div>
                )
              },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (status) => (
                  <Tag color={status === 'active' ? 'success' : 'error'} className="rounded-full border-0 px-3 font-bold uppercase tracking-wider text-[10px]">
                    {status}
                  </Tag>
                )
              },
              {
                title: 'Actions',
                align: 'right',
                render: (_, record) => (
                  <Space>
                    <Button 
                      icon={<Edit2 size={14} />} 
                      type="text" 
                      className="text-slate-400 hover:text-indigo-600"
                      onClick={() => handleOpenModal(record)}
                    />
                    <Button 
                      icon={<Trash2 size={14} />} 
                      type="text" 
                      danger 
                      className="opacity-40 hover:opacity-100"
                      onClick={() => handleDelete(record._id)}
                    />
                  </Space>
                )
              }
            ]}
          />
        </div>
      )}

      {/* Upsert Modal */}
      <Modal
        title={<h3 className="text-xl font-bold text-slate-800">{isEditing ? 'Edit Branch' : 'Register New Branch'}</h3>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
        centered
        className="premium-modal"
      >
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Branch Name</label>
            <Input 
              placeholder="e.g. Headquarters" 
              className="h-11 rounded-xl border-slate-200 transition focus:border-indigo-400"
              value={formData.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Branch Code</label>
            <Input 
              placeholder="e.g. BR-001" 
              className="h-11 rounded-xl border-slate-200 transition focus:border-indigo-400"
              value={formData.branchCode}
              onChange={e => setFormData(p => ({ ...p, branchCode: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Full Address</label>
            <Input.TextArea 
              rows={3}
              placeholder="Enter building, street details..." 
              className="rounded-2xl border-slate-200 transition focus:border-indigo-400"
              value={formData.address}
              onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">City</label>
            <Input 
              placeholder="e.g. Mumbai" 
              className="h-11 rounded-xl border-slate-200 transition focus:border-indigo-400"
              value={formData.city}
              onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">State / Region</label>
            <Input 
              placeholder="e.g. Maharashtra" 
              className="h-11 rounded-xl border-slate-200 transition focus:border-indigo-400"
              value={formData.state}
              onChange={e => setFormData(p => ({ ...p, state: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Branch Head</label>
            <Select 
              showSearch
              placeholder="Select employee" 
              className="w-full h-11"
              dropdownClassName="rounded-xl shadow-lg border-slate-100"
              value={formData.headUserId}
              onChange={val => setFormData(p => ({ ...p, headUserId: val }))}
              filterOption={(input, option) => 
                (option?.children || '').toLowerCase().includes(input.toLowerCase())
              }
            >
              <Option value={null}>Not Assigned</Option>
              {employees.map(emp => (
                <Option key={emp._id} value={emp._id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeId})
                </Option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Operating Status</label>
            <Select 
              className="w-full h-11"
              value={formData.status}
              onChange={val => setFormData(p => ({ ...p, status: val }))}
            >
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
            </Select>
          </div>
        </div>

        <div className="mt-10 flex justify-end gap-3 border-t border-slate-50 pt-6">
          <Button 
            className="h-11 rounded-xl border-slate-200 px-6 font-semibold"
            onClick={() => setIsModalOpen(false)}
          >
            Cancel
          </Button>
          <Button 
            type="primary"
            loading={submitting}
            onClick={handleSubmit}
            className="h-11 rounded-xl bg-indigo-600 px-8 font-semibold shadow-lg shadow-indigo-100 hover:bg-indigo-700"
          >
            {isEditing ? 'Update Branch' : 'Register Branch'}
          </Button>
        </div>
      </Modal>

      <style>{`
        .premium-table .ant-table-thead > tr > th {
          background: #f8fafc;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #64748b;
          border-bottom: 1px solid #f1f5f9;
        }
        .premium-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f8fafc;
          padding: 16px;
        }
        .premium-modal .ant-modal-content {
          border-radius: 2rem;
          padding: 2rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.2);
        }
        .premium-modal .ant-select-selector {
          border-radius: 0.75rem !important;
          border-color: #e2e8f0 !important;
        }
        .premium-modal .ant-select-focused:not(.ant-select-disabled).ant-select:not(.ant-select-customize-input) .ant-select-selector {
          border-color: #818cf8 !important;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1) !important;
        }
      `}</style>
    </div>
  );
}
