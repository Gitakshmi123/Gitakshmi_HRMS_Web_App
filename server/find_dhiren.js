const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const findEmployee = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // We need to find which tenant this employee belongs to.
        // Since we don't know, we might have to search all tenant DBs or the main DB if they are there.
        // Wait, the main app.js registers Employee model on the main connection too? 
        // No, usually it's per tenant.
        
        const Tenant = mongoose.model('Tenant', new mongoose.Schema({ code: String }));
        const tenants = await Tenant.find({});
        
        for (const tenant of tenants) {
            const tenantDbUri = process.env.MONGO_URI.replace(/\/[^/?]+\?/, `/${tenant._id}?`);
            const conn = await mongoose.createConnection(tenantDbUri).asPromise();
            const Employee = conn.model('Employee', new mongoose.Schema({ firstName: String, lastName: String, profilePic: String }));
            
            const emp = await Employee.findOne({ firstName: /Dhiren/i });
            if (emp) {
                console.log(`Found employee in tenant ${tenant.code}:`);
                console.log(JSON.stringify(emp, null, 2));
            }
            await conn.close();
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

findEmployee();
