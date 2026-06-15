const mongoose = require('mongoose');
require('dotenv').config();
const Tenant = require('./models/Tenant');

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    
    const tenants = await Tenant.find({}).lean();
    console.log('Total tenants:', tenants.length);
    tenants.forEach(t => {
      console.log(JSON.stringify(t, null, 2));
    });

    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
