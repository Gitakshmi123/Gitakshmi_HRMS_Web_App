import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import {
  FileText,
  Download,
  Calendar,
  Eye,
  X,
  RefreshCw,
  ChevronRight,
  CreditCard,
  Wallet,
  Landmark,
  Save,
  ShieldCheck,
  History,
} from 'lucide-react';
import { showToast } from '../../utils/uiNotifications';

const EMPTY_TAX_FORM = {
  effectiveFrom: new Date().toISOString().slice(0, 10),
  regime: 'NEW',
  proofStatus: 'NOT_SUBMITTED',
  notes: '',
  section80C: '',
  section80CCD1B: '',
  section80D: '',
  hraExemption: '',
  homeLoanInterest: '',
  otherExemptions: '',
  previousEmployerIncome: '',
  otherIncome: '',
  bonusProjection: '',
  taxAlreadyDeducted: '',
  monthlyTDS: '',
  annualTaxableIncome: '',
};

const PROOF_STATUS_OPTIONS = [
  'NOT_SUBMITTED',
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
];

const formatCurrency = (value) => `Rs. ${(Number(value) || 0).toLocaleString('en-IN')}`;

const normalizeNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toInputValue = (value) => (value === null || value === undefined ? '' : String(value));

const mapProfileToForm = (payload = {}) => {
  const profile = payload?.effectiveProfile || {};
  const declarations = profile.declarations || {};
  const projections = profile.projections || {};
  const overrides = profile.overrides || {};

  return {
    effectiveFrom: profile.effectiveFrom ? new Date(profile.effectiveFrom).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    regime: profile.regime || 'NEW',
    proofStatus: profile.proofStatus || 'NOT_SUBMITTED',
    notes: profile.notes || '',
    section80C: toInputValue(declarations.section80C),
    section80CCD1B: toInputValue(declarations.section80CCD1B),
    section80D: toInputValue(declarations.section80D),
    hraExemption: toInputValue(declarations.hraExemption),
    homeLoanInterest: toInputValue(declarations.homeLoanInterest),
    otherExemptions: toInputValue(declarations.otherExemptions),
    previousEmployerIncome: toInputValue(projections.previousEmployerIncome),
    otherIncome: toInputValue(projections.otherIncome),
    bonusProjection: toInputValue(projections.bonusProjection),
    taxAlreadyDeducted: toInputValue(projections.taxAlreadyDeducted),
    monthlyTDS: toInputValue(overrides.monthlyTDS),
    annualTaxableIncome: toInputValue(overrides.annualTaxableIncome),
  };
};

const buildSavePayload = (form) => ({
  effectiveFrom: form.effectiveFrom,
  regime: form.regime,
  proofStatus: form.proofStatus,
  closePrevious: true,
  notes: form.notes,
  declarations: {
    section80C: normalizeNumber(form.section80C),
    section80CCD1B: normalizeNumber(form.section80CCD1B),
    section80D: normalizeNumber(form.section80D),
    hraExemption: normalizeNumber(form.hraExemption),
    homeLoanInterest: normalizeNumber(form.homeLoanInterest),
    otherExemptions: normalizeNumber(form.otherExemptions),
  },
  projections: {
    previousEmployerIncome: normalizeNumber(form.previousEmployerIncome),
    otherIncome: normalizeNumber(form.otherIncome),
    bonusProjection: normalizeNumber(form.bonusProjection),
    taxAlreadyDeducted: normalizeNumber(form.taxAlreadyDeducted),
  },
  overrides: {
    monthlyTDS: normalizeNumber(form.monthlyTDS),
    annualTaxableIncome: normalizeNumber(form.annualTaxableIncome),
  },
});

const PayslipSkeleton = () => (
  <div className="animate-pulse space-y-6 p-6 bg-white min-h-screen font-inter">
    <div className="flex justify-between items-center mb-8">
      <div className="space-y-2">
        <div className="h-7 w-48 bg-[#E2E8F0] rounded-lg"></div>
        <div className="h-4 w-64 bg-[#E2E8F0] rounded-lg opacity-60"></div>
      </div>
      <div className="h-10 w-32 bg-[#E2E8F0] rounded-lg"></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-64 bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm"></div>
      ))}
    </div>
  </div>
);

function TaxInput({ label, value, onChange, placeholder = '0', type = 'number' }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] font-semibold text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/5"
      />
    </label>
  );
}

function TaxSection({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export default function Payslips() {
  const [activeTab, setActiveTab] = useState('payslips');
  const [payslips, setPayslips] = useState([]);
  const [loadingPayslips, setLoadingPayslips] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [previewPayslip, setPreviewPayslip] = useState(null);

  const [loadingTax, setLoadingTax] = useState(true);
  const [savingTax, setSavingTax] = useState(false);
  const [taxData, setTaxData] = useState({ effectiveProfile: null, snapshot: null, history: [] });
  const [taxForm, setTaxForm] = useState(EMPTY_TAX_FORM);

  useEffect(() => {
    loadMyPayslips(true);
    loadMyTaxProfile();
  }, []);

  async function loadMyPayslips(isInitial = false) {
    try {
      setLoadingPayslips(true);
      const res = await api.get('/employee/payslips');
      const data = res.data?.data || [];
      setPayslips(data);

      if (isInitial && data.length > 0) {
        const years = [...new Set(data.map((item) => item.year))].sort((a, b) => b - a);
        setSelectedYear(years[0]);
      }
    } catch (err) {
      console.error('Error loading payslips:', err);
      showToast('error', 'Sync Failed', 'Could not load salary records');
    } finally {
      setLoadingPayslips(false);
    }
  }

  async function loadMyTaxProfile() {
    try {
      setLoadingTax(true);
      const res = await api.get('/employee/tax-profile');
      const data = res.data?.data || { effectiveProfile: null, snapshot: null, history: [] };
      setTaxData(data);
      setTaxForm(mapProfileToForm(data));
    } catch (err) {
      console.error('Error loading tax profile:', err);
      setTaxData({ effectiveProfile: null, snapshot: null, history: [] });
      setTaxForm(EMPTY_TAX_FORM);
      showToast('error', 'Tax Profile', 'Could not load tax declaration data');
    } finally {
      setLoadingTax(false);
    }
  }

  async function refreshActiveTab() {
    if (activeTab === 'tax') {
      await loadMyTaxProfile();
      return;
    }
    await loadMyPayslips();
  }

  async function downloadPDF(payslip) {
    try {
      showToast('info', 'Generating PDF', 'Please wait a moment...');
      const res = await api.post(`/employee/payslips/${payslip._id}/generate-pdf`, {}, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Payslip_${payslip.month}-${payslip.year}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
      showToast('error', 'Download Failed', 'Could not generate payslip PDF.');
    }
  }

  async function saveTaxProfile() {
    try {
      setSavingTax(true);
      await api.post('/employee/tax-profile', buildSavePayload(taxForm));
      showToast('success', 'Tax Declaration Saved', 'Your payroll tax declaration has been updated.');
      await loadMyTaxProfile();
    } catch (err) {
      console.error('Error saving tax profile:', err);
      showToast('error', 'Save Failed', err?.response?.data?.message || 'Could not save tax declaration.');
    } finally {
      setSavingTax(false);
    }
  }

  const filteredPayslips = useMemo(
    () => payslips.filter((item) => item.year === parseInt(selectedYear, 10)),
    [payslips, selectedYear]
  );

  const availableYears = useMemo(
    () => [...new Set(payslips.map((item) => item.year))].sort((a, b) => b - a),
    [payslips]
  );

  if (loadingPayslips && activeTab === 'payslips') return <PayslipSkeleton />;

  return (
    <div className="w-full bg-white min-h-screen p-[15px] font-inter animate-in fade-in duration-500">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-slate-800">Compensation Centre</h1>
              <p className="text-[12px] text-slate-500">Review published payslips and manage your Indian tax declaration.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeTab === 'payslips' && (
                <div className="relative group">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2563EB] transition-colors" size={16} />
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="h-[40px] pl-10 pr-10 bg-white border border-[#E2E8F0] rounded-lg text-sm font-semibold text-[#334155] outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] transition-all shadow-sm cursor-pointer appearance-none min-w-[140px]"
                  >
                    {availableYears.length > 0 ? availableYears.map((year) => (
                      <option key={year} value={year}>{year} Archive</option>
                    )) : (
                      <option value={new Date().getFullYear()}>{new Date().getFullYear()} Archive</option>
                    )}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                    <ChevronRight size={14} className="rotate-90" />
                  </div>
                </div>
              )}

              <button
                onClick={refreshActiveTab}
                className="w-10 h-10 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-lg text-[#64748B] hover:text-[#2563EB] transition-all shadow-sm"
              >
                <RefreshCw size={16} className={loadingTax && activeTab === 'tax' ? 'animate-spin' : ''} />
              </button>

              {activeTab === 'tax' && (
                <button
                  onClick={saveTaxProfile}
                  disabled={savingTax}
                  className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-60"
                >
                  <Save size={15} className={savingTax ? 'animate-pulse' : ''} />
                  Save Declaration
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50">
            {[
              { key: 'payslips', label: 'Payslips', icon: FileText },
              { key: 'tax', label: 'Tax Declaration', icon: Landmark },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`h-10 px-4 rounded-lg inline-flex items-center gap-2 text-sm font-semibold transition-all ${
                    active ? 'bg-white text-[#2563EB] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'payslips' ? (
          filteredPayslips.length === 0 ? (
            <div className="bg-white border border-dashed border-[#E2E8F0] rounded-xl py-24 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center text-slate-200 mb-4 border border-[#E2E8F0] shadow-inner">
                <Wallet size={32} />
              </div>
              <h3 className="text-[16px] font-semibold text-[#334155]">No Records Found for {selectedYear}</h3>
              <p className="text-[13px] text-[#64748B] font-medium mt-1">Salary slips for this period have not been published yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredPayslips.map((payslip) => (
                <PayslipCard
                  key={payslip._id}
                  payslip={payslip}
                  onPreview={() => setPreviewPayslip(payslip)}
                  onDownload={() => downloadPDF(payslip)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
            <div className="space-y-5">
              <TaxSection
                title="Regime & Filing Control"
                subtitle="Choose the tax regime and keep payroll aligned with the latest declaration."
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">Effective From</span>
                    <input
                      type="date"
                      value={taxForm.effectiveFrom}
                      onChange={(e) => setTaxForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                      className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/5"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">Tax Regime</span>
                    <select
                      value={taxForm.regime}
                      onChange={(e) => setTaxForm((prev) => ({ ...prev, regime: e.target.value }))}
                      className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/5"
                    >
                      <option value="NEW">New Regime</option>
                      <option value="OLD">Old Regime</option>
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">Proof Status</span>
                    <select
                      value={taxForm.proofStatus}
                      onChange={(e) => setTaxForm((prev) => ({ ...prev, proofStatus: e.target.value }))}
                      className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/5"
                    >
                      {PROOF_STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </TaxSection>

              <TaxSection
                title="Chapter VI-A Deductions"
                subtitle="Capture the common Indian deduction heads that directly affect TDS projection."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TaxInput label="Section 80C" value={taxForm.section80C} onChange={(e) => setTaxForm((prev) => ({ ...prev, section80C: e.target.value }))} />
                  <TaxInput label="Section 80CCD(1B)" value={taxForm.section80CCD1B} onChange={(e) => setTaxForm((prev) => ({ ...prev, section80CCD1B: e.target.value }))} />
                  <TaxInput label="Section 80D" value={taxForm.section80D} onChange={(e) => setTaxForm((prev) => ({ ...prev, section80D: e.target.value }))} />
                  <TaxInput label="HRA Exemption" value={taxForm.hraExemption} onChange={(e) => setTaxForm((prev) => ({ ...prev, hraExemption: e.target.value }))} />
                  <TaxInput label="Home Loan Interest" value={taxForm.homeLoanInterest} onChange={(e) => setTaxForm((prev) => ({ ...prev, homeLoanInterest: e.target.value }))} />
                  <TaxInput label="Other Exemptions" value={taxForm.otherExemptions} onChange={(e) => setTaxForm((prev) => ({ ...prev, otherExemptions: e.target.value }))} />
                </div>
              </TaxSection>

              <TaxSection
                title="Income Projections"
                subtitle="Keep previous employer income, other income, and bonus expectations aligned with the payroll year."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TaxInput label="Previous Employer Income" value={taxForm.previousEmployerIncome} onChange={(e) => setTaxForm((prev) => ({ ...prev, previousEmployerIncome: e.target.value }))} />
                  <TaxInput label="Other Income" value={taxForm.otherIncome} onChange={(e) => setTaxForm((prev) => ({ ...prev, otherIncome: e.target.value }))} />
                  <TaxInput label="Bonus Projection" value={taxForm.bonusProjection} onChange={(e) => setTaxForm((prev) => ({ ...prev, bonusProjection: e.target.value }))} />
                  <TaxInput label="Tax Already Deducted" value={taxForm.taxAlreadyDeducted} onChange={(e) => setTaxForm((prev) => ({ ...prev, taxAlreadyDeducted: e.target.value }))} />
                </div>
              </TaxSection>

              <TaxSection
                title="Payroll Overrides"
                subtitle="Use overrides only when payroll has given a specific annual taxable income or fixed TDS requirement."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TaxInput label="Monthly TDS Override" value={taxForm.monthlyTDS} onChange={(e) => setTaxForm((prev) => ({ ...prev, monthlyTDS: e.target.value }))} />
                  <TaxInput label="Annual Taxable Income Override" value={taxForm.annualTaxableIncome} onChange={(e) => setTaxForm((prev) => ({ ...prev, annualTaxableIncome: e.target.value }))} />
                </div>
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-semibold text-slate-600">Employee Notes</span>
                  <textarea
                    rows={4}
                    value={taxForm.notes}
                    onChange={(e) => setTaxForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/5 resize-none"
                    placeholder="Add notes for payroll review or investment proof follow-up."
                  />
                </label>
              </TaxSection>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Current Payroll Snapshot</h3>
                    <p className="text-[12px] text-slate-500">This is the declaration payroll will use for the active financial year.</p>
                  </div>
                </div>

                {loadingTax ? (
                  <div className="py-10 flex justify-center">
                    <RefreshCw size={18} className="animate-spin text-[#2563EB]" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <SnapshotMetric label="Regime" value={taxData.snapshot?.regime || 'NEW'} />
                    <SnapshotMetric label="Financial Year" value={taxData.snapshot?.financialYearLabel || 'Not set'} />
                    <SnapshotMetric label="Proof Status" value={(taxData.snapshot?.proofStatus || 'NOT_SUBMITTED').replaceAll('_', ' ')} />
                    <SnapshotMetric label="80C Declared" value={formatCurrency(taxData.snapshot?.declarations?.section80C)} />
                    <SnapshotMetric label="80CCD(1B)" value={formatCurrency(taxData.snapshot?.declarations?.section80CCD1B)} />
                    <SnapshotMetric label="Monthly TDS Override" value={formatCurrency(taxData.snapshot?.overrides?.monthlyTDS)} />
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                    <History size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Declaration History</h3>
                    <p className="text-[12px] text-slate-500">Recent versions closed or superseded during the payroll year.</p>
                  </div>
                </div>

                {(taxData.history || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-[12px] text-slate-500">
                    No previous declarations found. Your first save will create the active payroll declaration.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(taxData.history || []).slice(0, 5).map((item) => (
                      <div key={item._id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{item.financialYearLabel || 'Financial Year'}</p>
                            <p className="text-[11px] text-slate-500">
                              {item.effectiveFrom ? new Date(item.effectiveFrom).toLocaleDateString('en-IN') : 'Open'} to{' '}
                              {item.effectiveTo ? new Date(item.effectiveTo).toLocaleDateString('en-IN') : 'Current'}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                            {item.regime || 'NEW'}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                          <span>80C: {formatCurrency(item.declarations?.section80C)}</span>
                          <span>80D: {formatCurrency(item.declarations?.section80D)}</span>
                          <span>Bonus: {formatCurrency(item.projections?.bonusProjection)}</span>
                          <span>Status: {(item.proofStatus || 'NOT_SUBMITTED').replaceAll('_', ' ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {previewPayslip && (
        <PayslipPreviewModal
          payslip={previewPayslip}
          onClose={() => setPreviewPayslip(null)}
          onDownload={() => downloadPDF(previewPayslip)}
        />
      )}
    </div>
  );
}

function SnapshotMetric({ label, value }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800 text-right">{value}</span>
    </div>
  );
}

function PayslipCard({ payslip, onPreview, onDownload }) {
  const monthName = new Date(0, payslip.month - 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 flex flex-col shadow-sm hover:shadow-md hover:border-[#CBD5E1] transition-all duration-300 group relative">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-lg flex items-center justify-center border border-blue-100 group-hover:scale-110 transition-transform">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#334155] group-hover:text-[#2563EB] transition-colors leading-none mb-1">{monthName}</h3>
            <p className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider opacity-60">{payslip.year} Records</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#ECFDF5] text-[#16A34A] border border-[#ECFDF5]">
          Paid
        </span>
      </div>

      <div className="flex-1 space-y-4 mb-6">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-widest opacity-60 mb-1">Net Compensation</span>
          <div className="text-[28px] font-bold text-[#334155] tracking-tight">{formatCurrency(payslip.netPay)}</div>
        </div>

        <div className="space-y-2.5 pt-4 border-t border-slate-50">
          <div className="flex justify-between items-center text-[12px] font-medium">
            <span className="text-[#64748B]">Monthly Gross</span>
            <span className="text-[#334155] font-bold">{formatCurrency(payslip.grossEarnings)}</span>
          </div>
          <div className="flex justify-between items-center text-[12px] font-medium">
            <span className="text-[#64748B]">Total Deductions</span>
            <span className="text-[#DC2626] font-bold">-{formatCurrency(payslip.totals?.totalDeductions || 0)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onPreview}
          className="flex-1 h-[38px] flex items-center justify-center gap-2 bg-white border border-[#E2E8F0] text-[#334155] rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all active:scale-[0.98]"
        >
          <Eye size={14} className="text-[#64748B]" /> Details
        </button>
        <button
          onClick={onDownload}
          className="flex-1 h-[38px] flex items-center justify-center gap-2 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10 active:scale-[0.98]"
        >
          <Download size={16} /> Download PDF
        </button>
      </div>
    </div>
  );
}

function PayslipPreviewModal({ payslip, onClose, onDownload }) {
  const monthName = new Date(0, payslip.month - 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-[24px] overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0] bg-white">
          <div>
            <h3 className="text-[16px] font-semibold text-[#334155]">Salary Slip</h3>
            <p className="text-[11px] text-[#64748B] font-medium">{monthName} {payslip.year}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onDownload}
              className="h-9 px-4 flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700 transition-all"
            >
              <Download size={14} /> Download PDF
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-[#DC2626] transition-all border border-[#E2E8F0] bg-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-3 bg-slate-50/50 relative">
          <div className="max-w-[860px] mx-auto bg-white shadow-xl rounded-[20px] overflow-hidden border border-slate-100 relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.03),transparent)] pointer-events-none"></div>
            <div className="px-6 pb-6 pt-4 lg:px-7 lg:pb-7 lg:pt-4 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2">
                    <div className="w-1 h-3 bg-[#16A34A] rounded-full"></div>
                    <h3 className="text-[11px] font-bold text-[#16A34A] uppercase tracking-[0.18em]">Earnings Allocation</h3>
                  </div>
                  <div className="space-y-2.5">
                    {(payslip.earningsSnapshot || []).map((earning, index) => (
                      <div key={index} className="flex justify-between items-center text-[11px]">
                        <span className="text-[#64748B] font-medium">{earning.name || earning.label}</span>
                        <span className="text-[#334155] font-bold">{formatCurrency(earning.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2">
                    <div className="w-1 h-3 bg-[#DC2626] rounded-full"></div>
                    <h3 className="text-[11px] font-bold text-[#DC2626] uppercase tracking-[0.18em]">Deductions</h3>
                  </div>
                  <div className="space-y-2.5">
                    {(payslip.deductions || []).map((deduction, index) => (
                      <div key={index} className="flex justify-between items-center text-[11px]">
                        <span className="text-[#64748B] font-medium">{deduction.name || deduction.label}</span>
                        <span className="text-[#DC2626] font-bold">{formatCurrency(deduction.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-[#1E293B] p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-6 opacity-5">
                  <CreditCard size={96} className="text-white rotate-12" />
                </div>
                <div className="relative z-10 text-center md:text-left">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.18em] mb-2">Net Payable Amount</p>
                  <h3 className="text-[34px] font-bold text-white tracking-tighter">{formatCurrency(payslip.netPay)}</h3>
                </div>
                <div className="flex flex-col gap-2 min-w-[180px] relative z-10 font-bold uppercase tracking-widest">
                  <div className="flex justify-between text-[10px] px-4 py-2 bg-white/5 rounded-lg border border-white/10 text-emerald-400">
                    <span>Gross</span>
                    <span>+ {formatCurrency(payslip.grossEarnings)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] px-4 py-2 bg-white/5 rounded-lg border border-white/10 text-rose-400">
                    <span>Deductions</span>
                    <span>- {formatCurrency(payslip.totals?.totalDeductions || 0)}</span>
                  </div>
                </div>
              </div>

              <p className="text-center text-[9px] font-medium text-slate-400 pt-6 italic">This is a system-generated document and does not require a physical signature.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
