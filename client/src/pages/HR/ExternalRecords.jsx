import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { notification } from '../../utils/antdGlobal';
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, Eye } from 'lucide-react';
import dayjs from 'dayjs';
import EmployeeProfileView from '../../components/EmployeeProfileView';

export default function ExternalRecords() {
    const navigate = useNavigate();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const loadRecords = async () => {
        try {
            setLoading(true);
            const res = await api.get('/recruitment/candidate-documents/records');
            if (res.data.success) {
                setRecords(res.data.data);
            }
        } catch (err) {
            notification.error({ message: 'Error', description: 'Failed to load external records' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
    }, []);

    const handleView = async (record) => {
        setLoadingDetail(true);
        try {
            const res = await api.get(`/recruitment/candidate-documents/records/${record._id}`);
            if (res.data.success) {
                setSelectedRecord(res.data.data);
            } else {
                setSelectedRecord(record);
            }
        } catch (err) {
            notification.error({ message: 'Error', description: 'Failed to load candidate details' });
            setSelectedRecord(record);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleAction = async (id, action) => {
        try {
            let endpoint = '';
            if (action === 'Approve') endpoint = `/recruitment/candidate-documents/approve/${id}`;
            else if (action === 'Reject') endpoint = `/recruitment/candidate-documents/reject/${id}`;
            else if (action === 'Request Changes') endpoint = `/recruitment/candidate-documents/request-changes/${id}`;

            const res = await api.post(endpoint);
            if (res.data.success) {
                notification.success({ message: 'Success', description: `Record updated successfully` });
                loadRecords();
            }
        } catch (err) {
            notification.error({ message: 'Error', description: err.response?.data?.message || 'Failed to update record' });
        }
    };

    return (
        <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate('/hr/employees')} className="p-2 bg-white rounded-lg border shadow-sm hover:bg-slate-50">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">External Records</h1>
                    <p className="text-slate-500 text-sm">Review candidate documents and pre-onboarding submissions</p>
                </div>
            </div>

            {selectedRecord ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                        <button 
                            onClick={() => setSelectedRecord(null)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-100 transition-colors"
                        >
                            <ArrowLeft size={16} /> Back to List
                        </button>
                        <div className="flex gap-2">
                            {selectedRecord.status === 'Submitted' && (
                                <>
                                    <button onClick={() => { handleAction(selectedRecord._id, 'Approve'); setSelectedRecord(null); }} className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2">
                                        <CheckCircle size={16} /> Approve & Convert
                                    </button>
                                    <button onClick={() => { handleAction(selectedRecord._id, 'Request Changes'); setSelectedRecord(null); }} className="px-4 py-2 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors flex items-center gap-2">
                                        <RefreshCw size={16} /> Request Changes
                                    </button>
                                    <button onClick={() => { handleAction(selectedRecord._id, 'Reject'); setSelectedRecord(null); }} className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-2">
                                        <XCircle size={16} /> Reject
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="bg-slate-50/50">
                        <EmployeeProfileView employee={selectedRecord.rawEmployeePayload || selectedRecord} />
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Candidate</th>
                                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Job Title</th>
                                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Requested On</th>
                                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-400">Loading records...</td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-400">No external records found.</td>
                                </tr>
                            ) : (
                                records.map(record => (
                                    <tr key={record._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <p className="font-bold text-slate-800">{record.candidateId?.name || 'Unknown'}</p>
                                            <p className="text-xs text-slate-500">{record.candidateId?.email || ''}</p>
                                        </td>
                                        <td className="p-4 text-sm text-slate-600">
                                            {record.jobId?.jobTitle || 'N/A'}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md ${
                                                record.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                                record.status === 'Submitted' ? 'bg-blue-100 text-blue-700' :
                                                record.status === 'Revision_Requested' ? 'bg-orange-100 text-orange-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {record.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-slate-600">
                                            {dayjs(record.createdAt).format('DD MMM YYYY')}
                                        </td>
                                        <td className="p-4 text-right flex items-center justify-end gap-2">
                                            {record.status === 'Submitted' && (
                                                <>
                                                    <button onClick={() => handleAction(record._id, 'Approve')} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Approve & Convert to Draft">
                                                        <CheckCircle size={18} />
                                                    </button>
                                                    <button onClick={() => handleAction(record._id, 'Request Changes')} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Request Changes">
                                                        <RefreshCw size={18} />
                                                    </button>
                                                    <button onClick={() => handleAction(record._id, 'Reject')} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Reject">
                                                        <XCircle size={18} />
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => handleView(record)}
                                                disabled={loadingDetail}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                                title="View Candidate Details"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
