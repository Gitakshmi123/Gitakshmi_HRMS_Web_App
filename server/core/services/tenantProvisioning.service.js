const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { DEFAULT_TENANT_ROLES, TENANT_MODULES } = require('../../shared/enterprise.constants');
const { buildTenantDatabaseName, getTenantConnection } = require('../../database/connectionManager');
const { License, Module, Subscription, Tenant } = require('../models/main.models');
const { registerTenantModels } = require('../../tenant/models/tenant.models');

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function uniqueSlug(companyName) {
  const base = slugify(companyName) || `tenant-${Date.now()}`;
  let candidate = base;
  let counter = 1;
  while (await Tenant.exists({ slug: candidate })) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }
  return candidate;
}

async function ensureMainModules() {
  await Promise.all(TENANT_MODULES.map((module) => Module.updateOne(
    { key: module.key },
    { $setOnInsert: { ...module, enabledByDefault: true } },
    { upsert: true }
  )));
}

async function seedTenantDatabase({ connection, admin, passwordHash }) {
  registerTenantModels(connection);

  const Role = connection.model('TenantRole');
  const User = connection.model('TenantUser');
  const TenantModule = connection.model('TenantModule');

  await Promise.all(DEFAULT_TENANT_ROLES.map((role) => Role.updateOne(
    { code: role.code },
    { $setOnInsert: { ...role, system: true } },
    { upsert: true }
  )));

  await Promise.all(TENANT_MODULES.map((module) => TenantModule.updateOne(
    { key: module.key },
    { $setOnInsert: { ...module, enabled: true } },
    { upsert: true }
  )));

  const adminUser = await User.findOneAndUpdate(
    { email: admin.email },
    {
      $setOnInsert: {
        name: admin.name,
        email: admin.email,
        password: passwordHash,
        roleCode: 'tenant_admin',
        status: 'active'
      }
    },
    { new: true, upsert: true }
  );

  await connection.db.collection('tenant_metadata').updateOne(
    { key: 'isolation' },
    {
      $set: {
        key: 'isolation',
        databaseName: connection.name,
        isolated: true,
        initializedAt: new Date()
      }
    },
    { upsert: true }
  );

  return adminUser;
}

async function provisionCompany({ payload, createdBy }) {
  const companyName = String(payload.companyName || '').trim();
  const adminEmail = String(payload.adminEmail || payload.companyEmail || '').trim().toLowerCase();
  const adminName = String(payload.adminName || payload.ownerName || 'Tenant Admin').trim();
  const password = String(payload.password || '');

  if (!companyName || !adminEmail || !password) {
    const error = new Error('companyName, adminEmail/companyEmail, and password are required');
    error.statusCode = 400;
    throw error;
  }

  await ensureMainModules();

  const existing = await Tenant.findOne({
    $or: [
      { adminEmail },
      { domain: String(payload.domain || '').trim().toLowerCase() || undefined }
    ].filter((condition) => Object.values(condition)[0])
  }).lean();

  if (existing) {
    const error = new Error('Tenant already exists for this admin email or domain');
    error.statusCode = 409;
    throw error;
  }

  const slug = await uniqueSlug(payload.slug || companyName);
  const tenant = await Tenant.create({
    companyName,
    legalName: payload.legalName || companyName,
    slug,
    domain: payload.domain ? String(payload.domain).trim().toLowerCase() : undefined,
    databaseName: 'pending',
    status: 'provisioning',
    planCode: payload.planCode || 'enterprise',
    adminEmail,
    modules: TENANT_MODULES.map((module) => module.key),
    createdBy
  });

  tenant.databaseName = buildTenantDatabaseName({ companyName, slug, tenantId: tenant._id });
  await tenant.save();

  const tenantDB = getTenantConnection({ tenantId: tenant._id, databaseName: tenant.databaseName });
  const passwordHash = await bcrypt.hash(password, 12);
  const adminUser = await seedTenantDatabase({
    connection: tenantDB,
    admin: { name: adminName, email: adminEmail },
    passwordHash
  });

  await Subscription.create({
    tenantId: tenant._id,
    planCode: tenant.planCode,
    status: 'trialing',
    startsAt: new Date(),
    metadata: { source: 'super_admin_create_company' }
  });

  await License.create({
    tenantId: tenant._id,
    seats: Number(payload.seats || 100),
    usedSeats: 1,
    status: 'active'
  });

  tenant.status = 'active';
  await tenant.save();

  return {
    tenant,
    adminUser,
    databaseName: tenant.databaseName,
    initialApiKey: `hrms_${crypto.randomBytes(24).toString('hex')}`
  };
}

module.exports = {
  provisionCompany,
  seedTenantDatabase
};
