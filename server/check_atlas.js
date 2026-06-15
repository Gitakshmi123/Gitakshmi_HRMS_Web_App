
const mongoose = require('mongoose');
const mongoUri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrmsmain?retryWrites=true&w=majority&appName=Cluster0';

async function checkDb() {
  try {
    console.log('Connecting to Atlas...');
    await mongoose.connect(mongoUri);
    console.log('Connected.');
    
    // Define minimal schema
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({
        companyName: String,
        name: String,
        parentCompanyId: mongoose.Schema.Types.Mixed,
        status: String
    }, { strict: false }));
    
    const count = await Tenant.countDocuments({ status: { $ne: 'deleted' } });
    const all = await Tenant.find({ status: { $ne: 'deleted' } }).select('companyName name parentCompanyId status').lean();
    
    console.log(`TOTAL_NON_DELETED: ${count}`);
    all.forEach(t => {
      console.log(`COMP: ID=${t._id}, NAME=${t.companyName || t.name}, PARENT=${t.parentCompanyId}, STATUS=${t.status}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Atlas Check failed:', err.message);
    process.exit(1);
  }
}

checkDb();
