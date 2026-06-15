import React, { useState, useEffect } from 'react';
import { 
    Plus, Search, Edit2, Trash2, Shield, Info, Loader2, AlertTriangle, 
    CheckCircle2, MapPin, Briefcase, TrendingUp, DollarSign, X, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';

const CATEGORIES = [
    { value: 'UNSKILLED', label: 'Unskilled' },
    { value: 'SEMI_SKILLED', label: 'Semi Skilled' },
    { value: 'SKILLED', label: 'Skilled' }
];

const MinimumWageMaster = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [form, setForm] = useState({
        state: '',
        category: 'UNSKILLED',
        monthlyAmount: '',
        effectiveFrom: new Date().toISOString().split('T')[0]
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get('/payroll/minimum-wages');
            setData(res.data.data || []);
            setError(null);
        } catch (err) {
            setError('Failed to fetch minimum wage data');
            showToast('error', 'Fetch Error', 'Failed to retrieve minimum wage records');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item) => {
        setSelectedItem(item);
        setForm({
            state: item.state,
            category: item.category,
            monthlyAmount: item.monthlyAmount,
            effectiveFrom: new Date(item.effectiveFrom).toISOString().split('T')[0]
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this record? This may affect future payroll calculations.')) return;
        try {
            await api.delete(`/payroll/minimum-wages/${id}`);
            showToast('success', 'Deleted', 'Minimum wage record removed successfully');
            fetchData();
        } catch (err) {
            showToast('error', 'Delete Error', 'Failed to remove the record');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            if (selectedItem) {
                await api.put(`/payroll/minimum-wages/${selectedItem._id}`, form);
                showToast('success', 'Updated', 'Minimum wage updated successfully');
            } else {
                await api.post('/payroll/minimum-wages', form);
                showToast('success', 'Created', 'New minimum wage record added');
            }
            setIsModalOpen(false);
            setSelectedItem(null);
            setForm({ state: '', category: 'UNSKILLED', monthlyAmount: '', effectiveFrom: new Date().toISOString().split('T')[0] });
            fetchData();
        } catch (err) {
            showToast('error', 'Save Error', err.response?.data?.error || 'Failed to save minimum wage record');
        } finally {
            setSaving(false);
        }
    };

    const filteredData = data.filter(item => 
        item.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Minimum Wage Master</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium italic">Configure statutory minimum wages for compliance across India</p>
                </div>
                <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none font-black text-sm"
                >
                    <Plus size={20} strokeWidth={3} />
                    <span>ADD REGULATORY STATE</span>
                </motion.button>
            </div>

            {/* Content Card */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
                    <div className="relative max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                        <input 
                            type="text" 
                            placeholder="Filter by state or category..."
                            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 focus:border-indigo-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                <th className="px-8 py-5 border-b border-slate-100 dark:border-slate-800">Regulatory State</th>
                                <th className="px-8 py-5 border-b border-slate-100 dark:border-slate-800">Labor Category</th>
                                <th className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 text-right">Monthly (Basic)</th>
                                <th className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 text-right">Daily Rate</th>
                                <th className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 text-center">Effective From</th>
                                <th className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            <AnimatePresence mode="popLayout">
                                {loading ? (
                                    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="loading">
                                        <td colSpan="6" className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                                                <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Synchronizing records...</p>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ) : filteredData.length === 0 ? (
                                    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="empty">
                                        <td colSpan="6" className="px-8 py-20 text-center">
                                            <div className="max-w-xs mx-auto flex flex-col items-center">
                                                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-200 mb-4">
                                                    <Shield size={32} />
                                                </div>
                                                <p className="text-slate-900 dark:text-white font-black uppercase text-xs tracking-widest">No Compliance Records</p>
                                                <p className="text-slate-400 text-[10px] mt-2 font-bold leading-relaxed">Add state-wise minimum wage data to enable automatic salary structure generation.</p>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ) : (
                                    filteredData.map((item, idx) => (
                                        <motion.tr 
                                            key={item._id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors group"
                                        >
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600">
                                                        <MapPin size={16} />
                                                    </div>
                                                    <span className="font-black text-slate-900 dark:text-white tracking-tight text-sm uppercase">{item.state}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                    item.category === 'SKILLED' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                                                    item.category === 'SEMI_SKILLED' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' :
                                                    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                }`}>
                                                    <Briefcase size={10} className="mr-1.5" />
                                                    {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right font-black text-slate-900 dark:text-white text-base tracking-tighter">
                                                ₹{item.monthlyAmount.toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-slate-600 dark:text-slate-400 font-black text-xs italic">₹{(item.monthlyAmount / 26).toFixed(2)}</span>
                                                    <span className="text-[8px] text-slate-400 uppercase font-black">per day</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className="px-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                    {new Date(item.effectiveFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEdit(item)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all">
                                                        <Edit2 size={16} strokeWidth={2.5} />
                                                    </button>
                                                    <button onClick={() => handleDelete(item._id)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all">
                                                        <Trash2 size={16} strokeWidth={2.5} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Overlay */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white dark:border-slate-800"
                        >
                            <div className="px-10 py-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{selectedItem ? 'Update Compliance' : 'New Regulatory Record'}</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1 italic">Define statutory minimum wage limits</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all shadow-sm">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-10 space-y-8">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">State Name</label>
                                        <input 
                                            type="text" 
                                            required
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 focus:border-indigo-500 outline-none transition-all uppercase"
                                            placeholder="e.g. GUJARAT"
                                            value={form.state}
                                            onChange={(e) => setForm({ ...form, state: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Category</label>
                                        <select 
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 focus:border-indigo-500 outline-none transition-all appearance-none"
                                            value={form.category}
                                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                                        >
                                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Monthly Minimum Wage (Basic)</label>
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-emerald-100 dark:bg-emerald-900/20 rounded-3xl blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                        <div className="relative">
                                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 text-3xl font-black">₹</span>
                                            <input 
                                                type="number" 
                                                required
                                                className="w-full pl-14 pr-6 py-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl text-4xl font-black focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/20 focus:border-emerald-500 outline-none transition-all tracking-tighter"
                                                placeholder="0"
                                                value={form.monthlyAmount}
                                                onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Effective Date</label>
                                    <input 
                                        type="date" 
                                        required
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 focus:border-indigo-500 outline-none transition-all"
                                        value={form.effectiveFrom}
                                        onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                                    />
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 px-8 py-4 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 font-black text-xs uppercase tracking-[0.2em] transition-all"
                                    >
                                        DISCARD
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={saving}
                                        className="flex-[2] px-8 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2"
                                    >
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} strokeWidth={2.5} />}
                                        <span>{selectedItem ? 'UPDATE RECORD' : 'SAVE COMPLIANCE'}</span>
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MinimumWageMaster;
