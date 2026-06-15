import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import {
    User, FileText, ChevronRight, ChevronLeft,
    CheckCircle, Search, AlertCircle, Loader2,
    Calendar, Briefcase, MapPin, IndianRupee, Plus
} from 'lucide-react';
import { showToast } from '../../../utils/uiNotifications';

export default function IssueLetterWizard() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Data List State
    const [employees, setEmployees] = useState([]);
    const [templates, setTemplates] = useState([]);

    // Selection State
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [customData, setCustomData] = useState({});

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [templateType, setTemplateType] = useState('');

    useEffect(() => {
        fetchEmployees();
        fetchTemplates();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/hr/employees');
            const empData = res.data.data || res.data;
            console.log('📋 Employees fetched:', empData);
            setEmployees(empData);
        } catch (err) {
            console.error('Failed to fetch employees', err);
            showToast('error', 'Error', 'Failed to fetch employees');
        }
    };

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/letters/templates');
            setTemplates(res.data);
        } catch (err) {
            console.error('Failed to fetch templates', err);
        }
    };

    const handleEmployeeSelect = (emp) => {
        setSelectedEmployee(emp);
        setStep(2);
    };

    const handleTemplateSelect = (tmpl) => {
        setSelectedTemplate(tmpl);

        // Initialize custom data with placeholders
        const initialCustomData = {};
        if (tmpl.placeholders) {
            tmpl.placeholders.forEach(p => {
                initialCustomData[p] = '';
            });
        }

        // Auto-fill some common fields if possible
        if (selectedEmployee) {
            initialCustomData['employee_name'] = `${selectedEmployee.firstName} ${selectedEmployee.lastName || ''}`;
            initialCustomData['designation'] = selectedEmployee.designation || '';
            initialCustomData['department'] = selectedEmployee.department || '';
        }

        setCustomData(initialCustomData);
        setStep(3);
    };

    const handleGenerate = async () => {
        // Validation
        if (!selectedEmployee?._id) {
            showToast('error', 'Error', 'Employee ID is missing. Please select an employee again.');
            console.error('❌ Missing employee ID:', selectedEmployee);
            return;
        }

        if (!selectedTemplate?._id) {
            showToast('error', 'Error', 'Template ID is missing. Please select a template again.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                templateId: selectedTemplate._id,
                employeeId: selectedEmployee._id,
                customData
            };

            console.log('📤 Sending payload:', payload);

            const res = await api.post('/letters/generate-generic', payload);

            showToast('success', 'Success', res.data.message);
            navigate('/hr/letters');
        } catch (err) {
            console.error('Generation failed', err);
            showToast('error', 'Error', err.response?.data?.message || 'Failed to generate letter');
        } finally {
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-8">
                <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                    <div>
                        <h2 className="text-[14px] font-semibold text-slate-700 uppercase tracking-[0.2em] mb-1">Select Recipient</h2>
                        <p className="text-[11px] font-medium text-slate-400 italic">Identify the target employee for this communication layer</p>
                    </div>
                    <div className="relative w-full md:w-[450px]">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input
                            type="text"
                            placeholder="Find recipient by name, ID, or email..."
                            className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-sm font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar p-1">
                    {employees.filter(emp =>
                        (emp.firstName + ' ' + emp.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
                        emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
                    ).map((emp, idx) => (
                        <div
                            key={emp._id}
                            onClick={() => handleEmployeeSelect(emp)}
                            className="group p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 cursor-pointer"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-white font-bold text-xs ring-4 ring-slate-50 shadow-sm ${idx % 3 === 0 ? 'bg-gradient-to-br from-indigo-400 to-indigo-600' :
                                    idx % 3 === 1 ? 'bg-gradient-to-br from-violet-400 to-violet-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'
                                    }`}>
                                    {emp.firstName?.[0]}{emp.lastName?.[0]}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-slate-800 text-[14px] tracking-tight truncate group-hover:text-indigo-600 transition-colors">
                                        {emp.firstName} {emp.lastName}
                                    </h4>
                                    <p className="text-[10px] text-[#4F46E5] font-bold uppercase tracking-[0.1em] mt-1 opacity-70">
                                        {emp.employeeId || 'ATTACHED_RECORD'}
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 mt-2 truncate">
                                        {emp.designation || 'Operational Role'}
                                    </p>
                                </div>
                                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                                    <ChevronRight size={18} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-[14px] font-semibold text-slate-700 uppercase tracking-[0.2em] mb-1">Blueprint Selection</h2>
                        <p className="text-[11px] font-medium text-slate-400 italic">Select the communication layer template to synchronize</p>
                    </div>
                    <button
                        onClick={() => setStep(1)}
                        className="px-4 py-2 bg-slate-50 text-slate-400 hover:text-indigo-600 font-bold text-[10px] uppercase tracking-widest transition-all rounded-xl border border-transparent hover:border-indigo-100 flex items-center gap-2"
                    >
                        <ChevronLeft size={16} /> Change Recipient
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map(tmpl => (
                        <div
                            key={tmpl._id}
                            onClick={() => handleTemplateSelect(tmpl)}
                            className="group relative p-8 bg-white rounded-[2.25rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 cursor-pointer overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
                                <FileText size={100} />
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 border border-transparent group-hover:border-indigo-100 shadow-sm group-hover:scale-110 transition-all">
                                <FileText size={28} />
                            </div>
                            <h4 className="font-semibold text-slate-800 text-lg tracking-tight mb-3 uppercase group-hover:text-indigo-600 transition-colors">{tmpl.name}</h4>
                            <div className="flex flex-wrap gap-2">
                                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase tracking-[0.1em] rounded-full border border-indigo-100">{tmpl.type}</span>
                                <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[9px] font-bold uppercase tracking-[0.1em] rounded-full border border-slate-100">{tmpl.templateType}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-[14px] font-semibold text-slate-700 uppercase tracking-[0.2em] mb-1">Final Sync & Preview</h2>
                        <p className="text-[11px] font-medium text-slate-400 italic">Verify recipient data and customize blueprint fields</p>
                    </div>
                    <button
                        onClick={() => setStep(2)}
                        className="px-4 py-2 bg-slate-50 text-slate-400 hover:text-indigo-600 font-bold text-[10px] uppercase tracking-widest transition-all rounded-xl border border-transparent hover:border-indigo-100 flex items-center gap-2"
                    >
                        <ChevronLeft size={16} /> Back to Templates
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                    <div className="lg:col-span-1 border-r border-slate-100 pr-8">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">Entity Summary</h4>
                        <div className="space-y-6">
                            <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Recipient</p>
                                <p className="font-semibold text-slate-800 text-sm truncate">{selectedEmployee.firstName} {selectedEmployee.lastName}</p>
                                <p className="text-[10px] text-indigo-600 font-bold mt-1 uppercase tracking-tight opacity-70">Emp ID: {selectedEmployee.employeeId}</p>
                            </div>
                            <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Blueprint Layer</p>
                                <p className="font-semibold text-slate-800 text-sm truncate">{selectedTemplate.name}</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${selectedTemplate.requiresApproval ? 'bg-amber-400' : 'bg-indigo-400'}`}></div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase">
                                        {selectedTemplate.requiresApproval ? 'Workflow: Approval Layer' : 'Workflow: Direct Sync'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-3 space-y-8">
                        <div>
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">Synchronization Fields</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {Object.keys(customData).map(field => (
                                    <div key={field} className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-2 block italic">{field.replace(/_/g, ' ')}</label>
                                        <input
                                            type="text"
                                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-sm font-medium"
                                            value={customData[field]}
                                            onChange={(e) => setCustomData({ ...customData, [field]: e.target.value })}
                                            placeholder={`Enter ${field.replace(/_/g, ' ')}...`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-8 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="px-10 py-4 bg-[#4F46E5] hover:bg-[#0D9488] text-white rounded-2xl font-bold text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} /> Synchronizing Data
                                    </>
                                ) : (
                                    <>
                                        {selectedTemplate.requiresApproval ? (
                                            <>Submit to Approval Stream <ChevronRight size={18} /></>
                                        ) : (
                                            <>Generate & Synchronize <CheckCircle size={18} /></>
                                        )}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-6 w-full animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-2">
                <div>
                    <h1 className="text-4xl font-medium text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20">
                            <Plus className="text-white" size={28} />
                        </div>
                        Letter Wizard
                    </h1>
                    <div className="flex items-center gap-4 text-slate-400 font-medium text-sm mt-3 tracking-wide">
                        <button onClick={() => setStep(1)} className={`flex items-center gap-2 transition-colors ${step >= 1 ? 'text-indigo-600 font-bold' : ''}`}>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] border ${step >= 1 ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-100 border-slate-200'}`}>01</div>
                            Recipient
                        </button>
                        <ChevronRight size={14} className="opacity-30" />
                        <button onClick={() => step > 2 ? setStep(2) : null} className={`flex items-center gap-2 transition-colors ${step >= 2 ? 'text-indigo-600 font-bold' : ''}`}>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] border ${step >= 2 ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-100 border-slate-200'}`}>02</div>
                            Template
                        </button>
                        <ChevronRight size={14} className="opacity-30" />
                        <div className={`flex items-center gap-2 transition-colors ${step >= 3 ? 'text-indigo-600 font-bold' : ''}`}>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] border ${step >= 3 ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-100 border-slate-200'}`}>03</div>
                            Review
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/hr/letters')}
                    className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-semibold text-xs uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2.5 shadow-sm"
                >
                    <ChevronLeft size={16} /> Exit Wizard
                </button>
            </div>

            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
        </div>
    );
}
