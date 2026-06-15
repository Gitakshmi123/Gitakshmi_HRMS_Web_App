import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    FileSpreadsheet,
    ChevronLeft,
    Save,
    Loader2
} from 'lucide-react';
import { Button, Form } from 'antd';
import api from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';
import { renderFormFields } from '../../utils/vendorFormRenderer';

export default function VendorFormDetailed() {
    const navigate = useNavigate();
    const { vendorId } = useParams();
    const [loading, setLoading] = useState(false);
    const [formLoading, setFormLoading] = useState(true);
    const [form] = Form.useForm();
    const [config, setConfig] = useState(null);

    const DEFAULT_CONFIG = {
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


    useEffect(() => {
        const init = async () => {
            setFormLoading(true);
            try {
                // 1. Fetch Config
                let configToUse = DEFAULT_CONFIG;
                try {
                    const confRes = await api.get('/vendor/form-config/step2');
                    if (confRes.data.success && confRes.data.data) {
                        configToUse = confRes.data.data;
                    }
                } catch (e) {
                    console.error("Config fetch failed, using default", e);
                }
                setConfig(configToUse);

                // 2. Fetch Data if editing
                if (vendorId) {
                    const res = await api.get(`/vendor/${vendorId}`);
                    if (res.data.success) {
                        const data = res.data.data;
                        form.setFieldsValue({
                            ...data,
                            ...data.bankDetails
                        });
                    }
                }
            } catch (error) {
                console.error('Fetch error:', error);
            } finally {
                setFormLoading(false);
            }
        };
        init();
    }, [vendorId, form]);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const res = await api.post('/vendor/register-step2', {
                ...values,
                vendorId: vendorId
            });
            if (res.data.success) {
                showToast('success', 'Master Records Saved', 'Complete vendor master profile has been updated.');
                navigate('/employee/vendor/list');
            }
        } catch (error) {
            showToast('error', 'Submission Failed', 'Check required fields.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-700 pb-20 px-4">
            {/* Header matches Step 1 */}
            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-50 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="p-5 bg-indigo-600 rounded-[2rem] shadow-2xl shadow-indigo-100">
                        <FileSpreadsheet className="text-white" size={36} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Vendor Master Profile</h1>
                        <p className="text-slate-400 font-bold text-lg mt-1 italic">Detailed ERP configuration registry</p>
                    </div>
                </div>
                <Button
                    icon={<ChevronLeft size={20} />}
                    onClick={() => navigate(-1)}
                    className="h-14 px-8 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400 hover:text-indigo-600 border-slate-200"
                >
                    Back to Basic Info
                </Button>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                autoComplete="off"
                className="space-y-8"
            >
                {/* Dynamically Rendered Fields */}
                {formLoading ? (
                    <div className="flex justify-center p-20 bg-white rounded-[2.5rem]">
                        <Loader2 className="animate-spin text-indigo-600" size={48} />
                    </div>
                ) : (
                    renderFormFields(config, form)
                )}

                {/* Footer Actions */}
                <div className="p-12 bg-slate-900 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8 rounded-[3rem] shadow-2xl shadow-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-600/30 shadow-inner shadow-indigo-500/10">
                            <Save size={28} />
                        </div>
                        <div>
                            <p className="text-white font-black text-xl tracking-tight">Save Master Profile</p>
                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Commit changes to database</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <Button
                            size="large"
                            onClick={() => navigate('/employee/vendor/list')}
                            className="h-16 px-10 rounded-2xl font-black uppercase text-xs text-slate-400 border-slate-700 hover:text-white hover:border-white transition-all bg-transparent"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="primary"
                            size="large"
                            htmlType="submit"
                            loading={loading}
                            className="h-18 px-16 rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all font-black text-xl shadow-2xl shadow-indigo-600/20 border-none flex items-center gap-4"
                        >
                            Save Configuration <Save size={24} />
                        </Button>
                    </div>
                </div>
            </Form>
        </div>
    );
}
