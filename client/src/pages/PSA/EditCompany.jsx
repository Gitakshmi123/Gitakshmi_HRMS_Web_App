import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from 'antd';
import { notification } from '../../utils/antdGlobal';
import {
    UploadCloud,
    Building2,
    Mail,
    Phone,
    CreditCard,
    MapPin,
    FileText,
    Globe,
    Pencil,
    Lock,
    Users,
    RefreshCw,
    Save,
    Fingerprint,
    Layers,
    Eye,
    EyeOff
} from 'lucide-react';
import companiesService from '../../services/companiesService';
import { API_ROOT } from '../../utils/api';
import { normalizeEnabledModules, applyModuleDependencies } from '../../utils/moduleConfig';
import { PSA_MODULES } from '../../constants/psaModuleCatalog';

export default function EditCompany() {
    const { id } = useParams();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [modal, modalContextHolder] = Modal.useModal();

    // Form State
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        email: '',
        ownerName: '',
        password: '',
        phone: '',
        website: '',
        address: '',
        type: '',
        gst: '',
        pan: '',
        regNo: '',
        country: '',
        state: '',
        userLimit: '',
        enabledModules: {},
        status: 'active'
    });

    const [logoPreview, setLogoPreview] = useState(null);
    const [logoFile, setLogoFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});

    const availableModules = PSA_MODULES.map((moduleItem) => ({
        ...moduleItem,
        name: moduleItem.label
    }));

    const getLogoUrl = (url) => {
        if (!url) return null;
        return url.startsWith('http') ? url : `${API_ROOT}${url}`;
    };

    const loadCompany = useCallback(async () => {
        try {
            setLoading(true);
            const data = await companiesService.getCompanyById(id);
            
            setFormData({
                code: data.code || data.tenantId || '',
                name: data.companyName || data.name || '',
                email: data.companyEmail || data.meta?.email || data.meta?.primaryEmail || '',
                ownerName: data.ownerName || data.adminName || data.adminUser?.name || '',
                password: '', // Password usually blank on edit
                phone: data.phone || '',
                website: data.meta?.website || data.website || '',
                address: data.address || '',
                type: data.meta?.type || '',
                gst: data.meta?.gst || '',
                pan: data.meta?.pan || '',
                regNo: data.meta?.regNo || '',
                country: data.meta?.country || '',
                state: data.meta?.state || '',
                userLimit: data.userLimit !== undefined && data.userLimit !== null
                    ? String(data.userLimit)
                    : '',
                enabledModules: normalizeEnabledModules(data.enabledModules, data.modules),
                status: data.status || 'active'
            });
            if (data.logo || data.meta?.logo) {
                setLogoPreview(getLogoUrl(data.logo || data.meta?.logo));
            }
        } catch (error) {
            console.error('Failed to load company', error);
            notification.error({ message: 'Error', description: 'Failed to load company details' });
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadCompany();
    }, [loadCompany]);

    const [gstLookupLoading, setGstLookupLoading] = useState(false);
    const [gstLookupMessage, setGstLookupMessage] = useState('');

    const mapTaxpayerTypeToCompanyType = (value = '') => {
        const normalized = String(value || '').toLowerCase();
        if (normalized.includes('private') || normalized.includes('pvt')) return 'pvt_ltd';
        if (normalized.includes('public')) return 'public_ltd';
        if (normalized.includes('limited liability') || normalized.includes('llp')) return 'llp';
        if (normalized.includes('proprietor')) return 'proprietorship';
        if (normalized.includes('partnership')) return 'partnership';
        return '';
    };

    const lookupGstDetails = async () => {
        const gstin = String(formData.gst || '').trim().toUpperCase();
        if (!gstin) return;

        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
            setErrors(prev => ({ ...prev, gst: 'Invalid GSTIN' }));
            setGstLookupMessage('');
            return;
        }

        setGstLookupLoading(true);
        setGstLookupMessage('');
        setErrors(prev => ({ ...prev, gst: '' }));

        try {
            const details = await companiesService.lookupGst(gstin);
            setFormData(prev => ({
                ...prev,
                gst: details.gstin || gstin,
                pan: details.pan || gstin.slice(2, 12) || prev.pan,
                name: details.companyName || details.legalName || prev.name,
                address: details.address || prev.address,
                state: details.state || prev.state,
                country: details.country || prev.country || 'India',
                type: prev.type || mapTaxpayerTypeToCompanyType(details.taxpayerType)
            }));
            setGstLookupMessage('GST details fetched');
            notification.success({ message: 'GST Details Fetched', description: 'Form updated with GST information' });
        } catch (error) {
            setFormData(prev => ({
                ...prev,
                pan: gstin.slice(2, 12) || prev.pan
            }));
            setGstLookupMessage(error?.response?.data?.message || 'Could not fetch GST details');
        } finally {
            setGstLookupLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name } = e.target;
        let { value } = e.target;

        if (name === 'email') value = String(value || '').toLowerCase();
        if (name === 'phone') value = String(value || '').replace(/\D/g, '');
        if (name === 'gst' || name === 'pan') value = String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
        
        // Prevent numbers and special characters in company name and admin name
        if (name === 'name' || name === 'ownerName') {
            value = String(value || '').replace(/[^a-zA-Z\s]/g, '');
        }

        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setLogoPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const validate = () => {
        const errs = {};
        if (!formData.name) errs.name = 'Required';
        if (!formData.email) errs.email = 'Required';
        if (!formData.ownerName) errs.ownerName = 'Required';

        if (!formData.userLimit) {
            errs.userLimit = 'Required';
        } else if (isNaN(formData.userLimit) || Number(formData.userLimit) <= 0) {
            errs.userLimit = 'Must be a positive number';
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!validate()) {
            notification.error({
                message: 'Validation Failed',
                description: 'Please fix highlighted fields before saving.',
            });
            return;
        }

        modal.confirm({
            title: 'Confirm Update',
            content: 'Save changes to company configuration?',
            okText: 'Yes, Save',
            cancelText: 'Cancel',
            centered: true,
            okButtonProps: { style: { backgroundColor: '#6366f1' } },
            onOk: async () => {
                setSubmitting(true);
                try {
                    let logoUrl = logoPreview;
                    if (logoFile) {
                        try {
                            const upRes = await companiesService.uploadLogo(logoFile);
                            logoUrl = upRes.url || upRes.path || '';
                        } catch { console.warn('Logo upload skipped'); }
                    }

                    const payload = {
                        companyName: formData.name,
                        companyEmail: formData.email,
                        ownerName: formData.ownerName,
                        phone: formData.phone,
                        userLimit: Number(formData.userLimit),
                        status: formData.status,
                        enabledModules: formData.enabledModules,
                        address: formData.address,
                        logo: logoUrl || undefined,
                        meta: {
                            type: formData.type,
                            gst: formData.gst,
                            pan: formData.pan,
                            regNo: formData.regNo,
                            country: formData.country,
                            state: formData.state,
                            logo: logoUrl || undefined,
                            primaryEmail: formData.email,
                            email: formData.email
                        }
                    };

                    if (formData.password) {
                        payload.password = formData.password;
                    }

                    await companiesService.updateCompany(id, payload);
                    notification.success({ message: 'Update Successful', description: 'Company updated successfully.' });
                    navigate('/psa/companies');
                } catch (err) {
                    console.error(err);
                    notification.error({ 
                        message: 'Update Failed', 
                        description: err.response?.data?.message || 'Failed to update company' 
                    });
                } finally {
                    setSubmitting(false);
                }
            }
        });
    };

    if (loading) return (
        <div className="flex min-h-[400px] flex-col items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-indigo-600" />
            <p className="mt-4 text-[13px] font-medium text-slate-400 animate-pulse uppercase tracking-widest">Loading company details...</p>
        </div>
    );

    return (
        <div className="w-full animate-in fade-in duration-700 font-outfit relative p-[10px] space-y-[10px]">
            {modalContextHolder}
            <div className="fixed -top-10 -right-10 w-[500px] h-[500px] bg-indigo-50/40 blur-[120px] rounded-full -z-10 animate-pulse"></div>
            <div className="fixed -bottom-10 -left-10 w-[400px] h-[400px] bg-violet-50/30 blur-[100px] rounded-full -z-10"></div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-[10px]">
                <div className="lg:col-span-12 space-y-[10px]">
                    <div className="bg-white rounded-lg border border-slate-100 shadow-[0_8px_40px_rgba(0,0,0,0.03)] overflow-hidden">
                        <div className="px-6 pt-5 pb-2">
                            <h1 className="text-xl font-black text-slate-700 tracking-tight uppercase mb-0 font-outfit">EDIT COMPANY DETAILS</h1>
                        </div>

                        <div className="px-6 pb-4 pt-1">
                            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                                <div className="grid grid-cols-1 md:grid-cols-[140px,1fr,1fr,1fr] gap-x-6 gap-y-5">
                                    <div className="md:row-span-2 space-y-2 flex flex-col pt-1 pr-4 border-r border-slate-50">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">COMPANY LOGO</label>
                                        <div className="relative">
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full aspect-square md:h-28 rounded-2xl bg-white border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 group transition-all relative overflow-hidden shadow-sm"
                                            >
                                                {logoPreview ? (
                                                    <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-3 animate-in fade-in" />
                                                ) : (
                                                    <div className="text-center flex flex-col items-center gap-1.5 px-2">
                                                        <UploadCloud size={18} className="text-slate-300 group-hover:text-indigo-500 transition-all" />
                                                        <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest text-center leading-tight">UPLOAD<br />LOGO</p>
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="absolute bottom-1 -right-1 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all z-10 border-2 border-white"
                                            >
                                                <Pencil size={11} />
                                            </button>
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                            <Building2 size={15} className="text-indigo-600" /> COMPANY NAME
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            placeholder="e.g. Acme Corp"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className={`w-full h-10 px-4 rounded-xl bg-slate-50 border ${errors.name ? 'border-red-200' : 'border-transparent'} focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm`}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                            <Mail size={15} className="text-indigo-600" /> ADMIN EMAIL
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            placeholder="admin@company.com"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            className={`w-full h-10 px-4 rounded-xl bg-slate-50 border ${errors.email ? 'border-red-200' : 'border-transparent'} focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm`}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                            <Users size={15} className="text-indigo-600" /> ADMIN NAME
                                        </label>
                                        <input
                                            type="text"
                                            name="ownerName"
                                            placeholder="Full name"
                                            value={formData.ownerName}
                                            onChange={handleInputChange}
                                            className={`w-full h-10 px-4 rounded-xl bg-slate-50 border ${errors.ownerName ? 'border-red-200' : 'border-transparent'} focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm`}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                            <Lock size={15} className="text-indigo-600" /> UPDATE PASSWORD
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                placeholder="Leave blank to keep current"
                                                value={formData.password}
                                                onChange={handleInputChange}
                                                className={`w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                            <Phone size={15} className="text-indigo-600" /> PHONE NUMBER
                                        </label>
                                        <input
                                            type="text"
                                            name="phone"
                                            placeholder="+1 (0) 00-0000"
                                            value={formData.phone}
                                            onChange={(e) => {
                                                if (e.target.value.length <= 15) handleInputChange(e);
                                            }}
                                            maxLength={15}
                                            className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                            <Users size={15} className="text-indigo-600" /> USER LIMIT *
                                        </label>
                                        <input
                                            type="number"
                                            name="userLimit"
                                            placeholder="Max Users"
                                            value={formData.userLimit}
                                            onChange={handleInputChange}
                                            min="1"
                                            step="1"
                                            className={`w-full h-10 px-4 rounded-xl bg-slate-50 border ${errors.userLimit ? 'border-red-200' : 'border-transparent'} focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm`}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-5 pt-1">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                            <Layers size={15} className="text-indigo-600" /> COMPANY TYPE
                                        </label>
                                        <select
                                            name="type"
                                            value={formData.type}
                                            onChange={handleInputChange}
                                            className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                        >
                                            <option value="">Select Type</option>
                                            <option value="pvt_ltd">Private Limited</option>
                                            <option value="public_ltd">Public Limited</option>
                                            <option value="llp">LLP</option>
                                            <option value="proprietorship">Proprietorship</option>
                                            <option value="partnership">Partnership</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                            <Fingerprint size={15} className="text-indigo-600" /> GST NUMBER
                                        </label>
                                        <input
                                            type="text"
                                            name="gst"
                                            placeholder="GSTIN"
                                            value={formData.gst}
                                            onChange={handleInputChange}
                                            onBlur={lookupGstDetails}
                                            maxLength={15}
                                            className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm uppercase"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                            <CreditCard size={15} className="text-indigo-600" /> PAN NUMBER
                                        </label>
                                        <input
                                            type="text"
                                            name="pan"
                                            placeholder="PAN"
                                            value={formData.pan}
                                            onChange={handleInputChange}
                                            className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm uppercase"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                            <FileText size={15} className="text-indigo-600" /> REGISTRATION NO
                                        </label>
                                        <input
                                            type="text"
                                            name="regNo"
                                            placeholder="REG NO"
                                            value={formData.regNo}
                                            onChange={handleInputChange}
                                            className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                            <Globe size={15} className="text-indigo-600" /> COUNTRY
                                        </label>
                                        <input
                                            type="text"
                                            name="country"
                                            placeholder="Country"
                                            value={formData.country}
                                            onChange={handleInputChange}
                                            className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                            <MapPin size={15} className="text-indigo-600" /> STATE
                                        </label>
                                        <input
                                            type="text"
                                            name="state"
                                            placeholder="State"
                                            value={formData.state}
                                            onChange={handleInputChange}
                                            className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                            <MapPin size={15} className="text-indigo-600" /> OFFICE ADDRESS
                                        </label>
                                        <input
                                            type="text"
                                            name="address"
                                            placeholder="Street, City, Country"
                                            value={formData.address}
                                            onChange={handleInputChange}
                                            className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end pt-4 border-t border-slate-50">
                                    <div className="flex items-center gap-6">
                                        <button
                                            type="button"
                                            onClick={() => navigate('/psa/companies')}
                                            className="px-6 h-10 rounded-xl text-slate-400 font-bold hover:text-slate-600 transition-all uppercase tracking-widest text-[10px]"
                                        >
                                            CANCEL
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="px-8 h-10 rounded-xl bg-[#6366F1] text-white font-bold shadow-[0_6px_15px_-4px_rgba(99,102,241,0.3)] hover:shadow-indigo-600/30 hover:-translate-y-0.5 transition-all flex items-center gap-2.5 active:scale-95 group uppercase tracking-widest text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {submitting ? <RefreshCw className="animate-spin" size={14} /> : <>SAVE CHANGES <Save size={15} /></>}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap');
                .font-outfit { font-family: 'Outfit', sans-serif; }
                input::placeholder { color: #CBD5E1; font-weight: 500; }
                input:focus, select:focus {
                    outline: none !important;
                    border-color: #818cf8 !important;
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.05) !important;
                }
            `}</style>
        </div>
    );
}
