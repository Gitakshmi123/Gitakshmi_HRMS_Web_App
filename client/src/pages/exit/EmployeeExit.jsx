import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ClipboardList, PlusCircle, CalendarDays, Clock,
    Trophy, FileText, ShieldCheck, Lock, Download, 
    CheckCircle2, ChevronRight, Layout, Hash, 
    MessageCircle, Layers, Star, Zap, Activity,
    Shield, Briefcase, Info, XCircle, ArrowLeft,
    Search, HelpCircle, Plus, UserMinus
} from 'lucide-react';
import ExitRequestForm from '../../components/exit/ExitRequestForm';
import ExitStatusTracker from '../../components/exit/ExitStatusTracker';
import ExitClearanceForm from '../../components/exit/ExitClearanceForm';
import NoticePeriodPanel from '../../components/exit/NoticePeriodPanel';
import ExitInterviewPanel from '../../components/exit/ExitInterviewPanel';
import LetterGenerationPanel from '../../components/exit/LetterGenerationPanel';
import exitAPI from '../../services/exitAPI';
import { useAuth } from '../../context/AuthContext';
import { useRBAC } from '../../context/RBACContext';
import Loader from '../../components/common/Loader';
import clsx from 'clsx';

const FINAL_STAGES = ['Letters Generated', 'Deactivated'];

const STATUS_STYLE = {
    Pending:   'bg-amber-50 text-amber-600 border-amber-100',
    Approved:  'bg-blue-50 text-[#2563EB] border-blue-100',
    Rejected:  'bg-rose-50 text-rose-600 border-rose-100',
    Completed: 'bg-[#ECFDF5] text-[#16A34A] border-[#D1FAE5]',
};

const STAGE_STYLE = {
    'Requested':        'bg-slate-100 text-slate-600',
    'HR Review':        'bg-blue-50 text-[#2563EB]',
    'Notice Period':    'bg-amber-50 text-amber-600',
    'Clearance':        'bg-orange-50 text-orange-600',
    'Exit Interview':   'bg-indigo-50 text-indigo-600',
    'FNF':              'bg-blue-50 text-[#2563EB]',
    'Letters Generated':'bg-emerald-50 text-[#16A34A]',
    'Deactivated':      'bg-slate-100 text-slate-400',
};

const StandardCard = ({ children, onClick, active = false, className }) => (
    <div
        onClick={onClick}
        className={clsx(
            "relative group bg-white rounded-xl border transition-all duration-300 shadow-sm",
            active ? 'border-[#2563EB]' : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-md',
            onClick ? 'cursor-pointer' : '',
            className
        )}
    >
        <div className="relative p-6 z-10">{children}</div>
    </div>
);

export default function EmployeeExit() {
    const { exitStatus, setExitStatus } = useAuth();
    const { hasPermission, loading: permissionLoading } = useRBAC();
    const [tab, setTab]           = useState('my-requests');
    const [requests, setReqs]     = useState([]);
    const [loading, setLoading]   = useState(true);
    const [selected, setSelected] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [canSubmitEligibility, setCanSubmitEligibility] = useState(null);
    const canAccessExit = hasPermission('employee.exit', 'any') || hasPermission('offboarding.exit', 'any');
    const canViewExit = hasPermission('employee.exit', 'view') || hasPermission('offboarding.exit', 'view');
    const canCreateExit = hasPermission('employee.exit', 'create') || hasPermission('offboarding.exit', 'create');

    const fetchRequests = useCallback(async () => {
        if (!canViewExit) return;
        try {
            setLoading(true);
            const res = await exitAPI.getMyRequests();
            setReqs(res.data || []);
        } catch (err) {
            console.error('Failed to load exit requests', err);
        } finally {
            setLoading(false);
        }
    }, [canAccessExit]);

    const fetchCanSubmit = useCallback(async () => {
        if (!canAccessExit) {
            setCanSubmitEligibility({ canSubmit: false, reason: 'You do not have access to resignation requests.' });
            return;
        }
        try {
            const res = await exitAPI.getCanSubmit();
            setCanSubmitEligibility(res?.canSubmit === true ? { canSubmit: true } : { canSubmit: false, reason: res?.reason || 'Salary structure not configured.' });
        } catch (err) {
            setCanSubmitEligibility({ canSubmit: false, reason: 'Unable to verify eligibility.' });
        }
    }, [canViewExit]);

    useEffect(() => {
        if (permissionLoading || !canViewExit) {
            setLoading(false);
            setReqs([]);
            return;
        }
        fetchRequests();
    }, [fetchRequests, canViewExit, permissionLoading]);
    useEffect(() => {
        if (permissionLoading) return;
        fetchCanSubmit();
    }, [fetchCanSubmit, permissionLoading]);

    const activeRequest  = requests.find(r => r.status === 'Pending' || r.status === 'Approved');
    const isExitComplete = exitStatus === 'completed' || FINAL_STAGES.includes(activeRequest?.stage);

    useEffect(() => {
        if (activeRequest && FINAL_STAGES.includes(activeRequest.stage)) {
            setExitStatus('completed');
        }
    }, [activeRequest, setExitStatus]);

    const canSubmitNew   = !activeRequest;
    const needsClearance = activeRequest?.stage === 'Clearance' && !activeRequest?.clearanceFormSubmitted;

    const refreshSelected = async () => {
        if (!canViewExit) return;
        await fetchRequests();
        if (selected) {
            try {
                const res = await exitAPI.getMyRequests();
                const updated = (res.data || []).find(r => r._id === selected._id);
                setSelected(updated || null);
            } catch (_) {}
        }
    };

    if (permissionLoading) return null;

    if (!canAccessExit) {
        return (
            <div className="flex min-h-[320px] items-center justify-center bg-white p-6">
                <div className="w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
                        <Lock size={28} />
                    </div>
                    <h3 className="text-[20px] font-semibold text-[#334155]">Resignation Access Restricted</h3>
                    <p className="mt-2 text-sm font-medium text-[#64748B]">
                        You do not currently have permission to open resignation requests.
                    </p>
                </div>
            </div>
        );
    }

    if (loading && requests.length === 0) return <div className="p-10 animate-pulse text-slate-300 font-bold uppercase tracking-widest text-sm">Syncing exit records...</div>;

    if (isCreating) {
        return (
            <div className="h-full flex flex-col bg-white font-inter overflow-hidden relative animate-in slide-in-from-bottom-5 duration-500">
                <div className="p-[15px] shrink-0 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsCreating(false)}
                            className="w-10 h-10 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-xl text-[#64748B] hover:text-[#2563EB] hover:border-[#2563EB] transition-all shadow-sm group"
                        >
                            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div>
                            <h1 className="text-[18px] font-bold text-[#334155] tracking-tight">Initiate Resignation</h1>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden p-[15px] relative z-10">
                    <div className="w-full h-full flex flex-col justify-center pb-12">
                         <ExitRequestForm
                            hasActiveRequest={!!activeRequest}
                            canSubmitEligibility={canSubmitEligibility}
                            onSubmitted={() => { fetchRequests(); setIsCreating(false); fetchCanSubmit(); }}
                            onCancel={() => setIsCreating(false)}
                        />
                    </div>
                </div>
            </div>
        );
    }

    if (isExitComplete) {
        const completedRequest = activeRequest || requests[0];
        return (
            <div className="h-full flex flex-col bg-white font-inter overflow-y-auto custom-scrollbar p-0 gap-6 animate-in fade-in duration-500">
                <div className="flex items-center gap-4 shrink-0">
                    <div>
                        <h1 className="text-[22px] font-bold text-[#334155] tracking-tight">Resignation Form</h1>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-8 flex-1">
                    <div className="col-span-12 xl:col-span-8 space-y-6">
                        <div className="flex items-center gap-4 bg-amber-50 border border-amber-100 rounded-xl p-5">
                            <div className="p-2.5 bg-white rounded-lg shadow-sm text-amber-500 border border-amber-200"><Lock size={18} /></div>
                            <p className="text-[13px] text-amber-700 font-bold uppercase tracking-wide">Registry Status: Account Deactivated / Locked</p>
                        </div>
                        <ExitStatusTracker stage={completedRequest.stage} status={completedRequest.status} />
                        <StandardCard active>
                             <div className="flex justify-between items-center mb-6">
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748B] opacity-60">Submission Summary</span>
                                <span className={clsx("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border", STATUS_STYLE[completedRequest.status])}>{completedRequest.status}</span>
                             </div>
                             <h3 className="text-[18px] font-bold text-[#334155] mb-2">{completedRequest.exitType}</h3>
                             <p className="text-[13px] text-[#64748B] font-medium leading-relaxed italic">"{completedRequest.reason}"</p>
                        </StandardCard>
                    </div>
                    <div className="col-span-12 xl:col-span-4 space-y-6">
                         {completedRequest.lettersGenerated && (
                            <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm">
                                <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4 text-[#2563EB]">
                                    <Download size={16} />
                                    <h3 className="text-[12px] font-bold uppercase tracking-widest">Resignation Documents</h3>
                                </div>
                                <LetterGenerationPanel request={completedRequest} />
                            </div>
                        )}
                        <div className="bg-[#1E293B] p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">
                            <div className="absolute -right-6 -bottom-6 opacity-10"><Trophy size={120} /></div>
                            <h3 className="text-[18px] font-bold mb-3 tracking-tight">Best Wishes!</h3>
                            <p className="text-slate-300 text-[13px] leading-relaxed font-medium">Thank you for being part of our team. We wish you great success in your future endeavors.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white font-inter overflow-hidden p-0 gap-6 animate-in fade-in duration-500">
            {!selected ? (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shrink-0">
                        <div className="flex items-center gap-4">
                             <div>
                                        <h1 className="text-[22px] font-bold text-[#334155] tracking-tight">Resignation</h1>
                             </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setIsCreating(true)}
                                disabled={!canCreateExit || !canSubmitNew}
                                className="h-11 px-6 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-[13px] font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                            >
                                <PlusCircle size={18} /> Submit Resignation
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-10">
                        {!canViewExit ? (
                            <div className="bg-white rounded-xl border border-dashed border-[#E2E8F0] h-64 flex flex-col items-center justify-center text-center px-6 mt-10">
                                <Lock size={40} className="text-slate-200 mb-4" />
                                <h3 className="text-[18px] font-bold text-[#334155] tracking-tight">History Hidden</h3>
                                <p className="text-[13px] text-[#64748B] font-medium max-w-xs mx-auto mt-2 leading-relaxed opacity-60">
                                    Resignation history is disabled for this user. Only allowed actions are visible.
                                </p>
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="bg-white rounded-xl border border-dashed border-[#E2E8F0] h-64 flex flex-col items-center justify-center text-center px-6 mt-10">
                                <UserMinus size={40} className="text-slate-200 mb-4" />
                                <h3 className="text-[18px] font-bold text-[#334155] tracking-tight">No Separation History</h3>
                                <p className="text-[13px] text-[#64748B] font-medium max-w-xs mx-auto mt-2 leading-relaxed opacity-60">You currently have no active or historical exit requests on file.</p>
                            </div>
                        ) : (
                            requests.map(req => (
                                <div key={req._id} onClick={() => setSelected(req)} className="bg-white px-4 py-3 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center justify-between hover:shadow-md hover:border-[#CBD5E1] transition-all group cursor-pointer animate-in slide-in-from-left-2 duration-300">
                                    <div className="flex items-center gap-4 flex-1">
                                         <div className={clsx("w-2 h-10 rounded-full", (STAGE_STYLE[req.stage] || STAGE_STYLE['Requested']).split(' ')[0].replace('text-', 'bg-'))}></div>
                                         <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-[14px] font-bold text-[#334155] group-hover:text-[#2563EB] transition-colors uppercase truncate">{req.exitType}</h3>
                                                <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">• {req.stage}</span>
                                            </div>
                                            <p className="text-[11px] font-medium text-[#64748B] opacity-60 italic truncate">"{req.reason}"</p>
                                         </div>
                                    </div>
                                    <div className="flex items-center gap-8 shrink-0">
                                         <div className="text-right flex flex-col items-end">
                                            <span className={clsx("px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border", STATUS_STYLE[req.status])}>{req.status}</span>
                                            <span className="text-[9px] font-bold text-slate-300 mt-1 uppercase tracking-widest">{new Date(req.createdAt).toLocaleDateString()}</span>
                                         </div>
                                         <ChevronRight size={14} className="text-slate-200 group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            ) : (
                <div className="animate-in slide-in-from-right-10 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-8 pb-4 shrink-0 border-b border-[#E2E8F0]">
                         <div className="flex items-center gap-4">
                            <button onClick={() => setSelected(null)} className="w-10 h-10 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-xl text-[#64748B] hover:text-[#334155] hover:border-[#CBD5E1] transition-all shadow-sm shadow-slate-100"><ArrowLeft size={18} /></button>
                            <div className="flex flex-col">
                                <h4 className="text-[14px] font-bold text-[#334155] uppercase tracking-tight">{selected.exitType} Lifecycle</h4>
                                <p className="text-[10px] text-[#2563EB] font-bold uppercase tracking-widest">{selected.stage}</p>
                            </div>
                         </div>
                         <div className={clsx("px-5 h-9 flex items-center justify-center rounded-xl text-[10px] font-bold uppercase tracking-widest border shadow-sm", STATUS_STYLE[selected.status])}>{selected.status}</div>
                    </div>
                    <div className="grid grid-cols-12 gap-8 flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
                        <div className="col-span-12 xl:col-span-8 space-y-6">
                            <ExitStatusTracker stage={selected.stage} status={selected.status} rejectionReason={selected.rejectionReason} />
                            <NoticePeriodPanel request={selected} />
                            <StandardCard active>
                                <h5 className="text-[11px] font-bold text-[#64748B] uppercase tracking-widest mb-4">Original Request Detail</h5>
                                <p className="text-[14px] font-medium text-[#334155] leading-relaxed italic">"{selected.reason}"</p>
                                <div className="mt-6 flex items-center gap-6 pt-6 border-t border-slate-50">
                                     <div className="flex items-center gap-2"><CalendarDays size={14} className="text-[#2563EB]" /><span className="text-[12px] font-bold text-[#334155]">{new Date(selected.createdAt).toLocaleDateString()}</span></div>
                                     <div className="flex items-center gap-2"><Clock size={14} className="text-[#2563EB]" /><span className="text-[12px] font-bold text-[#334155]">LWD: {selected.lastWorkingDate ? new Date(selected.lastWorkingDate).toLocaleDateString() : 'TBD'}</span></div>
                                </div>
                            </StandardCard>
                        </div>
                        <div className="col-span-12 xl:col-span-4 space-y-6">
                            {selected.stage === 'Clearance' && <ExitClearanceForm request={selected} onUpdate={refreshSelected} />}
                            <ExitInterviewPanel request={selected} onUpdate={refreshSelected} />
                            {selected.lettersGenerated && <LetterGenerationPanel request={selected} />}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
