const mongoose = require('mongoose');
require('dotenv').config();

async function checkApplicants() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gt_hrms_core');
        const Tenant = require('./models/Tenant');
        
        const tenantCode = 'dha001';
        const t = await Tenant.findOne({ code: tenantCode });
        if (!t) {
            console.log(`❌ Tenant ${tenantCode} not found`);
            return;
        }
        console.log(`✅ Tenant ${tenantCode} found: ${t._id}`);

        const getTenantDB = require('./utils/tenantDB');
        const tenantDB = await getTenantDB(t._id);
        
        // Check Applicant collection
        const Applicant = tenantDB.model("Applicant");
        const applicants = await Applicant.find({});
        console.log(`📊 Applicant collection count: ${applicants.length}`);
        if (applicants.length > 0) {
            console.log("Recent Applicants:", applicants.slice(0, 3).map(a => ({
                id: a._id,
                name: a.name,
                email: a.email,
                tenant: a.tenant,
                status: a.status
            })));
        }

        // Check Application collection (Recruitment V2)
        try {
            const Application = tenantDB.model("Application");
            const apps = await Application.find({});
            console.log(`📊 Application collection (V2) count: ${apps.length}`);
            if (apps.length > 0) {
                console.log("Recent Applications (V2):", apps.slice(0, 3).map(a => ({
                    id: a._id,
                    name: a.name,
                    email: a.email,
                    tenant: a.tenant,
                    status: a.status
                })));
            }
        } catch (e) {
            console.log("ℹ️ Application collection (V2) not found or empty.");
        }

        // Check Requirements (Jobs)
        const Requirement = tenantDB.model("Requirement");
        const jobs = await Requirement.find({});
        console.log(`📊 Requirement (Jobs) count: ${jobs.length}`);
        if (jobs.length > 0) {
            console.log("Jobs:", jobs.map(j => ({ id: j._id, title: j.jobTitle, status: j.status })));
        }

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        mongoose.disconnect();
    }
}

checkApplicants();
