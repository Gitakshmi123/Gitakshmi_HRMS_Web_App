require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.client.db('company_demo');
  await db.collection('payrollruns').updateOne(
    { runCode: '2026-06-SEL-01' },
    {
      $set: {
        approvalStatus: 'NOT_SUBMITTED',
        approvalWorkflow: [
          { order: 1, label: 'Payroll Review', role: 'HR', status: 'PENDING', comment: '' },
          { order: 2, label: 'Finance Approval', role: 'FINANCE', status: 'PENDING', comment: '' }
        ]
      }
    }
  );
  console.log('Reset complete');
  process.exit(0);
});
