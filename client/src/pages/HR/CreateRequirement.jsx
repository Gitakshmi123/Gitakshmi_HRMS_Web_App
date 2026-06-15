import React from 'react';
import { useNavigate } from 'react-router-dom';
import RequirementForm from '../../components/RequirementForm';
import { Plus, XCircle } from 'lucide-react';
import usePagePermissions from '../../hooks/usePagePermissions';

export default function CreateRequirement() {
    const navigate = useNavigate();
    const { canCreate } = usePagePermissions('hiring.jobList');

    if (!canCreate) {
        return (
            <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] border border-slate-100 shadow-sm text-center">
                <div className="w-20 h-20 bg-rose-50 rounded-[2.5rem] flex items-center justify-center text-rose-500 mb-6">
                    <XCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Access Denied</h3>
                <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto">You do not have permission to create new requirements.</p>
                <button onClick={() => navigate('/hr/requirements')} className="mt-6 px-6 py-2 bg-[#4F46E5] text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all">Back to List</button>
            </div>
        );
    }

    const handleSuccess = () => {
        navigate('/hr/requirements');
    };

    const handleClose = () => {
        navigate('/hr/requirements');
    };

    return (
        <div className="w-full min-h-0 bg-slate-50 p-0 font-sans selection:bg-indigo-100 selection:text-indigo-600">
            <div className="w-full min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Form Card — no min-h-screen: avoids forced scroll when content fits below HR header */}
                <div className="bg-white overflow-hidden w-full min-h-0">
                    <RequirementForm
                        isModal={false}
                        onSuccess={handleSuccess}
                        onClose={handleClose}
                    />
                </div>
            </div>
        </div>
    );
}
