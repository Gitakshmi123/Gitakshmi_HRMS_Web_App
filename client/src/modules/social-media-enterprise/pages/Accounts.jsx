import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Tooltip, Modal } from 'antd';
import { Share2, Plus, RefreshCw, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import socialApi from '../services/social.api';
import { notification } from '../../../utils/antdGlobal';
import usePagePermissions from '../../../hooks/usePagePermissions';

const Accounts = ({ permissions }) => {
    const fallbackPerms = usePagePermissions('socialMedia.accounts');
    const { canView, canCreate, canDelete: rawDelete, isPrivileged } = permissions || fallbackPerms;
    const canDelete = isPrivileged || rawDelete;
    const canSeeAccounts = canView || canDelete || isPrivileged;
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, contextHolder] = Modal.useModal();

    const loadAccounts = async () => {
        if (!canSeeAccounts) {
            setAccounts([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await socialApi.getAccounts();
            setAccounts(data);
        } catch {
            notification.error({ message: 'Failed to load accounts' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!canSeeAccounts) return;
        loadAccounts();

        // Handle OAuth callback redirects
        const urlParams = new URLSearchParams(window.location.search);
        const connected = urlParams.get('connected');
        const platform = urlParams.get('platform');
        const errorMessage = urlParams.get('message');

        if (connected === 'true') {
            notification.success({
                message: 'Account Connected',
                description: `Successfully connected ${platform} account!`,
                duration: 5
            });
            window.history.replaceState({}, '', window.location.pathname);
            loadAccounts();
        } else if (connected === 'false') {
            notification.error({
                message: 'Connection Failed',
                description: errorMessage || 'Failed to connect social account.',
                duration: 5
            });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [canSeeAccounts]);

    const handleConnect = async (platform) => {
        if (!canCreate) return;
        try {
            const { url } = await socialApi.initiateOAuth(platform);
            window.location.href = url;
        } catch {
            notification.error({ message: `Failed to initiate ${platform} connection` });
        }
    };

    const handleDisconnect = (platform) => {
        if (!canDelete) return;
        modal.confirm({
            title: `Disconnect ${platform}?`,
            content: `This will remove all connected ${platform} accounts for this branch.`,
            okText: 'Disconnect',
            okType: 'danger',
            onOk: async () => {
                try {
                    await socialApi.disconnectAccount(platform);
                    notification.success({ message: 'Account Disconnected' });
                    loadAccounts();
                } catch {
                    notification.error({ message: 'Failed to disconnect account' });
                }
            }
        });
    };

    const platformConfig = {
        facebook: { bg: 'bg-[#1877F2]/10', text: 'text-[#1877F2]', label: 'Facebook' },
        instagram: { bg: 'bg-[#E4405F]/10', text: 'text-[#E4405F]', label: 'Instagram' },
        linkedin: { bg: 'bg-[#0A66C2]/10', text: 'text-[#0A66C2]', label: 'LinkedIn' },
    };

    const columns = [
        {
            title: <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Platform</span>,
            dataIndex: 'platform',
            key: 'platform',
            width: 120,
            render: (text) => {
                const config = platformConfig[text] || { bg: 'bg-slate-100', text: 'text-slate-600', label: text };
                return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-transparent ${config.bg} ${config.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${text === 'facebook' ? 'bg-[#1877F2]' : text === 'instagram' ? 'bg-[#E4405F]' : text === 'linkedin' ? 'bg-[#0A66C2]' : 'bg-slate-400'}`} />
                        {config.label}
                    </span>
                );
            }
        },
        {
            title: <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Account</span>,
            key: 'accountDetail',
            render: (_, record) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm shrink-0 border border-slate-200/80">
                        {record.accountName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{record.accountName}</p>
                    </div>
                </div>
            )
        },
        {
            title: <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>,
            dataIndex: 'status',
            key: 'status',
            width: 110,
            render: (status) => (
                status === 'active' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/60">
                        <CheckCircle2 size={12} className="shrink-0" />
                        Active
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium border border-rose-200/60">
                        <AlertCircle size={12} className="shrink-0" />
                        {String(status)}
                    </span>
                )
            )
        },
        {
            title: <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Sync</span>,
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: 165,
            render: (date) => <span className="text-slate-500 text-xs">{date ? new Date(date).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
        },
        {
            title: <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</span>,
            key: 'action',
            width: 90,
            align: 'center',
            render: (_, record) => canDelete ? (
                <Tooltip title="Disconnect account">
                    <Button
                        type="text"
                        danger
                        size="small"
                        className="hover:bg-rose-50 rounded-lg"
                        icon={<Trash2 size={14} />}
                        onClick={() => handleDisconnect(record.platform)}
                    />
                </Tooltip>
            ) : null,
        },
    ];
    const showConnectModal = () => {
        let instance = null;
        instance = modal.info({
            title: (
                <div className="pr-6">
                    <h3 className="text-slate-800 font-semibold text-base m-0">Connect new platform</h3>
                    <p className="text-slate-500 text-sm font-normal mt-1 m-0">Choose a channel to connect to your account.</p>
                </div>
            ),
            icon: null,
            width: 440,
            className: "connect-platform-modal",
            content: (
                <div className="grid grid-cols-1 gap-2.5 pt-1 pb-2">
                    <button
                        type="button"
                        className="w-full h-12 rounded-lg flex items-center justify-between px-4 border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 transition-all duration-200 group text-left"
                        onClick={() => { if (instance) instance.destroy(); handleConnect('facebook'); }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[#1877F2] flex items-center justify-center text-white font-semibold text-sm shrink-0">f</div>
                            <span className="text-slate-700 font-medium text-sm">Facebook Page</span>
                        </div>
                        <Plus size={16} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
                    </button>
                    <button
                        type="button"
                        className="w-full h-12 rounded-lg flex items-center justify-between px-4 border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 transition-all duration-200 group text-left"
                        onClick={() => { if (instance) instance.destroy(); handleConnect('instagram'); }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] flex items-center justify-center text-white font-semibold text-sm shrink-0">I</div>
                            <span className="text-slate-700 font-medium text-sm">Instagram Business</span>
                        </div>
                        <Plus size={16} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
                    </button>
                    <button
                        type="button"
                        className="w-full h-12 rounded-lg flex items-center justify-between px-4 border border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300 transition-all duration-200 group text-left"
                        onClick={() => { if (instance) instance.destroy(); handleConnect('linkedin'); }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[#0A66C2] flex items-center justify-center text-white font-semibold text-sm shrink-0">L</div>
                            <span className="text-slate-700 font-medium text-sm">LinkedIn Profile</span>
                        </div>
                        <Plus size={16} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
                    </button>
                </div>
            ),
            footer: null,
            closable: true
        });
    };

    return (
        <>
        {contextHolder}
        <Card
            title={
                <div className="flex items-center gap-3 py-0.5">
                    <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600 border border-slate-200/80">
                        <Share2 size={18} />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-slate-800 tracking-tight">Social Connections</h2>
                    </div>
                </div>
            }
            className="shadow-sm border border-slate-200/90 rounded-xl overflow-hidden [&_.ant-card-head]:border-b [&_.ant-card-head]:border-slate-200/80 [&_.ant-card-body]:p-0"
            extra={
                <div className="flex gap-2">
                    {canSeeAccounts && (
                        <Button
                            icon={<RefreshCw size={15} />}
                            onClick={loadAccounts}
                            className="h-9 rounded-lg border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                        />
                    )}
                    {canCreate && (
                        <Button
                            type="primary"
                            className="bg-indigo-600 hover:bg-indigo-700 border-0 h-9 rounded-lg font-medium text-sm px-4"
                            icon={<Plus size={15} />}
                            onClick={showConnectModal}
                        >
                            Connect Channel
                        </Button>
                    )}
                </div>
            }
        >
            {canSeeAccounts ? (
                <div className="overflow-x-auto">
                    <Table
                        columns={columns}
                        dataSource={accounts}
                        loading={loading}
                        pagination={false}
                        rowKey="_id"
                        size="middle"
                        className="accounts-table [&_.ant-table-thead>tr>th]:bg-slate-50 [&_.ant-table-thead>tr>th]:text-slate-600 [&_.ant-table-thead>tr>th]:font-semibold [&_.ant-table-tbody>tr:hover>td]:bg-slate-50/80 [&_.ant-table-tbody>tr>td]:py-3 [&_.ant-table-tbody>tr>td]:align-middle"
                        locale={{
                            emptyText: (
                                <div className="py-16 flex flex-col items-center gap-3 text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                                        <Share2 size={28} />
                                    </div>
                                    <p className="text-slate-600 font-medium">No social accounts connected yet</p>
                                    <p className="text-slate-400 text-sm max-w-sm">Connect Facebook, Instagram, or LinkedIn to publish and manage posts from one place.</p>
                                </div>
                            )
                        }}
                    />
                </div>
            ) : (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <AlertCircle size={28} />
                    </div>
                    <p className="text-slate-600 font-bold text-lg">Access Restricted</p>
                    <p className="text-slate-400 text-sm max-w-sm">You don't have permission to manage social accounts. Please contact your administrator.</p>
                </div>
            )}
        </Card>
        </>
    );
};

export default Accounts;
