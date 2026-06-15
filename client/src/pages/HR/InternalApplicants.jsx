
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Table, Tag, Input, Button } from 'antd';
import { Search, Briefcase, ChevronRight, Mail, Calendar } from 'lucide-react';
import dayjs from 'dayjs';

export default function InternalApplicants() {
    const navigate = useNavigate();
    const [applicants, setApplicants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadApplicants();
    }, []);

    const loadApplicants = async () => {
        setLoading(true);
        try {
            // Fetch jobs and applicants concurrently
            const [jobsRes, appsRes] = await Promise.all([
                api.get('/requirements/internal-jobs'),
                api.get('/requirements/applicants')
            ]);

            const allJobs = jobsRes.data.jobs || jobsRes.data || [];
            const allApps = appsRes.data?.data || appsRes.data || [];

            // Group candidates by jobId
            const groupedJobs = allJobs.map(job => {
                const candidates = allApps.filter(app => String(app.requirementId?._id) === String(job._id) || String(app.requirementId) === String(job._id));
                return {
                    ...job,
                    candidates
                };
            });

            setApplicants(groupedJobs);
        } catch (err) {
            console.error("Failed to load applicants or jobs", err);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredApplicants = () => {
        let filtered = applicants;

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(job =>
                job.jobTitle?.toLowerCase().includes(lowerQuery) ||
                job.department?.toLowerCase().includes(lowerQuery) ||
                job.jobOpeningId?.toLowerCase().includes(lowerQuery) ||
                (job.candidates && job.candidates.some(c => c.name?.toLowerCase().includes(lowerQuery)))
            );
        }

        return filtered;
    };

    const columns = [
        {
            title: 'Internal Job',
            key: 'job',
            render: (_, record) => (
                <div>
                    <div className="font-bold text-slate-700">{record.jobTitle}</div>
                    <div className="text-xs text-slate-500">{record.department} | {record.jobOpeningId}</div>
                </div>
            )
        },
        {
            title: 'Vacancies',
            dataIndex: 'vacancy',
            key: 'vacancy',
            render: (val) => <span className="font-semibold text-slate-600">{val || 0}</span>
        },
        {
            title: 'Candidates Applied',
            key: 'candidates',
            render: (_, record) => (
                <div className="space-y-1">
                    <div className="font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full w-max text-xs">
                        {record.candidates?.length || 0} Total
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                        Referral: {(record.candidates || []).filter(c => c?.referral?.referrerEmployeeId || c?.referral?.usedCode).length}
                    </div>
                </div>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={status === 'Open' ? 'green' : 'default'} className="uppercase font-bold text-[10px] tracking-wider px-2 py-0.5 rounded-md border-0">
                    {status}
                </Tag>
            )
        },
        {
            title: 'Pipeline Action',
            key: 'action',
            render: (_, record) => (
                <Button
                    type="primary"
                    size="small"
                    className="bg-indigo-600"
                    disabled={!record.candidates || record.candidates.length === 0}
                    icon={<ChevronRight size={14} />}
                    onClick={() => {
                        navigate('/hr/applicants', { state: { selectedRequirementId: record._id } });
                    }}
                >
                    View Pipeline
                </Button>
            )
        }
    ];

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <Briefcase className="text-indigo-600" />
                        Internal Pipeline
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Manage internal jobs and view candidate pipelines.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest">
                        {applicants.length} Total
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center">
                <Input
                    prefix={<Search size={16} className="text-slate-400" />}
                    placeholder="Search jobs or candidates..."
                    className="max-w-md rounded-xl py-2"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    dataSource={getFilteredApplicants()}
                    columns={columns}
                    rowKey="_id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    rowClassName="hover:bg-slate-50 transition-colors"
                />
            </div>
        </div>
    );
}
