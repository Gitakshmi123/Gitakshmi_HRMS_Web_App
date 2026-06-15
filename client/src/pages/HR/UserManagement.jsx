import React, { useEffect, useState, useMemo } from 'react';
import { Pagination, Modal } from 'antd';
import {
    User, Mail, Briefcase, Building2, Search, Plus,
    Edit2, Trash2, Eye, EyeOff, Key, Shield, UserCheck,
    Clock, ShieldCheck, Users, ChevronLeft,
    X, Check, Lock, ToggleLeft, ToggleRight,
    Sparkles, Hash, Settings, GitBranch
} from 'lucide-react';
import { Can } from "../../components/rbac/PermissionGate";
import { showToast, showConfirmToast } from '../../utils/uiNotifications';
import api, { API_ROOT } from '../../utils/api';

const BACKEND_URL = API_ROOT || '';

export default function UserManagement() {
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [rolesList, setRolesList] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal & Form States
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showPermModal, setShowPermModal] = useState(false);

    const [editingEmployee, setEditingEmployee] = useState(null);
    const [viewingEmployee, setViewingEmployee] = useState(null);
    const [permEmployee, setPermEmployee] = useState(null);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        role: '',
        roleId: '',
        department: '',
        managerId: '',
        contactNo: '',
        jobType: 'Full-Time',
        status: 'active'
    });

    const [filter, setFilter] = useState({ search: '', department: '', role: '', status: '' });
    const [currentPage, setCurrentPage] = useState(1);
    const [showPassword, setShowPassword] = useState(false);
    const pageSize = 10;

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [eRes, dRes] = await Promise.all([
                api.get('/hr/employees?limit=1000').catch(() => ({ data: { data: [] } })),
                api.get('/hr/departments').catch(() => ({ data: { data: [] } })),
            ]);

            const eData = eRes.data?.data || eRes.data || [];
            const dData = dRes.data?.data || dRes.data || [];

            setEmployees(Array.isArray(eData) ? eData : []);
            setDepartments(Array.isArray(dData) ? dData : []);

            // Fetch roles separately
            api.get('/roles').then(res => setRolesList(res.data.data)).catch(() => { });
        } catch (err) {
            console.error('User Fetch Error:', err);
            showToast('error', 'Error', 'Failed to load system users');
        } finally {
            setLoading(false);
        }
    }

    const resetForm = () => {
        setFormData({
            firstName: '', lastName: '', email: '', role: '', roleId: '',
            department: '', managerId: '', contactNo: '',
            jobType: 'Full-Time', status: 'active'
        });
    };

    const openCreate = () => {
        setEditingEmployee(null);
        resetForm();
        setShowFormModal(true);
    };

    const openEdit = (emp) => {
        setEditingEmployee(emp);
        setFormData({
            firstName: emp.firstName || '',
            lastName: emp.lastName || '',
            email: emp.email || '',
            role: emp.role || '',
            roleId: emp.roleId?._id || emp.roleId || '',
            department: emp.department || '',
            managerId: emp.manager?._id || emp.manager || '',
            contactNo: emp.contactNo || '',
            jobType: emp.jobType || 'Full-Time',
            status: emp.status || 'active'
        });
        setShowFormModal(true);
    };

    const handleSubmit = async () => {
        try {
            if (editingEmployee) {
                await api.put(`/hr/employees/${editingEmployee._id}`, formData);

                // Keep the specific set-manager call
                if (formData.managerId !== undefined) {
                    const raw = (formData.managerId || '').toString();
                    const match = raw.match(/[a-fA-F0-9]{24}/);
                    await api.post(`/hr/employees/${editingEmployee._id}/set-manager`, {
                        managerId: match ? match[0] : null
                    });
                }

                showToast('success', 'Update Successful', `${formData.firstName}'s profile has been updated.`);
            } else {
                await api.post('/hr/employees', formData);
                showToast('success', 'User Created', 'New user has been successfully added to the system.');
            }
            setShowFormModal(false);
            loadData();
        } catch (err) {
            const code = err.response?.data?.error;
            const errorMessage = err.response?.data?.message || 'Could not save user data';
            showToast(
                'error',
                code === 'USER_LIMIT_REACHED' || code === 'limit_reached' ? 'User limit reached' : 'Action Failed',
                errorMessage,
                code === 'USER_LIMIT_REACHED' || code === 'limit_reached' ? 5 : undefined
            );
        }
    };

    const handleDelete = (emp) => {
        showConfirmToast({
            title: 'Delete User Account',
            description: `Are you sure you want to remove ${emp.firstName} ${emp.lastName}? This action cannot be undone.`,
            okText: 'Delete Forever',
            cancelText: 'Cancel',
            danger: true,
            onConfirm: async () => {
                try {
                    await api.delete(`/hr/employees/${emp._id}`);
                    showToast('success', 'User Deleted', 'Account has been removed from the directory.');
                    loadData();
                } catch {
                    showToast('error', 'Deletion Failed', 'An error occurred while trying to delete the user.');
                }
            },
        });
    };

    // Filtered Data
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
            const matchesSearch = !filter.search ||
                fullName.includes(filter.search.toLowerCase()) ||
                (emp.employeeId || '').toLowerCase().includes(filter.search.toLowerCase()) ||
                (emp.email || '').toLowerCase().includes(filter.search.toLowerCase());
            const matchesDept = !filter.department || emp.department === filter.department;
            const matchesRole = !filter.role || emp.role === filter.role;
            const matchesStatus = !filter.status || (emp.status || 'active').toLowerCase() === filter.status.toLowerCase();
            return matchesSearch && matchesDept && matchesRole && matchesStatus;
        });
    }, [employees, filter]);

    const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Stats
    const stats = {
        total: employees.length,
        active: employees.filter(e => (e.status || 'active').toLowerCase() === 'active').length,
        unassigned: employees.filter(e => !e.role).length,
        admins: employees.filter(e => (e.role || '').toLowerCase().includes('admin')).length
    };

    const getInitials = (f, l) => `${(f || '?')[0]}${(l || '?')[0]}`.toUpperCase();

    const getRoleBadgeClass = (role) => {
        const r = (role || '').toLowerCase();
        if (r.includes('admin')) return 'bg-red-100 text-red-600';
        if (r.includes('manager')) return 'bg-green-100 text-green-600';
        return 'bg-slate-100 text-slate-600';
    };

    const getDeptBadgeClass = (dept) => {
        const d = (dept || '').toLowerCase();
        if (d.includes('eng') || d.includes('tech')) return 'bg-blue-100 text-blue-600';
        if (d.includes('hr')) return 'bg-pink-100 text-pink-600';
        if (d.includes('design')) return 'bg-purple-100 text-purple-600';
        if (d.includes('sales')) return 'bg-orange-100 text-orange-600';
        return 'bg-fuchsia-100 text-fuchsia-600';
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-[#4F46E5] rounded-full animate-spin"></div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Synchronizing Directory...</p>
            </div>
        );
    }

    return (
        <div className="user-management-container text-[#2d3436]">
            {/* Unified Toolbar */}
            <div className="bg-transparent px-0 py-4 flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name, email, or ID..."
                        value={filter.search}
                        onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                        className="w-full pl-11 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-all text-sm h-10"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={filter.role}
                        onChange={(e) => setFilter({ ...filter, role: e.target.value })}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-[13px] font-semibold text-slate-600 cursor-pointer h-10"
                    >
                        <option value="">All Roles</option>
                        {[...new Set(employees.map(e => e.role).filter(Boolean))].map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>

                    <select
                        value={filter.status}
                        onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-[13px] font-semibold text-slate-600 cursor-pointer h-10"
                    >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="locked">Locked</option>
                    </select>

                    <Can module="people.users" action="create">
                        <button
                            onClick={openCreate}
                            className="bg-slate-800 hover:bg-slate-900 text-white px-6 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-slate-500/10 hover:-translate-y-0.5 h-10 whitespace-nowrap"
                        >
                            <Plus size={18} /> Add User
                        </button>
                    </Can>
                </div>
            </div>

            <div className="px-0 pt-0 pb-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
                    <StatCard icon={<Users />} title="Total Users" value={stats.total} color="bg-white border border-slate-200 text-slate-800" />
                    <StatCard icon={<UserCheck />} title="Active Users" value={stats.active} color="bg-white border border-slate-200 text-slate-800" />
                    <StatCard icon={<Clock />} title="Unassigned Roles" value={stats.unassigned} color="bg-white border border-slate-200 text-slate-800" />
                    <StatCard icon={<ShieldCheck />} title="System Admins" value={stats.admins} color="bg-white border border-slate-200 text-slate-800" />
                </div>

                {/* Table Container */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#f1f2f6] overflow-hidden">
                    {/* Table Body */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-white border-b border-slate-100">
                                    <th className="px-6 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">User Profile</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">Employee ID</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">Role</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">Department</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-2.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedEmployees.map((emp) => (
                                    <tr key={emp._id?.toString() || emp.employeeId} className="hover:bg-slate-50 group transition-colors">
                                        <td className="px-6 py-2.5">
                                            <div
                                                className="flex items-center gap-3 cursor-pointer p-1 -ml-1 rounded-xl hover:bg-slate-100 transition-all"
                                                onClick={() => { setViewingEmployee(emp); setShowViewModal(true); }}
                                            >
                                                <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm flex-shrink-0">
                                                    {emp.profilePic ? (
                                                        <img src={String(emp.profilePic).startsWith('http') ? emp.profilePic : `${BACKEND_URL}${String(emp.profilePic).startsWith('/') ? '' : '/'}${emp.profilePic}`} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-sm font-bold text-slate-500">{getInitials(emp.firstName, emp.lastName)}</span>
                                                    )}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <h4 className="text-sm font-bold text-slate-800 truncate">{emp.firstName} {emp.lastName}</h4>
                                                    <p className="text-[12px] text-slate-500 truncate">{emp.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-2.5">
                                            <span className="text-sm font-semibold text-slate-600">{emp.employeeId}</span>
                                        </td>
                                        <td className="px-6 py-2.5 mx-auto">
                                            <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${getRoleBadgeClass(emp.role)}`}>
                                                {emp.role || 'Unassigned'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-2.5">
                                            <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${getDeptBadgeClass(emp.department)}`}>
                                                {emp.department || 'General'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-2.5">
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-1.5 h-1.5 rounded-full ${(emp.status || 'active').toLowerCase() === 'active' ? 'bg-[#10b981]' :
                                                        (emp.status || '').toLowerCase() === 'locked' ? 'bg-red-500' : 'bg-slate-400'
                                                    }`} />
                                                <span className={`text-[12px] font-bold ${(emp.status || 'active').toLowerCase() === 'active' ? 'text-[#10b981]' :
                                                        (emp.status || '').toLowerCase() === 'locked' ? 'text-red-500' : 'text-slate-500'
                                                    }`}>
                                                    {(emp.status || 'Active').charAt(0).toUpperCase() + (emp.status || 'active').slice(1)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-2.5">
                                            <div className="flex justify-end gap-2">
                                                <Can module="people.users" action="edit">
                                                    <button onClick={() => openEdit(emp)} className="w-[34px] h-[34px] rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-500 hover:text-white transition-all">
                                                        <Edit2 size={14} />
                                                    </button>
                                                </Can>
                                                <Can module="configuration.access" action="edit">
                                                    <button onClick={() => { setPermEmployee(emp); setShowPermModal(true); }} className="w-[34px] h-[34px] rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center hover:bg-slate-500 hover:text-white transition-all">
                                                        <Key size={14} />
                                                    </button>
                                                </Can>
                                                <Can module="people.users" action="delete">
                                                    <button onClick={() => handleDelete(emp)} className="w-[34px] h-[34px] rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </Can>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredEmployees.length === 0 && (
                            <div className="p-20 text-center text-slate-400">
                                <Search size={40} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">No matching personnel records found</p>
                            </div>
                        )}
                    </div>

                    {/* Pagination Footer */}
                    <div className="px-6 py-4 border-t border-[#f1f2f6] flex justify-between items-center bg-white">
                        <p className="text-[13px] text-slate-500 font-medium">
                            {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredEmployees.length)} of {filteredEmployees.length}
                        </p>
                        <Pagination
                            current={currentPage}
                            pageSize={pageSize}
                            total={filteredEmployees.length}
                            onChange={(page) => setCurrentPage(page)}
                            showSizeChanger={false}
                            className="custom-pagination"
                        />
                    </div>
                </div>
            </div>

            {/* AI Analysis Floating Tip */}
            <div className="fixed bottom-10 right-10 flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-100 animate-bounce-slow">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white shadow-lg shadow-slate-500/20">
                    <Sparkles size={16} />
                </div>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Directory Synchronized</p>
            </div>

            {/* Modals Implementation */}
            {/* ADD/EDIT MODAL */}
            <Modal
                open={showFormModal}
                onCancel={() => { setShowFormModal(false); setEditingEmployee(null); resetForm(); }}
                footer={null}
                closable={false}
                centered
                width={1000}
                className="user-management-modal"
            >
                <div className="bg-white rounded-3xl overflow-hidden border border-slate-100">
                    <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center bg-white">
                        <div className="modal-title-group">
                            <h3 className="text-[18px] font-extrabold text-slate-800 tracking-tight">{editingEmployee ? 'Update User' : 'Add New User'}</h3>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setShowFormModal(false); setEditingEmployee(null); resetForm(); }} className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all shadow-sm">
                                Cancel
                            </button>
                            <button onClick={handleSubmit} className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-900 transition-all shadow-lg shadow-slate-500/10 flex items-center gap-1.5">
                                <Check size={16} /> {editingEmployee ? 'Update' : 'Add User'}
                            </button>
                        </div>
                    </div>

                    <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormGroup label="First Name" value={formData.firstName} onChange={(v) => setFormData({ ...formData, firstName: v })} placeholder="e.g. Rohit" />
                            <FormGroup label="Last Name" value={formData.lastName} onChange={(v) => setFormData({ ...formData, lastName: v })} placeholder="e.g. Kumar" />
                            <FormGroup label="Professional Email" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} placeholder="name@globaltech.com" />

                            <div className="form-group flex flex-col gap-1.5 w-full">
                                <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest leading-none ml-1">System Role</label>
                                <div className="relative">
                                    <select
                                        className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl outline-none transition-all text-sm font-semibold text-slate-400 appearance-none cursor-pointer h-11"
                                        style={{ backgroundColor: '#ffffff' }}
                                        value={formData.roleId || formData.role}
                                        onChange={(e) => {
                                            const roleVal = e.target.value;
                                            const selectedRole = rolesList.find(r => r._id === roleVal);
                                            setFormData({
                                                ...formData,
                                                roleId: selectedRole ? roleVal : '',
                                                role: selectedRole ? selectedRole.title : roleVal
                                            });
                                        }}
                                    >
                                        <option value="">Select Role</option>
                                        {rolesList.length > 0 ? (
                                            rolesList.map(role => <option key={role._id} value={role._id}>{role.title}</option>)
                                        ) : (
                                            <>
                                                <option value="Employee">Employee</option>
                                                <option value="Manager">Manager</option>
                                                <option value="Admin">Administrator</option>
                                            </>
                                        )}
                                    </select>
                                    <ChevronLeft className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <div className="form-group flex flex-col gap-1.5 w-full">
                                <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest leading-none ml-1">Allocated Department</label>
                                <div className="relative">
                                    <select
                                        className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl outline-none transition-all text-sm font-semibold text-slate-400 appearance-none cursor-pointer h-11"
                                        style={{ backgroundColor: '#ffffff' }}
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    >
                                        <option value="">Choose Department</option>
                                        {departments.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                                    </select>
                                    <ChevronLeft className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <FormGroup label="Contact Number" value={formData.contactNo} onChange={(v) => setFormData({ ...formData, contactNo: v })} placeholder="+1 (555) 000-0000" />

                            <div className="form-group flex flex-col gap-1.5 w-full">
                                <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest leading-none ml-1">Job Type</label>
                                <div className="relative">
                                    <select
                                        className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl outline-none transition-all text-sm font-semibold text-slate-400 appearance-none cursor-pointer h-11"
                                        style={{ backgroundColor: '#ffffff' }}
                                        value={formData.jobType}
                                        onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
                                    >
                                        <option value="Full-Time">Full-Time</option>
                                        <option value="Part-Time">Part-Time</option>
                                        <option value="Internship">Internship</option>
                                    </select>
                                    <ChevronLeft className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <div className="form-group flex flex-col gap-1.5 w-full">
                                <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest leading-none ml-1">Reports To</label>
                                <div className="relative">
                                    <select
                                        className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl outline-none transition-all text-sm font-semibold text-slate-400 appearance-none cursor-pointer h-11"
                                        style={{ backgroundColor: '#ffffff' }}
                                        value={formData.managerId}
                                        onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                                    >
                                        <option value="">— No Manager —</option>
                                        {employees
                                            .filter(e => !editingEmployee || String(e._id) !== String(editingEmployee._id))
                                            .map(emp => (
                                                <option key={emp._id} value={emp._id}>
                                                    {emp.firstName} {emp.lastName}
                                                </option>
                                            ))}
                                    </select>
                                    <ChevronLeft className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <div className="form-group flex flex-col gap-1.5 w-full">
                                <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest leading-none ml-1">Account Status</label>
                                <div className="relative">
                                    <select
                                        className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl outline-none transition-all text-sm font-semibold text-slate-400 appearance-none cursor-pointer h-11"
                                        style={{ backgroundColor: '#ffffff' }}
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="locked">Locked</option>
                                    </select>
                                    <ChevronLeft className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={14} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* VIEW PROFILE MODAL */}
            <Modal
                open={showViewModal}
                onCancel={() => setShowViewModal(false)}
                footer={null}
                closable={false}
                centered
                width={400}
            >
                <div className="bg-white rounded-2xl p-8 pt-6 relative shadow-2xl overflow-hidden text-center">
                    <button onClick={() => setShowViewModal(false)} className="absolute right-4 top-4 bg-white border border-slate-100 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                        <X size={16} />
                    </button>

                    <div className="w-20 h-20 rounded-full bg-slate-100 mx-auto mb-4 border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
                        {viewingEmployee?.profilePic ? (
                            <img src={String(viewingEmployee.profilePic).startsWith('http') ? viewingEmployee.profilePic : `${BACKEND_URL}${String(viewingEmployee.profilePic).startsWith('/') ? '' : '/'}${viewingEmployee.profilePic}`} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-2xl font-bold text-slate-400">{getInitials(viewingEmployee?.firstName, viewingEmployee?.lastName)}</span>
                        )}
                    </div>

                    <h3 className="text-[22px] font-bold text-slate-800">{viewingEmployee?.firstName} {viewingEmployee?.lastName}</h3>
                    <p className="text-sm text-slate-500 mb-6">{viewingEmployee?.email}</p>

                    <div className="bg-white rounded-xl p-5 text-left flex flex-col gap-4 border border-[#f1f2f6]">
                        <ProfileInfoRow label="Employee ID" value={viewingEmployee?.employeeId} />
                        <ProfileInfoRow label="Role" value={<span className={`px-3 py-0.5 rounded-full text-[10px] font-bold ${getRoleBadgeClass(viewingEmployee?.role)}`}>{viewingEmployee?.role}</span>} />
                        <ProfileInfoRow label="Department" value={viewingEmployee?.department} />
                        <ProfileInfoRow label="Status" value={
                            <span className={`text-[13px] font-bold ${(viewingEmployee?.status || 'active').toLowerCase() === 'active' ? 'text-[#10b981]' :
                                    (viewingEmployee?.status || '').toLowerCase() === 'locked' ? 'text-red-500' : 'text-slate-500'
                                }`}>
                                {(viewingEmployee?.status || 'Active').charAt(0).toUpperCase() + (viewingEmployee?.status || 'active').slice(1)}
                            </span>
                        } />
                        <ProfileInfoRow
                            label="Security Password"
                            value={
                                <div className="flex items-center gap-2">
                                    <span className="font-mono">{showPassword ? viewingEmployee?.password || 'No Password' : '••••••••'}</span>
                                    <button onClick={() => setShowPassword(!showPassword)} className="p-1 hover:bg-slate-200 rounded transition-colors">
                                        {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                </div>
                            }
                        />
                    </div>
                </div>
            </Modal>

            {/* PERMISSIONS MODAL */}
            <Modal
                open={showPermModal}
                onCancel={() => setShowPermModal(false)}
                footer={null}
                closable={false}
                centered
                width={500}
            >
                <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
                    <div className="px-6 py-5 border-b border-[#f1f2f6] flex justify-between items-start bg-white">
                        <div className="modal-title-group">
                            <h3 className="text-[20px] font-bold text-[#1e293b]">Manage Permissions</h3>
                            <p className="text-[13px] text-[#64748b] mt-1 text-clamp">Configure access control for {permEmployee?.firstName} {permEmployee?.lastName}</p>
                        </div>
                        <button onClick={() => setShowPermModal(false)} className="bg-white border border-slate-100 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="p-6 max-h-[400px] overflow-y-auto custom-scrollbar bg-white">
                        <h4 className="text-[13px] font-extrabold text-[#111827] uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                            <Shield size={14} className="text-[#00b894]" /> Core Modules
                        </h4>

                        <PermissionToggle title="View Dashboard" desc="Access the main analytics dashboard" defaultChecked={true} />
                        <PermissionToggle title="Manage Users" desc="Add, edit, or delete system users" defaultChecked={permEmployee?.role?.toLowerCase().includes('admin')} />

                        <h4 className="text-[13px] font-extrabold text-[#111827] uppercase tracking-wider mt-8 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                            <Briefcase size={14} className="text-blue-500" /> Actions & Data
                        </h4>

                        <PermissionToggle title="Export Reports" desc="Download data as CSV/PDF" defaultChecked={true} />
                        <PermissionToggle title="Manage Settings" desc="Modify global system configurations" defaultChecked={permEmployee?.role?.toLowerCase().includes('admin')} />
                    </div>

                    <div className="px-6 py-4 bg-white border-t border-[#f1f2f6] flex justify-end gap-3">
                        <button onClick={() => setShowPermModal(false)} className="px-5 py-2 bg-white border border-[#cbd5e1] text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50">Cancel</button>
                        <button onClick={() => { showToast('success', 'Changes Saved', 'Access permissions updated.'); setShowPermModal(false); }} className="px-7 py-2 bg-[#00b894] text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-md shadow-emerald-500/10">
                            <Lock size={14} /> Save Access
                        </button>
                    </div>
                </div>
            </Modal>

            <style>{`
                .user-management-container { padding: 10px; }
                .custom-pagination .ant-pagination-item-active { border-color: #4F46E5; background: #4F46E5; }
                .custom-pagination .ant-pagination-item-active a { color: white !important; }
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4F46E5; }
                .animate-bounce-slow { animation: bounce 3s infinite; }
                @keyframes bounce {
                    0%, 100% { transform: translateY(-5%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
                    50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
                }
            `}</style>
        </div>
    );
}

function StatCard({ icon, title, value, color }) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#f1f2f6] flex items-center gap-5 hover:-translate-y-1 hover:shadow-md transition-all">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${color}`}>
                {icon}
            </div>
            <div className="stat-details">
                <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">{value.toLocaleString()}</h3>
                <p className="text-[13px] text-slate-500 font-semibold">{title}</p>
            </div>
        </div>
    );
}

function FormGroup({ label, value, onChange, placeholder, type = "text" }) {
    const handleChange = (e) => {
        let val = e.target.value;
        if (label === 'Contact Number') {
            const numeric = val.replace(/[^0-9]/g, '');
            if (numeric.length <= 15) {
                onChange(numeric);
            }
        } else {
            onChange(val);
        }
    };

    return (
        <div className="form-group flex flex-col gap-1 w-full">
            <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none ml-1">{label}</label>
            <div className="relative">
                <input
                    type={type}
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none transition-all text-sm font-semibold text-slate-400 placeholder:text-slate-300 h-11"
                />
            </div>
        </div>
    );
}

function ProfileInfoRow({ label, value }) {
    return (
        <div className="flex justify-between items-center py-0.5">
            <span className="text-[13px] font-medium text-slate-500">{label}</span>
            <span className="text-[13px] font-bold text-slate-800">{value}</span>
        </div>
    );
}

function PermissionToggle({ title, desc, defaultChecked }) {
    const [checked, setChecked] = useState(defaultChecked);
    return (
        <div className="flex justify-between items-center py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors -mx-2 px-2 rounded-lg">
            <div>
                <div className="text-[13px] font-bold text-slate-800">{title}</div>
                <div className="text-[11px] text-slate-500">{desc}</div>
            </div>
            <button onClick={() => setChecked(!checked)} className="transition-all active:scale-95 cursor-pointer">
                {checked ? <ToggleRight className="text-[#00b894]" size={36} /> : <ToggleLeft className="text-slate-300" size={36} />}
            </button>
        </div>
    );
}
