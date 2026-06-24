import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Pagination, Empty, Modal, Form, Input, Select, InputNumber, Switch } from 'antd';
import { showToast, showConfirmToast } from '../../utils/uiNotifications';
import api, { API_ROOT } from '../../utils/api';
import dayjs from 'dayjs';
import {
    Building2, Plus, Users, Briefcase, IndianRupee,
    User, Edit2, Trash2, Eye, FileText, Shield,
    MapPin, ChevronDown, Bell, Moon, LogOut, ArrowLeft, X,
    Search, UserCircle, LayoutGrid, List
} from 'lucide-react';
import usePagePermissions from '../../hooks/usePagePermissions';
import DepartmentExcelUploadModal from '../../components/HR/DepartmentExcelUploadModal';
import './Departments.css';

const BACKEND_URL = API_ROOT || '';

export default function Departments() {
    const navigate = useNavigate();
    const location = useLocation();
    const { canView, canCreate, canEdit, canDelete, loading: permLoading } = usePagePermissions('people.departments');
    const [depts, setDepts] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [openForm, setOpenForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 8;

    // Bulk Upload Modal State
    const [showUploadModal, setShowUploadModal] = useState(false);

    // List Modal States
    const [showEmpList, setShowEmpList] = useState(null);
    const [showPosList, setShowPosList] = useState(null);
    const [selectedDept, setSelectedDept] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Using individual catches to ensure department list loads even if employee list is restricted
            const [deptRes, empRes] = await Promise.all([
                api.get('/hr/departments'),
                api.get('/hr/employees?limit=1000').catch(err => {
                    console.warn('Optional employee data fetch failed (likely RBAC):', err.message);
                    return { data: { data: [] } };
                })
            ]);
            
            const rawDepts = deptRes.data?.data || deptRes.data;
            const rawEmps = empRes.data?.data || empRes.data;
            
            setDepts(Array.isArray(rawDepts) ? rawDepts : []);
            setEmployees(Array.isArray(rawEmps) ? rawEmps : []);
        } catch (err) {
            console.error('Dept Fetch Error:', err);
            showToast('error', 'Sync Failed', 'Could not refresh departmental data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const filteredDepts = useMemo(() => {
        return depts.filter(d => {
            const search = searchTerm.toLowerCase();
            return (d.name || '').toLowerCase().includes(search) ||
                   (d.code || '').toLowerCase().includes(search);
        });
    }, [depts, searchTerm]);

    const paginatedDepts = filteredDepts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const remove = (id) => {
        showConfirmToast({
            title: 'Terminate Department?',
            description: 'This action will remove the department record. Continue?',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onConfirm: async () => {
                try {
                    await api.delete(`/hr/departments/${id}`);
                    loadData();
                    showToast('success', 'Deleted', 'Department record removed');
                } catch (err) {
                    showToast('error', 'Error', 'Failed to delete department');
                }
            }
        });
    };

    const getDisplayName = (emp) => {
        if (!emp) return '';
        return `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Unknown';
    };

    const getInitials = (name = '') => {
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '??';
    };

    const getDeptColor = () => "#1088c7";

    const openEmployeeProfile = (emp) => {
        if (!emp?._id) return;
        const basePath = location.pathname.startsWith('/tenant') ? '/tenant/employees' : '/hr/employees';
        navigate(`${basePath}/${emp._id}/profile`, { state: { employee: emp } });
    };

    if (permLoading) return null;
    if (!canView) {
        return <Navigate to="/hr/dashboard" replace />;
    }

    return (
        <div className="departments-page-container">
            {/* Transparent Toolbar */}
            <div className="sticky top-[-15px] z-30 flex items-center gap-4 px-6 pt-4 pb-4 bg-slate-50/80 backdrop-blur-md border-b border-slate-100 shadow-sm mb-6">
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Search by name or code..."
                        className="search-input-premium"
                        style={{ width: '100%', height: '40px', padding: '0 12px 0 45px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px', background: '#fff' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {canCreate && (
                    <div className="flex gap-2">
                        <button 
                            type="button"
                            className="btn-outline-premium h-[40px] px-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors font-semibold text-slate-700 text-sm" 
                            onClick={(e) => { 
                                e.stopPropagation();
                                setShowUploadModal(true); 
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            Import
                        </button>
                        <button 
                            type="button"
                            className="btn-add-dept h-[40px]" 
                            onClick={(e) => { 
                                e.stopPropagation();
                                setEditing(null); 
                                setOpenForm(true); 
                            }}
                        >
                            <Plus size={18} /> Add Department
                        </button>
                    </div>
                )}
            </div>

            {/* Page Content */}
            <div className="px-5 pt-0">

                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid #f3f4f6', borderTop: '3px solid #1088c7', borderRadius: '50%', margin: '0 auto 15px' }}></div>
                        <p style={{ color: '#636e72', fontWeight: 600 }}>Syncing control center...</p>
                    </div>
                ) : depts.length === 0 ? (
                    <Empty description="No departments found." />
                ) : (
                    <>
                        <div className="dept-grid-page">
                            {paginatedDepts.map((dept, index) => {
                                if (!dept) return null;
                                const deptEmployees = Array.isArray(employees) ? employees.filter(e => e && e.department === dept.name) : [];
                                const headEmp = Array.isArray(employees) ? employees.find(e => e && e._id === (dept.head?._id || dept.head)) : null;
                                const color = getDeptColor(index);
                                
                                return (
                                    <div
                                        key={dept._id?.toString() || index}
                                        className="dept-card-premium"
                                        style={{ borderLeftColor: color, opacity: dept.status === 'inactive' ? 0.7 : 1, cursor: 'pointer' }}
                                        onClick={() => setSelectedDept(dept)}
                                    >
                                        <div className="dept-header">
                                            <div className="dept-name">
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <h3>{dept.name || 'Untitled Department'}</h3>
                                                    {dept.status === 'inactive' && (
                                                        <span style={{ background: '#ffeaa7', color: '#d63031', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>INACTIVE</span>
                                                    )}
                                                </div>
                                                <div className="sub-text">Code: {dept.code || 'N/A'} &bull; {dept.meta?.location || 'Main Branch'}</div>
                                            </div>
                                            <div className="dept-actions">
                                                <button 
                                                    className="action-icon" 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setSelectedDept(dept); 
                                                    }}
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                {canEdit && (
                                                    <button 
                                                        className="action-icon" 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setEditing(dept); 
                                                            setOpenForm(true); 
                                                        }}
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button 
                                                        className="action-icon delete" 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            remove(dept._id); 
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {dept.description && (
                                            <div style={{ fontSize: '13px', color: '#636e72', background: '#f8fafc', padding: '10px 15px', borderRadius: '8px', borderLeft: `3px solid ${color}`, fontStyle: 'italic' }}>
                                                "{dept.description}"
                                            </div>
                                        )}

                                        <div className="flex gap-2 items-stretch">
                                            <div className="hod-info flex-[1.4] !m-0">
                                                <div className="hod-avatar" style={headEmp?.profilePic ? { backgroundImage: `url(${String(headEmp.profilePic).startsWith('http') ? headEmp.profilePic : `${BACKEND_URL}${String(headEmp.profilePic).startsWith('/') ? '' : '/'}${headEmp.profilePic}`})` } : {}}>
                                                    {!headEmp?.profilePic && getInitials(getDisplayName(headEmp))}
                                                </div>
                                                <div className="hod-details">
                                                    <span className="hod-name font-bold">{getDisplayName(headEmp) || 'Not Assigned'}</span>
                                                </div>
                                            </div>

                                            <div className="stat-item flex-1 !m-0 hover:border-blue-200 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowEmpList(dept); }}>
                                                <div className="stat-details">
                                                    <div className="stat-val">{deptEmployees.length}</div>
                                                    <div className="stat-lbl">Employees</div>
                                                </div>
                                                <div className="stat-icon total">
                                                    <Users size={16} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="card-footer">
                                            <div className="card-footer-text">Project Team</div>
                                            <div className="avatar-stack">
                                                {deptEmployees.length > 3 && (
                                                    <div className="stack-item stack-more">+{deptEmployees.length - 3}</div>
                                                )}
                                                {deptEmployees.slice(0, 3).map((emp, i) => (
                                                    <div key={i} className="stack-item" style={emp?.profilePic ? { backgroundImage: `url(${String(emp.profilePic).startsWith('http') ? emp.profilePic : `${BACKEND_URL}${String(emp.profilePic).startsWith('/') ? '' : '/'}${emp.profilePic}`})` } : {}}>
                                                        {!emp?.profilePic && getInitials(getDisplayName(emp))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {filteredDepts.length > pageSize && (
                            <div className="mt-8 flex justify-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <Pagination
                                    current={currentPage}
                                    pageSize={pageSize}
                                    total={filteredDepts.length}
                                    onChange={(page) => setCurrentPage(page)}
                                    showSizeChanger={false}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals */}
            <Modal
                title={`${editing ? 'Edit' : 'Add'} Department`}
                open={openForm}
                onCancel={() => setOpenForm(false)}
                footer={null}
                width={440}
                className="department-form-modal"
                destroyOnHidden
            >
                <DeptFormModal
                    dept={editing}
                    depts={depts}
                    employees={employees}
                    onClose={() => { setOpenForm(false); loadData(); }}
                />
            </Modal>

            {showEmpList && (
                <ListModal
                    title={`${showEmpList.name} Employees`}
                    subtitle={`${employees.filter(e => e.department === showEmpList.name).length} Total Members`}
                    items={employees.filter(e => e.department === showEmpList.name).map(e => ({
                        _id: e._id,
                        name: getDisplayName(e),
                        id: e.employeeId,
                        role: e.designation || 'Staff',
                        avatar: e.profilePic ? (String(e.profilePic).startsWith('http') ? e.profilePic : `${BACKEND_URL}${String(e.profilePic).startsWith('/') ? '' : '/'}${e.profilePic}`) : null
                    }))}
                    onItemClick={(item) => {
                        const emp = employees.find(e => e._id === item._id);
                        if (emp) {
                            setShowEmpList(null);
                            openEmployeeProfile(emp);
                        }
                    }}
                    onClose={() => setShowEmpList(null)}
                />
            )}


            {selectedDept && (
                <DepartmentDetailsModal
                    dept={selectedDept}
                    employees={employees}
                    getDisplayName={getDisplayName}
                    getInitials={getInitials}
                    backendUrl={BACKEND_URL}
                    onClose={() => setSelectedDept(null)}
                    onEmployeeClick={(emp) => {
                        setSelectedDept(null);
                        openEmployeeProfile(emp);
                    }}
                />
            )}
            
            <DepartmentExcelUploadModal 
                isOpen={showUploadModal} 
                onClose={() => setShowUploadModal(false)}
                onSuccess={(result) => {
                    if (result.uploadedCount > 0) {
                        loadData();
                    }
                }}
            />
        </div>
    );
}

function DeptFormModal({ dept, depts, employees, onClose }) {
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);
    const [idGenMode, setIdGenMode] = useState('AUTO');

    useEffect(() => {
        if (dept) {
            form.setFieldsValue({
                name: dept.name,
                code: dept.code,
                description: dept.description,
                head: dept.head?._id || dept.head,
                parentDepartment: dept.parentDepartment?._id || dept.parentDepartment,
                status: dept.status === 'active',
                location: dept.meta?.location || 'Main Branch'
            });
            setIdGenMode('MANUAL');
        } else {
            form.resetFields();
            const fetchNextCode = async () => {
                try {
                    const res = await api.post('/company-id-config/next', {
                        entityType: 'DEPT',
                        increment: false
                    });
                    if (res.data && res.data.success) {
                        const mode = res.data.data?.generationMode || 'AUTO';
                        setIdGenMode(mode);
                        if (mode === 'AUTO') {
                            form.setFieldsValue({ code: res.data.nextId || res.data.data?.id });
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch next department code:', err);
                }
            };
            fetchNextCode();
        }
    }, [dept, form]);

    const onFinish = async (values) => {
        setSaving(true);
        try {
            const payload = {
                ...values,
                status: values.status ? 'active' : 'inactive',
                head: values.head || null,
                parentDepartment: values.parentDepartment || null,
                meta: { location: values.location }
            };
            delete payload.location;

            if (dept) {
                await api.put(`/hr/departments/${dept._id}`, payload);
                showToast('success', 'Updated', 'Department updated');
            } else {
                await api.post('/hr/departments', payload);
                showToast('success', 'Created', 'Department created');
            }
            onClose();
        } catch (err) {
            showToast('error', 'Error', err.response?.data?.error || 'Operation failed');
        } finally {
            setSaving(false);
        }
    };

    const handleValuesChange = (changedValues) => {
        if (!dept && idGenMode === 'MANUAL' && changedValues.name !== undefined) {
            const name = changedValues.name || '';
            const code = name.includes(' ') 
                ? name.split(' ').filter(w => w).map(w => w[0]).join('').substring(0, 3).toUpperCase()
                : name.substring(0, 3).toUpperCase();
            form.setFieldsValue({ code });
        }
    };

    return (
        <Form 
            form={form} 
            layout="vertical" 
            onFinish={onFinish} 
            onValuesChange={handleValuesChange}
            initialValues={{ status: true, location: 'Main Branch' }}
            className="dept-form-modern mt-2"
        >
            <div className="grid grid-cols-2 gap-4">
                <Form.Item name="name" label="Department Name" rules={[{ required: true }]}>
                    <Input placeholder="Engineering" />
                </Form.Item>
                <Form.Item name="code" label="Code" rules={[{ required: true }]}>
                    <Input placeholder="ENG" disabled={!!dept || idGenMode === 'AUTO'} readOnly={!!dept || idGenMode === 'AUTO'} />
                </Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Form.Item name="location" label="Location">
                    <Select>
                        <Select.Option value="Main Branch">Main Branch</Select.Option>
                        <Select.Option value="City Center">City Center</Select.Option>
                        <Select.Option value="Tech Park">Tech Park</Select.Option>
                        <Select.Option value="Remote">Remote</Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item name="parentDepartment" label="Parent Dept">
                    <Select placeholder="None" allowClear>
                        {depts.filter(d => d._id !== dept?._id).map(d => (
                            <Select.Option key={d._id?.toString() || d.name} value={d._id}>{d.name}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Form.Item name="head" label="Head of Department">
                    <Select placeholder="Select HOD" allowClear>
                        {employees.map(emp => (
                            <Select.Option key={emp._id?.toString() || emp.employeeId} value={emp._id}>
                                {emp.employeeId} - {emp.firstName} {emp.lastName}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item name="status" label="Status" valuePropName="checked">
                    <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                </Form.Item>
            </div>

            <Form.Item name="description" label="Description">
                <Input.TextArea rows={3} placeholder="Brief description..." />
            </Form.Item>

            <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all font-semibold text-[12px] tracking-normal">
                    Cancel
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-[#1088C7] text-white hover:bg-[#0E78AF] transition-all font-semibold text-[12px] tracking-normal shadow-lg shadow-[#1088C7]/20">
                    {saving ? 'Saving...' : 'Save Department'}
                </button>
            </div>
        </Form>
    );
}

function ListModal({ title, subtitle, items, onClose, isPosition = false, onItemClick }) {
    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="list-modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3>{title}</h3>
                        <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>{subtitle}</p>
                    </div>
                    <X size={18} style={{ cursor: 'pointer', color: '#a4b0be' }} onClick={onClose} />
                </div>
                <div className="list-modal-body">
                    {items.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#a4b0be' }}>
                            {isPosition ? 'No open positions currently available.' : 'No employees currently in this department.'}
                        </div>
                    ) : (
                        items.map((item, idx) => (
                            <div
                                key={item._id?.toString() || idx}
                                className="list-item-card"
                                onClick={() => onItemClick?.(item)}
                                style={{ cursor: onItemClick ? 'pointer' : 'default' }}
                            >
                                <div className="emp-list-info">
                                    <div className="emp-list-avatar" style={item.avatar ? { backgroundImage: `url(${item.avatar})` } : {}}>
                                        {!item.avatar && (item.name?.[0] || '?')}
                                    </div>
                                    <div className="emp-list-details">
                                        <h4>{item.name}</h4>
                                        <p>ID: {item.id}</p>
                                    </div>
                                </div>
                                <div className="emp-list-role">{item.role}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

function DepartmentDetailsModal({ dept, employees, getDisplayName, getInitials, backendUrl, onClose, onEmployeeClick }) {
    const deptEmployees = (employees || []).filter((e) => e?.department === dept?.name);
    const headEmp = (employees || []).find((e) => e?._id === (dept?.head?._id || dept?.head));

    return (
        <Modal
            title={`${dept?.name || 'Department'} Details`}
            open={!!dept}
            onCancel={onClose}
            footer={null}
            width={760}
            destroyOnHidden
        >
            <div style={{ marginBottom: 14, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
                <div className="text-sm font-semibold text-slate-800">
                    <strong>Code:</strong> {dept?.code || 'N/A'} | <strong>Location:</strong> {dept?.meta?.location || 'Main Branch'} | <strong>Status:</strong> {dept?.status || 'Active'}
                </div>
                <div className="text-sm font-semibold text-slate-800">
                    <strong>HOD:</strong> {headEmp ? getDisplayName(headEmp) : 'Not Assigned'}
                </div>
            </div>

            <div style={{ maxHeight: 420, overflowY: 'auto', display: 'grid', gap: 10 }}>
                {deptEmployees.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0' }}>No employees in this department.</div>
                ) : (
                    deptEmployees.map((emp, idx) => (
                        <div
                            key={emp._id?.toString() || idx}
                            role="button"
                            tabIndex={0}
                            onClick={() => onEmployeeClick(emp)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') onEmployeeClick(emp);
                            }}
                            style={{
                                border: '1px solid #e2e8f0',
                                borderRadius: 10,
                                padding: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                background: '#fff'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        background: '#e2e8f0',
                                        backgroundImage: emp?.profilePic ? `url(${String(emp.profilePic).startsWith('http') ? emp.profilePic : `${backendUrl}${String(emp.profilePic).startsWith('/') ? '' : '/'}${emp.profilePic}`})` : undefined,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 700,
                                        color: '#334155'
                                    }}
                                >
                                    {!emp?.profilePic && getInitials(getDisplayName(emp))}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{getDisplayName(emp)}</div>
                                    <div style={{ fontSize: 12, color: '#64748b' }}>{emp?.employeeId || 'N/A'} | {emp?.designation || 'Staff'}</div>
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: '#1088c7', fontWeight: 700 }}>Open Profile</div>
                        </div>
                    ))
                )}
            </div>
        </Modal>
    );
}
