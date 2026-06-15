import api from '../utils/api';
import { getToken } from '../utils/token';
import { loadExternalScript, resolveApiOrigin } from '../utils/runtimeAssets';
import {
  stabilizeLocationSamples,
  trimLocationSamples
} from '../utils/locationStability';
import { isEmployeeLikeRole } from '../utils/employeeAccess';

const STORAGE_KEY = 'hrms:live-tracking-session:v1';
const MAX_QUEUE_LENGTH = 10;

const normalizeTrackingOwner = (owner = {}) => {
  const role =
    owner && typeof owner === 'object'
      ? String(owner.roleName || owner.role || '').trim().toLowerCase()
      : '';
  const userId =
    owner && typeof owner === 'object'
      ? String(owner.userId || owner.id || owner._id || '').trim()
      : '';

  return {
    role,
    userId,
    isTrackableRole: isEmployeeLikeRole(role)
  };
};

class LocationTrackingService {
  constructor() {
    this.activeSession = null;
    this.queue = [];
    this.timer = null;
    this.running = false;
    this.inFlight = false;
    this.lastKnownLocation = null;
    this.recentSamples = [];
    this.batteryManagerPromise = null;
    this.watchId = null;
    this.socket = null;
    this.lastSentAt = 0;
    this.minIntervalMs = 2500;
    this.maxIntervalMs = 8000;
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handlePositionUpdate = this.handlePositionUpdate.bind(this);
    this.handlePositionError = this.handlePositionError.bind(this);
  }

  readStoredSession() {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  persistSession() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.activeSession) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.activeSession));
    } catch {
      // ignore storage issues
    }
  }

  attachListeners() {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  detachListeners() {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  handleVisibilityChange() {
    if (!this.running) return;
    this.scheduleNext(500);
  }

  updateSessionFromResponse(responseData) {
    const tracking = responseData?.tracking || responseData?.data?.tracking || null;
    if (!tracking || !this.activeSession) return;

    this.activeSession = {
      ...this.activeSession,
      sessionId: tracking.sessionId || this.activeSession.sessionId,
      attendanceId: tracking.attendanceId || this.activeSession.attendanceId,
      recommendedIntervalSec:
        tracking.recommendedIntervalSec || this.activeSession.recommendedIntervalSec || 15,
      status: tracking.status || this.activeSession.status || 'ACTIVE'
    };
    this.persistSession();
  }

  async getBatterySnapshot() {
    if (typeof navigator === 'undefined' || typeof navigator.getBattery !== 'function') {
      return { level: null, charging: null };
    }

    if (!this.batteryManagerPromise) {
      this.batteryManagerPromise = navigator.getBattery().catch(() => null);
    }

    const battery = await this.batteryManagerPromise;
    if (!battery) {
      return { level: null, charging: null };
    }

    return {
      level: typeof battery.level === 'number' ? battery.level : null,
      charging: typeof battery.charging === 'boolean' ? battery.charging : null
    };
  }

  getNetworkSnapshot() {
    if (typeof navigator === 'undefined') {
      return {};
    }

    const connection =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;

    if (!connection) {
      return {};
    }

    return {
      effectiveType: connection.effectiveType || '',
      rtt: Number.isFinite(Number(connection.rtt)) ? Number(connection.rtt) : null,
      downlink: Number.isFinite(Number(connection.downlink)) ? Number(connection.downlink) : null,
      saveData: typeof connection.saveData === 'boolean' ? connection.saveData : null
    };
  }

  getCurrentIntervalSec() {
    const stored = Number(this.activeSession?.recommendedIntervalSec || 15);
    const min = 5;
    const max = 15;
    return Math.max(min, Math.min(max, stored));
  }

  scheduleNext() {
    // This is now handled by watchPosition events + throttling
  }

  async connectSocket() {
    if (this.socket) return this.socket;
    const token = getToken();
    if (!token) return null;
    try {
      const origin = resolveApiOrigin();
      await loadExternalScript(`${origin}/socket.io/socket.io.js`, 'io');
      if (typeof window.io !== 'function') return null;
      this.socket = window.io(origin, {
        auth: { token },
        withCredentials: true,
        reconnection: true
      });
      return this.socket;
    } catch (err) {
      console.warn('[LocationTracking] Socket connection failed:', err);
      return null;
    }
  }

  buildSnapshotFromPosition(position) {
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed,
      heading: position.coords.heading,
      altitude: position.coords.altitude,
      timestamp: new Date(position.timestamp || Date.now()).toISOString(),
      capturedAt: Date.now()
    };
  }

  rememberSnapshot(snapshot) {
    if (!snapshot) return;
    const normalizedSnapshot = {
      ...snapshot,
      capturedAt:
        Number.isFinite(Number(snapshot.capturedAt)) ? Number(snapshot.capturedAt) : Date.now()
    };

    this.recentSamples = trimLocationSamples(
      [...this.recentSamples, normalizedSnapshot],
      { maxAgeMs: 15000, maxSamples: 6 }
    );

    const preferredSnapshot = this.getBestRecentSnapshot();
    this.lastKnownLocation = preferredSnapshot
      ? this.stripSnapshotMeta(preferredSnapshot)
      : this.stripSnapshotMeta(normalizedSnapshot);
  }

  stripSnapshotMeta(snapshot) {
    if (!snapshot) return null;
    const { capturedAt: _CAPTURED_AT, ...locationSnapshot } = snapshot;
    return locationSnapshot;
  }

  getBestRecentSnapshot() {
    if (!this.recentSamples.length) {
      return null;
    }

    return stabilizeLocationSamples({
      previous: this.lastKnownLocation,
      samples: this.recentSamples,
      options: { maxAgeMs: 15000, maxSamples: 6, stableRadiusMeters: 25 }
    });
  }

  async handlePositionUpdate(position) {
    if (!this.running || !this.activeSession?.sessionId) return;

    const snapshot = this.buildSnapshotFromPosition(position);
    this.rememberSnapshot(snapshot);

    const now = Date.now();
    const elapsed = now - this.lastSentAt;

    if (elapsed >= this.minIntervalMs) {
      this.lastSentAt = now;
      const preferredSnapshot =
        this.stripSnapshotMeta(this.getBestRecentSnapshot()) || this.stripSnapshotMeta(snapshot);

      this.sendSnapshot({
        trackingState: 'ACTIVE',
        location: preferredSnapshot
      }).catch(() => {});
    }
  }

  handlePositionError(error) {
    console.error('[LocationTracking] watchPosition error:', error);
  }

  async capturePosition({ timeout = 20000, maximumAge = 0 } = {}) {
    if (!navigator?.geolocation) {
      throw new Error('Geolocation is not available in this browser.');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const snapshot = this.buildSnapshotFromPosition(position);
          this.rememberSnapshot(snapshot);
          resolve(this.stripSnapshotMeta(snapshot));
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          maximumAge,
          timeout
        }
      );
    });
  }

  async flushQueue() {
    if (!this.queue.length) return;

    const pending = [...this.queue];
    this.queue = [];

    for (const payload of pending) {
      try {
        const response = await api.post('/location/update', payload, { timeout: 20000 });
        this.updateSessionFromResponse(response.data);
      } catch {
        this.queue.push(payload);
        break;
      }
    }
  }

  async sendSnapshot({
    trackingState = 'ACTIVE',
    stopReason = '',
    allowWithoutLocation = false,
    source = 'TRACKER',
    location = null
  } = {}) {
    if (!this.activeSession?.sessionId) {
      return null;
    }

    let resolvedLocation = location ? { ...location, capturedAt: Date.now() } : null;
    try {
      if (resolvedLocation) {
        this.rememberSnapshot(resolvedLocation);
        resolvedLocation =
          this.stripSnapshotMeta(this.getBestRecentSnapshot()) || this.stripSnapshotMeta(resolvedLocation);
      } else {
        const capturedLocation = await this.capturePosition({
          timeout: trackingState === 'ACTIVE' ? 15000 : 8000,
          maximumAge: trackingState === 'ACTIVE' ? 5000 : 30000
        });
        resolvedLocation =
          this.stripSnapshotMeta(this.getBestRecentSnapshot()) || capturedLocation;
      }
    } catch {
      if (!allowWithoutLocation) {
        throw new Error('Unable to capture location for the tracking update.');
      }
      resolvedLocation = this.lastKnownLocation || null;
    }

    const payload = {
      sessionId: this.activeSession.sessionId,
      attendanceId: this.activeSession.attendanceId || null,
      trackingState,
      stopReason,
      source,
      intervalSeconds: this.getCurrentIntervalSec(),
      visibilityState:
        typeof document !== 'undefined' ? document.visibilityState || 'visible' : 'visible',
      location: resolvedLocation,
      device: this.activeSession.device || {},
      battery: await this.getBatterySnapshot(),
      network: this.getNetworkSnapshot()
    };

    try {
      const response = await api.post('/location/update', payload, { timeout: 20000 });
      this.updateSessionFromResponse(response.data);
      return response;
    } catch (error) {
      if (trackingState === 'ACTIVE' && payload.location) {
        this.queue.push(payload);
        this.queue = this.queue.slice(-MAX_QUEUE_LENGTH);
      }
      throw error;
    }
  }

  async tick() {
    // Replaced by event-driven watchPosition
  }

  async start(session = {}) {
    if (!session?.sessionId) {
      return false;
    }

    const owner = normalizeTrackingOwner(session);
    this.activeSession = {
      sessionId: session.sessionId,
      attendanceId: session.attendanceId || null,
      recommendedIntervalSec: session.recommendedIntervalSec || 15,
      status: session.status || 'ACTIVE',
      device: session.device || {},
      userId: owner.userId || '',
      role: owner.role || ''
    };
    this.running = true;
    const initialLocation = session.initialLocation || session.location || null;
    this.lastKnownLocation = null;
    this.recentSamples = [];
    this.lastSentAt = 0;
    if (initialLocation) {
      this.rememberSnapshot({ ...initialLocation, capturedAt: Date.now() });
    }
    this.persistSession();
    this.attachListeners();

    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      this.watchId = navigator.geolocation.watchPosition(
        this.handlePositionUpdate,
        this.handlePositionError,
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000
        }
      );
    }

    await this.flushQueue();
    this.sendSnapshot({
      trackingState: 'ACTIVE',
      location: this.lastKnownLocation,
      allowWithoutLocation: true
    }).catch(() => {});
    return true;
  }

  async resumeIfNeeded(owner = null) {
    if (this.running && this.activeSession?.sessionId) {
      return true;
    }

    const stored = this.readStoredSession();
    if (!stored?.sessionId) {
      return false;
    }

    const currentOwner = normalizeTrackingOwner(owner);
    const storedOwner = normalizeTrackingOwner(stored);

    if (!currentOwner.isTrackableRole) {
      this.resetRuntime(true);
      return false;
    }

    if (
      storedOwner.userId &&
      currentOwner.userId &&
      storedOwner.userId !== currentOwner.userId
    ) {
      this.resetRuntime(true);
      return false;
    }

    const nextSession = {
      ...stored,
      userId: storedOwner.userId || currentOwner.userId || '',
      role: storedOwner.role || currentOwner.role || ''
    };

    this.activeSession = nextSession;
    this.persistSession();
    return this.start(nextSession);
  }

  async stop({
    reason = 'STOPPED',
    trackingState = 'STOPPED',
    clearStorage = true,
    skipNetwork = false
  } = {}) {
    if (!this.activeSession?.sessionId) {
      this.resetRuntime(clearStorage);
      return false;
    }

    const currentSession = this.activeSession;
    this.running = false;
    
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.detachListeners();

    if (!skipNetwork) {
      try {
        await this.sendSnapshot({
          trackingState,
          stopReason: reason,
          allowWithoutLocation: true,
          source: trackingState === 'PAUSED' ? 'LOGOUT' : 'CHECK_OUT'
        });
      } catch {
        // ignore network errors on shutdown
      }
    }

    this.activeSession = null;
    this.queue = [];
    this.recentSamples = [];
    this.lastKnownLocation = null;
    if (clearStorage && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }

    return Boolean(currentSession?.sessionId);
  }

  resetRuntime(clearStorage = false) {
    this.running = false;
    this.inFlight = false;
    this.activeSession = null;
    this.queue = [];
    this.lastKnownLocation = null;
    this.recentSamples = [];
    this.lastSentAt = 0;
    
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.detachListeners();

    if (clearStorage && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }
}

const locationTrackingService = new LocationTrackingService();

export default locationTrackingService;
