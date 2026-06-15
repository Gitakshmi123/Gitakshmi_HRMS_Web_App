const mongoose = require('mongoose');
require('dotenv').config();

async function testController() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const { getParentCompanies } = require('./controllers/tenant.controller');
    
    const req = { user: { email: 'test@admin.com', role: 'psa' } };
    const res = {
      json: (data) => {
        console.log('RESPONSE:', JSON.stringify(data, null, 2));
        process.exit(0);
      }
    };
    const next = (err) => {
      console.error('NEXT ERROR:', err);
      if (err.stack) console.error(err.stack);
      process.exit(1);
    };

    await getParentCompanies(req, res, next);
  } catch (err) {
    console.error('CATCH ERROR:', err);
    process.exit(1);
  }
}

testController();
