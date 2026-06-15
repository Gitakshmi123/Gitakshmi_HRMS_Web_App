#!/usr/bin/env node
/**
 * Fix Leave Policy Rules
 * This script adds default leave rules to Leave Policies that are empty
 * Usage: node fix-leave-policy-rules.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms_tenants_data';

// Connection options
const connectOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  socketTimeoutMS: 45000,
};

async function fixLeavePolicies() {
  let connection;
  try {
    console.log('🔄 Connecting to MongoDB...');
    
    // Connect to main database first to get tenant info
    connection = await mongoose.connect(MONGO_URI, connectOptions);
    console.log('✅ Connected to MongoDB');

    // Get the database
    const db = mongoose.connection.db;
    
    // Find all policies with empty or no rules
    const policiesCollection = db.collection('leavepolicies');
    
    console.log('🔍 Searching for policies with empty rules...');
    const emptPolicies = await policiesCollection.find({
      $or: [
        { rules: { $exists: false } },
        { rules: { $eq: null } },
        { rules: { $eq: [] } }
      ]
    }).toArray();

    if (emptPolicies.length === 0) {
      console.log('✅ No empty policies found!');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`📋 Found ${emptPolicies.length} policies with empty rules\n`);

    // Default rules to add
    const defaultRules = [
      { leaveType: 'CL', totalPerYear: 15, color: '#3b82f6', name: 'Casual Leave' },
      { leaveType: 'SL', totalPerYear: 10, color: '#f59e0b', name: 'Sick Leave' },
      { leaveType: 'EL', totalPerYear: 8, color: '#8b5cf6', name: 'Extra Leave' }
    ];

    // Update each policy
    for (const policy of emptPolicies) {
      console.log(`📝 Updating policy: ${policy.name || policy._id}`);
      console.log(`   Tenant: ${policy.tenant}`);
      
      const result = await policiesCollection.updateOne(
        { _id: policy._id },
        { $set: { rules: defaultRules } }
      );

      if (result.modifiedCount > 0) {
        console.log(`   ✅ Added ${defaultRules.length} rules\n`);
      } else {
        console.log(`   ❌ Failed to update\n`);
      }
    }

    console.log('🎉 All policies updated successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');
    }
  }
}

// Run the fix
fixLeavePolicies();
