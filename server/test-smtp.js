const nodemailer = require('nodemailer');
require('dotenv').config();

const smtpUser = process.env.SMTP_USER?.trim();
const rawPass = process.env.SMTP_PASS?.trim();
const smtpPass = rawPass ? rawPass.replace(/\s+/g, '') : '';

console.log('--- SMTP TEST ---');
console.log('User:', smtpUser);
console.log('Pass Length:', smtpPass.length);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: smtpUser,
        pass: smtpPass
    },
    debug: true,
    logger: true
});

transporter.verify((error, success) => {
    if (error) {
        console.log('❌ Auth Failed:', error.message);
        if (error.response) console.log('Response:', error.response);
    } else {
        console.log('✅ SUCCESS! Connection is working.');
    }
    process.exit();
});
