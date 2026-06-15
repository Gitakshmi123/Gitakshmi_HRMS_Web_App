const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const dbName = 'GT_PMS_nitesh_legacy_442c114befbe';
  const db = mongoose.connection.useDb(dbName).db;
  
  const tasks = await db.collection('tasks').find().toArray();
  const qTasks = await db.collection('quicktasks').find().toArray();
  console.log('Total tasks:', tasks.length);
  console.log('Total quicktasks:', qTasks.length);
  
  if (tasks.length > 0) {
     console.log('Task [0]:', tasks[0].title, 'assigned to:', tasks[0].assignees);
  }

  process.exit(0);
}

run().catch(console.error);
