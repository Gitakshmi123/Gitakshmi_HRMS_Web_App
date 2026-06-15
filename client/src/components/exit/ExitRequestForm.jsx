import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Send, AlertCircle, Info, ChevronRight, 
    Calendar, MessageSquare, ClipboardList, 
    UserMinus, ArrowRight, ShieldCheck, 
    Sparkles, Clock, Lock, Zap
} from 'lucide-react';
import exitAPI from '../../services/exitAPI';
import toast from 'react-hot-toast';

const DEFAULT_NOTICE_DAYS = 30;

function addDays(dateStr, days) {
    if (!dateStr || !Number.isInteger(days)) return '';
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

export default function ExitRequestForm({ onSubmitted, onRefresh, hasActiveRequest = false, noticePeriodDaysFromPolicy = DEFAULT_NOTICE_DAYS, canSubmitEligibility = null }) {
    const noticeDays = Number(noticePeriodDaysFromPolicy) || DEFAULT_NOTICE_DAYS;
    const [form, setForm] = useState({
        exitType:          'Resignation',
        reason:            '',
        resignationDate:   '',
        lastWorkingDate:   '',
        noticePeriodDays:  noticeDays,
        comments:          ''
    });
    const effectiveNoticeDays = form.noticePeriodDays ?? noticeDays;
    const [loading, setLoading] = useState(false);
    const eligibilityLoaded = canSubmitEligibility !== null;
    const canSubmit = eligibilityLoaded && canSubmitEligibility.canSubmit === true;
    const eligibilityReason = canSubmitEligibility?.reason || '';

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const onResignationDateChange = (dateStr) => {
        set('resignationDate', dateStr);
        if (dateStr) {
            const lwd = addDays(dateStr, effectiveNoticeDays);
            set('lastWorkingDate', lwd);
        } else {
            set('lastWorkingDate', '');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.reason.trim()) {
            toast.error('Please provide a reason for exit.');
            return;
        }
        if (!form.lastWorkingDate) {
            toast.error('Please select a preferred last working date.');
            return;
        }
        try {
            setLoading(true);
            await exitAPI.submitRequest({
                ...form,
                noticePeriodDays: effectiveNoticeDays
            });
            toast.success('Exit request submitted successfully!');
            setForm({ exitType: 'Resignation', reason: '', resignationDate: '', lastWorkingDate: '', noticePeriodDays: noticeDays, comments: '' });
            if (onSubmitted) onSubmitted();
            if (onRefresh)   onRefresh();
        } catch (err) {
            toast.error(err?.response?.data?.message || err?.message || 'Failed to submit request.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-[2.5rem] p-6 border border-[#E2E8F0] shadow-xl shadow-blue-500/5 animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Zero-Scroll Optimized Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-[0.2em] px-1">Separation Category</label>
                        <select 
                            value={form.exitType} 
                            onChange={e => set('exitType', e.target.value)} 
                            className="w-full h-11 px-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[13px] font-bold text-[#334155] outline-none focus:bg-white focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/5 transition-all appearance-none cursor-pointer"
                            required
                        >
                            <option value="Resignation">Resignation</option>
                            <option value="Retirement">Retirement</option>
                            <option value="Termination">Termination</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-[0.2em] px-1">Resignation Date</label>
                        <input
                            type="date"
                            value={form.resignationDate}
                            onChange={e => onResignationDateChange(e.target.value)}
                            min={new Date().toISOString().slice(0, 10)}
                            className="w-full h-11 px-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[13px] font-bold text-[#334155] outline-none focus:bg-white focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/5 transition-all"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-[0.2em] px-1">Calculated LWD</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={form.lastWorkingDate}
                                onChange={e => set('lastWorkingDate', e.target.value)}
                                min={form.resignationDate || new Date().toISOString().slice(0, 10)}
                                className="w-full h-11 px-5 bg-slate-100 font-bold text-[#64748B] border border-[#E2E8F0] rounded-xl outline-none cursor-not-allowed text-[13px]"
                                readOnly
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-[0.2em] px-1">Notice Period</label>
                        <div className="relative">
                             <input type="text" value={`${effectiveNoticeDays} Days`} readOnly className="w-full h-11 px-5 bg-slate-100 font-black text-[#2563EB] border border-[#E2E8F0] rounded-xl outline-none text-[13px]" />
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-[0.2em] px-1">Reason for Exit</label>
                    <textarea 
                        required 
                        placeholder="Provide core reason..."
                        className="w-full min-h-[80px] p-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[13px] font-medium text-[#334155] outline-none focus:bg-white focus:border-[#2563EB] focus:ring-8 focus:ring-blue-500/[0.03] transition-all resize-none placeholder:text-slate-300 leading-relaxed"
                        value={form.reason}
                        onChange={(e) => set('reason', e.target.value)}
                    />
                </div>

                {eligibilityReason && !canSubmit && (
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center gap-3 animate-in slide-in-from-top-2">
                         <AlertCircle size={16} className="text-rose-500 shrink-0" />
                         <p className="text-[10px] font-bold text-rose-700 uppercase tracking-widest leading-tight">{eligibilityReason}</p>
                    </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-[#F8FAFC]">
                    <div className="flex items-center gap-2 text-slate-400">
                         <Zap size={12} className="text-amber-500" />
                         <p className="text-[9px] font-bold uppercase tracking-wider italic opacity-60">Secured Node Submission</p>
                    </div>
                    <button 
                        type="submit"
                        disabled={loading || !canSubmit}
                        className="h-12 px-8 bg-[#2563EB] hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-xl text-[12px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all flex items-center gap-3 active:scale-95 group"
                    >
                         {loading ? 'Sending...' : 'Broadcast'} <Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </button>
                </div>
            </form>
        </div>
    );
}
