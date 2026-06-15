const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { buildCorsOptions } = require('../config/security.config');
const { normalizeRole, verifyJwtWithCandidates } = require('../middleware/auth.jwt');
const getTenantDB = require('../utils/tenantDB');
const { 
  evaluateLocationSecurity, 
  normalizeLocationSnapshot, 
  getRecommendedTrackingInterval,
  toFiniteNumber
} = require('./locationSecurity.service');

let ioInstance = null;

function getTokenFromSocket(socket) {
  const authToken = socket.handshake?.auth?.token;
  const headerToken =
    socket.handshake?.headers?.authorization ||
    socket.handshake?.headers?.Authorization ||
    '';
  const rawToken = authToken || headerToken || '';
  return String(rawToken).replace(/^Bearer\s+/i, '').trim();
}

async function resolveTenantId(payload = {}) {
  const candidate =
    payload.tenantId || payload.tenant || payload.companyId || payload.company || null;

  if (candidate && mongoose.Types.ObjectId.isValid(String(candidate))) {
    return String(candidate);
  }

  let code = String(payload.companyCode || payload.company_code || '').trim();
  if (!code && candidate && typeof candidate === 'string') {
    code = candidate.trim();
  }
  
  if (!code) {
    return null;
  }

  try {
    const Tenant = mongoose.model('Tenant');
    const tenant = await Tenant.findOne({ code }).select('_id').lean();
    return tenant?._id ? String(tenant._id) : candidate; // Fallback to candidate if it's a valid string ID
  } catch (_error) {
    return candidate; // Fallback
  }
}

function joinSocketRooms(socket, user) {
  const tenantId = String(user?.tenantId || '').trim();
  if (!tenantId) return;

  socket.join(`tenant:${tenantId}`);
  socket.join(`tenant:${tenantId}:user:${user.id || user._id || 'unknown'}`);

  const role = normalizeRole(user?.role);
  const adminRoles = new Set([
    'hr',
    'admin',
    'psa',
    'super_admin',
    'company_admin',
    'company_super_admin',
    'hr_admin',
    'hr_manager'
  ]);

  if (adminRoles.has(role)) {
    socket.join(`tenant:${tenantId}:admins`);
  }
}

function normalizePostRoomIds(input) {
  const values = Array.isArray(input)
    ? input
    : Array.isArray(input?.postIds)
      ? input.postIds
      : [input?.postId || input?.id || input];

  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .slice(0, 200);
}

function initializeSocket(server) {
  if (ioInstance) {
    return ioInstance;
  }

  const corsOptions = buildCorsOptions();

  ioInstance = new Server(server, {
    cors: {
      origin: corsOptions.origin,
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  ioInstance.use(async (socket, next) => {
    try {
      const token = getTokenFromSocket(socket);
      if (!token) {
        return next(new Error('socket_unauthorized'));
      }

      let payload = null;
      try {
        payload = verifyJwtWithCandidates(token);
      } catch (verifyError) {
        if (process.env.NODE_ENV !== 'production') {
          const decoded = jwt.decode(token);
          if (decoded && typeof decoded === 'object') {
            payload = decoded;
          }
        }

        if (!payload) {
          throw verifyError;
        }
      }

      const tenantId = await resolveTenantId(payload);
      if (!tenantId) {
        return next(new Error('socket_tenant_missing'));
      }

      socket.data.user = {
        ...payload,
        tenantId,
        role: normalizeRole(payload?.role),
        id: payload?.id || payload?._id || payload?.userId || null
      };

      joinSocketRooms(socket, socket.data.user);
      next();
    } catch (error) {
      console.error('[Socket.io Middleware Error]:', error.message, error.stack);
      next(error);
    }
  });

  ioInstance.on('connection', (socket) => {
    const tenantId = socket.data?.user?.tenantId;
    const role = socket.data?.user?.role;
    const userId = socket.data?.user?.id;

    socket.emit('tracking:connected', {
      success: true,
      tenantId,
      role,
      timestamp: new Date().toISOString()
    });

    socket.on('tracking:subscribe', () => {
      joinSocketRooms(socket, socket.data?.user || {});
    });

    socket.on('social:metrics:subscribe', (payload = {}, ack) => {
      const postIds = normalizePostRoomIds(payload);
      postIds.forEach((postId) => {
        socket.join(postId);
        socket.join(`social:post:${postId}`);
      });

      if (typeof ack === 'function') {
        ack({ success: true, subscribed: postIds.length });
      }
    });

    socket.on('social:metrics:unsubscribe', (payload = {}, ack) => {
      const postIds = normalizePostRoomIds(payload);
      postIds.forEach((postId) => {
        socket.leave(postId);
        socket.leave(`social:post:${postId}`);
      });

      if (typeof ack === 'function') {
        ack({ success: true, unsubscribed: postIds.length });
      }
    });

    // Employee sends live GPS location → validate, store, and broadcast
    socket.on('sendLocation', async (payload) => {
      if (!tenantId || !userId) return;

      try {
        const db = await getTenantDB(tenantId);
        if (!db) return;

        const LiveTrackingSession = db.model('LiveTrackingSession');
        const LiveTracking = db.model('LiveTracking');
        const Attendance = db.model('Attendance');

        // 1. Validate active session
        const session = await LiveTrackingSession.findOne({
          tenant: tenantId,
          employee: userId,
          status: { $in: ['ACTIVE', 'SUSPICIOUS'] }
        });

        if (!session) {
          socket.emit('tracking:error', { code: 'no_active_session', message: 'No active tracking session found.' });
          return;
        }

        const normalizedLocation = normalizeLocationSnapshot(payload);
        if (!normalizedLocation) return;

        // 2. Security check
        const securityCheck = evaluateLocationSecurity({
          previousPoint: session.lastLocation,
          currentPoint: normalizedLocation,
          boundDeviceFingerprint: session.device?.fingerprint || '',
          currentDeviceFingerprint: payload.device?.fingerprint || '',
          mockedLocation: Boolean(payload.mocked)
        });

        if (securityCheck.blocked) {
          socket.emit('tracking:error', { code: 'security_blocked', message: 'Update blocked by security rule.' });
          return;
        }

        const activeClientMeeting =
          session.meta?.activeClientMeeting &&
          String(session.meta.activeClientMeeting.status || '').toUpperCase() === 'ACTIVE'
            ? session.meta.activeClientMeeting
            : null;

        // 3. Store in DB
        const trackingPoint = await LiveTracking.create({
          tenant: tenantId,
          employee: userId,
          attendance: session.attendance,
          session: session._id,
          timestamp: normalizedLocation.timestamp,
          location: normalizedLocation,
          source: activeClientMeeting ? 'CLIENT_MEETING' : 'TRACKER',
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
          meta: activeClientMeeting
            ? {
                clientMeeting: {
                  id: activeClientMeeting.id || '',
                  clientName: activeClientMeeting.clientName || '',
                  title: activeClientMeeting.title || 'Client Meeting',
                  purpose: activeClientMeeting.purpose || '',
                  fromAddress: activeClientMeeting.fromAddress || '',
                  fromLocation: activeClientMeeting.fromLocation || activeClientMeeting.startLocation || null,
                  toAddress: activeClientMeeting.toAddress || activeClientMeeting.destinationAddress || '',
                  toLocation: activeClientMeeting.toLocation || activeClientMeeting.destinationLocation || null,
                  destinationAddress: activeClientMeeting.destinationAddress || '',
                  destinationLocation: activeClientMeeting.destinationLocation || null,
                  status: activeClientMeeting.status || 'ACTIVE',
                  startedAt: activeClientMeeting.startedAt || null,
                  startLocation: activeClientMeeting.startLocation || null,
                  lastLocation: normalizedLocation,
                  totalDistanceMeters: activeClientMeeting.totalDistanceMeters || 0,
                  plannedDistanceMeters: activeClientMeeting.plannedDistanceMeters || activeClientMeeting.plannedRoute?.distanceMeters || 0,
                  plannedDurationSeconds: activeClientMeeting.plannedDurationSeconds || activeClientMeeting.plannedRoute?.durationSeconds || 0,
                  plannedRoute: activeClientMeeting.plannedRoute || null
                }
              }
            : {}
        });

        // 4. Update session
        session.lastLocation = normalizedLocation;
        session.lastHeartbeatAt = new Date();
        session.totalUpdates = (session.totalUpdates || 0) + 1;
        if (securityCheck.suspected) {
          session.suspiciousUpdateCount = (session.suspiciousUpdateCount || 0) + 1;
        }
        if (activeClientMeeting) {
          const meta = { ...(session.meta?.toObject?.() || session.meta || {}) };
          meta.activeClientMeeting = {
            ...activeClientMeeting,
            lastLocation: normalizedLocation,
            totalUpdates: Number(activeClientMeeting.totalUpdates || 0) + 1,
            lastUpdatedAt: new Date()
          };
          session.meta = meta;
          session.markModified?.('meta');
        }
        await session.save();

        // 5. Emit to admins
        const updatePayload = {
          userId,
          sessionId: session._id,
          currentLocation: normalizedLocation,
          online: true,
          lastHeartbeatAt: session.lastHeartbeatAt,
          employee: payload.employee || null,
          security: session.security || {},
          activeClientMeeting: activeClientMeeting
            ? {
                id: activeClientMeeting.id || '',
                clientName: activeClientMeeting.clientName || '',
                title: activeClientMeeting.title || 'Client Meeting',
                purpose: activeClientMeeting.purpose || '',
                fromAddress: activeClientMeeting.fromAddress || '',
                fromLocation: activeClientMeeting.fromLocation || activeClientMeeting.startLocation || null,
                toAddress: activeClientMeeting.toAddress || activeClientMeeting.destinationAddress || '',
                toLocation: activeClientMeeting.toLocation || activeClientMeeting.destinationLocation || null,
                destinationAddress: activeClientMeeting.destinationAddress || '',
                status: activeClientMeeting.status || 'ACTIVE',
                startedAt: activeClientMeeting.startedAt || null,
                lastLocation: normalizedLocation,
                totalDistanceMeters: activeClientMeeting.totalDistanceMeters || 0,
                plannedDistanceMeters: activeClientMeeting.plannedDistanceMeters || activeClientMeeting.plannedRoute?.distanceMeters || 0,
                plannedDurationSeconds: activeClientMeeting.plannedDurationSeconds || activeClientMeeting.plannedRoute?.durationSeconds || 0,
                plannedRoute: activeClientMeeting.plannedRoute || null
              }
            : null
        };

        ioInstance.to(`tenant:${tenantId}:admins`).emit('tracking:location:update', updatePayload);
      } catch (error) {
        console.error('[Socket] sendLocation error:', error);
      }
    });
  });

  return ioInstance;
}

function getIo() {
  return ioInstance;
}

function emitToTenantAdmins(tenantId, eventName, payload) {
  if (!ioInstance || !tenantId) return;
  ioInstance.to(`tenant:${tenantId}:admins`).emit(eventName, payload);
}

function emitToUser(tenantId, userId, eventName, payload) {
  if (!ioInstance || !tenantId || !userId) return;
  ioInstance.to(`tenant:${tenantId}:user:${userId}`).emit(eventName, payload);
}

function emitSocialAnalyticsUpdate(tenantId, payload) {
  emitToTenantAdmins(tenantId, 'social:metrics:update', payload);
  emitPostMetricsUpdate(payload?.postId, payload);
}

function emitPostMetricsUpdate(postId, payload) {
  if (!ioInstance || !postId) return;
  const roomId = String(postId);
  ioInstance.to(roomId).emit('metrics_update', payload);
  ioInstance.to(`social:post:${roomId}`).emit('metrics_update', payload);
}

function emitTrackingLocationUpdate(tenantId, payload) {
  emitToTenantAdmins(tenantId, 'tracking:location:update', payload);
}

function emitTrackingSessionUpdate(tenantId, payload) {
  emitToTenantAdmins(tenantId, 'tracking:session:update', payload);
}

module.exports = {
  emitPostMetricsUpdate,
  emitSocialAnalyticsUpdate,
  emitTrackingLocationUpdate,
  emitTrackingSessionUpdate,
  emitToTenantAdmins,
  emitToUser,
  getIo,
  initializeSocket
};
