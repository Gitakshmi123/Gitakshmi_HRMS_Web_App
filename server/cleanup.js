const mongoose = require('mongoose');
require('dotenv').config();

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const adminDb = mongoose.connection.client.db().admin();
    const result = await adminDb.listDatabases();
    let totalDropped = 0;
    
    for (let dbInfo of result.databases) {
      if (dbInfo.name === 'admin' || dbInfo.name === 'local' || dbInfo.name === 'config') continue;
      
      console.log(`Checking database: ${dbInfo.name}`);
      const db = mongoose.connection.client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      
      for (let c of collections) {
        if (c.name.startsWith('system.')) continue;
        
        try {
          const count = await db.collection(c.name).estimatedDocumentCount();
          if (count === 0) {
            console.log(`Dropping empty collection: ${dbInfo.name}.${c.name}`);
            await db.collection(c.name).drop();
            totalDropped++;
            if (totalDropped >= 100) break;
          }
        } catch (e) {
          console.error(`Error on ${c.name}: ${e.message}`);
        }
      }
      if (totalDropped >= 100) break;
    }
    
    console.log(`Successfully dropped ${totalDropped} empty collections across all databases!`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
cleanup();
