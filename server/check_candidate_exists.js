const mongoose = require('mongoose');
require('dotenv').config();

async function checkCandidate() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gt_hrms_core');
        const Tenant = require('./models/Tenant');
        
        const tenantCode = 'dha001';
        const email = 'rushik.joshi.gt@gmail.com'; // assuming this from common user patterns or previous context

        const t = await Tenant.findOne({ code: tenantCode });
        if (!t) {
            console.log(`❌ Tenant ${tenantCode} not found`);
            return;
        }
        console.log(`✅ Tenant ${tenantCode} found: ${t._id}`);

        const getTenantDB = require('./utils/tenantDB');
        const tenantDB = await getTenantDB(t._id);
        const Candidate = tenantDB.model("Candidate");

        const cand = await Candidate.findOne({ email });
        if (cand) {
            console.log(`✅ Candidate ${email} found in ${tenantCode}`);
            console.log(`   ID: ${cand._id}`);
            console.log(`   Has Password: ${!!cand.password}`);
        } else {
            console.log(`❌ Candidate ${email} NOT found in ${tenantCode}`);
            const all = await Candidate.find({}).limit(5).select('email');
            console.log("Other candidates in this tenant:", all.map(a => a.email));
        }

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        mongoose.disconnect();
    }
}

checkCandidate();
