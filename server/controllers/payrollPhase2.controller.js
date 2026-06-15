const payrollPhase2 = require('../services/payrollPhase2.service');

function getTenantId(req) {
    return req.user?.tenantId || req.tenantId || null;
}

function getUserId(req) {
    return req.user?.id || req.user?._id || null;
}

function getPayrollRunModel(req) {
    return req.tenantDB.model('PayrollRun');
}

function respondWithPayrollError(res, scope, error) {
    console.error(`[${scope}] Error:`, error);
    const statusCode = typeof payrollPhase2.getHttpStatusForError === 'function'
        ? payrollPhase2.getHttpStatusForError(error)
        : 500;
    const response = {
        success: false,
        error: error?.message || 'Internal server error'
    };
    if (statusCode < 500 && error?.code) {
        response.code = error.code;
    }
    if (statusCode < 500 && error?.details) {
        response.details = error.details;
    }
    return res.status(statusCode).json(response);
}

exports.createPayrollInputBatch = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const batch = await payrollPhase2.createPayrollInputBatch(
            req.tenantDB,
            tenantId,
            req.body || {},
            getUserId(req)
        );

        res.status(201).json({
            success: true,
            data: batch,
            message: 'Payroll input batch created successfully.'
        });
    } catch (error) {
        return respondWithPayrollError(res, 'createPayrollInputBatch', error);
    }
};

exports.getPayrollInputBatches = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const batches = await payrollPhase2.listPayrollInputBatches(
            req.tenantDB,
            tenantId,
            req.query || {}
        );

        res.json({
            success: true,
            count: batches.length,
            data: batches
        });
    } catch (error) {
        return respondWithPayrollError(res, 'getPayrollInputBatches', error);
    }
};

exports.getPayrollInputBatchById = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const batch = await payrollPhase2.getPayrollInputBatchById(
            req.tenantDB,
            tenantId,
            req.params.id
        );

        if (!batch) {
            return res.status(404).json({ success: false, error: 'Payroll input batch not found' });
        }

        res.json({
            success: true,
            data: batch
        });
    } catch (error) {
        return respondWithPayrollError(res, 'getPayrollInputBatchById', error);
    }
};

exports.transitionPayrollInputBatch = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const batch = await payrollPhase2.transitionPayrollInputBatch(
            req.tenantDB,
            tenantId,
            req.params.id,
            req.body?.action,
            getUserId(req),
            req.body?.comment || ''
        );

        res.json({
            success: true,
            data: batch,
            message: `Payroll input batch ${req.body?.action || 'updated'} successfully.`
        });
    } catch (error) {
        return respondWithPayrollError(res, 'transitionPayrollInputBatch', error);
    }
};

exports.submitRunForApproval = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const payrollRun = await payrollPhase2.submitPayrollRunForApproval(
            req.tenantDB,
            tenantId,
            req.params.id,
            getUserId(req),
            req.body?.comment || ''
        );

        res.json({
            success: true,
            data: payrollRun,
            message: 'Payroll run submitted for approval.'
        });
    } catch (error) {
        return respondWithPayrollError(res, 'submitRunForApproval', error);
    }
};

exports.reviewRunApproval = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const payrollRun = await payrollPhase2.reviewPayrollRunApproval(
            req.tenantDB,
            tenantId,
            req.params.id,
            req.body?.decision,
            getUserId(req),
            req.body?.comment || '',
            req.body?.stepOrder || null,
            req.user?.role || ''
        );

        res.json({
            success: true,
            data: payrollRun,
            message: `Payroll run ${String(req.body?.decision || '').toLowerCase() || 'reviewed'} successfully.`
        });
    } catch (error) {
        return respondWithPayrollError(res, 'reviewRunApproval', error);
    }
};

exports.generateRunExports = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const artifacts = await payrollPhase2.generateRunExports(
            req.tenantDB,
            tenantId,
            req.params.id,
            req.body?.artifactTypes || [],
            getUserId(req)
        );

        res.json({
            success: true,
            count: artifacts.length,
            data: artifacts,
            message: 'Payroll exports generated successfully.'
        });
    } catch (error) {
        return respondWithPayrollError(res, 'generateRunExports', error);
    }
};

exports.getRunExports = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const artifacts = await payrollPhase2.listRunExportArtifacts(
            req.tenantDB,
            tenantId,
            req.params.id
        );

        res.json({
            success: true,
            count: artifacts.length,
            data: artifacts
        });
    } catch (error) {
        return respondWithPayrollError(res, 'getRunExports', error);
    }
};

exports.getRunOperationalSummary = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const summary = await payrollPhase2.buildRunOperationalSummary(
            req.tenantDB,
            tenantId,
            req.params.id
        );

        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        return respondWithPayrollError(res, 'getRunOperationalSummary', error);
    }
};

exports.syncPhase2Indexes = async (req, res) => {
    try {
        const PayrollRun = getPayrollRunModel(req);
        const Payslip = req.tenantDB.model('Payslip');
        const PayrollInputBatch = req.tenantDB.model('PayrollInputBatch');
        const PayrollExportArtifact = req.tenantDB.model('PayrollExportArtifact');

        const indexDrops = [];
        for (const [model, indexName] of [
            [PayrollRun, 'tenantId_1_month_1_year_1'],
            [Payslip, 'tenantId_1_employeeId_1_month_1_year_1']
        ]) {
            try {
                await model.collection.dropIndex(indexName);
                indexDrops.push(indexName);
            } catch (_err) {
                // ignore missing indexes
            }
        }

        await Promise.all([
            PayrollRun.syncIndexes(),
            Payslip.syncIndexes(),
            PayrollInputBatch.syncIndexes(),
            PayrollExportArtifact.syncIndexes()
        ]);

        res.json({
            success: true,
            data: {
                droppedIndexes: indexDrops
            },
            message: 'Phase 2 payroll indexes synchronized successfully.'
        });
    } catch (error) {
        return respondWithPayrollError(res, 'syncPhase2Indexes', error);
    }
};
