const jwt = require('jsonwebtoken');

const secret = 'hrms@123';
const payload = {
    id: "69ae76d0d0a86653c8f75c29",
    email: "google@gmail.com",
    role: "hr",
    companyCode: "goo001",
    tenantId: "69ae76d0d0a86653c8f75c29"
};

const token = jwt.sign(payload, secret, { expiresIn: '7d' });
console.log('NEW_TOKEN: ' + token);
