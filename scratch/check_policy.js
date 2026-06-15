const mongoose = require('mongoose');

async function checkPolicy() {
    const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('company_iconic_ico001_4a742237');
        const LeavePolicy = db.model('LeavePolicy', new mongoose.Schema({}, { strict: false }));
        
        const policies = await LeavePolicy.find({}).lean();
        console.log('Available Policies:');
        policies.forEach(p => {
            console.log(`- ${p.name} (${p._id}) | ApplicableTo: ${p.applicableTo} | Status: ${p.status}`);
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

checkPolicy();
