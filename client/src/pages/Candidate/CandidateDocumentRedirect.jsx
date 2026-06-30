import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { FileText, AlertCircle } from 'lucide-react';

export default function CandidateDocumentRedirect() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const checkDocuments = async () => {
            try {
                const res = await api.get(`/candidate/dashboard?_t=${Date.now()}`);
                if (res.data && res.data.applications) {
                    const appsWithDocs = res.data.applications.filter(
                        app => app.documentRequestToken
                    );
                    
                    if (appsWithDocs.length > 0) {
                        // Priority: Pending/Revision_Requested first, then anything else
                        const actionNeeded = appsWithDocs.find(a => 
                            ['Pending', 'Revision_Requested', 'Draft'].includes(a.documentRequestStatus)
                        );
                        
                        const targetApp = actionNeeded || appsWithDocs[0];
                        navigate(`/candidate/document-upload/${targetApp.documentRequestToken}`);
                    } else {
                        setError("You do not have any active document requests.");
                    }
                }
            } catch (err) {
                console.error(err);
                setError("Failed to check document status.");
            } finally {
                setLoading(false);
            }
        };
        checkDocuments();
    }, [navigate]);

    if (loading) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Checking Document Status...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[60vh] flex items-center justify-center animate-in fade-in zoom-in duration-300">
            <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 text-center max-w-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="bg-slate-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <FileText size={32} className="text-slate-300" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">No Document Requests</h3>
                <p className="text-slate-500 font-medium mb-8">
                    {error || "You do not currently have any active requests to upload onboarding documents."}
                </p>
                <button
                    onClick={() => navigate('/candidate/dashboard')}
                    className="bg-slate-900 text-white px-10 py-3.5 rounded-full font-bold text-sm uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg"
                >
                    Return to Dashboard
                </button>
            </div>
        </div>
    );
}
