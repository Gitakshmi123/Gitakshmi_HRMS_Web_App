const mongoose = require('mongoose');

async function checkGlobalPolicy() {
    const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';
    try {
        await mongoose.connect(MONGO_URI);
        const LeavePolicy = mongoose.connection.model('LeavePolicy', new mongoose.Schema({}, { strict: false }));
        
        const policies = await LeavePolicy.find({}).lean();
        console.log('Total Global Policies:', policies.length);
        policies.forEach(p => {
            console.log(`- ${p.name} (${p._id}) | Tenant: ${p.tenant} | ApplicableTo: ${p.applicableTo}`);
        });

        const targetPolicyId = '69f98bfaff862ea20935c29f';
        const target = await LeavePolicy.findById(targetPolicyId).lean();
        console.log('\nTarget Policy lookup:', target ? 'FOUND' : 'NOT FOUND');

        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkGlobalPolicy();
