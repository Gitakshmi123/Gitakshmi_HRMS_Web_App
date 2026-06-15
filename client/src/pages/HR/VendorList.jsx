import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    Plus,
    Search,
    Building2,
    Phone,
    Mail,
    ArrowRight,
    MapPin,
    Filter,
    Download
} from 'lucide-react';
import { Table, Button, Input, Tag, Card } from 'antd';
import api from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';

export default function VendorList() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [vendors, setVendors] = useState([]);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        fetchVendors();
    }, []);

    const fetchVendors = async () => {
        setLoading(true);
        try {
            const res = await api.get('/vendor/list');
            if (res.data.success) {
                setVendors(res.data.data);
            }
        } catch (error) {
            showToast('error', 'Error', 'Failed to fetch vendors');
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Vendor Identity',
            dataIndex: 'vendorName',
            key: 'vendorName',
            width: 350,
            render: (text, record) => (
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center shrink-0">
                        <Building2 size={24} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-base">{text}</span>
                        <div className="flex items-center gap-1.5 text-slate-400 mt-0.5">
                            <MapPin size={12} />
                            <span className="text-[11px] font-bold uppercase tracking-wider">{record.city}, {record.regionState}</span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: 'Communication',
            key: 'contact',
            render: (_, record) => (
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 group cursor-pointer">
                        <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <Phone size={12} />
                        </div>
                        <span className="text-sm font-bold text-slate-600">{record.mobileNo}</span>
                    </div>
                    <div className="flex items-center gap-2 group cursor-pointer">
                        <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <Mail size={12} />
                        </div>
                        <span className="text-sm font-bold text-slate-600">{record.emailId}</span>
                    </div>
                </div>
            )
        },
        {
            title: 'Settlement Node',
            key: 'bankInfo',
            render: (_, record) => (
                <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-800">{record.bankName}</span>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter mt-1 bg-slate-50 px-2 py-0.5 rounded-md self-start border border-slate-100 italic">IFSC: {record.ifscCode}</span>
                </div>
            )
        },
        {
            title: 'Status',
            dataIndex: 'msmeStatus',
            key: 'msmeStatus',
            render: (status) => (
                <Tag color={status === 'Yes' ? 'green' : 'default'} className="rounded-full px-4 py-0.5 font-black text-[10px] border-none shadow-sm">
                    {status === 'Yes' ? 'MSME REG' : 'STANDARD'}
                </Tag>
            )
        },
        {
            title: 'Onboarding',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: date => (
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">{new Date(date).toLocaleDateString()}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Registration Date</span>
                </div>
            )
        },
        {
            title: '',
            key: 'actions',
            align: 'right',
            render: (_, record) => (
                <Button
                    type="primary"
                    shape="circle"
                    icon={<ArrowRight size={18} />}
                    className="bg-slate-800 hover:bg-slate-900 shadow-lg shadow-slate-200 border-none scale-110"
                    onClick={() => navigate(`/employee/vendor/details/${record._id}`)}
                />
            )
        }
    ];

    const filteredVendors = vendors.filter(v =>
        (v.vendorName || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (v.emailId || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (v.city || '').toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700 pb-20 px-4">
            {/* Header Card */}
            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-50 border border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="p-5 bg-slate-800 rounded-[2rem] shadow-2xl shadow-slate-200 rotate-3">
                        <Users className="text-white" size={36} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Vendor Command Center</h1>
                        <p className="text-slate-400 font-bold text-lg mt-1">Enterprise registry of approved partners and service providers</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-800 transition-colors" size={20} />
                        <Input
                            placeholder="Search by name, city or email..."
                            className="w-full md:w-96 h-14 pl-12 rounded-2xl border-slate-100 bg-white focus:bg-white text-base font-medium shadow-inner transition-all"
                            onChange={e => setSearchText(e.target.value)}
                        />
                    </div>
                    <Button
                        type="primary"
                        size="large"
                        icon={<Plus size={24} />}
                        onClick={() => navigate('/employee/vendor/step1')}
                        className="bg-slate-800 hover:bg-slate-900 h-14 px-8 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-2xl shadow-slate-200 border-none transition-transform active:scale-95"
                    >
                        New Partner
                    </Button>
                </div>
            </div>

            {/* Table Card */}
            <Card className="rounded-[3rem] border-slate-100 shadow-2xl shadow-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Filter className="text-indigo-600" size={18} />
                        <span className="font-black text-slate-800 uppercase tracking-widest text-xs">Active Registry Filter</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                        TOTAL: <span className="text-indigo-600 font-black">{filteredVendors.length}</span> VENDORS
                    </div>
                </div>
                <Table
                    columns={columns}
                    dataSource={filteredVendors}
                    loading={loading}
                    rowKey="_id"
                    pagination={{
                        pageSize: 10,
                        className: "px-10 py-8",
                        showTotal: (total) => <span className="font-bold text-slate-400">Total {total} entities</span>
                    }}
                    className="modern-vendor-table"
                />
            </Card>

            <style>{`
                .modern-vendor-table .ant-table-thead > tr > th {
                    background: transparent !important;
                    color: #94a3b8 !important;
                    font-size: 11px !important;
                    text-transform: uppercase !important;
                    font-weight: 800 !important;
                    letter-spacing: 0.1em !important;
                    padding: 24px !important;
                    border-bottom: 2px solid #f8fafc !important;
                }
                .modern-vendor-table .ant-table-tbody > tr > td {
                    padding: 24px !important;
                    border-bottom: 1px solid #f8fafc !important;
                }
                .modern-vendor-table .ant-table-tbody > tr:hover > td {
                    background: #f8fafc !important;
                }
                .modern-vendor-table .ant-table-container {
                    border-radius: 0 !important;
                }
            `}</style>
        </div>
    );
}
