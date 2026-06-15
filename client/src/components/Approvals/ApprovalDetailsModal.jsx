import React, { useState, useEffect } from 'react';
import { approvalService } from '../../services/approvalService';
import { FaTimes } from 'react-icons/fa';
import APP_CONFIG from '../../utils/appConfig';

const ApprovalDetailsModal = ({ approval, onClose, onAction, canProcess = false }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState('');

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await approvalService.getApprovalDetails(approval._id);
        setDetails(res.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [approval]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">
            Review {approval.entityModel}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FaTimes size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center p-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div>
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Request Details</h3>
                <p className="text-sm"><strong>Requester:</strong> {details?.requesterId?.firstName} {details?.requesterId?.lastName}</p>
                <p className="text-sm"><strong>Status:</strong> {details?.status}</p>
                <p className="text-sm"><strong>Current Level:</strong> {details?.currentLevel}</p>
                
                {approval.entityModel === 'GeneratedLetter' && details?.entity ? (
                  <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="space-y-1">
                      <h4 className="font-bold text-indigo-900 text-sm">Offer Letter Document</h4>
                      <p className="text-xs text-indigo-700">Reference: {details.entity.offerRefCode || details.entity.generatedVariables?.refNo || 'N/A'}</p>
                    </div>
                    <a
                      href={`${APP_CONFIG.HRMS_API_ROOT || 'http://localhost:5006'}/api/public/letters/${details.entity._id}/view-pdf?tenantId=${details.tenantId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-md transition-colors text-center"
                    >
                      View PDF Document
                    </a>
                  </div>
                ) : details?.entity ? (
                  <div className="mt-4 p-4 bg-white rounded border">
                    <h4 className="font-semibold text-sm mb-2 text-gray-700">Entity Payload Preview</h4>
                    <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(details.entity, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </div>

              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Approval Timeline</h3>
                <div className="relative border-l-2 border-gray-200 ml-3 space-y-4">
                  {details?.timeline?.map((log, idx) => (
                    <div key={idx} className="relative pl-6">
                      <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5 border-2 border-white"></div>
                      <p className="text-sm font-medium text-gray-800">{log.actionBy?.firstName} {log.actionBy?.lastName}</p>
                      <p className="text-xs text-gray-500 font-semibold">{log.action}</p>
                      {log.comments && <p className="text-sm text-gray-600 mt-1 italic">"{log.comments}"</p>}
                      <p className="text-xs text-gray-400 mt-1">{new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                  {(!details?.timeline || details.timeline.length === 0) && (
                    <p className="text-sm text-gray-500 pl-4">No timeline events found.</p>
                  )}
                </div>
              </div>

              {canProcess ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Comments (Required for rejection)</label>
                  <textarea
                    className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    rows="3"
                    placeholder="Add your comments here..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                  ></textarea>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                  You have view access for this approval. Approve / Reject access is required to take action.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3">
          {canProcess ? (
            <>
              <button
                onClick={() => onAction(approval._id, 'REQUESTED_CHANGES', comments)}
                className="px-4 py-2 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 font-medium rounded-lg transition-colors text-sm"
              >
                Request Changes
              </button>
              <button
                onClick={() => onAction(approval._id, 'REJECTED', comments)}
                className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 font-medium rounded-lg transition-colors text-sm"
              >
                Reject
              </button>
              <button
                onClick={() => onAction(approval._id, 'APPROVED', comments)}
                className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 font-medium rounded-lg transition-colors shadow-sm"
              >
                Approve
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 text-white hover:bg-slate-900 font-medium rounded-lg transition-colors text-sm"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovalDetailsModal;
