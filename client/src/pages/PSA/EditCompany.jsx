import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from 'antd';
import { notification } from '../../utils/antdGlobal';
import {

    UploadCloud,
    Phone,
    MapPin,
    Mail,
    User,
    Lock,
    Building2,
    RefreshCw,
    Plus,
    FileText,
    Pencil,
    Globe,
    Layers,
    Fingerprint,
    CreditCard,
    Hash,
    Eye,
    EyeOff,
    Briefcase,
    Clock,
    CalendarDays,
    Banknote,
    Navigation,
    Landmark,
    FileSignature,
    BadgeCheck,
    BadgeCent,
    Link2
} from 'lucide-react';
import companiesService from '../../services/companiesService';
import { API_ROOT } from '../../utils/api';
import { normalizeEnabledModules, applyModuleDependencies } from '../../utils/moduleConfig';
import { PSA_MODULES } from '../../constants/psaModuleCatalog';
import { COUNTRY_CODES } from '../../constants/countryCodes';

export default function EditCompany() {
    const { id } = useParams();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [modal, modalContextHolder] = Modal.useModal();

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        ownerName: '',
        password: '',
        userLimit: '',
        phoneCode: '+91',
        phone: '',
        website: '',
        type: '',
        subCompanyLimit: '',
        gst: '',
        pan: '',
        regNo: '',
        country: 'India',
        state: '',
        city: '',
        pincode: '',
        address: '',
        latitude: '',
        longitude: '',
        geofenceRadius: '50',
        officeFloor: '',
        signatoryName: '',
        signatoryDesignation: '',
        logo: null,
        // NEW STATUTORY FIELDS
        tan: '',
        cin: '',
        msme: '',
        epf: '',
        esic: '',
        pt: '',
        lwf: '',
        dateOfIncorporation: '',
        // NEW OPERATIONAL FIELDS
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        fyStartMonth: 'April',
        industry: '',
        // DMS INTEGRATION
        dmsCompanyId: ''
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
            
            setFormData(prev => ({
                ...prev,
                code: data.code || data.tenantId || '',
                name: data.companyName || data.name || '',
                email: data.companyEmail || data.meta?.email || data.meta?.primaryEmail || '',
                ownerName: data.ownerName || data.adminName || data.adminUser?.name || '',
                password: '', // Password usually blank on edit
                phoneCode: data.meta?.phoneCode || data.phone?.split('-')[0] || '+91',
                phone: data.phone?.includes('-') ? data.phone.split('-')[1] : (data.phone || ''),
                website: data.meta?.website || data.website || data.domain || '',
                type: data.meta?.type || '',
                subCompanyLimit: data.subCompanyLimit ? String(data.subCompanyLimit) : '',
                gst: data.meta?.gst || '',
                pan: data.meta?.pan || '',
                regNo: data.meta?.regNo || '',
                country: data.meta?.country || 'India',
                state: data.meta?.state || '',
                city: data.meta?.city || '',
                pincode: data.meta?.pincode || '',
                address: data.address || '',
                latitude: data.meta?.latitude || '',
                longitude: data.meta?.longitude || '',
                geofenceRadius: data.meta?.geofenceRadius ? String(data.meta?.geofenceRadius) : '50',
                officeFloor: data.meta?.officeFloor || '',
                signatoryName: data.meta?.signatoryName || '',
                signatoryDesignation: data.meta?.signatoryDesignation || '',
                tan: data.meta?.tan || '',
                cin: data.meta?.cin || '',
                msme: data.meta?.msme || '',
                epf: data.meta?.epf || '',
                esic: data.meta?.esic || '',
                pt: data.meta?.pt || '',
                lwf: data.meta?.lwf || '',
                dateOfIncorporation: data.meta?.dateOfIncorporation || '',
                timezone: data.meta?.timezone || 'Asia/Kolkata',
                currency: data.meta?.currency || 'INR',
                fyStartMonth: data.meta?.fyStartMonth || 'April',
                industry: data.meta?.industry || '',
                // DMS INTEGRATION — stored directly on Tenant record
                dmsCompanyId: data.dmsCompanyId || '',
                userLimit: data.userLimit !== undefined && data.userLimit !== null ? String(data.userLimit) : '',
                enabledModules: normalizeEnabledModules(data.enabledModules, data.modules),
                status: data.status || 'active'
            }));
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

    const getLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setFormData(prev => ({
                        ...prev,
                        latitude: position.coords.latitude.toString(),
                        longitude: position.coords.longitude.toString()
                    }));
                },
                (err) => {
                    alert('Could not auto-fetch location. Please enter manually.');
                }
            );
        } else {
            alert('Geolocation is not supported by your browser.');
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
                        },
                        // DMS Integration — save directly on Tenant
                        dmsCompanyId: formData.dmsCompanyId ? formData.dmsCompanyId.trim() : null
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
                            <form onSubmit={handleSubmit} className="space-y-8 pt-1">
{/* 1. BASIC DETAILS */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 mb-4 border-b border-slate-100 pb-2 uppercase tracking-widest">1. Basic Details</h3>
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
                                                <Building2 size={15} className="text-indigo-600" /> COMPANY NAME *
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
                                                <Mail size={15} className="text-indigo-600" /> ADMIN EMAIL *
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                autoComplete="username"
                                                placeholder="admin@company.com"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                className={`w-full h-10 px-4 rounded-xl bg-slate-50 border ${errors.email ? 'border-red-200' : 'border-transparent'} focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm`}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <User size={15} className="text-indigo-600" /> ADMIN NAME *
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
                                                    autoComplete="new-password"
                                                    placeholder="Leave blank to keep current"
                                                    value={formData.password}
                                                    onChange={handleInputChange}
                                                    className={`w-full h-10 px-4 rounded-xl bg-slate-50 border ${errors.password ? 'border-red-200' : 'border-transparent'} focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm`}
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
                                            <div className="flex w-full">
                                                <select
                                                    name="phoneCode"
                                                    value={formData.phoneCode}
                                                    onChange={handleInputChange}
                                                    className="w-[110px] h-10 px-2 rounded-l-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm border-r border-r-slate-200 outline-none cursor-pointer"
                                                    title="Select Country Code"
                                                >
                                                    {COUNTRY_CODES.map((c) => (
                                                        <option key={c.name} value={c.code} title={c.name}>
                                                            {c.code} {c.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="text"
                                                    name="phone"
                                                    placeholder="000-000-0000"
                                                    value={formData.phone}
                                                    onChange={(e) => {
                                                        if (e.target.value.length <= 15) handleInputChange(e);
                                                    }}
                                                    maxLength={15}
                                                    className="w-[calc(100%-110px)] h-10 px-4 rounded-r-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <User size={15} className="text-indigo-600" /> USER LIMIT *
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
                                </div>

                                {/* 2. STATUTORY & COMPLIANCE DETAILS */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 mb-4 border-b border-slate-100 pb-2 uppercase tracking-widest">2. Statutory & Compliance Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-5">
                                        
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
                                                placeholder="ABCDE1234F"
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
                                                placeholder="Company Reg. No"
                                                value={formData.regNo}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <Landmark size={15} className="text-indigo-600" /> TAN NUMBER
                                            </label>
                                            <input
                                                type="text"
                                                name="tan"
                                                placeholder="TAN"
                                                value={formData.tan}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm uppercase"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <Building2 size={15} className="text-indigo-600" /> CIN NUMBER
                                            </label>
                                            <input
                                                type="text"
                                                name="cin"
                                                placeholder="CIN"
                                                value={formData.cin}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm uppercase"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <BadgeCheck size={15} className="text-indigo-600" /> MSME / UDYAM
                                            </label>
                                            <input
                                                type="text"
                                                name="msme"
                                                placeholder="MSME Reg No"
                                                value={formData.msme}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm uppercase"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <FileText size={15} className="text-indigo-600" /> EPF REG NO
                                            </label>
                                            <input
                                                type="text"
                                                name="epf"
                                                placeholder="EPF Registration"
                                                value={formData.epf}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <FileText size={15} className="text-indigo-600" /> ESIC REG NO
                                            </label>
                                            <input
                                                type="text"
                                                name="esic"
                                                placeholder="ESIC Registration"
                                                value={formData.esic}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <FileText size={15} className="text-indigo-600" /> PT NO
                                            </label>
                                            <input
                                                type="text"
                                                name="pt"
                                                placeholder="Professional Tax No"
                                                value={formData.pt}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <FileText size={15} className="text-indigo-600" /> LWF CODE
                                            </label>
                                            <input
                                                type="text"
                                                name="lwf"
                                                placeholder="LWF Registration"
                                                value={formData.lwf}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <CalendarDays size={15} className="text-indigo-600" /> INCORPORATION DATE
                                            </label>
                                            <input
                                                type="date"
                                                name="dateOfIncorporation"
                                                value={formData.dateOfIncorporation}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 3. OPERATIONAL DETAILS */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 mb-4 border-b border-slate-100 pb-2 uppercase tracking-widest">3. Operational Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-5">
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
                                                <Building2 size={15} className="text-indigo-600" /> SUB-COMPANY LIMIT
                                            </label>
                                            <input
                                                type="number"
                                                name="subCompanyLimit"
                                                placeholder="Max Sub-Companies"
                                                value={formData.subCompanyLimit}
                                                onChange={handleInputChange}
                                                min="0"
                                                step="1"
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <Globe size={15} className="text-indigo-600" /> WEBSITE
                                            </label>
                                            <input
                                                type="text"
                                                name="website"
                                                placeholder="https://example.com"
                                                value={formData.website}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <Briefcase size={15} className="text-indigo-600" /> INDUSTRY
                                            </label>
                                            <input
                                                type="text"
                                                name="industry"
                                                placeholder="e.g. IT Services, Retail"
                                                value={formData.industry}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <Clock size={15} className="text-indigo-600" /> TIMEZONE
                                            </label>
                                            <select
                                                name="timezone"
                                                value={formData.timezone}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            >
                                                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                                                <option value="UTC">UTC</option>
                                                <option value="America/New_York">America/New_York (EST)</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <Banknote size={15} className="text-indigo-600" /> DEFAULT CURRENCY
                                            </label>
                                            <select
                                                name="currency"
                                                value={formData.currency}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            >
                                                <option value="INR">INR (₹)</option>
                                                <option value="USD">USD ($)</option>
                                                <option value="EUR">EUR (€)</option>
                                                <option value="GBP">GBP (£)</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <CalendarDays size={15} className="text-indigo-600" /> FY START MONTH
                                            </label>
                                            <select
                                                name="fyStartMonth"
                                                value={formData.fyStartMonth}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            >
                                                <option value="January">January</option>
                                                <option value="April">April (India Standard)</option>
                                                <option value="July">July</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* 4. AUTHORIZED SIGNATORY */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 mb-4 border-b border-slate-100 pb-2 uppercase tracking-widest">4. Authorized Signatory</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-5">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <FileSignature size={15} className="text-indigo-600" /> SIGNATORY NAME
                                            </label>
                                            <input
                                                type="text"
                                                name="signatoryName"
                                                placeholder="Legal Signatory Name"
                                                value={formData.signatoryName}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <BadgeCent size={15} className="text-indigo-600" /> DESIGNATION
                                            </label>
                                            <input
                                                type="text"
                                                name="signatoryDesignation"
                                                placeholder="e.g. Director, CEO"
                                                value={formData.signatoryDesignation}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 5. LOCATION DETAILS */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 mb-4 border-b border-slate-100 pb-2 uppercase tracking-widest">5. Location Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-5">
                                        
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <MapPin size={15} className="text-indigo-600" /> COUNTRY
                                            </label>
                                            <input
                                                type="text"
                                                name="country"
                                                placeholder="India"
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
                                                placeholder="Gujarat"
                                                value={formData.state}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <MapPin size={15} className="text-indigo-600" /> CITY
                                            </label>
                                            <input
                                                type="text"
                                                name="city"
                                                placeholder="Ahmedabad"
                                                value={formData.city}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <Hash size={15} className="text-indigo-600" /> PINCODE
                                            </label>
                                            <input
                                                type="text"
                                                name="pincode"
                                                placeholder="380001"
                                                value={formData.pincode}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5 md:col-span-2">
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

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                <Navigation size={15} className="text-indigo-600" /> LATITUDE
                                            </label>
                                            <input
                                                type="text"
                                                name="latitude"
                                                placeholder="e.g. 23.0225"
                                                value={formData.latitude}
                                                onChange={handleInputChange}
                                                className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between ml-1">
                                                <span className="flex items-center gap-2">
                                                    <Navigation size={15} className="text-indigo-600" /> LONGITUDE
                                                </span>
                                                <button 
                                                    type="button" 
                                                    onClick={getLocation}
                                                    className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full hover:bg-indigo-100 transition-colors"
                                                >
                                                    Auto-Fetch
                                                </button>
                                            </label>
                                                <input
                                                    type="text"
                                                    name="longitude"
                                                    placeholder="e.g. 72.5714"
                                                    value={formData.longitude}
                                                    onChange={handleInputChange}
                                                    className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                                />
                                            </div>
                                            
                                            {/* Google Maps Verification */}
                                            {formData.latitude && formData.longitude && (
                                                <div className="md:col-span-4 flex justify-end mt-[-5px]">
                                                    <a 
                                                        href={`https://www.google.com/maps/search/?api=1&query=${formData.latitude},${formData.longitude}`} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-widest shadow-sm"
                                                        title="Click to view and verify these coordinates on Google Maps"
                                                    >
                                                        <MapPin size={12} className="animate-bounce" /> VERIFY ON GOOGLE MAPS
                                                    </a>
                                                </div>
                                            )}

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                    <Navigation size={15} className="text-indigo-600" /> GEOFENCE RADIUS (M)
                                                </label>
                                                <input
                                                    type="text"
                                                    name="geofenceRadius"
                                                    placeholder="e.g. 50"
                                                    value={formData.geofenceRadius}
                                                    onChange={handleInputChange}
                                                    className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                                />
                                                <p className="text-[9px] text-slate-400 ml-1 font-medium">Strict punch-in distance</p>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                    <Building2 size={15} className="text-indigo-600" /> OFFICE FLOOR / UNIT
                                                </label>
                                                <input
                                                    type="text"
                                                    name="officeFloor"
                                                    placeholder="e.g. 2nd Floor, Wing A"
                                                    value={formData.officeFloor}
                                                    onChange={handleInputChange}
                                                    className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── DMS INTEGRATION SECTION ── */}
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-400 mb-4 border-b border-slate-100 pb-2 uppercase tracking-widest flex items-center gap-2">
                                            <Link2 size={13} className="text-indigo-500" />
                                            6. DMS Integration
                                        </h3>
                                        <div className="bg-gradient-to-r from-indigo-50/60 to-violet-50/40 border border-indigo-100 rounded-2xl p-5">
                                            <div className="flex flex-col md:flex-row md:items-start gap-5">
                                                <div className="flex-1 space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
                                                        <Link2 size={13} className="text-indigo-600" /> DMS COMPANY ID
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="dmsCompanyId"
                                                        placeholder="e.g. 6859abc123def456789012  (24-char DMS _id)"
                                                        value={formData.dmsCompanyId}
                                                        onChange={handleInputChange}
                                                        className="w-full h-10 px-4 rounded-xl bg-white border border-indigo-200 focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-mono text-slate-600 shadow-sm placeholder:font-sans"
                                                    />
                                                    <p className="text-[10px] text-slate-400 ml-1">
                                                        📋 Go to <strong>DMS Panel → Super Admin → Companies</strong>, open the desired company, copy its <code className="bg-white px-1 py-0.5 rounded border border-slate-200">_id</code> and paste it here.
                                                    </p>
                                                </div>
                                                <div className="md:w-60 bg-white rounded-xl border border-indigo-100 p-4 shadow-sm shrink-0">
                                                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-3">🔗 How it works</p>
                                                    <ol className="list-decimal list-inside space-y-1.5 text-[10px] text-slate-500">
                                                        <li>Open <strong>DMS Panel → Companies</strong></li>
                                                        <li>Click on the company you want to link</li>
                                                        <li>Copy the <strong>_id</strong> from the URL or details</li>
                                                        <li>Paste it in the field on the left</li>
                                                        <li>Click <strong>Save Changes</strong></li>
                                                        <li>✅ HRMS & DMS are now linked!</li>
                                                    </ol>
                                                </div>
                                            </div>
                                            {formData.dmsCompanyId && (
                                                <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                                    <Link2 size={13} />
                                                    DMS Linked ✓ — Company ID: <code className="font-mono">{formData.dmsCompanyId}</code>
                                                </div>
                                            )}
                                        </div>
                                    </div>


                                <div className="flex items-center justify-end pt-4 border-t border-slate-50 mt-4">
                                    {errors.submit && (
                                        <p className="mr-auto text-[12px] font-bold text-red-500">{errors.submit}</p>
                                    )}
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
        className="px-8 h-10 rounded-xl bg-[#6366F1] text-white font-bold shadow-[0_6px_15px_-4px_rgba(99,102,241,0.3)] hover:shadow-indigo-600/30 hover:-translate-y-0.5 transition-all flex items-center gap-2.5 active:scale-95 group uppercase tracking-widest text-[11px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
    >
        {submitting ? <RefreshCw className="animate-spin" size={14} /> : <>SAVE CHANGES <Plus size={15} className="group-hover:rotate-90 transition-transform" /></>}
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
