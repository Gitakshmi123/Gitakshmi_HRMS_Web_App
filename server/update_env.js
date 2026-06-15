const fs = require('fs');
const jwt = require('jsonwebtoken');

const path = require('path');
const envPath = path.join(__dirname, '..', 'client', '.env');
const content = fs.readFileSync(envPath, 'utf8');

const secret = 'hrms@123';
const payload = {
    id: "69ae76d0d0a86653c8f75c29",
    email: "google@gmail.com",
    role: "hr",
    companyCode: "goo001",
    tenantId: "69ae76d0d0a86653c8f75c29"
};

const token = jwt.sign(payload, secret, { expiresIn: '72h' });

const newContent = content.replace(/VITE_DEV_HR_TOKEN=.*/, `VITE_DEV_HR_TOKEN=${token}`);

fs.writeFileSync(envPath, newContent);
console.log('Successfully updated VITE_DEV_HR_TOKEN in client/.env');
console.log('New Tenant ID:', payload.tenantId);
