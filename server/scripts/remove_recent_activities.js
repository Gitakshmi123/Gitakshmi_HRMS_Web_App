const mongoose = require('mongoose');
require('dotenv').config();
const ActivityExport = require('../models/Activity');

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function run(){
  try{
    await mongoose.connect(MONGO);
    console.log('Connected to MongoDB');
    // Ensure Activity is a model on this connection
    let Activity = ActivityExport;
    if (typeof ActivityExport.deleteMany !== 'function') {
      try { Activity = mongoose.model('Activity'); } catch (e) { mongoose.model('Activity', ActivityExport); Activity = mongoose.model('Activity'); }
    }

    const recent = await Activity.find().sort({ time: -1 }).limit(3).lean();
    if(!recent.length){
      console.log('No activities to remove');
      process.exit(0);
    }
    console.log('Recent activities to remove:');
    recent.forEach((r)=> console.log(r._id, r.time, r.action, r.company));
    const ids = recent.map(r=>r._id);
    const res = await Activity.deleteMany({ _id: { $in: ids } });
    console.log('Deleted count:', res.deletedCount);
    process.exit(0);
  }catch(err){
    console.error(err);
    process.exit(1);
  }
}

run();
