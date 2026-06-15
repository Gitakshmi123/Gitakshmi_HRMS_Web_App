import React, { useState, useEffect } from 'react';
import { Modal, Rate, Input, Select, Button, Spin, Checkbox, Slider } from 'antd';
import { message } from '../../../utils/antdGlobal';
import { Star, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import api from '../../../utils/api';

const { TextArea } = Input;
const { Option } = Select;

export default function StageFeedbackModal({ visible, onClose, applicant, stage, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [template, setTemplate] = useState(null);
    const [responses, setResponses] = useState({}); // { label: value }
    const [comments, setComments] = useState("");
    const [overallRating, setOverallRating] = useState(0);

    useEffect(() => {
        if (visible && stage) {
            loadForm();
        }
    }, [visible, stage]);

    const loadForm = async () => {
        setLoading(true);
        setTemplate(null);
        setResponses({});
        setComments("");
        setOverallRating(0);

        try {
            // 1. Check for linked Feedback Template
            if (stage?.feedbackFormId) {
                try {
                    const res = await api.get(`/feedback/template/${stage.feedbackFormId}`);
                    if (res.data) {
                        setTemplate(res.data);
                        // Initialize responses based on criteria
                        const init = {};
                        res.data.criteria.forEach(c => {
                            if (c.type === 'rating') init[c.label] = 0;
                            else if (c.type === 'yesno') init[c.label] = 'No';
                            else init[c.label] = '';
                        });
                        setResponses(init);
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.warn("Template fetch failed", e);
                }
            }

            // 2. Fallback to simple criteria
            if (stage?.evaluationCriteria && stage.evaluationCriteria.length > 0) {
                const criteria = stage.evaluationCriteria.map(c => ({
                    label: c,
                    type: 'rating',
                    required: true
                }));
                setTemplate({
                    templateName: `${stage.stageName} Evaluation`,
                    criteria,
                    isSimple: true
                });
                const init = {};
                criteria.forEach(c => init[c.label] = 0);
                setResponses(init);
            } else {
                // 3. Generic Fallback
                setTemplate({
                    templateName: `Review for ${stage?.stageName}`,
                    criteria: [],
                    isGeneric: true
                });
            }
        } catch (err) {
            console.error(err);
            message.error("Failed to load feedback form");
        } finally {
            setLoading(false);
        }
    };

    const handleResponseChange = (label, value) => {
        setResponses(prev => ({ ...prev, [label]: value }));
    };

    const handleSubmit = async () => {
        // Validation
        if (template?.criteria) {
            for (const c of template.criteria) {
                if (c.required && !responses[c.label] && responses[c.label] !== 0) {
                    message.error(`Please complete: ${c.label}`);
                    return;
                }
            }
        }

        setLoading(true);
        try {
            // Transform responses to array for backend
            const responseList = Object.entries(responses).map(([label, value]) => ({
                label,
                type: template.criteria.find(c => c.label === label)?.type || 'rating',
                value
            }));

            // Auto-calculate overall rating if not generic
            let calculatedRating = overallRating;
            if (!template.isGeneric) {
                const ratings = responseList.filter(r => r.type === 'rating').map(r => r.value);
                if (ratings.length > 0) {
                    calculatedRating = ratings.reduce((a, b) => a + Number(b), 0) / ratings.length;
                }
            }

            const payload = {
                candidateId: applicant._id,
                requirementId: applicant.requirementId?._id || applicant.requirementId,
                stageId: stage._id || stage.id || stage.stageId, // Robust ID check
                feedbackTemplateId: stage.feedbackFormId, // Might be undefined
                responses: responseList,
                comments,
                overallRating: calculatedRating
            };

            await api.post('/feedback/submit', payload);
            message.success("Feedback Submitted");

            if (onSuccess) onSuccess({
                rating: calculatedRating,
                feedback: comments
            });
            onClose();
        } catch (err) {
            message.error("Submission Failed: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal
            open={visible}
            onCancel={onClose}
            footer={null}
            title={null}
            className="rounded-2xl overflow-hidden"
            width={600}
            closeIcon={<div className="p-2 bg-slate-50 rounded-full hover:bg-slate-100"><X size={18} /></div>}
        >
            <div className="pt-2">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">{template?.templateName || 'Feedback'}</h2>
                        <p className="text-sm font-bold text-slate-400">Evaluate {applicant?.name}</p>
                    </div>
                </div>

                {loading ? (
                    <div className="h-40 flex items-center justify-center">
                        <Spin size="large" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {template?.criteria?.map(field => (
                            <div key={field.label} className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-xs font-bold text-slate-500 uppercase">
                                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                                    </label>
                                    {field.type === 'rating' && (
                                        <span className="text-xs font-black text-indigo-600">{responses[field.label] || 0}/5</span>
                                    )}
                                </div>

                                {field.type === 'rating' && (
                                    <Rate value={responses[field.label]} onChange={v => handleResponseChange(field.label, v)} />
                                )}
                                {field.type === 'text' && (
                                    <Input value={responses[field.label]} onChange={e => handleResponseChange(field.label, e.target.value)} />
                                )}
                                {field.type === 'yesno' && (
                                    <Select
                                        value={responses[field.label]}
                                        onChange={v => handleResponseChange(field.label, v)}
                                        className="w-full"
                                    >
                                        <Option value="Yes">Yes</Option>
                                        <Option value="No">No</Option>
                                    </Select>
                                )}
                            </div>
                        ))}

                        {template?.isGeneric && (
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Overall Rating</label>
                                <Rate value={overallRating} onChange={setOverallRating} allowHalf />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Additional Comments</label>
                            <TextArea
                                rows={4}
                                value={comments}
                                onChange={e => setComments(e.target.value)}
                                placeholder="Summary of evaluation..."
                                className="resize-none"
                            />
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex gap-3">
                            <Button size="large" onClick={onClose} block className="font-bold border-0 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl h-12">
                                Cancel
                            </Button>
                            <Button size="large" type="primary" onClick={handleSubmit} block className="font-bold bg-indigo-600 hover:bg-indigo-700 rounded-xl h-12 shadow-lg shadow-indigo-200">
                                Submit Feedback
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
