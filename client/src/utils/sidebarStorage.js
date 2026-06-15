const sanitizePart = (value, fallback) => {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;
  return normalized.replace(/[^a-zA-Z0-9_-]/g, '_');
};

const pickTenantPart = ({ user, tenant }) => {
  const tenantId =
    tenant?._id ||
    tenant?.id ||
    tenant?.tenantId ||
    tenant?.companyId ||
    user?.tenantId ||
    user?.tenant ||
    user?.companyId ||
    user?.company ||
    user?.companyCode;
  return sanitizePart(tenantId, 'tenant_global');
};

const pickUserPart = ({ user }) => {
  const userId =
    user?._id ||
    user?.id ||
    user?.userId ||
    user?.employeeId ||
    user?.email;
  return sanitizePart(userId, 'user_global');
};

export const getScopedStorageKey = (baseKey, context = {}) => {
  const tenantPart = pickTenantPart(context);
  const userPart = pickUserPart(context);
  const panelPart = context.panel ? `:${context.panel}` : '';
  return `${baseKey}:${tenantPart}:${userPart}${panelPart}`;
};

