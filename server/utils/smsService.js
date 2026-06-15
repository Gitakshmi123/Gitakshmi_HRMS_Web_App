let twilioClient = null;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_FROM;

if (accountSid && authToken) {
  const Twilio = require('twilio');
  twilioClient = new Twilio(accountSid, authToken);
}

async function sendSms({ to, body }) {
  if (twilioClient && twilioFrom) {
    return twilioClient.messages.create({ from: twilioFrom, to, body });
  }

  // fallback: just log the message (useful for dev without Twilio)
  console.log('SMS send (mock):', { to, body });
  return { mock: true };
}

module.exports = { sendSms };
