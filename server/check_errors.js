const mongoose = require('mongoose');
require('dotenv').config();

async function checkErrors() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tenantId = '698b2b52eaaf4b1b30688ff4';
        const db = mongoose.connection.useDb(`company_${tenantId}`);

        const PayrollRun = db.model('PayrollRun', new mongoose.Schema({}, { strict: false }));
        const runs = await PayrollRun.find({});

        runs.forEach(r => {
            console.log(`\nMonth: ${r.month}, Year: ${r.year}`);
            console.log(` - Execution Errors:`, r.executionErrors?.length || 0);
            if (r.executionErrors && r.executionErrors.length > 0) {
                console.log(` - First Error:`, r.executionErrors[0].message);
            }
            // Check for illegal 'errors' property I might have added
            console.log(` - Illegal Errors Property:`, r.errors?.length || 'NONE');
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkErrors();
