import React, { useState } from 'react';
import exitAPI from '../../services/exitAPI';
import toast from 'react-hot-toast';

const ExitInterviewForm = ({ request, onUpdate }) => {
    const [feedback, setFeedback] = useState(request.exitInterviewFeedback || '');
    const [finalSettlementRemarks, setFinalSettlementRemarks] = useState(request.finalSettlementRemarks || '');
    const [loading, setLoading] = useState(false);

    const handleSave = async (completeStage) => {
        try {
            setLoading(true);
            const payload = {
                exitInterviewFeedback: feedback,
                finalSettlementRemarks
            };
            
            if (completeStage) {
                payload.stage = 'Exit Completed';
            }

            await exitAPI.updateStage(request._id, payload);
            toast.success("Exit details updated successfully.");
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(error?.response?.data?.message || "Error updating exit details");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mt-4">
            <h3 className="text-lg font-semibold mb-4">Exit Interview & Final Settlement</h3>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Exit Interview Feedback</label>
                    <textarea 
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        rows="4"
                        className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Record notes from the exit interview here..."
                    ></textarea>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Final Settlement Remarks / Amount Details</label>
                    <textarea 
                        value={finalSettlementRemarks}
                        onChange={(e) => setFinalSettlementRemarks(e.target.value)}
                        rows="3"
                        className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Full & final settlement details..."
                    ></textarea>
                </div>

                <div className="flex space-x-3 pt-4">
                    <button 
                        onClick={() => handleSave(false)} 
                        disabled={loading}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                    >
                        Save Draft
                    </button>
                    {(request.stage === 'Asset Return' || request.stage === 'Notice Period') && (
                        <button 
                            onClick={() => handleSave(true)} 
                            disabled={loading || !feedback}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                            Mark Exit as Completed
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExitInterviewForm;
