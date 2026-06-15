const mongoose = require('mongoose');

const TRACKING_CONFIG = {
  minIntervalSec: Number(process.env.ATTENDANCE_TRACKING_MIN_INTERVAL_SEC || 10),
  maxIntervalSec: Number(process.env.ATTENDANCE_TRACKING_MAX_INTERVAL_SEC || 20),
  requiredAccuracyMeters: Number(process.env.ATTENDANCE_REQUIRED_GPS_ACCURACY || 50),
  flagAccuracyMeters: Number(
    process.env.ATTENDANCE_FLAG_GPS_ACCURACY ||
    process.env.ATTENDANCE_REJECT_GPS_ACCURACY ||
    100
  ),
  maxAccuracyMeters: Number(process.env.ATTENDANCE_MAX_GPS_ACCURACY || 150),
  maxSpeedKmh: Number(process.env.ATTENDANCE_FLAG_SPEED_KMH || 120),
  maxDistanceJumpMeters: Number(process.env.ATTENDANCE_FLAG_DISTANCE_JUMP_METERS || 500),
  maxJumpWindowSec: Number(process.env.ATTENDANCE_FLAG_DISTANCE_WINDOW_SEC || 120),
  onlineWindowSec: Number(process.env.ATTENDANCE_ONLINE_WINDOW_SEC || 45),
  strictDeviceBinding:
    String(process.env.ATTENDANCE_STRICT_DEVICE_BINDING || '').toLowerCase() === 'true'
};

function toFiniteNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildDateKey(date = new Date()) {
  return normalizeTimestamp(date).toISOString().slice(0, 10);
}

function normalizeLocationSnapshot(location = {}) {
  const lat = toFiniteNumber(location.lat);
  const lng = toFiniteNumber(location.lng);

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

  return {
    lat,
    lng,
    accuracy: toFiniteNumber(location.accuracy),
    speed: toFiniteNumber(location.speed),
    heading: toFiniteNumber(location.heading),
    altitude: toFiniteNumber(location.altitude),
    timestamp: new Date()
  };
}

function haversineDistanceMeters(pointA, pointB) {
  if (!pointA || !pointB) return 0;

  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(pointB.lat - pointA.lat);
  const deltaLng = toRadians(pointB.lng - pointA.lng);
  const lat1 = toRadians(pointA.lat);
  const lat2 = toRadians(pointB.lat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeSpeedKmh(previousPoint, currentPoint) {
  if (!previousPoint || !currentPoint) {
    return 0;
  }

  const prevTime = normalizeTimestamp(previousPoint.timestamp).getTime();
  const currentTime = normalizeTimestamp(currentPoint.timestamp).getTime();
  const deltaSeconds = Math.max(1, (currentTime - prevTime) / 1000);
  const distanceMeters = haversineDistanceMeters(previousPoint, currentPoint);

  return (distanceMeters / deltaSeconds) * 3.6;
}

function getSeverityFromReasons(reasons = []) {
  if (!Array.isArray(reasons) || reasons.length === 0) return 'NONE';
  if (reasons.some((reason) => /mocked|device_binding/i.test(reason))) return 'HIGH';
  if (reasons.some((reason) => /speed|distance_jump/i.test(reason))) return 'MEDIUM';
  return 'LOW';
}

function evaluateLocationSecurity({
  previousPoint = null,
  currentPoint = null,
  boundDeviceFingerprint = '',
  currentDeviceFingerprint = '',
  mockedLocation = false
} = {}) {
  const reasons = [];
  const normalizedCurrentPoint = normalizeLocationSnapshot(currentPoint);
  const normalizedPreviousPoint = normalizeLocationSnapshot(previousPoint);

  if (!normalizedCurrentPoint) {
    return {
      suspected: true,
      blocked: true,
      severity: 'HIGH',
      reasons: ['missing_location'],
      metrics: {
        computedSpeedKmh: 0,
        jumpDistanceMeters: 0
      }
    };
  }

  const accuracy = toFiniteNumber(normalizedCurrentPoint.accuracy, 0);
  const jumpDistanceMeters = normalizedPreviousPoint
    ? haversineDistanceMeters(normalizedPreviousPoint, normalizedCurrentPoint)
    : 0;
  const timeDeltaSec = normalizedPreviousPoint
    ? Math.max(
      1,
      (normalizeTimestamp(normalizedCurrentPoint.timestamp).getTime() -
        normalizeTimestamp(normalizedPreviousPoint.timestamp).getTime()) /
      1000
    )
    : 0;

  const derivedSpeedKmh = normalizedPreviousPoint
    ? computeSpeedKmh(normalizedPreviousPoint, normalizedCurrentPoint)
    : 0;

  const reportedSpeedKmh =
    normalizedCurrentPoint.speed !== null ? normalizedCurrentPoint.speed * 3.6 : null;
  const computedSpeedKmh = Math.max(
    toFiniteNumber(reportedSpeedKmh, 0),
    toFiniteNumber(derivedSpeedKmh, 0)
  );

  const deviceMismatch =
    Boolean(boundDeviceFingerprint) &&
    Boolean(currentDeviceFingerprint) &&
    String(boundDeviceFingerprint).trim() !== String(currentDeviceFingerprint).trim();

  const poorAccuracy =
    accuracy <= 0 ||
    accuracy > TRACKING_CONFIG.flagAccuracyMeters ||
    accuracy > TRACKING_CONFIG.maxAccuracyMeters;

  if (mockedLocation) reasons.push('mocked_location');
  if (poorAccuracy) reasons.push('poor_accuracy');

  if (normalizedPreviousPoint) {
    if (
      timeDeltaSec <= TRACKING_CONFIG.maxJumpWindowSec &&
      jumpDistanceMeters > TRACKING_CONFIG.maxDistanceJumpMeters
    ) {
      reasons.push('distance_jump');
    }
    if (computedSpeedKmh > TRACKING_CONFIG.maxSpeedKmh) {
      reasons.push('unrealistic_speed');
    }
  }

  if (deviceMismatch) {
    reasons.push('device_binding_mismatch');
  }

  const severity = getSeverityFromReasons(reasons);
  const blocked =
    TRACKING_CONFIG.strictDeviceBinding && deviceMismatch;

  return {
    suspected: reasons.length > 0,
    blocked,
    severity,
    reasons,
    metrics: {
      computedSpeedKmh: Number(computedSpeedKmh.toFixed(2)),
      jumpDistanceMeters: Number(jumpDistanceMeters.toFixed(2)),
      timeDeltaSec: Number(timeDeltaSec.toFixed(2))
    },
    flags: {
      poorAccuracy,
      deviceMismatch,
      mockedLocation: Boolean(mockedLocation)
    }
  };
}

function getRecommendedTrackingInterval({
  speedMps = null,
  batteryLevel = null,
  isCharging = false,
  visibilityState = 'visible'
} = {}) {
  const min = Math.min(TRACKING_CONFIG.minIntervalSec, TRACKING_CONFIG.maxIntervalSec);
  const max = Math.max(TRACKING_CONFIG.minIntervalSec, TRACKING_CONFIG.maxIntervalSec);
  let interval = Math.round((min + max) / 2);
  const speed = toFiniteNumber(speedMps, 0);

  if (speed >= 4) interval = min;
  else if (speed <= 1) interval = max;

  if (visibilityState === 'hidden') {
    interval = Math.min(max, interval + 2);
  }

  if (batteryLevel !== null && batteryLevel <= 0.2 && !isCharging) {
    interval = max;
  }

  return Math.max(min, Math.min(max, interval));
}

function isSocketOnline(lastHeartbeatAt) {
  if (!lastHeartbeatAt) return false;
  const heartbeat = normalizeTimestamp(lastHeartbeatAt).getTime();
  return Date.now() - heartbeat <= TRACKING_CONFIG.onlineWindowSec * 1000;
}

function ensureObjectId(value) {
  if (!mongoose.Types.ObjectId.isValid(String(value || ''))) {
    return null;
  }
  return new mongoose.Types.ObjectId(String(value));
}

module.exports = {
  TRACKING_CONFIG,
  buildDateKey,
  computeSpeedKmh,
  ensureObjectId,
  evaluateLocationSecurity,
  getRecommendedTrackingInterval,
  haversineDistanceMeters,
  isSocketOnline,
  normalizeLocationSnapshot,
  normalizeTimestamp,
  toFiniteNumber
};
