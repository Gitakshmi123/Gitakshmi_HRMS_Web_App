const mongoose = require('mongoose');
const axios = require('axios');
const { decrypt } = require('./modules/social-media-enterprise/utils/tokenEncryption');

async function checkDB() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
        const Tenant = mongoose.model('Tenant', require('./models/Tenant'));
        const tenants = await Tenant.find({ status: 'active' });

        for (const t of tenants) {
            console.log(`\n--- Checking tenant: ${t.code} (${t._id}) ---`);
            const tDb = mongoose.connection.useDb(`tenant_${t._id.toString()}`);
            const SocialPost = tDb.model('SocialPost', require('./models/social/SocialPost'));

            const posts = await SocialPost.find({ platform: 'facebook', platformPostId: { $ne: null } })
                .populate('account')
                .sort({ createdAt: -1 })
                .limit(2);

            console.log(`Found ${posts.length} Facebook posts`);

            for (const post of posts) {
                console.log(`\nPost ID: ${post._id}`);
                console.log(`Platform Post ID: ${post.platformPostId}`);
                console.log(`Likes in DB: ${post.likes}, Comments in DB: ${post.comments}`);

                if (post.account && post.account.accessToken) {
                    const token = decrypt(post.account.accessToken);
                    console.log(`Testing Graph API for Post ID: ${post.platformPostId}`);
                    try {
                        const url = `https://graph.facebook.com/v19.0/${post.platformPostId}`;
                        const basic = await axios.get(url, {
                            params: { fields: 'likes.summary(true),reactions.summary(true),comments.summary(true),shares', access_token: token }
                        });
                        console.log("Graph API Response Check:\n", JSON.stringify(basic.data, null, 2));
                    } catch (apiErr) {
                        console.error("Graph API Error:", apiErr?.response?.data || apiErr.message);
                    }
                }
            }
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        mongoose.disconnect();
    }
}

checkDB();
