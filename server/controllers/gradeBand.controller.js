const mongoose = require('mongoose');
const BandSchema = require('../models/Band');
const DesignationGradeMapSchema = require('../models/DesignationGradeMap');
const PromotionHistorySchema = require('../models/PromotionHistory');
const GradeSchema = require('../models/Grade');
const SalaryTemplateSchema = require('../models/SalaryTemplate');
const EmployeeSchema = require('../models/Employee');
const AuditLogSchema = require('../models/AuditLog');
const service = require('../services/gradeBandAssignment.service');

function model(req, name, schema) {
  if (!req.tenantDB) throw Object.assign(new Error('Tenant database connection not available'), { statusCode: 400 });
  return req.tenantDB.models[name] || req.tenantDB.model(name, schema);
}

function getModels(req) {
  return {
    Grade: model(req, 'Grade', GradeSchema),
    Band: model(req, 'Band', BandSchema),
    DesignationGradeMap: model(req, 'DesignationGradeMap', DesignationGradeMapSchema),
    PromotionHistory: model(req, 'PromotionHistory', PromotionHistorySchema),
    SalaryTemplate: model(req, 'SalaryTemplate', SalaryTemplateSchema),
    Employee: model(req, 'Employee', EmployeeSchema),
    AuditLog: model(req, 'AuditLog', AuditLogSchema),
  };
}

function sendError(res, err, fallback = 'Grade band operation failed') {
  console.error('[GRADE_BAND]', err);
  if (err?.code === 11000) {
    return res.status(409).json({ success: false, error: 'duplicate_mapping', message: 'Duplicate grade, band, or designation mapping exists' });
  }
  if (err?.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'validation_error',
      message: Object.values(err.errors || {}).map((item) => item.message).join(', '),
    });
  }
  const status = err?.statusCode || 500;
  return res.status(status).json({ success: false, error: err?.code || 'grade_band_error', message: status === 500 ? fallback : err.message });
}

function userId(req) {
  return service.getUserId(req);
}

exports.createBand = async (req, res) => {
  try {
    const tenant = service.getTenantId(req);
    const Band = getModels(req).Band;
    const band = await Band.create({ ...req.body, tenant, createdBy: userId(req), updatedBy: userId(req) });
    return res.status(201).json({ success: true, data: band, message: 'Band created successfully' });
  } catch (err) {
    return sendError(res, err, 'Failed to create band');
  }
};

exports.listBands = async (req, res) => {
  try {
    const tenant = service.getTenantId(req);
    const bands = await getModels(req).Band.find({ tenant, status: { $ne: false } })
      .populate('payrollTemplateId', 'templateName name annualCTC monthlyCTC')
      .sort({ minSalary: 1 })
      .lean();
    return res.json({ success: true, data: bands });
  } catch (err) {
    return sendError(res, err, 'Failed to fetch bands');
  }
};

exports.createMapping = async (req, res) => {
  try {
    const tenant = service.getTenantId(req);
    const { DesignationGradeMap } = getModels(req);
    const mapping = await DesignationGradeMap.create({
      ...req.body,
      tenant,
      createdBy: userId(req),
      updatedBy: userId(req),
    });
    return res.status(201).json({ success: true, data: mapping, message: 'Designation grade mapping saved' });
  } catch (err) {
    return sendError(res, err, 'Failed to save designation mapping');
  }
};

exports.listMappings = async (req, res) => {
  try {
    const tenant = service.getTenantId(req);
    const filter = { tenant, status: { $ne: false } };
    if (mongoose.Types.ObjectId.isValid(String(req.query.departmentId || ''))) filter.departmentId = req.query.departmentId;
    if (mongoose.Types.ObjectId.isValid(String(req.query.designationId || ''))) filter.designationId = req.query.designationId;
    const mappings = await getModels(req).DesignationGradeMap.find(filter)
      .populate('gradeId', 'code name level isActive')
      .populate('allowedBandIds', 'code name minSalary maxSalary payrollTemplateId bonusPercentage status')
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({ success: true, data: mappings });
  } catch (err) {
    return sendError(res, err, 'Failed to fetch mappings');
  }
};

exports.getGradeByDesignation = async (req, res) => {
  try {
    const tenant = service.getTenantId(req);
    const assignment = await service.resolveDesignationGrade({
      models: getModels(req),
      tenantId: tenant,
      departmentId: req.query.departmentId,
      designationId: req.query.designationId,
    });
    return res.json({ success: true, data: assignment });
  } catch (err) {
    return sendError(res, err, 'Failed to resolve grade');
  }
};

exports.getBandBySalary = async (req, res) => {
  try {
    const tenant = service.getTenantId(req);
    const allowedBandIds = String(req.query.allowedBandIds || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const band = await service.detectBandBySalary({
      models: getModels(req),
      tenantId: tenant,
      salary: req.query.salary,
      allowedBandIds,
    });
    return res.json({ success: true, data: band });
  } catch (err) {
    return sendError(res, err, 'Failed to resolve band');
  }
};

exports.resolveAssignment = async (req, res) => {
  try {
    const tenant = service.getTenantId(req);
    const assignment = await service.resolveAssignment({
      models: getModels(req),
      tenantId: tenant,
      departmentId: req.query.departmentId || req.body.departmentId,
      designationId: req.query.designationId || req.body.designationId,
      salary: req.query.salary ?? req.body.salary,
    });
    return res.json({ success: true, data: assignment });
  } catch (err) {
    return sendError(res, err, 'Failed to resolve grade and band');
  }
};

exports.getPayrollTemplate = async (req, res) => {
  try {
    const tenant = service.getTenantId(req);
    const Band = getModels(req).Band;
    const band = await Band.findOne({ _id: req.query.bandId, tenant, status: true })
      .populate('payrollTemplateId')
      .lean();
    if (!band) return res.status(404).json({ success: false, error: 'band_not_found', message: 'Band not found' });
    return res.json({ success: true, data: band.payrollTemplateId || null });
  } catch (err) {
    return sendError(res, err, 'Failed to fetch payroll template');
  }
};

exports.updatePromotion = async (req, res) => {
  try {
    const tenant = service.getTenantId(req);
    const result = await service.promoteEmployee({
      models: getModels(req),
      tenantId: tenant,
      employeeId: req.params.employeeId,
      designationId: req.body.designationId,
      departmentId: req.body.departmentId,
      salary: req.body.salary,
      effectiveDate: req.body.effectiveDate,
      reason: req.body.reason,
      req,
    });
    return res.json({ success: true, data: result, message: 'Promotion updated successfully' });
  } catch (err) {
    return sendError(res, err, 'Failed to update promotion');
  }
};
