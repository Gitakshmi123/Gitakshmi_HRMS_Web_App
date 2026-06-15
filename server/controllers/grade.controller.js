const mongoose = require('mongoose');
const GradeSchema = require('../models/Grade');

const getGradeModel = (req) => {
  if (!req.tenantDB) {
    throw Object.assign(new Error('Tenant database connection not available'), { statusCode: 400 });
  }
  return req.tenantDB.model('Grade', GradeSchema);
};

const getTenantId = (req) => {
  const tenantId = req.tenantId || req.user?.tenantId || req.user?.companyId;
  if (!tenantId || !mongoose.Types.ObjectId.isValid(String(tenantId))) {
    throw Object.assign(new Error('Valid tenant context is required'), { statusCode: 400, code: 'tenant_missing' });
  }
  return tenantId;
};

const getUserId = (req) => {
  const id = req.user?.id || req.user?._id;
  return mongoose.Types.ObjectId.isValid(String(id || '')) ? id : null;
};

const normalizeCode = (value) => {
  if (!value) return undefined;
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const normalizeAttendanceRules = (rules) => {
  if (!rules || typeof rules !== 'object') return rules;
  const nextRules = { ...rules };
  if (nextRules.timingMode && !nextRules.timingType) {
    nextRules.timingType = nextRules.timingMode;
  }
  delete nextRules.timingMode;
  return nextRules;
};

const normalizeLeaveRules = (rules) => {
  if (!Array.isArray(rules)) return rules;
  return rules.map((rule) => ({
    ...rule,
    leaveType: String(rule.leaveType || '').trim().toUpperCase(),
  }));
};

const sanitizeUpdate = (body) => {
  const update = { ...body };
  delete update.tenant;
  delete update.createdBy;
  delete update.updatedBy;
  delete update.isDeleted;

  if (update.name) {
    update.name = update.name.trim();
    update.normalizedName = update.name.toLowerCase();
  }
  if (update.code !== undefined) {
    update.code = normalizeCode(update.code);
    if (!update.code) delete update.code;
  }
  if (update.attendanceRules) {
    update.attendanceRules = normalizeAttendanceRules(update.attendanceRules);
  }
  if (update.leaveRules) {
    update.leaveRules = normalizeLeaveRules(update.leaveRules);
  }

  Object.keys(update).forEach((key) => {
    if (update[key] === undefined) delete update[key];
  });

  return update;
};

const sendError = (res, error, fallbackMessage) => {
  console.error('[GRADE]', fallbackMessage, error);

  if (error?.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'validation_error',
      message: Object.values(error.errors || {}).map((item) => item.message).join(', '),
    });
  }

  if (error?.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'duplicate_grade',
      message: 'A grade with this name or code already exists for this company',
    });
  }

  const statusCode = error?.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error: error?.code || 'grade_error',
    message: statusCode === 500 ? fallbackMessage : error.message,
  });
};

exports.createGrade = async (req, res) => {
  try {
    const Grade = getGradeModel(req);
    const tenant = getTenantId(req);
    const payload = {
      ...req.body,
      attendanceRules: normalizeAttendanceRules(req.body.attendanceRules),
      leaveRules: normalizeLeaveRules(req.body.leaveRules),
      tenant,
      code: normalizeCode(req.body.code),
      createdBy: getUserId(req),
      updatedBy: getUserId(req),
    };

    const grade = await Grade.create(payload);

    return res.status(201).json({
      success: true,
      message: 'Grade created successfully',
      data: grade,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to create grade');
  }
};

exports.getGrades = async (req, res) => {
  try {
    const Grade = getGradeModel(req);
    const tenant = getTenantId(req);
    const { search, isActive, page, limit, sortBy, sortOrder } = req.query;

    const filter = { tenant, isDeleted: false };
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { code: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [grades, total] = await Promise.all([
      Grade.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Grade.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: grades,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return sendError(res, error, 'Failed to fetch grades');
  }
};

exports.getGradeById = async (req, res) => {
  try {
    const Grade = getGradeModel(req);
    const tenant = getTenantId(req);
    const grade = await Grade.findOne({ _id: req.params.id, tenant, isDeleted: false }).lean();

    if (!grade) {
      return res.status(404).json({ success: false, error: 'grade_not_found', message: 'Grade not found' });
    }

    return res.json({ success: true, data: grade });
  } catch (error) {
    return sendError(res, error, 'Failed to fetch grade');
  }
};

exports.updateGrade = async (req, res) => {
  try {
    const Grade = getGradeModel(req);
    const tenant = getTenantId(req);
    const update = sanitizeUpdate(req.body);
    update.updatedBy = getUserId(req);

    const grade = await Grade.findOneAndUpdate(
      { _id: req.params.id, tenant, isDeleted: false },
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!grade) {
      return res.status(404).json({ success: false, error: 'grade_not_found', message: 'Grade not found' });
    }

    return res.json({
      success: true,
      message: 'Grade updated successfully',
      data: grade,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to update grade');
  }
};

exports.deleteGrade = async (req, res) => {
  try {
    const Grade = getGradeModel(req);
    const tenant = getTenantId(req);
    const grade = await Grade.findOne({ _id: req.params.id, tenant, isDeleted: false });

    if (!grade) {
      return res.status(404).json({ success: false, error: 'grade_not_found', message: 'Grade not found' });
    }

    grade.isDeleted = true;
    grade.isActive = false;
    grade.updatedBy = getUserId(req);
    grade.code = `${grade.code}_DEL_${Date.now()}`;
    grade.normalizedName = `${grade.normalizedName}_deleted_${Date.now()}`;
    await grade.save();

    return res.json({ success: true, message: 'Grade deleted successfully' });
  } catch (error) {
    return sendError(res, error, 'Failed to delete grade');
  }
};

exports.toggleGradeStatus = async (req, res) => {
  try {
    const Grade = getGradeModel(req);
    const tenant = getTenantId(req);
    const grade = await Grade.findOne({ _id: req.params.id, tenant, isDeleted: false });

    if (!grade) {
      return res.status(404).json({ success: false, error: 'grade_not_found', message: 'Grade not found' });
    }

    grade.isActive = !grade.isActive;
    grade.updatedBy = getUserId(req);
    await grade.save();

    return res.json({
      success: true,
      message: `Grade ${grade.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { id: grade._id, isActive: grade.isActive },
    });
  } catch (error) {
    return sendError(res, error, 'Failed to update grade status');
  }
};
