import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, Users, Plus, LayoutGrid, List, Search, MoreVertical, Filter, ChevronRight } from 'lucide-react';
import companiesService from '../../services/companiesService';

export default function BranchList() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [viewMode, setViewMode] = useState('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });

    useEffect(() => {
        const fetchBranches = async () => {
            setLoading(true);
            try {
                const res = await companiesService.getBranches();
                const branches = res?.data || res?.items || [];
                setItems(branches);
                
                setStats({
                    total: branches.length,
                    active: branches.filter(b => b.isActive !== false && b.status !== 'inactive').length,
                    inactive: branches.filter(b => b.isActive === false || b.status === 'inactive').length
                });
            } catch (error) {
                console.error('Failed to fetch branches:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchBranches();
    }, []);

    const filteredItems = items.filter(item => 
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.branchCode || item.code)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.city?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header section with Stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 antialiased">Branch Management</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage and monitor all physical branch locations of your organization.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <List size={18} />
                        </button>
                    </div>
                    <Link
                        to="new"
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-indigo-200 transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        Add Branch
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-indigo-200 transition-colors">
                    <div className="h-12 w-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Branches</p>
                        <p className="text-2xl font-black text-slate-900 leading-none mt-1">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-emerald-200 transition-colors">
                    <div className="h-12 w-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <MapPin size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Units</p>
                        <p className="text-2xl font-black text-slate-900 leading-none mt-1">{stats.active}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-amber-200 transition-colors">
                    <div className="h-12 w-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Staff Distribution</p>
                        <p className="text-2xl font-black text-slate-900 leading-none mt-1">Multi-Region</p>
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Search branches by name, code or city..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                    />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                    <Filter size={16} />
                    Filter
                </button>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="h-10 w-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="text-sm font-medium text-slate-500">Retrieving branch records...</p>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-20 flex flex-col items-center text-center px-6">
                    <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <Building2 size={40} className="text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No branches found</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm">
                        You haven't added any branch locations yet. Create your first branch to start organizing your workforce.
                    </p>
                    <Link
                        to="new"
                        className="mt-6 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        Register New Branch
                    </Link>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredItems.map((item) => (
                        <div key={item._id} className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-indigo-500 transition-all duration-300 flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4">
                                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <MoreVertical size={18} />
                                </button>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="h-14 w-14 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                                    <Building2 size={28} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                </div>
                                <div className="flex-1 min-w-0 pr-4">
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 mb-1">
                                        {item.branchCode || item.code || 'BR-001'}
                                    </span>
                                    <h4 className="font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{item.name}</h4>
                                    <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                                        <MapPin size={12} />
                                        <span className="text-xs truncate">{item.city || 'Headquarters'}, {item.state || 'Admin'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Departments</p>
                                    <p className="text-sm font-black text-slate-700 mt-0.5">{item.departmentCount || 0}</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Employees</p>
                                    <p className="text-sm font-black text-slate-700 mt-0.5">{item.employeeCount || 0}</p>
                                </div>
                            </div>

                            <div className="mt-5 pt-5 border-t border-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${item.isActive !== false ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                    <span className="text-xs font-bold text-slate-500 capitalize">{item.isActive !== false ? 'active' : 'inactive'}</span>
                                </div>
                                <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group/btn">
                                    Manage Details
                                    <ChevronRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">Branch Details</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">Location</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">Contact</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredItems.map((item) => (
                                <tr key={item._id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                                <Building2 size={20} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{item.name}</p>
                                                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{item.branchCode || item.code || 'BR-001'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-slate-600">{item.city || 'Remote'}</p>
                                        <p className="text-xs text-slate-400">{item.state || 'Headquarters'}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                            item.isActive !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {item.isActive !== false ? 'active' : 'inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-slate-600">{item.email || 'n/a'}</p>
                                        <p className="text-xs text-slate-400">{item.phone || 'n/a'}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <button className="text-xs font-bold text-indigo-600 hover:underline">Edit</button>
                                            <button className="text-xs font-bold text-red-600 hover:underline">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
