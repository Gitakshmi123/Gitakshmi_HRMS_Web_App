const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB');
    
    // Check global Department model
    const DepartmentSchema = require('./models/Department');
    const Department = mongoose.model('Department', DepartmentSchema);
    
    const depts = await Department.find({});
    console.log('Total Departments in Global DB:', depts.length);
    depts.forEach(d => {
        console.log(`- ${d.name} (${d.code}) | Tenant: ${d.tenant} | Status: ${d.status}`);
    });
    
    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
