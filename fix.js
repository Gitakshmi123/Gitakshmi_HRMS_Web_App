const fs = require('fs');

const file = 'D:\\Project\\GT_HRMS\\server\\controllers\\candidate.controller.js';
let content = fs.readFileSync(file, 'utf8');

const marker = '// --- Forgot Password Methods ---';
const index = content.indexOf(marker);

if (index !== -1) {
    content = content.substring(0, index);
}

const correctCode = `// --- Forgot Password Methods ---
const forgotPasswordOtpEntries = new Map();

exports.sendForgotPasswordOtp = async (req, res) => {
    try {
        const { email, tenantId } = req.body;
        if (!email || !tenantId) return res.status(400).json({ error: "Email and company portal identification are required." });

        const tenantDB = await getTenantDB(tenantId);
        if (!tenantDB) return res.status(400).json({ error: "Invalid company portal link." });

        const resolvedTenantId = await resolveTenantObjectId(tenantId, tenantDB);
        if (!resolvedTenantId) return res.status(400).json({ error: "Invalid company portal." });

        let Candidate;
        try { Candidate = tenantDB.model("Candidate"); } catch (e) {
            Candidate = tenantDB.model("Candidate", require("../models/Candidate"));
        }

        const existing = await Candidate.findOne({ email: email.toLowerCase(), tenant: resolvedTenantId });
        if (!existing) {
            return res.status(404).json({ error: "No account found with this email in the current portal." });
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const exp = Date.now() + 10 * 60 * 1000;
        const key = \`\${resolvedTenantId}:\${email.toLowerCase()}\`;
        forgotPasswordOtpEntries.set(key, { otp, exp });

        const { sendMail } = require('../utils/emailService');
        const smtpOwner = await Tenant.findById(resolvedTenantId).select('smtpConfig').lean();
        const customSmtp = smtpOwner?.smtpConfig?.host && smtpOwner?.smtpConfig?.user && smtpOwner?.smtpConfig?.pass
            ? smtpOwner.smtpConfig
            : null;

        await sendMail({
            to: email,
            subject: 'Password Reset Verification Code',
            text: \`Your password reset verification code is: \${otp}\\n\\nThis code expires in 10 minutes.\`,
            html: \`<div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>Password Reset</h2>
                <p>We received a request to reset the password for your account. Please use the verification code below to reset your password:</p>
                <div style="background-color: #f0f4f8; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; border-radius: 8px; margin: 20px 0; color: #1a56db;">
                    \${otp}
                </div>
                <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
            </div>\`,
            customSmtp
        });

        res.json({ success: true, message: "Verification code sent to your email." });
    } catch (err) {
        console.error('❌ [FORGOT_PWD_OTP] Error:', err);
        res.status(500).json({ error: "Failed to send verification code. Please try again." });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { tenantId, email, otp, newPassword } = req.body;
        if (!tenantId || !email || !otp || !newPassword) return res.status(400).json({ error: "All fields are required." });

        const tenantDB = await getTenantDB(tenantId);
        if (!tenantDB) return res.status(400).json({ error: "Invalid portal link" });

        const resolvedTenantId = await resolveTenantObjectId(tenantId, tenantDB);
        if (!resolvedTenantId) return res.status(400).json({ error: "Invalid portal" });

        const key = \`\${resolvedTenantId}:\${email.toLowerCase()}\`;
        const entry = forgotPasswordOtpEntries.get(key);

        if (!entry || entry.otp !== String(otp) || entry.exp < Date.now()) {
            return res.status(400).json({ error: "Invalid or expired verification code (OTP)." });
        }

        let Candidate;
        try { Candidate = tenantDB.model("Candidate"); } catch (e) {
            Candidate = tenantDB.model("Candidate", require("../models/Candidate"));
        }

        const candidate = await Candidate.findOne({ email: email.toLowerCase(), tenant: resolvedTenantId });
        if (!candidate) return res.status(404).json({ error: "Candidate not found." });

        const bcrypt = require('bcryptjs');
        candidate.password = await bcrypt.hash(newPassword, 10);
        await candidate.save();

        forgotPasswordOtpEntries.delete(key);

        res.json({ success: true, message: "Password reset successfully. You can now login." });
    } catch (err) {
        console.error('❌ [RESET_PWD] Error:', err);
        res.status(500).json({ error: "Failed to reset password. Please try again." });
    }
};
\n`;

fs.writeFileSync(file, content + correctCode);
console.log('Fixed syntax error in candidate.controller.js');
