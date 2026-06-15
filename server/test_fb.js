const axios = require('axios');
const mongoose = require('mongoose');
const crypto = require('crypto');

const ENCRYPTION_KEY = 'social-media-isolated-key-32-chars-minimum-length-required';
function decrypt(text) {
    if (!text || !text.includes(':')) return null;
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

async function run() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0');
        console.log("Connected to MongoDB hrms.");

        const Tenant = mongoose.model('Tenant', new mongoose.Schema({ status: String, code: String }), 'tenants');
        const tenants = await Tenant.find({ status: 'active' });

        let foundAny = false;

        for (const t of tenants) {
            const dbTitle = `company_${t._id.toString()}`;
            const db = mongoose.connection.useDb(dbTitle);

            const accountSchema = new mongoose.Schema({ accessToken: String, platform: String });
            const postSchema = new mongoose.Schema({ platformPostId: String, account: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialAccount' }, platform: String, likes: Number, comments: Number });

            const SocialAccount = db.model('SocialAccount', accountSchema, 'socialaccounts');
            const SocialPost = db.model('SocialPost', postSchema, 'socialposts');

            const posts = await SocialPost.find({ platformPostId: { $ne: null } }).populate('account').sort({ createdAt: -1 }).limit(10);

            if (posts.length > 0) {
                foundAny = true;
                console.log(`\n--- Tenant: ${t.code || t._id} --- found ${posts.length} posts`);
                for (const post of posts) {
                    console.log(`\nPlatform: ${post.platform}, PlatformPostId: ${post.platformPostId}`);
                    console.log(`DB Likes: ${post.likes}, DB Comments: ${post.comments}`);
                    if (post.platform === 'facebook' && post.account && post.account.accessToken) {
                        try {
                            const token = decrypt(post.account.accessToken);
                            const url = `https://graph.facebook.com/v19.0/${post.platformPostId}`;
                            const basic = await axios.get(url, {
                                params: { fields: 'reactions.summary(true),comments.summary(true),shares', access_token: token }
                            });
                            console.log(`Graph API Likes: ${basic.data.reactions?.summary?.total_count || 0}`);
                            console.log(`Graph API Comments: ${basic.data.comments?.summary?.total_count || 0}`);
                        } catch (apiErr) {
                            console.error("API Error Response:", apiErr.response?.data?.error || apiErr.message);
                        }
                    }
                }
            }
        }

        if (!foundAny) console.log("No social posts with platformPostId found in any tenant.");

    } catch (e) {
        console.error("Main Error", e);
    } finally {
        mongoose.disconnect();
    }
}
run();
