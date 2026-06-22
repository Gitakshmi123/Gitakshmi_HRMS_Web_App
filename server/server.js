// Server root - forced restart 2026-06-20T12:48:00
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Configure custom DNS servers if provided in .env (helps with DNS SRV lookup issues)
if (process.env.DNS_SERVERS) {
    try {
        const dns = require('dns');
        const dnsServers = process.env.DNS_SERVERS.split(',').map(s => s.trim()).filter(Boolean);
        if (dnsServers.length > 0) {
            dns.setServers(dnsServers);
            console.log(`📡 [DNS] Custom DNS servers configured: ${dnsServers.join(', ')}`);
        }
    } catch (dnsErr) {
        console.error('❌ [DNS] Failed to set custom DNS servers:', dnsErr.message);
    }
} else {
    // [DNS-FIX]: Removed manual DNS overrides by default as they cause issues on some offline/Windows setups,
    // but users can still enable them via DNS_SERVERS env var.
    // const dns = require('dns');
    // if (dns.setDefaultResultOrder) {
    //     dns.setDefaultResultOrder('ipv4first');
    // }
}

let isShuttingDown = false;
let modelsLoading = false;
let serverForGraceful = null;
let dbRetryTimer = null;

const emitStatus = (msg) => {
    try {
        process.stdout.write(`${msg}\n`);
    } catch (_) {
        // ignore
    }
};

// [STABILITY-FIX]: Global Error Catchers
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 CRITICAL_UNHANDLED_REJECTION:', reason);
    if (reason && reason.stack) console.error(reason.stack);
});

process.on('uncaughtException', (error) => {
    console.error('🚨 CRITICAL_UNCAUGHT_EXCEPTION:', error.message);
    console.error(error.stack);
    // Force a 1s delay to allow logs to flush
    setTimeout(() => gracefulShutdown('uncaughtException'), 1000);
});

// Trace process.exit
const originalExit = process.exit;
process.exit = function(code) {
    return originalExit.apply(process, arguments);
};

// Critical Check: AI Support
if (!process.env.GEMINI_API_KEY) {
    // console.warn("⚠️  WARNING: GEMINI_API_KEY is missing in .env file.");
}

const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { initializeSocket } = require('./services/socket.service');
const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

function readBooleanEnv(value, fallback = false) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

// Port definition with environment fallback
const PORT = process.env.PORT || 5003;
const enableBackgroundJobs = isProduction || readBooleanEnv(process.env.ENABLE_BACKGROUND_JOBS, false);
const enableSocialBackgroundJobs = enableBackgroundJobs && (
    isProduction || readBooleanEnv(process.env.ENABLE_SOCIAL_BACKGROUND_JOBS, false)
);
const enableHttpRootLogs = readBooleanEnv(process.env.ENABLE_HTTP_ROOT_LOGS, false);

if (isProduction) {
    const requiredSecurityEnv = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
    const missingSecurityEnv = requiredSecurityEnv.filter((key) => !process.env[key]);

    if (missingSecurityEnv.length > 0) {
        console.error(`❌ FATAL: Missing required production security env vars: ${missingSecurityEnv.join(', ')}`);
        process.exit(1);
    }
}

// Ngrok setup (Optional)
let ngrok;
try { ngrok = require('ngrok'); } catch (_) { ngrok = null; }

/* ===============================
   DATABASE CONNECTION
================================ */
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
if (isProduction && !process.env.MONGODB_URI && !process.env.MONGO_URI) {
    console.error('❌ FATAL: MONGO_URI is required in production. Refusing to start to protect existing data.');
    process.exit(1);
}

// Log connection attempt (masked)
const maskedUri = MONGO_URI.replace(/\/\/.*@/, '//****:****@');
console.log(`📡 [DB CONNECT] Attempting connection to: ${maskedUri}`);

const options = {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 30000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
    w: 'majority'
};

const DB_RETRY_MS = Number(process.env.DB_RETRY_MS || 10000);
const STRICT_DB_STARTUP = String(process.env.STRICT_DB_STARTUP || (isProduction ? 'true' : 'false')).toLowerCase() === 'true';

if (isProduction) {
    mongoose.set('autoIndex', false);
    mongoose.set('autoCreate', false);
}

let dnsFallbackApplied = false;

async function connectToDatabase() {
    const fallback = process.env.MONGO_FALLBACK_URI || 'mongodb://localhost:27017/hrms';
    const preferLocalInDev = String(process.env.PREFER_LOCAL_MONGO || 'false').toLowerCase() === 'true';

    try {
        if (!isProduction && preferLocalInDev && fallback) {
            await mongoose.connect(fallback, options);
            emitStatus(`✅ [DB CONNECTED] source=fallback-local db=${mongoose.connection.name} host=${mongoose.connection.host}`);
            return true;
        }

        await mongoose.connect(MONGO_URI, options);
        emitStatus(`✅ [DB CONNECTED] source=primary db=${mongoose.connection.name} host=${mongoose.connection.host}`);
        return true;
    } catch (err) {
        console.error('❌ MongoDB initial connection failed:', err.message);
        emitStatus(`❌ [DB NOT CONNECTED] reason=${err.message}`);

        const isDnsError = err && (
            err.syscall === 'querySrv' ||
            err.code === 'ENOTFOUND' ||
            err.code === 'ECONNREFUSED' ||
            err.message.includes('querySrv')
        );

        if (isDnsError) {
            if (!dnsFallbackApplied && MONGO_URI.startsWith('mongodb+srv://')) {
                console.warn('⚠️ DNS SRV lookup failed. Attempting to switch to public DNS (8.8.8.8, 1.1.1.1) and retry...');
                try {
                    const dns = require('dns');
                    dns.setServers(['8.8.8.8', '1.1.1.1']);
                    dnsFallbackApplied = true;
                    await mongoose.connect(MONGO_URI, options);
                    emitStatus(`✅ [DB CONNECTED] source=dns-fallback-srv db=${mongoose.connection.name} host=${mongoose.connection.host}`);
                    return true;
                } catch (dnsErr) {
                    console.error('❌ Retry after DNS fallback failed:', dnsErr.message);
                }
            } else {
                console.warn('⚠️ DNS SRV lookup failed. Possible ISP or network restriction.');
            }

            const fallback = process.env.MONGO_FALLBACK_URI;
            if (fallback && fallback !== MONGO_URI) {
                try {
                    await mongoose.connect(fallback, options);
                    emitStatus(`✅ [DB CONNECTED] source=dns-fallback db=${mongoose.connection.name} host=${mongoose.connection.host}`);
                    return true;
                } catch (fErr) {
                    console.error('❌ Fallback also failed:', fErr.message);
                }
            }
        }
        if (STRICT_DB_STARTUP) {
            process.exit(1);
        }
        return false;
    }
}

function setupDbConnectionStatusHooks() {
    mongoose.connection.on('connected', () => {
        emitStatus(`✅ [DB CONNECTED] db=${mongoose.connection.name} host=${mongoose.connection.host}`);
    });
    mongoose.connection.on('reconnected', () => {
        emitStatus(`🔄 [DB RECONNECTED] db=${mongoose.connection.name} host=${mongoose.connection.host}`);
    });
    mongoose.connection.on('disconnected', () => {
        emitStatus('⚠️ [DB DISCONNECTED]');
    });
    mongoose.connection.on('error', (err) => {
        // Suppress warning if it's a DNS lookup error during startup, since it is handled by fallback retry
        if (err && (err.syscall === 'querySrv' || err.code === 'ENOTFOUND')) {
            return;
        }
        emitStatus(`❌ [DB ERROR] ${err?.message || 'Unknown DB error'}`);
    });
}

function startDbRetryLoop() {
    if (dbRetryTimer) return;
    dbRetryTimer = setInterval(async () => {
        try {
            if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;
            emitStatus('⏳ [DB RETRY] attempting reconnect...');
            await connectToDatabase();
        } catch (err) {
            emitStatus(`❌ [DB RETRY FAILED] ${err?.message || 'Unknown error'}`);
        }
    }, DB_RETRY_MS);
}

/* ===============================
   SERVER LIFECYCLE MANAGEMENT
 ================================ */
const server = http.createServer((req, res) => {
    if (enableHttpRootLogs) {
        console.log(`[HTTP_ROOT] ${req.method} ${req.url}`);
    }
    app(req, res);
});
initializeSocket(server);
serverForGraceful = server;

async function startServer() {
    setupDbConnectionStatusHooks();
    const dbConnected = await connectToDatabase();
    if (!dbConnected) {
        emitStatus(`⚠️ [SERVER MODE] started without DB. Will retry every ${DB_RETRY_MS}ms`);
        startDbRetryLoop();
    }

    if (false && !isProduction && mongoose.connection.readyState === 1) { // DISABLED for E2E testing from PSA
        try {
            const Tenant = mongoose.model('Tenant');
            const defaultCode = String(process.env.DEFAULT_TENANT_CODE || 'GIT001').trim().toUpperCase();
            const defaultEmail = String(process.env.DEFAULT_TENANT_EMAIL || 'admin@gitakshmi.local').trim().toLowerCase();
            const existingDefaultTenant = await Tenant.findOne({
                $or: [
                    { code: defaultCode },
                    { tenantId: defaultCode },
                    { companyEmail: defaultEmail },
                    { adminEmail: defaultEmail },
                ],
            }).select('_id').lean();
            const count = existingDefaultTenant ? 1 : await Tenant.countDocuments();
            if (count === 0) {
                const passwordPlain = String(process.env.DEFAULT_TENANT_PASSWORD || 'admin123');
                const passwordHash = await bcrypt.hash(passwordPlain, 10);
                const apiKey = crypto.randomBytes(24).toString('hex');
                const tenantId = defaultCode;

                let createdDefaultTenant = false;
                try {
                    await Tenant.create({
                        companyName: 'HRMS (Dev)',
                        companyEmail: defaultEmail,
                        ownerName: 'Dev Admin',
                        password: passwordHash,
                        adminEmail: defaultEmail,
                        adminName: 'Dev Admin',
                        tenantId,
                        apiKey,
                        code: defaultCode,
                        status: 'active',
                        enabledModules: {
                            hr: true,
                            payroll: true,
                            attendance: true,
                            leave: true,
                            recruitment: true,
                            backgroundVerification: true,
                            documentManagement: true,
                            socialMediaIntegration: true,
                            onboarding: true,
                            employeePortal: true,
                            reports: true,
                        },
                    });
                    createdDefaultTenant = true;
                } catch (createErr) {
                    if (createErr?.code !== 11000) throw createErr;
                    emitStatus(`[DEV SEED] Default tenant already exists code=${defaultCode} email=${defaultEmail}`);
                }

                if (createdDefaultTenant) {
                    emitStatus(`✅ [DEV SEED] Created default tenant code=${defaultCode} email=${defaultEmail}`);
                }
            }
        } catch (seedErr) {
            console.error('⚠️ [DEV SEED] Failed to ensure default tenant:', seedErr.message);
        }
    }

    if (enableSocialBackgroundJobs) {
        try {
            const { initInstagramPublishWorker } = require('./modules/social-media-enterprise/queues/InstagramPublishQueue');
            await initInstagramPublishWorker();
            require('./modules/social-media-enterprise/services/SocialSchedulerService');
        } catch (schedErrV2) {
            console.error('⚠️ Failed to initialize Enterprise Scheduler:', schedErrV2.message);
        }
    }

    try {
        const { initializeRealtimeSocialAnalytics } = require('./modules/realtime-social-analytics');
        await initializeRealtimeSocialAnalytics();
    } catch (analyticsRealtimeErr) {
        console.error('⚠️ Failed to initialize realtime social analytics:', analyticsRealtimeErr.message);
    }

    const maxRetries = 5;
    let retries = 0;

    const tryListen = () => {
        const currentServer = server.listen(PORT, async () => {
            emitStatus(`🚀 [SERVER READY] http://127.0.0.1:${PORT}`);
            
            if (enableBackgroundJobs) {
                try {
                    const BGVSLACronJobs = require('./cron/bgvSLACron');
                    BGVSLACronJobs.initializeCronJobs();
                } catch (cronError) {
                    console.error('⚠️ Warning: Failed to initialize BGV SLA cron jobs:', cronError.message);
                }

                if (enableSocialBackgroundJobs) {
                    try {
                        const startAnalyticsCronJob = require('./jobs/socialAnalyticsCron');
                        startAnalyticsCronJob();
                    } catch (analyticsErr) {
                        console.error('⚠️ Warning: Failed to initialize Social Analytics cron:', analyticsErr.message);
                    }
                }

                try {
                    const startJoiningLetterExpiryCron = require('./jobs/joiningLetterExpiryCron');
                    startJoiningLetterExpiryCron();
                } catch (expiryErr) {
                    console.error('⚠️ Warning: Failed to initialize Joining Letter Expiry cron:', expiryErr.message);
                }

                try {
                    const initializeLeaveAccrualCron = require('./jobs/leaveAccrualCron');
                    initializeLeaveAccrualCron();
                } catch (accrualErr) {
                    console.error('⚠️ Warning: Failed to initialize Leave Accrual cron:', accrualErr.message);
                }

                try {
                    const initializeYearlyLeaveResetCron = require('./jobs/yearlyLeaveResetCron');
                    initializeYearlyLeaveResetCron();
                } catch (resetErr) {
                    console.error('⚠️ Warning: Failed to initialize yearly leave reset cron:', resetErr.message);
                }

                try {
                    const cron = require('node-cron');
                    const { runReminderCycle } = require('./services/onboarding.service');
                    cron.schedule('0 * * * *', () => {
                        runReminderCycle().catch((error) => {
                            console.error('⚠️ Warning: Onboarding reminder cycle failed:', error.message);
                        });
                    });
                } catch (onboardingCronErr) {
                    console.error('⚠️ Warning: Failed to initialize onboarding reminder cron:', onboardingCronErr.message);
                }
            }

            const useNgrok = String(process.env.USE_NGROK || '').toLowerCase() === 'true' && process.env.NODE_ENV !== 'production';
            if (useNgrok && ngrok) {
                try {
                    if (process.env.NGROK_AUTHTOKEN) await ngrok.authtoken(process.env.NGROK_AUTHTOKEN);
                    const url = await ngrok.connect({ addr: PORT });
                    process.env.NGROK_URL = url;
                } catch (e) { }
            }
        });

        currentServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE' && retries < maxRetries) {
                retries++;
                emitStatus(`⏳ [PORT BUSY] Port ${PORT} is in use, retrying in 2s (Attempt ${retries}/${maxRetries})...`);
                setTimeout(tryListen, 2000);
            } else if (err.code === 'EADDRINUSE') {
                console.error(`❌ FATAL ERROR: Port ${PORT} is already in use after ${maxRetries} attempts.`);
                process.exit(1);
            } else {
                console.error('❌ SERVER ERROR:', err.message);
            }
        });
    };

    tryListen();
}

function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    const forceExitTimeout = setTimeout(() => {
        console.error('⚠️ Forcefully shutting down.');
        process.exit(1);
    }, 5000);
    forceExitTimeout.unref();

    if (serverForGraceful && serverForGraceful.listening) {
        serverForGraceful.close(() => {
            mongoose.disconnect().then(() => {
                process.exit(0);
            });
        });
    } else {
        mongoose.disconnect().then(() => process.exit(0));
    }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

if (require.main === module) {
    startServer();
}

module.exports = server;
module.exports.startServer = startServer;
