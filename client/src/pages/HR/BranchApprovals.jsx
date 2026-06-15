import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Check, 
  X, 
  Clock, 
  Loader2,
  Building,
  AlertCircle
} from 'lucide-react';
import api from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';

export default function BranchApprovals() {
  const [pendingBranches, setPendingBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingBranches();
  }, []);

  const fetchPendingBranches = async () => {
    try {
      setLoading(true);
      const response = await api.get('/branches/pending');
      setPendingBranches(response.data?.items || []);
    } catch (err) {
      console.error('Error fetching pending branches:', err);
      showToast('error', 'Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      const endpoint = action === 'approve' ? `/branches/approve/${id}` : `/branches/reject/${id}`;
      const response = await api.put(endpoint);
      
      if (response.data.success) {
        showToast('success', `Branch ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
        setPendingBranches(prev => prev.filter(b => b._id !== id));
      }
    } catch (err) {
      console.error(`Error ${action}ing branch:`, err);
      showToast('error', `Failed to ${action} branch`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium">Loading pending requests...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Clock className="text-indigo-600" size={32} />
            Branch Approvals
          </h1>
          <p className="text-slate-500 mt-1 font-medium italic">Review and manage branch registration requests from sub-companies.</p>
        </div>
        <div className="bg-indigo-50 px-4 py-2 rounded-xl text-indigo-700 font-bold text-sm border border-indigo-100 flex items-center gap-2">
          <span className="h-2 w-2 bg-indigo-600 rounded-full animate-pulse" />
          {pendingBranches.length} Pending {pendingBranches.length === 1 ? 'Request' : 'Requests'}
        </div>
      </div>

      {pendingBranches.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
          <div className="h-20 w-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6">
            <Building size={48} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Workspace All Clear!</h3>
          <p className="text-slate-500 max-w-md mx-auto font-medium">There are no pending branch registration requests to review at this moment.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {pendingBranches.map((branch) => (
            <div 
              key={branch._id} 
              className="group bg-white rounded-3xl border border-slate-100 p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-2xl hover:shadow-indigo-100 transition-all duration-500 hover:-translate-y-1"
            >
              <div className="flex items-center gap-6 w-full">
                <div className="h-16 w-16 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold text-2xl shadow-lg shadow-indigo-100 ring-4 ring-indigo-50">
                  {branch.name?.[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">{branch.name}</h3>
                    <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2 py-1 rounded-full border border-amber-100 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={10} /> PENDING
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                      <Building2 size={14} className="text-indigo-500" />
                      <span className="font-bold text-slate-700">{branch.companyId?.companyName || branch.companyId?.name || 'Unknown Sub-Company'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                      <MapPin size={14} className="text-indigo-500" />
                      {branch.city}, {branch.state}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400 italic flex items-center gap-2">
                    <AlertCircle size={10} /> {branch.address}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0 border-t md:border-t-0 pt-4 md:pt-0">
                <button 
                  onClick={() => handleAction(branch._id, 'reject')}
                  className="flex-1 md:flex-none h-12 px-6 rounded-2xl border-2 border-rose-100 text-rose-600 font-bold text-sm hover:bg-rose-50 hover:border-rose-200 transition-all flex items-center justify-center gap-2"
                >
                  <X size={18} /> Reject
                </button>
                <button 
                  onClick={() => handleAction(branch._id, 'approve')}
                  className="flex-1 md:flex-none h-12 px-8 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={18} /> Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
