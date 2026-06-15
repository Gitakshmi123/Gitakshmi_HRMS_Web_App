/**
 * useEmployeeLocationTracker
 * 
 * Hook for employee-side real-time GPS tracking.
 * Sends location to backend via Socket.io every SEND_INTERVAL_MS.
 * Usage: const { isTracking, startTracking, stopTracking, error } = useEmployeeLocationTracker(sessionId);
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../utils/token';
import { loadExternalScript, resolveApiOrigin } from '../utils/runtimeAssets';
import {
  normalizeLocationSample,
  stabilizeLocationSamples,
  trimLocationSamples
} from '../utils/locationStability';

const SEND_INTERVAL_MS = 7000; // 7 seconds between location pushes
const GEO_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 15000
};

export default function useEmployeeLocationTracker(sessionId = null, employeeInfo = null) {
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastSentRef = useRef(0);
  const lastStableLocationRef = useRef(null);
  const recentSamplesRef = useRef([]);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState('');
  const [lastLocation, setLastLocation] = useState(null);

  // Connect socket
  const connectSocket = useCallback(async () => {
    if (socketRef.current) return socketRef.current;
    const token = getToken();
    if (!token) throw new Error('Not authenticated');
    const origin = resolveApiOrigin();
    await loadExternalScript(`${origin}/socket.io/socket.io.js`, 'io');
    const socket = window.io(origin, { auth: { token }, withCredentials: true });
    socketRef.current = socket;
    return socket;
  }, []);

  const sendLocation = useCallback((pos) => {
    const rawSnapshot = normalizeLocationSample({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
      altitude: pos.coords.altitude,
      timestamp: new Date(pos.timestamp).toISOString(),
      capturedAt: pos.timestamp || Date.now()
    });
    if (!rawSnapshot) return;

    recentSamplesRef.current = trimLocationSamples(
      [...recentSamplesRef.current, rawSnapshot],
      { maxAgeMs: 15000, maxSamples: 6 }
    );
    const stableSnapshot =
      stabilizeLocationSamples({
        previous: lastStableLocationRef.current,
        samples: recentSamplesRef.current,
        options: { maxAgeMs: 15000, maxSamples: 6, stableRadiusMeters: 25 }
      }) || rawSnapshot;
    lastStableLocationRef.current = stableSnapshot;

    const now = Date.now();
    if (now - lastSentRef.current < SEND_INTERVAL_MS) return;
    lastSentRef.current = now;

    const payload = {
      lat: stableSnapshot.lat,
      lng: stableSnapshot.lng,
      accuracy: stableSnapshot.accuracy,
      speed: stableSnapshot.speed,
      heading: stableSnapshot.heading,
      altitude: stableSnapshot.altitude,
      timestamp: stableSnapshot.timestamp,
      sessionId,
      employee: employeeInfo,
      mocked: false
    };
    setLastLocation(payload);

    if (socketRef.current?.connected) {
      socketRef.current.emit('sendLocation', payload);
    }
  }, [sessionId, employeeInfo]);

  const startTracking = useCallback(async () => {
    setError('');
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }
    try {
      await connectSocket();
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => sendLocation(pos),
        (err) => {
          if (err.code === 1) setError('Location permission denied.');
          else if (err.code === 2) setError('Location unavailable.');
          else setError('Location request timed out.');
        },
        GEO_OPTIONS
      );
      setIsTracking(true);
    } catch (e) {
      setError(e.message || 'Failed to start tracking.');
    }
  }, [connectSocket, sendLocation]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsTracking(false);
    setLastLocation(null);
    lastStableLocationRef.current = null;
    recentSamplesRef.current = [];
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => () => stopTracking(), [stopTracking]);

  return { isTracking, startTracking, stopTracking, error, lastLocation };
}
