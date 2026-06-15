import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Badge, Tooltip, Avatar, Input, DatePicker, App, Alert } from 'antd';
import { History, Eye, CheckCircle, Clock, Layers, Video, Edit, Trash2, Music as MusicIcon, RefreshCcw, Play } from 'lucide-react';
import socialApi from '../services/social.api';
import dayjs from 'dayjs';
import usePagePermissions from '../../../hooks/usePagePermissions';

const { TextArea } = Input;

const PostHistoryContent = ({ permissions }) => {
    const { modal, message } = App.useApp();
    const fallbackPerms = usePagePermissions('socialMedia.history');
    const { canView, canEdit, canDelete } = permissions || fallbackPerms;
    const canSeeHistory = canView || canEdit || canDelete;
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [retryingPostId, setRetryingPostId] = useState(null);

    // Edit States
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingState, setEditingState] = useState({
        id: null,
        content: '',
        scheduledAt: null,
        posts: [],           // [{_id, platform, caption, account: {accountName}}]
        postCaptions: {}     // { [postId]: 'caption' } — per-account overrides
    });
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        if (!canSeeHistory) return undefined;
        loadHistory();

        // Listen for refresh events from other components
        window.refreshSocialHistory = loadHistory;
        return () => { delete window.refreshSocialHistory; };
    }, [canSeeHistory]);

    useEffect(() => {
        if (!canSeeHistory) return undefined;

        const hasActiveJobs = history.some((campaign) =>
            ['pending', 'publishing'].includes(campaign.status) ||
            (campaign.posts || []).some((post) => ['pending', 'publishing'].includes(post.status))
        );

        if (!hasActiveJobs) return undefined;

        const intervalId = setInterval(() => {
            loadHistory(true);
        }, 3000);

        return () => clearInterval(intervalId);
    }, [canSeeHistory, history]);

    const loadHistory = async (silent = false) => {
        if (!canSeeHistory) {
            setHistory([]);
            setLoading(false);
            return;
        }
        if (!silent) setLoading(true);
        try {
            const data = await socialApi.getHistory();
            setHistory(data);
            if (selectedCampaign?._id) {
                const nextSelected = data.find((campaign) => campaign._id === selectedCampaign._id);
                if (nextSelected) {
                    setSelectedCampaign(nextSelected);
                }
            }
        } catch {
            console.error('Failed to load history');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const getDeleteErrorMessage = (error) => {
        const data = error.response?.data;
        const results = data?.results || (data?.result ? [data.result] : []);
        const failedResults = results.filter((item) => item && item.success === false);
        if (failedResults.length > 0) {
            return failedResults
                .map((item) => {
                    const platform = item.platform ? item.platform.toUpperCase() : 'PLATFORM';
                    const firstAttempt = item.errors?.[0]?.message || item.error;
                    return `${platform}: ${firstAttempt || 'Delete failed'}`;
                })
                .join(' | ');
        }
        return data?.message || 'Failed to delete';
    };

    const handleDelete = (record) => {
        if (!canDelete) return;
        // Collect which platforms this campaign has published posts on
        const publishedPlatforms = record.posts
            ?.filter(p => ['published', 'completed'].includes(p.status))
            .map(p => p.platform)
            .filter(Boolean) || [];
        const uniquePublishedPlatforms = [...new Set(publishedPlatforms)];

        const hasPublishedPosts = uniquePublishedPlatforms.length > 0;
        const platformList = uniquePublishedPlatforms
            .map(p => p.charAt(0).toUpperCase() + p.slice(1))
            .join(', ');

        modal.confirm({
            title: 'Delete Campaign?',
            content: hasPublishedPosts
                ? `This will permanently delete posts from all connected platforms (${platformList}) AND remove all local records. This action cannot be undone.`
                : 'This will remove the campaign and its post history from the database. This action cannot be undone.',
            okText: 'Yes, Delete from All Platforms',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    const response = await socialApi.deleteCampaign(record._id);
                    message.success(response?.message || 'Campaign deleted successfully');
                    loadHistory();
                } catch (error) {
                    message.error(getDeleteErrorMessage(error));
                }
            }
        });
    };

    const handleEdit = (record) => {
        if (!canEdit) return;
        // Build per-post caption map from published + failed posts (failed posts can be retried)
        const postCaptions = {};
        const editablePosts = (record.posts || []).filter(p => ['published', 'completed', 'failed'].includes(p.status));
        editablePosts.forEach(p => {
            postCaptions[p._id] = p.caption || record.content || '';
        });

        setEditingState({
            id: record._id,
            content: record.content,
            scheduledAt: record.scheduledAt ? dayjs(record.scheduledAt) : null,
            posts: editablePosts,
            postCaptions
        });
        setEditModalVisible(true);
    };


    const saveEdit = async () => {
        if (!canEdit) return;
        // At least one caption must be non-empty
        const allCaptionsEmpty = Object.values(editingState.postCaptions).every(c => !c?.trim());
        if (allCaptionsEmpty && !editingState.content.trim()) {
            return message.error('Content cannot be empty');
        }

        setUpdating(true);
        try {
            // Build per-post updates array
            const postUpdates = editingState.posts.map(p => ({
                postId: p._id,
                caption: editingState.postCaptions[p._id] ?? editingState.content
            }));

            await socialApi.updateCampaign(editingState.id, {
                content: editingState.content,
                scheduledAt: editingState.scheduledAt ? editingState.scheduledAt.toISOString() : null,
                postUpdates   // Per-post caption overrides
            });
            message.success('Campaign update sent! Platform sync is running in background.');
            setEditModalVisible(false);
            setTimeout(loadHistory, 1500); // Small delay to let background sync start
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to update campaign');
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteSinglePost = (post) => {
        if (!canDelete) return;
        modal.confirm({
            title: `Delete ${post.platform.toUpperCase()} Post?`,
            content: post.platform === 'linkedin'
                ? "This will permanently remove the LinkedIn post."
                : `This will permanently remove the post from ${post.account?.accountName || post.platform} and from the database. Are you sure?`,
            okText: 'Yes, Delete',
            okType: 'danger',
            onOk: async () => {
                try {
                    const response = await socialApi.deletePost(post._id);
                    message.success(response?.message || 'Post deleted successfully');

                    // Update local state to remove the post from the details view
                    if (selectedCampaign && selectedCampaign.posts) {
                        setSelectedCampaign({
                            ...selectedCampaign,
                            posts: selectedCampaign.posts.filter(p => p._id !== post._id)
                        });
                    }

                    // Also refresh the main history table
                    loadHistory();
                } catch (error) {
                    message.error(getDeleteErrorMessage(error));
                }
            }
        });
    };

    const handleRetryPost = async (post) => {
        setRetryingPostId(post._id);
        try {
            const response = await socialApi.retryPost(post._id);
            message.success(response.message || 'Retry started successfully');
            await loadHistory();

            if (selectedCampaign?._id) {
                const refreshed = await socialApi.getHistory();
                const nextSelected = refreshed.find(item => item._id === selectedCampaign._id);
                if (nextSelected) {
                    setSelectedCampaign(nextSelected);
                }
            }
        } catch (error) {
            message.error(error.response?.data?.message || 'Retry failed');
        } finally {
            setRetryingPostId(null);
        }
    };

    const columns = [
        {
            title: <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</span>,
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 155,
            render: (date) => <span className="text-slate-600 text-xs">{date ? new Date(date).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
        },

        {
            title: <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Platform</span>,
            key: 'platform',
            width: 140,
            render: (_, record) => {
                const platforms = record.posts?.map(p => p.platform).filter(Boolean) || [];
                const uniquePlatforms = [...new Set(platforms)];

                if (uniquePlatforms.length === 0) return <span className="text-slate-400 text-xs">—</span>;

                const config = (pf) => {
                    if (pf === 'facebook') return { label: 'Facebook', dot: 'bg-[#1877F2]', text: 'text-[#1877F2]' };
                    if (pf === 'instagram') return { label: 'Instagram', dot: 'bg-[#E4405F]', text: 'text-[#E4405F]' };
                    if (pf === 'linkedin') return { label: 'LinkedIn', dot: 'bg-[#0A66C2]', text: 'text-[#0A66C2]' };
                    return { label: pf, dot: 'bg-slate-400', text: 'text-slate-600' };
                };

                return (
                    <div className="flex flex-wrap gap-1.5">
                        {uniquePlatforms.map((platform, idx) => {
                            const c = config(platform);
                            return (
                                <span key={idx} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 ${c.text}`}>
                                    <span className={`w-1 h-1 rounded-full shrink-0 ${c.dot}`} />
                                    {c.label}
                                </span>
                            );
                        })}
                    </div>
                );
            }
        },
        {
            title: <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Schedule</span>,
            dataIndex: 'scheduledAt',
            key: 'scheduledAt',
            width: 175,
            render: (date) => date ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200/80">
                    <Clock size={12} className="text-slate-400 shrink-0" />
                    {new Date(date).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                </span>
            ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/60">
                    <CheckCircle size={12} className="shrink-0" />
                    Immediate
                </span>
            )
        },
        {
            title: <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>,
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status) => {
                const config = {
                    draft: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Draft' },
                    pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Queued' },
                    publishing: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Publishing' },
                    processing: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Processing' },
                    published: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Published' },
                    completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Completed' },
                    failed: { bg: 'bg-rose-50', text: 'text-rose-600', label: 'Failed' },
                    scheduled: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Scheduled' },
                    cancelled: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Cancelled' },
                    deleted: { bg: 'bg-slate-100', text: 'text-slate-400', label: 'Deleted' }
                };
                const c = config[status] || { bg: 'bg-slate-100', text: 'text-slate-600', label: status };
                return (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${c.bg} ${c.text} ${status === 'scheduled' ? 'border-indigo-200/60' : status === 'completed' ? 'border-emerald-200/60' : 'border-slate-200/80'}`}>
                        {c.label}
                    </span>
                );
            }
        },
        {
            title: <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</span>,
            key: 'action',
            fixed: 'right',
            width: 100,
            align: 'center',
            render: (_, record) => (
                <div className="flex items-center justify-center gap-1.5">
                    <Tooltip title="View full campaign details">
                        <Button
                            type="text"
                            size="small"
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border-none transition-all duration-200"
                            icon={<Eye size={16} />}
                            onClick={() => {
                                setSelectedCampaign(record);
                                setDetailsModalVisible(true);
                            }}
                        />
                    </Tooltip>

                    {canEdit && record.status !== 'deleted' && (
                        <Tooltip title="Edit or modify campaign">
                            <Button 
                                type="text" 
                                size="small" 
                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 border-none transition-all duration-200" 
                                icon={<Edit size={16} />} 
                                onClick={() => handleEdit(record)} 
                            />
                        </Tooltip>
                    )}

                    {canDelete && (
                        <Tooltip title="Delete campaign permanently">
                            <Button 
                                type="text" 
                                size="small" 
                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-none transition-all duration-200" 
                                icon={<Trash2 size={16} />} 
                                onClick={() => handleDelete(record)} 
                            />
                        </Tooltip>
                    )}
                </div>
            )
        }
    ];

    if (!canSeeHistory) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                    <History size={40} className="text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-700">Access Restricted</h3>
                <p className="max-w-xs text-center mt-2 leading-relaxed">
                    You don't have permission to view social media campaign history. Please contact your administrator.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                    <History size={18} />
                </div>
                <h2 className="text-base font-semibold text-slate-800 tracking-tight">Campaign History</h2>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white [&_.ant-table]:rounded-lg">
                <Table
                    columns={columns}
                    dataSource={history}
                    loading={loading}
                    rowKey="_id"
                    size="middle"
                    className="post-history-table [&_.ant-table-thead>tr>th]:bg-slate-50 [&_.ant-table-thead>tr>th]:text-slate-600 [&_.ant-table-tbody>tr:hover>td]:bg-slate-50/80 [&_.ant-table-tbody>tr>td]:py-3 [&_.ant-table-tbody>tr>td]:align-middle"
                    pagination={false}
                    locale={{
                        emptyText: (
                            <div className="py-12 flex flex-col items-center gap-2 text-center">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                    <History size={24} />
                                </div>
                                <p className="text-slate-600 font-medium">No campaign history yet</p>
                                <p className="text-slate-400 text-sm">Queued, scheduled, and completed posts will appear here.</p>
                            </div>
                        )
                    }}
                />
            </div>

            {/* Details Modal */}
            <Modal
                title={<div className="flex items-center gap-2 text-slate-800 font-black"><Layers size={20} className="text-indigo-600" /> CAMPAIGN DETAILS</div>}
                open={detailsModalVisible}
                onCancel={() => { setDetailsModalVisible(false); setSelectedCampaign(null); }}
                footer={null}
                width={700}
                className="rounded-2xl overflow-hidden"
                styles={{ body: { padding: '0px' } }}
            >
                {selectedCampaign && (
                    <div className="pb-8">
                        {/* Header Summary */}
                        <div className="bg-slate-50 p-6 border-b border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Campaign ID</p>
                                    <h4 className="text-xs font-mono text-slate-600">#{selectedCampaign._id}</h4>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                    <Badge status={selectedCampaign.status === 'completed' ? 'success' : selectedCampaign.status === 'failed' ? 'error' : 'processing'} text={selectedCampaign.status === 'pending' ? 'QUEUED' : selectedCampaign.status.toUpperCase()} className="font-bold text-slate-700" />
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                {selectedCampaign.media?.length > 0 && (
                                    <div className="flex gap-2 flex-wrap mb-3">
                                        {selectedCampaign.media.map((m, i) => (
                                            <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                                                {m.type === 'image' ? (
                                                    <img src={m.url} className="w-full h-full object-cover" alt="campaign" />
                                                ) : (
                                                    <div 
                                                        className="w-full h-full relative cursor-pointer group"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            window.open(m.url, '_blank');
                                                        }}
                                                    >
                                                        <video 
                                                            src={m.url} 
                                                            className="w-full h-full object-cover" 
                                                            muted 
                                                            playsInline
                                                            onMouseOver={(e) => e.target.play()}
                                                            onMouseOut={(e) => { e.target.pause(); e.target.currentTime = 0; }}
                                                        />
                                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Play size={20} className="text-white drop-shadow-md" fill="white" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {selectedCampaign.posts?.[0]?.musicId && (
                                    <div className="mb-3 bg-slate-900 border border-slate-700 px-3 py-2 rounded-[14px] flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-md bg-slate-800 overflow-hidden relative border border-slate-600">
                                            {selectedCampaign.posts[0].musicId.thumbnail ? (
                                                <img src={selectedCampaign.posts[0].musicId.thumbnail} className="w-full h-full object-cover" alt="album art" />
                                            ) : (
                                                <MusicIcon size={16} className="text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-white line-clamp-1 truncate">{selectedCampaign.posts[0].musicId.title}</p>
                                            <p className="text-[10px] text-slate-400 line-clamp-1 truncate">{selectedCampaign.posts[0].musicId.artist}</p>
                                        </div>
                                        <audio controls src={selectedCampaign.posts[0].musicId.audioUrl} className="h-8 w-40 outline-none" controlsList="nodownload noplaybackrate" />
                                    </div>
                                )}

                                {selectedCampaign.content && (
                                    <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                        {selectedCampaign.content}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Post Items */}
                        <div className="p-6">
                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Platform Deliveries</h5>
                            <div className="space-y-3">
                                {selectedCampaign.posts?.map(post => (
                                    <div key={post._id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors bg-white shadow-sm">
                                        <div className="flex items-start gap-3">
                                            <Avatar
                                                shape="square"
                                                className={`${post.platform === 'linkedin' ? 'bg-blue-500' : post.platform === 'facebook' ? 'bg-indigo-500' : 'bg-pink-500'} font-bold`}
                                            >
                                                {post.platform[0]?.toUpperCase()}
                                            </Avatar>
                                            <div className="min-w-0 max-w-[360px]">
                                                <p className="text-sm font-bold text-slate-700 truncate">{post.account?.accountName || 'Unknown Account'}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{post.platform}</p>
                                                {(post.error_message || post.error) && (
                                                    <Alert
                                                        className="mt-2"
                                                        type={post.status === 'pending' ? 'info' : 'error'}
                                                        showIcon
                                                        message={post.status === 'pending' ? 'Instagram publish is queued in background.' : (post.error_message || post.error)}
                                                        description={post.error_details ? (
                                                            <div className="space-y-2">
                                                                {post.nextRetryAt && (
                                                                    <div className="text-[11px] font-semibold text-sky-700">
                                                                        Next background retry: {new Date(post.nextRetryAt).toLocaleString()}
                                                                    </div>
                                                                )}
                                                                <pre className="text-[10px] whitespace-pre-wrap break-words m-0">
                                                                    {JSON.stringify(post.error_details, null, 2)}
                                                                </pre>
                                                            </div>
                                                        ) : null}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <Tag
                                                    color={
                                                        post.status === 'published'
                                                            || post.status === 'completed'
                                                            ? 'success'
                                                            : post.status === 'failed'
                                                                ? 'error'
                                                                : post.status === 'pending'
                                                                    ? 'warning'
                                                                    : 'processing'
                                                    }
                                                    className="m-0 font-bold border-none text-[10px] rounded-full px-3"
                                                >
                                                    {post.status === 'pending' ? 'QUEUED' : post.status.toUpperCase()}
                                                </Tag>
                                                {post.platformPostId && <p className="text-[10px] text-slate-300 mt-1 font-mono">Ref: {post.platformPostId.substring(0, 10)}...</p>}
                                            </div>

                                            {post.status === 'failed' && (
                                                <Tooltip title="Retry publishing">
                                                    <Button
                                                        type="default"
                                                        icon={<RefreshCcw size={14} />}
                                                        onClick={() => handleRetryPost(post)}
                                                        loading={retryingPostId === post._id}
                                                        size="small"
                                                        className="rounded-lg border-slate-200 text-slate-700"
                                                    >
                                                        Retry
                                                    </Button>
                                                </Tooltip>
                                            )}

                                            {/* Action for single post — only shown if user has delete access */}
                                            {canDelete && (
                                                <Tooltip title="Delete this post only">
                                                    <Button
                                                        type="text"
                                                        danger
                                                        icon={<Trash2 size={14} />}
                                                        onClick={() => handleDeleteSinglePost(post)}
                                                        size="small"
                                                        className="hover:bg-red-50 flex items-center justify-center p-1"
                                                    />
                                                </Tooltip>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                title={<div className="flex items-center gap-2 text-slate-800 font-black"><Edit size={20} className="text-amber-600" /> EDIT CAMPAIGN</div>}
                open={editModalVisible}
                onCancel={() => setEditModalVisible(false)}
                onOk={saveEdit}
                confirmLoading={updating}
                okText="Save Changes"
                okButtonProps={{ className: 'bg-indigo-600 hover:bg-indigo-700 font-bold rounded-lg border-none shadow-md' }}
                cancelButtonProps={{ className: 'rounded-lg border-slate-200 font-bold text-slate-500 hover:text-indigo-600' }}
                width={580}
                className="rounded-2xl overflow-hidden"
            >
                <div className="space-y-4 py-4">

                    {/* Global default caption */}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Default Caption (applies to all accounts)</label>
                        <TextArea
                            value={editingState.content}
                            onChange={e => setEditingState({ ...editingState, content: e.target.value })}
                            rows={3}
                            className="rounded-xl border-slate-200 focus:border-indigo-500 transition-all font-medium text-slate-700"
                            placeholder="Default caption for all platforms..."
                        />
                    </div>

                    {/* Per-account caption overrides */}
                    {editingState.posts && editingState.posts.length > 0 && (
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Per-Account Caption Override</label>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                {editingState.posts.map(post => {
                                    const isInstagram = post.platform === 'instagram';
                                    const isLinkedIn = post.platform === 'linkedin';
                                    const platformColor = isInstagram ? 'bg-pink-500' : isLinkedIn ? 'bg-blue-600' : 'bg-indigo-600';

                                    return (
                                        <div key={post._id} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Avatar
                                                    size="small"
                                                    shape="square"
                                                    className={`${platformColor} text-white font-bold text-xs border-none`}
                                                >
                                                    {post.platform[0]?.toUpperCase()}
                                                </Avatar>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {post.account?.accountName || post.platform}
                                                </span>
                                                {post.status === 'failed' && (
                                                    <Tag color="error" className="ml-auto text-[10px] rounded-full border-none font-bold">
                                                        ⚠ Will Retry
                                                    </Tag>
                                                )}
                                                {post.status !== 'failed' && isInstagram && (
                                                    <Tag color="warning" className="ml-auto text-[10px] rounded-full border-none font-bold">
                                                        ⚠ Will Delete &amp; Repost
                                                    </Tag>
                                                )}
                                                {post.status !== 'failed' && isLinkedIn && (
                                                    <Tag color="processing" className="ml-auto text-[10px] rounded-full border-none font-bold">
                                                        Native Update
                                                    </Tag>
                                                )}
                                                {post.status !== 'failed' && !isInstagram && !isLinkedIn && (
                                                    <Tag color="success" className="ml-auto text-[10px] rounded-full border-none font-bold">
                                                        In-Place Update
                                                    </Tag>
                                                )}
                                            </div>
                                            <TextArea
                                                rows={2}
                                                value={editingState.postCaptions[post._id] ?? editingState.content}
                                                onChange={e => setEditingState(prev => ({
                                                    ...prev,
                                                    postCaptions: { ...prev.postCaptions, [post._id]: e.target.value }
                                                }))}
                                                className="text-xs rounded-lg border-slate-200 focus:border-indigo-400"
                                                placeholder={`Caption for ${post.platform}...`}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Schedule field */}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Schedule Time</label>
                        <DatePicker
                            showTime
                            value={editingState.scheduledAt}
                            onChange={val => setEditingState({ ...editingState, scheduledAt: val })}
                            className="w-full rounded-xl border-slate-200 h-11 focus:border-indigo-500 transition-all"
                            placeholder="Immediate (Leave empty)"
                        />
                        <p className="mt-2 text-[10px] text-slate-400 font-medium bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200">
                            <Clock size={10} className="inline mr-1" /> Only scheduled posts can have their time changed effectively.
                        </p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const PostHistory = ({ permissions }) => (
    <App>
        <PostHistoryContent permissions={permissions} />
    </App>
);

export default PostHistory;
