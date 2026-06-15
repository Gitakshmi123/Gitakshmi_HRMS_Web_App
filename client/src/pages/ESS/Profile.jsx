import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import EmployeeProfileView from '../../components/EmployeeProfileView';
import { RefreshCw } from 'lucide-react';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        const [profileRes, balanceRes] = await Promise.all([
          api.get('/employee/profile'),
          api.get('/employee/leaves/balances').catch(() => ({ data: { balances: [] } }))
        ]);
        setProfile(profileRes.data);
        setBalances(balanceRes.data?.balances || []);
      } catch (err) {
        console.error("Failed to fetch profile", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center p-8 text-center bg-[#F8FAFC]">
        <RefreshCw size={32} className="animate-spin text-blue-500 mb-4" />
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Preparing your dossier...</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#F8FAFC]">
      <EmployeeProfileView profile={profile} balances={balances} />
    </div>
  );
}
