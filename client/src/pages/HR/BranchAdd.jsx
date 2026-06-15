import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Phone, Mail, FileText, ArrowLeft, Save, Globe } from 'lucide-react';
import companiesService from '../../services/companiesService';

export default function BranchAdd() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [formData, setFormData] = useState({
        name: '',
        branchCode: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        type: 'Main'
    });

    const onChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validate = () => {
        const next = {};
        if (!formData.name.trim()) next.name = 'Branch name is required';
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) next.email = 'Invalid email format';
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            await companiesService.createBranch(formData);
            if (typeof window.showToast === 'function') {
                window.showToast('success', 'Success', 'Branch registered successfully');
            }
            navigate('..', { relative: 'path' });
        } catch (error) {
            const message = error?.response?.data?.message || 'Failed to create branch';
            if (typeof window.showToast === 'function') {
                window.showToast('error', 'Error', message);
            }
            setErrors({ submit: message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl animate-in slide-in-from-bottom-4 duration-500">
            <button 
                onClick={() => navigate('..', { relative: 'path' })}
                className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm mb-6 transition-colors group"
            >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Back to Branches
            </button>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="bg-indigo-600 px-8 py-10 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-3xl font-black tracking-tight">Register New Branch</h2>
                        <p className="text-indigo-100 mt-2 font-medium opacity-90">Set up a new operational hub for your organization hierarchy.</p>
                    </div>
                    <Building2 className="absolute right-[-20px] bottom-[-20px] text-white/10" size={180} />
                </div>

                <form onSubmit={onSubmit} className="p-8 space-y-8">
                    {/* Basic Info */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                            <Building2 size={18} className="text-indigo-600" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Basic Information</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 ml-1">Branch Name <span className="text-rose-500">*</span></label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        name="name"
                                        value={formData.name}
                                        onChange={onChange}
                                        placeholder="e.g. Mumbai Corporate Office"
                                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${errors.name ? 'border-rose-300 ring-2 ring-rose-50' : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50'} outline-none transition-all text-sm font-medium`}
                                    />
                                </div>
                                {errors.name && <p className="text-[11px] font-bold text-rose-500 ml-1">{errors.name}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 ml-1">Branch Code <span className="text-rose-500">*</span></label>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        name="branchCode"
                                        value={formData.branchCode}
                                        onChange={onChange}
                                        placeholder="Auto-generated if blank"
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Contact Info */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                            <Phone size={18} className="text-indigo-600" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Contact Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 ml-1">Official Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={onChange}
                                        placeholder="branch@company.com"
                                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${errors.email ? 'border-rose-300 ring-2 ring-rose-50' : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50'} outline-none transition-all text-sm font-medium`}
                                    />
                                </div>
                                {errors.email && <p className="text-[11px] font-bold text-rose-500 ml-1">{errors.email}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 ml-1">Contact Phone</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        name="phone"
                                        value={formData.phone}
                                        onChange={onChange}
                                        placeholder="+91 XXXXX XXXXX"
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Location */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                            <MapPin size={18} className="text-indigo-600" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Location Address</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 ml-1">Street Address</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
                                    <textarea 
                                        name="address"
                                        value={formData.address}
                                        onChange={onChange}
                                        rows={2}
                                        placeholder="Floor, Building, Street..."
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-medium resize-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 ml-1">City</label>
                                    <input 
                                        name="city"
                                        value={formData.city}
                                        onChange={onChange}
                                        placeholder="Mumbai"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-medium"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 ml-1">State</label>
                                    <input 
                                        name="state"
                                        value={formData.state}
                                        onChange={onChange}
                                        placeholder="Maharashtra"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-medium"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 ml-1">Pincode</label>
                                    <input 
                                        name="pincode"
                                        value={formData.pincode}
                                        onChange={onChange}
                                        placeholder="400001"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {errors.submit && (
                        <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold">
                            {errors.submit}
                        </div>
                    )}

                    <div className="pt-6 flex items-center justify-end gap-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => navigate('..', { relative: 'path' })}
                            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Register Branch
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
