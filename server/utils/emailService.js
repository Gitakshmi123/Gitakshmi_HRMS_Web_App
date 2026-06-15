require('dotenv').config();
const nodemailer = require('nodemailer');
const dns = require('dns');
const mongoose = require('mongoose');
const net = require('net');

// Fallback DNS lookup to Google/Cloudflare DNS if default ISP DNS fails to resolve SMTP server
const customLookup = (hostname, options, callback) => {
  const cb = typeof options === 'function' ? options : callback;
  const opts = {
    ...(typeof options === 'object' ? options : {}),
    family: 4,
    all: false
  };
  dns.lookup(hostname, opts, (err, address, family) => {
    if (err && (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN')) {
      const resolver = new dns.Resolver();
      try {
        resolver.setServers(['8.8.8.8', '1.1.1.1']);
        resolver.resolve4(hostname, (fallbackErr, addresses) => {
          if (fallbackErr || !addresses || addresses.length === 0) {
            return cb(err);
          }
          cb(null, addresses[0], 4);
        });
      } catch (resolveErr) {
        cb(err);
      }
    } else {
      cb(err, address, family);
    }
  });
};

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.EMAIL_FROM || SMTP_USER || `no-reply@${process.env.SMTP_DOMAIN || 'example.com'}`;

let transporter;
let savedDefaultSmtpCache = null;

function normalizeSmtpConfig(config = {}) {
  const host = String(config.host || '').trim();
  const port = Number(config.port || 587);
  let secure = config.secure === true || String(config.secure).toLowerCase() === 'true';
  if (port === 465) secure = true;
  else if (port === 587) secure = false;

  const user = config.user?.trim();
  const rawPass = (config.pass ?? config.password ?? '').toString().trim();
  const pass = (host.includes('gmail') && rawPass) ? rawPass.replace(/\s+/g, '') : rawPass;

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail: config.fromEmail?.trim(),
    fromName: config.fromName?.trim()
  };
}

async function resolveSmtpHost(config) {
  if (!config.host || net.isIP(config.host)) {
    return config;
  }

  try {
    const addresses = await dns.promises.resolve4(config.host);
    if (addresses && addresses.length > 0) {
      return { ...config, resolvedHost: addresses[0] };
    }
  } catch (_resolveErr) {
    // Fall through to dns.lookup IPv4 fallback.
  }

  const address = await new Promise((resolve, reject) => {
    customLookup(config.host, {}, (err, resolvedAddress) => {
      if (err) return reject(err);
      resolve(resolvedAddress);
    });
  });

  return { ...config, resolvedHost: address };
}

async function createSmtpTransport(config) {
  const resolvedConfig = await resolveSmtpHost(config);
  const originalHost = resolvedConfig.host;
  const connectionHost = resolvedConfig.resolvedHost || originalHost;

  return nodemailer.createTransport({
    host: connectionHost,
    port: Number(config.port),
    secure: config.secure,
    servername: originalHost,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      servername: originalHost
    },
    dnsTimeout: 10000,
    connectionTimeout: 15000,
    greetingTimeout: 15000
  });
}

function getFromAddress(config) {
  if (config?.fromEmail) {
    return config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail;
  }

  return FROM_EMAIL;
}

async function getCustomTransporter(customSmtp) {
  if (!customSmtp || !customSmtp.host || !customSmtp.user) return null;

  const config = normalizeSmtpConfig(customSmtp);
  console.log('--- Connecting to Tenant SMTP Server ---');
  console.log('Host:', config.host);
  console.log('Port:', config.port);
  console.log('User:', config.user);

  return { transporter: await createSmtpTransport(config), config };
}

async function getSavedDefaultSmtp() {
  if (savedDefaultSmtpCache && Date.now() - savedDefaultSmtpCache.loadedAt < 30000) {
    return savedDefaultSmtpCache.config;
  }

  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.models.Tenant) {
      return null;
    }

    const Tenant = mongoose.model('Tenant');
    const tenant = await Tenant.findOne({
      'smtpConfig.host': { $exists: true, $ne: '' },
      'smtpConfig.user': { $exists: true, $ne: '' },
      'smtpConfig.pass': { $exists: true, $ne: '' }
    })
      .sort({ updatedAt: -1 })
      .select('smtpConfig')
      .lean();

    const config = tenant?.smtpConfig || null;
    savedDefaultSmtpCache = { loadedAt: Date.now(), config };
    return config;
  } catch (error) {
    console.warn('[emailService] Failed to load saved SMTP fallback:', error.message);
    return null;
  }
}

async function getTransporter() {
  if (transporter) return transporter;
  // Use SMTP if configured, otherwise try direct send (not recommended)
  if (SMTP_HOST && SMTP_USER) {
    console.log('--- Connecting to SMTP Server ---');
    console.log('Host:', SMTP_HOST);
    console.log('Port:', SMTP_PORT);
    console.log('User:', SMTP_USER);
    
    transporter = await createSmtpTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      user: SMTP_USER,
      pass: SMTP_PASS
    });

    // Verify connection on creation
    transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Email SMTP Error:', error.message);
      } else {
        console.log('✅ Email SMTP Server is ready to take our messages');
      }
    });

  } else {
    // fallback to sendmail if not configured
    console.log('--- Using Sendmail Fallback (No SMTP configured) ---');
    transporter = nodemailer.createTransport({ sendmail: true });
  }
  return transporter;
}

async function sendMail(options) {
  const { to, subject, text, html, from, customSmtp, ...extra } = options || {};
  const selectedSmtp = customSmtp || await getSavedDefaultSmtp();
  const customTransport = await getCustomTransporter(selectedSmtp);
  const t = customTransport?.transporter || await getTransporter();
  const fromAddress = from || (customTransport ? getFromAddress(customTransport.config) : FROM_EMAIL);
  const info = await t.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html,
    ...extra
  });

  return info;
}

module.exports = { sendMail };

