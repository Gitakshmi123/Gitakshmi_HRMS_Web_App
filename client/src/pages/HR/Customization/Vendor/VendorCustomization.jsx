import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Segmented, Button } from 'antd';
import { message } from '../../../../utils/antdGlobal';
import { Save, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import VendorBuilder from '../../../../components/vendor-builder/VendorBuilder';
import api from '../../../../utils/api';

const DEFAULT_CONFIG_STEP1 = {
    formType: 'step1',
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

const DEFAULT_CONFIG_STEP2 = {
    formType: 'step2',
    sections: [
        { id: 'sec_m_gen', title: 'Part 1: Master General Data', order: 1 },
        { id: 'sec_m_bank', title: 'Part 2: Master Settlement Node', order: 2 },
        { id: 'sec_m_tax', title: 'Part 3: Compliance & Tax Configuration', order: 3 },
        { id: 'sec_m_erp', title: 'Part 4: ERP Configuration Node', order: 4 }
    ],
    fields: [
        // Section 1
        { id: 'f_scode', label: 'Vendor Code', placeholder: 'SYSTEM GENERATED', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_gen', order: 1, dbKey: 'vendorCode' },
        { id: 'f_cocode', label: 'Co Code', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_gen', order: 2, dbKey: 'coCode' },
        { id: 'f_purorg', label: 'Pur Org.', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_gen', order: 3, dbKey: 'purOrg' },
        { id: 'f_vac', label: 'Vendor Account', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_gen', order: 4, dbKey: 'vendorAccount' },
        { id: 'f_title', label: 'Vendor Title', placeholder: '', fieldType: 'select', required: false, width: 'quarter', section: 'sec_m_gen', order: 5, dbKey: 'title', dropdownOptions: [{ label: 'Mr.', value: 'Mr.' }, { label: 'Ms.', value: 'Ms.' }, { label: 'Company', value: 'Company' }] },
        { id: 'f_vname', label: 'Vendor Name', placeholder: '', fieldType: 'text', required: false, width: 'half', section: 'sec_m_gen', order: 6, dbKey: 'vendorName' },
        { id: 'f_add1', label: 'Address Line 1', placeholder: '', fieldType: 'text', required: false, width: 'half', section: 'sec_m_gen', order: 7, dbKey: 'address1' },
        { id: 'f_add2', label: 'Address Line 2', placeholder: '', fieldType: 'text', required: false, width: 'half', section: 'sec_m_gen', order: 8, dbKey: 'address2' },
        { id: 'f_add3', label: 'Address Line 3', placeholder: '', fieldType: 'text', required: false, width: 'half', section: 'sec_m_gen', order: 9, dbKey: 'address3' },
        { id: 'f_house', label: 'House No.', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_gen', order: 10, dbKey: 'houseNo' },
        { id: 'f_spin', label: 'Postal PIN code', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_gen', order: 11, dbKey: 'pinCode' },

        // Section 2
        { id: 'f_mbank', label: 'Bank Name', placeholder: '', fieldType: 'text', required: false, width: 'third', section: 'sec_m_bank', order: 1, dbKey: 'bankName' },
        { id: 'f_macc', label: 'Account Number', placeholder: '', fieldType: 'text', required: false, width: 'third', section: 'sec_m_bank', order: 2, dbKey: 'accountNumber' },
        { id: 'f_mhold', label: 'Account Holder', placeholder: '', fieldType: 'text', required: false, width: 'third', section: 'sec_m_bank', order: 3, dbKey: 'accountHolderName' },
        { id: 'f_mifsc', label: 'IFSC Code', placeholder: '', fieldType: 'text', required: false, width: 'third', section: 'sec_m_bank', order: 4, dbKey: 'ifscCode' },
        { id: 'f_mbranch', label: 'Branch Name', placeholder: '', fieldType: 'text', required: false, width: 'third', section: 'sec_m_bank', order: 5, dbKey: 'bankBranchName' },
        { id: 'f_macctype', label: 'Account Type', placeholder: '', fieldType: 'select', required: false, width: 'third', section: 'sec_m_bank', order: 6, dbKey: 'accountType', dropdownOptions: [{ label: 'Current', value: 'Current' }, { label: 'Savings', value: 'Savings' }] },
        { id: 'f_mpay', label: 'Payment Method', placeholder: '', fieldType: 'text', required: false, width: 'third', section: 'sec_m_bank', order: 7, dbKey: 'paymentMethod' },
        { id: 'f_mterm', label: 'Payment Terms', placeholder: '', fieldType: 'text', required: false, width: 'third', section: 'sec_m_bank', order: 8, dbKey: 'paymentTerms' },
        { id: 'f_mcurr', label: 'Currency', placeholder: 'INR / USD', fieldType: 'text', required: false, width: 'third', section: 'sec_m_bank', order: 9, dbKey: 'currency' },

        // Section 3
        { id: 'f_ssi', label: 'SSI REGISTRATION No.', placeholder: '', fieldType: 'text', required: false, width: 'full', section: 'sec_m_tax', order: 1, dbKey: 'ssiRegistrationNo' },
        { id: 'f_pan', label: 'PAN No.', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_tax', order: 2, dbKey: 'panNo' },
        { id: 'f_gst', label: 'Permanent GST no.', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_tax', order: 3, dbKey: 'permanentGstNo' },
        { id: 'f_vat', label: 'VAT No.', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_tax', order: 4, dbKey: 'vat' },
        { id: 'f_stax', label: 'SERVICE TAX No.', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_tax', order: 5, dbKey: 'serviceTaxNo' },
        { id: 'f_erex', label: 'Excise Reg', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_tax', order: 6, dbKey: 'exciseReg' },
        { id: 'f_eran', label: 'Excise Range', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_tax', order: 7, dbKey: 'exciseRange' },
        { id: 'f_ediv', label: 'Excise Division', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_tax', order: 8, dbKey: 'exciseDivision' },
        { id: 'f_ecom', label: 'Commissionerate', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_tax', order: 9, dbKey: 'commissionerate' },

        // Section 4
        { id: 'f_ind', label: 'Industry Category', placeholder: '', fieldType: 'select', required: false, width: 'quarter', section: 'sec_m_erp', order: 1, dbKey: 'industryCategory', dropdownOptions: [{ label: 'IT Services', value: 'IT' }, { label: 'Manufacturing', value: 'Manufacturing' }] },
        { id: 'f_inco1', label: 'Inco Terms', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_erp', order: 2, dbKey: 'incoTerms' },
        { id: 'f_inco2', label: 'Inco Terms 2', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_erp', order: 3, dbKey: 'incoTerms2' },
        { id: 'f_lang', label: 'Language', placeholder: '', fieldType: 'text', required: false, width: 'quarter', section: 'sec_m_erp', order: 4, dbKey: 'language' },
        { id: 'f_esales', label: 'Sales Email', placeholder: '', fieldType: 'email', required: false, width: 'quarter', section: 'sec_m_erp', order: 5, dbKey: 'emailSales' },
        { id: 'f_efin', label: 'Finance Email', placeholder: '', fieldType: 'email', required: false, width: 'quarter', section: 'sec_m_erp', order: 6, dbKey: 'emailFinance' },
        { id: 'f_edes', label: 'Despatch Email', placeholder: '', fieldType: 'email', required: false, width: 'quarter', section: 'sec_m_erp', order: 7, dbKey: 'emailDespatch' },
        { id: 'f_gstc', label: 'GST Classification', placeholder: '', fieldType: 'select', required: false, width: 'quarter', section: 'sec_m_erp', order: 8, dbKey: 'gstClassification', dropdownOptions: [{ label: 'Registered', value: 'Registered' }, { label: 'Unregistered', value: 'Unregistered' }] }
    ]
};

export default function VendorCustomization() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState('step1'); // 'step1' or 'step2'
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState(DEFAULT_CONFIG_STEP1);

    useEffect(() => {
        fetchConfig();
    }, [currentStep]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            // Check if config exists on backend
            const res = await api.get(`/vendor/form-config/${currentStep}`);
            if (res.data.success && res.data.data) {
                setConfig(res.data.data);
            } else {
                // Use default if no server config
                setConfig(currentStep === 'step1' ? DEFAULT_CONFIG_STEP1 : DEFAULT_CONFIG_STEP2);
            }
        } catch (error) {
            console.error("Config fetch error:", error);
            // Default on error
            setConfig(currentStep === 'step1' ? DEFAULT_CONFIG_STEP1 : DEFAULT_CONFIG_STEP2);
        } finally {
            setLoading(false);
        }
    };


    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api.post(`/vendor/form-config/${currentStep}`, config);
            if (res.data.success) {
                message.success("Form configuration saved successfully!");
            } else {
                throw new Error(res.data.error || "Unknown server error");
            }
        } catch (error) {
            console.error("Save error:", error);
            const msg = error.response?.data?.error || error.response?.data?.message || error.message;
            message.error(`Failed to save changes: ${msg}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-7rem)] bg-slate-50 overflow-hidden font-sans rounded-[2rem] border border-slate-200 shadow-sm">
            {/* Top Toolbar */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-40 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => window.history.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 tracking-tight">Vendor Form Builder</h1>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">• Customizing Registry Forms</p>
                    </div>
                </div>

                <Segmented
                    options={[
                        { label: 'Basic Form (Step 1)', value: 'step1' },
                        { label: 'Master Form (Step 2)', value: 'step2' }
                    ]}
                    value={currentStep}
                    onChange={setCurrentStep}
                    className="bg-slate-100 p-1 font-bold text-xs"
                />

                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mr-2">Changes require saving</span>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all active:scale-95 disabled:opacity-50 text-xs uppercase tracking-wider"
                    >
                        {saving ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                        Save Changes
                    </button>
                </div>
            </header>

            {/* Builder Content */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                </div>
            ) : (
                <VendorBuilder
                    config={config}
                    onChange={setConfig}
                />
            )}
        </div>
    );
}
