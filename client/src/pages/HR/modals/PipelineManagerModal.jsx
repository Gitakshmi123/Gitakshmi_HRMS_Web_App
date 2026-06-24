import React, { useState, useEffect } from 'react';
import { Modal, Button } from 'antd';
import { message } from '../../../utils/antdGlobal';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, GripVertical, Trash2, Settings, Check, Save, X, Layout, Clock, Lock, ChevronDown, User, FileText, Zap, RefreshCw } from 'lucide-react';
import api from '../../../utils/api';
import StageModal from '../../../components/StageModal';
import FeedbackTemplateBuilder from '../../../components/FeedbackTemplateBuilder';

const getEmployeeDisplayName = (emp) => {
    if (!emp) return '';
    const first = String(emp.firstName || '').trim();
    const last = String(emp.lastName || '').trim();
    const full = `${first} ${last}`.trim();
    if (full) return full;
    const byName = String(emp.name || emp.fullName || '').trim();
    if (byName) return byName;
    const byEmail = String(emp.email || '').trim();
    if (byEmail) return byEmail;
    return String(emp.employeeId || emp.employeeCode || emp._id || 'Employee');
};

const getEmployeeCode = (emp) => String(emp?.employeeId || emp?.employeeCode || emp?.code || '').trim();

const getEmployeeDepartment = (emp) => (
    emp?.department
    || emp?.departmentName
    || emp?.departmentId?.name
    || emp?.departmentId?.departmentName
    || ''
);

const getEmployeeDesignation = (emp) => (
    emp?.designation
    || emp?.jobTitle
    || emp?.position
    || emp?.designationName
    || emp?.designationId?.name
    || emp?.designationId?.designationName
    || ''
);

export default function PipelineManagerModal({ visible, onClose, requirement, onUpdate }) {
    const [stages, setStages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [employees, setEmployees] = useState([]);

    const [showStageModal, setShowStageModal] = useState(() => window.triggerAddStage === true);
    const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
    const [templateBuilderData, setTemplateBuilderData] = useState(null);

    useEffect(() => {
        if (visible && requirement) {
            let rawStages = [...(requirement.pipelineStages || [])];
            rawStages.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

            const hasSystemStart = rawStages.length > 0 && rawStages[0].isSystemStage;
            if (!hasSystemStart) {
                rawStages.unshift({
                    stageId: 'stage_applied_system',
                    stageName: 'Applied',
                    stageType: 'System',
                    isSystemStage: true,
                    orderIndex: 0,
                    mode: 'N/A',
                    durationMinutes: 0
                });
            }

            const hasSystemEnd = rawStages.length > 0 && rawStages[rawStages.length - 1].isSystemStage;
            if (!hasSystemEnd) {
                rawStages.push({
                    stageId: 'stage_finalized_system',
                    stageName: 'Finalized',
                    stageType: 'System',
                    isSystemStage: true,
                    orderIndex: 999,
                    mode: 'N/A',
                    durationMinutes: 0
                });
            }

            const mapped = rawStages.map((s, i) => ({
                ...s,
                tempId: s.stageId || `stage_${Date.now()}_${i}`,
                stageId: s.stageId || s.id,
                mode: s.mode || 'Online',
                meetingLink: s.meetingLink || '',
                durationMinutes: s.durationMinutes || 30,
                assignedInterviewers: Array.isArray(s.assignedInterviewers)
                    ? s.assignedInterviewers.map((it) => (typeof it === 'object' ? it?._id : it)).filter(Boolean)
                    : (s.assignedInterviewer ? [s.assignedInterviewer] : []),
                assignedInterviewer: (s.assignedInterviewers && s.assignedInterviewers.length > 0)
                    ? (typeof s.assignedInterviewers[0] === 'object' ? s.assignedInterviewers[0]._id : s.assignedInterviewers[0])
                    : (s.assignedInterviewer || ''),
                externalInterviewers: s.externalInterviewers || []
            }));

            setStages(mapped);
            fetchTemplates();
            fetchEmployees();
        }
    }, [visible, requirement]);

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/feedback/templates');
            setTemplates(res.data);
        } catch (e) {
            console.error("Failed to fetch templates", e);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/hr/employees?limit=500');
            const data = res.data;
            setEmployees(Array.isArray(data) ? data : data.data || data.employees || []);
        } catch (e) {
            console.error("Failed to fetch employees", e);
        }
    };

    const onDragEnd = (result) => {
        if (!result.destination) return;
        const sourceIdx = result.source.index;
        const destIdx = result.destination.index;
        if (sourceIdx === destIdx) return;

        const realSourceIdx = sourceIdx + 1;
        const realDestIdx = destIdx + 1;

        const newStages = Array.from(stages);
        const [moved] = newStages.splice(realSourceIdx, 1);
        newStages.splice(realDestIdx, 0, moved);
        setStages(newStages);
    };

    const handleStageAdd = (stageData) => {
        const template = templates.find(t => t._id === stageData.feedbackTemplateId);
        const newStage = {
            stageId: `stage_${Date.now()}`,
            stageName: stageData.name,
            feedbackFormId: stageData.feedbackTemplateId,
            evaluationCriteria: template ? template.criteria.map(c => c.label) : [],
            stageType: stageData.stageType || 'Interview',
            mode: stageData.mode || 'Online',
            meetingLink: '',
            durationMinutes: stageData.durationMinutes || 45,
            assignedInterviewers: [],
            assignedInterviewer: '',
            externalInterviewers: [],
            isSystemStage: false
        };

        const newWorkflow = [...stages];
        if (newWorkflow.length > 0 && newWorkflow[newWorkflow.length - 1].isSystemStage) {
            newWorkflow.splice(newWorkflow.length - 1, 0, newStage);
        } else {
            newWorkflow.push(newStage);
        }

        setStages(newWorkflow);
        setShowStageModal(false);
    };

    const deleteStage = (index) => {
        setStages(stages.filter((_, idx) => idx !== index));
    };

    const updateStage = (index, field, value) => {
        setStages(prev => {
            const newStages = [...prev];
            newStages[index] = { ...newStages[index], [field]: value };
            return newStages;
        });
    };

    const openTemplateBuilder = (index) => {
        const stage = stages[index];
        const existing = stage.feedbackFormId ? templates.find(t => t._id === stage.feedbackFormId) : null;
        setTemplateBuilderData({
            stageIndex: index,
            initialTemplate: existing ? {
                templateName: existing.templateName,
                criteria: existing.criteria || []
            } : {
                templateName: stage.stageName + ' Feedback',
                criteria: []
            }
        });
        setShowTemplateBuilder(true);
    };

    const handleTemplateSave = async (data) => {
        try {
            const res = await api.post('/feedback/template', {
                templateName: data.templateName,
                criteria: data.criteria
            });
            const newTemplate = res.data;
            setTemplates([...templates, newTemplate]);

            if (templateBuilderData) {
                const idx = templateBuilderData.stageIndex;
                const newWorkflow = [...stages];
                newWorkflow[idx].feedbackFormId = newTemplate._id;
                newWorkflow[idx].evaluationCriteria = data.criteria.map(c => c.label);
                setStages(newWorkflow);
            }
            setShowTemplateBuilder(false);
            setTemplateBuilderData(null);
        } catch (e) {
            message.error("Failed to save template");
        }
    };

    const notifyInterviewerAssignment = async (employeeId, stage) => {
        if (!employeeId) return;
        try {
            const res = await api.post('/requirements/interviewer-assignment-notify', {
                employeeId,
                stageName: stage?.stageName || 'Interview Stage',
                mode: stage?.mode || 'Online',
                durationMinutes: stage?.durationMinutes || 30,
                jobTitle: requirement?.jobTitle || 'Job Opening',
                department: requirement?.department || '',
            });
            if (res.data?.emailSent) {
                message.success('Interviewer notified via system notification and email.');
            } else {
                message.success('Interviewer notified via system notification.');
            }
        } catch (error) {
            console.error('Failed to notify interviewer', error);
            message.error(error?.response?.data?.message || 'Interviewer selected, but notification failed.');
        }
    };

    const handleSavePipeline = async () => {
        if (!requirement?._id) return;
        setLoading(true);
        try {
            const updatedStages = stages.map((s, i) => ({
                stageId: s.stageId || `stage_${Date.now()}_${i}`,
                stageName: s.stageName,
                isSystemStage: s.isSystemStage || false,
                orderIndex: i + 1,
                assignedInterviewers: (
                    Array.isArray(s.assignedInterviewers) && s.assignedInterviewers.length > 0
                        ? s.assignedInterviewers
                        : (s.assignedInterviewer ? [s.assignedInterviewer] : [])
                )
                    .filter((id) => id && id !== '')
                    .map((id) => (typeof id === 'object' ? (id._id || id) : id)),
                externalInterviewers: s.externalInterviewers || [],
                feedbackFormId: s.feedbackFormId || null,
                mode: s.mode,
                meetingLink: s.meetingLink || '',
                durationMinutes: s.durationMinutes,
                stageType: s.stageType || 'Interview',
                evaluationCriteria: s.evaluationCriteria || []
            }));

            await api.put(`/requirements/${requirement._id}`, {
                pipelineStages: updatedStages
            });

            message.success("Pipeline updated successfully");
            onUpdate();
            onClose();
        } catch (e) {
            console.error(e);
            message.error("Failed to update pipeline");
        } finally {
            setLoading(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal
            open={visible}
            onCancel={onClose}
            title={
                <div className="flex items-center gap-3 py-1">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-[#4F46E5] shadow-sm border border-indigo-100/50">
                        <Layout size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase">Manage Pipeline</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Configure recruitment workflow stages</p>
                    </div>
                </div>
            }
            width={850}
            footer={null}
            className="premium-modal"
            centered
            styles={{
                body: { padding: 0, overflow: 'hidden' },
                mask: { backdropFilter: 'blur(4px)', backgroundColor: 'rgba(15, 23, 42, 0.4)' }
            }}
        >
            <div className="relative bg-white dark:bg-slate-900">
                {/* Scrollable Area */}
                <div className="max-h-[75vh] overflow-y-auto custom-scrollbar pt-10 pb-20 px-10">
                    <div className="relative max-w-2xl mx-auto">

                        {/* Connecting Line (Vertical) */}
                        <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-100 dark:bg-slate-800 rounded-full z-0" />

                        {/* System Stage: Applied */}
                        {stages.length > 0 && (
                            <div className="flex items-center gap-6 mb-8 relative z-10">
                                <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border-4 border-white dark:border-slate-900 shadow-lg flex items-center justify-center text-slate-400 font-black relative shrink-0">
                                    1
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                                        <Lock size={10} strokeWidth={3} />
                                    </div>
                                </div>
                                <div className="flex-1 p-5 bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-3xl opacity-60">
                                    <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 tracking-tight uppercase mb-0.5">{stages[0].stageName}</h4>
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">System Protected Stage</span>
                                </div>
                            </div>
                        )}

                        {/* Draggable Stages */}
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="pipeline-editor-modal" direction="vertical">
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="space-y-8"
                                    >
                                        {stages.map((stg, index) => {
                                            if (index === 0 || index === stages.length - 1) return null;
                                            const draggableIndex = index - 1;

                                            return (
                                                <Draggable key={stg.tempId || stg.stageId} draggableId={stg.tempId || stg.stageId} index={draggableIndex}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            className={`flex items-start gap-6 relative z-10 group transition-all duration-300 ${snapshot.isDragging ? 'scale-[1.02] z-50' : ''}`}
                                                        >
                                                            {/* Number Badge & Handle */}
                                                            <div
                                                                {...provided.dragHandleProps}
                                                                className={`w-12 h-12 rounded-2xl ${snapshot.isDragging ? 'bg-[#4F46E5]' : 'bg-white dark:bg-slate-800'} border-4 ${snapshot.isDragging ? 'border-indigo-100 dark:border-indigo-900/50' : 'border-indigo-50 dark:border-indigo-900/20'} shadow-xl flex items-center justify-center transition-all cursor-grab active:cursor-grabbing shrink-0 relative`}
                                                            >
                                                                <span className={`text-lg font-black ${snapshot.isDragging ? 'text-white' : 'text-[#4F46E5]'}`}>{index + 1}</span>
                                                                <div className="absolute -left-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <GripVertical size={16} className="text-slate-300" />
                                                                </div>
                                                            </div>

                                                            {/* Stage Card */}
                                                            <div className={`flex-1 p-6 ${snapshot.isDragging ? 'bg-white dark:bg-slate-800 shadow-2xl ring-2 ring-[#4F46E5]/20' : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800'} rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none hover:shadow-2xl hover:border-indigo-200 dark:hover:border-indigo-700/50 transition-all duration-300 relative overflow-hidden`}>
                                                                {/* Background Decor */}
                                                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-150 transition-transform" />

                                                                <div className="relative z-10">
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                                        {/* Left Side: Name & Mode */}
                                                                        <div className="space-y-5">
                                                                            <div>
                                                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block">Stage Title</label>
                                                                                <input
                                                                                    value={stg.stageName}
                                                                                    onChange={e => updateStage(index, 'stageName', e.target.value)}
                                                                                    className="w-full bg-transparent border-none p-0 text-xl font-black text-slate-800 dark:text-white placeholder:text-slate-300 focus:ring-0 uppercase tracking-tight"
                                                                                    placeholder="NAME YOUR STAGE"
                                                                                />
                                                                            </div>

                                                                            <div className="flex items-center gap-3">
                                                                                <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-full border border-indigo-100/50 dark:border-indigo-800/30">
                                                                                    <Clock size={11} className="text-[#4F46E5]" />
                                                                                    <input
                                                                                        type="number"
                                                                                        value={stg.durationMinutes}
                                                                                        onChange={e => updateStage(index, 'durationMinutes', parseInt(e.target.value))}
                                                                                        className="w-8 bg-transparent border-none p-0 text-[11px] font-black text-indigo-700 dark:text-indigo-400 focus:ring-0 text-center"
                                                                                    />
                                                                                    <span className="text-[9px] font-black text-indigo-400/80 uppercase">min</span>
                                                                                </div>
                                                                                <select
                                                                                    value={stg.mode}
                                                                                    onChange={e => updateStage(index, 'mode', e.target.value)}
                                                                                    className="bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-[10px] font-black text-slate-500 rounded-full py-1.5 pl-4 pr-8 focus:ring-0 appearance-none uppercase tracking-widest cursor-pointer hover:bg-white dark:hover:bg-slate-750 hover:border-indigo-200 transition-all shadow-sm"
                                                                                >
                                                                                    <option value="Online">Online</option>
                                                                                    <option value="In-person">In-person</option>
                                                                                </select>
                                                                            </div>
                                                                            {stg.mode === 'Online' && (
                                                                                <div className="mt-4 bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/30">
                                                                                    <label className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.15em] mb-1.5 block">Meeting Link</label>
                                                                                    <input
                                                                                        type="url"
                                                                                        value={stg.meetingLink || ''}
                                                                                        onChange={e => updateStage(index, 'meetingLink', e.target.value)}
                                                                                        placeholder="https://zoom.us/j/..."
                                                                                        className="w-full bg-white dark:bg-slate-800 border-none rounded-xl py-2 px-3 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm placeholder:text-slate-300"
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Right Side: Interviewer & Form */}
                                                                        <div className="space-y-4">
                                                                            <div>
                                                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block">Interviewer</label>
                                                                                <div className="space-y-2">
                                                                                    {(Array.isArray(stg.assignedInterviewers) && stg.assignedInterviewers.length > 0 ? stg.assignedInterviewers : [stg.assignedInterviewer || '']).map((intId, intIdx) => {
                                                                                        const emp = employees.find(e => e._id === intId);
                                                                                        return (
                                                                                            <div key={intIdx} className="space-y-1 bg-slate-50/50 dark:bg-slate-800/20 p-1.5 rounded-xl border border-slate-100/50 dark:border-slate-800/50">
                                                                                                <div className="flex items-center gap-1.5">
                                                                                                    <div className="flex-1 min-w-0 relative group/sel">
                                                                                                        <User size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/sel:text-[#4F46E5] transition-colors" />
                                                                                                        <select
                                                                                                            value={intId || ''}
                                                                                                            onChange={(e) => {
                                                                                                                const val = e.target.value;
                                                                                                                const currentInterviewers = Array.isArray(stg.assignedInterviewers)
                                                                                                                    ? [...stg.assignedInterviewers]
                                                                                                                    : [stg.assignedInterviewer || ''];
                                                                                                                currentInterviewers[intIdx] = val;
                                                                                                                const filtered = currentInterviewers.filter(Boolean);
                                                                                                                updateStage(index, 'assignedInterviewers', filtered);
                                                                                                                updateStage(index, 'assignedInterviewer', filtered[0] || '');
                                                                                                                if (val) {
                                                                                                                    notifyInterviewerAssignment(val, stg);
                                                                                                                }
                                                                                                            }}
                                                                                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 pl-9 pr-4 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/20 transition-all shadow-sm"
                                                                                                        >
                                                                                                            <option value="">Select interviewer...</option>
                                                                                                            {employees.map(emp => (
                                                                                                                <option key={emp._id} value={emp._id}>
                                                                                                                    {getEmployeeCode(emp) ? `${getEmployeeDisplayName(emp)} (${getEmployeeCode(emp)})` : getEmployeeDisplayName(emp)}
                                                                                                                </option>
                                                                                                            ))}
                                                                                                        </select>
                                                                                                    </div>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() => {
                                                                                                            const currentInterviewers = Array.isArray(stg.assignedInterviewers)
                                                                                                                ? [...stg.assignedInterviewers]
                                                                                                                : [stg.assignedInterviewer || ''];
                                                                                                            currentInterviewers.splice(intIdx, 1);
                                                                                                            const filtered = currentInterviewers.filter(Boolean);
                                                                                                            updateStage(index, 'assignedInterviewers', filtered);
                                                                                                            updateStage(index, 'assignedInterviewer', filtered[0] || '');
                                                                                                        }}
                                                                                                        className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-2 rounded-xl border border-transparent hover:border-rose-100 shrink-0"
                                                                                                    >
                                                                                                        <Trash2 size={14} />
                                                                                                    </button>
                                                                                                </div>
                                                                                                {emp && (
                                                                                                    <div className="text-[9px] font-medium text-slate-500 dark:text-slate-400 px-2 py-1 flex flex-col gap-0.5 leading-relaxed bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm">
                                                                                                        <div className="font-bold text-slate-700 dark:text-slate-300">{getEmployeeDisplayName(emp)} ({getEmployeeCode(emp) || 'N/A'})</div>
                                                                                                        <div>Dept: {getEmployeeDepartment(emp) || 'N/A'} • Desig: {getEmployeeDesignation(emp) || 'N/A'}</div>
                                                                                                        <div className="text-slate-400 dark:text-slate-500 font-mono truncate">{emp.email || 'N/A'}</div>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            const currentInterviewers = Array.isArray(stg.assignedInterviewers)
                                                                                                ? [...stg.assignedInterviewers]
                                                                                                : [stg.assignedInterviewer || ''];
                                                                                            currentInterviewers.push('');
                                                                                            updateStage(index, 'assignedInterviewers', currentInterviewers);
                                                                                        }}
                                                                                        className="w-full py-2 border border-dashed border-indigo-200 rounded-2xl text-[9px] font-black uppercase tracking-widest text-[#4F46E5] hover:bg-indigo-50/50 flex items-center justify-center gap-1 transition-all"
                                                                                    >
                                                                                        <Plus size={10} strokeWidth={3} /> Add Internal Interviewer
                                                                                    </button>
                                                                                    
                                                                                    {/* External Interviewers */}
                                                                                    {(stg.externalInterviewers || []).map((ext, extIdx) => (
                                                                                        <div key={`ext_${extIdx}`} className="space-y-2 bg-amber-50/50 dark:bg-amber-900/10 p-2 rounded-xl border border-amber-100/50 dark:border-amber-800/30">
                                                                                            <div className="flex items-center justify-between">
                                                                                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">External Interviewer</span>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => {
                                                                                                        const currExt = [...stg.externalInterviewers];
                                                                                                        currExt.splice(extIdx, 1);
                                                                                                        updateStage(index, 'externalInterviewers', currExt);
                                                                                                    }}
                                                                                                    className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg"
                                                                                                >
                                                                                                    <Trash2 size={12} />
                                                                                                </button>
                                                                                            </div>
                                                                                            <div className="flex flex-col gap-2">
                                                                                                <input
                                                                                                    type="text"
                                                                                                    placeholder="Name"
                                                                                                    value={ext.name || ''}
                                                                                                    onChange={(e) => {
                                                                                                        const currExt = [...stg.externalInterviewers];
                                                                                                        currExt[extIdx].name = e.target.value;
                                                                                                        updateStage(index, 'externalInterviewers', currExt);
                                                                                                    }}
                                                                                                    className="w-full bg-white border border-slate-200 rounded-xl py-1.5 px-3 text-[11px] font-bold outline-none focus:ring-2 focus:ring-amber-200"
                                                                                                />
                                                                                                <input
                                                                                                    type="email"
                                                                                                    placeholder="Email"
                                                                                                    value={ext.email || ''}
                                                                                                    onChange={(e) => {
                                                                                                        const currExt = [...stg.externalInterviewers];
                                                                                                        currExt[extIdx].email = e.target.value;
                                                                                                        updateStage(index, 'externalInterviewers', currExt);
                                                                                                    }}
                                                                                                    className="w-full bg-white border border-slate-200 rounded-xl py-1.5 px-3 text-[11px] font-bold outline-none focus:ring-2 focus:ring-amber-200"
                                                                                                />
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            const currExt = stg.externalInterviewers ? [...stg.externalInterviewers] : [];
                                                                                            currExt.push({ name: '', email: '' });
                                                                                            updateStage(index, 'externalInterviewers', currExt);
                                                                                        }}
                                                                                        className="w-full py-2 border border-dashed border-amber-200 rounded-2xl text-[9px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50/50 flex items-center justify-center gap-1 transition-all"
                                                                                    >
                                                                                        <Plus size={10} strokeWidth={3} /> Add External Interviewer
                                                                                    </button>
                                                                                </div>
                                                                            </div>

                                                                            <div>
                                                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block">Feedback Form</label>
                                                                                <button
                                                                                    onClick={() => openTemplateBuilder(index)}
                                                                                    className={`w-full group/btn relative overflow-hidden flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 shadow-sm ${stg.feedbackFormId ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30 hover:border-emerald-300' : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-indigo-300 hover:bg-white'}`}
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <FileText size={14} className={stg.feedbackFormId ? 'text-emerald-500' : 'text-slate-400'} />
                                                                                        <span className={`text-[10px] font-black uppercase tracking-tight truncate max-w-[150px] ${stg.feedbackFormId ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>
                                                                                            {stg.feedbackFormId ? (templates.find(t => t._id === stg.feedbackFormId)?.templateName || 'CONFIGURED') : 'Select / Build Template'}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className={`p-1.5 rounded-lg ${stg.feedbackFormId ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                                                        <Settings size={12} strokeWidth={3} className="group-hover/btn:rotate-90 transition-transform duration-500" />
                                                                                    </div>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Card Close */}
                                                                    <button
                                                                        onClick={() => deleteStage(index)}
                                                                        className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-slate-300 hover:text-rose-50 hover:bg-rose-50 border border-slate-100 dark:border-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md group-hover:translate-x-[-12px] group-hover:translate-y-[12px]"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            );
                                        })}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>

                        {/* Add Trigger Row */}
                        <div className="flex items-center gap-6 mt-12 mb-12 relative z-10 group">
                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 dark:border-slate-700 group-hover:border-indigo-400 group-hover:text-indigo-500 transition-colors shrink-0">
                                <Plus size={20} strokeWidth={3} />
                            </div>
                            <button
                                onClick={() => setShowStageModal(true)}
                                className="flex-1 py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-1 text-slate-400 hover:bg-white dark:hover:bg-slate-850 hover:border-indigo-400 hover:text-[#4F46E5] transition-all duration-300 shadow-sm"
                            >
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">New Milestone</span>
                                <span className="text-[8px] font-bold text-slate-400/80 uppercase tracking-widest">Add a custom round or interview stage to the pipeline</span>
                            </button>
                        </div>

                        {/* System Stage: Finalized */}
                        {stages.length > 0 && (
                            <div className="flex items-center gap-6 relative z-10">
                                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border-4 border-emerald-50 dark:border-emerald-900/30 shadow-lg flex items-center justify-center text-emerald-500 font-black relative shrink-0">
                                    {stages.length}
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 text-white">
                                        <Check size={10} strokeWidth={4} />
                                    </div>
                                </div>
                                <div className="flex-1 p-5 bg-emerald-50/20 dark:bg-emerald-900/10 border border-emerald-100/50 dark:border-emerald-800/30 rounded-3xl opacity-80 backdrop-blur-sm">
                                    <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-400 tracking-tight uppercase mb-0.5">{stages[stages.length - 1].stageName}</h4>
                                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Terminal Success Stage</span>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* Sticky Footer */}
                <div className="absolute bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 p-6 flex justify-end items-center gap-4 z-[100] shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                    >
                        Discard Changes
                    </button>
                    <button
                        onClick={handleSavePipeline}
                        disabled={loading}
                        className="px-10 py-3 bg-[#4F46E5] hover:bg-[#0D9488] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-200/50 dark:shadow-none flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Zap size={14} className="fill-current" />}
                        Apply & Save Pipeline
                    </button>
                </div>
            </div>

            {/* Sub Modals */}
            {showStageModal && (
                <StageModal
                    visible={showStageModal}
                    onCancel={() => setShowStageModal(false)}
                    onSave={handleStageAdd}
                    templates={templates}
                    onCreateTemplate={() => {
                        setTemplateBuilderData(null);
                        setShowTemplateBuilder(true);
                    }}
                />
            )}

            {showTemplateBuilder && (
                <Modal
                    open={showTemplateBuilder}
                    onCancel={() => setShowTemplateBuilder(false)}
                    footer={null}
                    closable={false}
                    centered
                    width={800}
                    styles={{ body: { padding: 0 } }}
                >
                    <FeedbackTemplateBuilder
                        initialTemplate={templateBuilderData?.initialTemplate}
                        onSave={handleTemplateSave}
                        onCancel={() => setShowTemplateBuilder(false)}
                    />
                </Modal>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 20px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </Modal>
    );
}
