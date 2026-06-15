const mongoose = require('mongoose');
require('dotenv').config();

async function testController() {
  await mongoose.connect(process.env.MONGO_URI);
  const { getParentCompanies } = require('./controllers/tenant.controller');
  
  const req = { user: { email: 'test@admin.com', role: 'psa' } };
  const res = {
    json: (data) => console.log('RESPONSE:', JSON.stringify(data, null, 2))
  };
  const next = (err) => console.error('NEXT ERROR:', err);

  await getParentCompanies(req, res, next);
  process.exit(0);
}

testController();
