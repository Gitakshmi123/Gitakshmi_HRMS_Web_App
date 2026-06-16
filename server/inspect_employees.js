const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://techdhruv16_db_user:FpXqAuXiuyi51JLx@cluster0.cpfocff.mongodb.net/?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  const dbConn = mongoose.connection.useDb('company_pnr');
  const Employee = dbConn.collection('employees');

  const employees = await Employee.find({}).toArray();
  console.log(`Inspecting ${employees.length} employees:`);
  
  for (const e of employees) {
    console.log(`\nEmployee: ${e.firstName} ${e.lastName} (${e.employeeId || e.employeeCode})`);
    console.log('Keys:', Object.keys(e));
    if (e.meta) console.log('Meta:', e.meta);
    if (e.customFields) console.log('Custom Fields:', e.customFields);
    
    // Look for any field that might indicate a manager or supervisor
    for (const key of Object.keys(e)) {
      if (key.toLowerCase().includes('manager') || key.toLowerCase().includes('report') || key.toLowerCase().includes('lead') || key.toLowerCase().includes('boss')) {
        console.log(`Field "${key}":`, e[key]);
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
