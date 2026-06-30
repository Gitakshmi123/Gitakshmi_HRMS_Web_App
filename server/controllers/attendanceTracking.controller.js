const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const RealFaceRecognitionService = require('../services/realFaceRecognition.service');
const legacyFaceService = require('../services/faceRecognition.service');
const {
  TRACKING_CONFIG,
  buildDateKey,
  evaluateLocationSecurity,
  getRecommendedTrackingInterval,
  haversineDistanceMeters,
  isSocketOnline,
  normalizeLocationSnapshot,
  normalizeTimestamp,
  toFiniteNumber
} = require('../services/locationSecurity.service');
const {
  emitTrackingLocationUpdate,
  emitTrackingSessionUpdate
} = require('../services/socket.service');
const {
  applyAttendanceRules,
  evaluateLateAndEarly
} = require('../services/attendanceRulesEngine');
const {
  buildGradeAttendanceSettings,
  fetchEmployeeGrade
} = require('../services/gradeAttendancePolicy.service');
const { buildEffectiveAttendanceSettings, translateShiftPolicyToLegacyConfig } = require('../utils/shiftRuntime');

const faceService = new RealFaceRecognitionService();
const FACE_EMBEDDING_KEY =
  process.env.FACE_EMBEDDING_KEY || 'master-encryption-key-change-in-prod';
const FACE_ATTENDANCE_TOKEN_SECRET =
  process.env.FACE_ATTENDANCE_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  FACE_EMBEDDING_KEY;
const requestedFaceAttendanceTokenTtl = Number(process.env.FACE_ATTENDANCE_TOKEN_TTL_SECONDS || 120);
const FACE_ATTENDANCE_TOKEN_TTL_SECONDS = Math.max(
  30,
  Math.min(300, Number.isFinite(requestedFaceAttendanceTokenTtl) ? requestedFaceAttendanceTokenTtl : 120)
);
const ALLOW_DEV_LIVENESS_BYPASS =
  process.env.NODE_ENV !== 'production' &&
  String(process.env.ATTENDANCE_ALLOW_LIVENESS_BYPASS || 'true').toLowerCase() === 'true';

function readBooleanEnv(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

const ATTENDANCE_CONFIG = {
  faceConfidenceThreshold: Number(process.env.ATTENDANCE_FACE_CONFIDENCE_THRESHOLD || 0.7),
  maxPathPoints: Number(process.env.ATTENDANCE_PATH_POINT_LIMIT || 500),
  requireServerLiveness: readBooleanEnv(process.env.ATTENDANCE_REQUIRE_SERVER_LIVENESS, false),
  allowClientLivenessProof: readBooleanEnv(process.env.ATTENDANCE_ALLOW_CLIENT_LIVENESS_PROOF, true),
  gpsThresholds: {
    mobile: {
      verified: Number(process.env.ATTENDANCE_REQUIRED_GPS_ACCURACY || 50),
      reject: Number(process.env.ATTENDANCE_REJECT_GPS_ACCURACY || 100)
    },
    desktop: {
      verified: Number(process.env.ATTENDANCE_DESKTOP_REQUIRED_GPS_ACCURACY || 100),
      reject: Number(process.env.ATTENDANCE_DESKTOP_REJECT_GPS_ACCURACY || 1000)
    }
  }
};
const CLIENT_MEETING_MAX_SEGMENT_METERS = Number(
  process.env.CLIENT_MEETING_MAX_SEGMENT_METERS || 2000
);
const CLIENT_MEETING_MAX_ROUTE_POINTS = Number(
  process.env.CLIENT_MEETING_MAX_ROUTE_POINTS || 700
);
const CLIENT_MEETING_MAX_REASONABLE_TOTAL_METERS = Number(
  process.env.CLIENT_MEETING_MAX_REASONABLE_TOTAL_METERS || 500000
);

function createApiError(status, code, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details !== null) {
    error.details = details;
  }
  return error;
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeObjectId(value) {
  const rawValue = value?._id || value;
  const stringValue = String(rawValue || '').trim();
  if (!mongoose.Types.ObjectId.isValid(stringValue)) {
    return null;
  }
  return new mongoose.Types.ObjectId(stringValue);
}

function getModels(req) {
  const db = req.tenantDB;
  if (!db) {
    throw createApiError(
      400,
      'tenant_not_resolved',
      'Company context could not be resolved for this request.'
    );
  }

  return {
    Attendance: db.model('Attendance'),
    AttendanceSettings: db.model('AttendanceSettings'),
    Employee: db.model('Employee'),
    Grade: db.model('Grade'),
    Shift: db.model('Shift'),
    FaceData: db.model('FaceData'),
    LiveTracking: db.model('LiveTracking'),
    LiveTrackingSession: db.model('LiveTrackingSession')
  };
}

async function ensureTenantDbContext(req) {
  if (req.tenantDB) return req.tenantDB;

  const tenantId =
    req.tenantId ||
    req.user?.tenantId ||
    req.user?.mainCompanyId ||
    req.user?.companyId;

  if (!tenantId) return null;

  const getTenantDB = require('../utils/tenantDB');
  const tenantDB = await getTenantDB(tenantId);
  if (tenantDB) {
    req.tenantDB = tenantDB;
    req.tenantId = String(tenantDB.tenantId || tenantId);
  }
  return tenantDB;
}

async function requireTenantDbContext(req) {
  const tenantDB = await ensureTenantDbContext(req);
  if (!req.tenantId || !tenantDB) {
    throw createApiError(
      400,
      'tenant_not_resolved',
      'Company context could not be resolved for this request.'
    );
  }
  return tenantDB;
}

function decryptStoredEmbedding(encryptedEmbedding) {
  if (typeof faceService.decryptEmbedding === 'function') {
    return faceService.decryptEmbedding(encryptedEmbedding, FACE_EMBEDDING_KEY);
  }
  return legacyFaceService.decryptEmbedding(encryptedEmbedding, FACE_EMBEDDING_KEY);
}

function buildFaceOwnerIds(req, employee) {
  const ownerIds = [employee?._id].filter(Boolean);
  if (
    mongoose.Types.ObjectId.isValid(String(req.user?.id || '')) &&
    String(req.user.id) !== String(employee?._id || '')
  ) {
    ownerIds.push(new mongoose.Types.ObjectId(String(req.user.id)));
  }
  return ownerIds;
}

async function findActiveRegisteredFace({ FaceData, tenantId, employee, req }) {
  return FaceData.findOne({
    tenant: tenantId,
    employee: { $in: buildFaceOwnerIds(req, employee) },
    status: 'ACTIVE',
    isVerified: true
  });
}

function issueFaceVerificationToken({
  tenantId,
  employee,
  deviceFingerprint = '',
  matchResult,
  livenessResult
}) {
  return jwt.sign(
    {
      purpose: 'face_attendance',
      tenantId: String(tenantId || ''),
      employeeId: String(employee?._id || ''),
      employeeCode: employee?.employeeId || '',
      deviceFingerprint: String(deviceFingerprint || ''),
      match: {
        similarity: toFiniteNumber(matchResult?.similarity, 0),
        matchScore: toFiniteNumber(matchResult?.matchScore, 0),
        confidence: matchResult?.confidence || ''
      },
      liveness: {
        valid: Boolean(livenessResult?.valid),
        confidence: toFiniteNumber(livenessResult?.confidence, 0),
        reason: livenessResult?.reason || ''
      }
    },
    FACE_ATTENDANCE_TOKEN_SECRET,
    { expiresIn: FACE_ATTENDANCE_TOKEN_TTL_SECONDS }
  );
}

function verifyFaceVerificationToken(token, { tenantId, employee, deviceFingerprint = '' }) {
  if (!token) {
    return null;
  }

  let payload;
  try {
    payload = jwt.verify(token, FACE_ATTENDANCE_TOKEN_SECRET);
  } catch (error) {
    throw createApiError(401, 'face_token_invalid', 'Face verification expired. Please scan your face again.');
  }

  if (
    payload?.purpose !== 'face_attendance' ||
    String(payload.tenantId || '') !== String(tenantId || '') ||
    String(payload.employeeId || '') !== String(employee?._id || '')
  ) {
    throw createApiError(403, 'face_token_mismatch', 'Face verification does not match this attendance session.');
  }

  const tokenDevice = String(payload.deviceFingerprint || '').trim();
  const currentDevice = String(deviceFingerprint || '').trim();
  if (tokenDevice && currentDevice && tokenDevice !== currentDevice) {
    throw createApiError(403, 'face_token_device_mismatch', 'Face verification was created from a different device.');
  }

  return {
    matchResult: {
      isMatch: true,
      similarity: toFiniteNumber(payload.match?.similarity, 0),
      matchScore: toFiniteNumber(payload.match?.matchScore, 0),
      confidence: payload.match?.confidence || 'TOKEN',
      verifiedByToken: true
    },
    livenessResult: {
      valid: Boolean(payload.liveness?.valid),
      confidence: toFiniteNumber(payload.liveness?.confidence, 0),
      reason: payload.liveness?.reason || 'TOKEN',
      message: 'Face liveness result verified by token.',
      verifiedByToken: true
    }
  };
}

async function resolveEmployeeContext(req, Employee) {
  const authUserId = String(req.user?.id || '').trim();
  const email = String(req.user?.email || '').trim();
  const tenantId = req.tenantId;

  if (mongoose.Types.ObjectId.isValid(authUserId)) {
    // Try finding by _id within the tenant or orphaned records
    const byId = await Employee.findOne({ 
      _id: authUserId, 
      $or: [
        { mainCompanyId: tenantId }, 
        { tenant: tenantId },
        { mainCompanyId: { $in: [null, undefined] } }
      ] 
    });
    if (byId) return byId;
  }

  if (!email) return null;

  // Try finding by email within the tenant or orphaned records
  return Employee.findOne({
    $or: [
      { mainCompanyId: tenantId }, 
      { tenant: tenantId },
      { mainCompanyId: { $in: [null, undefined] } }
    ],
    email: new RegExp(`^${escapeRegex(email)}$`, 'i')
  });
}

function toAttendanceLogLocation(snapshot) {
  if (!snapshot) return '';
  return `${snapshot.lat},${snapshot.lng}`;
}

function calculateWorkingHours(logs = []) {
  if (!Array.isArray(logs) || logs.length < 2) return 0;
  let total = 0;
  let lastIn = null;

  for (const log of logs) {
    if (log.type === 'IN') {
      lastIn = new Date(log.time);
    } else if (log.type === 'OUT' && lastIn) {
      total += (new Date(log.time) - lastIn) / (1000 * 60 * 60);
      lastIn = null;
    }
  }

  return Number(total.toFixed(2));
}

function buildAttendanceConflictData(attendance, nextPunchType, tracking = null) {
  return {
    action: nextPunchType,
    attendanceId: attendance?._id || null,
    attendance: attendance
      ? {
          checkIn: attendance.checkIn || null,
          checkOut: attendance.checkOut || null,
          workingHours:
            toFiniteNumber(attendance.workingHours, null) ??
            calculateWorkingHours(attendance.logs || []),
          status: attendance.status || 'present',
          verificationStatus: attendance.verificationStatus || null,
          flagged: Boolean(attendance.flagged),
          flagReason: attendance.flagReason || '',
          flagReasons: Array.isArray(attendance.flagReasons) ? attendance.flagReasons : []
        }
      : null,
    tracking
  };
}

function normalizeBase64Image(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.includes(',') ? raw.split(',').pop() : raw;
}

function inferDeviceType(explicitDeviceType = '', device = {}) {
  const normalizedExplicit = String(explicitDeviceType || '').trim().toLowerCase();
  if (normalizedExplicit === 'mobile' || normalizedExplicit === 'desktop') {
    return normalizedExplicit;
  }

  const raw = `${device?.userAgent || ''} ${device?.platform || ''}`.toLowerCase();
  return /android|iphone|ipad|ipod|mobile/i.test(raw) ? 'mobile' : 'desktop';
}

function getAttendanceGpsThresholds(deviceType = 'desktop') {
  return ATTENDANCE_CONFIG.gpsThresholds[deviceType === 'mobile' ? 'mobile' : 'desktop'];
}

function decodeBase64Image(value = '') {
  const normalized = normalizeBase64Image(value);
  if (!normalized) return null;

  try {
    return Buffer.from(normalized, 'base64');
  } catch (_error) {
    return null;
  }
}

function buildLiveFrames(liveFrames = []) {
  return (Array.isArray(liveFrames) ? liveFrames : [])
    .map((frame) => {
      const raw = normalizeBase64Image(frame?.imageData || '');
      if (!raw) return null;
      return {
        imageData: raw
      };
    })
    .filter(Boolean);
}

function normalizeClientLivenessProof(proof = null) {
  if (!proof || typeof proof !== 'object') return null;

  const frameCount = toFiniteNumber(proof.frameCount, 0);
  const earSpread = toFiniteNumber(proof.earSpread, 0);
  const yawSpread = toFiniteNumber(proof.yawSpread, 0);
  const faceMovement = toFiniteNumber(proof.faceMovement, 0);
  const confidence = Math.max(0, Math.min(100, toFiniteNumber(proof.confidence, 0)));
  const motionDetected = earSpread >= 0.03 || yawSpread >= 0.05 || faceMovement >= 4;
  const passed = Boolean(proof.valid || proof.passed || motionDetected);
  const valid = ATTENDANCE_CONFIG.allowClientLivenessProof && frameCount >= 3 && passed;

  return {
    valid,
    reason: valid ? 'CLIENT_PASSIVE_LIVENESS' : 'CLIENT_LIVENESS_UNVERIFIED',
    message: valid
      ? 'Passive liveness verified by the browser.'
      : 'Passive liveness was not fully verified by the browser.',
    confidence: valid ? Math.max(confidence, 70) : confidence,
    source: String(proof.source || 'client_passive').slice(0, 60),
    metrics: {
      frameCount,
      earSpread,
      yawSpread,
      faceMovement
    },
    checkedAt: proof.checkedAt || null
  };
}

async function buildVerifiedEmbedding(faceEmbedding, faceImageData) {
  if (Array.isArray(faceEmbedding) && faceEmbedding.length === 128) {
    return faceEmbedding;
  } else if (faceEmbedding && typeof faceEmbedding === 'object' && Object.keys(faceEmbedding).length === 128) {
    return Object.values(faceEmbedding);
  }

  const imageBuffer = decodeBase64Image(faceImageData);
  if (!imageBuffer) {
    throw createApiError(422, 'face_image_required', 'Face image is required.');
  }

  const embeddingResult = await faceService.generateFaceEmbedding(imageBuffer);
  if (!embeddingResult?.success || !Array.isArray(embeddingResult.embedding)) {
    throw createApiError(
      422,
      'embedding_generation_failed',
      'Unable to generate face embedding from the submitted frame.'
    );
  }

  return embeddingResult.embedding;
}

async function validateFaceAndLiveness({
  registeredEmbedding,
  faceEmbedding,
  faceImageData,
  liveFrames,
  livenessProof
}) {
  const liveEmbedding = await buildVerifiedEmbedding(faceEmbedding, faceImageData);
  const matchResult = faceService.compareFaceEmbeddings(registeredEmbedding, liveEmbedding);

  if (!matchResult?.isMatch) {
    throw createApiError(
      403,
      'face_mismatch',
      'Face verification failed. Submitted face does not match.'
    );
  }

  const frames = buildLiveFrames(liveFrames);
  let livenessResult = {
    valid: false,
    reason: 'MISSING_LIVENESS',
    message: 'Passive liveness frames are required.',
    confidence: 0
  };

  const clientProof = normalizeClientLivenessProof(livenessProof);

  if (ATTENDANCE_CONFIG.requireServerLiveness && frames.length >= 5) {
    livenessResult = await faceService.validateLiveness(frames);
  } else if (clientProof) {
    livenessResult = clientProof;
  } else if (frames.length >= 5 && !ATTENDANCE_CONFIG.allowClientLivenessProof) {
    livenessResult = await faceService.validateLiveness(frames);
  }

  const shouldBlockForLiveness =
    ATTENDANCE_CONFIG.requireServerLiveness ||
    (!ALLOW_DEV_LIVENESS_BYPASS && process.env.NODE_ENV !== 'production');

  if (!livenessResult.valid && shouldBlockForLiveness) {
    throw createApiError(
      403,
      'liveness_failed',
      livenessResult.message || 'Liveness validation failed.',
      livenessResult
    );
  }

  return {
    matchResult,
    livenessResult
  };
}

function ensureValidLocation(location) {
  const snapshot = normalizeLocationSnapshot(location);
  if (!snapshot) {
    throw createApiError(422, 'gps_not_available', 'GPS not available.');
  }
  return snapshot;
}

function buildGpsDecision({ accuracy, deviceType }) {
  const normalizedAccuracy = toFiniteNumber(accuracy);
  const resolvedDeviceType = deviceType === 'mobile' ? 'mobile' : 'desktop';
  const gpsThresholds = getAttendanceGpsThresholds(resolvedDeviceType);

  if (normalizedAccuracy === null || normalizedAccuracy <= 0) {
    throw createApiError(422, 'gps_accuracy_required', 'GPS accuracy is required.');
  }

  if (normalizedAccuracy <= gpsThresholds.verified) {
    return {
      allowed: true,
      flagged: false,
      status: 'VERIFIED',
      flagCode: '',
      flagReason: '',
      message: resolvedDeviceType === 'mobile' ? 'Location verified' : 'Desktop location verified',
      deviceType: resolvedDeviceType
    };
  }

  if (normalizedAccuracy <= gpsThresholds.reject) {
    return {
      allowed: true,
      flagged: true,
      status: 'FLAGGED',
      flagCode: 'low_gps_accuracy',
      flagReason: 'Low GPS accuracy',
      message:
        resolvedDeviceType === 'mobile'
          ? 'Low GPS accuracy, attendance marked as flagged. Please retry in open sky for better accuracy.'
          : 'Desktop browser location is approximate. Attendance marked as flagged and live tracking will continue.',
      deviceType: resolvedDeviceType
    };
  }

  return {
    allowed: false,
    flagged: false,
    status: 'REJECTED',
    flagCode: '',
    flagReason: '',
    message:
      resolvedDeviceType === 'mobile'
        ? 'Location accuracy too weak. Please move to open area and retry.'
        : 'Desktop location is unavailable. Retry once or use mobile GPS.',
    deviceType: resolvedDeviceType
  };
}

function hydrateHistoricalPoint(snapshot, fallbackTimestamp) {
  if (!snapshot) return null;

  const lat = toFiniteNumber(snapshot.lat);
  const lng = toFiniteNumber(snapshot.lng);
  if (lat === null || lng === null) {
    return null;
  }

  return {
    lat,
    lng,
    accuracy: toFiniteNumber(snapshot.accuracy),
    speed: toFiniteNumber(snapshot.speed),
    heading: toFiniteNumber(snapshot.heading),
    altitude: toFiniteNumber(snapshot.altitude),
    timestamp: normalizeTimestamp(fallbackTimestamp || snapshot.timestamp || new Date())
  };
}

function resolveAttendanceReferencePoint(attendance) {
  if (!attendance) return null;

  const lastTrackingPoint = hydrateHistoricalPoint(
    attendance.tracking?.lastLocation,
    attendance.tracking?.lastHeartbeatAt
  );
  if (lastTrackingPoint) return lastTrackingPoint;

  const checkOutPoint = hydrateHistoricalPoint(attendance.checkOutLocation, attendance.checkOut);
  if (checkOutPoint) return checkOutPoint;

  return hydrateHistoricalPoint(attendance.checkInLocation, attendance.checkIn);
}

function resolveSessionReferencePoint(session) {
  if (!session) return null;

  const rawLastPoint = hydrateHistoricalPoint(
    session?.meta?.lastRawLocation,
    session?.lastHeartbeatAt || session?.checkOutTime || session?.checkInTime
  );
  if (rawLastPoint) return rawLastPoint;

  const lastPoint = hydrateHistoricalPoint(
    session.lastLocation,
    session.lastHeartbeatAt || session.checkOutTime || session.checkInTime
  );
  if (lastPoint) return lastPoint;

  return hydrateHistoricalPoint(
    session.startLocation,
    session.checkInTime || session.startedAt || session.createdAt
  );
}

function isMatchingEmployeeId(employee, submittedEmployeeId, authUserId) {
  const submitted = String(submittedEmployeeId || '').trim().toLowerCase();
  if (!submitted) return true;

  const acceptedValues = [
    employee?._id,
    employee?.employeeId,
    authUserId
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  return acceptedValues.includes(submitted);
}

function getLastAttendanceLogType(attendance) {
  const logs = Array.isArray(attendance?.logs) ? attendance.logs : [];
  const lastLog = logs.length ? logs[logs.length - 1] : null;
  const type = String(lastLog?.type || '').trim().toUpperCase();
  return ['IN', 'OUT'].includes(type) ? type : null;
}

function isAttendanceSessionOpen(attendance) {
  const lastLogType = getLastAttendanceLogType(attendance);
  if (lastLogType) {
    return lastLogType === 'IN';
  }
  return Boolean(attendance?.checkIn && !attendance?.checkOut);
}

async function stopStaleTrackingSession(trackingSession, reason = 'CHECK_OUT') {
  if (!trackingSession || !['ACTIVE', 'SUSPICIOUS'].includes(trackingSession.status)) {
    return trackingSession;
  }

  const now = new Date();
  trackingSession.status = 'STOPPED';
  trackingSession.online = false;
  trackingSession.stoppedAt = trackingSession.stoppedAt || now;
  trackingSession.checkOutTime = trackingSession.checkOutTime || now;
  trackingSession.lastHeartbeatAt = now;
  trackingSession.stopReason = trackingSession.stopReason || reason;
  await trackingSession.save();
  return trackingSession;
}

async function clearOpenTrackingStopFields(trackingSession) {
  if (!trackingSession || !['ACTIVE', 'SUSPICIOUS'].includes(trackingSession.status)) {
    return trackingSession;
  }

  if (!trackingSession.checkOutTime && !trackingSession.stoppedAt && !trackingSession.stopReason) {
    return trackingSession;
  }

  trackingSession.checkOutTime = null;
  trackingSession.stoppedAt = null;
  trackingSession.stopReason = '';
  await trackingSession.save();
  return trackingSession;
}

function validateAttendanceRequest({
  employeeId,
  image,
  locationSnapshot,
  gpsDecision,
  faceVerificationToken = ''
}) {
  if (!faceVerificationToken && !normalizeBase64Image(image)) {
    throw createApiError(422, 'face_image_required', 'Face verification is required.');
  }

  if (locationSnapshot.accuracy === null || locationSnapshot.accuracy === undefined) {
    throw createApiError(422, 'gps_accuracy_required', 'GPS accuracy is required.');
  }

  if (gpsDecision && !gpsDecision.allowed) {
    throw createApiError(
      422,
      'gps_accuracy_too_low',
      gpsDecision.message
    );
  }
}

function buildFlagSummary({
  matchResult,
  securityCheck,
  nextPunchType,
  baseCodes = [],
  livenessResult = null
}) {
  const codeToMessage = {
    low_gps_accuracy: 'Low GPS accuracy',
    distance_jump: `GPS jump exceeded ${TRACKING_CONFIG.maxDistanceJumpMeters} meters within ${Math.round(TRACKING_CONFIG.maxJumpWindowSec / 60)} minutes.`,
    unrealistic_speed: `Computed travel speed exceeded ${TRACKING_CONFIG.maxSpeedKmh} km/h.`,
    mocked_location: 'GPS spoofing or developer-mode location tampering was detected.',
    poor_accuracy: 'GPS accuracy was weak during the attendance session.',
    device_binding_mismatch: 'Attendance was attempted from a different device than the bound device.',
    low_face_confidence: `Face verification confidence fell below ${ATTENDANCE_CONFIG.faceConfidenceThreshold.toFixed(2)}.`,
    rapid_location_change: 'The same user appeared from materially different locations within a short time window.',
    liveness_unverified: 'Passive liveness was not fully verified. HR review recommended.',
    unregistered_face_profile: 'No verified face profile was found. Attendance requires HR review.',
    face_match_review: 'Face match was inconclusive. Attendance requires HR review.'
  };

  const codes = [
    ...baseCodes,
    ...(Array.isArray(securityCheck?.reasons) ? securityCheck.reasons : [])
  ];
  const timeDeltaSec = toFiniteNumber(securityCheck?.metrics?.timeDeltaSec, 0);
  const jumpDistanceMeters = toFiniteNumber(securityCheck?.metrics?.jumpDistanceMeters, 0);
  const similarity = toFiniteNumber(matchResult?.similarity, 0);

  if (
    nextPunchType === 'IN' &&
    timeDeltaSec > 0 &&
    timeDeltaSec <= TRACKING_CONFIG.maxJumpWindowSec &&
    jumpDistanceMeters > TRACKING_CONFIG.maxDistanceJumpMeters &&
    !codes.includes('rapid_location_change')
  ) {
    codes.push('rapid_location_change');
  }

  if (
    similarity > 0 &&
    similarity < ATTENDANCE_CONFIG.faceConfidenceThreshold &&
    !codes.includes('low_face_confidence')
  ) {
    codes.push('low_face_confidence');
  }

  if (livenessResult && !livenessResult.valid && !codes.includes('liveness_unverified')) {
    codes.push('liveness_unverified');
  }

  const uniqueCodes = [...new Set(codes)];
  const reasons = uniqueCodes.map((code) => codeToMessage[code] || code.replace(/_/g, ' '));

  return {
    flagged: uniqueCodes.length > 0,
    codes: uniqueCodes,
    reasons,
    primaryReason: reasons[0] || ''
  };
}

function isFaceRecognitionMandatory(settings = {}) {
  return Boolean(
    settings?.faceRecognitionMandatory ||
    settings?.deviceSettings?.faceRecognitionMandatory ||
    settings?.advancedPolicy?.deviceSettings?.faceRecognitionMandatory
  );
}

function buildFaceReviewFallback({
  reason = 'UNREGISTERED_FACE_PROFILE',
  message = 'Attendance marked with camera and GPS for HR review.',
  confidence = 'REVIEW_REQUIRED',
  livenessReason = 'FACE_REVIEW_REQUIRED'
} = {}) {
  return {
    matchResult: {
      isMatch: true,
      similarity: 0,
      matchScore: 0,
      confidence
    },
    livenessResult: {
      valid: false,
      reason,
      message,
      confidence: 35,
      source: 'camera_gps_fallback',
      checkedAt: new Date().toISOString()
    }
  };
}

function buildUnregisteredFaceFallback() {
  return buildFaceReviewFallback({
    reason: 'UNREGISTERED_FACE_PROFILE',
    message: 'No verified face profile was found. Attendance marked with camera and GPS for HR review.',
    confidence: 'UNREGISTERED_PROFILE'
  });
}

function buildFaceMismatchFallback() {
  return buildFaceReviewFallback({
    reason: 'FACE_MATCH_REVIEW',
    message: 'Face match was inconclusive. Attendance marked with camera and GPS for HR review.',
    confidence: 'FACE_MATCH_REVIEW'
  });
}

function appendPathPoint(attendance, locationSnapshot, source, securityFlags = [], mocked = false) {
  const nextPoint = {
    lat: locationSnapshot.lat,
    lng: locationSnapshot.lng,
    accuracy: locationSnapshot.accuracy,
    speed: locationSnapshot.speed,
    heading: locationSnapshot.heading,
    altitude: locationSnapshot.altitude,
    timestamp: new Date(),
    source,
    securityFlags,
    mocked: Boolean(mocked)
  };

  attendance.pathPoints = Array.isArray(attendance.pathPoints)
    ? [...attendance.pathPoints, nextPoint].slice(-ATTENDANCE_CONFIG.maxPathPoints)
    : [nextPoint];
}

function buildEmployeeSummary(employee) {
  return {
    _id: employee?._id,
    employeeId: employee?.employeeId || '',
    firstName: employee?.firstName || '',
    lastName: employee?.lastName || '',
    fullName: [employee?.firstName, employee?.lastName].filter(Boolean).join(' ').trim(),
    profilePic: employee?.profilePic || '',
    designation: employee?.designation || '',
    department: employee?.department || ''
  };
}

function toPlainObject(value) {
  if (!value) return {};
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
}

function getSessionMeta(session) {
  return { ...(toPlainObject(session?.meta) || {}) };
}

function sanitizeMeetingText(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeOptionalLocation(value) {
  if (!value) return null;
  try {
    return ensureValidLocation(value);
  } catch (_error) {
    return null;
  }
}

function getLocationPayload(payload = {}) {
  if (payload.location) return payload.location;
  if (payload.lat !== undefined && payload.lng !== undefined) {
    return {
      lat: payload.lat,
      lng: payload.lng,
      accuracy: payload.accuracy,
      speed: payload.speed,
      heading: payload.heading,
      altitude: payload.altitude,
      timestamp: payload.timestamp,
      mocked: payload.mocked
    };
  }
  return null;
}

function buildNeutralSecurityCheck() {
  return {
    suspected: false,
    blocked: false,
    severity: 'NONE',
    reasons: [],
    metrics: { computedSpeedKmh: 0, jumpDistanceMeters: 0, timeDeltaSec: 0 },
    flags: {
      poorAccuracy: false,
      deviceMismatch: false,
      mockedLocation: false
    }
  };
}

function normalizeRoutePoint(value) {
  const source = Array.isArray(value)
    ? { lng: value[0], lat: value[1] }
    : value || {};
  const lat = toFiniteNumber(source.lat);
  const lng = toFiniteNumber(source.lng ?? source.lon);

  if (
    lat === null ||
    lng === null ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng };
}

function normalizeRoutePoints(points = []) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const maxPoints = Math.max(2, CLIENT_MEETING_MAX_ROUTE_POINTS);
  const step = Math.max(1, Math.ceil(points.length / maxPoints));
  const normalized = [];

  points.forEach((point, index) => {
    if (index % step !== 0 && index !== points.length - 1) return;
    const routePoint = normalizeRoutePoint(point);
    if (routePoint) normalized.push(routePoint);
  });

  return normalized;
}

function normalizeRoutePreview(route = null) {
  if (!route || typeof route !== 'object') return null;
  const routePoints = Array.isArray(route.points)
    ? route.points
    : route.geometry?.type === 'LineString'
      ? route.geometry.coordinates
      : [];
  const points = normalizeRoutePoints(routePoints);
  if (points.length < 2) return null;

  const distanceMeters = toFiniteNumber(
    route.distanceMeters ?? route.distance ?? route.plannedDistanceMeters,
    0
  );
  const durationSeconds = toFiniteNumber(
    route.durationSeconds ?? route.duration ?? route.plannedDurationSeconds,
    0
  );

  return {
    provider: sanitizeMeetingText(route.provider || 'route', 40),
    points,
    distanceMeters: Number(Math.max(0, distanceMeters).toFixed(2)),
    durationSeconds: Number(Math.max(0, durationSeconds).toFixed(0)),
    fallback: Boolean(route.fallback),
    fetchedAt: route.fetchedAt || new Date()
  };
}

function buildDirectRoutePreview(fromLocation, toLocation, fallbackReason = 'route_unavailable') {
  const fromPoint = normalizeRoutePoint(fromLocation);
  const toPoint = normalizeRoutePoint(toLocation);
  if (!fromPoint || !toPoint) return null;

  const distanceMeters = calculateSegmentDistanceMeters(fromPoint, toPoint);
  return {
    provider: 'direct',
    points: [fromPoint, toPoint],
    distanceMeters,
    durationSeconds: distanceMeters > 0 ? Math.round(distanceMeters / 8.33) : 0,
    fallback: true,
    fallbackReason,
    fetchedAt: new Date()
  };
}

function buildOsrmRoutePreview(fromLocation, toLocation, route = {}) {
  const coordinates = route?.geometry?.coordinates;
  const points = normalizeRoutePoints(Array.isArray(coordinates) ? coordinates : []);
  const directFallback = buildDirectRoutePreview(fromLocation, toLocation);

  return {
    provider: 'osrm',
    points: points.length >= 2 ? points : directFallback?.points || [],
    distanceMeters: Number(Math.max(0, toFiniteNumber(route.distance, directFallback?.distanceMeters || 0)).toFixed(2)),
    durationSeconds: Number(Math.max(0, toFiniteNumber(route.duration, directFallback?.durationSeconds || 0)).toFixed(0)),
    fallback: points.length < 2,
    fetchedAt: new Date()
  };
}

function normalizeClientMeetingPayload(payload = {}) {
  const clientName = sanitizeMeetingText(payload.clientName || payload.client || payload.customerName, 120);
  const title = sanitizeMeetingText(payload.title || payload.meetingTitle || payload.subject, 140);
  const purpose = sanitizeMeetingText(payload.purpose || payload.reason || payload.notes, 500);
  const fromAddress = sanitizeMeetingText(
    payload.fromAddress || payload.startAddress || payload.originAddress,
    240
  );
  const fromLocation = normalizeOptionalLocation(
    payload.fromLocation || payload.startLocation || payload.originLocation || null
  );
  const destinationAddress = sanitizeMeetingText(
    payload.destinationAddress || payload.toAddress || payload.address || payload.locationName,
    240
  );
  const destinationLocation = normalizeOptionalLocation(
    payload.destinationLocation || payload.toLocation || payload.destination || null
  );
  const toAddress = sanitizeMeetingText(payload.toAddress || destinationAddress, 240);
  const toLocation = normalizeOptionalLocation(
    payload.toLocation || payload.destinationLocation || payload.destination || null
  );
  const plannedRoute = normalizeRoutePreview(payload.plannedRoute || payload.routePreview || payload.route || null);

  return {
    clientName,
    title: title || 'Client Meeting',
    purpose,
    fromAddress,
    fromLocation,
    destinationAddress: destinationAddress || toAddress,
    destinationLocation: destinationLocation || toLocation,
    toAddress: toAddress || destinationAddress,
    toLocation: toLocation || destinationLocation,
    plannedRoute,
    plannedDistanceMeters: plannedRoute?.distanceMeters || 0,
    plannedDurationSeconds: plannedRoute?.durationSeconds || 0
  };
}

function normalizeClientMeetingForResponse(meeting = null) {
  if (!meeting || typeof meeting !== 'object') return null;
  const totalDistanceMeters = Number(
    meeting.totalDistanceMeters ?? meeting.distanceMeters ?? meeting.routeDistanceMeters ?? 0
  );
  const plannedDistanceMeters = Number(
    toFiniteNumber(meeting.plannedDistanceMeters ?? meeting.plannedRoute?.distanceMeters, 0).toFixed(2)
  );
  const plannedDurationSeconds = Number(
    toFiniteNumber(meeting.plannedDurationSeconds ?? meeting.plannedRoute?.durationSeconds, 0).toFixed(0)
  );
  const safeTotalDistanceMeters =
    (plannedDistanceMeters > 0 && totalDistanceMeters > plannedDistanceMeters * 3) ||
    totalDistanceMeters > CLIENT_MEETING_MAX_REASONABLE_TOTAL_METERS
      ? 0
      : totalDistanceMeters;

  return {
    id: String(meeting.id || meeting._id || ''),
    clientName: meeting.clientName || '',
    title: meeting.title || 'Client Meeting',
    purpose: meeting.purpose || '',
    fromAddress: meeting.fromAddress || meeting.startAddress || 'Live start location',
    fromLocation: meeting.fromLocation || meeting.startLocation || null,
    toAddress: meeting.toAddress || meeting.destinationAddress || '',
    toLocation: meeting.toLocation || meeting.destinationLocation || null,
    destinationAddress: meeting.destinationAddress || '',
    destinationLocation: meeting.destinationLocation || null,
    status: meeting.status || 'ACTIVE',
    startedAt: meeting.startedAt || null,
    endedAt: meeting.endedAt || null,
    reachedAt: meeting.reachedAt || meeting.endedAt || null,
    startLocation: meeting.startLocation || null,
    endLocation: meeting.endLocation || null,
    reachedLocation: meeting.reachedLocation || meeting.endLocation || null,
    lastLocation: meeting.lastLocation || null,
    totalUpdates: Number(meeting.totalUpdates || 0),
    totalDistanceMeters: Number.isFinite(safeTotalDistanceMeters) ? Number(safeTotalDistanceMeters.toFixed(2)) : 0,
    distanceMeters: Number.isFinite(safeTotalDistanceMeters) ? Number(safeTotalDistanceMeters.toFixed(2)) : 0,
    plannedDistanceMeters,
    plannedDurationSeconds,
    plannedRoute: normalizeRoutePreview(meeting.plannedRoute),
    stopReason: meeting.stopReason || ''
  };
}

function normalizePlaceSearchResult(place = {}) {
  const lat = toFiniteNumber(place.lat);
  const lng = toFiniteNumber(place.lon ?? place.lng);
  if (lat === null || lng === null) return null;

  const namedetails = place.namedetails || {};
  const englishName = sanitizeMeetingText(
    namedetails['name:en'] ||
      namedetails['alt_name:en'] ||
      namedetails['official_name:en'] ||
      place.name,
    160
  );
  const displayName = sanitizeMeetingText(place.display_name, 260);
  const name = sanitizeMeetingText(
    englishName ||
      place.name ||
      place.address?.office ||
      place.address?.building ||
      place.address?.road ||
      displayName.split(',')[0],
    140
  );

  return {
    id: String(place.place_id || `${lat},${lng}`),
    name: name || displayName,
    address: displayName || name,
    lat,
    lng,
    type: sanitizeMeetingText([place.class, place.type].filter(Boolean).join(' '), 80),
    importance: toFiniteNumber(place.importance)
  };
}

function getLatestClientMeeting(session) {
  const meta = getSessionMeta(session);
  const activeMeeting = getActiveClientMeeting(session);
  if (activeMeeting) return activeMeeting;

  if (meta.lastClientMeeting && typeof meta.lastClientMeeting === 'object') {
    return meta.lastClientMeeting;
  }

  const history = Array.isArray(meta.clientMeetingHistory) ? meta.clientMeetingHistory : [];
  return history.length ? history[history.length - 1] : null;
}

function calculateSegmentDistanceMeters(fromPoint, toPoint) {
  const from = normalizeLocationSnapshot(fromPoint);
  const to = normalizeLocationSnapshot(toPoint);
  if (!from || !to) return 0;

  const meters = haversineDistanceMeters(from, to);
  return Number.isFinite(meters) && meters > 0 ? Number(meters.toFixed(2)) : 0;
}

function addMeetingDistance(existingDistance, fromPoint, toPoint, options = {}) {
  const base = Number(existingDistance || 0);
  const rawSegment = calculateSegmentDistanceMeters(fromPoint, toPoint);
  const plannedDistanceMeters = toFiniteNumber(options.plannedDistanceMeters, 0);
  const maxReasonableSegment = Math.max(
    CLIENT_MEETING_MAX_SEGMENT_METERS,
    plannedDistanceMeters > 0 ? plannedDistanceMeters * 0.35 : 0
  );
  const segment = rawSegment > maxReasonableSegment ? 0 : rawSegment;
  const total = (Number.isFinite(base) ? base : 0) + segment;

  return {
    segmentDistanceMeters: segment,
    ignoredSegmentDistanceMeters: segment === 0 && rawSegment > maxReasonableSegment ? rawSegment : 0,
    totalDistanceMeters: Number(total.toFixed(2))
  };
}

function upsertClientMeetingHistory(history = [], meeting) {
  const responseMeeting = normalizeClientMeetingForResponse(meeting);
  if (!responseMeeting?.id) {
    return Array.isArray(history) ? history : [];
  }

  const nextHistory = Array.isArray(history) ? [...history] : [];
  const index = nextHistory.findIndex((item) => String(item?.id || '') === responseMeeting.id);
  if (index >= 0) {
    nextHistory[index] = responseMeeting;
  } else {
    nextHistory.push(responseMeeting);
  }
  return nextHistory;
}

function softenTrackingSecurityCheck(securityCheck) {
  if (!securityCheck?.blocked) {
    return securityCheck || buildNeutralSecurityCheck();
  }

  return {
    ...securityCheck,
    blocked: false,
    suspected: true,
    severity: securityCheck.severity || 'HIGH',
    reasons: [...new Set([...(securityCheck.reasons || []), 'tracking_security_flagged'])]
  };
}

function getActiveClientMeeting(session) {
  const meeting = getSessionMeta(session).activeClientMeeting;
  if (!meeting || typeof meeting !== 'object') return null;
  return String(meeting.status || '').toUpperCase() === 'ACTIVE' ? meeting : null;
}

function setSessionMeta(session, nextMeta) {
  session.meta = nextMeta;
  if (typeof session.markModified === 'function') {
    session.markModified('meta');
  }
}

async function findActiveTrackingSession(LiveTrackingSession, tenantId, employeeId) {
  return LiveTrackingSession.findOne({
    tenant: tenantId,
    employee: employeeId,
    status: { $in: ['ACTIVE', 'SUSPICIOUS'] }
  }).sort({ updatedAt: -1 });
}

async function resolveActiveTrackingContext(req) {
  await requireTenantDbContext(req);
  const tenantId = req.tenantId;
  const { Attendance, Employee, LiveTracking, LiveTrackingSession } = getModels(req);
  const employee = await resolveEmployeeContext(req, Employee);

  if (!employee) {
    throw createApiError(
      404,
      'employee_not_found',
      'Employee record not found for the current tenant.'
    );
  }

  const trackingSession = await findActiveTrackingSession(
    LiveTrackingSession,
    tenantId,
    employee._id
  );

  if (!trackingSession) {
    throw createApiError(
      409,
      'tracking_session_inactive',
      'Please mark attendance before starting client meeting tracking.'
    );
  }

  const attendance = trackingSession.attendance
    ? await Attendance.findOne({ _id: trackingSession.attendance, tenant: tenantId })
    : null;

  return {
    Attendance,
    Employee,
    LiveTracking,
    LiveTrackingSession,
    attendance,
    employee,
    tenantId,
    trackingSession
  };
}

async function bindEmployeeDevice(Employee, employee, device) {
  const fingerprint = String(device?.fingerprint || '').trim();
  if (!fingerprint || !employee?._id) {
    return employee?.attendanceSecurity?.deviceBinding || null;
  }

  const currentBinding = employee?.attendanceSecurity?.deviceBinding || null;
  if (currentBinding?.fingerprint) {
    if (currentBinding.fingerprint === fingerprint) {
      await Employee.updateOne(
        { _id: employee._id },
        {
          $set: {
            'attendanceSecurity.deviceBinding.lastSeenAt': new Date(),
            'attendanceSecurity.deviceBinding.userAgent': device?.userAgent || currentBinding.userAgent || '',
            'attendanceSecurity.deviceBinding.platform': device?.platform || currentBinding.platform || ''
          }
        }
      );
      return {
        ...currentBinding,
        lastSeenAt: new Date()
      };
    }
    return currentBinding;
  }

  const newBinding = {
    fingerprint,
    userAgent: device?.userAgent || '',
    platform: device?.platform || '',
    firstBoundAt: new Date(),
    lastSeenAt: new Date(),
    trustScore: 100
  };

  await Employee.updateOne(
    { _id: employee._id },
    {
      $set: {
        'attendanceSecurity.deviceBinding': newBinding
      }
    }
  );

  return newBinding;
}

async function createTrackingPoint({
  LiveTracking,
  tenantId,
  employeeId,
  attendanceId,
  sessionId,
  locationSnapshot,
  rawLocationSnapshot = null,
  device,
  securityCheck,
  source,
  intervalSeconds,
  battery,
  network,
  meta
}) {
  const trackingMeta = meta ? { ...meta } : {};
  if (rawLocationSnapshot) {
    trackingMeta.rawLocation = rawLocationSnapshot;
  }

  return LiveTracking.create({
    tenant: tenantId,
    employee: employeeId,
    attendance: normalizeObjectId(attendanceId),
    session: normalizeObjectId(sessionId),
    timestamp: normalizeTimestamp(locationSnapshot.timestamp),
    location: locationSnapshot,
    battery: battery || {},
    network: network || {},
    device: device || {},
    source,
    intervalSeconds,
    security: {
      suspected: securityCheck.suspected,
      severity: securityCheck.severity,
      reasons: securityCheck.reasons,
      computedSpeedKmh: securityCheck.metrics.computedSpeedKmh,
      jumpDistanceMeters: securityCheck.metrics.jumpDistanceMeters,
      deviceMismatch: securityCheck.flags.deviceMismatch,
      mockedLocation: securityCheck.flags.mockedLocation,
      poorAccuracy: securityCheck.flags.poorAccuracy
    },
    meta: trackingMeta
  });
}

function normalizeGeofencePoints(geofence = []) {
  return (Array.isArray(geofence) ? geofence : [])
    .map((point) => {
      const lat = toFiniteNumber(point?.lat);
      const lng = toFiniteNumber(point?.lng);
      if (lat === null || lng === null) {
        return null;
      }
      return { lat, lng };
    })
    .filter(Boolean);
}

function isPointInsidePolygon(point, polygon = []) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }

  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function calculateGeofenceCentroid(geofence = []) {
  const polygon = normalizeGeofencePoints(geofence);
  if (polygon.length < 3) {
    return null;
  }

  let signedArea = 0;
  let centroidLat = 0;
  let centroidLng = 0;

  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const factor = current.lng * next.lat - next.lng * current.lat;
    signedArea += factor;
    centroidLng += (current.lng + next.lng) * factor;
    centroidLat += (current.lat + next.lat) * factor;
  }

  if (Math.abs(signedArea) < Number.EPSILON) {
    const sums = polygon.reduce(
      (accumulator, point) => ({
        lat: accumulator.lat + point.lat,
        lng: accumulator.lng + point.lng
      }),
      { lat: 0, lng: 0 }
    );

    return {
      lat: sums.lat / polygon.length,
      lng: sums.lng / polygon.length
    };
  }

  const divisor = signedArea * 3;
  return {
    lat: centroidLat / divisor,
    lng: centroidLng / divisor
  };
}

function getSessionPriority(session = {}) {
  if (session?.status === 'ACTIVE') return 4;
  if (session?.status === 'SUSPICIOUS') return 3;
  if (session?.status === 'PAUSED') return 2;
  if (session?.status === 'STOPPED') return 1;
  return 0;
}

function pickPreferredSession(existingSession, candidateSession) {
  if (!existingSession) return candidateSession;
  if (!candidateSession) return existingSession;

  const existingPriority = getSessionPriority(existingSession);
  const candidatePriority = getSessionPriority(candidateSession);

  if (existingPriority !== candidatePriority) {
    return candidatePriority > existingPriority ? candidateSession : existingSession;
  }

  const existingTime = normalizeTimestamp(
    existingSession.lastHeartbeatAt || existingSession.updatedAt || existingSession.createdAt
  ).getTime();
  const candidateTime = normalizeTimestamp(
    candidateSession.lastHeartbeatAt || candidateSession.updatedAt || candidateSession.createdAt
  ).getTime();

  return candidateTime >= existingTime ? candidateSession : existingSession;
}

function toPlanarMeters(point, referenceLat) {
  const latFactor = 111320;
  const lngFactor = Math.cos((referenceLat * Math.PI) / 180) * 111320;
  return {
    x: point.lng * lngFactor,
    y: point.lat * latFactor
  };
}

function distancePointToSegmentMeters(point, start, end) {
  const referenceLat = (point.lat + start.lat + end.lat) / 3;
  const p = toPlanarMeters(point, referenceLat);
  const a = toPlanarMeters(start, referenceLat);
  const b = toPlanarMeters(end, referenceLat);
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abSquared = abx ** 2 + aby ** 2;

  if (abSquared === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  const ratio = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / abSquared)
  );
  const closestX = a.x + abx * ratio;
  const closestY = a.y + aby * ratio;
  return Math.hypot(p.x - closestX, p.y - closestY);
}

function distanceToGeofenceMeters(point, geofence = []) {
  const polygon = normalizeGeofencePoints(geofence);
  if (!point || polygon.length < 3) {
    return null;
  }

  if (isPointInsidePolygon(point, polygon)) {
    return 0;
  }

  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const distance = distancePointToSegmentMeters(point, start, end);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return Number.isFinite(minDistance) ? Number(minDistance.toFixed(2)) : null;
}

function blendLocationTowardsPrevious(previousPoint, currentPoint) {
  const previousAccuracy = Math.max(
    5,
    toFiniteNumber(previousPoint?.accuracy, TRACKING_CONFIG.requiredAccuracyMeters)
  );
  const currentAccuracy = Math.max(
    5,
    toFiniteNumber(currentPoint?.accuracy, TRACKING_CONFIG.flagAccuracyMeters)
  );
  const previousWeight = 1 / previousAccuracy;
  const currentWeight = 1 / currentAccuracy;
  const totalWeight = previousWeight + currentWeight;

  return {
    lat:
      (previousPoint.lat * previousWeight + currentPoint.lat * currentWeight) /
      totalWeight,
    lng:
      (previousPoint.lng * previousWeight + currentPoint.lng * currentWeight) /
      totalWeight
  };
}

function resolveDisplayLocation({
  currentPoint,
  previousDisplayPoint = null,
  geofence = [],
  securityCheck = null
} = {}) {
  const normalizedCurrent = normalizeLocationSnapshot(currentPoint);
  if (!normalizedCurrent) {
    return {
      location: null,
      strategy: 'missing'
    };
  }

  const normalizedPrevious = normalizeLocationSnapshot(previousDisplayPoint);
  const normalizedGeofence = normalizeGeofencePoints(geofence);
  const accuracy = Math.max(
    0,
    toFiniteNumber(normalizedCurrent.accuracy, TRACKING_CONFIG.flagAccuracyMeters)
  );
  const poorAccuracy =
    Boolean(securityCheck?.flags?.poorAccuracy) ||
    accuracy > TRACKING_CONFIG.requiredAccuracyMeters;

  if (normalizedPrevious) {
    const previousAccuracy = Math.max(
      0,
      toFiniteNumber(normalizedPrevious.accuracy, TRACKING_CONFIG.requiredAccuracyMeters)
    );
    const distanceFromPrevious = haversineDistanceMeters(normalizedPrevious, normalizedCurrent);
    const overlapRadius = Math.max(
      accuracy,
      previousAccuracy,
      TRACKING_CONFIG.requiredAccuracyMeters
    );

    if (distanceFromPrevious <= overlapRadius && accuracy > previousAccuracy + 5) {
      return {
        location: {
          ...normalizedCurrent,
          lat: normalizedPrevious.lat,
          lng: normalizedPrevious.lng
        },
        strategy: 'hold_previous',
        distanceFromPreviousMeters: Number(distanceFromPrevious.toFixed(2))
      };
    }

    if (distanceFromPrevious <= overlapRadius * 1.5 && poorAccuracy) {
      const blended = blendLocationTowardsPrevious(normalizedPrevious, normalizedCurrent);
      return {
        location: {
          ...normalizedCurrent,
          lat: blended.lat,
          lng: blended.lng
        },
        strategy: 'blend_previous',
        distanceFromPreviousMeters: Number(distanceFromPrevious.toFixed(2))
      };
    }
  }

  if (normalizedGeofence.length >= 3 && poorAccuracy) {
    const distanceFromGeofence = distanceToGeofenceMeters(normalizedCurrent, normalizedGeofence);
    const withinFenceBuffer =
      distanceFromGeofence !== null &&
      distanceFromGeofence <= Math.max(accuracy, TRACKING_CONFIG.requiredAccuracyMeters);
    const centroid = calculateGeofenceCentroid(normalizedGeofence);

    if (centroid && withinFenceBuffer) {
      return {
        location: {
          ...normalizedCurrent,
          lat: centroid.lat,
          lng: centroid.lng
        },
        strategy: 'geofence_centroid',
        distanceFromGeofenceMeters: distanceFromGeofence
      };
    }
  }

  return {
    location: normalizedCurrent,
    strategy: 'raw'
  };
}

function buildSessionPayload(session, employee, attendance) {
  const sessionOpen =
    isAttendanceSessionOpen(attendance) ||
    ['ACTIVE', 'SUSPICIOUS'].includes(String(session?.status || '').toUpperCase());
  const online =
    ['ACTIVE', 'SUSPICIOUS'].includes(session?.status) &&
    isSocketOnline(session?.lastHeartbeatAt);
  const attendanceFlagReasons = Array.isArray(attendance?.flagReasons) ? attendance.flagReasons : [];
  const sessionFlagReasons = Array.isArray(session?.security?.lastReasons) ? session.security.lastReasons : [];
  const mergedFlagReasons = [...new Set([...attendanceFlagReasons, ...sessionFlagReasons])];
  const activeClientMeeting = normalizeClientMeetingForResponse(getActiveClientMeeting(session));
  const lastClientMeeting = normalizeClientMeetingForResponse(getLatestClientMeeting(session));

  return {
    sessionId: session?._id || null,
    attendanceId: attendance?._id || null,
    userId: employee?._id || null,
    employee: buildEmployeeSummary(employee),
    status: session?.status || 'STOPPED',
    online,
    checkInTime: session?.checkInTime || attendance?.checkIn || null,
    checkOutTime: sessionOpen ? null : (session?.checkOutTime || attendance?.checkOut || null),
    lastHeartbeatAt: session?.lastHeartbeatAt || null,
    recommendedIntervalSec: session?.recommendedIntervalSec || TRACKING_CONFIG.minIntervalSec,
    currentLocation: session?.lastLocation || null,
    suspiciousUpdateCount: session?.suspiciousUpdateCount || 0,
    flagged: Boolean(attendance?.flagged) || mergedFlagReasons.length > 0,
    flagReason: attendance?.flagReason || mergedFlagReasons[0] || '',
    flagReasons: mergedFlagReasons,
    security: session?.security || {},
    activeClientMeeting,
    lastClientMeeting
  };
}

exports.matchFaceForAttendance = async (req, res) => {
  try {
    const {
      device = {},
      deviceType = '',
      deviceId = '',
      employeeId = '',
      faceEmbedding,
      faceImageData,
      image = '',
      liveFrames = [],
      livenessProof = null
    } = req.body || {};

    await requireTenantDbContext(req);
    const tenantId = req.tenantId;
    const { Employee, FaceData } = getModels(req);
    const employee = await resolveEmployeeContext(req, Employee);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'employee_not_found',
        message: 'Employee record not found for the current tenant.'
      });
    }

    if (!isMatchingEmployeeId(employee, employeeId, req.user?.id)) {
      return res.status(403).json({
        success: false,
        error: 'employee_session_mismatch',
        message: 'Employee session does not match the submitted employeeId.'
      });
    }

    const submittedImage = image || faceImageData || '';
    const isEmbeddingValid = (Array.isArray(faceEmbedding) && faceEmbedding.length === 128) || (faceEmbedding && typeof faceEmbedding === 'object' && Object.keys(faceEmbedding).length === 128);
    if (!isEmbeddingValid && !normalizeBase64Image(submittedImage)) {
      return res.status(422).json({
        success: false,
        error: 'face_image_required',
        message: 'Face image or face embedding is required for matching.'
      });
    }

    const registeredFace = await findActiveRegisteredFace({
      FaceData,
      tenantId,
      employee,
      req
    });

    if (!registeredFace) {
      return res.status(404).json({
        success: false,
        status: 'REJECTED',
        error: 'no_registered_face',
        message: 'No verified face registration found. Please register your face first.'
      });
    }

    const resolvedDeviceType = inferDeviceType(deviceType, device);
    const normalizedDevice = {
      ...device,
      fingerprint: String(device?.fingerprint || deviceId || '').trim(),
      deviceType: resolvedDeviceType
    };

    const registeredEmbedding = decryptStoredEmbedding(registeredFace.faceEmbedding);
    const { matchResult, livenessResult } = await validateFaceAndLiveness({
      registeredEmbedding,
      faceEmbedding,
      faceImageData: submittedImage,
      liveFrames,
      livenessProof
    });

    const faceVerificationToken = issueFaceVerificationToken({
      tenantId,
      employee,
      deviceFingerprint: normalizedDevice.fingerprint,
      matchResult,
      livenessResult
    });

    return res.json({
      success: true,
      status: livenessResult?.valid ? 'VERIFIED' : 'FLAGGED',
      message: 'Face matched successfully.',
      data: {
        faceVerificationToken,
        expiresInSeconds: FACE_ATTENDANCE_TOKEN_TTL_SECONDS,
        match: matchResult,
        liveness: livenessResult
      }
    });
  } catch (error) {
    console.error('[FACE MATCH ERROR]', error);
    return res.status(error.status || 500).json({
      success: false,
      status: 'REJECTED',
      error: error.code || 'face_match_failed',
      message: error.message || 'Face matching failed.',
      details: error.details || null
    });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const {
      actionType = 'AUTO',
      device = {},
      deviceType = '',
      deviceId = '',
      employeeId = '',
      faceVerificationToken = '',
      faceEmbedding,
      faceImageData,
      image = '',
      liveFrames = [],
      livenessProof = null,
      location,
      lat = null,
      lng = null,
      accuracy = null,
      speed = null,
      heading = null,
      altitude = null,
      timestamp = null,
      mocked = false,
      battery = null,
      network = null
    } = req.body || {};

    await requireTenantDbContext(req);
    const tenantId = req.tenantId;
    const { Attendance, AttendanceSettings, Employee, Grade, Shift, FaceData, LiveTracking, LiveTrackingSession } = getModels(req);
    const employee = await resolveEmployeeContext(req, Employee);

    if (!employee) {
      return res.status(404).json({
        success: false,
        status: 'REJECTED',
        error: 'employee_not_found',
        message: 'Employee record not found for the current tenant.'
      });
    }

    const submittedLocation = location || {
      lat,
      lng,
      accuracy,
      speed,
      heading,
      altitude,
      timestamp,
      mocked
    };
    const submittedImage = image || faceImageData || '';
    const normalizedLocation = ensureValidLocation(submittedLocation);

    if (!isMatchingEmployeeId(employee, employeeId, req.user?.id)) {
      return res.status(403).json({
        success: false,
        status: 'REJECTED',
        error: 'employee_session_mismatch',
        message: 'Employee session does not match the submitted employeeId.'
      });
    }

    const resolvedDeviceType = inferDeviceType(deviceType, device);
    const normalizedDevice = {
      ...device,
      fingerprint: String(device?.fingerprint || deviceId || '').trim(),
      deviceType: resolvedDeviceType
    };
    const gpsDecision = buildGpsDecision({
      accuracy: normalizedLocation.accuracy,
      deviceType: resolvedDeviceType
    });

    validateAttendanceRequest({
      employeeId,
      image: submittedImage,
      locationSnapshot: normalizedLocation,
      gpsDecision,
      faceVerificationToken
    });

    const now = new Date();
    const attendanceDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let attendanceSettings = await AttendanceSettings.findOne({ tenant: tenantId });
    if (!attendanceSettings) {
      attendanceSettings = await AttendanceSettings.create({ tenant: tenantId });
    }
    let activeShiftId = employee.shiftId ? employee.shiftId : null;
    let shiftConfig = null;
    let shiftMaster = null;
    let shiftPolicy = null;

    try {
      const RosterAssignment = req.tenantDB.model('RosterAssignment');
      const currentRoster = await RosterAssignment.findOne({
          employeeId: employee._id,
          status: 'Published',
          startDate: { $lte: attendanceDate },
          endDate: { $gte: attendanceDate }
      }).lean();
      if (currentRoster && currentRoster.shiftId) {
          activeShiftId = currentRoster.shiftId;
      }
    } catch (err) {
      console.error('Roster lookup error in face tracking:', err.message);
    }

    if (activeShiftId) {
      shiftConfig = await Shift.findOne({ _id: activeShiftId, isActive: true, isDeleted: false }).lean();
      if (!shiftConfig) {
          const ShiftMaster = req.tenantDB.model('ShiftMaster');
          const ShiftPolicy = req.tenantDB.model('ShiftPolicy');
          shiftMaster = await ShiftMaster.findOne({ _id: activeShiftId, status: 'Active' }).lean();
          if (shiftMaster) {
              shiftPolicy = await ShiftPolicy.findOne({ shiftMasterId: shiftMaster._id, isCurrent: true }).lean();
              shiftConfig = translateShiftPolicyToLegacyConfig(shiftMaster, shiftPolicy);
          }
      }
    }

    const employeeGrade = (shiftConfig || shiftMaster) ? null : await fetchEmployeeGrade({
      employee,
      Grade,
      tenantId,
      date: attendanceDate
    });
    const baseSettings = attendanceSettings?.toObject ? attendanceSettings.toObject() : attendanceSettings;
    const gradePolicy = buildGradeAttendanceSettings(baseSettings, employeeGrade);
    const effectiveSettings = shiftConfig
      ? buildEffectiveAttendanceSettings(baseSettings, shiftConfig)
      : gradePolicy.settings;
    let attendance = await Attendance.findOne({
      tenant: tenantId,
      employee: employee._id,
      date: attendanceDate
    });

    const requestedAction = String(actionType || 'AUTO').trim().toUpperCase();
    const lastLogType = getLastAttendanceLogType(attendance);

    let nextPunchType = requestedAction;
    if (!['IN', 'OUT'].includes(nextPunchType)) {
      nextPunchType = lastLogType === 'IN' ? 'OUT' : 'IN';
    }

    const sendAttendanceConflict = async (errorCode, message) => {
      const currentTrackingSession = await LiveTrackingSession.findOne({
        tenant: tenantId,
        employee: employee._id
      }).sort({ updatedAt: -1 });

      return res.status(409).json({
        success: false,
        status: 'REJECTED',
        error: errorCode,
        message,
        data: buildAttendanceConflictData(
          attendance,
          nextPunchType,
          currentTrackingSession ? buildSessionPayload(currentTrackingSession, employee, attendance) : null
        )
      });
    };

    if (nextPunchType === 'IN' && isAttendanceSessionOpen(attendance)) {
      return sendAttendanceConflict(
        'already_checked_in',
        'You are already checked in. Please check out first.'
      );
    }

    // ==== ENTERPRISE SHIFT POLICY: PUNCH WINDOW LIMITS ====
    if (nextPunchType === 'IN' && employee.shiftId) {
      try {
        const ShiftMaster = req.tenantDB.model('ShiftMaster');
        const ShiftPolicy = req.tenantDB.model('ShiftPolicy');
        
        const shiftMaster = await ShiftMaster.findById(employee.shiftId).lean();
        if (shiftMaster && shiftMaster.coreTiming && shiftMaster.coreTiming.startTime) {
          const shiftPolicy = await ShiftPolicy.findOne({ shiftMasterId: shiftMaster._id, tenant: tenantId, isCurrent: true }).lean();
          
          if (shiftPolicy?.attendanceRules?.punchWindow) {
            const { maxAdvancePunchInMinutes } = shiftPolicy.attendanceRules.punchWindow;
            if (maxAdvancePunchInMinutes !== undefined && maxAdvancePunchInMinutes !== null) {
              const dayjs = require('dayjs');
              const now = dayjs();
              const [hours, minutes] = shiftMaster.coreTiming.startTime.split(':');
              const shiftStartTimeToday = dayjs().hour(hours).minute(minutes).second(0);
              
              const diffMinutes = shiftStartTimeToday.diff(now, 'minute');
              
              if (diffMinutes > maxAdvancePunchInMinutes) {
                return res.status(403).json({
                  success: false,
                  status: 'REJECTED',
                  error: 'punch_in_too_early',
                  message: `You cannot punch in yet. You are only allowed to punch in ${maxAdvancePunchInMinutes} minutes before your shift starts (${shiftMaster.coreTiming.startTime}).`
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Error evaluating punch window limits:", err);
      }
    }
    // ======================================================

    if (nextPunchType === 'OUT' && !lastLogType && !attendance?.checkIn) {
      return sendAttendanceConflict(
        'missing_check_in',
        'Cannot check out before a successful check-in.'
      );
    }

    if (nextPunchType === 'OUT' && !isAttendanceSessionOpen(attendance)) {
      return sendAttendanceConflict(
        'already_checked_out',
        'You are already checked out. Please check in first.'
      );
    }

    const deviceBinding = await bindEmployeeDevice(Employee, employee, normalizedDevice);
    let matchResult = null;
    let livenessResult = null;
    const faceMandatory =
      isFaceRecognitionMandatory(effectiveSettings) ||
      isFaceRecognitionMandatory(baseSettings) ||
      isFaceRecognitionMandatory(shiftConfig) ||
      isFaceRecognitionMandatory(shiftConfig?.locationCfg);

    if (faceVerificationToken) {
      ({ matchResult, livenessResult } = verifyFaceVerificationToken(faceVerificationToken, {
        tenantId,
        employee,
        deviceFingerprint: normalizedDevice.fingerprint
      }));
    } else {
      const registeredFace = await findActiveRegisteredFace({
        FaceData,
        tenantId,
        employee,
        req
      });

      if (!registeredFace) {
        return res.status(404).json({
          success: false,
          status: 'REJECTED',
          error: 'no_registered_face',
          message: 'No verified face registration found. Please register your face first.'
        });
      } else {
        const registeredEmbedding = decryptStoredEmbedding(registeredFace.faceEmbedding);
        try {
          ({ matchResult, livenessResult } = await validateFaceAndLiveness({
            registeredEmbedding,
            faceEmbedding,
            faceImageData: submittedImage,
            liveFrames,
            livenessProof
          }));
        } catch (faceError) {
          throw faceError;
        }
      }
    }

    const geofence = Array.isArray(employee.geofence) && employee.geofence.length > 0
      ? employee.geofence
      : (Array.isArray(employee.geofance) ? employee.geofance : []);

    if (geofence.length >= 3) {
      const geofenceResult = faceService.validateGeofence(
        normalizedLocation,
        geofence,
        normalizedLocation.accuracy || TRACKING_CONFIG.requiredAccuracyMeters
      );

      if (!geofenceResult.valid) {
        return res.status(403).json({
          success: false,
          status: 'REJECTED',
          error: 'geofence_violation',
          message: geofenceResult.message
        });
      }
    }

    if (!attendance) {
      attendance = new Attendance({
        tenant: tenantId,
        employee: employee._id,
        date: attendanceDate,
        status: 'present',
        logs: []
      });
    }

    const [activeSession, recentSession, previousAttendance] = await Promise.all([
      LiveTrackingSession.findOne({
        tenant: tenantId,
        employee: employee._id,
        status: { $in: ['ACTIVE', 'SUSPICIOUS'] }
      }).sort({ createdAt: -1 }),
      LiveTrackingSession.findOne({
        tenant: tenantId,
        employee: employee._id
      }).sort({ updatedAt: -1 }),
      Attendance.findOne({
        tenant: tenantId,
        employee: employee._id,
        _id: attendance?._id ? { $ne: attendance._id } : { $exists: true }
      }).sort({ updatedAt: -1 })
    ]);

    const previousPoint =
      resolveSessionReferencePoint(activeSession) ||
      resolveAttendanceReferencePoint(attendance) ||
      resolveSessionReferencePoint(recentSession) ||
      resolveAttendanceReferencePoint(previousAttendance);

    const securityCheck = evaluateLocationSecurity({
      previousPoint,
      currentPoint: normalizedLocation,
      boundDeviceFingerprint: deviceBinding?.fingerprint || '',
      currentDeviceFingerprint: normalizedDevice.fingerprint || '',
      mockedLocation: Boolean(submittedLocation?.mocked)
    });

    if (securityCheck.blocked) {
      return res.status(403).json({
        success: false,
        status: 'REJECTED',
        error: 'security_validation_failed',
        message: 'Attendance was blocked because the device does not match the bound session.',
        details: securityCheck
      });
    }

    const flagSummary = buildFlagSummary({
      matchResult,
      securityCheck,
      nextPunchType,
      baseCodes: [
        ...(gpsDecision.flagged ? [gpsDecision.flagCode] : []),
        ...(matchResult?.confidence === 'UNREGISTERED_PROFILE' ? ['unregistered_face_profile'] : []),
        ...(matchResult?.confidence === 'FACE_MATCH_REVIEW' ? ['face_match_review'] : [])
      ],
      livenessResult
    });
    const displayLocationResult = resolveDisplayLocation({
      currentPoint: normalizedLocation,
      previousDisplayPoint:
        activeSession?.lastLocation ||
        attendance?.tracking?.lastLocation ||
        recentSession?.lastLocation ||
        previousAttendance?.tracking?.lastLocation ||
        null,
      geofence,
      securityCheck
    });
    const displayLocation = displayLocationResult.location || normalizedLocation;

    const recommendedIntervalSec = getRecommendedTrackingInterval({
      speedMps: normalizedLocation.speed,
      batteryLevel: toFiniteNumber(battery?.level),
      isCharging: Boolean(battery?.charging),
      visibilityState: 'visible'
    });

    attendance.status = 'present';
    attendance.faceVerified = true;
    attendance.gpsValidated = gpsDecision.status === 'VERIFIED';
    attendance.verificationStatus = flagSummary.flagged ? 'FLAGGED' : gpsDecision.status;
    attendance.employeeId = employee.employeeId || attendance.employeeId || String(employee._id);
    attendance.deviceType = resolvedDeviceType;
    attendance.deviceId = normalizedDevice.fingerprint || attendance.deviceId;
    attendance.deviceFingerprint = normalizedDevice.fingerprint || attendance.deviceFingerprint;
    attendance.deviceInfo = {
      fingerprint: normalizedDevice.fingerprint || '',
      deviceType: resolvedDeviceType,
      userAgent: normalizedDevice.userAgent || '',
      platform: normalizedDevice.platform || '',
      language: normalizedDevice.language || '',
      timezone: normalizedDevice.timezone || '',
      hardwareConcurrency: toFiniteNumber(normalizedDevice.hardwareConcurrency),
      deviceMemory: toFiniteNumber(normalizedDevice.deviceMemory)
    };
    attendance.faceConfidence = Number(toFiniteNumber(matchResult.similarity, 0).toFixed(4));
    attendance.faceVerification = {
      verifiedAt: now,
      livenessScore: livenessResult.confidence || 0,
      matchScore: matchResult.matchScore || 0,
      similarity: matchResult.similarity || 0,
      method: 'FACE_GPS'
    };
    attendance.flagReasons = Array.isArray(attendance.flagReasons)
      ? [...new Set([...(attendance.flagReasons || []), ...flagSummary.reasons])]
      : [...flagSummary.reasons];
    attendance.flagged = Boolean(attendance.flagged) || flagSummary.flagged;
    attendance.flagReason = attendance.flagReasons[0] || '';
    attendance.tracking = attendance.tracking || {};
    attendance.tracking.lastHeartbeatAt = now;
    attendance.tracking.lastLocation = displayLocation;
    attendance.tracking.recommendedIntervalSec = recommendedIntervalSec;
    attendance.lat = displayLocation.lat;
    attendance.lng = displayLocation.lng;
    attendance.accuracy = normalizedLocation.accuracy;
    attendance.securityFlags = Array.isArray(attendance.securityFlags)
      ? [...new Set([...(attendance.securityFlags || []), ...flagSummary.codes])]
      : [...flagSummary.codes];

    if (nextPunchType === 'IN') {
      if (!attendance.checkIn) {
        attendance.checkIn = now;
        attendance.checkInTime = now;
        attendance.checkInLocation = displayLocation;
      }
      attendance.checkInImage = submittedImage;
      attendance.gpsLocation = { lat: displayLocation.lat, lng: displayLocation.lng };
      attendance.checkOut = null;
      attendance.checkOutTime = null;
      attendance.checkOutLocation = null;
      attendance.tracking.stoppedAt = null;
      attendance.tracking.startedAt = now;
      attendance.tracking.status = 'ACTIVE';
    } else {
      attendance.checkOut = now;
      attendance.checkOutTime = now;
      attendance.checkOutLocation = displayLocation;
      attendance.checkOutImage = submittedImage;
      attendance.tracking.stoppedAt = now;
      attendance.tracking.status = 'STOPPED';
    }

    appendPathPoint(
      attendance,
      displayLocation,
      nextPunchType === 'IN' ? 'CHECK_IN' : 'CHECK_OUT',
      flagSummary.codes,
      Boolean(submittedLocation?.mocked)
    );

    attendance.logs.push({
      time: now,
      type: nextPunchType,
      device: normalizedDevice.platform || 'WEB',
      method: 'FACE_GPS',
      location: toAttendanceLogLocation(displayLocation),
      latitude: displayLocation.lat,
      longitude: displayLocation.lng,
      accuracy: normalizedLocation.accuracy,
      speed: normalizedLocation.speed,
      heading: normalizedLocation.heading,
      securityFlags: flagSummary.codes,
      deviceFingerprint: normalizedDevice.fingerprint || ''
    });
    attendance.workingHours = calculateWorkingHours(attendance.logs);

    const startOfMonth = new Date(attendanceDate.getFullYear(), attendanceDate.getMonth(), 1);
    const [accumulatedLateCount, accumulatedEarlyExitCount] = await Promise.all([
      Attendance.countDocuments({
        employee: employee._id,
        tenant: tenantId,
        date: { $gte: startOfMonth, $lt: attendanceDate },
        isLate: true
      }),
      Attendance.countDocuments({
        employee: employee._id,
        tenant: tenantId,
        date: { $gte: startOfMonth, $lt: attendanceDate },
        isEarlyOut: true
      })
    ]);

    let rulesResult = null;
    if (nextPunchType === 'OUT' || attendance.checkOut) {
      rulesResult = applyAttendanceRules({
        date: attendanceDate,
        employeeId: employee._id,
        logs: attendance.logs,
        workingHours: attendance.workingHours,
        baseStatus: attendance.status,
        settings: effectiveSettings,
        accumulatedLateCount,
        accumulatedEarlyExitCount,
        shiftPolicy: shiftPolicy
      });

      attendance.status = rulesResult.status;
      attendance.isLate = rulesResult.isLate;
      attendance.isEarlyOut = rulesResult.isEarlyOut;
      attendance.workingHours = rulesResult.workingHours;
      attendance.lateMinutes = rulesResult.lateMinutes;
      attendance.earlyExitMinutes = rulesResult.earlyExitMinutes;
      attendance.isWFH = !!rulesResult.isWFH;
      attendance.isOnDuty = !!rulesResult.isOnDuty;
      attendance.isCompOffDay = !!rulesResult.isCompOffDay;
      attendance.isNightShift = !!rulesResult.isNightShift;
      attendance.lopDays = rulesResult.lopDays;
      
      if (rulesResult.otMinutes > 0) {
          attendance.overtimeHours = parseFloat((rulesResult.otMinutes / 60).toFixed(2));
          if (rulesResult.meta) {
              rulesResult.meta.otMultiplierApplied = rulesResult.otMultiplierApplied;
          }
      } else {
          attendance.overtimeHours = 0;
      }

      attendance.ruleEngineVersion = rulesResult.engineVersion;
      attendance.ruleEngineMeta = rulesResult.meta;
    } else {
      const lateEarly = evaluateLateAndEarly({
        date: attendanceDate,
        logs: attendance.logs,
        settings: effectiveSettings
      });
      attendance.status = 'present';
      attendance.isLate = lateEarly.isLate;
      attendance.lateMinutes = lateEarly.lateMinutes;
      attendance.isEarlyOut = false;
      attendance.earlyExitMinutes = 0;
    }

    attendance.ruleEngineVersion = rulesResult?.engineVersion || 2;
    attendance.ruleEngineMeta = {
      ...(rulesResult?.meta || {}),
      policySource: shiftConfig ? 'shift' : gradePolicy.source,
      shiftId: shiftConfig?._id || null,
      gradeId: gradePolicy.grade?._id || null,
      gradeCode: gradePolicy.grade?.code || '',
      gradeTiming: gradePolicy.timing,
    };

    await attendance.save();

    let trackingSession = activeSession;
    const sessionStatus = flagSummary.flagged ? 'SUSPICIOUS' : 'ACTIVE';
    if (nextPunchType === 'IN') {
      if (!trackingSession) {
        trackingSession = new LiveTrackingSession({
          tenant: tenantId,
          employee: employee._id,
          attendance: attendance._id,
          dateKey: buildDateKey(now),
          status: sessionStatus,
          online: true,
          checkInTime: now,
          startedAt: now,
          lastHeartbeatAt: now,
          recommendedIntervalSec,
          startLocation: displayLocation,
          lastLocation: displayLocation,
          device: {
            fingerprint: normalizedDevice.fingerprint || '',
            trusted: !securityCheck.flags.deviceMismatch,
            firstSeenAt: now,
            lastSeenAt: now,
            userAgent: normalizedDevice.userAgent || '',
            platform: normalizedDevice.platform || '',
            bindingSource: 'ATTENDANCE_MARK'
          },
          security: {
            spoofDetected: securityCheck.suspected || flagSummary.flagged,
            lastReasons: flagSummary.reasons,
            maxSpeedKmh: securityCheck.metrics.computedSpeedKmh,
            lastComputedSpeedKmh: securityCheck.metrics.computedSpeedKmh,
            lastJumpDistanceMeters: securityCheck.metrics.jumpDistanceMeters,
            deviceMismatchCount: securityCheck.flags.deviceMismatch ? 1 : 0
          },
          meta: {
            lastRawLocation: normalizedLocation,
            displayLocationStrategy: displayLocationResult.strategy || 'raw'
          }
        });
      } else {
        trackingSession.status = sessionStatus;
        trackingSession.online = true;
        trackingSession.attendance = attendance._id;
        trackingSession.checkOutTime = null;
        trackingSession.stoppedAt = null;
        trackingSession.stopReason = '';
        trackingSession.lastHeartbeatAt = now;
        trackingSession.lastLocation = displayLocation;
        trackingSession.recommendedIntervalSec = recommendedIntervalSec;
        trackingSession.device = {
          ...trackingSession.device?.toObject?.(),
          fingerprint: normalizedDevice.fingerprint || trackingSession.device?.fingerprint || '',
          trusted: !securityCheck.flags.deviceMismatch,
          firstSeenAt: trackingSession.device?.firstSeenAt || now,
          lastSeenAt: now,
          userAgent: normalizedDevice.userAgent || trackingSession.device?.userAgent || '',
          platform: normalizedDevice.platform || trackingSession.device?.platform || '',
          bindingSource: trackingSession.device?.bindingSource || 'ATTENDANCE_MARK'
        };
        trackingSession.meta = {
          ...(trackingSession.meta || {}),
          lastRawLocation: normalizedLocation,
          displayLocationStrategy: displayLocationResult.strategy || 'raw'
        };
      }
    } else if (trackingSession) {
      trackingSession.status = 'STOPPED';
      trackingSession.online = false;
      trackingSession.checkOutTime = now;
      trackingSession.stoppedAt = now;
      trackingSession.lastHeartbeatAt = now;
      trackingSession.lastLocation = displayLocation;
      trackingSession.stopReason = 'CHECK_OUT';
      trackingSession.recommendedIntervalSec = recommendedIntervalSec;
      trackingSession.meta = {
        ...(trackingSession.meta || {}),
        lastRawLocation: normalizedLocation,
        displayLocationStrategy: displayLocationResult.strategy || 'raw'
      };
    }

    if (!trackingSession && nextPunchType === 'OUT') {
      trackingSession = new LiveTrackingSession({
        tenant: tenantId,
        employee: employee._id,
        attendance: attendance._id,
        dateKey: buildDateKey(now),
        status: 'STOPPED',
        online: false,
        checkInTime: attendance.checkIn || null,
        checkOutTime: now,
        startedAt: attendance.checkIn || now,
        stoppedAt: now,
        lastHeartbeatAt: now,
        recommendedIntervalSec,
        startLocation: attendance.checkInLocation || displayLocation,
        lastLocation: displayLocation,
        stopReason: 'CHECK_OUT',
        meta: {
          lastRawLocation: normalizedLocation,
          displayLocationStrategy: displayLocationResult.strategy || 'raw'
        }
      });
    }

    if (trackingSession) {
      trackingSession.totalUpdates = (trackingSession.totalUpdates || 0) + 1;
      trackingSession.suspiciousUpdateCount =
        (trackingSession.suspiciousUpdateCount || 0) + (flagSummary.flagged ? 1 : 0);
      trackingSession.security = {
        ...(trackingSession.security?.toObject?.() || trackingSession.security || {}),
        spoofDetected:
          Boolean(trackingSession.security?.spoofDetected) || securityCheck.suspected || flagSummary.flagged,
        lastReasons: flagSummary.reasons,
        maxSpeedKmh: Math.max(
          toFiniteNumber(trackingSession.security?.maxSpeedKmh, 0),
          securityCheck.metrics.computedSpeedKmh
        ),
        lastComputedSpeedKmh: securityCheck.metrics.computedSpeedKmh,
        lastJumpDistanceMeters: securityCheck.metrics.jumpDistanceMeters,
        deviceMismatchCount:
          toFiniteNumber(trackingSession.security?.deviceMismatchCount, 0) +
          (securityCheck.flags.deviceMismatch ? 1 : 0)
      };
      await trackingSession.save();

      attendance.tracking.sessionId = trackingSession._id;
      await attendance.save();
    }

    const trackingPoint = await createTrackingPoint({
      LiveTracking,
      tenantId,
      employeeId: employee._id,
      attendanceId: attendance._id,
      sessionId: trackingSession?._id,
      locationSnapshot: displayLocation,
      rawLocationSnapshot: normalizedLocation,
      device: normalizedDevice,
      securityCheck,
      source: nextPunchType === 'IN' ? 'CHECK_IN' : 'CHECK_OUT',
      intervalSeconds: recommendedIntervalSec,
      battery,
      network,
      meta: {
        employeeId: attendance.employeeId,
        flagged: attendance.flagged,
        flagReasons: attendance.flagReasons,
        action: nextPunchType,
        faceConfidence: attendance.faceConfidence,
        livenessConfidence: livenessResult.confidence || 0,
        matchScore: matchResult.matchScore || 0,
        deviceId: attendance.deviceId,
        displayLocationStrategy: displayLocationResult.strategy || 'raw'
      }
    });

    const sessionPayload = buildSessionPayload(trackingSession, employee, attendance);
    const responseStatus = attendance.flagged ? 'FLAGGED' : 'VERIFIED';

    emitTrackingLocationUpdate(tenantId, {
      ...sessionPayload,
      locationPointId: trackingPoint._id,
      security: {
        ...sessionPayload.security,
        lastReasons: attendance.flagReasons
      },
      currentLocation: displayLocation
    });

    emitTrackingSessionUpdate(tenantId, sessionPayload);

    return res.json({
      success: true,
      status: responseStatus,
      flagged: attendance.flagged,
      reason: attendance.flagReason || undefined,
      flagReason: attendance.flagReason || undefined,
      message: gpsDecision.flagged
        ? gpsDecision.message
        : attendance.flagged
          ? 'Attendance marked successfully and flagged for admin review.'
        : nextPunchType === 'IN'
          ? 'Location verified'
          : 'Attendance checked out successfully.',
      data: {
        action: nextPunchType,
        attendanceId: attendance._id,
        attendance: {
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          workingHours: attendance.workingHours,
          status: attendance.status,
          verificationStatus: responseStatus,
          flagged: attendance.flagged,
          flagReason: attendance.flagReason,
          flagReasons: attendance.flagReasons,
          faceConfidence: attendance.faceConfidence,
          accuracy: attendance.accuracy,
          deviceType: attendance.deviceType,
          deviceId: attendance.deviceId
        },
        faceVerified: true,
        match: matchResult,
        liveness: livenessResult,
        security: securityCheck,
        tracking: sessionPayload
      }
    });
  } catch (error) {
    console.error('[MARK ATTENDANCE ERROR]', error);
    return res.status(error.status || 500).json({
      success: false,
      status: 'REJECTED',
      error: error.code || 'attendance_mark_failed',
      message: error.message || 'Failed to mark attendance.',
      details: error.details || null
    });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const {
      sessionId = null,
      attendanceId = null,
      location = null,
      device = {},
      battery = null,
      network = null,
      intervalSeconds = null,
      trackingState = 'ACTIVE',
      stopReason = '',
      visibilityState = 'visible',
      clientMeetingId = null
    } = req.body || {};

    await requireTenantDbContext(req);
    const tenantId = req.tenantId;

    const { Attendance, Employee, LiveTracking, LiveTrackingSession } = getModels(req);
    const employee = await resolveEmployeeContext(req, Employee);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'employee_not_found',
        message: 'Employee record not found for the current tenant.'
      });
    }

    let trackingSession = null;
    if (sessionId && mongoose.Types.ObjectId.isValid(String(sessionId))) {
      trackingSession = await LiveTrackingSession.findOne({
        _id: sessionId,
        tenant: tenantId,
        employee: employee._id
      });
    }

    if (!trackingSession) {
      trackingSession = await LiveTrackingSession.findOne({
        tenant: tenantId,
        employee: employee._id,
        status: { $in: ['ACTIVE', 'SUSPICIOUS'] }
      }).sort({ updatedAt: -1 });
    }

    if (!trackingSession || !['ACTIVE', 'SUSPICIOUS'].includes(trackingSession.status)) {
      return res.status(409).json({
        success: false,
        error: 'tracking_session_inactive',
        message: 'Location updates are only allowed for active attendance sessions.'
      });
    }

    const activeAttendanceId =
      normalizeObjectId(trackingSession.attendance) || normalizeObjectId(attendanceId);
    const activeAttendance = activeAttendanceId
      ? await Attendance.findOne({
          _id: activeAttendanceId,
          tenant: tenantId,
          employee: employee._id
        })
      : null;

    if (activeAttendance && !isAttendanceSessionOpen(activeAttendance)) {
      await stopStaleTrackingSession(trackingSession, 'CHECK_OUT');
      return res.status(409).json({
        success: false,
        error: 'tracking_session_inactive',
        message: 'Attendance is already checked out. Live tracking has been stopped.'
      });
    }

    const activeClientMeeting = getActiveClientMeeting(trackingSession);
    const requestedClientMeetingId = String(clientMeetingId || req.body?.meetingId || '').trim();
    const isClientMeetingUpdate = Boolean(
      String(trackingState || '').toUpperCase() === 'ACTIVE' &&
      activeClientMeeting &&
      (!requestedClientMeetingId || String(activeClientMeeting.id || '') === requestedClientMeetingId)
    );

    if (requestedClientMeetingId && !isClientMeetingUpdate) {
      return res.status(409).json({
        success: false,
        error: 'client_meeting_inactive',
        message: 'No active client meeting was found for this tracking session.'
      });
    }

    const normalizedDevice = {
      ...device,
      fingerprint: String(device?.fingerprint || '').trim(),
      deviceType: inferDeviceType(device?.deviceType || '', device)
    };
    const locationPayload = getLocationPayload(req.body);
    const normalizedLocation = locationPayload ? ensureValidLocation(locationPayload) : null;
    const geofence = Array.isArray(employee.geofence) && employee.geofence.length > 0
      ? employee.geofence
      : (Array.isArray(employee.geofance) ? employee.geofance : []);
    const boundFingerprint =
      trackingSession.device?.fingerprint ||
      employee?.attendanceSecurity?.deviceBinding?.fingerprint ||
      '';
    const previousSecurityPoint =
      trackingSession?.meta?.lastRawLocation ||
      trackingSession.lastLocation;

    const rawSecurityCheck = normalizedLocation
      ? evaluateLocationSecurity({
          previousPoint: previousSecurityPoint,
          currentPoint: normalizedLocation,
          boundDeviceFingerprint: boundFingerprint,
          currentDeviceFingerprint: normalizedDevice.fingerprint || '',
          mockedLocation: Boolean(locationPayload?.mocked)
        })
      : {
          suspected: false,
          blocked: false,
          severity: 'NONE',
          reasons: [],
          metrics: { computedSpeedKmh: 0, jumpDistanceMeters: 0, timeDeltaSec: 0 },
          flags: {
            poorAccuracy: false,
            deviceMismatch: false,
            mockedLocation: false
          }
        };
    const securityCheck = softenTrackingSecurityCheck(rawSecurityCheck);

    const flagSummary = buildFlagSummary({
      matchResult: null,
      securityCheck,
      nextPunchType: 'TRACKER'
    });

    const displayLocationResult = normalizedLocation
      ? resolveDisplayLocation({
          currentPoint: normalizedLocation,
          previousDisplayPoint: trackingSession.lastLocation || trackingSession.startLocation,
          geofence,
          securityCheck
        })
      : { location: null, strategy: 'none' };
    const displayLocation = displayLocationResult.location || normalizedLocation;

    const recommendedIntervalSec =
      intervalSeconds ||
      getRecommendedTrackingInterval({
        speedMps: normalizedLocation?.speed,
        batteryLevel: toFiniteNumber(battery?.level),
        isCharging: Boolean(battery?.charging),
        visibilityState
      });

    trackingSession.recommendedIntervalSec = recommendedIntervalSec;
    trackingSession.lastHeartbeatAt = new Date();
    trackingSession.online = trackingState === 'ACTIVE';

    if (displayLocation) {
      trackingSession.lastLocation = displayLocation;
      trackingSession.totalUpdates = (trackingSession.totalUpdates || 0) + 1;
    }
    const sessionMeta = getSessionMeta(trackingSession);
    if (isClientMeetingUpdate) {
      const distanceUpdate = addMeetingDistance(
        activeClientMeeting.totalDistanceMeters || activeClientMeeting.distanceMeters || 0,
        activeClientMeeting.lastLocation || trackingSession.lastLocation || trackingSession.startLocation,
        displayLocation,
        { plannedDistanceMeters: activeClientMeeting.plannedDistanceMeters || activeClientMeeting.plannedRoute?.distanceMeters }
      );
      sessionMeta.activeClientMeeting = {
        ...activeClientMeeting,
        lastLocation: displayLocation || activeClientMeeting.lastLocation || null,
        totalUpdates: Number(activeClientMeeting.totalUpdates || 0) + (displayLocation ? 1 : 0),
        totalDistanceMeters: distanceUpdate.totalDistanceMeters,
        lastSegmentDistanceMeters: distanceUpdate.segmentDistanceMeters,
        ignoredSegmentDistanceMeters: distanceUpdate.ignoredSegmentDistanceMeters,
        lastUpdatedAt: new Date()
      };
      sessionMeta.clientMeetingHistory = upsertClientMeetingHistory(
        sessionMeta.clientMeetingHistory,
        sessionMeta.activeClientMeeting
      );
    }
    setSessionMeta(trackingSession, {
      ...sessionMeta,
      lastRawLocation: normalizedLocation || trackingSession?.meta?.lastRawLocation || null,
      displayLocationStrategy: displayLocationResult.strategy || 'raw'
    });

    if (trackingState === 'PAUSED') {
      trackingSession.status = 'PAUSED';
      trackingSession.online = false;
      trackingSession.stopReason = stopReason || 'LOGOUT';
    } else if (trackingState === 'STOPPED') {
      trackingSession.status = 'STOPPED';
      trackingSession.online = false;
      trackingSession.stoppedAt = new Date();
      trackingSession.stopReason = stopReason || 'STOPPED';
    } else if (securityCheck.suspected) {
      trackingSession.status = 'SUSPICIOUS';
      trackingSession.online = true;
    } else {
      trackingSession.status = 'ACTIVE';
    }

    if (securityCheck.suspected) {
      trackingSession.suspiciousUpdateCount = (trackingSession.suspiciousUpdateCount || 0) + 1;
      trackingSession.security = {
        ...(trackingSession.security?.toObject?.() || trackingSession.security || {}),
        spoofDetected: true,
        lastReasons: flagSummary.reasons,
        maxSpeedKmh: Math.max(
          toFiniteNumber(trackingSession.security?.maxSpeedKmh, 0),
          securityCheck.metrics.computedSpeedKmh
        ),
        lastComputedSpeedKmh: securityCheck.metrics.computedSpeedKmh,
        lastJumpDistanceMeters: securityCheck.metrics.jumpDistanceMeters,
        deviceMismatchCount:
          toFiniteNumber(trackingSession.security?.deviceMismatchCount, 0) +
          (securityCheck.flags.deviceMismatch ? 1 : 0)
      };
    }

    if (device?.fingerprint) {
      trackingSession.device = {
        ...(trackingSession.device?.toObject?.() || trackingSession.device || {}),
        fingerprint: normalizedDevice.fingerprint,
        trusted: !securityCheck.flags.deviceMismatch,
        firstSeenAt: trackingSession.device?.firstSeenAt || new Date(),
        lastSeenAt: new Date(),
        userAgent: normalizedDevice.userAgent || trackingSession.device?.userAgent || '',
        platform: normalizedDevice.platform || trackingSession.device?.platform || '',
        bindingSource: trackingSession.device?.bindingSource || 'TRACKING_RESUME'
      };
    }

    await trackingSession.save();

    let trackingPoint = null;
    const resolvedAttendanceId =
      normalizeObjectId(trackingSession.attendance) || normalizeObjectId(attendanceId);

    if (normalizedLocation) {
      trackingPoint = await createTrackingPoint({
        LiveTracking,
        tenantId,
        employeeId: employee._id,
        attendanceId: resolvedAttendanceId,
        sessionId: trackingSession._id,
        locationSnapshot: displayLocation,
        rawLocationSnapshot: normalizedLocation,
        device: normalizedDevice,
        securityCheck,
        source: isClientMeetingUpdate
          ? 'CLIENT_MEETING'
          : trackingState === 'STOPPED'
            ? 'CHECK_OUT'
            : trackingState === 'PAUSED'
              ? 'LOGOUT'
              : 'TRACKER',
        intervalSeconds: recommendedIntervalSec,
        battery,
        network,
        meta: {
          flagged: flagSummary.flagged,
          flagReasons: flagSummary.reasons,
          visibilityState,
          trackingState,
          clientMeeting: isClientMeetingUpdate
            ? normalizeClientMeetingForResponse(sessionMeta.activeClientMeeting)
            : null,
          displayLocationStrategy: displayLocationResult.strategy || 'raw'
        }
      });
    }

    let attendanceRecord = null;
    if (resolvedAttendanceId) {
      attendanceRecord = await Attendance.findOne({
        _id: resolvedAttendanceId,
        tenant: tenantId
      });
    }

    if (attendanceRecord) {
      attendanceRecord.tracking = attendanceRecord.tracking || {};
      attendanceRecord.tracking.lastHeartbeatAt = trackingSession.lastHeartbeatAt;
      attendanceRecord.tracking.lastLocation = displayLocation || trackingSession.lastLocation;
      attendanceRecord.tracking.status = trackingSession.status;
      attendanceRecord.tracking.recommendedIntervalSec = recommendedIntervalSec;

      if (displayLocation) {
        attendanceRecord.lat = displayLocation.lat;
        attendanceRecord.lng = displayLocation.lng;
        attendanceRecord.accuracy = normalizedLocation.accuracy;
        appendPathPoint(
          attendanceRecord,
          displayLocation,
          trackingState === 'STOPPED'
            ? 'CHECK_OUT'
            : isClientMeetingUpdate
              ? 'CLIENT_MEETING'
              : 'TRACKER',
          flagSummary.codes,
          Boolean(locationPayload?.mocked)
        );
      }

      attendanceRecord.gpsValidated = !securityCheck.flags.poorAccuracy;
      attendanceRecord.deviceType = normalizedDevice.deviceType || attendanceRecord.deviceType;
      attendanceRecord.deviceId = normalizedDevice.fingerprint || attendanceRecord.deviceId;
      attendanceRecord.securityFlags = Array.isArray(attendanceRecord.securityFlags)
        ? [...new Set([...(attendanceRecord.securityFlags || []), ...flagSummary.codes])]
        : [...flagSummary.codes];
      attendanceRecord.flagReasons = Array.isArray(attendanceRecord.flagReasons)
        ? [...new Set([...(attendanceRecord.flagReasons || []), ...flagSummary.reasons])]
        : [...flagSummary.reasons];
      attendanceRecord.flagged = Boolean(attendanceRecord.flagged) || flagSummary.flagged;
      attendanceRecord.flagReason = attendanceRecord.flagReasons[0] || '';
      attendanceRecord.verificationStatus = attendanceRecord.flagged ? 'FLAGGED' : 'VERIFIED';

      await Attendance.updateOne({ _id: attendanceRecord._id }, { $set: { securityFlags: attendanceRecord.securityFlags, flagReasons: attendanceRecord.flagReasons, flagged: attendanceRecord.flagged, flagReason: attendanceRecord.flagReason, verificationStatus: attendanceRecord.verificationStatus } });
    }

    const sessionPayload = buildSessionPayload(
      trackingSession,
      employee,
      attendanceRecord || { _id: resolvedAttendanceId || trackingSession.attendance || null }
    );

    emitTrackingSessionUpdate(tenantId, sessionPayload);

    if (normalizedLocation) {
      emitTrackingLocationUpdate(tenantId, {
        ...sessionPayload,
        locationPointId: trackingPoint?._id || null,
        currentLocation: displayLocation,
        security: {
          ...sessionPayload.security,
          lastReasons: sessionPayload.flagReasons
        }
      });
    }

    return res.json({
      success: true,
      status: sessionPayload.flagged ? 'FLAGGED' : 'VERIFIED',
      flagged: sessionPayload.flagged,
      reason: sessionPayload.flagReason || undefined,
      message: 'Location update stored successfully.',
      data: {
        tracking: sessionPayload,
        security: securityCheck,
        recommendedIntervalSec
      }
    });
  } catch (error) {
    console.error('[LOCATION UPDATE ERROR]', {
      message: error?.message,
      code: error?.code,
      status: error?.status,
      stack: error?.stack
    });
    return res.status(error.status || 500).json({
      success: false,
      error: error.code || 'location_update_failed',
      message: error.message || 'Failed to store location update.'
    });
  }
};

exports.getMyTrackingStatus = async (req, res) => {
  try {
    await requireTenantDbContext(req);
    const tenantId = req.tenantId;
    const { Attendance, Employee, LiveTrackingSession } = getModels(req);
    const employee = await resolveEmployeeContext(req, Employee);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'employee_not_found',
        message: 'Employee record not found for the current tenant.'
      });
    }

    const todayKey = buildDateKey(new Date());
    const trackingSession = await LiveTrackingSession.findOne({
      tenant: tenantId,
      employee: employee._id,
      $or: [
        { status: { $in: ['ACTIVE', 'SUSPICIOUS'] } },
        { dateKey: todayKey }
      ]
    }).sort({ updatedAt: -1 });

    const attendance = trackingSession?.attendance
      ? await Attendance.findOne({ _id: trackingSession.attendance, tenant: tenantId })
      : await Attendance.findOne({
          tenant: tenantId,
          employee: employee._id,
          date: {
            $gte: normalizeTimestamp(todayKey),
            $lt: new Date(normalizeTimestamp(todayKey).getTime() + 24 * 60 * 60 * 1000)
          }
        }).sort({ updatedAt: -1 });

    let resolvedTrackingSession = trackingSession;
    const attendanceOpen = isAttendanceSessionOpen(attendance);
    if (
      attendance &&
      resolvedTrackingSession &&
      !attendanceOpen &&
      ['ACTIVE', 'SUSPICIOUS'].includes(resolvedTrackingSession.status)
    ) {
      resolvedTrackingSession = await stopStaleTrackingSession(resolvedTrackingSession, 'CHECK_OUT');
    } else if (attendanceOpen && resolvedTrackingSession) {
      resolvedTrackingSession = await clearOpenTrackingStopFields(resolvedTrackingSession);
    }

    const tracking = resolvedTrackingSession
      ? buildSessionPayload(resolvedTrackingSession, employee, attendance || { _id: resolvedTrackingSession.attendance })
      : null;

    return res.json({
      success: true,
      data: {
        employee: buildEmployeeSummary(employee),
        checkedIn: attendanceOpen || Boolean(attendance?.checkIn),
        checkedOut: Boolean(attendance?.checkOut) && !attendanceOpen,
        attendanceId: attendance?._id || null,
        tracking,
        activeClientMeeting: tracking?.activeClientMeeting || null,
        lastClientMeeting: tracking?.lastClientMeeting || null,
        currentLocation:
          tracking?.currentLocation ||
          attendance?.tracking?.lastLocation ||
          null
      }
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.code || 'tracking_status_failed',
      message: error.message || 'Failed to fetch tracking status.'
    });
  }
};

exports.searchClientMeetingPlaces = async (req, res) => {
  const query = sanitizeMeetingText(req.query?.q || req.query?.query, 140);
  if (query.length < 2) {
    return res.json({
      success: true,
      data: { places: [] }
    });
  }

  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 6, 1), 8);
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    namedetails: '1',
    'accept-language': 'en',
    limit: String(limit),
    q: query
  });

  const lat = toFiniteNumber(req.query?.lat);
  const lng = toFiniteNumber(req.query?.lng);
  if (lat !== null && lng !== null) {
    const span = 0.8;
    params.set('viewbox', `${lng - span},${lat + span},${lng + span},${lat - span}`);
    params.set('bounded', '0');
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 8000);

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      signal: abortController.signal,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'User-Agent': process.env.PLACE_SEARCH_USER_AGENT || 'GT-HRMS/1.0 (client-meeting-place-search)'
      }
    });

    if (!response.ok) {
      throw createApiError(
        502,
        'place_search_unavailable',
        'Client place search is temporarily unavailable.'
      );
    }

    const body = await response.json();
    const places = Array.isArray(body)
      ? body.map(normalizePlaceSearchResult).filter(Boolean)
      : [];

    return res.json({
      success: true,
      data: { places }
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    return res.status(isTimeout ? 504 : error.status || 500).json({
      success: false,
      error: isTimeout ? 'place_search_timeout' : error.code || 'place_search_failed',
      message: isTimeout
        ? 'Client place search timed out. Try again.'
        : error.message || 'Failed to search client places.'
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

exports.previewClientMeetingRoute = async (req, res) => {
  const body = req.body || {};
  const fromLocation = normalizeOptionalLocation(
    body.fromLocation ||
      body.startLocation ||
      body.originLocation ||
      (body.fromLat !== undefined && body.fromLng !== undefined
        ? { lat: body.fromLat, lng: body.fromLng }
        : null)
  );
  const toLocation = normalizeOptionalLocation(
    body.toLocation ||
      body.destinationLocation ||
      body.endLocation ||
      (body.toLat !== undefined && body.toLng !== undefined
        ? { lat: body.toLat, lng: body.toLng }
        : null)
  );

  if (!fromLocation || !toLocation) {
    return res.status(400).json({
      success: false,
      error: 'route_points_required',
      message: 'Starting point and ending point are required to preview a route.'
    });
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 10000);
  const fromLng = encodeURIComponent(String(fromLocation.lng));
  const fromLat = encodeURIComponent(String(fromLocation.lat));
  const toLng = encodeURIComponent(String(toLocation.lng));
  const toLat = encodeURIComponent(String(toLocation.lat));
  const osrmUrl =
    `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}` +
    '?overview=full&geometries=geojson&steps=false&alternatives=false';

  try {
    const response = await fetch(osrmUrl, {
      signal: abortController.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': process.env.PLACE_SEARCH_USER_AGENT || 'GT-HRMS/1.0 (client-meeting-route-preview)'
      }
    });

    if (!response.ok) {
      throw createApiError(502, 'route_preview_unavailable', 'Route preview is temporarily unavailable.');
    }

    const bodyJson = await response.json();
    const route = Array.isArray(bodyJson?.routes) ? bodyJson.routes[0] : null;
    const routePreview = route
      ? buildOsrmRoutePreview(fromLocation, toLocation, route)
      : buildDirectRoutePreview(fromLocation, toLocation, 'route_not_found');

    return res.json({
      success: true,
      data: { route: routePreview }
    });
  } catch (error) {
    const routePreview = buildDirectRoutePreview(
      fromLocation,
      toLocation,
      error?.name === 'AbortError' ? 'route_preview_timeout' : 'route_preview_failed'
    );

    return res.json({
      success: true,
      warning: error?.name === 'AbortError' ? 'route_preview_timeout' : error.code || 'route_preview_failed',
      message: 'Showing direct route until road route is available.',
      data: { route: routePreview }
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

exports.startClientMeeting = async (req, res) => {
  try {
    const {
      LiveTracking,
      attendance,
      employee,
      tenantId,
      trackingSession
    } = await resolveActiveTrackingContext(req);

    const existingMeeting = getActiveClientMeeting(trackingSession);
    if (existingMeeting) {
      return res.status(409).json({
        success: false,
        error: 'client_meeting_already_active',
        message: 'A client meeting is already being tracked. Stop it before starting a new one.',
        data: {
          clientMeeting: normalizeClientMeetingForResponse(existingMeeting),
          tracking: buildSessionPayload(trackingSession, employee, attendance || { _id: trackingSession.attendance })
        }
      });
    }

    const meetingDetails = normalizeClientMeetingPayload(req.body || {});
    if (!meetingDetails.clientName) {
      return res.status(400).json({
        success: false,
        error: 'client_name_required',
        message: 'Client name is required to start meeting tracking.'
      });
    }

    const rawLocation = getLocationPayload(req.body || {});
    const normalizedLocation = rawLocation ? ensureValidLocation(rawLocation) : null;
    const previousPoint = trackingSession?.meta?.lastRawLocation || trackingSession.lastLocation;
    const rawSecurityCheck = normalizedLocation
      ? evaluateLocationSecurity({
          previousPoint,
          currentPoint: normalizedLocation,
          boundDeviceFingerprint:
            trackingSession.device?.fingerprint ||
            employee?.attendanceSecurity?.deviceBinding?.fingerprint ||
            '',
          currentDeviceFingerprint: req.body?.device?.fingerprint || '',
          mockedLocation: Boolean(rawLocation?.mocked)
        })
      : buildNeutralSecurityCheck();
    const securityCheck = softenTrackingSecurityCheck(rawSecurityCheck);

    const displayLocationResult = normalizedLocation
      ? resolveDisplayLocation({
          currentPoint: normalizedLocation,
          previousDisplayPoint: trackingSession.lastLocation || trackingSession.startLocation,
          geofence: Array.isArray(employee.geofence) && employee.geofence.length > 0
            ? employee.geofence
            : (Array.isArray(employee.geofance) ? employee.geofance : []),
          securityCheck
        })
      : { location: null, strategy: 'none' };
    const displayLocation = displayLocationResult.location || normalizedLocation || null;
    const now = new Date();
    const routeFromLocation =
      meetingDetails.fromLocation ||
      displayLocation ||
      trackingSession.lastLocation ||
      null;
    const routeToLocation = meetingDetails.toLocation || meetingDetails.destinationLocation || null;
    const actualStartLocation = displayLocation || trackingSession.lastLocation || routeFromLocation || null;
    const clientMeeting = {
      id: new mongoose.Types.ObjectId().toString(),
      ...meetingDetails,
      fromAddress: meetingDetails.fromAddress || sanitizeMeetingText(req.body?.fromAddress || 'Live start location', 180),
      fromLocation: routeFromLocation,
      toAddress: meetingDetails.toAddress || meetingDetails.destinationAddress || '',
      toLocation: routeToLocation,
      destinationLocation: routeToLocation,
      status: 'ACTIVE',
      startedAt: now,
      startLocation: actualStartLocation,
      lastLocation: actualStartLocation,
      totalUpdates: actualStartLocation ? 1 : 0,
      totalDistanceMeters: 0,
      lastSegmentDistanceMeters: 0,
      plannedRoute: meetingDetails.plannedRoute,
      plannedDistanceMeters: meetingDetails.plannedDistanceMeters || 0,
      plannedDurationSeconds: meetingDetails.plannedDurationSeconds || 0
    };

    if (displayLocation) {
      trackingSession.lastLocation = displayLocation;
      trackingSession.totalUpdates = (trackingSession.totalUpdates || 0) + 1;
    }
    trackingSession.lastHeartbeatAt = now;
    trackingSession.online = true;

    const meta = getSessionMeta(trackingSession);
    const history = Array.isArray(meta.clientMeetingHistory) ? meta.clientMeetingHistory : [];
    setSessionMeta(trackingSession, {
      ...meta,
      activeClientMeeting: clientMeeting,
      clientMeetingHistory: [...history, normalizeClientMeetingForResponse(clientMeeting)],
      lastRawLocation: normalizedLocation || meta.lastRawLocation || null,
      displayLocationStrategy: displayLocationResult.strategy || meta.displayLocationStrategy || 'raw'
    });

    await trackingSession.save();

    let trackingPoint = null;
    if (displayLocation) {
      trackingPoint = await createTrackingPoint({
        LiveTracking,
        tenantId,
        employeeId: employee._id,
        attendanceId: attendance?._id || trackingSession.attendance,
        sessionId: trackingSession._id,
        locationSnapshot: displayLocation,
        rawLocationSnapshot: normalizedLocation,
        device: req.body?.device || {},
        securityCheck,
        source: 'CLIENT_MEETING_START',
        intervalSeconds: trackingSession.recommendedIntervalSec || TRACKING_CONFIG.minIntervalSec,
        battery: req.body?.battery || null,
        network: req.body?.network || null,
        meta: {
          clientMeeting: normalizeClientMeetingForResponse(clientMeeting),
          displayLocationStrategy: displayLocationResult.strategy || 'raw'
        }
      });

      if (attendance) {
        attendance.tracking = attendance.tracking || {};
        attendance.tracking.lastHeartbeatAt = trackingSession.lastHeartbeatAt;
        attendance.tracking.lastLocation = displayLocation;
        attendance.tracking.status = trackingSession.status;
        appendPathPoint(attendance, displayLocation, 'CLIENT_MEETING', [], Boolean(rawLocation?.mocked));
        await attendance.save();
      }
    }

    const sessionPayload = buildSessionPayload(trackingSession, employee, attendance || { _id: trackingSession.attendance });
    emitTrackingSessionUpdate(tenantId, sessionPayload);
    if (displayLocation) {
      emitTrackingLocationUpdate(tenantId, {
        ...sessionPayload,
        locationPointId: trackingPoint?._id || null,
        currentLocation: displayLocation
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Client meeting tracking started.',
      data: {
        clientMeeting: normalizeClientMeetingForResponse(clientMeeting),
        tracking: sessionPayload
      }
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.code || 'client_meeting_start_failed',
      message: error.message || 'Failed to start client meeting tracking.'
    });
  }
};

exports.updateClientMeetingLocation = async (req, res) => {
  try {
    const { trackingSession } = await resolveActiveTrackingContext(req);
    const activeMeeting = getActiveClientMeeting(trackingSession);

    if (!activeMeeting) {
      return res.status(409).json({
        success: false,
        error: 'client_meeting_inactive',
        message: 'Start a client meeting before sending meeting location updates.'
      });
    }

    req.body = {
      ...(req.body || {}),
      location: getLocationPayload(req.body || {}),
      sessionId: trackingSession._id,
      clientMeetingId: activeMeeting.id,
      trackingState: 'ACTIVE'
    };

    return exports.updateLocation(req, res);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.code || 'client_meeting_update_failed',
      message: error.message || 'Failed to update client meeting location.'
    });
  }
};

exports.stopClientMeeting = async (req, res) => {
  try {
    const {
      LiveTracking,
      attendance,
      employee,
      tenantId,
      trackingSession
    } = await resolveActiveTrackingContext(req);
    const activeMeeting = getActiveClientMeeting(trackingSession);

    if (!activeMeeting) {
      return res.status(409).json({
        success: false,
        error: 'client_meeting_inactive',
        message: 'No active client meeting tracking session was found.'
      });
    }

    const rawLocation = getLocationPayload(req.body || {});
    const normalizedLocation = rawLocation ? ensureValidLocation(rawLocation) : null;
    const rawSecurityCheck = normalizedLocation
      ? evaluateLocationSecurity({
          previousPoint: trackingSession?.meta?.lastRawLocation || trackingSession.lastLocation,
          currentPoint: normalizedLocation,
          boundDeviceFingerprint:
            trackingSession.device?.fingerprint ||
            employee?.attendanceSecurity?.deviceBinding?.fingerprint ||
            '',
          currentDeviceFingerprint: req.body?.device?.fingerprint || '',
          mockedLocation: Boolean(rawLocation?.mocked)
        })
      : buildNeutralSecurityCheck();
    const securityCheck = softenTrackingSecurityCheck(rawSecurityCheck);

    const displayLocationResult = normalizedLocation
      ? resolveDisplayLocation({
          currentPoint: normalizedLocation,
          previousDisplayPoint: trackingSession.lastLocation || trackingSession.startLocation,
          geofence: Array.isArray(employee.geofence) && employee.geofence.length > 0
            ? employee.geofence
            : (Array.isArray(employee.geofance) ? employee.geofance : []),
          securityCheck
        })
      : { location: null, strategy: 'none' };
    const displayLocation = displayLocationResult.location || normalizedLocation || trackingSession.lastLocation || null;
    const now = new Date();
    const stopReason = sanitizeMeetingText(req.body?.stopReason || req.body?.reason || 'REACHED', 120);
    const distanceUpdate = addMeetingDistance(
      activeMeeting.totalDistanceMeters || activeMeeting.distanceMeters || 0,
      activeMeeting.lastLocation || trackingSession.lastLocation || trackingSession.startLocation,
      displayLocation,
      { plannedDistanceMeters: activeMeeting.plannedDistanceMeters || activeMeeting.plannedRoute?.distanceMeters }
    );
    const completedMeeting = {
      ...activeMeeting,
      status: stopReason.toUpperCase() === 'REACHED' ? 'REACHED' : 'COMPLETED',
      endedAt: now,
      reachedAt: now,
      endLocation: displayLocation,
      reachedLocation: displayLocation,
      lastLocation: displayLocation || activeMeeting.lastLocation || null,
      totalDistanceMeters: distanceUpdate.totalDistanceMeters,
      lastSegmentDistanceMeters: distanceUpdate.segmentDistanceMeters,
      ignoredSegmentDistanceMeters: distanceUpdate.ignoredSegmentDistanceMeters,
      stopReason
    };

    if (displayLocation) {
      trackingSession.lastLocation = displayLocation;
    }
    trackingSession.lastHeartbeatAt = now;
    trackingSession.online = true;

    const meta = getSessionMeta(trackingSession);
    const completedMeetingResponse = normalizeClientMeetingForResponse(completedMeeting);
    const history = upsertClientMeetingHistory(meta.clientMeetingHistory, completedMeeting);
    delete meta.activeClientMeeting;
    setSessionMeta(trackingSession, {
      ...meta,
      clientMeetingHistory: history,
      lastClientMeeting: completedMeetingResponse,
      lastRawLocation: normalizedLocation || meta.lastRawLocation || null,
      displayLocationStrategy: displayLocationResult.strategy || meta.displayLocationStrategy || 'raw'
    });

    await trackingSession.save();

    let trackingPoint = null;
    if (displayLocation) {
      trackingPoint = await createTrackingPoint({
        LiveTracking,
        tenantId,
        employeeId: employee._id,
        attendanceId: attendance?._id || trackingSession.attendance,
        sessionId: trackingSession._id,
        locationSnapshot: displayLocation,
        rawLocationSnapshot: normalizedLocation,
        device: req.body?.device || {},
        securityCheck,
        source: 'CLIENT_MEETING_END',
        intervalSeconds: trackingSession.recommendedIntervalSec || TRACKING_CONFIG.minIntervalSec,
        battery: req.body?.battery || null,
        network: req.body?.network || null,
        meta: {
          clientMeeting: completedMeetingResponse,
          displayLocationStrategy: displayLocationResult.strategy || 'raw'
        }
      });

      if (attendance) {
        attendance.tracking = attendance.tracking || {};
        attendance.tracking.lastHeartbeatAt = trackingSession.lastHeartbeatAt;
        attendance.tracking.lastLocation = displayLocation;
        attendance.tracking.status = trackingSession.status;
        appendPathPoint(attendance, displayLocation, 'CLIENT_MEETING', [], Boolean(rawLocation?.mocked));
        await attendance.save();
      }
    }

    const sessionPayload = buildSessionPayload(trackingSession, employee, attendance || { _id: trackingSession.attendance });
    emitTrackingSessionUpdate(tenantId, sessionPayload);
    if (displayLocation) {
      emitTrackingLocationUpdate(tenantId, {
        ...sessionPayload,
        locationPointId: trackingPoint?._id || null,
        currentLocation: displayLocation,
        completedClientMeeting: completedMeetingResponse
      });
    }

    return res.json({
      success: true,
      message: 'Client meeting tracking stopped.',
      data: {
        clientMeeting: completedMeetingResponse,
        tracking: sessionPayload
      }
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.code || 'client_meeting_stop_failed',
      message: error.message || 'Failed to stop client meeting tracking.'
    });
  }
};

exports.getClientMeetingHistory = async (req, res) => {
  try {
    await requireTenantDbContext(req);
    const tenantId = req.tenantId;
    const meetingId = String(req.params.meetingId || req.query.meetingId || '').trim();
    const { Employee, LiveTracking } = getModels(req);
    const employee = await resolveEmployeeContext(req, Employee);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'employee_not_found',
        message: 'Employee record not found for the current tenant.'
      });
    }

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        error: 'meeting_id_required',
        message: 'Meeting id is required.'
      });
    }

    const limit = Math.max(1, Math.min(5000, Number(req.query.limit || 1000)));
    const points = await LiveTracking.find({
      tenant: tenantId,
      employee: employee._id,
      'meta.clientMeeting.id': meetingId
    })
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean();

    const formattedPoints = points.map((point) => ({
      id: point._id,
      timestamp: point.timestamp,
      source: point.source,
      location: point.location,
      security: point.security,
      clientMeeting: point.meta?.clientMeeting || null
    }));
    const totalDistanceMeters = formattedPoints.reduce((total, point, index) => {
      if (index === 0) return total;
      return total + calculateSegmentDistanceMeters(formattedPoints[index - 1]?.location, point.location);
    }, 0);

    return res.json({
      success: true,
      data: {
        meetingId,
        points: formattedPoints,
        summary: {
          totalPoints: formattedPoints.length,
          from: formattedPoints[0]?.timestamp || null,
          to: formattedPoints[formattedPoints.length - 1]?.timestamp || null,
          fromLocation: formattedPoints[0]?.location || null,
          toLocation: formattedPoints[formattedPoints.length - 1]?.location || null,
          totalDistanceMeters: Number(totalDistanceMeters.toFixed(2))
        }
      }
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.code || 'client_meeting_history_failed',
      message: error.message || 'Failed to fetch client meeting history.'
    });
  }
};

exports.getLiveLocations = async (req, res) => {
  try {
    await requireTenantDbContext(req);
    const { Employee, LiveTrackingSession } = getModels(req);
    const now = new Date();
    const todayKey = buildDateKey(now);
    const yesterdayKey = buildDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const recentWindow = new Date(now.getTime() - 18 * 60 * 60 * 1000);
    const sessions = await LiveTrackingSession.find({
      tenant: req.tenantId,
      $or: [
        { status: { $in: ['ACTIVE', 'SUSPICIOUS'] } },
        { lastHeartbeatAt: { $gte: recentWindow } },
        { updatedAt: { $gte: recentWindow } },
        { dateKey: { $in: [todayKey, yesterdayKey] } }
      ]
    })
      .sort({ updatedAt: -1 })
      .lean();

    const latestSessionByEmployee = sessions.reduce((accumulator, session) => {
      const key = String(session.employee || '');
      if (!key) return accumulator;

      const current = accumulator.get(key);
      accumulator.set(key, pickPreferredSession(current, session));
      return accumulator;
    }, new Map());

    const dedupedSessions = Array.from(latestSessionByEmployee.values()).sort((left, right) => {
      const priorityDelta = getSessionPriority(right) - getSessionPriority(left);
      if (priorityDelta !== 0) return priorityDelta;

      return normalizeTimestamp(right.lastHeartbeatAt || right.updatedAt).getTime() -
        normalizeTimestamp(left.lastHeartbeatAt || left.updatedAt).getTime();
    });

    const employeeIds = [...new Set(dedupedSessions.map((session) => String(session.employee)))];
    const employees = await Employee.find({
      _id: { $in: employeeIds }
    })
      .select('firstName lastName employeeId profilePic designation department')
      .lean();

    const employeeMap = new Map(employees.map((employee) => [String(employee._id), employee]));

    const data = dedupedSessions.map((session) => {
      const employee = employeeMap.get(String(session.employee)) || {};
      const online =
        ['ACTIVE', 'SUSPICIOUS'].includes(session.status) &&
        isSocketOnline(session.lastHeartbeatAt);

      return {
        sessionId: session._id,
        attendanceId: session.attendance || null,
        userId: session.employee,
        employee: buildEmployeeSummary(employee),
        status: session.status,
        online,
        flagged: Array.isArray(session.security?.lastReasons) && session.security.lastReasons.length > 0,
        flagReason: Array.isArray(session.security?.lastReasons) ? session.security.lastReasons[0] || '' : '',
        flagReasons: Array.isArray(session.security?.lastReasons) ? session.security.lastReasons : [],
        checkInTime: session.checkInTime || null,
        checkOutTime: session.checkOutTime || null,
        lastHeartbeatAt: session.lastHeartbeatAt || null,
        currentLocation: session.lastLocation || null,
        totalUpdates: session.totalUpdates || 0,
        suspiciousUpdateCount: session.suspiciousUpdateCount || 0,
        recommendedIntervalSec: session.recommendedIntervalSec || TRACKING_CONFIG.minIntervalSec,
        dateKey: session.dateKey || '',
        startLocation: session.startLocation || null,
        security: session.security || {},
        activeClientMeeting: normalizeClientMeetingForResponse(getActiveClientMeeting(session)),
        lastClientMeeting: normalizeClientMeetingForResponse(getLatestClientMeeting(session))
      };
    });

    return res.json({
      success: true,
      data,
      summary: {
        total: data.length,
        online: data.filter((item) => item.online).length,
        offline: data.filter((item) => !item.online).length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'live_location_fetch_failed',
      message: error.message || 'Failed to fetch live locations.'
    });
  }
};

exports.getLocationHistory = async (req, res) => {
  try {
    await requireTenantDbContext(req);
    const { userId } = req.params;
    const sessionId = String(req.query.sessionId || '').trim();
    const { Employee, LiveTracking } = getModels(req);
    const from = req.query.from ? new Date(req.query.from) : new Date(buildDateKey(new Date()));
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const limit = Math.max(1, Math.min(5000, Number(req.query.limit || 1000)));

    if (!mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({
        success: false,
        error: 'invalid_user_id',
        message: 'A valid employee id is required.'
      });
    }

    const employee = await Employee.findById(userId)
      .select('firstName lastName employeeId profilePic designation department')
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'employee_not_found',
        message: 'Employee not found for the requested history.'
      });
    }

    const historyQuery = {
      tenant: req.tenantId,
      employee: userId,
      timestamp: {
        $gte: normalizeTimestamp(from),
        $lte: normalizeTimestamp(to)
      }
    };

    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
      historyQuery.session = new mongoose.Types.ObjectId(sessionId);
    }

    const points = await LiveTracking.find(historyQuery)
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean();

    const formattedPoints = points.map((point) => ({
      id: point._id,
      timestamp: point.timestamp,
      source: point.source,
      intervalSeconds: point.intervalSeconds,
      location: point.location,
      security: point.security,
      clientMeeting: point.meta?.clientMeeting || null
    }));
    const totalDistanceMeters = formattedPoints.reduce((total, point, index) => {
      if (index === 0) return total;
      return total + calculateSegmentDistanceMeters(formattedPoints[index - 1]?.location, point.location);
    }, 0);

    return res.json({
      success: true,
      data: {
        userId,
        employee: buildEmployeeSummary(employee),
        points: formattedPoints,
        summary: {
          totalPoints: formattedPoints.length,
          suspiciousPoints: formattedPoints.filter((point) => point.security?.suspected).length,
          from: formattedPoints[0]?.timestamp || null,
          to: formattedPoints[formattedPoints.length - 1]?.timestamp || null,
          fromLocation: formattedPoints[0]?.location || null,
          toLocation: formattedPoints[formattedPoints.length - 1]?.location || null,
          totalDistanceMeters: Number(totalDistanceMeters.toFixed(2))
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'location_history_fetch_failed',
      message: error.message || 'Failed to fetch location history.'
    });
  }
};
