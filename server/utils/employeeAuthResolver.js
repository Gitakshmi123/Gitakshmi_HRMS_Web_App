const mongoose = require('mongoose');

function escapeRegex(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveTenantFilter(tenantIdRaw) {
    if (!tenantIdRaw) {
        return {};
    }

    if (mongoose.Types.ObjectId.isValid(String(tenantIdRaw))) {
        return { tenant: new mongoose.Types.ObjectId(String(tenantIdRaw)) };
    }

    return { tenant: tenantIdRaw };
}

async function resolveAuthenticatedEmployee(req, options = {}) {
    const {
        select = null,
        lean = false,
        allowEmailFallback = true
    } = options;

    if (!req?.tenantDB || !req?.user) {
        return null;
    }

    const Employee = req.tenantDB.model('Employee');
    const tenantId = req.user?.tenantId || req.user?.mainCompanyId || req.tenantId || req.user?.tenant;

    const runQuery = async (filter) => {
        const query = Employee.findOne({ 
            $or: [{ mainCompanyId: tenantId }, { tenant: tenantId }],
            ...filter 
        });

        if (select) {
            query.select(select);
        }

        if (lean) {
            query.lean();
        }

        return query;
    };

    const authId = req.user?.id || req.user?._id || null;
    if (authId && mongoose.Types.ObjectId.isValid(String(authId))) {
        const employeeById = await runQuery({ _id: new mongoose.Types.ObjectId(String(authId)) });
        if (employeeById) {
            return employeeById;
        }
    }

    if (allowEmailFallback && req.user?.email) {
        return runQuery({
            email: { $regex: new RegExp(`^${escapeRegex(String(req.user.email).trim())}$`, 'i') }
        });
    }

    return null;
}

module.exports = {
    resolveAuthenticatedEmployee
};
