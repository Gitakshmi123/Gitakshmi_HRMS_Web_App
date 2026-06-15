import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Save, Briefcase, User, Target, ChevronDown, Clock, MessageSquare, CheckCircle, Settings } from 'lucide-react';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';

const TaskAssignmentModal = ({ isOpen, onClose, checkData, caseId, onTaskAssigned }) => {
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const [formData, setFormData] = useState({
        taskType: 'VERIFICATION',
        assignToUserId: '',
        userType: 'VERIFIER',
        priority: 'MEDIUM',
        instructions: '',
        slaDays: 3
    });

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
        }
    }, [isOpen]);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/hr/employees');
            setUsers(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    if (!isMounted || !isOpen || typeof document === 'undefined') return null;

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        if (!formData.assignToUserId) {
            showToast('error', 'Error', 'Please select a user');
            return;
        }

        setLoading(true);

        try {
            const res = await api.post(`/bgv/check/${checkData._id}/assign-task`, formData);

            showToast('success', 'Success', 'Task assigned successfully');
            if (onTaskAssigned) onTaskAssigned(res.data.data);
            onClose();
        } catch (err) {
            console.error('Failed to assign task:', err);
            showToast('error', 'Error', err.response?.data?.message || 'Failed to assign task');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4 font-sans">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-white/20">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-[#4F46E5] px-10 py-8 flex items-center justify-between flex-shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] backdrop-blur-md flex items-center justify-center border border-white/30">
                            <UserPlus size={32} strokeWidth={2.5} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Assign Task</h2>
                            <p className="text-indigo-50 font-semibold tracking-widest uppercase text-[10px] opacity-90 mt-1">Assign a background check to a user</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all border border-transparent hover:border-white/30 text-white relative z-10"
                    >
                        <X size={24} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 custom-scrollbar">
                    <div className="max-w-2xl mx-auto space-y-8">

                        {/* Target Summary */}
                        <div className="bg-white rounded-[2rem] p-8 border border-slate-200/60 shadow-sm flex items-center justify-between group">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center border border-indigo-100 italic shadow-sm">
                                    <Briefcase size={28} />
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                        <Target size={14} className="text-[#4F46E5]" />
                                        Check Type
                                    </h3>
                                    <div className="text-xl font-bold text-slate-900 tracking-tight uppercase leading-none">
                                        {checkData.type?.replace(/_/g, ' ')}
                                    </div>
                                    <div className="text-[10px] font-semibold text-slate-400 mt-2 uppercase tracking-widest">Case ID: {caseId}</div>
                                </div>
                            </div>
                        </div>

                        {/* Configuration Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                    <Settings size={14} className="text-[#4F46E5]" /> Task Type
                                </h3>
                                <div className="relative group">
                                    <select
                                        value={formData.taskType}
                                        onChange={(e) => setFormData({ ...formData, taskType: e.target.value })}
                                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-bold text-[11px] uppercase tracking-widest text-slate-700 appearance-none cursor-pointer shadow-sm"
                                        required
                                    >
                                        <option value="VERIFICATION">Verification</option>
                                        <option value="DOCUMENT_REVIEW">Document Review</option>
                                        <option value="FIELD_VISIT">Field Visit</option>
                                        <option value="REFERENCE_CHECK">Reference Check</option>
                                        <option value="APPROVAL">Approval</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-[#4F46E5] transition-colors" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                    <User size={14} className="text-[#4F46E5]" /> Assign To
                                </h3>
                                <div className="relative group">
                                    <select
                                        value={formData.assignToUserId}
                                        onChange={(e) => setFormData({ ...formData, assignToUserId: e.target.value })}
                                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-bold text-[11px] uppercase tracking-widest text-slate-700 appearance-none cursor-pointer shadow-sm"
                                        required
                                    >
                                        <option value="">-- Select User --</option>
                                        {users.map((user) => (
                                            <option key={user._id} value={user._id}>
                                                {user.name} ({user.email})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-[#4F46E5] transition-colors" />
                                </div>
                            </div>
                        </div>

                        {/* Operative Role Matrix */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em] px-2">ROLE</h3>
                            <div className="grid grid-cols-3 gap-3">
                                {['VERIFIER', 'REVIEWER', 'APPROVER'].map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, userType: type })}
                                        className={`py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all border-2 ${formData.userType === type
                                            ? 'border-[#4F46E5] bg-indigo-50 text-[#4F46E5] shadow-lg shadow-indigo-500/5'
                                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Priority Selection */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em] px-2">PRIORITY</h3>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'LOW', color: 'slate' },
                                    { id: 'MEDIUM', color: 'indigo' },
                                    { id: 'HIGH', color: 'rose' }
                                ].map((prio) => (
                                    <button
                                        key={prio.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, priority: prio.id })}
                                        className={`py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all border-2 ${formData.priority === prio.id
                                            ? prio.id === 'HIGH' ? 'border-rose-500 bg-rose-50 text-rose-500 shadow-lg shadow-rose-500/10' :
                                                prio.id === 'MEDIUM' ? 'border-[#4F46E5] bg-indigo-50 text-[#4F46E5] shadow-lg shadow-indigo-500/10' :
                                                    'border-slate-400 bg-slate-50 text-slate-600 shadow-lg shadow-slate-500/10'
                                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                            }`}
                                    >
                                        {prio.id}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* SLA & Instructions */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-4 space-y-4">
                                <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                    <Clock size={14} className="text-[#4F46E5]" /> Due In (Days)
                                </h3>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={formData.slaDays}
                                        onChange={(e) => setFormData({ ...formData, slaDays: parseInt(e.target.value) })}
                                        className="w-full px-6 py-5 bg-white border border-slate-200 rounded-[1.5rem] focus:border-[#4F46E5] transition-all outline-none text-center font-bold text-2xl text-slate-900 shadow-sm"
                                        required
                                    />
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Days</div>
                                </div>
                            </div>
                            <div className="lg:col-span-8 space-y-4">
                                <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                    <MessageSquare size={14} className="text-[#4F46E5]" /> Instructions
                                </h3>
                                <textarea
                                    value={formData.instructions}
                                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                                    placeholder="Provide instructions for this task..."
                                    rows={4}
                                    className="w-full px-6 py-5 bg-white border border-slate-200 rounded-[2rem] focus:border-[#4F46E5] transition-all outline-none text-sm font-medium resize-none shadow-sm shadow-inner"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="bg-white px-10 py-8 border-t border-slate-100 flex items-center justify-end gap-4 flex-shrink-0 relative z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
                    <button
                        onClick={onClose}
                        className="px-8 py-4 text-slate-400 hover:text-slate-600 font-bold text-[11px] uppercase tracking-widest transition-colors"
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="h-14 px-10 bg-slate-900 text-white rounded-[1.25rem] font-bold text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:bg-[#4F46E5] hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:bg-slate-300 transition-all flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
                                <span>ASSIGNING...</span>
                            </>
                        ) : (
                            <>
                                <Save size={18} strokeWidth={2.5} />
                                <span>ASSIGN TASK</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TaskAssignmentModal;
