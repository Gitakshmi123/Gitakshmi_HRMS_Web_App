const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Tenant = require('../models/Tenant');

const COMPANY_CODE = 'mic001'; 
const EMAIL_TO_CHECK = 'arzuobhuva1609@gmail.com';

const fs = require('fs');
const logFile = path.join(__dirname, '../DEBUG_SCRIPT.log');
function log(msg) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

async function debugTenant() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms_saas';
    log('STARTING SCRIPT...');
    log('Connecting to MongoDB: ' + mongoUri);
    
    // Add timeout
    const connPromise = mongoose.connect(mongoUri);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000));
    
    await Promise.race([connPromise, timeoutPromise]);
    log('Connected.');

    const tenant = await Tenant.findOne({ code: COMPANY_CODE });
    if (!tenant) {
      log(`❌ Tenant with code "${COMPANY_CODE}" NOT FOUND.`);
    } else {
      log(`✅ Tenant found: ${tenant.name} (${tenant.code})`);
      log('Status: ' + tenant.status);
      log('Meta: ' + JSON.stringify(tenant.meta, null, 2));

      const meta = tenant.meta || {};
      const storedEmail = String(meta.email || meta.primaryEmail || '').trim().toLowerCase();
      const storedPassword = String(meta.adminPassword || '').trim();
      
      const inputEmail = EMAIL_TO_CHECK.trim().toLowerCase();
      
      log('--- Comparison ---');
      log(`Stored Email:   "${storedEmail}"`);
      log(`Input Email:    "${inputEmail}"`);
      log(`Match?          ${storedEmail === inputEmail}`);
      
      log(`Stored Password: "${storedPassword}"`);
    }

    await mongoose.disconnect();
  } catch (err) {
    log('Error: ' + err);
  }
}

debugTenant();
