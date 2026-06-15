require('dotenv').config({ path: '.env' }); // Adjust path to point to backend .env
const nodemailer = require('nodemailer');

async function verifyEmail() {
    console.log("🔍 [EMAIL VERIFY] Starting Email Configuration Check...");

    // 1. Check Env Vars
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = process.env.SMTP_PORT || 587;

    console.log(`   - HOST: ${host}`);
    console.log(`   - PORT: ${port}`);
    console.log(`   - USER: ${user ? user.replace(/(.{2})(.*)(@.*)/, '$1****$3') : 'MISSING'}`);
    console.log(`   - PASS: ${pass ? '**** [PRESENT]' : 'MISSING'}`);

    if (!user || !pass) {
        console.error("❌ [EMAIL VERIFY] FAILED: SMTP_USER or SMTP_PASS is missing in .env");
        return;
    }

    // 2. Create Transporter
    const transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: port == 465,
        auth: {
            user: user,
            pass: pass,
        },
    });

    // 3. Verify Connection
    console.log("🔄 [EMAIL VERIFY] Verifying SMTP Connection...");
    try {
        await transporter.verify();
        console.log("✅ [EMAIL VERIFY] SMTP Connection Successful!");
    } catch (err) {
        console.error("❌ [EMAIL VERIFY] SMTP Connection FAILED:", err.message);
        console.error("   -> Hint: If using Gmail, ensure you are using an 'App Password', not your login password.");
        return;
    }

    // 4. Send Test Email (to self)
    console.log(`🔄 [EMAIL VERIFY] Sending test email to ${user}...`);
    try {
        const info = await transporter.sendMail({
            from: `"Test Script" <${user}>`,
            to: user, // Send to self
            subject: "HRMS Email Configuration Test",
            text: "If you are reading this, your email configuration is working perfectly!",
            html: "<b>If you are reading this, your email configuration is working perfectly!</b>"
        });
        console.log(`✅ [EMAIL VERIFY] Email Sent Successfully! Message ID: ${info.messageId}`);
    } catch (err) {
        console.error("❌ [EMAIL VERIFY] Send Mail FAILED:", err.message);
    }
}

verifyEmail();
