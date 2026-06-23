// Restarted to apply AUTHZ_BYPASS and file logging changes (V2).
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Core imports
const express = require('express'); 
// CORE APP REFRESH - FORCED RELOAD
const cors = require('cors');
const mongoose = require('mongoose');
// Triggering restart for .env changes
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { renderShell } = require('./utils/ssrShell');
const { buildCorsOptions, shouldTrustProxy } = require('./config/security.config');
const authJwt = require('./middleware/auth.jwt');

function readBooleanEnv(value, fallback = false) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function resolveFrontendDistDir() {
    const configuredDistDir = process.env.FRONTEND_DIST_DIR
        ? path.resolve(__dirname, process.env.FRONTEND_DIST_DIR)
        : null;
    const candidateDirs = [
        configuredDistDir,
        path.resolve(__dirname, 'dist'),
        path.resolve(__dirname, '..', 'client', 'dist'),
    ].filter(Boolean);

    return candidateDirs.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || null;
}

function resolveFaceModelDir() {
    const configuredModelDir = process.env.FACE_MODEL_STATIC_DIR
        ? path.resolve(__dirname, process.env.FACE_MODEL_STATIC_DIR)
        : null;
    const candidateDirs = [
        configuredModelDir,
        path.resolve(__dirname, 'public', 'models'),
        path.resolve(__dirname, '..', 'client', 'dist', 'models'),
        path.resolve(__dirname, '..', 'client', 'public', 'models'),
    ].filter(Boolean);

    return candidateDirs.find((dir) =>
        fs.existsSync(path.join(dir, 'tiny_face_detector_model-weights_manifest.json')) &&
        fs.existsSync(path.join(dir, 'face_recognition_model-weights_manifest.json')) &&
        fs.existsSync(path.join(dir, 'face_landmark_68_model-weights_manifest.json'))
    ) || null;
}

const clientDistDir = resolveFrontendDistDir();
const faceModelDir = resolveFaceModelDir();
const hasClientDist = Boolean(clientDistDir);
const debugRoutesEnabled =
    String(process.env.ENABLE_DEBUG_ROUTES || '').trim().toLowerCase() === 'true';

// Express app
const app = express();

app.use((req, res, next) => {
    if (req.url.includes('tax-profile') || req.url.includes('referral/register')) {
        console.log(`[ABSOLUTE_DEBUG] ${req.method} ${req.url}`);
    }
    next();
});

app.use((req, res, next) => {
    // console.log(`[ACCESS] ${req.method} ${req.originalUrl}`);
    next();
});

app.set("trust proxy", shouldTrustProxy() ? 1 : false);

// Clean req.ip by stripping port numbers (specifically on Windows / IIS environments / reverse proxies)
app.use((req, res, next) => {
    let rawIp = req.ip;
    if (!rawIp) {
        rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    }
    if (rawIp && typeof rawIp === 'string') {
        let cleanedIp = rawIp.trim();
        // If there's a list of IPs in x-forwarded-for, take the first one
        if (cleanedIp.includes(',')) {
            cleanedIp = cleanedIp.split(',')[0].trim();
        }
        if (cleanedIp.includes(':')) {
            const parts = cleanedIp.split(':');
            if (parts.length === 2) {
                // IPv4 with port, e.g. 106.214.112.200:63323
                cleanedIp = parts[0];
            } else if (cleanedIp.startsWith('[') && cleanedIp.includes(']:')) {
                // IPv6 with port, e.g. [::1]:63323
                cleanedIp = cleanedIp.slice(1, cleanedIp.lastIndexOf(']'));
            }
        }
        Object.defineProperty(req, 'ip', {
            value: cleanedIp,
            writable: true,
            configurable: true
        });
    }
    next();
});

// Security Middleware Module
const setupSecurity = require('./middleware/security.middleware');
const isProduction = process.env.NODE_ENV === 'production';
const shouldServeClientDist = hasClientDist; // Always serve dist if it exists, even in dev mode if the user wants it.

app.locals.clientDistDir = clientDistDir;
app.locals.hasClientDist = hasClientDist;
app.locals.shouldServeClientDist = shouldServeClientDist;

// Request Logging Middleware
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        const start = Date.now();
    }
    next();
});

/* ===============================
   CORS CONFIGURATION
================================ */
const corsOptions = {
    ...buildCorsOptions(),
    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* ===============================
   SECURITY SETUP
================================ */
setupSecurity(app);

/* ===============================
   SECURITY MIDDLEWARES
================================ */
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// helmet is already configured in setupSecurity(app) above.

// Apply Rate Limiting to prevent Brute Force/DDoS attacks
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50000, // Increased significantly for dev stability
    message: "Too many requests from this IP, please try again later."
});

app.use('/api/', apiLimiter);

/* ===============================
   SET UP LOGGER
================================ */
const util = require('util');
const logFile = path.join(__dirname, 'terminal.log');
const originalLog = console.log;
const originalInfo = console.info;
const originalDebug = console.debug;
const originalWarn = console.warn;
const originalError = console.error;
const enableApiRequestLogs = String(process.env.ENABLE_API_REQUEST_LOGS || '').toLowerCase() === 'true';
const enableFileLogs = readBooleanEnv(process.env.ENABLE_FILE_LOGS, false);
const enableTerminalLogs = String(process.env.ENABLE_TERMINAL_LOGS || '').toLowerCase() === 'true';

const safeFormat = (args) => {
    try {
        return args.map(a => typeof a === 'object' ? util.inspect(a) : String(a)).join(' ');
    } catch (e) { return '[Unserializable]'; }
};

const appendTerminalLog = (level, args) => {
    if (!enableFileLogs) return;
    try {
        fs.appendFileSync(logFile, `[${level}][${new Date().toISOString()}] ${safeFormat(args)}\n`);
    } catch (e) { }
};

console.log = (...args) => {
    appendTerminalLog('LOG', args);
    if (enableTerminalLogs) originalLog(...args);
};
console.info = (...args) => {
    appendTerminalLog('INF', args);
    if (enableTerminalLogs) originalInfo(...args);
};
console.debug = (...args) => {
    appendTerminalLog('DBG', args);
    if (enableTerminalLogs) originalDebug(...args);
};
console.warn = (...args) => {
    appendTerminalLog('WRN', args);
    if (enableTerminalLogs) originalWarn(...args);
};
console.error = (...args) => {
    appendTerminalLog('ERR', args);
    originalError(...args);
};

// Request Logging Middleware
app.use((req, res, next) => {
    if (enableApiRequestLogs && req.path.startsWith('/api')) {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            console.log(`[GLOBAL_API_LOG] ${req.method} ${req.path} | Status: ${res.statusCode} | Duration: ${duration}ms`);
        });
    }
    next();
});

/* ===============================
   BODY PARSERS & LOGGING
================================ */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

/* ===============================
   REGISTER MODELS (Global)
================================ */
try {
    try {
        if (!mongoose.models.Tenant) {
            mongoose.model('Tenant', require('./models/Tenant').schema || require('./models/Tenant'));
        }
    } catch (_) { }

    mongoose.model('Notification', require('./models/Notification'));
    mongoose.model('LeaveRequest', require('./models/LeaveRequest'));
    mongoose.model('ExitRequest', require('./models/ExitRequest'));
    mongoose.model('Regularization', require('./models/Regularization'));
    mongoose.model('Applicant', require('./models/Applicant'));
    mongoose.model('Requirement', require('./models/Requirement'));
    mongoose.model('Position', require('./models/Position'));
    mongoose.model('Candidate', require('./models/Candidate'));
    mongoose.model('Interview', require('./models/Interview'));
    mongoose.model('TrackerCandidate', require('./models/TrackerCandidate'));
    mongoose.model('CandidateStatusLog', require('./models/CandidateStatusLog'));
    mongoose.model('Ticket', require('./models/Ticket'));
    mongoose.model('PayrollAdjustment', require('./models/PayrollAdjustment'));
    mongoose.model('SalaryStructure', require('./models/SalaryStructure'));
    mongoose.model('Employee', require('./models/Employee'));
    mongoose.model('Attendance', require('./models/Attendance'));
    mongoose.model('Department', require('./models/Department'));
    mongoose.model('LeaveBalance', require('./models/LeaveBalance'));
    mongoose.model('LeavePolicy', require('./models/LeavePolicy'));
    mongoose.model('HolidayGroup', require('./models/HolidayGroup'));
    mongoose.model('LeaveType', require('./models/LeaveType'));
    mongoose.model('AuditLog', require('./models/AuditLog'));
    mongoose.model('BGVCase', require('./models/BGVCase'));
    mongoose.model('BGVCheck', require('./models/BGVCheck'));
    mongoose.model('BGVDocument', require('./models/BGVDocument'));
    mongoose.model('BGVTimeline', require('./models/BGVTimeline'));
    mongoose.model('BGVReport', require('./models/BGVReport'));
    mongoose.model('ReplacementRequest', require('./models/ReplacementRequest'));
    mongoose.model('User', require('./models/User'));
    mongoose.model('Role', require('./models/Role'));
    mongoose.model('OnboardingSubmission', require('./models/OnboardingSubmission'));
    mongoose.model('EmployeeCompensation', require('./models/EmployeeCompensation'));
    mongoose.model('SalaryAssignment', require('./models/SalaryAssignment'));
    mongoose.model('SalaryTemplate', require('./models/SalaryTemplate'));
    mongoose.model('Band', require('./models/Band'));
    mongoose.model('DesignationGradeMap', require('./models/DesignationGradeMap'));
    mongoose.model('PromotionHistory', require('./models/PromotionHistory'));
    mongoose.model('SalaryComponent', require('./models/SalaryComponent'));
    mongoose.model('DeductionMaster', require('./models/DeductionMaster'));
    mongoose.model('BenefitComponent', require('./models/BenefitComponent'));
    mongoose.model('EmployeeSalarySnapshot', require('./models/EmployeeSalarySnapshot'));
    mongoose.model('CompanyPayrollRule', require('./models/CompanyPayrollRule'));
    mongoose.model('MinimumWage', require('./models/MinimumWage'));
    mongoose.model('EmployeePayrollProfile', require('./models/EmployeePayrollProfile'));
    mongoose.model('EmployeeCtcVersion', require('./models/EmployeeCtcVersion'));
    mongoose.model('EmployeeTaxProfile', require('./models/EmployeeTaxProfile'));
    mongoose.model('EmailTemplate', require('./models/EmailTemplate'));
    mongoose.model('Automation', require('./models/Automation'));
    require('./models/social/Music');
    try {
        mongoose.model('PermissionAudit', require('./models/PermissionAudit'));
    } catch (_) { }
    try {
        mongoose.model('SidebarModule', require('./models/SidebarModule'));
        mongoose.model('SidebarPage', require('./models/SidebarPage'));
    } catch (_) { }
} catch (e) { }

/* ===============================
   ROUTES IMPORT
================================ */
const authRoutes = require('./routes/auth.routes');
const tenantRoutes = require('./routes/tenant.routes');
const companyRoutes = require('./routes/company.routes');
const groupRoutes = require('./routes/group.routes');
const activityRoutes = require('./routes/activity.routes');
const uploadRoutes = require('./routes/upload.routes');
const hrRoutes = require('./routes/hr.routes');
const psaHrRoutes = require('./routes/psa.hr.routes');
const employeeRoutes = require('./routes/employee.routes');
const requirementRoutes = require('./routes/requirement.routes');
const publicRoutes = require('./routes/public.routes');
const notificationRoutes = require('./routes/notification.routes');
const commentRoutes = require('./routes/comment.routes');
const entityRoutes = require('./routes/entity.routes');
const holidayRoutes = require('./routes/holiday.routes');
const holidayGroupRoutes = require('./routes/holidayGroup.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const faceAttendanceRoutes = require('./routes/faceAttendance.routes');
const locationRoutes = require('./routes/location.routes');
const attendancePolicyRoutes = require('./routes/attendancePolicy.routes');
const letterRoutes = require('./routes/letter.routes');
const shiftMasterRoutes = require('./routes/shiftMaster.routes');
const shiftAssignmentRoutes = require('./routes/shiftAssignment.routes');
const offerTemplateRoutes = require('./routes/offerTemplate.routes');
const payslipTemplateRoutes = require('./routes/payslipTemplate.routes');
const payrollRoutes = require('./routes/payroll.routes');
const deductionRoutes = require('./routes/deduction.routes');
const salaryStructureRoutes = require('./routes/salaryStructure.routes');
const payrollRuleRoutes = require('./routes/payrollRule.routes');
const salaryRevisionRoutes = require('./routes/salaryRevision.routes');
const compensationRoutes = require('./routes/compensation.routes');
const payrollAdjustmentRoutes = require('./routes/payrollAdjustment.routes');
const companyIdConfigRoutes = require('./routes/companyIdConfig.routes');
const idConfigRoutes = require('./routes/idConfig.routes');
const positionRoutes = require('./routes/position.routes');
const gradeRoutes = require('./routes/grade.routes');
const gradeBandRoutes = require('./routes/gradeBand.routes');

const careerOptimizedRoutes = require('./routes/career-optimized.routes');
const aiRoutes = require('./routes/ai.routes');
const systemRoutes = require('./routes/system.routes');
const secureRoutes = require('./routes/secure.routes');
const securityProxyRoutes = require('./routes/securityProxy.routes');
const announcementRoutes = require('./routes/announcement.routes');
const zohoLeavePolicyRoutes = require('./routes/zohoLeavePolicy.routes');
const zohoLeaveRequestRoutes = require('./routes/zohoLeaveRequest.routes');
const onboardingRoutes = require('./routes/onboarding.routes');
const onboardingWorkflowRoutes = require('./routes/onboardingWorkflow.routes');
const diagRoutes = require('./routes/diagnostic.routes');
const enterpriseRoutes = require('./routes/enterprise.routes');
const roleRoutes = require('./routes/role.routes');
const socialMediaRoutes = require('./routes/socialMedia.routes');
const socialMediaEnterpriseRoutes = require('./modules/social-media-enterprise/routes/social.routes');
const realtimeSocialPostRoutes = require('./modules/realtime-social-analytics/routes/post.routes');
const socialTemplateRoutes = require('./routes/socialTemplate.routes');
const musicRoutes = require('./routes/music.routes');
const workflowRoutes = require('./routes/workflow.routes');
const emailTemplateRoutes = require('./routes/emailTemplate.routes');
const automationRoutes = require('./routes/automation.routes');
const demoDataRoutes = require('./routes/demoData.routes');
app.use((req, res, next) => {
    // console.log(`[ACCESS] ${req.method} ${req.originalUrl}`);
    next();
});

/* ===============================
   ROUTES (NO TENANT)
================================ */
app.get('/api/test-404', (req, res) => {
    res.json({ message: "If you see this, /api/test-404 is working!", tenantId: req.tenantId });
});

app.get('/api/routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
        if (middleware.route) { // routes registered directly on the app
            routes.push(middleware.route.path);
        } else if (middleware.name === 'router') { // router middleware 
            middleware.handle.stack.forEach((handler) => {
                const route = handler.route;
                route && routes.push(route.path);
            });
        }
    });
    res.json(routes);
});

app.get('/api/health', (_req, res) => {
    console.log('[DEBUG] Health check handler hit');
    res.json({ status: 'ok', timestamp: new Date().toISOString(), message: "HRMS Backend Healthy", version: "FIX_AI_CHECK_V1" });
});

if (faceModelDir) {
    const faceModelStatic = express.static(faceModelDir, {
        index: false,
        etag: true,
        maxAge: '7d',
        immutable: true,
        fallthrough: false,
        setHeaders: (res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        },
    });

    app.use('/api/face-attendance/models', faceModelStatic);
    app.use('/models', faceModelStatic);
}

app.get('/api/assets/image-proxy', async (req, res) => {
    try {
        const rawUrl = String(req.query.url || '').trim();
        if (!rawUrl) {
            return res.status(400).json({ success: false, message: 'Image URL is required.' });
        }

        let targetUrl;
        try {
            targetUrl = new URL(rawUrl);
        } catch (_) {
            return res.status(400).json({ success: false, message: 'Invalid image URL.' });
        }

        const isAllowedCloudinaryImage =
            ['http:', 'https:'].includes(targetUrl.protocol) &&
            targetUrl.hostname.toLowerCase() === 'res.cloudinary.com' &&
            targetUrl.pathname.includes('/image/upload/');

        if (!isAllowedCloudinaryImage) {
            return res.status(400).json({ success: false, message: 'Image host is not allowed.' });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const upstream = await fetch(targetUrl.toString(), {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'GT-HRMS-Asset-Proxy/1.0'
            }
        });
        clearTimeout(timeoutId);

        if (!upstream.ok) {
            return res.status(upstream.status).json({ success: false, message: 'Image fetch failed.' });
        }

        const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
        if (!contentType.toLowerCase().startsWith('image/')) {
            return res.status(415).json({ success: false, message: 'Unsupported asset type.' });
        }

        const body = Buffer.from(await upstream.arrayBuffer());
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(body);
    } catch (error) {
        const status = error?.name === 'AbortError' ? 504 : 502;
        return res.status(status).json({ success: false, message: 'Unable to proxy image.' });
    }
});

app.get('/api/assets/map-tile/:style/:z/:x/:y', async (req, res) => {
    const { style } = req.params;
    const z = Number.parseInt(req.params.z, 10);
    const x = Number.parseInt(req.params.x, 10);
    const rawY = String(req.params.y || '').replace(/\.(png|jpg|jpeg|webp)$/i, '');
    const y = Number.parseInt(rawY, 10);

    if (![z, x, y].every(Number.isInteger) || z < 0 || z > 22 || x < 0 || y < 0) {
        return res.status(400).json({ success: false, message: 'Invalid map tile coordinates.' });
    }

    const subdomains = ['a', 'b', 'c', 'd'];
    const subdomain = subdomains[Math.abs(x + y) % subdomains.length];
    const tileProviders = {
        'carto-light': {
            url: `https://${subdomain}.basemaps.cartocdn.com/light_nolabels/${z}/${x}/${y}.png`,
            attribution: 'CARTO, OpenStreetMap',
            maxNativeZoom: 20
        },
        'carto-voyager': {
            url: `https://${subdomain}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
            attribution: 'CARTO, OpenStreetMap',
            maxNativeZoom: 20
        },
        'esri-imagery': {
            url: `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
            attribution: 'Esri Satellite',
            maxNativeZoom: 19
        }
    };

    const provider = tileProviders[String(style || '').toLowerCase()];
    if (!provider || z > provider.maxNativeZoom + 2) {
        return res.status(404).json({ success: false, message: 'Map tile provider not found.' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
        const upstream = await fetch(provider.url, {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'User-Agent': 'GT-HRMS-Map-Tile-Proxy/1.0'
            }
        });
        clearTimeout(timeoutId);

        if (!upstream.ok) {
            return res.status(upstream.status).json({ success: false, message: 'Map tile fetch failed.' });
        }

        const contentType = upstream.headers.get('content-type') || 'image/png';
        if (!contentType.toLowerCase().startsWith('image/')) {
            return res.status(415).json({ success: false, message: 'Unsupported map tile type.' });
        }

        const body = Buffer.from(await upstream.arrayBuffer());
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        res.setHeader('X-Map-Tile-Provider', provider.attribution);
        return res.send(body);
    } catch (error) {
        clearTimeout(timeoutId);
        const status = error?.name === 'AbortError' ? 504 : 502;
        return res.status(status).json({ success: false, message: 'Unable to load map tile.' });
    }
});

if (debugRoutesEnabled) {
    app.get('/api/debug-comp', authJwt.authenticate, authJwt.requirePsa, async (req, res) => {
        try {
            const getTenantDB = require('./utils/tenantDB');
            const Tenant = mongoose.model('Tenant');
            const tenants = await Tenant.find({});
            const results = [];
            for (let t of tenants) {
                try {
                    const tDb = await getTenantDB(t._id.toString());
                    const Employee = tDb.model('Employee', require('./models/Employee'));
                    const EmployeeCompensation = tDb.model('EmployeeCompensation', require('./models/EmployeeCompensation'));
                    const emps = await Employee.find({ firstName: /Iva/i });
                    for (let e of emps) {
                        const comp = await EmployeeCompensation.findOne({ employeeId: e._id });
                        results.push({ tenant: t.code, employee: e.firstName, compensation: comp });
                    }
                } catch (_error) { }
            }
            res.json(results);
        } catch (err) {
            res.json({ error: err.message });
        }
    });

    app.get('/api/debug-dash', async (req, res) => {
        const candidateCtrl = require('./controllers/candidate.controller');
        req.candidate = { tenantId: '69d626068560596a949a0010', id: '69dcecbd2d0116ce9ac722d1', role: 'candidate' };
        await candidateCtrl.getCandidateDashboard(req, res);
    });
}

/* ===============================
   TENANT MIDDLEWARE
================================ */
const tenantResolver = require('./middleware/tenant.middleware');
const tenantMiddleware = tenantResolver;
const wrapAsync = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

app.use('/api', wrapAsync(tenantMiddleware));

/* ===============================
   CORE API ROUTES (Consolidated & Ordered)
================================ */
const checkModuleAccess = require('./middleware/moduleAccess.middleware');
const auth = authJwt.authenticate;
const payrollCheck = checkModuleAccess('payroll');
const attendanceCheck = checkModuleAccess('attendance');
const onboardingCheck = checkModuleAccess('onboarding');
const hrCheck = checkModuleAccess('hr');
const bgvCheck = checkModuleAccess('backgroundVerification');
const documentMgmtCheck = checkModuleAccess('documentManagement');
const recruitmentCheck = checkModuleAccess('recruitment');
const activeEmployeeCheck = require('./middleware/requireActiveEmployee');
const { checkPermission } = require('./middleware/rbac.middleware');

// 0. Public Routes (UNPROTECTED)
app.use('/api/public', publicRoutes);
app.use('/api/public', require('./routes/publicCandidate.routes'));
app.use('/api/public/careers', require('./routes/publicCareer.routes'));
app.use('/api/public/offer', require('./routes/public.offer.routes'));
app.use('/api/public/candidate-documents', require('./routes/publicCandidateDocument.routes'));

// 1. Auth & System (Foundation)
app.use('/api/auth', authRoutes);
app.get('/api/auth/me', auth, require('./controllers/auth.controller').getSsoMe);
app.get('/api/auth/csrf-token', require('./middleware/csrf.middleware').issueCsrfToken);
app.use('/api/system', systemRoutes);
app.use('/api/secure', secureRoutes);
app.use('/api/security', securityProxyRoutes);
app.use('/api/enterprise', enterpriseRoutes);
app.use('/api/social-media', socialMediaRoutes);
app.use('/api/social-media-enterprise', socialMediaEnterpriseRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/attendance-policies', attendancePolicyRoutes);
app.use('/api/shift-master', shiftMasterRoutes);
app.use('/api/shift-assignment', shiftAssignmentRoutes);
app.use('/api/offer-templates', offerTemplateRoutes);
app.use('/api/social-media-enterprise', socialMediaEnterpriseRoutes);
app.use('/api', realtimeSocialPostRoutes);
app.use('/api/email-templates', emailTemplateRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/social-templates', socialTemplateRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/roles', auth, roleRoutes);

// 2. Tenant & Company Management
app.use('/api/tenants', auth, tenantRoutes);
app.use('/api/companies', auth, tenantRoutes);
app.use('/api/group', auth, groupRoutes);
app.use('/api/company', auth, companyRoutes);
app.use('/api/superadmin', auth, require('./routes/superadmin.routes'));
app.use('/api/activities', auth, activityRoutes);
app.use('/api/organization', auth, require('./routes/organization.routes'));
app.use('/api/hierarchy', auth, require('./routes/hierarchy.routes'));
app.use('/api/email-templates', auth, require('./routes/emailTemplate.routes'));
app.use('/api/automations', auth, require('./routes/automation.routes'));
app.use('/api/workflows', auth, workflowRoutes);
app.use('/api/demo-data', demoDataRoutes);

// 3. Attendance & Shifts (Order Specific routes first)
app.use('/api/shift-master', auth, attendanceCheck, require('./routes/shiftMaster.routes'));
app.use('/api/attendance/shifts', auth, attendanceCheck, require('./routes/shift.routes'));
app.use('/api/shifts', auth, attendanceCheck, require('./routes/shift.routes'));
app.use('/api/shift-master', shiftMasterRoutes);
app.use('/api/shift-assignment', shiftAssignmentRoutes);
app.use('/api/roster', auth, require('./routes/roster.routes'));
app.use('/api/enterprise-roster', auth, require('./routes/enterpriseRoster.routes'));
app.use('/api/swaps', auth, require('./routes/swap.routes'));
app.use('/api/audit-logs', auth, require('./routes/auditLog.routes'));
app.use('/api/shift-analytics', auth, require('./routes/shiftAnalytics.routes'));
app.use('/api/attendance-policy', auth, attendanceCheck, attendancePolicyRoutes);
app.use('/api/location', auth, attendanceCheck, locationRoutes);
app.use('/api/holidays', auth, attendanceCheck, holidayRoutes);
app.use('/api/holiday-groups', auth, attendanceCheck, holidayGroupRoutes);
app.use('/api/face-attendance', auth, attendanceCheck, activeEmployeeCheck, faceAttendanceRoutes);
app.use('/api/attendance', auth, attendanceCheck, activeEmployeeCheck, attendanceRoutes);

// 4. Payroll & Salary
app.use('/api/salary', auth, payrollCheck, activeEmployeeCheck, require('./routes/salary.routes'));
app.use('/api/payroll/corrections', auth, payrollCheck, activeEmployeeCheck, payrollAdjustmentRoutes);
app.use('/api/payroll', auth, payrollCheck, activeEmployeeCheck, payrollRoutes);
app.use('/api/compensation', auth, payrollCheck, activeEmployeeCheck, compensationRoutes);
app.use('/api/salary-structure', auth, payrollCheck, activeEmployeeCheck, salaryStructureRoutes);
app.use('/api/payslip-templates', auth, payrollCheck, activeEmployeeCheck, payslipTemplateRoutes);
app.use('/api/payroll-rules', auth, payrollCheck, activeEmployeeCheck, payrollRuleRoutes);

// 5. HR & Employee Management
app.use('/api/letters', auth, hrCheck, documentMgmtCheck, letterRoutes);
app.use('/api/exit', auth, hrCheck, require('./routes/exit.routes'));
app.use('/api/candidate', require('./routes/candidate.routes')); 
app.use(['/api/employee', '/api/employees'], auth, employeeRoutes);
app.use('/api/bgv', auth, hrCheck, bgvCheck, require('./routes/bgv.routes'));
app.use('/api/entities', auth, hrCheck, entityRoutes);
app.use('/api/positions', auth, hrCheck, positionRoutes);
app.use('/api/grades', auth, hrCheck, gradeRoutes);
app.use('/api/grade-band', auth, hrCheck, gradeBandRoutes);
app.use('/api/zoho-leave-policies', zohoLeavePolicyRoutes);
app.use('/api/zoho-leaves', zohoLeaveRequestRoutes);
app.use('/api', auth, hrRoutes); // Mount general HR routes last within /api

// 6. Recruitment & Hiring
app.use('/api/admin', auth, recruitmentCheck, require('./routes/admin.hiring.routes'));
app.use('/api/applications', auth, recruitmentCheck, require('./routes/applications.routes'));
app.use('/api/recruitment', auth, recruitmentCheck, require('./routes/recruitment.workflow.routes'));
app.use('/api/recruitment/candidate-documents', auth, recruitmentCheck, require('./routes/hr.candidateDocuments.routes'));
app.use('/api/offer-templates', auth, recruitmentCheck, offerTemplateRoutes);
app.use('/api/interviews', auth, recruitmentCheck, require('./routes/interview.routes'));
app.use('/api/tracker', auth, recruitmentCheck, require('./routes/tracker.routes'));
app.use('/api/requirements', auth, recruitmentCheck, requirementRoutes);
app.use('/api/manpower-requisition', auth, require('./routes/manpowerRequisition.routes'));
app.use('/api', auth, recruitmentCheck, require('./routes/feedback.routes'));
app.use('/api/job-portal', require('./routes/jobPortal.routes'));
app.use('/api/career', (req, res, next) => {
    if (req.path.startsWith('/public/') || req.path.startsWith('/public-customization/')) return next();
    return recruitmentCheck(req, res, next);
}, careerOptimizedRoutes);
app.use('/api/onboarding-suite', auth, onboardingCheck, require('./modules/onboarding-suite').createOnboardingSuiteRouter({
    authorizeAdmin: checkPermission('onboarding.dashboard', 'edit')
}));
app.use('/api/onboarding', auth, onboardingRoutes);
app.use('/api/onboarding-workflow', auth, onboardingWorkflowRoutes);

// 7. General Services
app.use('/api/announcements', auth, announcementRoutes);
app.use('/api/notifications', auth, notificationRoutes);
app.use('/api/comments', auth, commentRoutes);
app.use('/api/tickets', auth, require('./routes/ticket.routes'));
app.use('/api/tasks', auth, require('./routes/task.routes'));
app.use('/api/deductions', auth, require('./routes/deduction.routes'));
app.use('/api/replacements', auth, require('./routes/replacement.routes'));
app.use('/api/reports', auth, require('./routes/report.routes'));
app.use('/api/ai', auth, aiRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/diag', diagRoutes);
app.use('/api/upload', diagRoutes);
app.use('/api/id-config', auth, idConfigRoutes);
app.use('/api/company-id-config', auth, companyIdConfigRoutes);

// Legacy/Compatibility Prefixes
const hrmsPrefix = '/api/hrms';
app.use(hrmsPrefix, auth, hrRoutes);
app.use(hrmsPrefix + '/payroll', auth, payrollRoutes);
app.use(hrmsPrefix + '/attendance', auth, attendanceRoutes);

// Catch-all for API (404)
app.use('/api', (req, res) => {
    console.warn(`[404_API_CAUGHT] Method: ${req.method} URL: ${req.originalUrl} Headers:`, req.headers);
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found on this server.` });
});

const uploadsDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir, {
    dotfiles: 'deny',
    fallthrough: false,
    index: false,
    setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (filePath.endsWith('.pdf')) {
            res.setHeader('Content-Security-Policy', "frame-ancestors *");
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.removeHeader('X-Frame-Options');
        }
    },
}));
/* ===============================
   FRONTEND DIST SERVE (VERY IMPORTANT 🔥)
================================ */
if (shouldServeClientDist) {
    app.use(express.static(clientDistDir, {
        index: false,
        etag: true,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('index.html')) {
                res.setHeader('Cache-Control', 'no-store');
            }
        },
    }));
}

// Catch-all for non-existent paths (ROOT & IIS Fallback)
app.get(['/', '/server.js'], (_req, res) => {
    if (shouldServeClientDist) {
        return res.sendFile(path.join(clientDistDir, 'index.html'));
    }

    if (process.env.NODE_ENV === 'production' || process.env.SERVE_CLIENT_DIST === 'true') {
        return res.send(`
            <div style="font-family: sans-serif; padding: 40px; text-align: center;">
                <h2 style="color: #e11d48;">Frontend Dist Missing</h2>
                <p>Backend is active. To serve the frontend UI on live, place the built <b>client/dist</b> folder inside the <b>server</b> directory.</p>
                <p>Path should be: <code>${path.join(__dirname, 'dist')}</code></p>
            </div>
        `);
    }

    res.send('HRMS Backend Running (Refactored) - Dev Mode');
});

if (shouldServeClientDist) {
    app.get(/^\/(?!api(?:\/|$)|uploads(?:\/|$)|socket\.io(?:\/|$)).*/, (_req, res) => {
        res.sendFile(path.join(clientDistDir, 'index.html'));
    });
} else {
    // Catch-all for any other frontend routes when dist is missing
    app.get(/^\/(?!api(?:\/|$)|uploads(?:\/|$)|socket\.io(?:\/|$)).*/, (_req, res) => {
        res.status(404).send('Frontend UI not found. Please deploy the dist folder.');
    });
}

app.use((err, req, res, next) => {
    const statusCode = err.status || 500;
    const message = err.message || 'Internal Server Error';
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
        return res.status(statusCode).json({
            success: false,
            error: err.code || 'server_error',
            message: statusCode === 500 ? 'An unexpected error occurred.' : message
        });
    }

    res.status(statusCode).json({
        success: false,
        error: err.code || 'server_error',
        message: message,
        stack: err.stack
    });
});

const errorMiddleware = require('./middleware/error.middleware');
app.use(errorMiddleware);

module.exports = app;
