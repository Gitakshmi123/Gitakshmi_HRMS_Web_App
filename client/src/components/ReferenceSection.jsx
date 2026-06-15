import React from 'react';
import { User, Building2, Briefcase, Mail, Phone, Clock, Plus, Trash2, AlertCircle } from 'lucide-react';

const RELATIONSHIP_OPTIONS = [
    'Reporting Manager',
    'Team Lead',
    'HR Manager',
    'Senior Colleague',
    'Mentor',
    'Professor',
    'Client',
    'Other'
];

const YEARS_KNOWN_OPTIONS = [
    '< 1 year',
    '1-2 years',
    '2-5 years',
    '5+ years'
];

export default function ReferenceSection({ references, setReferences, isFresher, setIsFresher, errors }) {
    const addReference = () => {
        if (references.length < 2) {
            setReferences([...references, {
                name: '',
                designation: '',
                company: '',
                relationship: '',
                email: '',
                phone: '',
                yearsKnown: '',
                consentToContact: true
            }]);
        }
    };

    const removeReference = (index) => {
        if (references.length > 1) {
            setReferences(references.filter((_, i) => i !== index));
        }
    };

    const updateReference = (index, field, value) => {
        const updated = [...references];
        updated[index][field] = value;
        setReferences(updated);
    };

    const handleFresherChange = (checked) => {
        setIsFresher(checked);
        if (checked) {
            setReferences([]);
        } else {
            // Init with 1 reference card if none exist
            if (references.length === 0) {
                setReferences([{
                    name: '',
                    designation: '',
                    company: '',
                    relationship: '',
                    email: '',
                    phone: '',
                    yearsKnown: '',
                    consentToContact: true
                }]);
            }
        }
    };

    return (
        <div className="space-y-12 mt-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Section Header */}
            <div className="flex items-center gap-4">
                <div className="w-1.5 h-8 bg-indigo-600 rounded-full shadow-sm"></div>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">Professional Reference</h3>
            </div>

            {/* References Grid */}
            <div className="space-y-10">
                {references.map((ref, index) => (
                    <div key={index}>
                        {/* Card Header */}
                        <div className="flex items-center justify-between">
                            {references.length > 1 && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); removeReference(index); }}
                                    className="p-4 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all group/btn"
                                    title="Remove Reference"
                                >
                                    <Trash2 size={24} className="group-hover/btn:scale-110 transition-transform" />
                                </button>
                            )}
                        </div>

                        {/* Reference Fields */}
                        <div className="grid grid-cols-12 gap-x-10 gap-y-10">
                            {/* Full Name */}
                            <div className="col-span-12 md:col-span-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 flex items-center gap-2">
                                        Full Name <span className="text-rose-500 text-baseLeading-none">*</span>
                                    </label>
                                    <div className="relative group">
                                        <User size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                                        <input
                                            type="text"
                                            value={ref.name}
                                            onChange={(e) => updateReference(index, 'name', e.target.value)}
                                            required
                                            className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium text-slate-700 h-[64px]"
                                            placeholder="e.g. John Doe"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Designation */}
                            <div className="col-span-12 md:col-span-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 flex items-center gap-2">
                                        Designation <span className="text-rose-500 text-baseLeading-none">*</span>
                                    </label>
                                    <div className="relative group">
                                        <Briefcase size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                                        <input
                                            type="text"
                                            value={ref.designation}
                                            onChange={(e) => updateReference(index, 'designation', e.target.value)}
                                            required
                                            className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium text-slate-700 h-[64px]"
                                            placeholder="e.g. Senior Manager"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Company */}
                            <div className="col-span-12 md:col-span-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 flex items-center gap-2">
                                        Company / Organization <span className="text-rose-500 text-baseLeading-none">*</span>
                                    </label>
                                    <div className="relative group">
                                        <Building2 size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                                        <input
                                            type="text"
                                            value={ref.company}
                                            onChange={(e) => updateReference(index, 'company', e.target.value)}
                                            required
                                            className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium text-slate-700 h-[64px]"
                                            placeholder="e.g. Tech Solutions Inc."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Relationship */}
                            <div className="col-span-12 md:col-span-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 flex items-center gap-2">
                                        Relationship <span className="text-rose-500 text-baseLeading-none">*</span>
                                    </label>
                                    <div className="relative group">
                                        <select
                                            value={ref.relationship}
                                            onChange={(e) => updateReference(index, 'relationship', e.target.value)}
                                            required
                                            className="w-full px-8 py-5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium text-slate-700 appearance-none h-[64px]"
                                        >
                                            <option value="">Select Relationship</option>
                                            {RELATIONSHIP_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-indigo-600 transition-colors">
                                            <Plus size={18} className="rotate-45" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Email */}
                            <div className="col-span-12 md:col-span-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 flex items-center gap-2">
                                        Official Email <span className="text-rose-500 text-baseLeading-none">*</span>
                                    </label>
                                    <div className="relative group">
                                        <Mail size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                                        <input
                                            type="email"
                                            value={ref.email}
                                            onChange={(e) => updateReference(index, 'email', e.target.value)}
                                            required
                                            className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium text-slate-700 h-[64px]"
                                            placeholder="e.g. manager@company.com"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Phone */}
                            <div className="col-span-12 md:col-span-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 flex items-center gap-2">
                                        Contact Number <span className="text-rose-500 text-baseLeading-none">*</span>
                                    </label>
                                    <div className="relative group">
                                        <Phone size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                                        <input
                                            type="tel"
                                            value={ref.phone}
                                            onChange={(e) => updateReference(index, 'phone', e.target.value)}
                                            required
                                            className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium text-slate-700 h-[64px]"
                                            placeholder="e.g. +91 90000 00000"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Years Known (Optional) */}
                            <div className="col-span-12 md:col-span-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">
                                        Years Known (Optional)
                                    </label>
                                    <div className="relative group">
                                        <Clock size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors z-10 pointer-events-none" />
                                        <select
                                            value={ref.yearsKnown}
                                            onChange={(e) => updateReference(index, 'yearsKnown', e.target.value)}
                                            className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium text-slate-700 appearance-none h-[64px]"
                                        >
                                            <option value="">Select Duration</option>
                                            {YEARS_KNOWN_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-indigo-600 transition-colors">
                                            <Plus size={18} className="rotate-45" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Error Display for this reference */}
                        {errors?.[`reference_${index}`] && (
                            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-rose-600 text-sm font-bold flex items-center gap-3 animate-in fade-in zoom-in">
                                <AlertCircle size={20} />
                                {errors[`reference_${index}`]}
                            </div>
                        )}
                    </div>
                ))}

                {/* Add Reference Button */}
                {references.length < 2 && (
                    <button
                        type="button"
                        onClick={addReference}
                        className="w-full py-10 border-2 border-dashed border-slate-200 rounded-[3rem] text-slate-400 font-black text-xs uppercase tracking-[0.3em] hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-4 group"
                    >
                        <div className="w-10 h-10 bg-white shadow-sm border border-slate-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Plus size={20} />
                        </div>
                        Add Another Professional Reference
                    </button>
                )}
            </div>
        </div>
    );
}
