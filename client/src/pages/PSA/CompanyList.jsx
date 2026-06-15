import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, Plus, Eye, Edit2, Settings, Zap } from 'lucide-react';
import companiesService from '../../services/companiesService';

function StatusBadge({ status }) {
    const isActive = status === 'active';
    return (
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
            {isActive ? 'active' : 'inactive'}
        </span>
    );
}

export default function CompanyList() {
    const navigate = useNavigate();
    const [parents, setParents] = useState([]);
    const [subCompaniesMap, setSubCompaniesMap] = useState({});
    const [openCompanyId, setOpenCompanyId] = useState(null);
    const [loadingParentId, setLoadingParentId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const loadParents = async () => {
        setLoading(true);
        try {
            const data = await companiesService.getParentCompanies();
            setParents(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load parent companies:', error);
            setParents([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadParents();
    }, []);

    const filteredParents = useMemo(() => {
        if (!searchQuery) return parents;
        const q = String(searchQuery).toLowerCase();
        return parents.filter((c) => {
            const name = String(c.companyName || c.name || '').toLowerCase();
            const email = String(c.adminEmail || c.companyEmail || c.adminUser?.email || '').toLowerCase();
            const code = String(c.code || '').toLowerCase();
            return name.includes(q) || email.includes(q) || code.includes(q);
        });
    }, [parents, searchQuery]);

    const stats = {
        total: parents.length,
        active: parents.filter((c) => c.status === 'active').length,
        inactive: parents.filter((c) => c.status !== 'active').length
    };

    const toggleExpand = async (companyId) => {
        if (!companyId) return;
        if (openCompanyId === companyId) {
            setOpenCompanyId(null);
            return;
        }

        setOpenCompanyId(companyId);
        if (subCompaniesMap[companyId]) return; // already lazy-loaded

        setLoadingParentId(companyId);
        try {
            const subs = await companiesService.getSubCompaniesByParent(companyId);
            setSubCompaniesMap((prev) => ({ ...prev, [companyId]: Array.isArray(subs) ? subs : [] }));
        } catch (error) {
            console.error('Failed to load sub companies:', error);
            setSubCompaniesMap((prev) => ({ ...prev, [companyId]: [] }));
        } finally {
            setLoadingParentId(null);
        }
    };

    const toggleActive = async (company) => {
        const name = company.companyName || company.name || 'this company';
        if (!window.confirm(`Are you sure you want to change status for ${name}?`)) return;
        try {
            await companiesService.toggleCompanyStatus(company._id, company.status);
            await loadParents();
        } catch (error) {
            console.error(error);
            alert('Failed to update status');
        }
    };

    return (
        <div className="w-full space-y-4 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Companies</p>
                    <p className="mt-1 text-3xl font-black text-slate-900">{stats.total}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active Companies</p>
                    <p className="mt-1 text-3xl font-black text-slate-900">{stats.active}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Inactive Companies</p>
                    <p className="mt-1 text-3xl font-black text-slate-900">{stats.inactive}</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2">
                    <Search size={18} className="text-slate-400" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search parent companies..."
                        className="w-full border-none bg-transparent text-sm font-semibold text-slate-700 outline-none"
                    />
                </div>
                <button
                    onClick={() => navigate('/psa/companies/add')}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black uppercase tracking-widest text-white hover:bg-indigo-700"
                >
                    <Plus size={15} /> Create Company
                </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-12 border-b border-slate-200 px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <div className="col-span-5">Company</div>
                    <div className="col-span-2">Code</div>
                    <div className="col-span-2">Admin Email</div>
                    <div className="col-span-1">Status</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>

                {loading ? (
                    <p className="p-4 text-sm text-slate-500">Loading companies...</p>
                ) : filteredParents.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No companies found.</p>
                ) : (
                    <div className="space-y-2 pt-2">
                        {filteredParents.map((parent) => {
                            const isOpen = openCompanyId === parent._id;
                            const subList = subCompaniesMap[parent._id] || [];
                            return (
                                <div key={parent._id} className="rounded-lg border border-slate-100">
                                    <div className="grid grid-cols-12 items-center px-3 py-3">
                                        <div className="col-span-5 flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                                <Building2 size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-black text-slate-800">{parent.companyName || parent.name}</p>
                                                <p className="truncate text-xs text-slate-500">Parent Company</p>
                                            </div>
                                        </div>
                                        <div className="col-span-2 text-xs font-black text-slate-500">{parent.code || 'NULL'}</div>
                                        <div className="col-span-2 truncate text-xs font-semibold text-slate-600">{parent.adminUser?.email || parent.adminEmail || parent.companyEmail || '-'}</div>
                                        <div className="col-span-1"><StatusBadge status={parent.status} /></div>
                                        <div className="col-span-2 flex items-center justify-end gap-1">
                                            <button onClick={() => navigate(`/psa/companies/view/${parent._id}`)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"><Eye size={15} /></button>
                                            <button onClick={() => navigate(`/psa/companies/edit/${parent._id}`)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"><Edit2 size={15} /></button>
                                            <button onClick={() => navigate(`/psa/modules/${parent._id}`)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"><Settings size={15} /></button>
                                            <button onClick={() => toggleActive(parent)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600"><Zap size={15} /></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
