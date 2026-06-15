import React, { useState, useEffect, useContext } from 'react';
import api from '../../utils/api';
import { AuthContext } from '../../context/AuthContext';
import {
  X,
  Building2,
  Mail,
  User,
  Phone,
  MapPin,
  UploadCloud,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function CompanyForm({ company, onClose }) {
  const { user } = useContext(AuthContext);

  // BASIC FIELDS
  const [name, setName] = useState(company?.companyName || company?.name || '');
  const [primaryEmail, setPrimaryEmail] = useState((company?.companyEmail || company?.meta?.primaryEmail || '').toLowerCase());
  const [ownerName, setOwnerName] = useState(company?.ownerName || company?.meta?.ownerName || '');
  const [adminPassword, setAdminPassword] = useState(company?.meta?.adminPassword || '');
  const [phone, setPhone] = useState((company?.phone || company?.meta?.phone || '').replace(/\D/g, ''));
  const [address, setAddress] = useState(company?.meta?.address || '');
  const [logo, setLogo] = useState(company?.logo || company?.meta?.logo || '');

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // =============================
  // NEW EMPLOYEE CODE SETTINGS
  // =============================
  const [companyCode, setCompanyCode] = useState(company?.code || '');
  const [empFormat, setEmpFormat] = useState(company?.meta?.empCodeFormat || 'COMP_DEPT_NUM');
  const [empDigits, setEmpDigits] = useState(company?.meta?.empCodeDigits || 3);
  const [empAllowOverride, setEmpAllowOverride] = useState(company?.meta?.empCodeAllowOverride || false);

  // LOAD COMPANY INTO FORM
  useEffect(() => {
    setName(company?.companyName || company?.name || '');
    setPrimaryEmail((company?.companyEmail || company?.meta?.primaryEmail || '').toLowerCase());
    setOwnerName(company?.ownerName || company?.meta?.ownerName || '');
    setAdminPassword(company?.meta?.adminPassword || '');
    setPhone((company?.phone || company?.meta?.phone || '').replace(/\D/g, ''));
    setAddress(company?.meta?.address || '');
    setLogo(company?.logo || company?.meta?.logo || '');

    // new fields
    setCompanyCode(company?.code || '');
    setEmpFormat(company?.meta?.empCodeFormat || 'COMP_DEPT_NUM');
    setEmpDigits(company?.meta?.empCodeDigits || 3);
    setEmpAllowOverride(company?.meta?.empCodeAllowOverride || false);

  }, [company]);

  // PREFILL ON CREATE
  useEffect(() => {
    if (!company) {
      if (user?.email) setPrimaryEmail(user.email);

      if (!company?.meta?.adminPassword) {
        const gen = () => Math.random().toString(36).slice(-8);
        setAdminPassword(gen());
      }
    }
  }, [company, user]);

  // =============================
  // SUBMIT FORM
  // =============================
  async function submit(e) {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name,
        companyName: name,
        companyEmail: primaryEmail,
        ownerName,
        phone,
        logo,
        code: companyCode || undefined, // NEW → company prefix (undefined if empty)
        meta: {
          primaryEmail,
          ownerName,
          adminPassword,
          phone,
          address,
          logo,

          // EMPLOYEE CODE SETTINGS
          empCodeFormat: empFormat,
          empCodeDigits: empDigits,
          empCodeAllowOverride: empAllowOverride
        }
      };

      let _res;
      if (company) {
        _res = await api.put(`/tenants/${company._id}`, payload);
      } else {
        _res = await api.post('/tenants', payload);
      }

      onClose();
    } catch (err) {
      console.error('Save failed:', err);
      const msg = err?.response?.data?.error || err.message;
      alert("Save failed: " + msg);
    } finally {
      setSaving(false);
    }
  }

  // =============================
  // UI FORM START
  // =============================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <form
        onSubmit={submit}
        className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl ring-1 ring-slate-900/5 relative"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 flex items-center justify-between p-8 rounded-t-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <Building2 size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
                {company ? 'Configure Organization' : 'Register New Organization'}
              </h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{company ? 'Modify Entity Details' : 'Create Tenant Profile'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Core Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Company Name</label>
              <div className="relative group">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold text-slate-700 transition-all"
                  placeholder="Enter organization name"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Company Code (Short ID)</label>
              <div className="relative group">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input
                  value={companyCode}
                  onChange={e => setCompanyCode(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold text-slate-700 transition-all uppercase"
                  placeholder="e.g. COMP01 (Auto-generated if empty)"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Lead Contact (Owner)</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input
                  required
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold text-slate-700 transition-all"
                  placeholder="Administrator name"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Secure Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input
                  required
                  type="email"
                  value={primaryEmail}
                  onChange={e => setPrimaryEmail(String(e.target.value || '').toLowerCase())}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold text-slate-700 transition-all"
                  placeholder="admin@company.com"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input
                  value={phone}
                  onChange={e => setPhone(String(e.target.value || '').replace(/\D/g, ''))}
                  maxLength={15}
                  inputMode="numeric"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold text-slate-700 transition-all"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="p-6 bg-slate-50/50 rounded-xl border border-slate-100 border-dashed">
            <div className="space-y-4 max-w-md mx-auto">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Access Key (Password)</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-700"
                >
                  {showPassword ? 'Hide Key' : 'Reveal Key'}
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold text-slate-700 transition-all shadow-sm"
                  placeholder="Secure Access Key"
                />
              </div>
            </div>
          </div>

          {/* Address & Logo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Physical Address</label>
              <div className="relative group h-full">
                <MapPin className="absolute left-4 top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <textarea
                  rows={4}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold text-slate-700 transition-all resize-none"
                  placeholder="Corporate headquarters..."
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Brand Identity</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-white hover:border-emerald-300 transition-all cursor-pointer relative group">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const fd = new FormData();
                      fd.append('file', file);
                      const res = await api.post('/uploads/logo', fd);
                      if (res.data?.url) setLogo(res.data.url);
                    } catch {
                      alert('Logo upload failed');
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
                {uploading ? (
                  <div className="animate-spin w-8 h-8 border-4 border-emerald-100 border-t-emerald-500 rounded-full"></div>
                ) : logo ? (
                  <img
                    src={logo.startsWith('/') ? logo : logo}
                    alt="logo"
                    className="h-20 object-contain drop-shadow-md"
                  />
                ) : (
                  <div className="text-center space-y-2">
                    <UploadCloud className="w-10 h-10 text-slate-300 group-hover:text-emerald-500 mx-auto transition-colors" />
                    <span className="text-xs font-bold text-slate-400">Upload Mark</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-6 rounded-b-xl flex justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-4 font-bold text-xs uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-10 py-4 bg-gradient-to-br from-emerald-500 to-indigo-600 hover:from-emerald-600 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-xl shadow-emerald-200 hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-2"
          >
            {saving ? 'Processing...' : <><Save size={16} /> Save Information</>}
          </button>
        </div>
      </form >
    </div >
  );
}
