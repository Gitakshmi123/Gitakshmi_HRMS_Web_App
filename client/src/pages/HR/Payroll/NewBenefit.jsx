import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Info, Loader2 } from 'lucide-react';
import api from '../../../utils/api';
import useToast from '../../../hooks/useToast';
import usePagePermissions from '../../../hooks/usePagePermissions';

const BENEFIT_TYPES = [
  'Leave Pay',
  'Employer PF',
  'Gratuity',
  'Employer Medical Insurance',
  'Custom Benefit'
];

export default function NewBenefit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { show } = useToast();
  const { canCreate, canEdit } = usePagePermissions('payroll.salary');
  const canAccessForm = isEdit ? canEdit : canCreate;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [existingBenefits, setExistingBenefits] = useState([]);
  const [customDraft, setCustomDraft] = useState({ name: '', payslipName: '' });

  const [form, setForm] = useState({
    benefitType: 'Leave Pay',
    name: 'Leave Pay',
    payslipName: 'Leave Pay',
    code: '',
    payType: 'FIXED',
    calculationType: 'FLAT',
    formula: '',
    formulaFrequency: 'MONTHLY',
    value: '',
    isActive: true,
    isTaxable: false,
    proRata: false,
    partOfSalaryStructure: true,
    considerForEPF: false,
    considerForESI: false,
    showInPayslip: false
  });

  useEffect(() => {
    const fetchList = async () => {
      try {
        const res = await api.get('/payroll/benefits');
        setExistingBenefits(res.data.data || []);
      } catch {
        // Non-fatal: duplicate validation can continue without the cached list.
      }
    };
    fetchList();

    if (isEdit) {
      const fetchOne = async () => {
        try {
          setFetching(true);
          const res = await api.get(`/payroll/benefits/${id}`);
          const item = res.data.data;
          if (item) {
            setForm(prev => ({
              ...prev,
              benefitType: item.benefitType || prev.benefitType,
              name: item.name,
              payslipName: item.payslipName,
              code: item.code || '',
              payType: item.payType || 'FIXED',
              calculationType: item.calculationType || 'FLAT',
              value: item.value !== undefined && item.value !== null ? item.value : '',
              isActive: item.isActive !== undefined ? item.isActive : true,
              isTaxable: item.isTaxable || false,
              proRata: item.proRata || false,
              partOfSalaryStructure: item.partOfSalaryStructure !== undefined ? item.partOfSalaryStructure : true,
              considerForEPF: item.considerForEPF || false,
              considerForESI: item.considerForESI || false,
              showInPayslip: item.showInPayslip || false
            }));
          } else setError('Benefit not found');
        } catch {
          setError('Failed to fetch benefit');
        } finally { setFetching(false); }
      };
      fetchOne();
    }
  }, [id, isEdit]);

  if (!canAccessForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit access disabled' : 'Create access disabled'}</h2>
          <p className="text-sm text-slate-500 mt-2">Only enabled payroll actions should open on this page.</p>
        </div>
      </div>
    );
  }

  const handleTypeChange = (e) => {
    const type = e.target.value;
    const updates = { benefitType: type };
    if (type === 'Custom Benefit') {
      updates.name = customDraft.name || '';
      updates.payslipName = customDraft.payslipName || '';
    } else {
      updates.name = type;
      updates.payslipName = type;
      setCustomDraft({ name: '', payslipName: '' });
    }
    setForm(prev => ({ ...prev, ...updates }));
    setFieldErrors({});
  };

  const customHandleChange = (field, value) => {
    if (form.benefitType === 'Custom Benefit') {
      const nextDraft = { ...customDraft, [field]: value };
      setCustomDraft(nextDraft);
      setForm(prev => ({ ...prev, [field]: value }));
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    } else {
      setForm(prev => ({ ...prev, [field]: value }));
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
    if (field === 'name' && !form.payslipName) {
      setForm(prev => ({ ...prev, payslipName: value }));
    }
    if (field === 'code') {
      setForm(prev => ({ ...prev, code: value }));
      return;
    }
  };

  const handleCheckbox = (field, checked) => setForm(prev => ({ ...prev, [field]: checked }));
  const _handleEPFChange = (enabled) => setForm(prev => ({ ...prev, epf: { ...prev.epf, enabled } }));
  const _handleEPFRuleChange = (rule) => setForm(prev => ({ ...prev, epf: { ...prev.epf, rule } }));
  const _handleESIChange = (enabled) => setForm(prev => ({ ...prev, esi: { ...prev.esi, enabled } }));

  const validate = () => {
    const errs = {};
    const name = (form.name || '').toString();
    if (!name.trim()) errs.name = 'Benefit Name is required';
    else if (name !== name.trim()) errs.name = 'No leading or trailing spaces allowed';

    if (form.calculationType === 'FORMULA' && !form.formula.trim()) errs.formula = 'Formula is required';
    if (form.calculationType !== 'FORMULA' && (form.value === '' || Number(form.value) <= 0)) errs.value = 'Valid value is required';

    const normalized = name.trim().toLowerCase();
    if (normalized) {
      const dup = existingBenefits.find(e => e.name && e.name.toString().toLowerCase() === normalized && e._id !== id);
      if (dup) errs.name = 'A benefit with this name already exists';
    }

    // code removed; no client-side code uniqueness check

    setFieldErrors(errs);
    return Object.keys(errs).length ? errs : null;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (errs) { setError('Please fix the highlighted errors'); return; }
    try {
      setError(null);
      setLoading(true);

      const sanitizeValue = (v) => {
        if (v === undefined || v === null) return 0;
        const s = v.toString().replace(/%/g, '').replace(/,/g, '').trim();
        return Number(s);
      };

      const mapBenefitType = (label) => {
        if (!label) return 'CUSTOM';
        const l = label.toString().toLowerCase();
        if (l.includes('employer pf') || l.includes('pf')) return 'EMPLOYER_PF';
        if (l.includes('gratuity')) return 'GRATUITY';
        if (l.includes('medical') || l.includes('insurance')) return 'INSURANCE';
        return 'CUSTOM';
      };

      const backendBenefitType = mapBenefitType(form.benefitType);
      const payload = {
        name: form.name.trim(),
        code: form.code && form.code.trim() ? form.code.trim().toUpperCase() : form.name.trim().toUpperCase().replace(/\s+/g, "_"),
        benefitType: backendBenefitType,
        payType: form.payType,
        calculationType: (form.calculationType === 'PERCENT_OF_BASIC' || form.calculationType === 'PERCENT_OF_CTC' || form.calculationType === 'FORMULA') ? form.calculationType : 'FLAT',
        value: sanitizeValue(form.value),
        formula: form.formula,
        formulaFrequency: form.formulaFrequency,
        partOfSalaryStructure: !!form.partOfSalaryStructure,
        isTaxable: !!form.isTaxable,
        proRata: !!form.proRata,
        considerForEPF: !!form.considerForEPF,
        considerForESI: !!form.considerForESI,
        showInPayslip: !!form.showInPayslip,
        isActive: !!form.isActive
      };

      if (isEdit) await api.put(`/payroll/benefits/${id}`, payload);
      else await api.post('/payroll/benefits', payload);

      show({ message: isEdit ? 'Benefit updated' : 'Benefit created', type: 'success' });
      navigate('/hr/payroll/salary-components');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save benefit';
      setError(msg);
      show({ message: msg, type: 'error' });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500"><ArrowLeft size={20} /></button>
              <h1 className="text-xl font-bold text-slate-900">{isEdit ? `Edit ${form.name || 'Benefit'}` : 'New Benefit'}</h1>
            </div>
            <button className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">Page Tips <Info size={14} /></button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm flex items-center gap-2"><Info size={16} /> {error}</div>
        )}

        {fetching ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
            <p className="text-slate-500 font-medium">Fetching benefit details...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Benefit Type <span className="text-rose-500">*</span></label>
                  <select value={form.benefitType} onChange={handleTypeChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all">
                    {BENEFIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Benefit Name <span className="text-rose-500">*</span></label>
                    <input name="name" required type="text" value={form.name} onChange={e => customHandleChange('name', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="e.g. Employer Provident Fund" />
                    {fieldErrors.name && (<p className="text-rose-600 text-xs mt-1">{fieldErrors.name}</p>)}
                    <p className="text-[10px] text-slate-400 mt-2">Payslip name will be derived from the Benefit Name automatically.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Code (optional)</label>
                  <input type="text" value={form.code} onChange={e => customHandleChange('code', e.target.value)} className="w-48 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="AUTO from name" />
                  <p className="text-[10px] text-slate-400 mt-2">Leave empty to auto-generate a code from the name.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Pay Type <span className="text-rose-500">*</span></label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="payType" checked={form.payType === 'FIXED'} onChange={() => customHandleChange('payType', 'FIXED')} className="w-4 h-4 text-blue-600" /> <span className="text-sm font-medium text-slate-700">Fixed Pay</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="payType" checked={form.payType === 'VARIABLE'} onChange={() => customHandleChange('payType', 'VARIABLE')} className="w-4 h-4 text-blue-600" /> <span className="text-sm font-medium text-slate-700">Variable Pay</span></label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Calculation Type <span className="text-rose-500">*</span></label>
                  <div className="flex gap-6 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="calcType" checked={form.calculationType === 'FLAT'} onChange={() => customHandleChange('calculationType', 'FLAT')} className="w-4 h-4 text-blue-600" /> <span className="text-sm font-medium text-slate-700">Flat Amount</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="calcType" checked={form.calculationType === 'PERCENT_OF_BASIC'} onChange={() => customHandleChange('calculationType', 'PERCENT_OF_BASIC')} className="w-4 h-4 text-blue-600" /> <span className="text-sm font-medium text-slate-700">Percent of Basic</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="calcType" checked={form.calculationType === 'PERCENT_OF_CTC'} onChange={() => customHandleChange('calculationType', 'PERCENT_OF_CTC')} className="w-4 h-4 text-blue-600" /> <span className="text-sm font-medium text-slate-700">Percent of CTC</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="calcType" checked={form.calculationType === 'FORMULA'} onChange={() => customHandleChange('calculationType', 'FORMULA')} className="w-4 h-4 text-blue-600" /> <span className="text-sm font-medium text-slate-700">Custom Formula</span></label>
                  </div>

                  <div>
                    {form.calculationType === 'FLAT' && (
                      <div className="relative max-w-xs">
                        <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                        <input type="number" min="0" value={form.value} onChange={e => customHandleChange('value', e.target.value)} className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="0.00" />
                        {fieldErrors.value && (<p className="text-rose-600 text-xs mt-1">{fieldErrors.value}</p>)}
                      </div>
                    )}
                    {(form.calculationType === 'PERCENT_OF_BASIC' || form.calculationType === 'PERCENT_OF_CTC') && (
                      <div className="relative max-w-xs">
                        <input type="number" min="0" max="100" value={form.value} onChange={e => customHandleChange('value', e.target.value)} className="w-full pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="0.00" />
                        <span className="absolute right-3 top-2.5 text-slate-400 font-bold">%</span>
                        {fieldErrors.value && (<p className="text-rose-600 text-xs mt-1">{fieldErrors.value}</p>)}
                      </div>
                    )}
                    {form.calculationType === 'FORMULA' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Formula Expression</label>
                          <textarea
                            value={form.formula}
                            onChange={e => customHandleChange('formula', e.target.value)}
                            className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            rows="2"
                            placeholder="e.g. (BASIC + HRA) * 0.1"
                          />
                          {fieldErrors.formula && (<p className="text-rose-600 text-xs mt-1">{fieldErrors.formula}</p>)}
                          <p className="text-[10px] text-slate-400 mt-2">Available: BASIC, HRA, GROSS, CTC, NET</p>
                        </div>
                        <div className="flex gap-4">
                          <select
                            value={form.formulaFrequency}
                            onChange={e => customHandleChange('formulaFrequency', e.target.value)}
                            className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600"
                          >
                            <option value="MONTHLY">Monthly Result</option>
                            <option value="ANNUAL">Annual Result</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={(e) => handleCheckbox('isActive', e.target.checked)} className="w-4 h-4 text-blue-600" /> <span className="text-sm font-semibold text-slate-700">Mark this benefit as Active</span></label>
                </div>
              </div>
            </div>

            <div className="md:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Configuration</h3>
                <div className="space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer group"><input type="checkbox" checked={form.partOfSalaryStructure} onChange={(e) => handleCheckbox('partOfSalaryStructure', e.target.checked)} className="mt-1 w-4 h-4 text-blue-600" /> <div className="text-sm"><span className="font-medium text-slate-700 block">part of salary structure</span><span className="text-xs text-slate-400">Component appears in CTC</span></div></label>

                  <label className="flex items-start gap-3 cursor-pointer group"><input type="checkbox" checked={form.isTaxable} onChange={(e) => handleCheckbox('isTaxable', e.target.checked)} className="mt-1 w-4 h-4 text-blue-600" /> <div className="text-sm"><span className="font-medium text-slate-700 block">Is Taxable</span><span className="text-xs text-slate-400">Subject to TDS</span></div></label>

                  <label className={`flex items-start gap-3 group`}><input type="checkbox" checked={form.proRata} onChange={(e) => handleCheckbox('proRata', e.target.checked)} className="mt-1 w-4 h-4 text-blue-600" /> <div className="text-sm"><span className="font-medium text-slate-700 block">Pro-rata Basis</span><span className="text-xs text-slate-400">Calculated based on attendance</span></div></label>

                  <div className="my-4 border-t border-slate-100"></div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3"><input type="checkbox" checked={form.considerForEPF} onChange={(e) => handleCheckbox('considerForEPF', e.target.checked)} className="w-4 h-4 text-blue-600" /> <span className="text-sm font-medium text-slate-700">Consider for EPF</span></label>
                  </div>

                  <div className="pt-2"><label className="flex items-center gap-3"><input type="checkbox" checked={form.considerForESI} onChange={(e) => handleCheckbox('considerForESI', e.target.checked)} className="w-4 h-4 text-blue-600" /> <span className="text-sm font-medium text-slate-700">Consider for ESI</span></label></div>

                  <div className="my-4 border-t border-slate-100"></div>

                  <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.showInPayslip} onChange={(e) => handleCheckbox('showInPayslip', e.target.checked)} className="w-4 h-4 text-blue-600" /> <span className="text-sm font-medium text-slate-700">Show in Payslip</span></label>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100"><p className="text-xs text-blue-700"><span className="font-bold">Note:</span> Benefits increase CTC but do not affect monthly take-home unless explicitly configured. They are not treated as earnings.</p></div>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-end gap-4 border-t border-slate-200 pt-6">
          <button onClick={() => navigate(-1)} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-transparent">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || fetching} className="px-8 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2">{loading && <Loader2 className="w-4 h-4 animate-spin" />} {isEdit ? 'Update Benefit' : 'Save Benefit'}</button>
        </div>
      </div>
    </div>
  );
}
