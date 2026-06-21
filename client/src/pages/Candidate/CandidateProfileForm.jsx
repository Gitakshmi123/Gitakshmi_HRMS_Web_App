import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { UserRound, Building2, Landmark, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../utils/api';

export default function CandidateProfileForm({ applicationId, isEmbedded, onSuccess }) {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const onSubmit = async (data) => {
        setSubmitting(true);
        setError(null);
        try {
            const payload = {
                personalInfo: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    mobile: data.mobile,
                    dob: data.dob,
                    gender: data.gender,
                    bloodGroup: data.bloodGroup,
                    maritalStatus: data.maritalStatus,
                    fatherName: data.fatherName,
                    emergencyContactName: data.emergencyContactName,
                    emergencyContactNumber: data.emergencyContactNumber,
                    currentAddress: data.currentAddress,
                    permanentAddress: data.permanentAddress
                }
            };

            const res = await api.post(`/public/applications/${applicationId}/submit-profile`, payload);
            if (res.data.success) {
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-2xl flex items-center gap-3">
                    <AlertCircle size={20} />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}
            
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <UserRound size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Personal Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">First Name</label>
                        <input {...register("firstName", { required: true })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-medium text-slate-700" placeholder="John" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Last Name</label>
                        <input {...register("lastName", { required: true })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-medium text-slate-700" placeholder="Doe" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Email</label>
                        <input {...register("email", { required: true })} type="email" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-medium text-slate-700" placeholder="john@example.com" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Mobile Number</label>
                        <input {...register("mobile", { required: true })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-medium text-slate-700" placeholder="+1 234 567 890" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Date of Birth</label>
                        <input {...register("dob", { required: true })} type="date" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-medium text-slate-700" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Gender</label>
                        <select {...register("gender", { required: true })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-medium text-slate-700">
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Blood Group</label>
                        <input {...register("bloodGroup")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-medium text-slate-700" placeholder="O+" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Marital Status</label>
                        <select {...register("maritalStatus")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-medium text-slate-700">
                            <option value="">Select</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Father's Name</label>
                        <input {...register("fatherName", { required: true })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-medium text-slate-700" placeholder="Father's Full Name" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Emergency Contact Name</label>
                        <input {...register("emergencyContactName", { required: true })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-medium text-slate-700" placeholder="Emergency Contact Name" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Emergency Contact Number</label>
                        <input {...register("emergencyContactNumber", { required: true })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-medium text-slate-700" placeholder="+1 234 567 890" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Current Address</label>
                        <textarea {...register("currentAddress", { required: true })} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-medium text-slate-700 resize-none" placeholder="Enter current address..." />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Permanent Address</label>
                        <textarea {...register("permanentAddress", { required: true })} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-medium text-slate-700 resize-none" placeholder="Enter permanent address..." />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-500/30 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {submitting ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Submitting...
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={18} />
                            Submit Profile for Verification
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
