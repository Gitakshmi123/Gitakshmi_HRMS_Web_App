require('dotenv').config();
const mongoose = require('mongoose');

async function fixRuns() {
    await mongoose.connect(process.env.MONGO_URI);
    const client = mongoose.connection.client;
    
    // We only need to fix company_demo for this test
    const db = client.db('company_demo');
    
    // Delete all payslips for June 2026
    const result1 = await db.collection('payslips').deleteMany({ month: 6, year: 2026 });
    console.log(`Deleted ${result1.deletedCount} payslips.`);
    
    // Delete all payroll runs for June 2026
    const result2 = await db.collection('payrollruns').deleteMany({ month: 6, year: 2026 });
    console.log(`Deleted ${result2.deletedCount} payroll runs.`);
    
    console.log('Done!');
    process.exit(0);
}

fixRuns().catch(console.error);
