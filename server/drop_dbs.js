const mongoose = require('mongoose');
const uri = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to MongoDB');
    const admin = mongoose.connection.db.admin();
    const result = await admin.listDatabases();
    const databases = result.databases.map(d => d.name);
    
    // Filter company databases, keep current one
    const companyDbs = databases.filter(name => name.startsWith('company_'));
    console.log(`Found ${companyDbs.length} company databases.`);

    let droppedCount = 0;
    for (const dbName of companyDbs) {
      if (dbName === 'company_gitakshmi_te_git002_f5c2a410') continue; // keep active DB
      
      console.log(`Dropping database: ${dbName}`);
      await mongoose.connection.useDb(dbName).dropDatabase();
      droppedCount++;
      
      // Just drop up to 10 to clear up some collections (500 limit is for collections, 10 DBs = maybe 100 collections)
      if (droppedCount >= 10) break;
    }
    
    console.log(`Dropped ${droppedCount} old databases.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });
