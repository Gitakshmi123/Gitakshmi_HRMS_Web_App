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

        const employeeSchema = new mongoose.Schema({ firstName: String, lastName: String, profilePic: String }, { strict: false });

        for (const tenant of tenants) {
            const dbName = `company_${tenant._id}`;
            const db = mongoose.connection.useDb(dbName);
            const Employee = db.model('Employee', employeeSchema);
            
            const emps = await Employee.find({ $or: [ { firstName: /Dhiren/i }, { lastName: /Makwana/i } ] });
            if (emps.length > 0) {
                console.log(`Found in ${dbName}:`);
                console.log(JSON.stringify(emps, null, 2));
            } else {
                const count = await Employee.countDocuments({});
                console.log(`${dbName} has ${count} employees`);
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

findEmployee();
