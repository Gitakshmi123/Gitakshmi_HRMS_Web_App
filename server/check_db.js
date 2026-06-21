require('dotenv').config();
const mongoose = require('mongoose');
const MinimumWageSchema = require('./models/MinimumWage');

async function run() {
  try {
    console.log("Connecting to:", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully!");

    // Resolve model
    const Tenant = require('./models/Tenant');
    const firstTenant = await Tenant.findOne({ status: 'active' }).lean();
    if (!firstTenant) {
      console.log("No active tenant found.");
      return;
    }
    console.log("Active tenant found:", firstTenant.companyName, "ID:", firstTenant._id);

    let MinimumWage;
    try {
      MinimumWage = mongoose.model('MinimumWage');
    } catch(e) {
      MinimumWage = mongoose.model('MinimumWage', MinimumWageSchema);
    }

    const total = await MinimumWage.countDocuments();
    console.log("Total MinimumWage records:", total);

    const records = await MinimumWage.find({}).lean();
    console.log("MinimumWage Records:");
    records.forEach(r => {
      console.log(`- State: ${r.state}, Category: ${r.category}, Amount: ₹${r.monthlyAmount}, Active: ${r.isActive}`);
    });

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
