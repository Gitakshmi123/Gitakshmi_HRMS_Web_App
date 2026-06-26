const CompanyIdConfigController = require('./companyIdConfig.controller');
const axios = require('axios');

const isDuplicatePositionIdError = (error) => (
    error?.code === 11000
    && (error?.keyPattern?.positionId || error?.keyValue?.positionId)
);

/**
 * Resolve the DMS company ID for a given HRMS tenant.
 *
 * MULTI-COMPANY SUPPORT:
 * Each HRMS Company record has a `dmsCompanyId` field that maps it to the
 * corresponding DMS company. This ensures:
 *   - Gitakshmi HRMS Company → Gitakshmi DMS Company
 *   - ABC Corp HRMS Company  → ABC Corp DMS Company
 *
 * Fallback: DMS_DEFAULT_COMPANY_ID env var (for backward compatibility)
 */
async function resolveDmsCompanyIdForTenant(tenantDB) {
    try {
        const Company = tenantDB.model('Company');
        const company = await Company.findOne({}).select('name dmsCompanyId').lean();
        if (company?.dmsCompanyId) {
            return company.dmsCompanyId;
        }
        return process.env.DMS_DEFAULT_COMPANY_ID || process.env.DMS_COMPANY_ID || null;
    } catch (err) {
        console.warn('[DMS Sync] Could not resolve dmsCompanyId:', err.message);
        return process.env.DMS_DEFAULT_COMPANY_ID || process.env.DMS_COMPANY_ID || null;
    }
}

/**
 * Notify DMS to create a folder for a newly created hiring position.
 * Fire-and-forget — uses company-specific dmsCompanyId for multi-company support.
 */
async function notifyDmsCreatePositionFolder(position, tenantDB) {
    try {
        const dmsUrl = process.env.DMS_URL;
        const dmsToken = process.env.DMS_SECURE_TOKEN;
        const dmsCompanyId = tenantDB
            ? await resolveDmsCompanyIdForTenant(tenantDB)
            : (process.env.DMS_DEFAULT_COMPANY_ID || process.env.DMS_COMPANY_ID);
        
        if (!dmsUrl || !dmsToken) {
            console.warn('[DMS Sync] DMS_URL or DMS_SECURE_TOKEN not configured. Skipping position folder creation.');
            return;
        }

        if (!dmsCompanyId) {
            console.warn('[DMS Sync] No DMS company ID found. Set dmsCompanyId on company or DMS_DEFAULT_COMPANY_ID in .env');
            return;
        }

        const payload = {
            companyId: dmsCompanyId,
            positionId: position.positionId || String(position._id),
            positionName: position.jobTitle || position.designation || position.positionId,
            metadata: {
                department: position.department || '',
                hrmsPositionId: String(position._id),
                tenant: String(position.tenant || ''),
            }
        };

        console.log(`[DMS Sync] Creating folder for position: ${payload.positionId} - "${payload.positionName}" → DMS company: ${dmsCompanyId}`);

        const response = await axios.post(
            `${dmsUrl}/api/v1/hrms/hiring/positions`,
            payload,
            {
                headers: {
                    'x-hrms-secure-token': dmsToken,
                    'Content-Type': 'application/json'
                },
                timeout: parseInt(process.env.DMS_TIMEOUT_MS || '30000')
            }
        );

        console.log(`[DMS Sync] Position folder created successfully. Folder ID: ${response.data?.data?.positionFolderId}`);
    } catch (err) {
        // Non-fatal: log but don't block HRMS
        const errMsg = err?.response?.data?.message || err?.response?.data?.error || err.message;
        console.error(`[DMS Sync] Failed to create position folder in DMS: ${errMsg}`);
    }
}

exports.createPosition = async (req, res) => {
    const traceId = `pos_create_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    // console.log(`[${traceId}] CreatePosition Hit: ${req.originalUrl}`);
    try {
        if (!req.tenantDB) {
            const getTenantDB = require('../utils/tenantDB');
            req.tenantDB = await getTenantDB(req.tenantId);
        }
        const tenantId = req.tenantDB.tenantId; // Use resolved ID
        const Position = req.tenantDB.model('Position');

        const cleanBody = { ...req.body };
        ['reportingTo', 'departmentId', 'replacedEmployee'].forEach(field => {
            if (cleanBody[field] === '') delete cleanBody[field];
        });

        let position = null;
        let lastGeneratedId = null;
        for (let attempt = 1; attempt <= 20; attempt += 1) {
            const idResult = await CompanyIdConfigController.generateIdInternal({
                tenantId,
                entityType: 'POS',
                increment: true
            });
            lastGeneratedId = idResult.id;

            try {
                position = await Position.create({
                    ...cleanBody,
                    tenant: tenantId,
                    positionId: idResult.id
                });
                break;
            } catch (error) {
                if (!isDuplicatePositionIdError(error) || attempt === 20) {
                    throw error;
                }
                console.warn(`[${traceId}] Position ID collision for ${idResult.id}; retrying with next counter (${attempt}/20).`);
            }
        }

        if (!position) {
            throw new Error(`Unable to generate a unique Position ID after retries. Last generated: ${lastGeneratedId || 'none'}`);
        }

        // 🔗 Notify DMS to create a folder for this position (non-blocking, multi-company aware)
        notifyDmsCreatePositionFolder(position, req.tenantDB).catch(() => {});

        res.status(201).json({
            success: true,
            data: position,
            message: "Position created successfully",
            DEBUG_TRACE_ID: traceId
        });

    } catch (error) {
        // DEBUG LOGGING
        try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(__dirname, '../debug_error.log');
            const logData = `[${new Date().toISOString()}] CreatePosition Error: ${error.message}\nStack: ${error.stack}\nBody: ${JSON.stringify(req.body)}\nTenant: ${req.tenantDB?.tenantId}\n\n`;
            fs.appendFileSync(logPath, logData);
        } catch (filesysError) {
            console.error("Logging failed:", filesysError);
        }

        console.error("Error creating position:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.getPositions = async (req, res) => {
    try {
        // Defensive Check
        if (!req.tenantId) {
            console.error('[PositionController] Tenant ID missing');
            return res.status(400).json({ success: false, message: 'Tenant Context Missing (No Tenant ID)' });
        }
        if (!req.tenantDB) {
            console.error('[PositionController] Tenant DB missing');
            // Attempt to resolve DB if missing (fallback)
            try {
                const getTenantDB = require('../utils/tenantDB');
                req.tenantDB = await getTenantDB(req.tenantId);
            } catch (e) {
                return res.status(500).json({ success: false, message: 'Tenant Database Connection Failed' });
            }
        }

        const Position = req.tenantDB.model('Position');
        const positions = await Position.find({ tenant: req.tenantDB?.tenantId })
            // .populate('reportingTo', 'firstName lastName') // Cross-connection population risk
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: positions });
    } catch (error) {
        console.error('[PositionController] Error:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

exports.getPositionById = async (req, res) => {
    try {
        if (!req.tenantDB) return res.status(500).json({ message: "DB Context Missing" });
        const tenantId = req.tenantDB.tenantId;
        const Position = req.tenantDB.model('Position');

        const position = await Position.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('reportingTo', 'firstName lastName');

        if (!position) return res.status(404).json({ success: false, message: "Position not found" });

        res.status(200).json({ success: true, data: position });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updatePosition = async (req, res) => {
    try {
        if (!req.tenantDB) return res.status(500).json({ message: "DB Context Missing" });
        const tenantId = req.tenantDB.tenantId;
        const Position = req.tenantDB.model('Position');

        const cleanBody = { ...req.body };
        ['reportingTo', 'departmentId', 'replacedEmployee'].forEach(field => {
            if (cleanBody[field] === '') cleanBody[field] = null;
        });

        const updated = await Position.findOneAndUpdate(
            { _id: req.params.id, tenant: tenantId },
            { $set: cleanBody },
            { new: true }
        );

        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deletePosition = async (req, res) => {
    try {
        if (!req.tenantDB) return res.status(500).json({ message: "DB Context Missing" });
        const tenantId = req.tenantDB.tenantId;
        const Position = req.tenantDB.model('Position');

        await Position.deleteOne({ _id: req.params.id, tenant: tenantId });
        res.status(200).json({ success: true, message: "Position deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
