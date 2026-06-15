import React, { useState, useMemo, useEffect } from 'react';
import {
    TrendingUp,
    Users,
    CheckCircle,
    Clock,
    Plus,
    Search,
    Filter,
    Download,
    Eye,
    Edit2,
    Trash2,
    AlertCircle,
    X,
    FilterX,
    IndianRupee,
} from 'lucide-react';
import api from '../../utils/api';

const RecruitmentHistory = () => {
    const [recruitments, setRecruitments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [dateRange, setDateRange] = useState('all');
    const [sortBy, setSortBy] = useState('date');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        const fetchRecruitments = async () => {
            setLoading(true);
            try {
                const res = await api.get('/requirements');
                const data = res.data.requirements || res.data || [];
                // Map API fields to UI fields
                const mapped = data.map(r => ({
                    id: r._id,
                    position: r.jobTitle,
                    department: r.department?.name || r.department || 'N/A',
                    postedDate: r.createdAt,
                    applicants: r.applicantsCount || 0,
                    hired: 0, 
                    budget: 0,
                    status: (r.status || 'open').toLowerCase(),
                    description: r.description ? (r.description.length > 100 ? r.description.substring(0, 100) + '...' : r.description) : 'No description provided.',
                }));
                setRecruitments(mapped);
            } catch (err) {
                console.error("Failed to fetch recruitments:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRecruitments();
    }, []);

    const checkDateRange = (item, range) => {
        if (range === 'all') return true;

        const now = new Date();
        const itemDate = new Date(item.postedDate);
        const diffTime = now - itemDate;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);

        if (range === 'week') return diffDays <= 7;
        if (range === 'month') return diffDays <= 30;
        if (range === 'quarter') return diffDays <= 90;
        return true;
    };

    // Filter and search logic
    const filteredRecruitments = useMemo(() => {
        let filtered = recruitments.filter((item) => {
            const matchesSearch =
                item.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.department.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus =
                selectedStatus === 'all' || item.status === selectedStatus;

            const matchesDate = checkDateRange(item, dateRange);

            return matchesSearch && matchesStatus && matchesDate;
        });

        // Sorting
        if (sortBy === 'date') {
            filtered.sort(
                (a, b) => new Date(b.postedDate) - new Date(a.postedDate)
            );
        } else if (sortBy === 'applicants') {
            filtered.sort((a, b) => b.applicants - a.applicants);
        } else if (sortBy === 'budget') {
            filtered.sort((a, b) => b.budget - a.budget);
        }

        return filtered;
    }, [recruitments, searchTerm, selectedStatus, sortBy, dateRange]);



    const getStatusStyle = (status) => {
        const styles = {
            open: {
                bg: 'bg-slate-100',
                border: 'border-slate-200',
                text: 'text-slate-900',
                icon: 'text-slate-500',
                badge: 'bg-slate-200',
            },
            closed: {
                bg: 'bg-gray-50',
                border: 'border-gray-200',
                text: 'text-gray-700',
                icon: 'text-gray-500',
                badge: 'bg-gray-100',
            },
            pending: {
                bg: 'bg-amber-50',
                border: 'border-amber-200',
                text: 'text-amber-700',
                icon: 'text-amber-500',
                badge: 'bg-amber-100',
            },
        };

        return styles[status] || styles.open;
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'open':
                return <TrendingUp className="w-4 h-4" />;
            case 'closed':
                return <CheckCircle className="w-4 h-4" />;
            case 'pending':
                return <Clock className="w-4 h-4" />;
            default:
                return null;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const stats = [
        {
            icon: TrendingUp,
            label: 'Open Positions',
            value: mockRecruitments.filter((r) => r.status === 'open').length,
            color: 'blue',
        },
        {
            icon: Users,
            label: 'Total Applicants',
            value: mockRecruitments.reduce((sum, r) => sum + r.applicants, 0),
            color: 'purple',
        },
        {
            icon: CheckCircle,
            label: 'Hired',
            value: mockRecruitments.reduce((sum, r) => sum + r.hired, 0),
            color: 'green',
        },
        {
            icon: IndianRupee,
            label: 'Total Budget',
            value: `$${mockRecruitments.reduce((sum, r) => sum + r.budget, 0).toLocaleString()}`,
            color: 'emerald',
        },
    ];

    return (
        <div className="p-2.5 min-h-screen bg-slate-50">
            {/* Header Section */}
            <div className="relative top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
                                Recruitment History
                            </h1>
                            <p className="text-slate-600 mt-1 text-sm">
                                Manage and track all recruitment campaigns
                            </p>
                        </div>
                            <button className="inline-flex gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-slate-500/30 transition-all duration-300 transform hover:scale-105">
                                <Plus className="w-5 h-5" />
                                Import Recruitment Data
                            </button>
                            <button className="inline-flex gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-slate-500/30 transition-all duration-300 transform hover:scale-105">
                                <Plus className="w-5 h-5" />
                                New Recruitment
                            </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {stats.map((stat, idx) => {
                        const Icon = stat.icon;
                        const colorClasses = {
                            blue: 'from-slate-800 to-slate-900',
                            purple: 'from-slate-700 to-slate-800',
                            green: 'from-slate-600 to-slate-700',
                            emerald: 'from-slate-500 to-slate-600',
                        };

                        return (
                            <div
                                key={idx}
                                className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-all duration-300"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-slate-600 text-sm font-medium">
                                            {stat.label}
                                        </p>
                                        <p className="text-3xl font-bold text-slate-900 mt-2">
                                            {stat.value}
                                        </p>
                                    </div>
                                    <div
                                        className={`bg-gradient-to-br ${colorClasses[stat.color]} p-3 rounded-lg`}
                                    >
                                        <Icon className="w-6 h-6 text-white" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Search and Filter Section */}
                <div className="mb-8 space-y-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        {/* Search Bar */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by position or department..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>

                        {/* Filter Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all"
                        >
                            <Filter className="w-5 h-5 text-slate-600" />
                            <span className="text-slate-700 font-medium">Filters</span>
                        </button>

                        {/* Export Button */}
                        <button className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all">
                            <Download className="w-5 h-5 text-slate-600" />
                            <span className="text-slate-700 font-medium">Export</span>
                        </button>
                    </div>

                    {/* Filter Panel */}
                    {showFilters && (
                        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-slate-900">
                                    Filters
                                </h3>
                                <button
                                    onClick={() => setShowFilters(false)}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Status Filter */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Status
                                    </label>
                                    <select
                                        value={selectedStatus}
                                        onChange={(e) => setSelectedStatus(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="open">Open</option>
                                        <option value="closed">Closed</option>
                                        <option value="pending">Pending</option>
                                    </select>
                                </div>

                                {/* Date Range Filter */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Date Range
                                    </label>
                                    <select
                                        value={dateRange}
                                        onChange={(e) => setDateRange(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">All Time</option>
                                        <option value="week">Last 7 Days</option>
                                        <option value="month">Last Month</option>
                                        <option value="quarter">Last Quarter</option>
                                    </select>
                                </div>

                                {/* Sort Filter */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Sort By
                                    </label>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="date">Posted Date</option>
                                        <option value="applicants">Applicants</option>
                                        <option value="budget">Budget</option>
                                    </select>
                                </div>
                            </div>

                            {/* Reset Filters */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        setSelectedStatus('all');
                                        setDateRange('all');
                                        setSortBy('date');
                                        setSearchTerm('');
                                    }}
                                    className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all"
                                >
                                    Reset Filters
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Recruitment Cards Grid */}
                {filteredRecruitments.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6">
                        {filteredRecruitments.map((recruitment) => {
                            const statusStyle = getStatusStyle(recruitment.status);

                            return (
                                <div
                                    key={recruitment.id}
                                    className={`bg-white rounded-xl border ${statusStyle.border} p-6 hover:shadow-xl transition-all duration-300 group cursor-pointer`}
                                >
                                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                                        {/* Main Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                                {/* Position Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                                                        <h3 className="text-xl font-bold text-slate-900 truncate">
                                                            {recruitment.position}
                                                        </h3>
                                                        <span
                                                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusStyle.badge} ${statusStyle.text} w-fit`}
                                                        >
                                                            {getStatusIcon(recruitment.status)}
                                                            {recruitment.status.charAt(0).toUpperCase() +
                                                                recruitment.status.slice(1)}
                                                        </span>
                                                    </div>

                                                    <p className="text-slate-600 text-sm mb-4">
                                                        {recruitment.description}
                                                    </p>

                                                    {/* Key Metrics */}
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                        <div className="bg-slate-50 rounded-lg p-3">
                                                            <p className="text-xs text-slate-600 mb-1">
                                                                Department
                                                            </p>
                                                            <p className="text-sm font-semibold text-slate-900">
                                                                {recruitment.department}
                                                            </p>
                                                        </div>

                                                        <div className="bg-slate-50 rounded-lg p-3">
                                                            <p className="text-xs text-slate-600 mb-1">
                                                                Posted
                                                            </p>
                                                            <p className="text-sm font-semibold text-slate-900">
                                                                {formatDate(recruitment.postedDate)}
                                                            </p>
                                                        </div>

                                                        <div className="bg-slate-50 rounded-lg p-3">
                                                            <p className="text-xs text-slate-600 mb-1">
                                                                Applicants
                                                            </p>
                                                            <p className="text-sm font-semibold text-slate-950">
                                                                {recruitment.applicants}
                                                            </p>
                                                        </div>

                                                        <div className="bg-slate-100 rounded-lg p-3">
                                                            <p className="text-xs text-slate-800 mb-1">
                                                                Budget
                                                            </p>
                                                            <p className="text-sm font-semibold text-slate-950">
                                                                ${recruitment.budget.toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex flex-row lg:flex-col gap-2 justify-start lg:justify-between">
                                            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition-all font-medium text-sm">
                                                <Eye className="w-4 h-4" />
                                                <span className="hidden sm:inline">View</span>
                                            </button>

                                            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-all font-medium text-sm">
                                                <Edit2 className="w-4 h-4" />
                                                <span className="hidden sm:inline">Edit</span>
                                            </button>

                                            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 rounded-lg hover:bg-red-50 transition-all font-medium text-sm">
                                                <Trash2 className="w-4 h-4" />
                                                <span className="hidden sm:inline">Delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Empty State */
                    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                        <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                            No Recruitment Found
                        </h3>
                        <p className="text-slate-600 mb-6">
                            {searchTerm || selectedStatus !== 'all' || dateRange !== 'all'
                                ? 'Try adjusting your search or filter criteria'
                                : 'No recruitment campaigns yet. Create one to get started!'}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setSelectedStatus('all');
                                    setDateRange('all');
                                }}
                                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                                Clear Filters
                            </button>
                            <button className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-950">
                                Create New Recruitment
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecruitmentHistory;
