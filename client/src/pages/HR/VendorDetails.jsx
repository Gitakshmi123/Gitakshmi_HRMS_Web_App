import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Building2,
    CreditCard,
    MapPin,
    Phone,
    Mail,
    FileText,
    ArrowLeft,
    Download,
    CheckCircle2,
    Calendar,
    Briefcase,
    ExternalLink,
    AlertCircle,
    User,
    Globe,
    Landmark,
    ShieldCheck
} from 'lucide-react';
import { Button, Tag, Spin, Empty, Card, Divider } from 'antd';
import api from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';

export default function VendorDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [vendor, setVendor] = useState(null);

    useEffect(() => {
        fetchDetails();
    }, [id]);

    const fetchDetails = async () => {
        try {
            const res = await api.get(`/vendor/${id}`);
            if (res.data.success) {
                setVendor(res.data.data);
            }
        } catch (error) {
            showToast('error', 'Error', 'Failed to fetch vendor details');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Spin size="large" /></div>;
    if (!vendor) return <div className="p-20 bg-slate-50 min-h-screen"><Empty description="Vendor Profile Not Found" /></div>;

    return (
        <div className="w-full max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-700 pb-20 px-4">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-50 border border-slate-100">
                <div className="flex items-center gap-6">
                    <Button
                        icon={<ArrowLeft size={20} />}
                        onClick={() => navigate('/employee/vendor/list')}
                        className="h-14 w-14 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border-slate-100 transition-all font-bold"
                    />
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">{vendor.vendorName}</h1>
                            <Tag color="blue" className="rounded-full px-4 py-0.5 font-black text-[11px] border-none shadow-sm uppercase tracking-widest">{vendor.bankAccountTitle || 'Entity'}</Tag>
                        </div>
                        <p className="text-slate-400 font-bold text-lg mt-1 flex items-center gap-2">
                            Full Entity Profile <ChevronRight size={16} /> Verified Settlement Information
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        size="large"
                        icon={<Download size={20} />}
                        onClick={() => window.print()}
                        className="h-14 px-8 rounded-2xl font-black text-slate-600 border-slate-200 hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        Export Profile
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column - General Info (Spans 8) */}
                <div className="lg:col-span-8 space-y-8">
                    <Card className="rounded-[2.5rem] border-slate-100 shadow-xl shadow-slate-50 overflow-hidden">
                        <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                            <Building2 className="text-indigo-600" size={20} />
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">1. Business Geography & Presence</h2>
                        </div>
                        <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                            <div>
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">City Jurisdiction</p>
                                <p className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <MapPin size={18} className="text-indigo-400" /> {vendor.city}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">Region / State</p>
                                <p className="text-xl font-bold text-slate-800">{vendor.regionState}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">Postal PIN Code</p>
                                <p className="text-xl font-bold text-slate-800 family-mono">{vendor.pinCode}</p>
                            </div>
                        </div>

                        <Divider className="m-0" />

                        <div className="p-8 border-b border-slate-100 bg-red-50/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Landmark className="text-red-600" size={20} />
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight italic">2. Primary Settlement Details (Step 1)</h2>
                            </div>
                            <Tag color="red" className="m-0 rounded-full font-black border-none px-4 text-[10px] shadow-sm">CORE BANKING</Tag>
                        </div>
                        <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                            <div className="md:col-span-2 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">Beneficiary Name (Bank Recorded)</p>
                                <p className="text-2xl font-black text-red-600 tracking-tight">{vendor.accountHolderName}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">Bank Institution</p>
                                <p className="text-lg font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                                    <Globe size={16} className="text-slate-400" /> {vendor.bankName}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">Country</p>
                                <p className="text-lg font-bold text-slate-800">{vendor.bankCountry}</p>
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">Branch Physical Address</p>
                                <p className="text-base font-semibold text-slate-600 leading-relaxed italic">{vendor.bankBranchAndAddress}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">Registered Account Number</p>
                                <p className="text-2xl font-black text-slate-900 tracking-widest family-mono">{vendor.accountNumber}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">Banking IFSC Code</p>
                                <p className="text-xl font-black text-indigo-600 tracking-widest family-mono">{vendor.ifscCode}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">MICR Tracking (9 digit)</p>
                                <p className="text-lg font-bold text-slate-800">{vendor.micrCode || 'NO-MICR'}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">Account Categorization</p>
                                <Tag className="text-sm font-bold px-4 py-1 rounded-lg border-slate-200 text-slate-600">{vendor.bankAccountTitle}</Tag>
                            </div>
                        </div>
                    </Card>

                    {/* Step 2 Additional Docs Section */}
                    {vendor.bankDetails && (
                        <Card className="rounded-[2.5rem] border-slate-100 shadow-xl shadow-slate-50 overflow-hidden">
                            <div className="p-8 border-b border-slate-50 bg-emerald-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className="text-emerald-600" size={20} />
                                    <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">3. Supplemental Verification (Step 2)</h2>
                                </div>
                                <Tag color="emerald" className="m-0 rounded-full font-black border-none px-4 text-[10px] shadow-sm">DOCS VERIFIED</Tag>
                            </div>
                            <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                <div>
                                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">Verification Beneficiary</p>
                                    <p className="text-lg font-bold text-slate-800">{vendor.bankDetails.beneficiaryName}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">Status Audit</p>
                                    <div className="flex items-center gap-2 text-emerald-600 font-black italic">
                                        <CheckCircle2 size={18} /> Verified Electronic Link
                                    </div>
                                </div>
                                {vendor.bankDetails.cancelledChequeUrl && (
                                    <div className="md:col-span-2">
                                        <div className="p-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400">
                                                    <FileText size={28} />
                                                </div>
                                                <div>
                                                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">Mandatory Verification Document</p>
                                                    <p className="text-lg font-black text-slate-800">Cancelled Cheque Proof</p>
                                                </div>
                                            </div>
                                            <Button
                                                size="large"
                                                icon={<ExternalLink size={20} />}
                                                href={vendor.bankDetails.cancelledChequeUrl}
                                                target="_blank"
                                                className="h-14 px-8 rounded-2xl font-black text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                            >
                                                View Source
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}
                </div>

                {/* Right Column - Secondary POC & MSME (Spans 4) */}
                <div className="lg:col-span-4 space-y-8">
                    {/* POC Card */}
                    <Card className="rounded-[2.5rem] border-slate-100 shadow-xl shadow-indigo-50/20 overflow-hidden">
                        <div className="p-8 bg-indigo-600 flex items-center gap-3">
                            <User className="text-white" size={20} />
                            <h2 className="text-lg font-black text-white uppercase tracking-tight">Point of Contact</h2>
                        </div>
                        <div className="p-10 space-y-10">
                            <div>
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-3">Principal Liaison</p>
                                <p className="text-2xl font-black text-slate-900 tracking-tighter">{vendor.contactPerson}</p>
                            </div>
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl group transition-all">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm">
                                        <Mail size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Official Email</p>
                                        <p className="text-sm font-black text-slate-700">{vendor.emailId}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl group transition-all">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-600 shadow-sm">
                                        <Phone size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Registered Mobile</p>
                                        <p className="text-sm font-black text-slate-700">{vendor.mobileNo}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* MSME Status Card */}
                    <Card className="rounded-[2.5rem] border-slate-100 shadow-xl shadow-slate-50 overflow-hidden">
                        <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                            <ShieldCheck className="text-indigo-600" size={20} />
                            <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Standardization</h2>
                        </div>
                        <div className="p-10 space-y-8">
                            <div>
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-3">Regulatory Tier</p>
                                <Tag
                                    color={vendor.msmeStatus === 'Yes' ? 'green' : 'default'}
                                    className="px-6 py-1.5 rounded-full font-black text-[11px] border-none shadow-sm uppercase tracking-widest"
                                >
                                    {vendor.msmeStatus === 'Yes' ? 'MSME REGISTERED' : 'STANDARD CATEGORY'}
                                </Tag>
                            </div>

                            {vendor.msmeCertificateUrl && (
                                <div className="pt-4 border-t border-slate-50">
                                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-3">Compliance Proof</p>
                                    <Button
                                        block
                                        icon={<ExternalLink size={16} />}
                                        className="h-12 rounded-xl font-bold flex items-center justify-center gap-2 text-indigo-600 border-indigo-100 hover:bg-slate-50"
                                        href={vendor.msmeCertificateUrl}
                                        target="_blank"
                                    >
                                        MSME Certificate
                                    </Button>
                                </div>
                            )}

                            <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Entry Date</span>
                                    <span className="text-sm font-black text-slate-800">{new Date(vendor.createdAt).toLocaleDateString()}</span>
                                </div>
                                <CheckCircle2 className="text-emerald-500" size={24} />
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

const ChevronRight = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
);
