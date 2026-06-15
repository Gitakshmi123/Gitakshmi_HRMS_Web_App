const cron = require('node-cron');
const SocialPost = require('../models/SocialPost');
const SocialAccount = require('../models/SocialAccount');
const { LinkedInService, FacebookService, InstagramService, TwitterService } = require('./platformServices');

// Helper to get service instance (Duplicated from controller to avoid refactoring risks)
const getService = (account) => {
    try {
        switch (account.platform) {
            case 'linkedin': return new LinkedInService(account);
            case 'facebook': return new FacebookService(account);
            case 'instagram': return new InstagramService(account);
            case 'twitter': return new TwitterService(account);
            default: return null;
        }
    } catch (error) {
        console.error(`❌ Error initializing service for ${account.platform}:`, error.message);
        return null;
    }
};

const checkScheduledPosts = async () => {
    console.log('⏰ Checking for scheduled posts...', new Date().toISOString());

    try {
        const now = new Date();
        // Find posts that are scheduled and due for publishing
        const posts = await SocialPost.find({
            status: 'scheduled',
            scheduledAt: { $lte: now },
            isDeleted: false
        });

        if (posts.length === 0) return;

        console.log(`🚀 Found ${posts.length} scheduled posts to publish.`);

        for (const post of posts) {
            console.log(`Processing post ${post._id} for tenant ${post.tenantId}...`);

            try {
                // Find connected accounts for the post's platforms
                const accounts = await SocialAccount.find({
                    tenantId: post.tenantId,
                    platform: { $in: post.platforms },
                    isConnected: true
                });

                if (accounts.length === 0) {
                    console.warn(`⚠️ No connected accounts found for post ${post._id}. Marking as failed.`);
                    post.status = 'failed';
                    post.errorLog = 'No connected accounts found at scheduled time.';
                    await post.save();
                    continue;
                }

                const platformResponses = post.platformResponses || new Map();
                let successCount = 0;
                let failCount = 0;

                for (const account of accounts) {
                    try {
                        console.log(`   Publishing to ${account.platform}...`);
                        const service = getService(account);

                        if (service) {
                            // Instagram-specific validation before publishing
                            if (account.platform === 'instagram') {
                                // Validate images are still accessible
                                const imagesToValidate = post.imageUrls || (post.imageUrl ? [post.imageUrl] : []);

                                if (imagesToValidate.length === 0) {
                                    platformResponses.set(account.platform, {
                                        success: false,
                                        error: 'Instagram requires at least one image. Text-only posts are not supported.'
                                    });
                                    failCount++;
                                    continue;
                                }

                                // Check if images are HTTPS and accessible
                                let validationFailed = false;
                                for (const imgUrl of imagesToValidate) {
                                    if (!imgUrl.startsWith('https://')) {
                                        platformResponses.set(account.platform, {
                                            success: false,
                                            error: `Instagram requires HTTPS URLs. Found: ${imgUrl.substring(0, 50)}...`
                                        });
                                        failCount++;
                                        validationFailed = true;
                                        break;
                                    }
                                }

                                if (validationFailed) continue;
                            }

                            const response = await service.createPost({
                                content: post.content,
                                imageUrl: post.imageUrl,
                                imageUrls: post.imageUrls,
                                link: post.link
                            });

                            if (response.success) {
                                platformResponses.set(account.platform, { success: true, data: response });
                                successCount++;
                                console.log(`   ✅ Published to ${account.platform}`);
                            } else {
                                platformResponses.set(account.platform, { success: false, error: response.error });
                                failCount++;
                                console.error(`   ❌ Failed to publish to ${account.platform}:`, response.error);

                                // Check for Token Expiration (Meta/LinkedIn)
                                const errorMsg = response.error?.toLowerCase() || '';
                                if (errorMsg.includes('expired') || errorMsg.includes('token') || errorMsg.includes('unauthorized') || errorMsg.includes('validating access token')) {
                                    console.warn(`   ⚠️ Likely token expiration for ${account.platform}. Marking account as expired.`);
                                    await SocialAccount.updateOne(
                                        { _id: account._id },
                                        { status: 'expired', isConnected: false }
                                    );
                                }
                            }
                        } else {
                            console.error(`   ❌ Service not available for ${account.platform}`);
                            platformResponses.set(account.platform, { success: false, error: 'Service initialization failed' });
                            failCount++;
                        }
                    } catch (publishError) {
                        console.error(`   ❌ Exception publishing to ${account.platform}:`, publishError.message);
                        platformResponses.set(account.platform, { success: false, error: publishError.message });
                        failCount++;
                    }
                }

                // Update Post Status
                post.platformResponses = platformResponses;
                post.publishedAt = new Date();

                if (successCount > 0) {
                    post.status = 'published'; // Consider published if at least one succeeds (partial_success logic can be added/refined)
                    if (failCount > 0) {
                        post.status = 'partial_success';
                        post.errorLog = `Published to ${successCount} platforms, failed on ${failCount}.`;
                    } else {
                        post.errorLog = null;
                        post.status = 'published';
                    }
                } else {
                    post.status = 'failed';
                    post.errorLog = 'Failed to publish to all selected platforms.';
                }

                post.markModified('platformResponses');
                await post.save();
                console.log(`✅ Post ${post._id} processed. Status: ${post.status}`);

            } catch (postError) {
                console.error(`❌ Critical error processing post ${post._id}:`, postError);
                post.status = 'failed';
                post.errorLog = `Critical system error: ${postError.message}`;
                await post.save();
            }
        }

    } catch (error) {
        console.error('❌ Scheduler Error:', error);
    }
};

const initScheduler = () => {
    console.log('⏳ Social Media Scheduler Initialized');
    // Run every minute
    cron.schedule('* * * * *', checkScheduledPosts);
};

module.exports = { initScheduler };
