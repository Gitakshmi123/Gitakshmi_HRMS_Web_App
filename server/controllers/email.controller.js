const EmailService = require('../services/email.service');

/**
 * Example controller to send a test email.
 * Usage: POST /api/email/send
 * Body: { "to": "test@example.com", "subject": "Test", "body": "<h1>HTML Content</h1>" }
 */
exports.sendTestEmail = async (req, res) => {
    try {
        // console.log("📩 [EmailController] Received request to send email.");
        const { to, subject, body } = req.body;

        // Basic validation
        if (!to) {
            return res.status(400).json({ message: "Email recipient (to) is required." });
        }

        // Use the reusable service
        // Default subject and body if not provided
        const emailSubject = subject || "Test Email from HRMS";
        const emailBody = body || `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #4a90e2;">HRMS Notification</h2>
                <p>This is a test email sent from the HRMS Backend System.</p>
                <div style="background: #f4f4f4; padding: 10px; border-radius: 5px;">
                    <strong>Timestamp:</strong> ${new Date().toLocaleString()}
                </div>
                <p>If you received this, the email service is working correctly!</p>
            </div>
        `;

        // Call the service
        const result = await EmailService.sendEmail(to, emailSubject, emailBody);

        res.status(200).json({
            message: "Email sent successfully",
            details: result
        });

    } catch (error) {
        console.error("❌ [EmailController] Error:", error.message);
        res.status(500).json({
            message: "Failed to send email",
            error: error.message
        });
    }
};
