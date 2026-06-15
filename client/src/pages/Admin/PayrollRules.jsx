import React, { useEffect, useState } from 'react';
import { Save, AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react';
import api from '../../utils/api';

const defaultRules = {
    basicSalary: { percentageOfCTC: 40, enabled: true },
    hra: { percentageOfBasic: 40, enabled: true },
    conveyance: { type: 'FIXED', value: 1600, enabled: true },
    medical: { type: 'FIXED', value: 1250, enabled: true },
    pf: { enabled: true, employeeRate: 12, employerRate: 12, wageCeiling: 15000, capContribution: true },
    esic: { enabled: true, employeeRate: 0.75, employerRate: 3.25, wageCeiling: 21000 },
    professionalTax: { enabled: true, defaultAmount: 200 },
    locationPolicies: []
};

const createEmptyLocationPolicy = () => ({
    name: '',
    country: 'IN',
    legalEntityId: '',
    branchIds: [],
    payrollRegion: '',
    workState: '',
    workCity: '',
    isMetro: false,
    hraPercentageOfBasic: '',
    professionalTaxAmount: '',
    holidayCalendarCode: '',
    payCalendarCode: '',
    minimumWageCategory: '',
    minimumWageMonthlyAmount: '',
    weeklyOff: {
        mode: 'COMPANY_DEFAULT',
        weeklyOffDays: [],
        saturdayHalfDayEnabled: false
    },
    localAllowance: {
        label: '',
        amount: '',
        includedInCtc: false
    },
    overtimePolicy: {
        enabled: false,
        label: 'Overtime Pay',
        multiplier: 1,
        weeklyOffMultiplier: 1.5,
        holidayMultiplier: 2,
        fixedHourlyRate: ''
    },
    statutoryApplicability: {
        esiApplicable: '',
        lwfEnabled: false,
        lwfEmployeeAmount: '',
        lwfEmployerAmount: '',
        lwfDeductionMonth: ''
    },
    enabled: true
});

const mergeRules = (incoming = {}) => ({
    ...defaultRules,
    ...incoming,
    basicSalary: { ...defaultRules.basicSalary, ...(incoming.basicSalary || {}) },
    hra: { ...defaultRules.hra, ...(incoming.hra || {}) },
    conveyance: { ...defaultRules.conveyance, ...(incoming.conveyance || {}) },
    medical: { ...defaultRules.medical, ...(incoming.medical || {}) },
    pf: { ...defaultRules.pf, ...(incoming.pf || {}) },
    esic: { ...defaultRules.esic, ...(incoming.esic || {}) },
    professionalTax: { ...defaultRules.professionalTax, ...(incoming.professionalTax || {}) },
    locationPolicies: Array.isArray(incoming.locationPolicies)
        ? incoming.locationPolicies.map((policy) => ({
            ...createEmptyLocationPolicy(),
            ...policy,
            branchIds: Array.isArray(policy.branchIds) ? policy.branchIds : [],
            weeklyOff: {
                ...createEmptyLocationPolicy().weeklyOff,
                ...(policy.weeklyOff || {})
            },
            localAllowance: {
                ...createEmptyLocationPolicy().localAllowance,
                ...(policy.localAllowance || {})
            },
            overtimePolicy: {
                ...createEmptyLocationPolicy().overtimePolicy,
                ...(policy.overtimePolicy || {})
            },
            statutoryApplicability: {
                ...createEmptyLocationPolicy().statutoryApplicability,
                ...(policy.statutoryApplicability || {})
            }
        }))
        : []
});

const PayrollRules = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rules, setRules] = useState(defaultRules);
    const [message, setMessage] = useState(null);
    const [presetCatalog, setPresetCatalog] = useState([]);
    const [seedingPreset, setSeedingPreset] = useState(false);
    const [presetForm, setPresetForm] = useState({
        presetKey: '',
        effectiveFrom: new Date().toISOString().slice(0, 10),
        closePrevious: true,
        notes: ''
    });
    const [effectiveLookup, setEffectiveLookup] = useState({
        loading: false,
        form: {
            asOfDate: new Date().toISOString().slice(0, 10),
            country: 'IN',
            workState: '',
            workCity: '',
            payrollRegion: ''
        },
        data: null
    });
    const [locationPreview, setLocationPreview] = useState({
        loading: false,
        form: {
            country: 'IN',
            legalEntityId: '',
            branchId: '',
            payrollRegion: '',
            workState: '',
            workCity: ''
        },
        data: null
    });

    useEffect(() => {
        Promise.all([fetchRules(), fetchPresetCatalog()])
            .finally(() => setLoading(false));
    }, []);

    const fetchRules = async () => {
        try {
            const res = await api.get('/payroll-rules/rules');
            if (res.data) {
                setRules(mergeRules(res.data));
            }
        } catch (error) {
            console.error('Failed to fetch rules', error);
        }
    };

    const fetchPresetCatalog = async () => {
        try {
            const res = await api.get('/payroll/statutory-rules/presets');
            const catalog = res.data?.data || [];
            setPresetCatalog(catalog);
            if (catalog.length > 0) {
                setPresetForm((prev) => ({
                    ...prev,
                    presetKey: prev.presetKey || catalog[0].key
                }));
            }
        } catch (error) {
            console.error('Failed to fetch statutory preset catalog', error);
        }
    };

    const loadEffectiveRuleSet = async () => {
        setEffectiveLookup((prev) => ({ ...prev, loading: true }));
        try {
            const { asOfDate, country, workState, workCity, payrollRegion } = effectiveLookup.form;
            const params = new URLSearchParams();
            if (asOfDate) params.set('asOfDate', asOfDate);
            if (country) params.set('country', country);
            if (workState) params.set('workState', workState);
            if (workCity) params.set('workCity', workCity);
            if (payrollRegion) params.set('payrollRegion', payrollRegion);

            const res = await api.get(`/payroll/statutory-rules/current?${params.toString()}`);
            setEffectiveLookup((prev) => ({
                ...prev,
                loading: false,
                data: res.data?.data || null
            }));
        } catch (error) {
            setEffectiveLookup((prev) => ({ ...prev, loading: false }));
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load effective statutory rules.' });
        }
    };

    const seedStatutoryPreset = async () => {
        if (!presetForm.presetKey) {
            setMessage({ type: 'error', text: 'Select a preset before seeding.' });
            return;
        }

        setSeedingPreset(true);
        setMessage(null);
        try {
            const payload = {
                effectiveFrom: presetForm.effectiveFrom,
                closePrevious: presetForm.closePrevious,
                notes: presetForm.notes
            };
            const res = await api.post(`/payroll/statutory-rules/presets/${presetForm.presetKey}/seed`, payload);
            setMessage({
                type: 'success',
                text: `Preset seeded successfully. Created ${res.data?.data?.createdCount || 0} effective rule set(s).`
            });
            await loadEffectiveRuleSet();
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to seed statutory preset' });
        } finally {
            setSeedingPreset(false);
        }
    };

    const handleChange = (section, field, value) => {
        setRules((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const handleLocationPolicyChange = (index, field, value) => {
        setRules((prev) => ({
            ...prev,
            locationPolicies: prev.locationPolicies.map((policy, policyIndex) =>
                policyIndex === index
                    ? { ...policy, [field]: value }
                    : policy
            )
        }));
    };

    const handleLocationPolicyNestedChange = (index, section, field, value) => {
        setRules((prev) => ({
            ...prev,
            locationPolicies: prev.locationPolicies.map((policy, policyIndex) =>
                policyIndex === index
                    ? {
                        ...policy,
                        [section]: {
                            ...(policy[section] || {}),
                            [field]: value
                        }
                    }
                    : policy
            )
        }));
    };

    const loadLocationPolicyPreview = async () => {
        setLocationPreview((prev) => ({ ...prev, loading: true }));
        try {
            const params = new URLSearchParams();
            Object.entries(locationPreview.form).forEach(([key, value]) => {
                if (value) params.set(key, value);
            });

            const res = await api.get(`/payroll-rules/rules/preview?${params.toString()}`);
            setLocationPreview((prev) => ({
                ...prev,
                loading: false,
                data: res.data?.data || null
            }));
        } catch (error) {
            setLocationPreview((prev) => ({ ...prev, loading: false }));
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to preview resolved location policy.' });
        }
    };

    const addLocationPolicy = () => {
        setRules((prev) => ({
            ...prev,
            locationPolicies: [...prev.locationPolicies, createEmptyLocationPolicy()]
        }));
    };

    const removeLocationPolicy = (index) => {
        setRules((prev) => ({
            ...prev,
            locationPolicies: prev.locationPolicies.filter((_, policyIndex) => policyIndex !== index)
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await api.put('/payroll-rules/rules', rules);
            setRules(mergeRules(res.data));
            setMessage({ type: 'success', text: 'Payroll rules updated successfully.' });
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update rules' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading configuration...</div>;

    const Section = ({ title, children, enabled, onToggle, className = '' }) => (
        <div className={`bg-white rounded-lg shadow-sm border p-6 mb-6 ${!enabled ? 'opacity-70' : ''} ${className}`}>
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{enabled ? 'Enabled' : 'Disabled'}</span>
                    <button
                        onClick={onToggle}
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                        <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${enabled ? 'translate-x-6' : ''}`} />
                    </button>
                </div>
            </div>
            <div className={!enabled ? 'pointer-events-none grayscale' : ''}>
                {children}
            </div>
        </div>
    );

    const InputGroup = ({ label, value, onChange, suffix, type = 'number', step = '0.01', placeholder = '' }) => (
        <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-gray-600">{label}</label>
            <div className="flex rounded-md shadow-sm">
                <input
                    type={type}
                    step={step}
                    value={value}
                    placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                {suffix && (
                    <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                        {suffix}
                    </span>
                )}
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Payroll Rule Configuration</h1>
                    <p className="text-gray-500 mt-1">Set the company defaults and the location-specific payroll rules used during salary calculation.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : <><Save size={18} className="mr-2" />Save Changes</>}
                </button>
            </div>

            {message && (
                <div className={`mb-6 p-4 rounded-md flex items-center ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertCircle className="mr-2" size={20} />}
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-800">Effective Statutory Rule Lookup</h3>
                        <button
                            onClick={loadEffectiveRuleSet}
                            disabled={effectiveLookup.loading}
                            className="px-3 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                        >
                            {effectiveLookup.loading ? 'Loading...' : 'Load Rule'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputGroup
                            label="As Of Date"
                            type="date"
                            step={undefined}
                            value={effectiveLookup.form.asOfDate}
                            onChange={(value) => setEffectiveLookup((prev) => ({
                                ...prev,
                                form: { ...prev.form, asOfDate: value }
                            }))}
                        />
                        <InputGroup
                            label="Country"
                            type="text"
                            step={undefined}
                            value={effectiveLookup.form.country}
                            onChange={(value) => setEffectiveLookup((prev) => ({
                                ...prev,
                                form: { ...prev.form, country: value }
                            }))}
                        />
                        <InputGroup
                            label="Work State"
                            type="text"
                            step={undefined}
                            value={effectiveLookup.form.workState}
                            onChange={(value) => setEffectiveLookup((prev) => ({
                                ...prev,
                                form: { ...prev.form, workState: value }
                            }))}
                            placeholder="Gujarat"
                        />
                        <InputGroup
                            label="Work City"
                            type="text"
                            step={undefined}
                            value={effectiveLookup.form.workCity}
                            onChange={(value) => setEffectiveLookup((prev) => ({
                                ...prev,
                                form: { ...prev.form, workCity: value }
                            }))}
                            placeholder="Ahmedabad"
                        />
                        <InputGroup
                            label="Payroll Region"
                            type="text"
                            step={undefined}
                            value={effectiveLookup.form.payrollRegion}
                            onChange={(value) => setEffectiveLookup((prev) => ({
                                ...prev,
                                form: { ...prev.form, payrollRegion: value }
                            }))}
                            placeholder="Gujarat"
                        />
                    </div>

                    {effectiveLookup.data?.effectiveRuleSet && (
                        <div className="rounded-md border border-blue-100 bg-blue-50 p-4 space-y-1">
                            <p className="text-sm font-semibold text-blue-900">
                                {effectiveLookup.data.effectiveRuleSet.name} (v{effectiveLookup.data.effectiveRuleSet.version || 1})
                            </p>
                            <p className="text-xs text-blue-700">
                                Code: {effectiveLookup.data.effectiveRuleSet.code} | Source: {effectiveLookup.data.effectiveRuleSet.source || 'SYSTEM'}
                            </p>
                            <p className="text-xs text-blue-700">
                                Scope: {effectiveLookup.data.effectiveRuleSet.country || 'IN'} / {effectiveLookup.data.effectiveRuleSet.workState || 'ANY'} / {effectiveLookup.data.effectiveRuleSet.workCity || 'ANY'}
                            </p>
                            <p className="text-xs text-blue-700">
                                PT Slabs: {effectiveLookup.data.snapshot?.professionalTax?.slabs?.length || 0}
                            </p>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Seed Statutory Preset</h3>
                    <p className="text-sm text-gray-500">Use preset templates to bootstrap effective-dated statutory rules by location.</p>

                    <div className="space-y-3">
                        <div className="flex flex-col space-y-1">
                            <label className="text-sm font-medium text-gray-600">Preset</label>
                            <select
                                value={presetForm.presetKey}
                                onChange={(e) => setPresetForm((prev) => ({ ...prev, presetKey: e.target.value }))}
                                className="px-3 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                                {presetCatalog.map((preset) => (
                                    <option key={preset.key} value={preset.key}>
                                        {preset.label} ({preset.key})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <InputGroup
                            label="Effective From"
                            type="date"
                            step={undefined}
                            value={presetForm.effectiveFrom}
                            onChange={(value) => setPresetForm((prev) => ({ ...prev, effectiveFrom: value }))}
                        />

                        <div className="flex items-center gap-2">
                            <input
                                id="closePrevious"
                                type="checkbox"
                                checked={presetForm.closePrevious}
                                onChange={(e) => setPresetForm((prev) => ({ ...prev, closePrevious: e.target.checked }))}
                                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <label htmlFor="closePrevious" className="text-sm text-gray-700">Close overlapping rule versions automatically</label>
                        </div>

                        <div className="flex flex-col space-y-1">
                            <label className="text-sm font-medium text-gray-600">Notes</label>
                            <textarea
                                rows={3}
                                value={presetForm.notes}
                                onChange={(e) => setPresetForm((prev) => ({ ...prev, notes: e.target.value }))}
                                className="px-3 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                placeholder="Optional reference note for audit."
                            />
                        </div>
                    </div>

                    <button
                        onClick={seedStatutoryPreset}
                        disabled={seedingPreset || !presetForm.presetKey}
                        className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {seedingPreset ? 'Seeding...' : 'Seed Preset'}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">Resolved Location Policy Preview</h3>
                        <p className="text-sm text-gray-500 mt-1">Preview the exact city/state/branch policy the active engine will apply for an employee payroll profile.</p>
                    </div>
                    <button
                        onClick={loadLocationPolicyPreview}
                        disabled={locationPreview.loading}
                        className="px-3 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                    >
                        {locationPreview.loading ? 'Loading...' : 'Preview Policy'}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InputGroup
                        label="Country"
                        type="text"
                        step={undefined}
                        value={locationPreview.form.country}
                        onChange={(value) => setLocationPreview((prev) => ({
                            ...prev,
                            form: { ...prev.form, country: value }
                        }))}
                    />
                    <InputGroup
                        label="Legal Entity Id"
                        type="text"
                        step={undefined}
                        value={locationPreview.form.legalEntityId}
                        onChange={(value) => setLocationPreview((prev) => ({
                            ...prev,
                            form: { ...prev.form, legalEntityId: value }
                        }))}
                        placeholder="Optional tenant/entity id"
                    />
                    <InputGroup
                        label="Branch Id"
                        type="text"
                        step={undefined}
                        value={locationPreview.form.branchId}
                        onChange={(value) => setLocationPreview((prev) => ({
                            ...prev,
                            form: { ...prev.form, branchId: value }
                        }))}
                        placeholder="Optional branch id"
                    />
                    <InputGroup
                        label="Payroll Region"
                        type="text"
                        step={undefined}
                        value={locationPreview.form.payrollRegion}
                        onChange={(value) => setLocationPreview((prev) => ({
                            ...prev,
                            form: { ...prev.form, payrollRegion: value }
                        }))}
                        placeholder="West"
                    />
                    <InputGroup
                        label="Work State"
                        type="text"
                        step={undefined}
                        value={locationPreview.form.workState}
                        onChange={(value) => setLocationPreview((prev) => ({
                            ...prev,
                            form: { ...prev.form, workState: value }
                        }))}
                        placeholder="Gujarat"
                    />
                    <InputGroup
                        label="Work City"
                        type="text"
                        step={undefined}
                        value={locationPreview.form.workCity}
                        onChange={(value) => setLocationPreview((prev) => ({
                            ...prev,
                            form: { ...prev.form, workCity: value }
                        }))}
                        placeholder="Ahmedabad"
                    />
                </div>

                {locationPreview.data?.snapshot && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                            <p className="text-xs font-semibold text-indigo-900">Resolved Rule</p>
                            <p className="text-sm font-bold text-indigo-700 mt-1">{locationPreview.data.snapshot.ruleName || 'Company Default'}</p>
                            <p className="text-xs text-indigo-600 mt-1">Matched on: {(locationPreview.data.snapshot.matchedOn || []).join(', ') || 'Default'}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                            <p className="text-xs font-semibold text-emerald-900">Professional Tax</p>
                            <p className="text-sm font-bold text-emerald-700 mt-1">₹{locationPreview.data.snapshot.professionalTaxAmount || 0}</p>
                            <p className="text-xs text-emerald-600 mt-1">{locationPreview.data.snapshot.professionalTaxEnabled ? 'Enabled' : 'Disabled'}</p>
                        </div>
                        <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                            <p className="text-xs font-semibold text-amber-900">Local Allowance</p>
                            <p className="text-sm font-bold text-amber-700 mt-1">{locationPreview.data.snapshot.localAllowanceLabel || 'None'}</p>
                            <p className="text-xs text-amber-600 mt-1">₹{locationPreview.data.snapshot.localAllowanceAmount || 0}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold text-slate-900">Weekly Off / LWF</p>
                            <p className="text-sm font-bold text-slate-700 mt-1">{locationPreview.data.snapshot.weeklyOffMode || 'COMPANY_DEFAULT'}</p>
                            <p className="text-xs text-slate-500 mt-1">{locationPreview.data.snapshot.lwfEnabled ? `LWF ₹${locationPreview.data.snapshot.lwfEmployeeAmount || 0}` : 'LWF Disabled'}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Section
                    title="Basic Salary Rules"
                    enabled={rules.basicSalary.enabled}
                    onToggle={() => handleChange('basicSalary', 'enabled', !rules.basicSalary.enabled)}
                >
                    <InputGroup
                        label="Basic Salary Percentage"
                        value={rules.basicSalary.percentageOfCTC}
                        onChange={(val) => handleChange('basicSalary', 'percentageOfCTC', val)}
                        suffix="% of CTC"
                    />
                    <p className="text-xs text-gray-500 mt-2">Typical range: 40-50% of CTC.</p>
                </Section>

                <Section
                    title="House Rent Allowance (HRA)"
                    enabled={rules.hra.enabled}
                    onToggle={() => handleChange('hra', 'enabled', !rules.hra.enabled)}
                >
                    <InputGroup
                        label="Default HRA Percentage"
                        value={rules.hra.percentageOfBasic}
                        onChange={(val) => handleChange('hra', 'percentageOfBasic', val)}
                        suffix="% of Basic"
                    />
                    <p className="text-xs text-gray-500 mt-2">Location policies can override this percentage for metro or state-specific payroll.</p>
                </Section>

                <Section
                    title="Provident Fund (PF)"
                    enabled={rules.pf.enabled}
                    onToggle={() => handleChange('pf', 'enabled', !rules.pf.enabled)}
                >
                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup
                            label="Employee Contribution"
                            value={rules.pf.employeeRate}
                            onChange={(val) => handleChange('pf', 'employeeRate', val)}
                            suffix="%"
                        />
                        <InputGroup
                            label="Employer Contribution"
                            value={rules.pf.employerRate}
                            onChange={(val) => handleChange('pf', 'employerRate', val)}
                            suffix="%"
                        />
                        <InputGroup
                            label="Wage Ceiling"
                            value={rules.pf.wageCeiling}
                            onChange={(val) => handleChange('pf', 'wageCeiling', val)}
                            suffix="INR"
                        />
                        <div className="flex items-center h-full pt-6">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rules.pf.capContribution}
                                    onChange={(e) => handleChange('pf', 'capContribution', e.target.checked)}
                                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                                />
                                <span className="text-sm text-gray-700">Cap at ceiling</span>
                            </label>
                        </div>
                    </div>
                </Section>

                <Section
                    title="ESIC Scheme"
                    enabled={rules.esic.enabled}
                    onToggle={() => handleChange('esic', 'enabled', !rules.esic.enabled)}
                >
                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup
                            label="Employee Contribution"
                            value={rules.esic.employeeRate}
                            onChange={(val) => handleChange('esic', 'employeeRate', val)}
                            suffix="%"
                        />
                        <InputGroup
                            label="Employer Contribution"
                            value={rules.esic.employerRate}
                            onChange={(val) => handleChange('esic', 'employerRate', val)}
                            suffix="%"
                        />
                        <InputGroup
                            label="Gross Salary Ceiling"
                            value={rules.esic.wageCeiling}
                            onChange={(val) => handleChange('esic', 'wageCeiling', val)}
                            suffix="INR"
                        />
                        <div className="flex items-center h-full pt-6 text-xs text-gray-500">
                            Applied when gross salary is within the ceiling.
                        </div>
                    </div>
                </Section>

                <Section
                    title="Fixed / Percentage Allowances"
                    enabled={true}
                    onToggle={() => {}}
                >
                    <div className="space-y-4">
                        {['conveyance', 'medical'].map((key) => (
                            <div key={key}>
                                <h4 className="text-sm font-medium text-gray-700 mb-2 capitalize">{key} Allowance</h4>
                                <div className="flex items-start space-x-2">
                                    <div className="w-1/3">
                                        <label className="text-sm font-medium text-gray-600 mb-1 block">Type</label>
                                        <select
                                            value={rules[key].type || 'FIXED'}
                                            onChange={(e) => handleChange(key, 'type', e.target.value)}
                                            className="block w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        >
                                            <option value="FIXED">Fixed Amount</option>
                                            <option value="PERCENTAGE">% of Basic</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <InputGroup
                                            label={rules[key].type === 'PERCENTAGE' ? 'Percentage' : 'Monthly Amount'}
                                            value={rules[key].value}
                                            onChange={(val) => handleChange(key, 'value', val)}
                                            suffix={rules[key].type === 'PERCENTAGE' ? '%' : 'INR'}
                                        />
                                    </div>
                                    <div className="flex items-center pt-8">
                                        <input
                                            type="checkbox"
                                            checked={rules[key].enabled}
                                            onChange={(e) => handleChange(key, 'enabled', e.target.checked)}
                                            className="rounded text-blue-600 h-4 w-4 mr-2"
                                        />
                                        <span className="text-sm">Active</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>

                <Section
                    title="Professional Tax (PT)"
                    enabled={rules.professionalTax.enabled}
                    onToggle={() => handleChange('professionalTax', 'enabled', !rules.professionalTax.enabled)}
                >
                    <InputGroup
                        label="Default Monthly Deduction"
                        value={rules.professionalTax.defaultAmount}
                        onChange={(val) => handleChange('professionalTax', 'defaultAmount', val)}
                        suffix="INR"
                    />
                    <p className="text-xs text-gray-500 mt-2">Location policies can override this amount by region, state, or city.</p>
                </Section>

                <Section
                    title="Location Policies"
                    enabled={true}
                    onToggle={() => {}}
                    className="md:col-span-2"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm text-gray-600">Most specific match wins: city, then state, then payroll region.</p>
                            <p className="text-xs text-gray-500 mt-1">Leave a field blank to make that policy apply more broadly.</p>
                        </div>
                        <button
                            onClick={addLocationPolicy}
                            className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            <Plus size={16} className="mr-2" />
                            Add Policy
                        </button>
                    </div>

                    {rules.locationPolicies.length === 0 ? (
                        <div className="border border-dashed border-gray-300 rounded-lg px-4 py-6 text-sm text-gray-500 text-center">
                            No location policies added yet. Default HRA and professional tax rules will apply to everyone.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {rules.locationPolicies.map((policy, index) => (
                                <div key={policy._id || `${policy.name}-${index}`} className="border rounded-lg p-4 bg-gray-50">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-semibold text-gray-800">Policy {index + 1}</h4>
                                        <button
                                            onClick={() => removeLocationPolicy(index)}
                                            className="inline-flex items-center px-2 py-1 text-sm text-red-600 hover:text-red-700"
                                        >
                                            <Trash2 size={15} className="mr-1" />
                                            Remove
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <InputGroup
                                            label="Policy Name"
                                            type="text"
                                            value={policy.name ?? ''}
                                            onChange={(val) => handleLocationPolicyChange(index, 'name', val)}
                                            placeholder="Metro Cities"
                                        />
                                        <InputGroup
                                            label="Country"
                                            type="text"
                                            value={policy.country ?? ''}
                                            onChange={(val) => handleLocationPolicyChange(index, 'country', val)}
                                            placeholder="IN"
                                        />
                                        <InputGroup
                                            label="Legal Entity Id"
                                            type="text"
                                            value={policy.legalEntityId || ''}
                                            onChange={(val) => handleLocationPolicyChange(index, 'legalEntityId', val)}
                                            placeholder="Optional entity id"
                                        />
                                        <InputGroup
                                            label="Payroll Region"
                                            type="text"
                                            value={policy.payrollRegion ?? ''}
                                            onChange={(val) => handleLocationPolicyChange(index, 'payrollRegion', val)}
                                            placeholder="West"
                                        />
                                        <InputGroup
                                            label="State"
                                            type="text"
                                            value={policy.workState ?? ''}
                                            onChange={(val) => handleLocationPolicyChange(index, 'workState', val)}
                                            placeholder="Maharashtra"
                                        />
                                        <InputGroup
                                            label="City"
                                            type="text"
                                            value={policy.workCity ?? ''}
                                            onChange={(val) => handleLocationPolicyChange(index, 'workCity', val)}
                                            placeholder="Mumbai"
                                        />
                                        <InputGroup
                                            label="Branch Ids"
                                            type="text"
                                            value={(policy.branchIds || []).join(', ')}
                                            onChange={(val) => handleLocationPolicyChange(index, 'branchIds', val.split(',').map((item) => item.trim()).filter(Boolean))}
                                            placeholder="Comma separated branch ids"
                                        />
                                        <InputGroup
                                            label="HRA Override"
                                            value={policy.hraPercentageOfBasic ?? ''}
                                            onChange={(val) => handleLocationPolicyChange(index, 'hraPercentageOfBasic', val)}
                                            suffix="% of Basic"
                                            placeholder="50"
                                        />
                                        <InputGroup
                                            label="PT Override"
                                            value={policy.professionalTaxAmount ?? ''}
                                            onChange={(val) => handleLocationPolicyChange(index, 'professionalTaxAmount', val)}
                                            suffix="INR"
                                            placeholder="200"
                                        />
                                        <InputGroup
                                            label="Holiday Calendar Code"
                                            type="text"
                                            value={policy.holidayCalendarCode ?? ''}
                                            onChange={(val) => handleLocationPolicyChange(index, 'holidayCalendarCode', val)}
                                            placeholder="GJ-AHD-HOL"
                                        />
                                        <InputGroup
                                            label="Pay Calendar Code"
                                            type="text"
                                            value={policy.payCalendarCode ?? ''}
                                            onChange={(val) => handleLocationPolicyChange(index, 'payCalendarCode', val)}
                                            placeholder="MONTH-END"
                                        />
                                        <InputGroup
                                            label="Minimum Wage Category"
                                            type="text"
                                            value={policy.minimumWageCategory ?? ''}
                                            onChange={(val) => handleLocationPolicyChange(index, 'minimumWageCategory', val)}
                                            placeholder="Skilled"
                                        />
                                        <InputGroup
                                            label="Minimum Wage Monthly"
                                            value={policy.minimumWageMonthlyAmount ?? ''}
                                            onChange={(val) => handleLocationPolicyChange(index, 'minimumWageMonthlyAmount', val)}
                                            suffix="INR"
                                            placeholder="18000"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
                                        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                                            <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Weekly Off</h5>
                                            <div className="flex flex-col space-y-1">
                                                <label className="text-sm font-medium text-gray-600">Mode</label>
                                                <select
                                                    value={policy.weeklyOff?.mode || 'COMPANY_DEFAULT'}
                                                    onChange={(e) => handleLocationPolicyNestedChange(index, 'weeklyOff', 'mode', e.target.value)}
                                                    className="block w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                >
                                                    <option value="COMPANY_DEFAULT">Company Default</option>
                                                    <option value="SUNDAY">Sunday</option>
                                                    <option value="SATURDAY_SUNDAY">Saturday + Sunday</option>
                                                    <option value="CUSTOM">Custom</option>
                                                    <option value="ALTERNATE_SATURDAY">Alternate Saturday</option>
                                                </select>
                                            </div>
                                            <InputGroup
                                                label="Weekly Off Days"
                                                type="text"
                                                step={undefined}
                                                value={(policy.weeklyOff?.weeklyOffDays || []).join(', ')}
                                                onChange={(val) => handleLocationPolicyNestedChange(index, 'weeklyOff', 'weeklyOffDays', val.split(',').map((item) => Number(item.trim())).filter((item) => !Number.isNaN(item)))}
                                                placeholder="0,6 for Sun/Sat"
                                            />
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={policy.weeklyOff?.saturdayHalfDayEnabled === true}
                                                    onChange={(e) => handleLocationPolicyNestedChange(index, 'weeklyOff', 'saturdayHalfDayEnabled', e.target.checked)}
                                                    className="rounded text-blue-600 h-4 w-4"
                                                />
                                                <span className="text-sm text-gray-700">Saturday half-day enabled</span>
                                            </label>
                                        </div>

                                        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                                            <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Local Allowance</h5>
                                            <InputGroup
                                                label="Allowance Label"
                                                type="text"
                                                step={undefined}
                                                value={policy.localAllowance?.label || ''}
                                                onChange={(val) => handleLocationPolicyNestedChange(index, 'localAllowance', 'label', val)}
                                                placeholder="City Allowance"
                                            />
                                            <InputGroup
                                                label="Allowance Amount"
                                                value={policy.localAllowance?.amount || ''}
                                                onChange={(val) => handleLocationPolicyNestedChange(index, 'localAllowance', 'amount', val)}
                                                suffix="INR"
                                                placeholder="1500"
                                            />
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={policy.localAllowance?.includedInCtc === true}
                                                    onChange={(e) => handleLocationPolicyNestedChange(index, 'localAllowance', 'includedInCtc', e.target.checked)}
                                                    className="rounded text-blue-600 h-4 w-4"
                                                />
                                                <span className="text-sm text-gray-700">Included in CTC</span>
                                            </label>
                                        </div>

                                        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                                            <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Overtime Policy</h5>
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={policy.overtimePolicy?.enabled === true}
                                                    onChange={(e) => handleLocationPolicyNestedChange(index, 'overtimePolicy', 'enabled', e.target.checked)}
                                                    className="rounded text-blue-600 h-4 w-4"
                                                />
                                                <span className="text-sm text-gray-700">Overtime enabled</span>
                                            </label>
                                            <InputGroup
                                                label="Label"
                                                type="text"
                                                step={undefined}
                                                value={policy.overtimePolicy?.label || ''}
                                                onChange={(val) => handleLocationPolicyNestedChange(index, 'overtimePolicy', 'label', val)}
                                                placeholder="Overtime Pay"
                                            />
                                            <InputGroup
                                                label="Base Multiplier"
                                                value={policy.overtimePolicy?.multiplier || ''}
                                                onChange={(val) => handleLocationPolicyNestedChange(index, 'overtimePolicy', 'multiplier', val)}
                                                suffix="x"
                                            />
                                            <InputGroup
                                                label="Weekly Off Multiplier"
                                                value={policy.overtimePolicy?.weeklyOffMultiplier || ''}
                                                onChange={(val) => handleLocationPolicyNestedChange(index, 'overtimePolicy', 'weeklyOffMultiplier', val)}
                                                suffix="x"
                                            />
                                            <InputGroup
                                                label="Holiday Multiplier"
                                                value={policy.overtimePolicy?.holidayMultiplier || ''}
                                                onChange={(val) => handleLocationPolicyNestedChange(index, 'overtimePolicy', 'holidayMultiplier', val)}
                                                suffix="x"
                                            />
                                            <InputGroup
                                                label="Fixed Hourly Rate"
                                                value={policy.overtimePolicy?.fixedHourlyRate || ''}
                                                onChange={(val) => handleLocationPolicyNestedChange(index, 'overtimePolicy', 'fixedHourlyRate', val)}
                                                suffix="INR"
                                                placeholder="Optional"
                                            />
                                        </div>

                                        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                                            <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Statutory Applicability</h5>
                                            <div className="flex flex-col space-y-1">
                                                <label className="text-sm font-medium text-gray-600">ESI</label>
                                                <select
                                                    value={policy.statutoryApplicability?.esiApplicable === true ? 'true' : policy.statutoryApplicability?.esiApplicable === false ? 'false' : ''}
                                                    onChange={(e) => handleLocationPolicyNestedChange(index, 'statutoryApplicability', 'esiApplicable', e.target.value === '' ? '' : e.target.value === 'true')}
                                                    className="block w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                >
                                                    <option value="">Use default</option>
                                                    <option value="true">Applicable</option>
                                                    <option value="false">Not applicable</option>
                                                </select>
                                            </div>
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={policy.statutoryApplicability?.lwfEnabled === true}
                                                    onChange={(e) => handleLocationPolicyNestedChange(index, 'statutoryApplicability', 'lwfEnabled', e.target.checked)}
                                                    className="rounded text-blue-600 h-4 w-4"
                                                />
                                                <span className="text-sm text-gray-700">LWF enabled</span>
                                            </label>
                                            <InputGroup
                                                label="LWF Employee Amount"
                                                value={policy.statutoryApplicability?.lwfEmployeeAmount || ''}
                                                onChange={(val) => handleLocationPolicyNestedChange(index, 'statutoryApplicability', 'lwfEmployeeAmount', val)}
                                                suffix="INR"
                                            />
                                            <InputGroup
                                                label="LWF Employer Amount"
                                                value={policy.statutoryApplicability?.lwfEmployerAmount || ''}
                                                onChange={(val) => handleLocationPolicyNestedChange(index, 'statutoryApplicability', 'lwfEmployerAmount', val)}
                                                suffix="INR"
                                            />
                                            <InputGroup
                                                label="LWF Deduction Month"
                                                value={policy.statutoryApplicability?.lwfDeductionMonth || ''}
                                                onChange={(val) => handleLocationPolicyNestedChange(index, 'statutoryApplicability', 'lwfDeductionMonth', val)}
                                                placeholder="4 for April"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-6 mt-4">
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={policy.isMetro}
                                                onChange={(e) => handleLocationPolicyChange(index, 'isMetro', e.target.checked)}
                                                className="rounded text-blue-600 h-4 w-4"
                                            />
                                            <span className="text-sm text-gray-700">Metro policy</span>
                                        </label>
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={policy.enabled !== false}
                                                onChange={(e) => handleLocationPolicyChange(index, 'enabled', e.target.checked)}
                                                className="rounded text-blue-600 h-4 w-4"
                                            />
                                            <span className="text-sm text-gray-700">Active</span>
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>
            </div>
        </div>
    );
};

export default PayrollRules;
