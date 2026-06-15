import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Activity, AlertTriangle, Clock, MapPin, RefreshCw, Route, ShieldAlert, Wifi, WifiOff, Eye, EyeOff, Layers, Users, Navigation } from 'lucide-react';
import api from '../../utils/api';
import { getToken } from '../../utils/token';
import { loadExternalScript, loadExternalStylesheet, resolveApiOrigin } from '../../utils/runtimeAssets';
import {
  normalizeLocationSample,
  stabilizeLocationSamples,
  trimLocationSamples
} from '../../utils/locationStability';

const CSS_OVERRIDE = `
  .custom-marker-container { position: relative; width: 52px; height: 60px; }
  .marker-pulse {
    position: absolute; top: 12px; left: 14px; width: 24px; height: 24px;
    border-radius: 50%; opacity: 0.6; z-index: -1;
    animation: pulse-bloom 2s infinite ease-out;
  }
  .marker-pulse-ring {
    position: absolute; top: 4px; left: 6px; width: 40px; height: 40px;
    border-radius: 50%; border: 2px solid; opacity: 0; z-index: -1;
    animation: pulse-ring 2s infinite ease-out;
  }
  @keyframes pulse-bloom { 0% { transform: scale(0.5); opacity: 0.8; } 100% { transform: scale(2.5); opacity: 0; } }
  @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(2); opacity: 0; } }
`;

const MAX_PATH = 500;
const LIVE_POLL_INTERVAL_MS = 15000;
const HISTORY_POLL_INTERVAL_MS = 20000;
const HISTORY_LOOKBACK_MS = 12 * 60 * 60 * 1000;
const ACTIVE_STATUSES = ['ACTIVE', 'SUSPICIOUS'];
const INDIA = [20.5937, 78.9629];
const STREET_TILE_URL = '/api/assets/map-tile/carto-voyager/{z}/{x}/{y}';
const SATELLITE_TILE_URL = '/api/assets/map-tile/esri-imagery/{z}/{x}/{y}';
const STREET_TILE_ATTRIBUTION = 'Labeled road map &copy; CARTO, OpenStreetMap contributors';
const SATELLITE_TILE_ATTRIBUTION = 'Esri Satellite';

const fmtDistance = (value) => {
  const meters = Number(value);
  if (!Number.isFinite(meters) || meters <= 0) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};
const fmtCoord = (value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(5) : '--');
const fmt = v => v ? new Date(v).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtSpeed = s => (typeof s === 'number' && !isNaN(s)) ? `${(s * 3.6).toFixed(1)} km/h` : '—';
const initials = (e = {}) => [e.firstName, e.lastName].filter(Boolean).map(v => v[0].toUpperCase()).join('').slice(0, 2) || 'NA';
const getHistoryFrom = (checkInTime) => checkInTime || new Date(Date.now() - HISTORY_LOOKBACK_MS).toISOString();
const hasValidCoordinates = (location) => {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
};

function calculateDistanceMeters(fromLocation, toLocation) {
  if (!hasValidCoordinates(fromLocation) || !hasValidCoordinates(toLocation)) return 0;
  const toRadians = (value) => (Number(value) * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const lat1 = toRadians(fromLocation.lat);
  const lat2 = toRadians(toLocation.lat);
  const deltaLat = toRadians(Number(toLocation.lat) - Number(fromLocation.lat));
  const deltaLng = toRadians(Number(toLocation.lng) - Number(fromLocation.lng));
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculatePathDistanceMeters(points = []) {
  return points.reduce((total, point, index) => {
    if (index === 0) return total;
    return total + calculateDistanceMeters(points[index - 1]?.location, point.location);
  }, 0);
}

function getClientMeeting(item) {
  return item?.activeClientMeeting || item?.lastClientMeeting || null;
}

function buildEmployeePopup(item) {
  const meeting = getClientMeeting(item);
  const meetingHtml = meeting
    ? `<br/><b>${meeting.status === 'ACTIVE' ? 'Client meeting' : 'Reached'}</b><br/>To: ${meeting.toAddress || meeting.destinationAddress || 'Client place'}<br/>Distance: ${fmtDistance(meeting.totalDistanceMeters || meeting.distanceMeters)}`
    : '';

  return `<b>${item?.employee?.fullName || item?.userId || 'Employee'}</b><br/>${fmt(item?.lastHeartbeatAt)}${meetingHtml}`;
}

function getGeolocationErrorMessage(error) {
  if (!error) return 'Unable to fetch live location.';
  if (error.code === 1) return 'Location permission denied for this browser tab.';
  if (error.code === 2) return 'Current location is unavailable right now.';
  if (error.code === 3) return 'Location request timed out. Retry once in an open area.';
  return error.message || 'Unable to fetch live location.';
}

function getSessionPriority(item) {
  if (item?.status === 'ACTIVE') return 4;
  if (item?.status === 'SUSPICIOUS') return 3;
  if (item?.status === 'PAUSED') return 2;
  if (item?.status === 'STOPPED') return 1;
  return 0;
}

function sortLiveUsers(items = []) {
  return [...items].sort((left, right) => {
    const priorityDelta = getSessionPriority(right) - getSessionPriority(left);
    if (priorityDelta !== 0) return priorityDelta;

    const leftTime = new Date(left.lastHeartbeatAt || left.checkInTime || 0).getTime();
    const rightTime = new Date(right.lastHeartbeatAt || right.checkInTime || 0).getTime();
    return rightTime - leftTime;
  });
}

function upsertLiveUser(items = [], incoming = {}) {
  if (!incoming?.userId) return sortLiveUsers(items);

  const key = String(incoming.userId);
  const existingIndex = items.findIndex((item) => String(item.userId) === key);
  const nextItems = [...items];

  if (existingIndex >= 0) {
    nextItems[existingIndex] = {
      ...nextItems[existingIndex],
      ...incoming,
      employee: incoming.employee || nextItems[existingIndex].employee
    };
  } else {
    nextItems.unshift(incoming);
  }

  return sortLiveUsers(nextItems);
}

function makeIcon(L, label, isOnline, isSelected, heading = 0) {
  const bg = isSelected ? '#3B82F6' : isOnline ? '#10B981' : '#64748B';
  const ring = isSelected ? '#DBEAFE' : isOnline ? '#D1FAE5' : '#F1F5F9';
  
  const pulseHtml = isOnline ? `
    <div class="marker-pulse" style="background: ${bg}"></div>
    <div class="marker-pulse-ring" style="border-color: ${bg}"></div>
  ` : '';

  const rotation = typeof heading === 'number' ? heading : 0;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="60" viewBox="0 0 52 60">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
        <feOffset dx="0" dy="2" result="offsetblur" />
        <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g filter="url(#shadow)">
      <circle cx="26" cy="24" r="22" fill="${ring}" stroke="${bg}" stroke-width="2"/>
      <circle cx="26" cy="24" r="16" fill="${bg}"/>
      <text x="26" y="29" text-anchor="middle" font-size="11" font-weight="700" fill="white" font-family="Arial,sans-serif">${label}</text>
      <path d="M18 40 L26 56 L34 40 Z" fill="${bg}" />
      ${rotation !== 0 ? `<path d="M26 4 L30 12 L22 12 Z" fill="${bg}" transform="rotate(${rotation} 26 24)" />` : ''}
    </g>
  </svg>`;

  return L.divIcon({
    html: `<div class="custom-marker-container">${pulseHtml}${svg}</div>`,
    className: '',
    iconSize: [52, 60],
    iconAnchor: [26, 56],
    popupAnchor: [0, -60]
  });
}

function makeWaypointIcon(L, label, color) {
  return L.divIcon({
    html: `
      <div style="width:34px;height:34px;border-radius:17px;background:${color};border:3px solid white;box-shadow:0 6px 16px rgba(15,23,42,.25);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:800;font-family:Arial,sans-serif;">
        ${label}
      </div>
    `,
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18]
  });
}

export default function AttendanceLiveMap() {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const polylinesRef = useRef(new Map());
  const pathDataRef = useRef(new Map());
  const meetingWaypointMarkersRef = useRef([]);
  const socketRef = useRef(null);
  const hasCenteredOnAdminRef = useRef(false);
  const liveUsersRef = useRef([]);
  const selectedIdRef = useRef('');
  const LRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveUsers, setLiveUsers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [historyPoints, setHistoryPoints] = useState([]);
  const [filterActive, setFilterActive] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [showPaths, setShowPaths] = useState(true);
  const [isSatellite, setIsSatellite] = useState(true);
  const [followSelected, setFollowSelected] = useState(false);
  const followRef = useRef(false);
  useEffect(() => { followRef.current = followSelected; }, [followSelected]);

  const [socketOn, setSocketOn] = useState(false);
  const [myLocation, setMyLocation] = useState(null);
  const [adminLocationError, setAdminLocationError] = useState('');
  const [locatingAdmin, setLocatingAdmin] = useState(false);
  const myMarkerRef = useRef(null);
  const myStableLocationRef = useRef(null);
  const myLocationSamplesRef = useRef([]);
  const accuracyCircleRef = useRef(null);
  const tileLayerRef = useRef(null);

  const selectedUser = useMemo(() => liveUsers.find(u => String(u.userId) === String(selectedId)) || null, [liveUsers, selectedId]);
  const selectedMeeting = useMemo(() => getClientMeeting(selectedUser), [selectedUser]);
  const selectedPathDistanceMeters = useMemo(() => calculatePathDistanceMeters(historyPoints), [historyPoints]);
  const selectedDistanceMeters = Number(selectedMeeting?.totalDistanceMeters || selectedMeeting?.distanceMeters || 0) || selectedPathDistanceMeters;
  useEffect(() => { liveUsersRef.current = liveUsers; }, [liveUsers]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const updateAdminLocation = useCallback((pos, { recenter = false } = {}) => {
    const rawSnapshot = normalizeLocationSample({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
      altitude: pos.coords.altitude,
      timestamp: new Date(pos.timestamp || Date.now()).toISOString(),
      capturedAt: pos.timestamp || Date.now()
    });
    if (!rawSnapshot) return null;

    myLocationSamplesRef.current = trimLocationSamples(
      [...myLocationSamplesRef.current, rawSnapshot],
      { maxAgeMs: 15000, maxSamples: 6 }
    );
    const stableSnapshot =
      stabilizeLocationSamples({
        previous: myStableLocationRef.current,
        samples: myLocationSamplesRef.current,
        options: { maxAgeMs: 15000, maxSamples: 6, stableRadiusMeters: 25 }
      }) || rawSnapshot;

    myStableLocationRef.current = stableSnapshot;
    setMyLocation(stableSnapshot);
    setAdminLocationError('');

    if (
      recenter &&
      mapRef.current &&
      !selectedIdRef.current &&
      (!liveUsersRef.current.length || !liveUsersRef.current.some((item) => ACTIVE_STATUSES.includes(item.status)))
    ) {
      mapRef.current.setView([stableSnapshot.lat, stableSnapshot.lng], 16, { animate: true });
      hasCenteredOnAdminRef.current = true;
    }

    return stableSnapshot;
  }, []);

  const requestAdminLocation = useCallback(async ({ recenter = false, silent = false } = {}) => {
    if (!navigator.geolocation) {
      setAdminLocationError('Geolocation is not supported in this browser.');
      return null;
    }

    if (!silent) {
      setLocatingAdmin(true);
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 15000
          }
        );
      });

      return updateAdminLocation(position, { recenter });
    } catch (geoError) {
      setAdminLocationError(getGeolocationErrorMessage(geoError));
      return null;
    } finally {
      if (!silent) {
        setLocatingAdmin(false);
      }
    }
  }, [updateAdminLocation]);

  // Load Leaflet
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        await loadExternalStylesheet('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        await loadExternalScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'L');
        if (!active || !mapDivRef.current) return;
        const L = window.L;
        LRef.current = L;
        // Fix default marker icons
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' });

        const map = L.map(mapDivRef.current, { center: INDIA, zoom: 5, zoomControl: false });
        const tile = L.tileLayer(SATELLITE_TILE_URL, {
          attribution: SATELLITE_TILE_ATTRIBUTION,
          maxZoom: 22,
          maxNativeZoom: 19,
          crossOrigin: false
        }).addTo(map);
        tileLayerRef.current = tile;
        mapRef.current = map;
        setMapReady(true);
      } catch (e) {
        setError('Failed to load map: ' + e.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => { active = false; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // Track Admin's own location
  useEffect(() => {
    if (!mapReady || !navigator.geolocation) return;

    requestAdminLocation({ recenter: true, silent: true }).catch(() => {});

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        updateAdminLocation(pos);
      },
      (geoError) => {
        setAdminLocationError(getGeolocationErrorMessage(geoError));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      myStableLocationRef.current = null;
      myLocationSamplesRef.current = [];
    };
  }, [mapReady, requestAdminLocation, updateAdminLocation]);

  // Update Admin Marker
  useEffect(() => {
    if (!mapRef.current || !myLocation || !LRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;
    const { lat, lng, heading } = myLocation;

    if (!myMarkerRef.current) {
      const icon = L.divIcon({
        html: `
          <div class="custom-marker-container">
            <div class="marker-pulse" style="background: #3B82F6; width: 30px; height: 30px; top: 10px; left: 10px;"></div>
            <svg width="50" height="50" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="8" fill="#3B82F6" stroke="white" stroke-width="3" />
              ${heading ? `<path d="M25 5 L30 15 L20 15 Z" fill="#3B82F6" transform="rotate(${heading} 25 25)" />` : ''}
            </svg>
          </div>
        `,
        className: '',
        iconSize: [50, 50],
        iconAnchor: [25, 25]
      });
      myMarkerRef.current = L.marker([lat, lng], { icon, zIndexOffset: 2000 })
        .addTo(map)
        .bindPopup(`<b>You</b> (Admin)<br/>Accuracy ${myLocation.accuracy ? `±${Math.round(myLocation.accuracy)}m` : '—'}`);
    } else {
      myMarkerRef.current.setLatLng([lat, lng]);
      myMarkerRef.current.setPopupContent(`<b>You</b> (Admin)<br/>Accuracy ${myLocation.accuracy ? `±${Math.round(myLocation.accuracy)}m` : '—'}`);
    }
  }, [myLocation, mapReady]);

  // Add styles
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = CSS_OVERRIDE;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Toggle tile layer
  useEffect(() => {
    if (!mapRef.current || !LRef.current || !tileLayerRef.current) return;
    const L = LRef.current;
    tileLayerRef.current.remove();
    tileLayerRef.current = isSatellite
      ? L.tileLayer(SATELLITE_TILE_URL, { 
          attribution: SATELLITE_TILE_ATTRIBUTION, 
          maxZoom: 22,
          maxNativeZoom: 19,
          crossOrigin: false
        }).addTo(mapRef.current)
      : L.tileLayer(STREET_TILE_URL, { 
          attribution: STREET_TILE_ATTRIBUTION, 
          maxZoom: 22,
          maxNativeZoom: 20,
          crossOrigin: false
        }).addTo(mapRef.current);
  }, [isSatellite]);

  // Fetch live data
  const fetchLive = useCallback(async (preserve = true) => {
    try {
      setLoading(true);
      const res = await api.get('/location/live');
      const items = Array.isArray(res?.data?.data) ? res.data.data : [];
      setLiveUsers(sortLiveUsers(items));
      if (!preserve && items.length && !selectedIdRef.current) {
        const firstPreferred = sortLiveUsers(items)[0];
        if (firstPreferred) setSelectedId(String(firstPreferred.userId));
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load live data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLive(false); }, [fetchLive]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchLive(true);
    }, LIVE_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [fetchLive]);

  // Fetch history
  const fetchHistory = useCallback(async (uid, options = {}) => {
    if (!uid) { setHistoryPoints([]); return; }
    try {
      const from = options.from || getHistoryFrom(selectedUser?.checkInTime);
      const to = options.to || new Date().toISOString();
      const sessionId = options.sessionId || selectedUser?.sessionId || '';
      const res = await api.get(`/location/history/${uid}`, {
        params: {
          from,
          to,
          limit: options.limit || 2000,
          ...(sessionId ? { sessionId } : {})
        }
      });
      setHistoryPoints(res?.data?.data?.points || []);
    } catch { setHistoryPoints([]); }
  }, [selectedUser?.checkInTime, selectedUser?.sessionId]);

  useEffect(() => {
    fetchHistory(selectedId, {
      from: getHistoryFrom(selectedUser?.checkInTime),
      sessionId: selectedUser?.sessionId || '',
      limit: 2000
    });
  }, [selectedId, selectedUser?.checkInTime, selectedUser?.sessionId, fetchHistory]);

  useEffect(() => {
    if (!selectedId) return undefined;

    const intervalId = window.setInterval(() => {
      fetchHistory(selectedId, {
        from: getHistoryFrom(selectedUser?.checkInTime),
        sessionId: selectedUser?.sessionId || '',
        limit: 2000
      });
    }, HISTORY_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [fetchHistory, selectedId, selectedUser?.checkInTime, selectedUser?.sessionId]);

  // Animate marker movement
  function animateMarker(marker, toLat, toLng, duration = 1000) {
    const from = marker.getLatLng();
    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      marker.setLatLng([from.lat + (toLat - from.lat) * ease, from.lng + (toLng - from.lng) * ease]);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Path Replay Animation
  const replayPath = async () => {
    if (!selectedId || !historyPoints.length || animating) return;
    setAnimating(true);
    const L = LRef.current;
    const map = mapRef.current;
    const marker = markersRef.current.get(selectedId);
    if (!marker) { setAnimating(false); return; }

    const points = historyPoints.filter(p => hasValidCoordinates(p.location));
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      marker.setLatLng([p.location.lat, p.location.lng]);
      if (i % 5 === 0) map.panTo([p.location.lat, p.location.lng]);
      await new Promise(r => setTimeout(r, 50));
    }
    setAnimating(false);
  };

  // Sync markers on map
  useEffect(() => {
    if (!mapRef.current || !mapReady || !LRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;
    const bounds = [];

    const filtered = liveUsers.filter(u => filterActive ? ACTIVE_STATUSES.includes(u.status) : true);
    
    filtered.forEach(item => {
      const uid = String(item.userId);
      const loc = item.currentLocation;
      if (!hasValidCoordinates(loc)) return;
      const isSelected = uid === String(selectedId);
      const isOnline = !!item.online;
      const label = initials(item.employee);
      const icon = makeIcon(L, label, isOnline, isSelected, loc.heading);

      let marker = markersRef.current.get(uid);
      if (!marker) {
        marker = L.marker([loc.lat, loc.lng], { icon, zIndexOffset: isSelected ? 1000 : 0 })
          .addTo(map)
          .bindPopup(buildEmployeePopup(item));
        marker.on('click', () => setSelectedId(uid));
        markersRef.current.set(uid, marker);
      } else {
        const cur = marker.getLatLng();
        if (Math.abs(cur.lat - loc.lat) > 0.00001 || Math.abs(cur.lng - loc.lng) > 0.00001) {
          animateMarker(marker, loc.lat, loc.lng, 1500);
        }
        marker.setIcon(icon);
        marker.setZIndexOffset(isSelected ? 1000 : 0);
        marker.setPopupContent(buildEmployeePopup(item));
      }
      bounds.push([loc.lat, loc.lng]);
    });

    // Handle Accuracy Circle for selected user
    if (selectedUser && selectedUser.currentLocation && mapRef.current) {
      const { lat, lng, accuracy } = selectedUser.currentLocation;
      if (hasValidCoordinates(selectedUser.currentLocation) && Number.isFinite(Number(accuracy))) {
        if (!accuracyCircleRef.current) {
          accuracyCircleRef.current = L.circle([lat, lng], {
            radius: accuracy,
            color: '#3B82F6',
            fillColor: '#3B82F6',
            fillOpacity: 0.15,
            weight: 1,
            dashArray: '5, 5'
          }).addTo(mapRef.current);
        } else {
          accuracyCircleRef.current.setLatLng([lat, lng]);
          accuracyCircleRef.current.setRadius(accuracy);
        }
      } else if (accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
        accuracyCircleRef.current = null;
      }
    } else if (accuracyCircleRef.current) {
      accuracyCircleRef.current.remove();
      accuracyCircleRef.current = null;
    }

    // Remove stale or filtered out
    markersRef.current.forEach((m, uid) => {
      if (!filtered.some(u => String(u.userId) === uid)) {
        m.remove(); markersRef.current.delete(uid);
        const pl = polylinesRef.current.get(uid);
        if (pl) { pl.remove(); polylinesRef.current.delete(uid); }
        pathDataRef.current.delete(uid);
      }
    });

    if (bounds.length && !selectedId) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    } else if (!bounds.length && myLocation && !selectedId && !hasCenteredOnAdminRef.current) {
      map.setView([myLocation.lat, myLocation.lng], 16, { animate: true });
      hasCenteredOnAdminRef.current = true;
    }
  }, [liveUsers, mapReady, selectedId, filterActive, selectedUser, myLocation]);

  // Draw polylines from history
  useEffect(() => {
    if (!mapRef.current || !mapReady || !LRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;

    polylinesRef.current.forEach(pl => pl.remove());
    polylinesRef.current.clear();
    pathDataRef.current.clear();

    if (!selectedId || !historyPoints.length) return;

    const path = historyPoints
      .filter(p => hasValidCoordinates(p.location))
      .slice(-MAX_PATH)
      .map(p => [p.location.lat, p.location.lng]);

    if (!path.length) return;
    pathDataRef.current.set(selectedId, path);

    const pl = L.polyline(path, {
      color: '#0F766E', weight: 4, opacity: 0.9,
      dashArray: null
    }).addTo(map);
    if (showPaths) pl.addTo(map); else pl.remove();
    polylinesRef.current.set(selectedId, pl);

    map.fitBounds(path, { padding: [80, 80] });
  }, [historyPoints, selectedId, mapReady, showPaths]);

  // Toggle polyline visibility
  useEffect(() => {
    if (!mapRef.current) return;
    polylinesRef.current.forEach(pl => showPaths ? pl.addTo(mapRef.current) : pl.remove());
  }, [showPaths]);

  // Pan to selected user
  useEffect(() => {
    if (!mapRef.current || !selectedUser?.currentLocation) return;
    const { lat, lng } = selectedUser.currentLocation;
    if (hasValidCoordinates(selectedUser.currentLocation)) { mapRef.current.setView([lat, lng], 15, { animate: true }); }
  }, [selectedId, selectedUser]);

  // Show client meeting from/to waypoints for HR
  useEffect(() => {
    meetingWaypointMarkersRef.current.forEach(marker => marker.remove());
    meetingWaypointMarkersRef.current = [];

    if (!mapRef.current || !mapReady || !LRef.current || !selectedMeeting) return;
    const L = LRef.current;
    const map = mapRef.current;
    const fromLocation = selectedMeeting.fromLocation || selectedMeeting.startLocation;
    const toLocation = selectedMeeting.toLocation || selectedMeeting.destinationLocation;
    const plannedRoutePoints = Array.isArray(selectedMeeting.plannedRoute?.points)
      ? selectedMeeting.plannedRoute.points.filter(hasValidCoordinates).map(point => [point.lat, point.lng])
      : [];
    const bounds = [];

    if (plannedRoutePoints.length > 1) {
      const plannedRoute = L.polyline(plannedRoutePoints, {
        color: '#2563EB',
        weight: 4,
        opacity: 0.75,
        dashArray: '8 8'
      }).addTo(map);
      meetingWaypointMarkersRef.current.push(plannedRoute);
      bounds.push(...plannedRoutePoints);
    }

    if (hasValidCoordinates(fromLocation)) {
      const marker = L.marker([fromLocation.lat, fromLocation.lng], {
        icon: makeWaypointIcon(L, 'FROM', '#059669'),
        zIndexOffset: 1500
      })
        .addTo(map)
        .bindPopup(`<b>From</b><br/>${fmtCoord(fromLocation.lat)}, ${fmtCoord(fromLocation.lng)}`);
      meetingWaypointMarkersRef.current.push(marker);
      bounds.push([fromLocation.lat, fromLocation.lng]);
    }

    if (hasValidCoordinates(toLocation)) {
      const marker = L.marker([toLocation.lat, toLocation.lng], {
        icon: makeWaypointIcon(L, 'TO', '#2563EB'),
        zIndexOffset: 1500
      })
        .addTo(map)
        .bindPopup(`<b>To</b><br/>${selectedMeeting.toAddress || selectedMeeting.destinationAddress || 'Client place'}`);
      meetingWaypointMarkersRef.current.push(marker);
      bounds.push([toLocation.lat, toLocation.lng]);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [90, 90], maxZoom: 15 });
    }
  }, [mapReady, selectedMeeting]);

  // Socket.io
  useEffect(() => {
    let mounted = true;
    async function connect() {
      try {
        const token = getToken();
        if (!token) return;
        const origin = resolveApiOrigin();
        await loadExternalScript(`${origin}/socket.io/socket.io.js`, 'io');
        if (!mounted || socketRef.current) return;

        const socket = window.io(origin, { auth: { token }, withCredentials: true });
        socket.on('connect', () => {
          setSocketOn(true);
          socket.emit('tracking:subscribe');
          fetchLive(true);
        });
        socket.on('disconnect', () => setSocketOn(false));

        socket.on('tracking:location:update', payload => {
          const uid = String(payload.userId);
          setLiveUsers(prev => upsertLiveUser(prev, payload));

          if (uid === selectedIdRef.current && payload.currentLocation) {
            if (followRef.current && mapRef.current && hasValidCoordinates(payload.currentLocation)) {
              mapRef.current.panTo([payload.currentLocation.lat, payload.currentLocation.lng], { animate: true });
            }

            const { lat, lng } = payload.currentLocation;
            if (hasValidCoordinates(payload.currentLocation)) {
              // Update live polyline
              const pts = pathDataRef.current.get(uid) || [];
              const newPts = [...pts, [lat, lng]].slice(-MAX_PATH);
              pathDataRef.current.set(uid, newPts);
              const pl = polylinesRef.current.get(uid);
              if (pl) pl.setLatLngs(newPts);
              else if (mapRef.current && LRef.current && newPts.length > 1) {
                const newPl = LRef.current.polyline(newPts, { color: '#0F766E', weight: 4 }).addTo(mapRef.current);
                polylinesRef.current.set(uid, newPl);
              }

              setHistoryPoints(prev => [...prev, {
                id: `live-${Date.now()}`,
                timestamp: payload.currentLocation.timestamp || new Date().toISOString(),
                location: payload.currentLocation,
                source: 'LIVE', security: { suspected: false }
              }].slice(-MAX_PATH));
            }
          }
        });

        socket.on('tracking:session:update', payload => {
          setLiveUsers(prev => upsertLiveUser(prev, payload));
        });

        socketRef.current = socket;
      } catch { /* soft fail */ }
    }
    connect();
    return () => {
      mounted = false;
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    };
  }, [fetchLive]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-none">Live GPS Tracking</h2>
          </div>
          <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${socketOn ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {socketOn ? <Wifi size={12} /> : <WifiOff size={12} />}
            {socketOn ? 'Live' : 'Polling'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setFilterActive(v => !v)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border transition-all ${filterActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200'}`}>
            {filterActive ? 'Active Only' : 'Show All'}
          </button>
          <button onClick={() => setShowPaths(v => !v)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border transition-all ${showPaths ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-white text-slate-500 border-slate-200'}`}>
            {showPaths ? <Eye size={14} /> : <EyeOff size={14} />} Paths
          </button>
          <button onClick={() => setFollowSelected(v => !v)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border transition-all ${followSelected ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-inner' : 'bg-white text-slate-500 border-slate-200'}`}>
            <Activity size={14} className={followSelected ? 'animate-pulse' : ''} /> Follow
          </button>
          <button onClick={() => setIsSatellite(v => !v)}

            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-teal-200 transition-all">
            <Layers size={14} /> {isSatellite ? 'Satellite' : 'Road'}
          </button>
          <button
            onClick={() => {
              if (myLocation) {
                mapRef.current?.setView([myLocation.lat, myLocation.lng], 15, { animate: true });
              } else {
                requestAdminLocation({ recenter: true });
              }
            }}
            className="h-9 w-9 flex items-center justify-center bg-blue-50 border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-100 transition-all shadow-sm"
            title={myLocation ? 'Center on my live location' : 'Find my live location'}
          >
            {locatingAdmin ? <RefreshCw size={15} className="animate-spin" /> : <Navigation size={15} fill="currentColor" />}
          </button>
          <button onClick={() => fetchLive(true)}
            className="h-9 w-9 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-xl hover:text-teal-600 hover:border-teal-200 transition-all">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3 rounded-xl">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {adminLocationError && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{adminLocationError}</span>
          </div>
          <button
            onClick={() => requestAdminLocation({ recenter: true })}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-3">
        {/* Employee list */}
        <div className="flex flex-col gap-3 max-h-[640px] overflow-y-auto pr-1">
          <div className="flex items-center gap-2 px-1">
            <Users size={13} className="text-slate-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {liveUsers.length} session{liveUsers.length !== 1 ? 's' : ''} today
            </span>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-[12px] font-bold flex-shrink-0">
                  ME
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">Your live location</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {myLocation ? 'Admin browser GPS is active' : locatingAdmin ? 'Requesting location permission...' : 'Location not locked yet'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => requestAdminLocation({ recenter: true })}
                className="h-8 w-8 flex items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-600 hover:bg-blue-100 transition-colors"
                title="Refresh my location"
              >
                {locatingAdmin ? <RefreshCw size={13} className="animate-spin" /> : <Navigation size={13} fill="currentColor" />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/90 rounded-xl p-2">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1"><MapPin size={10} /> Coordinates</div>
                <p className="text-xs font-semibold text-slate-700">
                  {myLocation ? `${myLocation.lat.toFixed(5)}, ${myLocation.lng.toFixed(5)}` : '—'}
                </p>
              </div>
              <div className="bg-white/90 rounded-xl p-2">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1"><Activity size={10} /> Accuracy</div>
                <p className="text-xs font-semibold text-slate-700">
                  {myLocation?.accuracy ? `±${Math.round(myLocation.accuracy)}m` : '—'}
                </p>
              </div>
            </div>
          </div>

          {loading && liveUsers.length === 0
            ? [...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />)
            : liveUsers.length === 0
              ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  <MapPin size={28} className="mb-3 text-slate-300" />
                  <p className="text-sm font-medium">No employee tracking sessions yet</p>
                  <p className="text-xs mt-1 text-slate-400">Employee sessions appear automatically after secure check-in.</p>
                </div>
              )
              : liveUsers.map(item => {
                const isSelected = String(item.userId) === String(selectedId);
                const meeting = getClientMeeting(item);
                return (
                  <button key={item.sessionId || item.userId} type="button"
                    onClick={() => setSelectedId(String(item.userId))}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${isSelected ? 'border-teal-300 bg-teal-50 shadow-sm' : 'border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/30'}`}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${item.online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {initials(item.employee)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{item.employee?.fullName || 'Employee'}</p>
                          <p className="text-[11px] text-slate-500 truncate">{item.employee?.employeeId} · {item.employee?.designation || 'Employee'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.status === 'SUSPICIOUS' ? 'bg-amber-100 text-amber-700' : item.online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {item.status === 'SUSPICIOUS' ? 'FLAGGED' : item.online ? 'LIVE' : item.status || 'OFFLINE'}
                        </span>
                        {item.security?.spoofDetected && <ShieldAlert size={14} className="text-amber-500" />}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/80 rounded-xl p-2">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1"><Clock size={10} /> Last ping</div>
                        <p className="text-xs font-semibold text-slate-700">{fmt(item.lastHeartbeatAt)}</p>
                      </div>
                      <div className="bg-white/80 rounded-xl p-2">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1"><Activity size={10} /> Accuracy</div>
                        <p className="text-xs font-semibold text-slate-700">
                          {item.currentLocation?.accuracy ? `±${Math.round(item.currentLocation.accuracy)}m` : '—'}
                        </p>
                      </div>
                    </div>
                    {meeting && (
                      <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/80 p-2">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-blue-700">
                            <Route size={10} />
                            {meeting.status === 'ACTIVE' ? 'Client meeting' : 'Reached'}
                          </span>
                          <span className="text-[10px] font-bold text-blue-700">
                            {fmtDistance(meeting.totalDistanceMeters || meeting.distanceMeters)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="min-w-0">
                            <span className="block font-semibold text-slate-400">From</span>
                            <span className="block truncate font-semibold text-slate-700">
                              {meeting.fromLocation
                                ? `${fmtCoord(meeting.fromLocation.lat)}, ${fmtCoord(meeting.fromLocation.lng)}`
                                : 'Live start'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="block font-semibold text-slate-400">To</span>
                            <span className="block truncate font-semibold text-slate-700">
                              {meeting.toAddress || meeting.destinationAddress || 'Client place'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {(item.flagReason || item.flagReasons?.[0] || item.security?.lastReasons?.[0]) && (
                      <p className="mt-2 text-[11px] font-medium text-rose-700">
                        {item.flagReason || item.flagReasons?.[0] || item.security?.lastReasons?.[0]}
                      </p>
                    )}
                  </button>
                );
              })
          }
        </div>

        {/* Map */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm" style={{ minHeight: 560 }}>
          <div className="relative" style={{ height: 560 }}>
            <div ref={mapDivRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

            {/* Selected user info overlay */}
            {selectedUser && (
              <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200 shadow-lg p-2 w-[190px] z-[1000] leading-none">
                <div className="mb-0.5 flex flex-col">
                  <p className="text-[10px] font-bold text-slate-900 truncate leading-none">{selectedUser.employee?.fullName || '—'}</p>
                  {selectedUser.employee?.designation && (
                    <p className="text-[8px] text-slate-500 leading-none mt-0.5 truncate">{selectedUser.employee?.designation}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 border-t border-slate-100 pt-1.5 mt-1">
                  <div className="flex justify-between items-center gap-1 leading-none">
                    <span className="text-slate-400 text-[8px] leading-none">Speed</span>
                    <span className="font-semibold text-[8px] truncate leading-none">{fmtSpeed(selectedUser.currentLocation?.speed)}</span>
                  </div>
                  <div className="flex justify-between items-center gap-1 leading-none">
                    <span className="text-slate-400 text-[8px] leading-none">Path pts</span>
                    <span className="font-semibold text-[8px] truncate leading-none">{historyPoints.length}</span>
                  </div>
                  <div className="flex justify-between items-center gap-1 leading-none">
                    <span className="text-slate-400 text-[8px] leading-none">Distance</span>
                    <span className="font-semibold text-[8px] truncate leading-none">{fmtDistance(selectedDistanceMeters)}</span>
                  </div>
                  <div className="flex justify-between items-center gap-1 leading-none">
                    <span className="text-slate-400 text-[8px] leading-none">Check-in</span>
                    <span className="font-semibold text-[8px] truncate leading-none">{fmt(selectedUser.checkInTime)}</span>
                  </div>
                  <div className="flex justify-between items-center gap-1 leading-none">
                    <span className="text-slate-400 text-[8px] leading-none">Security</span>
                    <span className={`font-semibold text-[8px] truncate leading-none ${selectedUser.flagged || selectedUser.security?.spoofDetected ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {selectedUser.flagged || selectedUser.security?.spoofDetected ? 'Flagged' : 'Clear'}
                    </span>
                  </div>
                  {(selectedUser.flagReason || selectedUser.flagReasons?.[0] || selectedUser.security?.lastReasons?.[0]) && (
                    <div className="pt-0.5 flex flex-col gap-0.5">
                      <span className="text-slate-400 text-[8px] leading-none">Reason</span>
                      <p className="font-medium text-[8px] text-rose-700 leading-tight break-words line-clamp-3">
                        {selectedUser.flagReason || selectedUser.flagReasons?.[0] || selectedUser.security?.lastReasons?.[0]}
                      </p>
                    </div>
                  )}
                  {selectedMeeting && (
                    <div className="mt-1 rounded border border-blue-100 bg-blue-50 p-1.5">
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <span className="text-[8px] font-bold uppercase text-blue-700">
                          {selectedMeeting.status === 'ACTIVE' ? 'Client meeting' : 'Reached'}
                        </span>
                        <span className="text-[8px] font-bold text-blue-700">{fmtDistance(selectedDistanceMeters)}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="min-w-0">
                          <span className="block text-[8px] font-semibold text-slate-400">From</span>
                          <span className="block truncate text-[8px] font-semibold text-slate-700">
                            {selectedMeeting.fromLocation
                              ? `${fmtCoord(selectedMeeting.fromLocation.lat)}, ${fmtCoord(selectedMeeting.fromLocation.lng)}`
                              : 'Live start'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="block text-[8px] font-semibold text-slate-400">To</span>
                          <span className="block truncate text-[8px] font-semibold text-slate-700">
                            {selectedMeeting.toAddress || selectedMeeting.destinationAddress || 'Client place'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button 
                  onClick={replayPath}
                  disabled={animating || !historyPoints.length}
                  className="w-full mt-1 flex items-center justify-center gap-1 bg-slate-900 text-white text-[8px] font-bold py-1 rounded shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-50 leading-none"
                >
                  <Navigation size={8} className={animating ? 'animate-bounce' : ''} />
                  {animating ? 'Replaying...' : 'Replay Path'}
                </button>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 z-[2000]">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500 font-medium">Loading map...</p>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Online</div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><div className="w-3 h-3 rounded-full bg-slate-400" /> Offline</div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><div className="h-1 w-6 rounded bg-teal-600" /> Path</div>
            <div className="ml-auto text-[11px] text-slate-400">Proxied map tiles · Max {MAX_PATH} path pts · No API key needed</div>
          </div>
        </div>
      </div>
    </div>
  );
}
