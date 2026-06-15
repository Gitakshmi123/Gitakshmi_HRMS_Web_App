const mongoose = require('mongoose');
const { getTenantDB } = require('../config/dbManager');
const { getWorkflowModels } = require('../services/workflowRuntimeCore.service');

// Load env variables
require('dotenv').config();

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/gt_hrms";
  console.log('Connecting to', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  try {
    const tenantDB = getTenantDB('6a267cff4612c5f3fddd9a3');
    console.log('Got tenant DB. Now trying getWorkflowModels...');
    const models = getWorkflowModels(tenantDB);
    console.log('Successfully retrieved workflow models:', Object.keys(models));
  } catch (error) {
    console.error('CRITICAL ERROR:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
