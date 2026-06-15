import React, { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { Modal, Form, Input, Select, InputNumber, Button, Table, Tag, Card, Row, Col, Statistic, Tooltip, Popconfirm, Pagination, AutoComplete } from 'antd';
import { message } from '../../utils/antdGlobal';
import { Target, Users, Landmark, Plus, Search, Edit3, Trash2, ShieldCheck, Briefcase, Layers, Zap } from 'lucide-react';
import usePagePermissions from '../../hooks/usePagePermissions';
import { DEPARTMENT_OPTIONS, getDesignationsForDepartment, ALL_DESIGNATION_OPTIONS } from '../../constants/departmentDesignationMaster';

const { Option } = Select;

const PositionMaster = () => {
    const { canView, canCreate, canEdit, canDelete } = usePagePermissions('hiring.positions');
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [summary, setSummary] = useState({ total: 0, vacant: 0, filled: 0 });
    const [nextId, setNextId] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const selectedDepartment = Form.useWatch('department', form);
    const designationOptions = useMemo(() => {
        const departmentDesignations = getDesignationsForDepartment(selectedDepartment);
        const options = departmentDesignations.length ? departmentDesignations : ALL_DESIGNATION_OPTIONS;
        return options.map((value) => ({ value }));
    }, [selectedDepartment]);

    const fetchNextId = async () => {
        try {
            setNextId('Loading...');
            const res = await api.post('/company-id-config/next', { entityType: 'POS', increment: false });
            if (res.data?.data?.id) {
                setNextId(res.data.data.id);
            } else {
                setNextId('Error');
            }
        } catch (error) {
            console.error("Failed to fetch next ID", error);
            setNextId('Auto-Generate');
        }
    };

    useEffect(() => {
        fetchPositions();
    }, []);

    const fetchPositions = async () => {
        try {
            setLoading(true);
            const res = await api.get('/positions');
            if (res.data.success) {
                const data = Array.isArray(res.data.data) ? res.data.data : [];
                setPositions(data);
                calculateSummary(data);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            message.error('Failed to load positions');
        } finally {
            setLoading(false);
        }
    };

    const calculateSummary = (data) => {
        const total = data.length;
        const vacant = data.filter(p => p.status === 'Vacant').length;
        const filled = data.filter(p => p.status === 'Filled').length;
        setSummary({ total, vacant, filled });
    };

    const handleCreate = () => {
        setEditingId(null);
        form.resetFields();
        fetchNextId();
        setIsModalOpen(true);
    };

    const handleEdit = (record) => {
        setEditingId(record._id);
        form.setFieldsValue(record);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        try {
            const res = await api.delete(`/positions/${id}`);
            if (res.data.success) {
                message.success('Position deleted');
                fetchPositions();
            }
        } catch {
            message.error('Failed to delete position');
        }
    };

    const onFinish = async (values) => {
        try {
            setSubmitting(true);
            if (editingId) {
                await api.put(`/positions/${editingId}`, values);
                message.success('Position updated');
            } else {
                await api.post('/positions', values);
                message.success('New position created with automated ID');
            }
            setIsModalOpen(false);
            fetchPositions();
        } catch {
            message.error('Operation failed');
        } finally {
            setSubmitting(false);
        }
    };

    // Filtered positions based on search
    const filteredPositions = positions.filter(pos =>
        pos.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pos.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pos.positionId?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Reset pagination on search
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // Paginated subset
    const paginatedPositions = filteredPositions.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    if (!canView && !loading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] border border-slate-100 shadow-sm text-center m-6 font-inter group">
                <div className="w-24 h-24 bg-rose-50 rounded-[2.5rem] flex items-center justify-center text-rose-500 mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-sm border border-rose-100">
                    <Shield size={48} strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight uppercase">Access Restricted</h3>
                <p className="text-slate-400 font-bold text-[11px] max-w-sm mx-auto uppercase tracking-[0.2em] leading-relaxed opacity-80">
                    You do not have authorization to view Position Master.
                </p>
                <div className="mt-8 flex items-center gap-3">
                    <div className="h-1 w-12 bg-slate-100 rounded-full"></div>
                    <Lock size={16} className="text-amber-400" />
                    <div className="h-1 w-12 bg-slate-100 rounded-full"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="px-5 py-6 w-full animate-in fade-in duration-700 selection:bg-indigo-100 selection:text-indigo-900">
            <Row gutter={16} className="mb-6">
                <Col span={8}>
                    <div className="relative overflow-hidden bg-gradient-to-br from-white to-indigo-50/60 p-4 rounded-2xl border border-indigo-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300 group">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500"></div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-11 h-11 rounded-[14px] bg-indigo-50 flex items-center justify-center text-indigo-900 shadow-inner border border-indigo-100/50 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                                <ShieldCheck size={22} strokeWidth={2.5} className="drop-shadow-sm" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5">Total Positions</span>
                                <span className="text-3xl font-black text-slate-800 tracking-tighter leading-none">{summary.total}</span>
                            </div>
                        </div>
                        <div className="absolute left-0 bottom-0 w-1 h-0 bg-indigo-500 group-hover:h-full transition-all duration-300 rounded-l-2xl"></div>
                    </div>
                </Col>
                <Col span={8}>
                    <div className="relative overflow-hidden bg-gradient-to-br from-white to-rose-50/60 p-4 rounded-2xl border border-rose-100 shadow-sm hover:shadow-md hover:border-rose-200 transition-all duration-300 group">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all duration-500"></div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-11 h-11 rounded-[14px] bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner border border-rose-100/50 group-hover:scale-110 group-hover:rotate-[-3deg] transition-transform duration-300">
                                <Users size={22} strokeWidth={2.5} className="drop-shadow-sm" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5">Vacant Slots</span>
                                <span className="text-3xl font-black text-slate-800 tracking-tighter leading-none">{summary.vacant}</span>
                            </div>
                        </div>
                        <div className="absolute left-0 bottom-0 w-1 h-0 bg-rose-500 group-hover:h-full transition-all duration-300 rounded-l-2xl"></div>
                    </div>
                </Col>
                <Col span={8}>
                    <div className="relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/60 p-4 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-300 group">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500"></div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-11 h-11 rounded-[14px] bg-emerald-50 flex items-center justify-center text-emerald-500 shadow-inner border border-emerald-100/50 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                                <Landmark size={22} strokeWidth={2.5} className="drop-shadow-sm" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5">Filled Roles</span>
                                <span className="text-3xl font-black text-slate-800 tracking-tighter leading-none">{summary.filled}</span>
                            </div>
                        </div>
                        <div className="absolute left-0 bottom-0 w-1 h-0 bg-emerald-500 group-hover:h-full transition-all duration-300 rounded-l-2xl"></div>
                    </div>
                </Col>
            </Row>

            {/* Search Bar & Header Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="relative group max-w-md w-full">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                        <Search size={16} />
                    </div>
                    <Input
                        placeholder="Filter by role or department..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-11 h-11 bg-white border-slate-200/60 rounded-2xl text-sm font-medium transition-all focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 placeholder:text-slate-400 shadow-sm"
                    />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {canCreate && (
                        <Button
                            onClick={handleCreate}
                            className="h-11 px-6 bg-[#4F46E5] text-white rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-[#0ea5e9] hover:text-white transition-all shadow-lg shadow-indigo-500/10 border-none flex items-center gap-2"
                            icon={<Plus size={16} strokeWidth={3} />}
                        >
                            Create New Position
                        </Button>
                    )}
                </div>
            </div>

            {/* Data List Container */}
            <div className="w-full bg-white/20 rounded-2xl p-[10px] backdrop-blur-sm border border-white/50 shadow-sm">
                {/* Modern Spaced Headers with Grid Alignment */}
                <div className="grid grid-cols-[1.5fr_2fr_1.2fr_1.2fr_1fr_1.5fr_0.8fr] items-center px-[10px] py-3 mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Position ID</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Job Title</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Department</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] text-center">Status</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] text-center">Hiring</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Salary Range</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] text-right">Actions</span>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] border border-dashed border-slate-200 animate-pulse">
                        <div className="w-12 h-12 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin mb-4"></div>
                        <p className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest">Syncing Records...</p>
                    </div>
                ) : filteredPositions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] border border-slate-100 shadow-sm text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-300 mb-6">
                            <Layers size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">No positions found</h3>
                        <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto">We couldn't find any positions matching your search criteria.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {paginatedPositions.map((pos) => (
                            <div
                                key={pos._id}
                                className="group grid grid-cols-[1.5fr_2fr_1.2fr_1.2fr_1fr_1.5fr_0.8fr] items-center p-[10px] bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300 cursor-default"
                            >
                                {/* Column 1: Position ID */}
                                <div className="flex">
                                    <span className="text-[9px] font-mono font-bold text-indigo-900 bg-indigo-50/50 px-2.5 py-1 rounded-lg uppercase border border-indigo-100/50">
                                        {pos.positionId}
                                    </span>
                                </div>

                                {/* Column 2: Job Title */}
                                <div>
                                    <h4 className="text-[13px] font-bold text-slate-800 leading-tight group-hover:text-indigo-900 transition-colors uppercase tracking-tight pr-4">
                                        {pos.jobTitle}
                                    </h4>
                                </div>

                                {/* Column 3: Department */}
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight bg-slate-50 px-2.5 py-1 rounded-lg">
                                        {pos.department}
                                    </span>
                                </div>

                                {/* Column 4: Status */}
                                <div className="flex justify-center">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-extrabold rounded-full uppercase tracking-wider border ${pos.status === 'Vacant' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        }`}>
                                        <div className={`w-1 h-1 rounded-full animate-pulse ${pos.status === 'Vacant' ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                                        {pos.status}
                                    </span>
                                </div>

                                {/* Column 5: Hiring */}
                                <div className="flex justify-center">
                                    <span className={`inline-flex items-center px-3 py-1 text-[9px] font-extrabold rounded-full uppercase tracking-wider border transition-all ${pos.hiringStatus === 'Open' ? 'bg-indigo-50 text-indigo-900 border-indigo-100 shadow-sm shadow-indigo-500/5' : 'bg-slate-50 text-slate-400 border-slate-100 opacity-60'
                                        }`}>
                                        {pos.hiringStatus}
                                    </span>
                                </div>

                                {/* Column 6: Salary Range */}
                                <div className="flex flex-col justify-center">
                                    <div className="flex items-center gap-1.5 font-bold text-slate-700 text-[13px]">
                                        <span className="text-indigo-500/40 font-medium">₹</span>
                                        <span>{pos.baseSalaryRange?.min?.toLocaleString()} - {pos.baseSalaryRange?.max?.toLocaleString()}</span>
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-0.5 ml-3.5">Annual LPA</span>
                                </div>

                                {/* Column 7: Actions */}
                                <div className="flex items-center gap-1.5 justify-end">
                                    {canEdit && (
                                        <Tooltip title="Modify Detail">
                                            <button
                                                onClick={() => handleEdit(pos)}
                                                className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-900 transition-all border border-slate-100 hover:border-indigo-200"
                                            >
                                                <Edit3 size={15} />
                                            </button>
                                        </Tooltip>
                                    )}
                                    {canDelete && (
                                        <Popconfirm title="Delete this role?" onConfirm={() => handleDelete(pos._id)}>
                                            <button className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all border border-slate-100 hover:border-rose-200">
                                                <Trash2 size={15} />
                                            </button>
                                        </Popconfirm>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Pagination Bar */}
                        <div className="flex items-center justify-between px-[10px] py-4 bg-white/50 rounded-xl border border-white mt-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                showing <span className="text-indigo-900 font-bold">{(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredPositions.length)}</span> of {filteredPositions.length} roles
                            </span>
                            <div className="custom-pagination">
                                <Pagination
                                    current={currentPage}
                                    pageSize={pageSize}
                                    total={filteredPositions.length}
                                    onChange={(page) => setCurrentPage(page)}
                                    showSizeChanger={false}
                                    size="small"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Plus size={14} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">{editingId ? 'Edit Position Detail' : 'Create Position'}</h3>
                    </div>
                }
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                width={560}
                className="custom-modal"
                centered
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    initialValues={{ status: 'Vacant', hiringStatus: 'Closed', isReplacement: false }}
                    className="mt-3"
                >
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item name="department" label={<span className="text-[9px] font-bold text-slate-400 uppercase">Department</span>} rules={[{ required: true }]}>
                                <Select showSearch placeholder="Assign to Unit" className="h-8 custom-select text-xs" optionFilterProp="children">
                                    {DEPARTMENT_OPTIONS.map((department) => (
                                        <Option key={department} value={department}>{department}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="jobTitle" label={<span className="text-[9px] font-bold text-slate-400 uppercase">Designation</span>} rules={[{ required: true }]}>
                                <AutoComplete
                                    options={designationOptions}
                                    placeholder="e.g. Lead UI/UX Designer"
                                    className="h-8 rounded-lg border-slate-200 text-xs font-bold text-slate-700"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={12}>
                        <Col span={8}>
                            <Form.Item name="status" label={<span className="text-[9px] font-bold text-slate-400 uppercase">Status</span>}>
                                <Select className="h-8 custom-select text-xs">
                                    <Option value="Vacant">Vacant</Option>
                                    <Option value="Filled">Filled</Option>
                                    <Option value="Cancelled">Cancelled</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="hiringStatus" label={<span className="text-[9px] font-bold text-slate-400 uppercase">Hiring</span>}>
                                <Select className="h-8 custom-select text-xs">
                                    <Option value="Open">Active</Option>
                                    <Option value="Closed">Closed</Option>
                                    <Option value="Paused">On-Hold</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="isReplacement" label={<span className="text-[9px] font-bold text-slate-400 uppercase">Headcount</span>}>
                                <Select className="h-8 custom-select text-xs">
                                    <Option value={false}>New Role</Option>
                                    <Option value={true}>Backfill</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <div className="bg-slate-50/50 px-3 py-2.5 rounded-xl mb-3 border border-slate-100">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Target Compensation Range (LPA)</label>
                        <Row gutter={12}>
                            <Col span={12}>
                                <Form.Item name={['baseSalaryRange', 'min']} label={<span className="text-[9px] font-bold text-slate-400">MIN BASE</span>}>
                                    <InputNumber
                                        className="w-full h-8 rounded-lg border-slate-200 text-xs"
                                        formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name={['baseSalaryRange', 'max']} label={<span className="text-[9px] font-bold text-slate-400">MAX BASE</span>}>
                                    <InputNumber
                                        className="w-full h-8 rounded-lg border-slate-200 text-xs"
                                        formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {!editingId && (
                        <div className="bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 flex items-center gap-3 mb-3">
                            <div className="bg-indigo-600 p-1.5 rounded-md text-white">
                                <ShieldCheck size={14} />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-indigo-900 leading-tight">
                                    Next ID: <span className="font-mono text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200">{nextId || 'Loading...'}</span>
                                </div>
                                <div className="text-[9px] text-indigo-700/70 mt-0.5">Auto-generated by org config.</div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button size="middle" onClick={() => setIsModalOpen(false)} className="rounded-lg px-5 font-bold text-[10px] uppercase tracking-widest text-slate-400 border-slate-200">Close</Button>
                        <Button
                            type="primary"
                            size="middle"
                            htmlType="submit"
                            loading={submitting}
                            className="bg-[#4F46E5] rounded-lg px-6 border-none font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20"
                        >
                            {editingId ? 'Update Master' : 'Finalize Position'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default PositionMaster;
