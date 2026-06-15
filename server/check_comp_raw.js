const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
    const uri = process.env.MONGO_URI;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('test'); // Central DB
        const tenants = await db.collection('tenants').find({}).toArray();
        console.log(`Found ${tenants.length} tenants`);

        for (let t of tenants) {
            const tenantDbUri = t.dbUri;
            if (!tenantDbUri) continue;

            const tClient = new MongoClient(tenantDbUri);
            await tClient.connect();
            try {
                // Get the database name from the connection string or just use the connected one
                const tDb = tClient.db();

                const employees = await tDb.collection('employees').find({ firstName: /Iva/i }).toArray();
                if (employees.length > 0) {
                    console.log(`\n✅ Found Iva in tenant: ${t.code}`);
                    for (const emp of employees) {
                        const comp = await tDb.collection('employee_compensations').findOne({ employeeId: emp._id, status: 'ACTIVE' });
                        console.log(`Compensation for ${emp.firstName} ${emp.lastName}:`, JSON.stringify(comp, null, 2));
                    }
                }
            } finally {
                await tClient.close();
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

run();
