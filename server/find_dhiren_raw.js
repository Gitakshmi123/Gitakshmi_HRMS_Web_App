const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const findAnyEmployee = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const Tenant = mongoose.model('Tenant', new mongoose.Schema({ code: String }, { collection: 'companies' }));
        const tenants = await Tenant.find({});
        
        for (const tenant of tenants) {
            const dbName = `company_${tenant._id}`;
            const db = mongoose.connection.useDb(dbName);
            const count = await db.db.collection('employees').countDocuments({});
            console.log(`${dbName} has ${count} employees in 'employees' collection`);
            
            if (count > 0) {
                const emps = await db.db.collection('employees').find({}).limit(5).toArray();
                console.log(`Sample employees in ${dbName}:`);
                console.log(JSON.stringify(emps, null, 2));
                
                const dhiren = await db.db.collection('employees').findOne({ $or: [ { firstName: /Dhiren/i }, { lastName: /Makwana/i } ] });
                if (dhiren) {
                    console.log(`FOUND DHIREN in ${dbName}:`);
                    console.log(JSON.stringify(dhiren, null, 2));
                }
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

findAnyEmployee();
