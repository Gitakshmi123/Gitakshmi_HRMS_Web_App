// Quick fix to add rules to the empty Leave Policy
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';

async function fixPolicy() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db('hrms');
        const tenantId = '696b2e33265b093e28c2419b';
        const policyId = '696b38b95eb3b7ddc4dc41e0';

        // Update the policy to add rules
        const result = await db.collection('leavepolicies').updateOne(
            { _id: new ObjectId(policyId), tenant: tenantId },
            {
                $set: {
                    rules: [
                        { leaveType: 'CL', totalPerYear: 15, color: '#3b82f6' },
                        { leaveType: 'SL', totalPerYear: 10, color: '#f59e0b' },
                        { leaveType: 'EL', totalPerYear: 8, color: '#8b5cf6' }
                    ]
                }
            }
        );

        if (result.modifiedCount > 0) {
            console.log('✅ Policy updated successfully with rules');
            const updated = await db.collection('leavepolicies').findOne({
                _id: new ObjectId(policyId)
            });
            console.log('Updated policy:', JSON.stringify(updated, null, 2));
        } else {
            console.log('❌ Policy not found or not modified');
        }

        await client.close();
        console.log('✅ Done');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixPolicy();
