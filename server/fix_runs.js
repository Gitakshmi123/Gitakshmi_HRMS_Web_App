require('dotenv').config();
const mongoose = require('mongoose');

async function fixRuns() {
    await mongoose.connect(process.env.MONGO_URI);
    const client = mongoose.connection.client;
    const db = client.db('company_demo');
    
    console.log('Cleaning up duplicate runs for June 2026...');
    
    // Delete any payslips for June 2026 that are DRAFT
    const result1 = await db.collection('payslips').deleteMany({ month: 6, year: 2026, status: 'DRAFT' });
    console.log(`Deleted ${result1.deletedCount} DRAFT payslips.`);
    
    // Delete any payroll runs for June 2026 that are INITIATED or CALCULATED
    const result2 = await db.collection('payrollruns').deleteMany({ month: 6, year: 2026, status: { $in: ['INITIATED', 'CALCULATED'] } });
    console.log(`Deleted ${result2.deletedCount} INITIATED/CALCULATED runs.`);
    
    console.log('Done!');
    process.exit(0);
}

fixRuns().catch(console.error);
