require('dotenv').config();
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

async function forceApprove() {
    await mongoose.connect(process.env.MONGO_URI);
    const client = mongoose.connection.client;
    const db = client.db('company_demo');
    
    // Find the calculated run
    const runs = await db.collection('payrollruns').find({ status: 'CALCULATED' }).sort({_id: -1}).limit(1).toArray();
    if (runs.length === 0) {
        console.log('No calculated runs found.');
        process.exit(0);
    }
    
    const run = runs[0];
    
    // Force approve it
    await db.collection('payrollruns').updateOne(
        { _id: run._id },
        { 
            $set: { 
                approvalStatus: 'APPROVED',
                approvalWorkflow: run.approvalWorkflow.map(step => ({
                    ...step,
                    status: 'APPROVED',
                    actedBy: new ObjectId(),
                    actedAt: new Date(),
                    comment: 'Auto-approved'
                }))
            } 
        }
    );
    
    console.log('Run has been force approved!');
    process.exit(0);
}

forceApprove().catch(console.error);
