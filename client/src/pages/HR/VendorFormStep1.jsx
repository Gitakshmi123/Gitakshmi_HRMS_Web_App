import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Briefcase,
    ShieldCheck,
    Building2,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { Button, Form } from 'antd';
import { message } from '../../utils/antdGlobal';
import api from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';
import { renderFormFields } from '../../utils/vendorFormRenderer';

export default function VendorRegistration() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formLoading, setFormLoading] = useState(true);
    const [form] = Form.useForm();
    const [config, setConfig] = useState(null);

    // Default configuration to use while loading or fallback
    const DEFAULT_CONFIG = {
        sections: [
            { id: 'sec_identity', title: 'Part 1. Entity Identification & Geography', order: 1 },
            { id: 'sec_banking', title: 'Part 2. Integrated Banking & Settlement Node', order: 2 },
            { id: 'sec_compliance', title: 'Part 3. Regulatory Compliance & Direct Liaison', order: 3 }
        ],
        fields: [
            // Section 1
            { id: 'f_vendorName', label: 'Vendor Legal Name', placeholder: 'FULL LEGAL BUSINESS NAME AS PER PAN/GST', fieldType: 'text', required: true, width: 'full', section: 'sec_identity', order: 1, dbKey: 'vendorName' },
            { id: 'f_city', label: 'City Jurisdiction', placeholder: '', fieldType: 'text', required: true, width: 'quarter', section: 'sec_identity', order: 2, dbKey: 'city' },
            { id: 'f_state', label: 'Region (STATE)', placeholder: '', fieldType: 'text', required: true, width: 'half', section: 'sec_identity', order: 3, dbKey: 'regionState' },
            { id: 'f_pin', label: 'Postal PIN Code', placeholder: '', fieldType: 'text', required: true, width: 'quarter', section: 'sec_identity', order: 4, dbKey: 'pinCode' },

            // Section 2
            { id: 'f_bankName', label: 'Bank Institution Name', placeholder: '', fieldType: 'text', required: true, width: 'full', section: 'sec_banking', order: 1, dbKey: 'bankName' },
            { id: 'f_bankCountry', label: 'Bank Country', placeholder: '', fieldType: 'text', required: true, width: 'full', section: 'sec_banking', order: 2, dbKey: 'bankCountry' },
            { id: 'f_accTitle', label: 'Account Title Mode', placeholder: '', fieldType: 'select', required: true, width: 'full', section: 'sec_banking', order: 3, dbKey: 'bankAccountTitle', dropdownOptions: [{ label: 'Cash Credit', value: 'Cash Credit' }, { label: 'Current', value: 'Current' }, { label: 'Savings', value: 'Saving' }, { label: 'Overdraft', value: 'OD' }] },
            { id: 'f_branch', label: 'Branch Physical Address', placeholder: 'ENTER FULL BRANCH ADDRESS...', fieldType: 'textarea', required: true, width: 'full', section: 'sec_banking', order: 4, dbKey: 'bankBranchAndAddress' },
            { id: 'f_accNo', label: 'Registered Account Number', placeholder: '', fieldType: 'text', required: true, width: 'full', section: 'sec_banking', order: 5, dbKey: 'accountNumber' },
            { id: 'f_ifsc', label: 'IFSC/SWIFT Code', placeholder: '', fieldType: 'text', required: true, width: 'full', section: 'sec_banking', order: 6, dbKey: 'ifscCode' },
            { id: 'f_micr', label: 'MICR Code (9 Digital)', placeholder: '', fieldType: 'text', required: false, width: 'full', section: 'sec_banking', order: 7, dbKey: 'micrCode' },
            { id: 'f_beneName', label: 'Beneficiary Name (Bank Recorded)', placeholder: 'EXACT NAME AS PER CHEQUE LEAF', fieldType: 'text', required: true, width: 'half', section: 'sec_banking', order: 8, dbKey: 'accountHolderName' },
            { id: 'f_cheque', label: 'Cancelled Cheque Leaf', placeholder: 'Upload Proof', fieldType: 'file', required: true, width: 'quarter', section: 'sec_banking', order: 9, dbKey: 'cancelledChequeUrl' },

            // Section 3
            { id: 'f_msme', label: 'MSME Registration Status', placeholder: '', fieldType: 'select', required: true, width: 'third', section: 'sec_compliance', order: 1, dbKey: 'msmeStatus', dropdownOptions: [{ label: 'REGISTERED MSME', value: 'Yes' }, { label: 'NON-MSME / STANDARD', value: 'No' }] },
            { id: 'f_msmeCert', label: 'MSME Certificate', placeholder: 'Choose Certificate', fieldType: 'file', required: false, width: 'third', section: 'sec_compliance', order: 2, dbKey: 'msmeCertificateUrl' },
            { id: 'f_contact', label: 'Contact Person Liaison', placeholder: '', fieldType: 'text', required: true, width: 'half', section: 'sec_compliance', order: 3, dbKey: 'contactPerson' },
            { id: 'f_email', label: 'Direct E-Mail ID', placeholder: '', fieldType: 'email', required: true, width: 'half', section: 'sec_compliance', order: 4, dbKey: 'emailId' },
            { id: 'f_mobile', label: 'Official Mobile No.', placeholder: '', fieldType: 'phone', required: true, width: 'full', section: 'sec_compliance', order: 5, dbKey: 'mobileNo' }
        ]
    };

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await api.get('/vendor/form-config/step1');
                if (res.data.success && res.data.data) {
                    setConfig(res.data.data);
                } else {
                    setConfig(DEFAULT_CONFIG);
                }
            } catch (error) {
                console.error("Failed to load form config, using default", error);
                setConfig(DEFAULT_CONFIG);
            } finally {
                setFormLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleFileUpload = async (info, fieldName) => {
        if (info.file.status === 'uploading') return;
        if (info.file.status === 'done') {
            // Ant Design Upload handles status 'done' automatically if action is set, 
            // but we are using custom upload.
            // We can check info.file.response if we used action prop.
            return;
        }

        const fd = new FormData();
        fd.append('file', info.file.originFileObj);
        try {
            const res = await api.post('/uploads/doc', fd);
            if (res.data.success) {
                form.setFieldsValue({ [fieldName]: res.data.url });
                message.success('File uploaded successfully');
            }
        } catch (error) {
            message.error('File upload failed');
        }
    };

    const onFinish = async (values) => {
        setLoading(true);
        try {
            // Step 1: Create Main Vendor Entity
            const res1 = await api.post('/vendor/register-step1', values);

            if (res1.data.success) {
                // Step 2: Associate Bank Details (using the same unified payload)
                // We send the same values to step 2 endpoint as it expects bank details
                await api.post('/vendor/register-step2', {
                    ...values,
                    vendorId: res1.data.data._id,
                    beneficiaryName: values.accountHolderName
                });

                showToast('success', 'Step 1 Saved', 'Basic registration complete completely.');
                navigate(`/employee/vendor/step2/${res1.data.data._id}`);
            }
        } catch (error) {
            showToast('error', 'Submission Failed', error.response?.data?.message || 'Please check all required fields.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-[1500px] mx-auto space-y-8 animate-in fade-in duration-700 pb-20 px-4">
            {/* Unified One-Page Header */}
            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-50 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="p-5 bg-indigo-600 rounded-[2rem] shadow-2xl shadow-indigo-100">
                        <Briefcase className="text-white" size={36} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Vendor Enrollment Form</h1>
                        <p className="text-slate-400 font-bold text-lg mt-1 italic">Single-Page Unified Registration Portal</p>
                    </div>
                </div>
                <div className="hidden lg:flex items-center gap-3 px-8 py-4 bg-emerald-50 text-emerald-700 rounded-3xl font-black border border-emerald-100 uppercase tracking-widest text-sm shadow-sm transition-transform hover:scale-105">
                    <ShieldCheck size={24} /> Official Registry
                </div>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                autoComplete="off"
                initialValues={{ msmeStatus: 'No', bankAccountTitle: 'Current' }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
                {/* Unified Main Body */}
                <div className="lg:col-span-12 space-y-8">
                    {formLoading ? (
                        <div className="flex justify-center p-20">
                            <Loader2 className="animate-spin text-indigo-600" size={48} />
                        </div>
                    ) : (
                        renderFormFields(config, form, handleFileUpload)
                    )}

                    {/* FINAL SUBMIT */}
                    <div className="p-12 bg-slate-900 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8 rounded-[3rem] shadow-2xl shadow-slate-200">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-600/30 shadow-inner shadow-indigo-500/10">
                                <Building2 size={28} />
                            </div>
                            <div>
                                <p className="text-white font-black text-xl tracking-tight">Final Authorization</p>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Submit to GT_HRMS Permanent Registry</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <Button size="large" onClick={() => navigate('/employee/vendor/list')} className="h-16 px-10 rounded-2xl font-black uppercase text-xs text-slate-400 border-slate-700 hover:text-white hover:border-white transition-all bg-transparent">Cancel</Button>

                            <button
                                type="button"
                                onClick={() => navigate('/employee/vendor/step2')}
                                className="h-16 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 border border-slate-800 hover:border-slate-600 hover:text-slate-200 transition-all flex items-center gap-2"
                            >
                                Preview Master Form <ChevronRight size={14} />
                            </button>

                            <Button
                                type="primary"
                                size="large"
                                htmlType="submit"
                                loading={loading}
                                className="h-18 px-20 rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all font-black text-xl shadow-2xl shadow-indigo-600/20 border-none flex items-center gap-4"
                            >
                                Save & Open Master Form <ChevronRight size={24} />
                            </Button>
                        </div>
                    </div>
                </div>
            </Form>

            <style>{`
                .ant-form-item-label { padding-bottom: 8px !important; }
                .ant-input:focus, .ant-input-focused { border-color: #4f46e5 !important; box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1) !important; }
                .ant-select-selector { border-radius: 1rem !important; height: 56px !important; display: flex !important; align-items: center !important; }
                .ant-card { overflow: visible !important; }
            `}</style>
        </div>
    );
}
