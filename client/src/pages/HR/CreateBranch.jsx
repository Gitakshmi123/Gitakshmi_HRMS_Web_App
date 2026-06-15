import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Building2, 
  MapPin, 
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Map,
  Info,
  Layers,
  User,
  Phone,
  Mail,
  Clock,
  Globe,
  Settings,
  Hash
} from 'lucide-react';
import { showToast } from '../../utils/uiNotifications';

export default function CreateBranch() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useLocation();
  const { user } = useAuth();
  const isEditing = Boolean(id);
  const isSuperCompanyAdmin = user?.role === 'company_super_admin';

  const [formData, setFormData] = useState({
    name: '',
    city: '',
    state: '',
    country: 'India',
    address: '',
    branchCode: '',
    branchType: 'Branch',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    workingHours: {
      startTime: '09:00',
      endTime: '18:00'
    },
    timezone: 'UTC+5:30',
    companyId: '',
    status: 'pending'
  });

  const [autoGenerateCode, setAutoGenerateCode] = useState(true);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    if (isEditing) {
      if (state?.branch) {
        setFormData({
          ...state.branch,
          companyId: state.branch.companyId?._id || state.branch.companyId || ''
        });
      } else {
        fetchBranch();
      }
    }
  }, [id]);

  useEffect(() => {
    if (!isEditing && autoGenerateCode && formData.city) {
      const cityPart = formData.city.substring(0, 3).toUpperCase();
      const randomPart = Math.floor(100 + Math.random() * 900);
      setFormData(prev => ({ ...prev, branchCode: `${cityPart}-${randomPart}` }));
    }
  }, [formData.city, autoGenerateCode, isEditing]);

  const fetchBranch = async () => {
    setFetching(true);
    try {
      const response = await api.get(`/branch/${id}`);
      const item = response.data?.item || response.data || {};
      setFormData({
        ...item,
        companyId: item.companyId?._id || item.companyId || ''
      });
    } catch (err) {
      console.error('Error fetching branch:', err);
      showToast('error', 'Error', 'Failed to load branch details');
    } finally {
      setFetching(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/tenants'); 
      setCompanies(response.data?.items || response.data || []);
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Simple Validation
    if (!formData.name.trim() || !formData.city.trim() || !formData.address.trim()) {
      showToast('warning', 'Incomplete Form', 'All fields are required');
      return;
    }

    if (isSuperCompanyAdmin && !formData.companyId) {
      showToast('warning', 'Missing Company', 'Please select a company to add this branch to');
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        await api.put(`/branch/${id}`, formData);
        showToast('success', 'Updated', 'Branch updated successfully');
      } else {
        await api.post('/branch/create', formData);
        const successMsg = !isSuperCompanyAdmin 
          ? 'Branch registered and sent for approval' 
          : 'Branch registered successfully';
        showToast('success', 'Registered', successMsg);
      }
      navigate('/tenant/branches');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save branch';
      showToast('error', 'Error', msg);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="p-20 text-center animate-pulse text-slate-400 font-bold">
        Fetching branch data...
      </div>
    );
  }

  return (
    <div className="p-6 w-full max-w-[1100px] mx-auto animate-in fade-in pb-20">
      {/* Breadcrumb / Back Link */}
      <button 
        onClick={() => navigate('/tenant/branches')}
        className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-medium text-xs mb-4 transition-all"
      >
        <ArrowLeft size={14} />
        Back to Directory
      </button>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-800">
           {isEditing ? 'Edit Branch' : 'New Branch Registry'}
        </h1>
        {!isSuperCompanyAdmin && !isEditing && (
          <div className="bg-slate-50 text-slate-500 font-bold text-[10px] px-3 py-1 rounded border border-slate-200">
            APPROVAL REQUIRED
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 space-y-10">
          {/* --- SECTION: CORE --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1">
              <h3 className="font-bold text-slate-800 mb-1 text-sm tracking-tight text-indigo-700">General Information</h3>
              <p className="text-xs text-slate-400">Basic details and categorical parameters for the location.</p>
            </div>
            
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
              {isSuperCompanyAdmin && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Target Company</label>
                  <select name="companyId" className="w-full h-11 px-4 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm font-medium bg-slate-50/30" value={formData.companyId} onChange={handleInputChange} required>
                    <option value="">Select Company</option>
                    {companies.map(c => <option key={c._id} value={c._id}>{c.companyName || c.name}</option>)}
                  </select>
                </div>
              )}
              
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Location Name</label>
                <input type="text" name="name" placeholder="e.g. Mumbai HQ" className="w-full h-11 px-4 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm font-medium bg-slate-50/30" value={formData.name} onChange={handleInputChange} required />
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Level/Type</label>
                <select name="branchType" className="w-full h-11 px-4 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm font-medium bg-slate-50/30" value={formData.branchType} onChange={handleInputChange}>
                  <option value="Head Office">Head Office</option>
                  <option value="Branch">General Branch</option>
                  <option value="Warehouse">Warehouse / Depot</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Internal Reference Code</label>
                  {!isEditing && (
                    <button type="button" onClick={() => setAutoGenerateCode(!autoGenerateCode)} className="text-[10px] text-indigo-600 font-bold hover:underline">
                      {autoGenerateCode ? 'Use Manual Code?' : 'Use Automatic Code?'}
                    </button>
                  )}
                </div>
                <input type="text" name="branchCode" className={`w-full h-11 px-4 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm font-bold ${autoGenerateCode && !isEditing ? 'bg-slate-50 text-slate-400' : 'bg-slate-50/30'}`} value={formData.branchCode} onChange={handleInputChange} readOnly={autoGenerateCode && !isEditing} required />
              </div>
            </div>
          </div>

          <hr className="border-slate-50" />

          {/* --- SECTION: ADDRESS --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1">
              <h3 className="font-bold text-slate-800 mb-1 text-sm tracking-tight text-indigo-700">Location Details</h3>
              <p className="text-xs text-slate-400">Postal addresses and regional settings.</p>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">City</label>
                <input type="text" name="city" placeholder="City" className="w-full h-11 px-4 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm font-medium bg-slate-50/30" value={formData.city} onChange={handleInputChange} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">State</label>
                <input type="text" name="state" placeholder="State/Province" className="w-full h-11 px-4 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm font-medium bg-slate-50/30" value={formData.state} onChange={handleInputChange} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Country</label>
                <input type="text" name="country" className="w-full h-11 px-4 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm font-medium bg-slate-50/30" value={formData.country} onChange={handleInputChange} required />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Timezone</label>
                <select name="timezone" className="w-full h-11 px-4 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm font-medium bg-slate-50/30" value={formData.timezone} onChange={handleInputChange}>
                  <option value="UTC+5:30">India (UTC+5:30)</option>
                  <option value="UTC+0:00">London (UTC+0:00)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Street Address</label>
                <input type="text" name="address" placeholder="Full postal address..." className="w-full h-11 px-4 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm font-medium bg-slate-50/30" value={formData.address} onChange={handleInputChange} required />
              </div>
            </div>
          </div>

          <hr className="border-slate-50" />

          {/* --- SECTION: CONTACT & OPS --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1">
              <h3 className="font-bold text-slate-800 mb-1 text-sm tracking-tight text-indigo-700">Contact & Operations</h3>
              <p className="text-xs text-slate-400">Manage personnel contacts and branch timings.</p>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Contact Name</label>
                  <input type="text" name="contactPerson" placeholder="Branch Manager" className="w-full h-11 px-4 rounded-lg border border-slate-200 text-sm font-medium bg-slate-50/30" value={formData.contactPerson} onChange={handleInputChange} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Phone</label>
                  <input type="text" name="contactPhone" placeholder="+91 ..." className="w-full h-11 px-4 rounded-lg border border-slate-200 text-sm font-medium bg-slate-50/30" value={formData.contactPhone} onChange={handleInputChange} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Email</label>
                  <input type="email" name="contactEmail" placeholder="manager@branch.com" className="w-full h-11 px-4 rounded-lg border border-slate-200 text-sm font-medium bg-slate-50/30" value={formData.contactEmail} onChange={handleInputChange} />
                </div>
              </div>

              <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                 <div className="flex items-center gap-2">
                   <Clock size={16} className="text-slate-400" />
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Operating Shift</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <input type="time" name="workingHours.startTime" className="h-9 px-3 rounded-lg border border-slate-200 text-sm font-bold text-indigo-700 outline-none bg-white shadow-sm" value={formData.workingHours.startTime} onChange={handleInputChange} />
                   <span className="text-slate-300 font-bold text-xs uppercase">to</span>
                   <input type="time" name="workingHours.endTime" className="h-9 px-3 rounded-lg border border-slate-200 text-sm font-bold text-indigo-700 outline-none bg-white shadow-sm" value={formData.workingHours.endTime} onChange={handleInputChange} />
                 </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-slate-50">
            <button 
              type="submit" 
              disabled={loading}
              className={`px-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2 ${loading ? 'opacity-70' : ''}`}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  <CheckCircle2 size={18} />
                  {isEditing ? 'Update Branch' : 'Confirm & Create'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
