const RealFaceRecognitionService = require('../services/realFaceRecognition.service');
const faceService = new RealFaceRecognitionService();
const legacyFaceService = require('../services/faceRecognition.service');
const crypto = require('crypto');
const { buildEffectiveAttendanceSettings, normalizePunchMode, translateShiftPolicyToLegacyConfig } = require('../utils/shiftRuntime');
const {
  buildAttendanceWindow,
  calculateAttendance,
  isWeeklyOffByShift,
} = require('../services/shiftPolicyEngine');
const {
  applyAttendanceRules,
  evaluateLateAndEarly,
} = require('../services/attendanceRulesEngine');
const {
  buildGradeAttendanceSettings,
  fetchEmployeeGrade,
} = require('../services/gradeAttendancePolicy.service');

/**
 * Configuration & Constants
 */
const FACE_EMBEDDING_KEY = process.env.FACE_EMBEDDING_KEY || 'master-encryption-key-change-in-prod';
const DEBUG_FACE_ATTENDANCE = process.env.DEBUG_FACE_ATTENDANCE === 'true' || true; // Force true for debugging
const RETRY_LIMITS = {
  hourly: 10,
  daily: 50
};

const debugFaceLog = (...args) => {
  if (DEBUG_FACE_ATTENDANCE) {
    // console.log(...args);
  }
};

const buildAuditLogPayload = ({
  tenantId,
  entity,
  entityId,
  action,
  performedBy,
  before = null,
  after = null,
  meta = {}
}) => ({
  tenant: tenantId,
  entity,
  entityId,
  action,
  performedBy,
  changes: {
    before,
    after
  },
  meta
});

const decryptStoredEmbedding = (encryptedEmbedding) => {
  if (typeof faceService.decryptEmbedding === 'function') {
    return faceService.decryptEmbedding(encryptedEmbedding, FACE_EMBEDDING_KEY);
  }
  return legacyFaceService.decryptEmbedding(encryptedEmbedding, FACE_EMBEDDING_KEY);
};

const encryptFaceEmbedding = (embedding) => {
  if (typeof faceService.encryptEmbedding === 'function') {
    return faceService.encryptEmbedding(embedding, FACE_EMBEDDING_KEY);
  }
  return legacyFaceService.encryptEmbedding(embedding, FACE_EMBEDDING_KEY);
};

/**
 * REGISTER FACE
 */
exports.registerFace = async (req, res) => {
  const startTime = Date.now();
  let auditLog = null;

  try {
    const { faceEmbedding, faceImageData, liveFrames, consentGiven } = req.body;
    const employeeId = req.user.id;
    const tenantId = req.tenantId || req.body.tenantId;

    const inputFaceData = faceEmbedding || faceImageData;
    if (!inputFaceData) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_IMAGE',
        message: 'Face image data or embedding is required'
      });
    }

    if (!consentGiven) {
      return res.status(400).json({
        success: false,
        error: 'CONSENT_REQUIRED',
        message: 'You must provide consent for face registration'
      });
    }

    const { FaceData, Attendance, Employee, AuditLog, FaceUpdateRequest } = getModels(req);

    // Resolve internal employee
    const employee = await Employee.findOne({ 
      email: req.user.email,
      mainCompanyId: tenantId 
    }).lean();
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found in this tenant. Please contact HR.'
      });
    }
    const internalEmployeeId = employee._id;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = await FaceData.countDocuments({
      employee: { $in: [employeeId, internalEmployeeId] },
      'registration.registeredAt': { $gte: oneHourAgo }
    });

    if (recentAttempts >= RETRY_LIMITS.hourly) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many registration attempts. Please wait before trying again.'
      });
    }

    let embedding;
    let metadata = { 
      quality: { sharpness: 100, brightness: 100, contrast: 100, confidence: 100 },
      detection: { x: 0, y: 0, width: 0, height: 0 }
    };

    if (Array.isArray(faceEmbedding) && faceEmbedding.length === 128) {
      embedding = faceEmbedding;
    } else if (faceEmbedding && typeof faceEmbedding === 'object' && Object.keys(faceEmbedding).length === 128) {
      embedding = Object.values(faceEmbedding);
    } else {
      const base64Data = faceImageData.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const embeddingResult = await faceService.generateFaceEmbedding(imageBuffer);
      if (!embeddingResult.success) {
        return res.status(400).json({
          success: false,
          error: embeddingResult.error,
          message: embeddingResult.message
        });
      }
      embedding = embeddingResult.embedding;
      metadata = embeddingResult.metadata;
    }

    let encryptedEmbedding = encryptFaceEmbedding(embedding);

    const existingFace = await FaceData.findOne({
      tenant: tenantId,
      employee: { $in: [employeeId, internalEmployeeId] },
      status: { $in: ['ACTIVE', 'PENDING_REVIEW'] }
    });

    let approvedUpdateRequest = null;
    if (existingFace) {
      approvedUpdateRequest = await FaceUpdateRequest.findOne({
        tenant: tenantId,
        employee: { $in: [employeeId, internalEmployeeId] },
        status: 'approved'
      });

      if (!approvedUpdateRequest) {
        return res.status(403).json({
          success: false,
          error: 'UPDATE_APPROVAL_REQUIRED',
          message: 'Face already registered. Please request approval from HR before updating it.'
        });
      }
    }

    let faceData = existingFace || new FaceData({
      tenant: tenantId,
      employee: internalEmployeeId
    });

    faceData.faceEmbedding = encryptedEmbedding;
    faceData.quality = metadata.quality || { sharpness: 100, brightness: 100, contrast: 100, confidence: 100 };
    faceData.detection = {
      bbox: metadata.detection || { x: 0, y: 0, width: 200, height: 200 }
    };
    if (faceImageData) {
      faceData.registeredFaceImage = faceImageData;
    }
    
    if (!existingFace) {
      faceData.status = 'PENDING_REVIEW';
      faceData.isVerified = false;
    } else {
      faceData.status = 'ACTIVE';
      faceData.isVerified = true;
    }
    
    faceData.registration = {
      registeredAt: new Date(),
      registeredBy: internalEmployeeId,
      consentGiven: true,
      consentGivenAt: new Date()
    };

    debugFaceLog(`[DEBUG_FACE_REGISTER] Saving face data for employee: ${internalEmployeeId}`);
    await faceData.save();

    if (!existingFace) {
      const initialRequest = new FaceUpdateRequest({
        tenant: tenantId,
        employee: internalEmployeeId,
        status: 'pending',
        reason: 'Initial face registration approval request'
      });
      await initialRequest.save();
    }

    if (approvedUpdateRequest) {
      approvedUpdateRequest.status = 'used';
      await approvedUpdateRequest.save();
    }

    return res.json({
      success: true,
      message: 'Face registered successfully',
      data: {
        registrationId: faceData._id,
        status: faceData.status,
        processingTime: `${Date.now() - startTime}ms`
      }
    });

  } catch (err) {
    console.error('❌ Face registration error:', err);
    return res.status(500).json({
      success: false,
      error: 'REGISTRATION_ERROR',
      message: 'Face registration failed',
      details: err.message
    });
  }
};

/**
 * VERIFY FACE (ATTENDANCE)
 */
exports.verifyFaceAttendance = async (req, res) => {
  // console.log(`[DEBUG_FACE_CONTROLLER] Started for user: ${req.user?.id}, tenant: ${req.tenantId}`);
  const startTime = Date.now();
  let auditLog = null;

  try {
    const { faceEmbedding, faceImageData, liveFrames, location, actionType } = req.body;
    const employeeId = req.user.id;
    const tenantId = req.tenantId || req.body.tenantId;

    const inputFaceData = faceEmbedding || faceImageData;
    if (!inputFaceData) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_IMAGE',
        message: 'Face image data or embedding is required'
      });
    }

    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_LOCATION',
        message: 'Location data is required'
      });
    }

    const { FaceData, Attendance, Employee, AuditLog, AttendanceSettings, Shift, Grade } = getModels(req);

    // IDENTIFICATION STRATEGY: 
    // 1. Find employee in current tenant DB using email from auth token
    const userEmail = req.user.email;
    const employee = await Employee.findOne({ 
      email: userEmail,
      mainCompanyId: tenantId 
    }).lean();
    
    if (!employee) {
      console.error(`[DEBUG_FACE_CONTROLLER] EMPLOYEE_NOT_FOUND for email: ${userEmail} in tenant: ${tenantId}`);
      return res.status(404).json({
        success: false,
        error: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee record not found. Please ensure your profile is fully set up.'
      });
    }

    const internalEmployeeId = employee._id;
    // console.log(`[DEBUG_FACE_CONTROLLER] Resolved Employee: ${employee.firstName} ${employee.lastName} (ID: ${internalEmployeeId})`);

    // 2. Find registered face data using the AUTH ID (as stored during registration) or the INTERNAL ID
    const registeredFaceData = await FaceData.findOne({
      tenant: tenantId,
      employee: { $in: [employeeId, internalEmployeeId] }, // Support both for compatibility
      status: 'ACTIVE',
      isVerified: true
    });

    if (!registeredFaceData) {
      // console.log(`[DEBUG_FACE_CONTROLLER] NO_REGISTERED_FACE for user: ${employeeId} or ${internalEmployeeId} tenant: ${tenantId}`);
      return res.status(404).json({
        success: false,
        error: 'NO_REGISTERED_FACE',
        message: 'No verified face registration found. Please register your face first.'
      });
    }

    let registeredEmbedding = decryptStoredEmbedding(registeredFaceData.faceEmbedding);
    let liveEmbedding;
    if (Array.isArray(inputFaceData) && inputFaceData.length === 128) {
      liveEmbedding = inputFaceData;
    } else {
      let imageBuffer;
      try {
        const base64Str = typeof inputFaceData === 'string' ? inputFaceData : faceImageData;
        const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, "");
        imageBuffer = Buffer.from(base64Data, 'base64');
      } catch (e) {
        imageBuffer = inputFaceData;
      }
      liveEmbedding = (await faceService.generateFaceEmbedding(imageBuffer)).embedding;
    }

    if (!liveEmbedding) {
      return res.status(400).json({
        success: false,
        error: 'DETECTION_FAILED',
        message: 'Unable to detect face in the provided image'
      });
    }

    const matchResult = faceService.compareFaceEmbeddings(registeredEmbedding, liveEmbedding);

    if (!matchResult.isMatch) {
      return res.status(400).json({
        success: false,
        error: 'FACE_MISMATCH',
        message: 'Face verification failed. Face did not match.'
      });
    }

    // Geofence check

    // Geofence check
    if (employee.geofence && employee.geofence.length > 0) {
      const geofenceResult = faceService.validateGeofence(location, employee.geofence, location.accuracy || 50);
      if (!geofenceResult.valid) {
        return res.status(400).json({
          success: false,
          error: 'GEOFENCE_VIOLATION',
          message: geofenceResult.message
        });
      }
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    let attendanceSettings = await AttendanceSettings.findOne({ tenant: tenantId });
    if (!attendanceSettings) {
      attendanceSettings = await AttendanceSettings.create({ tenant: tenantId });
    }
    let shiftConfig = employee.shiftId
      ? await Shift.findOne({ _id: employee.shiftId, isActive: true, isDeleted: false }).lean()
      : null;
    // ✅ FIX: If legacy Shift not found, try new ShiftMaster system
    if (!shiftConfig && employee.shiftId) {
      const ShiftMasterSchema = require('../models/ShiftMaster');
      const ShiftPolicySchema = require('../models/ShiftPolicy');
      const ShiftMaster = req.tenantDB.model('ShiftMaster', ShiftMasterSchema);
      const ShiftPolicy = req.tenantDB.model('ShiftPolicy', ShiftPolicySchema);
      const shiftMaster = await ShiftMaster.findOne({ _id: employee.shiftId, status: 'Active' }).lean();
      if (shiftMaster) {
        const shiftPolicy = await ShiftPolicy.findOne({ shiftMasterId: shiftMaster._id, isCurrent: true }).lean();
        shiftConfig = translateShiftPolicyToLegacyConfig(shiftMaster, shiftPolicy);
      }
    }
    const employeeGrade = shiftConfig ? null : await fetchEmployeeGrade({
      employee,
      Grade,
      tenantId,
      date: today,
    });
    const baseSettings = attendanceSettings?.toObject ? attendanceSettings.toObject() : attendanceSettings;
    const gradePolicy = buildGradeAttendanceSettings(baseSettings, employeeGrade);

    let attendance = await Attendance.findOne({ employee: internalEmployeeId, tenant: tenantId, date: today });
    let nextPunchType = actionType || (attendance ? (attendance.logs[attendance.logs.length-1]?.type === 'IN' ? 'OUT' : 'IN') : 'IN');

    if (!attendance) {
      attendance = new Attendance({
        tenant: tenantId,
        employee: internalEmployeeId,
        date: today,
        status: 'present',
        checkIn: nextPunchType === 'IN' ? new Date() : null,
        logs: []
      });
    } else {
      attendance.status = 'present';
    }

    if (nextPunchType === 'OUT') attendance.checkOut = new Date();
    
    attendance.logs.push({
      time: new Date(),
      type: nextPunchType,
      location: `${location.lat},${location.lng}`,
      method: 'FACE'
    });

    attendance.workingHours = calculateWorkingHours(attendance.logs);
    if (shiftConfig && (nextPunchType === 'OUT' || attendance.checkOut)) {
      const shiftWindow = buildAttendanceWindow(shiftConfig, today);
      const shiftOutcome = calculateAttendance({
        shift: shiftConfig,
        window: shiftWindow,
        date: today,
        punchLogs: attendance.logs,
      });
      attendance.status = shiftOutcome.status;
      attendance.isLate = shiftOutcome.isLate;
      attendance.isEarlyOut = shiftOutcome.isEarlyOut;
      attendance.lateMinutes = shiftOutcome.lateMinutes;
      attendance.earlyExitMinutes = shiftOutcome.earlyExitMinutes;
      attendance.workingHours = shiftOutcome.workingHours;
      attendance.lopDays = typeof shiftOutcome.lopDays === 'number' ? shiftOutcome.lopDays : attendance.lopDays;
      attendance.ruleEngineVersion = shiftOutcome.engineVersion || 3;
      attendance.ruleEngineMeta = {
        source: 'shift_policy_engine',
        shiftId: shiftConfig._id,
        policyViolations: shiftOutcome.policyViolations || [],
      };
    } else if (nextPunchType === 'OUT' || attendance.checkOut) {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const [accumulatedLateCount, accumulatedEarlyExitCount] = await Promise.all([
        Attendance.countDocuments({ employee: internalEmployeeId, tenant: tenantId, date: { $gte: startOfMonth, $lt: today }, isLate: true }),
        Attendance.countDocuments({ employee: internalEmployeeId, tenant: tenantId, date: { $gte: startOfMonth, $lt: today }, isEarlyOut: true }),
      ]);
      const rulesResult = applyAttendanceRules({
        date: today,
        employeeId: internalEmployeeId,
        logs: attendance.logs,
        workingHours: attendance.workingHours,
        baseStatus: attendance.status,
        settings: gradePolicy.settings,
        accumulatedLateCount,
        accumulatedEarlyExitCount,
      });
      attendance.status = rulesResult.status;
      attendance.isLate = rulesResult.isLate;
      attendance.isEarlyOut = rulesResult.isEarlyOut;
      attendance.workingHours = rulesResult.workingHours;
      attendance.lateMinutes = rulesResult.lateMinutes;
      attendance.earlyExitMinutes = rulesResult.earlyExitMinutes;
      attendance.lopDays = typeof rulesResult.lopDays === 'number' ? rulesResult.lopDays : attendance.lopDays;
      attendance.ruleEngineVersion = rulesResult.engineVersion || 2;
      attendance.ruleEngineMeta = {
        ...(rulesResult.meta || {}),
        policySource: gradePolicy.source,
        gradeId: gradePolicy.grade?._id || null,
        gradeCode: gradePolicy.grade?.code || '',
        gradeTiming: gradePolicy.timing,
      };
    } else {
      const lateEarly = evaluateLateAndEarly({
        date: today,
        logs: attendance.logs,
        settings: gradePolicy.settings,
      });
      attendance.isLate = lateEarly.isLate;
      attendance.lateMinutes = lateEarly.lateMinutes;
      attendance.ruleEngineVersion = 2;
      attendance.ruleEngineMeta = {
        policySource: gradePolicy.source,
        gradeId: gradePolicy.grade?._id || null,
        gradeCode: gradePolicy.grade?.code || '',
        gradeTiming: gradePolicy.timing,
      };
    }
    await attendance.save();

    return res.json({
      success: true,
      message: `Attendance marked (${nextPunchType}) successfully`,
      data: {
        nextPunchType,
        processingTime: `${Date.now() - startTime}ms`
      }
    });

  } catch (err) {
    console.error('❌ Face verification error:', err);
    return res.status(500).json({
      success: false,
      error: 'VERIFICATION_ERROR',
      message: 'Face verification failed',
      details: err.message
    });
  }
};

exports.getFaceStatus = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const tenantId = req.tenantId;
    const { FaceData, FaceUpdateRequest, Employee } = getModels(req);
    const employeeIdentifiers = [employeeId];

    // Get internal ID
    const employee = await Employee.findOne({ 
      email: req.user.email,
      mainCompanyId: tenantId 
    }).lean();
    const internalEmployeeId = employee ? employee._id : null;
    if (internalEmployeeId) {
      employeeIdentifiers.push(internalEmployeeId);
    }

    const employeeScope = [...new Set(employeeIdentifiers.filter(Boolean).map((value) => String(value)))];

    const faceData = await FaceData.findOne({
      tenant: tenantId,
      employee: { $in: employeeScope },
      status: 'ACTIVE'
    });

    const pendingRequest = await FaceUpdateRequest.findOne({
      tenant: tenantId,
      employee: { $in: employeeScope },
      status: 'pending'
    });

    const approvedRequest = await FaceUpdateRequest.findOne({
      tenant: tenantId,
      employee: { $in: employeeScope },
      status: 'approved'
    });

    const canUpdate = !faceData || !!approvedRequest;

    return res.json({
      success: true,
      isRegistered: !!faceData,
      isPending: !!pendingRequest,
      isApprovedForUpdate: !!approvedRequest,
      status: faceData ? faceData.status : 'NOT_REGISTERED',
      canUpdate,
      pendingRequest: pendingRequest || null,
      approvedRequest: approvedRequest || null
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get face status' });
  }
};

exports.deleteFace = async (req, res) => {
  try {
    const { FaceData, Employee } = getModels(req);
    const employee = await Employee.findOne({ 
      email: req.user.email,
      mainCompanyId: req.tenantId 
    }).lean();
    const internalEmployeeId = employee ? employee._id : null;

    await FaceData.deleteOne({ 
      tenant: req.tenantId, 
      employee: { $in: [req.user.id, internalEmployeeId].filter(Boolean) } 
    });
    return res.json({ success: true, message: 'Face registration deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete face registration' });
  }
};

function getModels(req) {
  const db = req.tenantDB;
  return {
    FaceData: db.model('FaceData'),
    Attendance: db.model('Attendance'),
    Employee: db.model('Employee'),
    AuditLog: db.model('AuditLog'),
    FaceUpdateRequest: db.model('FaceUpdateRequest'),
    AttendanceSettings: db.model('AttendanceSettings'),
    Shift: db.model('Shift'),
    Grade: db.model('Grade')
  };
}

const calculateWorkingHours = (logs = []) => {
  if (logs.length < 2) return 0;
  let total = 0;
  let lastIn = null;
  for (const log of logs) {
    if (log.type === 'IN') lastIn = new Date(log.time);
    else if (log.type === 'OUT' && lastIn) {
      total += (new Date(log.time) - lastIn) / (1000 * 60 * 60);
      lastIn = null;
    }
  }
  return parseFloat(total.toFixed(2));
};

module.exports = {
  registerFace: exports.registerFace,
  verifyFaceAttendance: exports.verifyFaceAttendance,
  getFaceStatus: exports.getFaceStatus,
  deleteFace: exports.deleteFace
};
