import React, { useState } from 'react';
import { MessageSquare, Send, Star, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import exitAPI from '../../services/exitAPI';
import toast from 'react-hot-toast';

/**
 * Employee exit interview panel.
 * Shown to the employee when stage === 'Exit Interview' and interview not yet completed.
 */
export default function ExitInterviewPanel({ request, onUpdate }) {
    const [form, setForm] = useState({
        reasonForLeaving:   '',
        companyFeedback:    '',
        managementFeedback: '',
        suggestions:        '',
        jobSatisfaction:    0,
        wouldRecommend:     null
    });
    const [submitting, setSubmitting] = useState(false);

    const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.reasonForLeaving.trim()) {
            toast.error('Please provide your reason for leaving.');
            return;
        }
        if (form.jobSatisfaction === 0) {
            toast.error('Please rate your job satisfaction.');
            return;
        }
        try {
            setSubmitting(true);
            await exitAPI.submitInterview(request._id, form);
            toast.success('Exit interview submitted. Thank you for your feedback!');
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to submit interview.');
        } finally {
            setSubmitting(false);
        }
    };

    // Already completed
    if (request.exitInterviewCompleted) {
        return (
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-200 dark:border-blue-800 p-6">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
                        <Check size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="font-bold text-blue-800 dark:text-blue-200">Exit Interview Submitted</h3>
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                            Thank you for your feedback. HR will review it and complete your offboarding.
                        </p>
                        {request.exitInterview?.submittedAt && (
                            <p className="text-xs text-blue-400 mt-2">
                                Submitted on {new Date(request.exitInterview.submittedAt).toLocaleDateString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                })}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Not in interview stage
    if (request.stage !== 'Exit Interview') return null;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <MessageSquare size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-base">Exit Interview</h3>
                        <p className="text-blue-100 text-xs mt-0.5">
                            Your feedback helps us improve. All responses are confidential.
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Reason for leaving */}
                <FormField
                    label="1. What is your primary reason for leaving?"
                    required
                >
                    <textarea
                        rows={3}
                        value={form.reasonForLeaving}
                        onChange={e => set('reasonForLeaving', e.target.value)}
                        placeholder="Please share your main reason for resignation..."
                        className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-400 outline-none resize-none"
                    />
                </FormField>

                {/* Job satisfaction rating */}
                <FormField
                    label="2. How would you rate your overall job satisfaction?"
                    required
                >
                    <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map(n => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => set('jobSatisfaction', n)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all text-lg
                                    ${form.jobSatisfaction >= n
                                        ? 'bg-amber-400 text-white scale-110 shadow-md shadow-amber-400/30'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-amber-50'
                                    }`}
                            >
                                <Star size={18} fill={form.jobSatisfaction >= n ? 'currentColor' : 'none'} />
                            </button>
                        ))}
                        <span className="ml-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
                            {form.jobSatisfaction > 0
                                ? ['', 'Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'][form.jobSatisfaction]
                                : 'Select rating'}
                        </span>
                    </div>
                </FormField>

                {/* Company feedback */}
                <FormField label="3. How was your overall experience at the company?">
                    <textarea
                        rows={3}
                        value={form.companyFeedback}
                        onChange={e => set('companyFeedback', e.target.value)}
                        placeholder="Share your experience — work culture, environment, growth opportunities..."
                        className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-400 outline-none resize-none"
                    />
                </FormField>

                {/* Management feedback */}
                <FormField label="4. How would you rate the management and leadership?">
                    <textarea
                        rows={3}
                        value={form.managementFeedback}
                        onChange={e => set('managementFeedback', e.target.value)}
                        placeholder="Feedback about your manager, team, leadership style..."
                        className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-400 outline-none resize-none"
                    />
                </FormField>

                {/* Suggestions */}
                <FormField label="5. What could the company improve?">
                    <textarea
                        rows={3}
                        value={form.suggestions}
                        onChange={e => set('suggestions', e.target.value)}
                        placeholder="Suggestions for improving processes, culture, benefits..."
                        className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-400 outline-none resize-none"
                    />
                </FormField>

                {/* Would recommend */}
                <FormField label="6. Would you recommend this company to others?">
                    <div className="flex gap-3">
                        <RecommendBtn
                            active={form.wouldRecommend === true}
                            onClick={() => set('wouldRecommend', true)}
                            icon={<ThumbsUp size={16} />}
                            label="Yes, definitely"
                            color="emerald"
                        />
                        <RecommendBtn
                            active={form.wouldRecommend === false}
                            onClick={() => set('wouldRecommend', false)}
                            icon={<ThumbsDown size={16} />}
                            label="Not really"
                            color="rose"
                        />
                    </div>
                </FormField>

                {/* Submit */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl shadow-sm shadow-blue-500/30 disabled:opacity-50 transition-colors"
                    >
                        <Send size={15} />
                        {submitting ? 'Submitting...' : 'Submit Exit Interview'}
                    </button>
                    <p className="text-[11px] text-slate-400 mt-2">
                        Your responses are confidential and will only be used to improve the organization.
                    </p>
                </div>
            </form>
        </div>
    );
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function FormField({ label, required, children }) {
    return (
        <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                {label}
                {required && <span className="text-rose-500 ml-1">*</span>}
            </label>
            {children}
        </div>
    );
}

function RecommendBtn({ active, onClick, icon, label, color }) {
    const styles = {
        emerald: active
            ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/25'
            : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700 hover:border-emerald-300 hover:text-emerald-600',
        rose: active
            ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/25'
            : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700 hover:border-rose-300 hover:text-rose-600'
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${styles[color]}`}
        >
            {icon} {label}
        </button>
    );
}
