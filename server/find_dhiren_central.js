const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const findEmployee = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const Tenant = mongoose.model('Tenant', new mongoose.Schema({ code: String }, { collection: 'companies' }));
        const tenants = await Tenant.find({});
        console.log(`Found ${tenants.length} tenants`);

        const centralEmployeeSchema = new mongoose.Schema({ firstName: String, lastName: String, profilePic: String }, { strict: false });
        const CentralEmployee = mongoose.model('Employee', centralEmployeeSchema);
        
        const centralEmps = await CentralEmployee.find({ firstName: /Dhiren/i });
        if (centralEmps.length > 0) {
            console.log('Found in central DB:');
            console.log(JSON.stringify(centralEmps, null, 2));
        }

        for (const tenant of tenants) {
            const tenantDbUri = process.env.MONGO_URI.replace(/\/[^/?]+\?/, `/${tenant._id}?`);
            // Wait, maybe the tenant DB name is just the tenant ID or something else.
            // Let's try to list all databases first if possible.
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

findEmployee();
