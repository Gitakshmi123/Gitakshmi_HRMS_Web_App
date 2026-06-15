import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import companiesService from '../../services/companiesService';

export default function SubCompanyAdd() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [statsLoading, setStatsLoading] = useState(true);
    const [modulesLoading, setModulesLoading] = useState(true);
    const [errors, setErrors] = useState({});
    const [stats, setStats] = useState({ limit: 0, created: 0, remaining: 0 });
    const [parentModules, setParentModules] = useState([]);
    const [selectedModules, setSelectedModules] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        adminName: '',
        adminEmail: '',
        password: '',
        phone: '',
        address: '',
        codePreview: 'AUTO',
        logoFile: null
    });
    const [logoPreview, setLogoPreview] = useState('');

    useEffect(() => {
        const loadStats = async () => {
            setStatsLoading(true);
            try {
                const res = await companiesService.getMyCompany();
                setStats(res?.stats || { limit: 0, created: 0, remaining: 0 });
            } catch (error) {
                setErrors({ submit: error?.response?.data?.message || 'Failed to load company limit details' });
            } finally {
                setStatsLoading(false);
            }
        };
        loadStats();
    }, []);

    useEffect(() => {
        const loadModules = async () => {
            setModulesLoading(true);
            try {
                const res = await companiesService.getCompanyModules();
                const modules = Array.isArray(res?.modules) ? res.modules : [];
                setParentModules(modules);
                setSelectedModules(modules);
            } catch (error) {
                setErrors((prev) => ({
                    ...prev,
                    submit: error?.response?.data?.message || 'Failed to load parent modules'
                }));
            } finally {
                setModulesLoading(false);
            }
        };
        loadModules();
    }, []);

    const isLimitReached = Number(stats.remaining || 0) <= 0;

    const buildCodePreview = (companyName) => {
        const clean = String(companyName || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const prefix = (clean.slice(0, 3) || 'CMP');
        return `${prefix}001`;
    };

    const onChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            const next = { ...prev, [name]: value };
            if (name === 'name') {
                next.codePreview = buildCodePreview(value);
            }
            return next;
        });
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    };

    const onLogoChange = (e) => {
        const file = e.target.files?.[0] || null;
        setFormData((prev) => ({ ...prev, logoFile: file }));
        if (!file) {
            setLogoPreview('');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => setLogoPreview(reader.result?.toString() || '');
        reader.readAsDataURL(file);
    };

    const validate = () => {
        const next = {};
        if (!formData.name.trim()) next.name = 'Company name is required';
        if (!formData.adminName.trim()) next.adminName = 'Admin name is required';
        if (!formData.adminEmail.trim()) next.adminEmail = 'Admin email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail.trim())) next.adminEmail = 'Enter a valid email';
        if (!formData.password) next.password = 'Password is required';
        if (formData.password && formData.password.length < 6) next.password = 'Password must be at least 6 characters';
        if (parentModules.length > 0 && selectedModules.length === 0) next.modules = 'Select at least one module';
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const onModuleToggle = (module) => {
        setSelectedModules((prev) => {
            if (prev.includes(module)) return prev.filter((m) => m !== module);
            return [...prev, module];
        });
        if (errors.modules) setErrors((prev) => ({ ...prev, modules: '' }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        // if (isLimitReached) return;
        if (!validate()) return;

        setLoading(true);
        setErrors({});
        try {
            let logoUrl = '';
            if (formData.logoFile) {
                try {
                    const uploadRes = await companiesService.uploadLogo(formData.logoFile);
                    logoUrl = uploadRes?.url || uploadRes?.path || '';
                } catch {
                    logoUrl = '';
                }
            }

            await companiesService.createSubCompany({
                name: formData.name.trim(),
                adminName: formData.adminName.trim(),
                adminEmail: formData.adminEmail.trim().toLowerCase(),
                password: formData.password,
                phone: formData.phone.trim(),
                address: formData.address.trim(),
                logo: logoUrl,
                modules: selectedModules
            });

            if (typeof window.showToast === 'function') {
                window.showToast('success', 'Success', 'Sub-company created successfully');
            }
            navigate('..', { relative: 'path' });
        } catch (error) {
            const message = error?.response?.data?.message || 'Failed to create sub-company';
            if (typeof window.showToast === 'function') {
                window.showToast('error', 'Error', message);
            }
            setErrors({ submit: message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-semibold text-slate-800">Create Sub Company</h2>
            <p className="mt-1 text-sm text-slate-500">
                {statsLoading ? 'Syncing...' : `Total Created: ${stats.created}`}
            </p>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company Name</label>
                    <input
                        name="name"
                        value={formData.name}
                        onChange={onChange}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        placeholder="Enter company name"
                    />
                    {errors.name && <p className="mt-1 text-xs font-semibold text-red-600">{errors.name}</p>}
                </div>

                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Name</label>
                    <input
                        name="adminName"
                        value={formData.adminName}
                        onChange={onChange}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        placeholder="Enter admin name"
                    />
                    {errors.adminName && <p className="mt-1 text-xs font-semibold text-red-600">{errors.adminName}</p>}
                </div>

                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Email</label>
                    <input
                        name="adminEmail"
                        type="email"
                        value={formData.adminEmail}
                        onChange={onChange}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        placeholder="admin@subcompany.com"
                    />
                    {errors.adminEmail && <p className="mt-1 text-xs font-semibold text-red-600">{errors.adminEmail}</p>}
                </div>

                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
                    <input
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={onChange}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        placeholder="Enter password (min 6 characters)"
                    />
                    {errors.password && <p className="mt-1 text-xs font-semibold text-red-600">{errors.password}</p>}
                </div>

                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone Number (Optional)</label>
                    <input
                        name="phone"
                        value={formData.phone}
                        onChange={onChange}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        placeholder="Enter phone number"
                    />
                </div>

                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address (Optional)</label>
                    <textarea
                        name="address"
                        value={formData.address}
                        onChange={onChange}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Enter company address"
                    />
                </div>

                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company Code (Auto)</label>
                    <input
                        value={formData.codePreview}
                        disabled
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
                    />
                    <p className="mt-1 text-xs text-slate-500">Final code is auto-generated by backend (example: GIT001).</p>
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enabled Modules</label>
                    {modulesLoading ? (
                        <p className="mt-2 text-sm text-slate-500">Loading modules...</p>
                    ) : parentModules.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">No modules enabled on parent company.</p>
                    ) : (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {parentModules.map((moduleName) => (
                                <label key={moduleName} className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedModules.includes(moduleName)}
                                        onChange={() => onModuleToggle(moduleName)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">{moduleName}</span>
                                </label>
                            ))}
                        </div>
                    )}
                    {errors.modules && <p className="mt-2 text-xs font-semibold text-red-600">{errors.modules}</p>}
                </div>

                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company Logo (Optional)</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={onLogoChange}
                        className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                    />
                    {logoPreview && (
                        <img src={logoPreview} alt="Logo preview" className="mt-2 h-16 w-16 rounded-md border border-slate-200 object-contain p-1" />
                    )}
                </div>

                {errors.submit && <p className="text-sm font-semibold text-red-600">{errors.submit}</p>}

                <button
                    type="submit"
                    disabled={loading || statsLoading || modulesLoading}
                    className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? 'Creating...' : 'Create Sub Company'}
                </button>
            </form>
        </div>
    );
}
