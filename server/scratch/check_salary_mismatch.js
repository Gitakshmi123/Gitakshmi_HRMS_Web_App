const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';

async function checkMismatches() {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection;
    console.log('Connected to DB');
    
    const snapshots = await db.db.collection('employeesalarysnapshots').find({ locked: false }).sort({ createdAt: -1 }).limit(5).toArray();
    
    snapshots.forEach(s => {
      const earningsSum = (s.earnings || []).reduce((sum, e) => sum + (e.yearlyAmount || 0), 0);
      const benefitsSum = (s.benefits || []).reduce((sum, b) => sum + (b.yearlyAmount || 0), 0);
      const total = earningsSum + benefitsSum;
      const diff = Math.abs(total - s.ctc);
      
      console.log(`Snapshot ${s._id}:`);
      console.log(`  CTC: ${s.ctc}`);
      console.log(`  Earnings Sum: ${earningsSum}`);
      console.log(`  Benefits Sum: ${benefitsSum}`);
      console.log(`  Total: ${total}`);
      console.log(`  Difference: ${diff}`);
      console.log(`  Match: ${diff <= 1}`);
    });
    
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkMismatches();
