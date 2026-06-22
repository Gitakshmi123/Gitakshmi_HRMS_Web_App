import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import api from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';
import EmployeeForm from '../HR/EmployeeForm';

export default function CandidateDocumentUpload() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const tenantId = searchParams.get('tenantId');
    if (tenantId) localStorage.setItem('tenantId', tenantId);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function loadRequest() {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/candidate/document-upload/${token}`);
        if (!cancelled) setData(res.data?.data || null);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Document upload link is invalid or expired.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (token) loadRequest();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-500">
        Loading employment profile...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-sm">
          <FileText className="mx-auto mb-4 text-rose-500" size={32} />
          <h1 className="text-xl font-black text-slate-900">Unable to Open Profile</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Employment Profile</p>
            <h1 className="mt-1 text-xl font-black text-slate-900">{data?.applicant?.name || 'Candidate'}</h1>
          </div>
          <div className="text-right text-xs font-bold text-slate-500">
            Expires {data?.request?.expiresAt ? new Date(data.request.expiresAt).toLocaleDateString() : '-'}
          </div>
        </div>
      </div>
      <div className="mx-auto h-[calc(100vh-73px)] max-w-[1600px] p-4">
        <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <EmployeeForm
            employee={data?.employee || null}
            externalMode
            externalToken={token}
            onClose={() => {
              showToast('success', 'Submitted', 'Your profile has been sent to HR for approval.');
              navigate('/candidate/applications', { replace: true });
            }}
          />
        </div>
      </div>
    </div>
  );
}
