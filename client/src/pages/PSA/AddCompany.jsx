import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
    EyeOff
} from 'lucide-react';
import companiesService from '../../services/companiesService';
import { createDefaultEnabledModules } from '../../utils/moduleConfig';
import { PSA_MODULE_CODES } from '../../constants/psaModuleCatalog';

const mapTaxpayerTypeToCompanyType = (value = '') => {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('private') || normalized.includes('pvt')) return 'pvt_ltd';
    if (normalized.includes('public')) return 'public_ltd';
    if (normalized.includes('limited liability') || normalized.includes('llp')) return 'llp';
    if (normalized.includes('proprietor')) return 'proprietorship';
    if (normalized.includes('partnership')) return 'partnership';
    return '';
};

export default function AddCompany() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        ownerName: '',
        password: '',
        userLimit: '',
        phone: '',
        website: '',
        type: '',
        subCompanyLimit: '',
        gst: '',
        pan: '',
        regNo: '',
        country: '',
        state: '',
        city: '',
        pincode: '',
        address: '',
        logo: null
    });

    const [logoPreview, setLogoPreview] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [gstLookupLoading, setGstLookupLoading] = useState(false);
    const [gstLookupMessage, setGstLookupMessage] = useState('');
    const [errors, setErrors] = useState({});

    const defaultEnabledModules = createDefaultEnabledModules(false, PSA_MODULE_CODES);

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
        if (name === 'gst') setGstLookupMessage('');
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
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

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({ ...prev, logo: file }));
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
        if (!formData.password) errs.password = 'Required';

        if (!formData.userLimit) {
            errs.userLimit = 'Required';
        } else if (isNaN(formData.userLimit) || Number(formData.userLimit) <= 0) {
            errs.userLimit = 'Must be a positive number';
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);
        setErrors({});

        try {
            let logoUrl = '';
            if (formData.logo) {
                try {
                    const upRes = await companiesService.uploadLogo(formData.logo);
                    logoUrl = upRes.url || upRes.path || '';
                } catch {
                    console.warn('Logo upload skipped');
                }
            }

            const payload = {
                companyName: formData.name,
                companyEmail: formData.email,
                ownerName: formData.ownerName,
                phone: formData.phone,
                password: formData.password,
                subCompanyLimit: formData.subCompanyLimit ? Number(formData.subCompanyLimit) : 0,
                userLimit: Number(formData.userLimit),
                logo: logoUrl,
                enabledModules: defaultEnabledModules,
                address: formData.address,
                domain: formData.website,
                meta: {
                    type: formData.type,
                    gst: formData.gst,
                    pan: formData.pan,
                    regNo: formData.regNo,
                    country: formData.country,
                    state: formData.state,
                    city: formData.city,
                    pincode: formData.pincode,
                    primaryEmail: formData.email,
                    email: formData.email
                }
            };

            await companiesService.createCompany(payload);
            navigate('/psa/companies');
        } catch (err) {
            console.error(err);
            setErrors({ submit: err.response?.data?.message || 'Failed to create company' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full animate-in fade-in duration-700 font-outfit relative p-[10px] space-y-[10px]">
            <div className="fixed -top-10 -right-10 w-[500px] h-[500px] bg-indigo-50/40 blur-[120px] rounded-full -z-10 animate-pulse"></div>
            <div className="fixed -bottom-10 -left-10 w-[400px] h-[400px] bg-violet-50/30 blur-[100px] rounded-full -z-10"></div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-[10px]">
                <div className="lg:col-span-12 space-y-[10px]">
                    <div className="bg-white rounded-lg border border-slate-100 shadow-[0_8px_40px_rgba(0,0,0,0.03)] overflow-hidden">
                        <div className="px-6 pt-5 pb-2">
                            <h1 className="text-xl font-black text-slate-700 tracking-tight uppercase mb-0 font-outfit">ADD COMPANY DETAILS</h1>
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
                                            <User size={15} className="text-indigo-600" /> ADMIN NAME
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
                                            <Lock size={15} className="text-indigo-600" /> PASSWORD
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                placeholder="********"
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
                                            placeholder="REG NO"
                                            value={formData.regNo}
                                            onChange={handleInputChange}
                                            className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-600 shadow-sm"
                                        />
                                    </div>

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
                                </div>

                                <div className="flex items-center justify-end pt-4 border-t border-slate-50">
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
                                            disabled={loading}
                                            className="px-8 h-10 rounded-xl bg-[#6366F1] text-white font-bold shadow-[0_6px_15px_-4px_rgba(99,102,241,0.3)] hover:shadow-indigo-600/30 hover:-translate-y-0.5 transition-all flex items-center gap-2.5 active:scale-95 group uppercase tracking-widest text-[11px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                        >
                                            {loading ? <RefreshCw className="animate-spin" size={14} /> : <>CREATE COMPANY <Plus size={15} className="group-hover:rotate-90 transition-transform" /></>}
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
                input[type="password"]::-ms-reveal,
                input[type="password"]::-ms-clear {
                    display: none;
                }
            `}</style>
        </div>
    );
}
