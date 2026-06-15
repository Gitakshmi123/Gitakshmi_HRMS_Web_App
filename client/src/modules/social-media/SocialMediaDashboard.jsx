import React, { useState, useEffect } from 'react';
import { Modal } from 'antd';
import { notification } from '../../utils/antdGlobal';
import api, { API_ROOT } from '../../utils/api';
import { FaLinkedin, FaFacebook, FaInstagram, FaTwitter, FaCheckCircle, FaSpinner } from 'react-icons/fa';

const SocialMediaDashboard = () => {
    const [accounts, setAccounts] = useState([]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('accounts');
    const [connectingPlatform, setConnectingPlatform] = useState(null);
    const [editingPost, setEditingPost] = useState(null);
    const [newPost, setNewPost] = useState({
        content: '',
        link: '',
        platforms: [],
        scheduledAt: ''
    });

    // Publish loading state
    const [isPublishing, setIsPublishing] = useState(false);

    // Multiple image upload state
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [imageError, setImageError] = useState('');

    const platformConfig = {
        linkedin: {
            name: 'LinkedIn',
            icon: FaLinkedin,
            color: 'bg-[#0A66C2]',
            hoverColor: 'hover:bg-[#004182]',
            textColor: 'text-[#0A66C2]',
            borderColor: 'border-[#0A66C2]',
            lightBg: 'bg-[#0A66C2]/10'
        },
        facebook: {
            name: 'Facebook',
            icon: FaFacebook,
            color: 'bg-[#1877F2]',
            hoverColor: 'hover:bg-[#0C63D4]',
            textColor: 'text-[#1877F2]',
            borderColor: 'border-[#1877F2]',
            lightBg: 'bg-[#1877F2]/10'
        },
        instagram: {
            name: 'Instagram',
            icon: FaInstagram,
            color: 'bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737]',
            hoverColor: 'hover:opacity-90',
            textColor: 'text-[#E4405F]',
            borderColor: 'border-[#E4405F]',
            lightBg: 'bg-[#E4405F]/10'
        },
        // twitter: {
        //     name: 'Twitter',
        //     icon: FaTwitter,
        //     color: 'bg-[#1DA1F2]',
        //     hoverColor: 'hover:bg-[#0C85D0]',
        //     textColor: 'text-[#1DA1F2]',
        //     borderColor: 'border-[#1DA1F2]',
        //     lightBg: 'bg-[#1DA1F2]/10'
        // }
    };

    useEffect(() => {
        loadData();

        // Check for OAuth callback success/error
        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get('success');
        const error = urlParams.get('error');
        const platform = urlParams.get('platform');

        if (success && platform) {
            // Show success notification
            console.log(`Successfully connected to ${platform}`);
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        } else if (error) {
            console.error('OAuth error:', error);
            alert(`Connection failed: ${error}`);
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    // POLLING: Check for status updates if any post is 'publishing'
    useEffect(() => {
        const hasPublishingPosts = posts.some(p => p.status === 'publishing');

        let intervalId;
        if (hasPublishingPosts) {
            console.log('🔄 Polling for status updates...');
            intervalId = setInterval(() => {
                loadData(true); // pass true to indicate silent reload (optional, to avoid full spinner)
            }, 5000); // Check every 5 seconds
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [posts]);

    const loadData = async (silent = false) => {
        try {
            if (!silent) setLoading(true);

            // Call APIs with error handling
            const [accountsRes, postsRes] = await Promise.allSettled([
                api.get('/social-media-enterprise/accounts'),
                api.get('/social-media-enterprise/posts')
            ]);

            // Handle accounts response
            if (accountsRes.status === 'fulfilled' && accountsRes.value?.data) {
                setAccounts(Array.isArray(accountsRes.value.data) ? accountsRes.value.data : []);
            } else {
                setAccounts([]);
                if (accountsRes.status === 'rejected') {
                    console.warn('Social media accounts unavailable:', accountsRes.reason?.response?.status);
                }
            }

            // Handle posts response
            if (postsRes.status === 'fulfilled' && postsRes.value?.data) {
                setPosts(Array.isArray(postsRes.value.data) ? postsRes.value.data : []);
            } else {
                setPosts([]);
                if (postsRes.status === 'rejected') {
                    console.warn('Social media posts unavailable:', postsRes.reason?.response?.status);
                }
            }
        } catch (error) {
            // Fallback - should not reach here with Promise.allSettled
            console.warn('Social media data load failed:', error.message);
            setAccounts([]);
            setPosts([]);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleConnect = (platform) => {
        setConnectingPlatform(platform);

        const backendUrl = API_ROOT;
        let tenantId = '';
        let userId = '';

        api.get('/auth/me').then((res) => {
            tenantId = res.data?.user?.tenantId || '';
            userId = res.data?.user?.id || '';

            if (!tenantId) {
                alert('Error: Could not identify your Tenant ID. Please try logging out and logging back in.');
                return;
            }

            const params = new URLSearchParams();
            params.append('tenantId', tenantId);
            if (userId) params.append('userId', userId);

            const queryString = params.toString();
            const oauthUrl = `${backendUrl}/api/social-media-enterprise/${platform}/connect${queryString ? '?' + queryString : ''}`;
            window.location.href = oauthUrl;
        }).catch(() => {
            alert('Unable to initialize secure OAuth session.');
        });
    };

    const handleDisconnect = async (platform) => {
        Modal.confirm({
            title: 'Disconnect Account',
            content: `Are you sure you want to disconnect ${platform.charAt(0).toUpperCase() + platform.slice(1)}?`,
            okText: 'Yes, Disconnect',
            cancelText: 'Cancel',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await api.delete(`/social-media-enterprise/disconnect/${platform}`);

                    // Show success notification
                    notification.success({
                        message: 'Account Disconnected',
                        description: `${platform.charAt(0).toUpperCase() + platform.slice(1)} disconnected successfully`,
                        duration: 3
                    });

                    loadData();
                } catch (error) {
                    console.error('Disconnect failed:', error);

                    // Show error notification
                    notification.error({
                        message: 'Disconnect Failed',
                        description: error.response?.data?.message || 'Failed to disconnect account',
                        duration: 4
                    });
                }
            }
        });
    };

    // Handle multiple image file selection
    const handleMultipleImagesSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Validate files
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        for (const file of files) {
            if (!allowedTypes.includes(file.type)) {
                setImageError('Invalid file type. Only JPG, PNG, and WEBP images are allowed.');
                return;
            }
            if (file.size > maxSize) {
                setImageError(`File ${file.name} is too large. Max size is 5MB.`);
                return;
            }
        }

        setImageError('');
        setImageFiles(prev => [...prev, ...files]);

        // Generate previews
        const newPreviews = await Promise.all(
            files.map(file => new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            }))
        );

        setImagePreviews(prev => [...prev, ...newPreviews]);

        // Upload images
        await uploadMultipleImages(files);
    };

    // Upload multiple images to server
    const uploadMultipleImages = async (files) => {
        try {
            setUploadingImages(true);
            setImageError('');

            const formData = new FormData();
            files.forEach(file => {
                formData.append('images', file);
            });

            console.log(`📤 Uploading ${files.length} images...`);

            const response = await api.post('/social-media-enterprise/upload-images', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.success) {
                console.log('✅ Images uploaded:', response.data.imageUrls);

                // Add uploaded URLs to newPost
                setNewPost(prev => ({
                    ...prev,
                    imageUrls: [...(prev.imageUrls || []), ...response.data.imageUrls]
                }));

                notification.success({
                    message: 'Images Uploaded',
                    description: `${response.data.count} image(s) uploaded successfully!`,
                    duration: 2
                });
            }
        } catch (error) {
            console.error('❌ Image upload failed:', error);
            setImageError(error.response?.data?.message || 'Failed to upload images');

            notification.error({
                message: 'Upload Failed',
                description: error.response?.data?.message || 'Failed to upload images',
                duration: 4
            });
        } finally {
            setUploadingImages(false);
        }
    };

    // Remove image at index
    const handleRemoveImage = (index) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
        setNewPost(prev => ({
            ...prev,
            imageUrls: (prev.imageUrls || []).filter((_, i) => i !== index)
        }));
    };

    // Edit post handler
    const handleEditPost = (post) => {
        console.log('✏️ Editing post:', post._id);

        setEditingPost(post);
        setNewPost({
            content: post.content || '',
            link: post.link || '',
            platforms: post.platforms || [],
            scheduledAt: post.scheduledAt || '',
            imageUrls: post.imageUrls || (post.imageUrl ? [post.imageUrl] : [])
        });

        // Set image previews
        const images = post.imageUrls || (post.imageUrl ? [post.imageUrl] : []);
        setImagePreviews(images);

        setActiveView('create');
    };

    // Delete post handler
    const handleDeletePost = async (postId) => {
        console.log('🗑️ Delete post requested:', postId);

        Modal.confirm({
            title: 'Delete Post',
            content: 'Are you sure you want to delete this post? This action cannot be undone.',
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    console.log('🗑️ Deleting post:', postId);
                    const response = await api.delete(`/social-media-enterprise/post/${postId}`);

                    console.log('✅ Delete response:', response.data);

                    if (response.data.success && response.data.results) {
                        const { results, isFullyDeleted } = response.data;

                        // Show notifications for each platform
                        Object.entries(results).forEach(([platform, result]) => {
                            const platformName = platformConfig[platform]?.name || platform;

                            if (result.success) {
                                notification.success({
                                    message: `${platformName} Post Deleted`,
                                    description: result.message || `Successfully deleted post from ${platformName}`,
                                    duration: 3
                                });
                            } else {
                                notification.error({
                                    message: `${platformName} Deletion Failed`,
                                    description: result.message || `Failed to delete from ${platformName}`,
                                    duration: 5
                                });
                            }
                        });

                        // Optimistic update
                        if (isFullyDeleted) {
                            setPosts(prevPosts => prevPosts.filter(p => p._id !== postId));
                        } else {
                            // Partial delete: update the post in state with new data if returned, 
                            // or just wait for loadData()
                            // For now, let's just trigger loadData to be safe
                        }

                        // Refresh data to get updated platform lists or remove deleted post
                        loadData(true);
                    } else {
                        // Unexpected response format or server error
                        notification.error({
                            message: 'Delete Failed',
                            description: response.data?.message || 'Failed to delete post',
                            duration: 4
                        });
                    }
                } catch (error) {
                    console.error('❌ Failed to delete post:', error);
                    notification.error({
                        message: 'Delete Failed',
                        description: error.response?.data?.message || 'An unexpected error occurred during deletion'
                    });
                }
            }
        });
    };

    // Cancel edit handler
    const handleCancelEdit = () => {
        console.log('❌ Canceling edit');

        setEditingPost(null);
        setNewPost({
            content: '',
            link: '',
            platforms: [],
            scheduledAt: '',
            imageUrls: []
        });
        setImagePreviews([]);
        setImageFiles([]);
        setImageError('');
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();

        if (isPublishing) return; // Prevent double click

        if (!newPost.content || newPost.platforms.length === 0) {
            notification.warning({
                message: 'Validation Error',
                description: 'Please enter content and select at least one platform',
                duration: 3
            });
            return;
        }

        try {
            setIsPublishing(true); // Start loading
            let savedPost;
            if (editingPost) {
                // Update existing post
                const response = await api.put(`/social-media-enterprise/post/${editingPost._id}`, newPost);
                savedPost = response.data;

                // Optimistic update: Update in state immediately
                setPosts(prev => prev.map(p => p._id === savedPost._id ? savedPost : p));

                notification.success({
                    message: 'Post Update Scheduled',
                    description: 'Your changes are being applied in the background.',
                    duration: 3
                });
            } else {
                // Create new post
                const response = await api.post('/social-media-enterprise/post', newPost);
                savedPost = response.data;

                // Optimistic update: Add to top of state immediately
                setPosts(prev => [savedPost, ...prev]);

                notification.success({
                    message: 'Post Scheduled for Publishing',
                    description: 'Your post is being published in the background. It will be live shortly.',
                    duration: 3
                });
            }

            // Clear form and image state
            setNewPost({
                content: '',
                imageUrl: '',
                imageUrls: [],
                link: '',
                platforms: [],
                scheduledAt: ''
            });
            setImageFiles([]);
            setImagePreviews([]);
            setImageError('');
            setEditingPost(null);

            // Still verify with server, but UI is already updated
            loadData();
            setActiveView('posts');
        } catch (error) {
            console.error('Post operation failed:', error);

            notification.error({
                message: editingPost ? 'Update Failed' : 'Post Failed',
                description: error.response?.data?.message || 'Failed to create post',
                duration: 4
            });
        } finally {
            setIsPublishing(false); // Stop loading
        }
    };

    const getAccountForPlatform = (platform) => {
        return accounts.find(acc => acc.platform === platform);
    };

    const isConnected = (platform) => {
        const account = getAccountForPlatform(platform);
        return account && account.isConnected;
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center overflow-x-hidden">
                <div className="text-center px-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 mb-6">
                        <FaSpinner className="animate-spin text-3xl text-indigo-600" aria-hidden />
                    </div>
                    <p className="text-slate-600 font-medium">Loading social media data...</p>
                    <p className="text-slate-400 text-sm mt-1">Connecting to your accounts</p>
                </div>
            </div>
        );
    }

    return (
        /* UI MODERNIZATION - NO LOGIC CHANGES | Component-scoped styles only */
        <div className="min-h-screen bg-[#f8fafc] overflow-x-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 lg:py-10">
                {/* Header */}
                <div className="mb-6 sm:mb-8 md:mb-10">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Social Media Management</h1>
                            <p className="text-slate-500 text-sm sm:text-base mt-1">Connect your social accounts and manage posts from one place</p>
                        </div>
                    </div>
                </div>

                {/* Tabs - pill style, fully responsive */}
                <div className="mb-6 sm:mb-8">
                    <nav
                        className="inline-flex p-1 bg-slate-100 rounded-xl gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide w-full sm:w-auto"
                        aria-label="Social media views"
                    >
                        <button
                            onClick={() => setActiveView('accounts')}
                            className={`px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-medium whitespace-nowrap rounded-lg transition-all duration-200 ${activeView === 'accounts'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/80'
                                }`}
                        >
                            Connected Accounts
                        </button>
                        <button
                            onClick={() => setActiveView('create')}
                            className={`px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-medium whitespace-nowrap rounded-lg transition-all duration-200 ${activeView === 'create'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/80'
                                }`}
                        >
                            Create Post
                        </button>
                        <button
                            onClick={() => setActiveView('posts')}
                            className={`px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-medium whitespace-nowrap rounded-lg transition-all duration-200 ${activeView === 'posts'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/80'
                                }`}
                        >
                            Post History
                        </button>
                    </nav>
                </div>

                {/* Connected Accounts - cards grid */}
                {activeView === 'accounts' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
                        {Object.entries(platformConfig).map(([platform, config]) => {
                            const account = getAccountForPlatform(platform);
                            const connected = isConnected(platform);
                            const Icon = config.icon;

                            return (
                                <div
                                    key={platform}
                                    className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group min-h-[220px] flex flex-col min-w-0"
                                >
                                    <div className="p-5 sm:p-6 flex flex-col flex-grow">
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className={`flex-shrink-0 p-3.5 rounded-2xl ${config.lightBg} transition-all duration-300 group-hover:scale-105 group-hover:shadow-inner`}>
                                                <Icon className={`text-2xl sm:text-3xl ${config.textColor}`} aria-hidden />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-lg font-semibold text-slate-900">{config.name}</h3>
                                                {connected && account && (
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            {account.platformUserName || 'Connected'}
                                                        </span>
                                                    </div>
                                                )}
                                                {!connected && (
                                                    <span className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
                                                        Not connected
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-4">
                                            {connected ? (
                                                <div className="space-y-2">
                                                    {account?.expiresAt && (
                                                        <p className="text-xs text-slate-500">
                                                            Token expires: {new Date(account.expiresAt).toLocaleDateString()}
                                                        </p>
                                                    )}
                                                    <button
                                                        onClick={() => handleDisconnect(platform)}
                                                        className="w-full px-4 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 active:scale-[0.98] transition-all font-medium text-sm"
                                                    >
                                                        Disconnect
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleConnect(platform)}
                                                    disabled={connectingPlatform === platform}
                                                    className={`w-full px-4 py-3 ${config.color} ${config.hoverColor} text-white rounded-xl transition-all font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100 text-sm min-h-[44px]`}
                                                >
                                                    {connectingPlatform === platform ? (
                                                        <>
                                                            <FaSpinner className="animate-spin" aria-hidden />
                                                            Connecting...
                                                        </>
                                                    ) : (
                                                        `Connect ${config.name}`
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Create Post View */}
                {activeView === 'create' && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 max-w-2xl mx-auto w-full min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                                {editingPost ? 'Edit Post' : 'Create New Post'}
                            </h2>
                            {editingPost && (
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-medium transition-colors w-fit"
                                >
                                    Cancel Edit
                                </button>
                            )}
                        </div>
                        <form onSubmit={handleCreatePost} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Content</label>
                                <textarea
                                    value={newPost.content}
                                    onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all resize-none"
                                    rows="6"
                                    placeholder="What's on your mind?"
                                />
                                <div className="space-y-3 mt-4">
                                    <label className="block text-sm font-medium text-slate-700">
                                        Images {newPost.platforms.includes('instagram') && <span className="text-amber-600">(Required for Instagram)</span>}
                                    </label>

                                    {newPost.platforms.includes('instagram') && (
                                        <div className="p-4 bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200/60 rounded-xl">
                                            <div className="flex items-start gap-3">
                                                <span className="text-xl">📸</span>
                                                <div className="text-sm text-violet-900">
                                                    <p className="font-semibold mb-2">Instagram Requirements</p>
                                                    <ul className="list-disc list-inside space-y-1 text-xs text-violet-800">
                                                        <li>Images must be publicly accessible via HTTPS</li>
                                                        <li>Localhost URLs will not work</li>
                                                        <li>Supports 1–10 images (carousel)</li>
                                                        <li>For local dev, use ngrok or deploy to public server</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <label className="block cursor-pointer">
                                        <div className="px-6 py-6 sm:py-8 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-center">
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                                onChange={handleMultipleImagesSelect}
                                                className="hidden"
                                                disabled={uploadingImages}
                                            />
                                            {uploadingImages ? (
                                                <div className="flex items-center justify-center gap-2 text-indigo-600 font-medium">
                                                    <FaSpinner className="animate-spin text-lg" />
                                                    <span>Uploading...</span>
                                                </div>
                                            ) : (
                                                <div className="text-slate-600">
                                                    <span className="font-medium text-slate-700">Upload Images</span>
                                                    <p className="text-xs mt-2 text-slate-500">
                                                        JPG, PNG, WEBP (Max 5MB each)
                                                        {imagePreviews.length > 0 && <span className="text-indigo-600 font-medium"> • {imagePreviews.length} selected</span>}
                                                        {newPost.platforms.includes('instagram') && imagePreviews.length > 10 && <span className="text-amber-600"> • Max 10 for Instagram</span>}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </label>

                                    {imagePreviews.length > 0 && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {imagePreviews.map((preview, index) => (
                                                <div key={index} className="relative group aspect-square">
                                                    <img
                                                        src={preview}
                                                        alt={`Preview ${index + 1}`}
                                                        className="w-full h-full object-cover rounded-xl border border-slate-200"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveImage(index)}
                                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 font-bold text-sm shadow-lg"
                                                    >
                                                        ×
                                                    </button>
                                                    {index >= 10 && newPost.platforms.includes('instagram') && (
                                                        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                                                            <span className="text-white text-xs font-semibold">Exceeds IG limit</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {imageError && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mt-3">
                                            {imageError}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Link (optional)</label>
                                <input
                                    type="url"
                                    value={newPost.link}
                                    onChange={(e) => setNewPost({ ...newPost, link: e.target.value })}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="https://example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-3">Select Platforms</label>
                                <div className="flex flex-wrap gap-3">
                                    {Object.entries(platformConfig).map(([platform, config]) => {
                                        const connected = isConnected(platform);
                                        const Icon = config.icon;
                                        const isSelected = newPost.platforms.includes(platform);
                                        return (
                                            <label
                                                key={platform}
                                                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                    } ${!connected ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setNewPost({ ...newPost, platforms: [...newPost.platforms, platform] });
                                                        } else {
                                                            setNewPost({ ...newPost, platforms: newPost.platforms.filter(p => p !== platform) });
                                                        }
                                                    }}
                                                    disabled={!connected}
                                                    className="sr-only"
                                                />
                                                <Icon className={`text-xl ${config.textColor}`} />
                                                <span className="font-medium">{config.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Schedule (optional)
                                    {newPost.platforms.includes('instagram') && (
                                        <span className="ml-2 text-xs text-violet-600 font-medium">✓ Supported for Instagram</span>
                                    )}
                                </label>
                                <input
                                    type="datetime-local"
                                    value={newPost.scheduledAt}
                                    onChange={(e) => setNewPost({ ...newPost, scheduledAt: e.target.value })}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isPublishing}
                                className={`w-full px-6 py-3.5 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm
                                    ${isPublishing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md active:scale-[0.99]'}`}
                            >
                                {isPublishing && <FaSpinner className="animate-spin" />}
                                {editingPost ? 'Update Post' : (newPost.scheduledAt ? 'Schedule Post' : 'Publish Now')}
                            </button>
                        </form>
                    </div>
                )}

                {/* Post History View */}
                {activeView === 'posts' && (
                    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
                        {posts.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 sm:p-16 text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 mb-4">
                                    <span className="text-3xl">📝</span>
                                </div>
                                <p className="text-slate-600 font-medium text-lg">No posts yet</p>
                                <p className="text-slate-500 text-sm mt-1">Create your first post to get started</p>
                                <button
                                    type="button"
                                    onClick={() => setActiveView('create')}
                                    className="mt-6 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                                >
                                    Create Post
                                </button>
                            </div>
                        ) : (
                            posts.map((post) => (
                                <div key={post._id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {post.platforms.map(platform => {
                                                const Icon = platformConfig[platform]?.icon;
                                                return Icon ? (
                                                    <span key={platform} className={`inline-flex p-2 rounded-lg ${platformConfig[platform]?.lightBg || 'bg-slate-100'}`}>
                                                        <Icon className={`text-lg ${platformConfig[platform].textColor}`} />
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium w-fit ${post.status === 'published' ? 'bg-emerald-50 text-emerald-700' :
                                            post.status === 'partial_success' ? 'bg-amber-50 text-amber-700' :
                                                post.status === 'partially_deleted' ? 'bg-orange-50 text-orange-700' :
                                                    post.status === 'publishing' ? 'bg-indigo-50 text-indigo-700' :
                                                        post.status === 'edited' ? 'bg-orange-50 text-orange-700' :
                                                            post.status === 'deleted' ? 'bg-slate-100 text-slate-600' :
                                                                post.status === 'scheduled' ? 'bg-violet-50 text-violet-700' :
                                                                    post.status === 'failed' ? 'bg-red-50 text-red-700' :
                                                                        'bg-slate-100 text-slate-600'
                                            }`}>
                                            {post.status === 'published' && '✓'}
                                            {post.status === 'partial_success' && '⚠'}
                                            {post.status === 'partially_deleted' && '⏳'}
                                            {post.status === 'publishing' && <FaSpinner className="animate-spin" />}
                                            {post.status === 'edited' && '✎'}
                                            {post.status === 'deleted' && '—'}
                                            {post.status === 'scheduled' && '📅'}
                                            {post.status === 'failed' && '✕'}
                                            {post.status ? (post.status.replace('_', ' ').charAt(0).toUpperCase() + post.status.replace('_', ' ').slice(1)) : 'Unknown'}
                                        </span>
                                    </div>
                                    <p className="text-slate-800 text-[15px] leading-relaxed mb-4">{post.content}</p>

                                    {(post.imageUrls && post.imageUrls.length > 0) ? (
                                        <div className="mb-4">
                                            {post.imageUrls.length > 1 ? (
                                                <div>
                                                    <span className="inline-block text-xs font-semibold text-violet-600 bg-violet-100 px-2.5 py-1 rounded-lg mb-3">
                                                        Carousel ({post.imageUrls.length} images)
                                                    </span>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {post.imageUrls.slice(0, 6).map((imgUrl, idx) => (
                                                            <img key={idx} src={imgUrl} alt={`Image ${idx + 1}`} className="rounded-xl h-24 w-full object-cover" />
                                                        ))}
                                                        {post.imageUrls.length > 6 && (
                                                            <div className="rounded-xl h-24 w-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm">
                                                                +{post.imageUrls.length - 6} more
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <img src={post.imageUrls[0]} alt="Post" className="rounded-xl max-h-64 w-full object-cover" />
                                            )}
                                        </div>
                                    ) : post.imageUrl ? (
                                        <img src={post.imageUrl} alt="Post" className="rounded-xl mb-4 max-h-64 w-full object-cover" />
                                    ) : (post.link && (post.link.match(/\.(jpeg|jpg|gif|png|webp|avif)$/) || post.link.includes('images.unsplash.com'))) ? (
                                        <img src={post.link} alt="Post" className="rounded-xl mb-4 max-h-64 w-full object-cover" />
                                    ) : null}

                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-slate-100">
                                        <div className="text-sm text-slate-500">
                                            {post.status === 'edited' && post.editedAt ? (
                                                <>
                                                    <span>Edited: {new Date(post.editedAt).toLocaleString()}</span>
                                                    <span className="text-xs text-slate-400 ml-2">(Originally: {new Date(post.createdAt).toLocaleString()})</span>
                                                </>
                                            ) : post.scheduledAt ? (
                                                `Scheduled: ${new Date(post.scheduledAt).toLocaleString()}`
                                            ) : (
                                                `Posted: ${new Date(post.createdAt).toLocaleString()}`
                                            )}
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            {post.platforms.includes('instagram') && post.status === 'published' ? (
                                                <div className="relative group">
                                                    <button
                                                        disabled
                                                        className="px-4 py-2 bg-slate-200 text-slate-500 rounded-xl cursor-not-allowed text-sm font-medium"
                                                    >
                                                        Edit
                                                    </button>
                                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-10 shadow-lg">
                                                        Instagram posts cannot be edited (API limitation). Use Delete + Repost instead.
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleEditPost(post)}
                                                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium active:scale-[0.98]"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDeletePost(post._id)}
                                                className="px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors text-sm font-medium active:scale-[0.98]"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div >
    );
};

export default SocialMediaDashboard;
