const { AuditLog } = require('../models/main.models');

async function writeMainAudit({ req, tenantId, action, resource, resourceId, metadata = {} }) {
  await AuditLog.create({
    tenantId,
    actorId: req?.user?.id,
    actorEmail: req?.user?.email,
    action,
    resource,
    resourceId,
    ip: req?.ip,
    userAgent: req?.headers?.['user-agent'],
    metadata
  });
}

async function writeTenantAudit({ req, action, resource, resourceId, metadata = {} }) {
  if (!req?.tenantDB) return;
  const Audit = req.tenantDB.model('TenantAuditLog');
  await Audit.create({
    actorId: req.user?.id,
    actorEmail: req.user?.email,
    action,
    resource,
    resourceId,
    ip: req.ip,
    metadata
  });
}

module.exports = {
  writeMainAudit,
  writeTenantAudit
};
