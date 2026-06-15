
const mongoose = require('mongoose');
require('dotenv').config();
const Tenant = require('./models/Tenant');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('Connected');
    const count = await Tenant.countDocuments();
    const tenants = await Tenant.find().limit(5);
    console.log('Tenant Count:', count);
    console.log('Tenants:', tenants);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
