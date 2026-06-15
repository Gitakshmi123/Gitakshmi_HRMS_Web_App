import React, { useState } from 'react';
import { ShieldCheck, Send, Check, ClipboardList } from 'lucide-react';
import exitAPI from '../../services/exitAPI';
import toast from 'react-hot-toast';

/**
 * Employee exit clearance / handover form.
 * Submitted by the employee during the Clearance stage.
 */
export default function ExitClearanceForm({ request, onUpdate }) {
    const [form, setForm] = useState({
        handoverTo:             request.clearanceForm?.handoverTo             || '',
        pendingTasks:           request.clearanceForm?.pendingTasks           || '',
        projectsStatus:         request.clearanceForm?.projectsStatus         || '',
        knowledgeTransferNotes: request.clearanceForm?.knowledgeTransferNotes || '',
        systemCredentials:      request.clearanceForm?.systemCredentials      || '',
        otherNotes:             request.clearanceForm?.otherNotes             || '',
    });
    const [submitting, setSubmitting] = useState(false);

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.handoverTo.trim()) {
            toast.error('Please specify who you are handing over your responsibilities to.');
            return;
        }
        try {
            setSubmitting(true);
            await exitAPI.submitClearanceForm(request._id, form);
            toast.success('Clearance form submitted successfully!');
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to submit form.');
        } finally {
            setSubmitting(false);
        }
    };

    if (request.clearanceFormSubmitted) {
        return (
            <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-6">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white flex-shrink-0 shadow-md shadow-emerald-500/25">
                        <Check size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="font-bold text-emerald-800 dark:text-emerald-200">Clearance Form Submitted</h3>
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                            Your handover details have been recorded. HR will complete the clearance process.
                        </p>
                        {request.clearanceForm?.handoverTo && (
                            <p className="text-xs text-emerald-500 mt-2">Handover to: <span className="font-semibold">{request.clearanceForm.handoverTo}</span></p>
                        )}
                        {request.clearanceForm?.submittedAt && (
                            <p className="text-xs text-emerald-400 mt-1">
                                Submitted on {new Date(request.clearanceForm.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (request.stage !== 'Clearance') return null;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-orange-200 dark:border-orange-800 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <ClipboardList size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-base">Exit Clearance Form</h3>
                        <p className="text-orange-100 text-xs mt-0.5">
                            Complete this handover form before your last working day.
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Handover to */}
                <FormField label="1. Handover To" required>
                    <input
                        type="text"
                        value={form.handoverTo}
                        onChange={e => set('handoverTo', e.target.value)}
                        placeholder="Name and designation of the person receiving handover"
                        className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-400 outline-none"
                    />
                </FormField>

                {/* Pending tasks */}
                <FormField label="2. Pending Tasks / Assignments">
                    <textarea
                        rows={3}
                        value={form.pendingTasks}
                        onChange={e => set('pendingTasks', e.target.value)}
                        placeholder="List any open tasks, tickets, or assignments that need to be completed or handed over..."
                        className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-400 outline-none resize-none"
                    />
                </FormField>

                {/* Project status */}
                <FormField label="3. Current Projects Status">
                    <textarea
                        rows={3}
                        value={form.projectsStatus}
                        onChange={e => set('projectsStatus', e.target.value)}
                        placeholder="Status of all current projects, milestones, and expected timelines..."
                        className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-400 outline-none resize-none"
                    />
                </FormField>

                {/* Knowledge transfer */}
                <FormField label="4. Knowledge Transfer Notes">
                    <textarea
                        rows={4}
                        value={form.knowledgeTransferNotes}
                        onChange={e => set('knowledgeTransferNotes', e.target.value)}
                        placeholder="Important processes, system knowledge, documentation locations, key contacts, tribal knowledge..."
                        className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-400 outline-none resize-none"
                    />
                </FormField>

                {/* System credentials */}
                <FormField label="5. System Access & Credentials Handover">
                    <textarea
                        rows={2}
                        value={form.systemCredentials}
                        onChange={e => set('systemCredentials', e.target.value)}
                        placeholder="Shared accounts, credentials to be handed over, access details (avoid actual passwords here)..."
                        className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-400 outline-none resize-none"
                    />
                </FormField>

                {/* Other notes */}
                <FormField label="6. Any Other Information">
                    <textarea
                        rows={2}
                        value={form.otherNotes}
                        onChange={e => set('otherNotes', e.target.value)}
                        placeholder="Anything else the team or HR should know..."
                        className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-400 outline-none resize-none"
                    />
                </FormField>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl shadow-sm shadow-orange-500/30 disabled:opacity-50 transition-colors"
                    >
                        <Send size={15} />
                        {submitting ? 'Submitting...' : 'Submit Clearance Form'}
                    </button>
                    <p className="text-[11px] text-slate-400 mt-2">
                        Once submitted, HR will review and complete the clearance process.
                    </p>
                </div>
            </form>
        </div>
    );
}

function FormField({ label, required, children }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            {children}
        </div>
    );
}
