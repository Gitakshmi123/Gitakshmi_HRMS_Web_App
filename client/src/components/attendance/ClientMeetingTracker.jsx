import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle,
  LocateFixed,
  MapPin,
  RefreshCw,
  Route,
  Square,
  Play
} from 'lucide-react';
import api from '../../utils/api';
import locationTrackingService from '../../services/locationTracking.service';
import { showToast } from '../../utils/uiNotifications';
import { loadExternalScript, loadExternalStylesheet } from '../../utils/runtimeAssets';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const ROAD_TILE_URL = '/api/assets/map-tile/carto-voyager/{z}/{x}/{y}';
const ROAD_TILE_ATTRIBUTION = 'Labeled road map &copy; CARTO, OpenStreetMap contributors';
const INDIA_CENTER = [20.5937, 78.9629];

const fmtCoord = (value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(5) : '--');
const fmtAccuracy = (value) => (Number.isFinite(Number(value)) ? `+/-${Math.round(Number(value))}m` : '--');
const fmtTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const fmtDistance = (value) => {
  const meters = Number(value);
  if (!Number.isFinite(meters) || meters <= 0) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};
const fmtDuration = (value) => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return '--';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

const isValidPoint = (point) =>
  Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng));

function calculateDistanceMeters(fromLocation, toLocation) {
  if (!isValidPoint(fromLocation) || !isValidPoint(toLocation)) return 0;
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

function toLocationPayload(point, fallbackAccuracy = 25) {
  if (!isValidPoint(point)) return null;
  return {
    lat: Number(point.lat),
    lng: Number(point.lng),
    accuracy: Number.isFinite(Number(point.accuracy)) ? Number(point.accuracy) : fallbackAccuracy,
    speed: Number.isFinite(Number(point.speed)) ? Number(point.speed) : null,
    heading: Number.isFinite(Number(point.heading)) ? Number(point.heading) : null,
    altitude: Number.isFinite(Number(point.altitude)) ? Number(point.altitude) : null,
    timestamp: point.timestamp || new Date().toISOString(),
    mocked: Boolean(point.mocked)
  };
}

function buildDirectRoute(fromPoint, toPoint) {
  const from = toLocationPayload(fromPoint);
  const to = toLocationPayload(toPoint);
  if (!from || !to) return null;
  const distanceMeters = calculateDistanceMeters(from, to);
  return {
    provider: 'direct',
    points: [
      { lat: from.lat, lng: from.lng },
      { lat: to.lat, lng: to.lng }
    ],
    distanceMeters,
    durationSeconds: distanceMeters > 0 ? Math.round(distanceMeters / 8.33) : 0,
    fallback: true,
    fetchedAt: new Date().toISOString()
  };
}

function normalizeGeoPosition(position) {
  if (!position?.coords) return null;
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    speed: position.coords.speed,
    heading: position.coords.heading,
    altitude: position.coords.altitude,
    timestamp: new Date(position.timestamp || Date.now()).toISOString(),
    mocked: false
  };
}

function captureLocation({ timeout = 15000, maximumAge = 5000 } = {}) {
  if (!navigator.geolocation) {
    return Promise.reject(new Error('Location is not available on this device.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(normalizeGeoPosition(position)),
      reject,
      {
        enableHighAccuracy: true,
        maximumAge,
        timeout
      }
    );
  });
}

function makeRouteIcon(L, label, color, pulse = false) {
  const pulseHtml = pulse
    ? `<span style="position:absolute;inset:-7px;border-radius:999px;background:${color};opacity:.16;animation:meetingPulse 1.6s infinite ease-out;"></span>`
    : '';

  return L.divIcon({
    html: `
      <div style="position:relative;width:32px;height:32px;">
        ${pulseHtml}
        <span style="position:absolute;inset:0;border-radius:999px;background:${color};border:3px solid #fff;box-shadow:0 8px 18px rgba(15,23,42,.24);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;font-family:Arial,sans-serif;">
          ${label}
        </span>
      </div>
    `,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
}

function escapeMapLabel(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compactMapLabel(value, fallback) {
  const label = String(value || fallback || '').trim();
  if (!label) return '';
  return label.length > 52 ? `${label.slice(0, 49)}...` : label;
}

function makeRouteLabelIcon(L, text, color) {
  const label = escapeMapLabel(compactMapLabel(text, ''));
  if (!label) return null;

  return L.divIcon({
    html: `
      <div style="max-width:210px;padding:5px 8px;border-radius:7px;background:white;border:1px solid ${color};box-shadow:0 8px 20px rgba(15,23,42,.18);color:#0f172a;font-size:11px;font-weight:700;font-family:Arial,sans-serif;line-height:1.2;white-space:normal;">
        ${label}
      </div>
    `,
    className: '',
    iconSize: [210, 32],
    iconAnchor: [-12, 42],
    popupAnchor: [0, -18]
  });
}

function MeetingRouteMap({
  startPoint,
  endPoint,
  currentPoint,
  routePoints = [],
  progressPoints = [],
  startLabel = '',
  endLabel = '',
  currentLabel = 'Live location',
  heightClass = 'h-44'
}) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const LRef = useRef(null);
  const fittedRouteKeyRef = useRef('');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    let active = true;

    async function initMap() {
      try {
        await loadExternalStylesheet(LEAFLET_CSS);
        await loadExternalScript(LEAFLET_JS, 'L');
        if (!active || !mapDivRef.current) return;
        const L = window.L;
        LRef.current = L;

        if (!document.getElementById('meeting-route-map-style')) {
          const style = document.createElement('style');
          style.id = 'meeting-route-map-style';
          style.textContent = '@keyframes meetingPulse { 0% { transform:scale(.8); opacity:.28; } 100% { transform:scale(2.2); opacity:0; } }';
          document.head.appendChild(style);
        }

        const map = L.map(mapDivRef.current, {
          zoomControl: true,
          attributionControl: true
        }).setView(INDIA_CENTER, 5);

        L.tileLayer(ROAD_TILE_URL, {
          maxZoom: 22,
          maxNativeZoom: 20,
          attribution: ROAD_TILE_ATTRIBUTION,
          crossOrigin: false
        }).addTo(map);

        mapRef.current = map;
        setMapReady(true);
        window.setTimeout(() => map.invalidateSize(), 120);
      } catch {
        if (active) setMapError('Map could not be loaded.');
      }
    }

    initMap();

    return () => {
      active = false;
      layersRef.current.forEach((layer) => layer.remove());
      layersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !LRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;

    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];

    const bounds = [];
    const normalizedRoutePoints = (Array.isArray(routePoints) ? routePoints : [])
      .filter(isValidPoint)
      .map((point) => [Number(point.lat), Number(point.lng)]);
    const normalizedProgressPoints = (Array.isArray(progressPoints) ? progressPoints : [])
      .filter(isValidPoint)
      .map((point) => [Number(point.lat), Number(point.lng)]);

    if (normalizedRoutePoints.length > 1) {
      const routeLine = L.polyline(normalizedRoutePoints, {
        color: '#2563EB',
        weight: 4,
        opacity: 0.8
      }).addTo(map);
      layersRef.current.push(routeLine);
      bounds.push(...normalizedRoutePoints);
    }

    if (normalizedProgressPoints.length > 1) {
      const progressLine = L.polyline(normalizedProgressPoints, {
        color: '#059669',
        weight: 5,
        opacity: 0.95
      }).addTo(map);
      layersRef.current.push(progressLine);
      bounds.push(...normalizedProgressPoints);
    }

    if (isValidPoint(startPoint)) {
      const marker = L.marker([startPoint.lat, startPoint.lng], {
        icon: makeRouteIcon(L, 'A', '#059669'),
        zIndexOffset: 800
      })
        .addTo(map)
        .bindPopup('Starting point');
      layersRef.current.push(marker);
      bounds.push([startPoint.lat, startPoint.lng]);

      const labelIcon = makeRouteLabelIcon(L, startLabel || 'Starting point', '#059669');
      if (labelIcon) {
        layersRef.current.push(
          L.marker([startPoint.lat, startPoint.lng], {
            icon: labelIcon,
            interactive: false,
            zIndexOffset: 801
          }).addTo(map)
        );
      }
    }

    if (isValidPoint(endPoint)) {
      const marker = L.marker([endPoint.lat, endPoint.lng], {
        icon: makeRouteIcon(L, 'B', '#2563EB'),
        zIndexOffset: 900
      })
        .addTo(map)
        .bindPopup('Ending point');
      layersRef.current.push(marker);
      bounds.push([endPoint.lat, endPoint.lng]);

      const labelIcon = makeRouteLabelIcon(L, endLabel || 'Ending point', '#2563EB');
      if (labelIcon) {
        layersRef.current.push(
          L.marker([endPoint.lat, endPoint.lng], {
            icon: labelIcon,
            interactive: false,
            zIndexOffset: 901
          }).addTo(map)
        );
      }
    }

    if (isValidPoint(currentPoint)) {
      const marker = L.marker([currentPoint.lat, currentPoint.lng], {
        icon: makeRouteIcon(L, 'YOU', '#DC2626', true),
        zIndexOffset: 1200
      })
        .addTo(map)
        .bindPopup('Live employee location');
      layersRef.current.push(marker);
      bounds.push([currentPoint.lat, currentPoint.lng]);

      const labelIcon = makeRouteLabelIcon(L, currentLabel || 'Live location', '#DC2626');
      if (labelIcon) {
        layersRef.current.push(
          L.marker([currentPoint.lat, currentPoint.lng], {
            icon: labelIcon,
            interactive: false,
            zIndexOffset: 1201
          }).addTo(map)
        );
      }
    }

    const routeKey = [
      fmtCoord(startPoint?.lat),
      fmtCoord(startPoint?.lng),
      fmtCoord(endPoint?.lat),
      fmtCoord(endPoint?.lng),
      normalizedRoutePoints.length
    ].join('|');

    if (bounds.length > 1 && fittedRouteKeyRef.current !== routeKey) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
      fittedRouteKeyRef.current = routeKey;
    } else if (isValidPoint(currentPoint)) {
      map.panTo([currentPoint.lat, currentPoint.lng], { animate: true });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15, { animate: true });
    }

    window.setTimeout(() => map.invalidateSize(), 80);
  }, [currentLabel, currentPoint, endLabel, endPoint, mapReady, progressPoints, routePoints, startLabel, startPoint]);

  return (
    <div className={`relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 ${heightClass}`}>
      <div ref={mapDivRef} className="absolute inset-0" />
      {mapError && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-50 px-4 text-center text-xs font-semibold text-slate-500">
          {mapError}
        </div>
      )}
      {!mapReady && !mapError && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-50/80">
          <RefreshCw size={16} className="animate-spin text-blue-600" />
        </div>
      )}
    </div>
  );
}

export default function ClientMeetingTracker({
  isCheckedIn,
  isCheckedOut,
  todayRecord,
  fetchDashboardData
}) {
  const [trackingStatus, setTrackingStatus] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    clientName: '',
    title: '',
    purpose: '',
    destinationAddress: ''
  });
  const [startQuery, setStartQuery] = useState('');
  const [startOptions, setStartOptions] = useState([]);
  const [selectedStartPlace, setSelectedStartPlace] = useState(null);
  const [startSearching, setStartSearching] = useState(false);
  const [startError, setStartError] = useState('');
  const [useLiveStart, setUseLiveStart] = useState(true);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeOptions, setPlaceOptions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [routePreview, setRoutePreview] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [progressPoints, setProgressPoints] = useState([]);
  const progressMeetingIdRef = useRef('');

  const attendanceTrackingActive = Boolean(isCheckedIn && !isCheckedOut);
  const activeClientMeeting =
    trackingStatus?.activeClientMeeting ||
    trackingStatus?.tracking?.activeClientMeeting ||
    null;
  const lastClientMeeting =
    trackingStatus?.lastClientMeeting ||
    trackingStatus?.tracking?.lastClientMeeting ||
    null;
  const routeClientMeeting = activeClientMeeting || lastClientMeeting;
  const hasActiveClientMeeting = Boolean(activeClientMeeting);
  const displayLocation =
    currentLocation ||
    trackingStatus?.currentLocation ||
    trackingStatus?.tracking?.currentLocation ||
    todayRecord?.tracking?.lastLocation ||
    null;
  const displayLat = displayLocation?.lat;
  const displayLng = displayLocation?.lng;

  const liveStartPoint = useMemo(
    () => (isValidPoint(displayLocation) ? toLocationPayload(displayLocation) : null),
    [displayLocation]
  );
  const routeStartPoint = selectedStartPlace || (useLiveStart ? liveStartPoint : null);
  const routeEndPoint = selectedPlace;
  const routeFromLocation = routeClientMeeting?.fromLocation || routeClientMeeting?.startLocation || null;
  const routeToLocation = routeClientMeeting?.toLocation || routeClientMeeting?.destinationLocation || null;
  const activeRoute = activeClientMeeting?.plannedRoute || null;
  const activeRoutePoints = activeRoute?.points || [];
  const mapStartPoint = hasActiveClientMeeting ? routeFromLocation : routeStartPoint;
  const mapEndPoint = hasActiveClientMeeting ? routeToLocation : routeEndPoint;
  const mapCurrentPoint = hasActiveClientMeeting ? displayLocation || activeClientMeeting?.lastLocation : null;
  const mapRoutePoints = hasActiveClientMeeting ? activeRoutePoints : routePreview?.points || [];
  const mapStartLabel = hasActiveClientMeeting
    ? activeClientMeeting?.fromAddress || 'Starting point'
    : selectedStartPlace?.name || selectedStartPlace?.address || (useLiveStart ? 'Current GPS location' : 'Starting point');
  const mapEndLabel = hasActiveClientMeeting
    ? activeClientMeeting?.toAddress || activeClientMeeting?.destinationAddress || 'Ending point'
    : selectedPlace?.name || selectedPlace?.address || 'Ending point';
  const plannedDistanceMeters = hasActiveClientMeeting
    ? activeClientMeeting?.plannedDistanceMeters || activeRoute?.distanceMeters || 0
    : routePreview?.distanceMeters || 0;
  const plannedDurationSeconds = hasActiveClientMeeting
    ? activeClientMeeting?.plannedDurationSeconds || activeRoute?.durationSeconds || 0
    : routePreview?.durationSeconds || 0;
  const rawCoveredDistanceMeters = activeClientMeeting?.totalDistanceMeters || 0;
  const coveredDistanceMeters =
    (plannedDistanceMeters > 0 && rawCoveredDistanceMeters > plannedDistanceMeters * 3) ||
    rawCoveredDistanceMeters > 500000
      ? 0
      : rawCoveredDistanceMeters;

  const statusTone = useMemo(() => {
    if (!attendanceTrackingActive) return 'bg-slate-50 text-slate-500 border-slate-200';
    if (activeClientMeeting) return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }, [activeClientMeeting, attendanceTrackingActive]);

  const fetchStatus = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoadingStatus(true);
      const res = await api.get('/location/my-status');
      setTrackingStatus(res?.data?.data || null);
    } catch (error) {
      if (!silent) {
        showToast('error', 'Tracking', error?.response?.data?.message || 'Unable to load tracking status.');
      }
    } finally {
      if (!silent) setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus({ silent: true });
    const intervalId = window.setInterval(() => fetchStatus({ silent: true }), 15000);
    return () => window.clearInterval(intervalId);
  }, [fetchStatus]);

  useEffect(() => {
    if (!attendanceTrackingActive || !navigator.geolocation) return undefined;

    captureLocation({ timeout: 12000, maximumAge: 5000 })
      .then((location) => {
        if (location) {
          setCurrentLocation(location);
          setLocationError('');
        }
      })
      .catch((error) => setLocationError(error?.message || 'Location unavailable.'));

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = normalizeGeoPosition(position);
        if (location) {
          setCurrentLocation(location);
          setLocationError('');
        }
      },
      (error) => setLocationError(error?.message || 'Location unavailable.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [attendanceTrackingActive]);

  useEffect(() => {
    const query = startQuery.trim();
    if (
      !attendanceTrackingActive ||
      hasActiveClientMeeting ||
      useLiveStart ||
      query.length < 3 ||
      selectedStartPlace
    ) {
      setStartOptions([]);
      setStartError('');
      setStartSearching(false);
      return undefined;
    }

    let ignore = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setStartSearching(true);
        const params = { q: query, limit: 6 };
        if (Number.isFinite(Number(displayLat)) && Number.isFinite(Number(displayLng))) {
          params.lat = displayLat;
          params.lng = displayLng;
        }

        const res = await api.get('/location/client-meeting/places/search', { params });
        if (ignore) return;
        setStartOptions(Array.isArray(res?.data?.data?.places) ? res.data.data.places : []);
        setStartError('');
      } catch (error) {
        if (!ignore) {
          setStartOptions([]);
          setStartError(error?.response?.data?.message || 'Unable to search starting points.');
        }
      } finally {
        if (!ignore) setStartSearching(false);
      }
    }, 450);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    attendanceTrackingActive,
    displayLat,
    displayLng,
    hasActiveClientMeeting,
    selectedStartPlace,
    startQuery,
    useLiveStart
  ]);

  useEffect(() => {
    const query = placeQuery.trim();
    if (!attendanceTrackingActive || hasActiveClientMeeting || query.length < 3 || selectedPlace) {
      setPlaceOptions([]);
      setPlaceError('');
      setPlaceSearching(false);
      return undefined;
    }

    let ignore = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setPlaceSearching(true);
        const params = { q: query, limit: 6 };
        if (Number.isFinite(Number(displayLat)) && Number.isFinite(Number(displayLng))) {
          params.lat = displayLat;
          params.lng = displayLng;
        }

        const res = await api.get('/location/client-meeting/places/search', { params });
        if (ignore) return;
        setPlaceOptions(Array.isArray(res?.data?.data?.places) ? res.data.data.places : []);
        setPlaceError('');
      } catch (error) {
        if (!ignore) {
          setPlaceOptions([]);
          setPlaceError(error?.response?.data?.message || 'Unable to search client places.');
        }
      } finally {
        if (!ignore) setPlaceSearching(false);
      }
    }, 450);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    attendanceTrackingActive,
    displayLat,
    displayLng,
    hasActiveClientMeeting,
    placeQuery,
    selectedPlace
  ]);

  useEffect(() => {
    if (
      !attendanceTrackingActive ||
      hasActiveClientMeeting ||
      !isValidPoint(routeStartPoint) ||
      !isValidPoint(routeEndPoint)
    ) {
      setRoutePreview(null);
      setRouteError('');
      setRouteLoading(false);
      return undefined;
    }

    let ignore = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setRouteLoading(true);
        setRouteError('');
        const res = await api.post('/location/client-meeting/route/preview', {
          fromLocation: toLocationPayload(routeStartPoint),
          toLocation: toLocationPayload(routeEndPoint)
        });
        if (ignore) return;
        const nextRoute = res?.data?.data?.route || null;
        setRoutePreview(nextRoute || buildDirectRoute(routeStartPoint, routeEndPoint));
        if (res?.data?.warning) {
          setRouteError(res?.data?.message || 'Showing direct route until road route is available.');
        }
      } catch (error) {
        if (!ignore) {
          setRoutePreview(buildDirectRoute(routeStartPoint, routeEndPoint));
          setRouteError(error?.response?.data?.message || 'Showing direct route until road route is available.');
        }
      } finally {
        if (!ignore) setRouteLoading(false);
      }
    }, 650);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    attendanceTrackingActive,
    hasActiveClientMeeting,
    routeEndPoint?.lat,
    routeEndPoint?.lng,
    routeEndPoint,
    routeStartPoint?.lat,
    routeStartPoint?.lng,
    routeStartPoint
  ]);

  useEffect(() => {
    if (!hasActiveClientMeeting || !activeClientMeeting?.id) {
      progressMeetingIdRef.current = '';
      setProgressPoints([]);
      return;
    }

    const livePoint = toLocationPayload(displayLocation || activeClientMeeting.lastLocation);
    const startPoint = toLocationPayload(routeFromLocation || activeClientMeeting.startLocation);
    if (!livePoint) return;

    setProgressPoints((current) => {
      if (progressMeetingIdRef.current !== activeClientMeeting.id) {
        progressMeetingIdRef.current = activeClientMeeting.id;
        return [startPoint, livePoint].filter(Boolean);
      }

      const lastPoint = current[current.length - 1];
      if (lastPoint && calculateDistanceMeters(lastPoint, livePoint) < 4) {
        return current;
      }
      return [...current, livePoint].slice(-300);
    });
  }, [
    activeClientMeeting?.id,
    activeClientMeeting?.lastLocation,
    activeClientMeeting?.startLocation,
    displayLat,
    displayLng,
    displayLocation,
    hasActiveClientMeeting,
    routeFromLocation
  ]);

  const handleStartInputChange = (event) => {
    setStartQuery(event.target.value);
    setSelectedStartPlace(null);
    setUseLiveStart(false);
    setRoutePreview(null);
  };

  const handlePlaceInputChange = (event) => {
    const value = event.target.value;
    setPlaceQuery(value);
    setSelectedPlace(null);
    setRoutePreview(null);
    setForm((current) => ({ ...current, destinationAddress: value }));
  };

  const selectStartPlace = (place) => {
    const label = place.address || place.name || '';
    setSelectedStartPlace(place);
    setUseLiveStart(false);
    setStartQuery(label);
    setStartOptions([]);
    setStartError('');
    setRoutePreview(null);
  };

  const useCurrentLocationAsStart = () => {
    setSelectedStartPlace(null);
    setUseLiveStart(true);
    setStartQuery('');
    setStartOptions([]);
    setStartError('');
    setRoutePreview(null);
  };

  const selectPlace = (place) => {
    const label = place.address || place.name || '';
    setSelectedPlace(place);
    setPlaceQuery(label);
    setPlaceOptions([]);
    setPlaceError('');
    setRoutePreview(null);
    setForm((current) => ({ ...current, destinationAddress: label }));
  };

  const clearMeetingForm = () => {
    setForm({ clientName: '', title: '', purpose: '', destinationAddress: '' });
    setStartQuery('');
    setSelectedStartPlace(null);
    setUseLiveStart(true);
    setStartOptions([]);
    setStartError('');
    setPlaceQuery('');
    setSelectedPlace(null);
    setPlaceOptions([]);
    setPlaceError('');
    setRoutePreview(null);
    setRouteError('');
  };

  const startMeeting = async (event) => {
    event.preventDefault();
    if (!attendanceTrackingActive || submitting) return;
    if (!form.clientName.trim()) {
      showToast('error', 'Client meeting', 'Client name is required.');
      return;
    }
    if (!isValidPoint(routeStartPoint)) {
      showToast('error', 'Client meeting', 'Choose a starting point or use current GPS.');
      return;
    }
    if (!selectedPlace || !isValidPoint(selectedPlace)) {
      showToast('error', 'Client meeting', 'Select ending point from the dropdown so the route can be saved.');
      return;
    }

    try {
      setSubmitting(true);
      const liveLocation = await captureLocation({ timeout: 15000, maximumAge: 5000 }).catch(() => displayLocation);
      const fromLocation = toLocationPayload(routeStartPoint, useLiveStart ? displayLocation?.accuracy || 25 : 25);
      const toLocation = toLocationPayload(selectedPlace, 25);
      const plannedRoute = routePreview || buildDirectRoute(fromLocation, toLocation);

      const res = await api.post('/location/client-meeting/start', {
        ...form,
        fromAddress: selectedStartPlace?.address || selectedStartPlace?.name || 'Current live location',
        fromLocation,
        toAddress: selectedPlace?.address || selectedPlace?.name || form.destinationAddress,
        toLocation,
        destinationAddress: selectedPlace?.address || form.destinationAddress,
        destinationLocation: toLocation,
        plannedRoute,
        location: liveLocation || displayLocation || fromLocation
      });

      const nextStatus = res?.data?.data || {};
      const nextCurrentLocation = nextStatus.tracking?.currentLocation || liveLocation || displayLocation || fromLocation;
      setTrackingStatus({
        ...(trackingStatus || {}),
        tracking: nextStatus.tracking || trackingStatus?.tracking || null,
        activeClientMeeting: nextStatus.clientMeeting || null,
        lastClientMeeting: trackingStatus?.lastClientMeeting || trackingStatus?.tracking?.lastClientMeeting || null,
        currentLocation: nextCurrentLocation
      });

      if (nextStatus.clientMeeting?.id) {
        progressMeetingIdRef.current = nextStatus.clientMeeting.id;
        setProgressPoints([fromLocation, nextCurrentLocation].filter(Boolean));
      }

      if (nextStatus.tracking?.sessionId) {
        await locationTrackingService.start({
          sessionId: nextStatus.tracking.sessionId,
          attendanceId: nextStatus.tracking.attendanceId,
          recommendedIntervalSec: nextStatus.tracking.recommendedIntervalSec,
          status: nextStatus.tracking.status,
          initialLocation: liveLocation || displayLocation || fromLocation || null
        }).catch(() => {});
      }

      clearMeetingForm();
      fetchDashboardData?.();
      showToast('success', 'Client meeting', 'Route tracking started.');
    } catch (error) {
      showToast('error', 'Client meeting', error?.response?.data?.message || 'Unable to start tracking.');
    } finally {
      setSubmitting(false);
    }
  };

  const stopMeeting = async () => {
    if (!activeClientMeeting || submitting) return;

    try {
      setSubmitting(true);
      const location = await captureLocation({ timeout: 10000, maximumAge: 10000 }).catch(() => displayLocation);
      const res = await api.post('/location/client-meeting/stop', {
        meetingId: activeClientMeeting.id,
        location,
        stopReason: 'REACHED'
      });
      const nextStatus = res?.data?.data || {};
      setTrackingStatus({
        ...(trackingStatus || {}),
        tracking: nextStatus.tracking || trackingStatus?.tracking || null,
        activeClientMeeting: null,
        lastClientMeeting: nextStatus.clientMeeting || nextStatus.tracking?.lastClientMeeting || null,
        currentLocation: nextStatus.tracking?.currentLocation || location || displayLocation
      });
      fetchDashboardData?.();
      showToast('success', 'Client meeting', 'Destination reached.');
    } catch (error) {
      showToast('error', 'Client meeting', error?.response?.data?.message || 'Unable to stop tracking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="p-4 border-b xl:border-b-0 xl:border-r border-[#E2E8F0]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <MapPin size={17} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 leading-tight">Live Location</h3>
                <p className="text-[11px] font-medium text-slate-500">
                  {displayLocation ? `${fmtCoord(displayLocation.lat)}, ${fmtCoord(displayLocation.lng)}` : '--'}
                </p>
              </div>
            </div>
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone}`}>
              {activeClientMeeting ? <Briefcase size={12} /> : attendanceTrackingActive ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
              {activeClientMeeting ? 'Client meeting' : attendanceTrackingActive ? 'Attendance tracking' : 'Not checked in'}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Latitude</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{fmtCoord(displayLocation?.lat)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Longitude</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{fmtCoord(displayLocation?.lng)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Accuracy</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{fmtAccuracy(displayLocation?.accuracy)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Updated</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {fmtTime(displayLocation?.timestamp || trackingStatus?.tracking?.lastHeartbeatAt)}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <MeetingRouteMap
              startPoint={mapStartPoint}
              endPoint={mapEndPoint}
              currentPoint={mapCurrentPoint}
              routePoints={mapRoutePoints}
              progressPoints={progressPoints}
              startLabel={mapStartLabel}
              endLabel={mapEndLabel}
              currentLabel="Live employee location"
              heightClass="h-72"
            />
          </div>

          {locationError && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              <AlertCircle size={14} />
              {locationError}
            </div>
          )}
          {routeError && !hasActiveClientMeeting && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              <AlertCircle size={14} />
              {routeError}
            </div>
          )}
        </div>

        <div className="p-4">
          {activeClientMeeting ? (
            <div className="h-full flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Briefcase size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{activeClientMeeting.clientName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{activeClientMeeting.title || 'Client Meeting'}</p>
                  </div>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <span className="block text-[10px] font-semibold uppercase text-emerald-600">From</span>
                    <span className="mt-0.5 block truncate font-semibold text-slate-700">
                      {activeClientMeeting.fromAddress && activeClientMeeting.fromAddress !== 'Live start location'
                        ? activeClientMeeting.fromAddress
                        : routeFromLocation
                          ? `${fmtCoord(routeFromLocation.lat)}, ${fmtCoord(routeFromLocation.lng)}`
                          : 'Live start'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-2">
                    <span className="block text-[10px] font-semibold uppercase text-blue-600">To</span>
                    <span className="mt-0.5 block truncate font-semibold text-slate-700">
                      {activeClientMeeting.toAddress || activeClientMeeting.destinationAddress || 'Client place'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-400">Started</span>
                    <span className="font-semibold text-slate-700">{fmtTime(activeClientMeeting.startedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-400">Covered</span>
                    <span className="font-semibold text-slate-700">
                      {fmtDistance(coveredDistanceMeters)} / {fmtDistance(plannedDistanceMeters)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-400">Estimated time</span>
                    <span className="font-semibold text-slate-700">{fmtDuration(plannedDurationSeconds)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-400">Updates</span>
                    <span className="font-semibold text-slate-700">{activeClientMeeting.totalUpdates || 0}</span>
                  </div>
                  {activeClientMeeting.destinationAddress && (
                    <div className="rounded-lg bg-slate-50 p-2 text-[11px] font-medium text-slate-600">
                      {activeClientMeeting.destinationAddress}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={stopMeeting}
                disabled={submitting}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Square size={14} />}
                Mark Reached
              </button>
            </div>
          ) : (
            <form onSubmit={startMeeting} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Briefcase size={16} />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">Client Route</h3>
                </div>
                <button
                  type="button"
                  onClick={() => fetchStatus()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600"
                  title="Refresh tracking status"
                >
                  <RefreshCw size={14} className={loadingStatus ? 'animate-spin' : ''} />
                </button>
              </div>

              {lastClientMeeting && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase text-emerald-700">Last reached</span>
                    <span className="text-[11px] font-semibold text-emerald-700">
                      {fmtDistance(lastClientMeeting.totalDistanceMeters)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="min-w-0">
                      <span className="block font-semibold text-slate-400">From</span>
                      <span className="block truncate font-medium text-slate-700">
                        {lastClientMeeting.fromAddress || 'Live start'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="block font-semibold text-slate-400">To</span>
                      <span className="block truncate font-medium text-slate-700">
                        {lastClientMeeting.toAddress || lastClientMeeting.destinationAddress || 'Client place'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <input
                value={form.clientName}
                onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))}
                placeholder="Client name"
                className="h-10 w-full rounded-lg border border-[#E2E8F0] px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                disabled={!attendanceTrackingActive || submitting}
              />
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Meeting title"
                className="h-10 w-full rounded-lg border border-[#E2E8F0] px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                disabled={!attendanceTrackingActive || submitting}
              />

              <div className="relative">
                <div className="flex gap-2">
                  <input
                    value={startQuery}
                    onChange={handleStartInputChange}
                    placeholder="Search starting point"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-[#E2E8F0] px-3 pr-9 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                    disabled={!attendanceTrackingActive || submitting}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={useCurrentLocationAsStart}
                    disabled={!attendanceTrackingActive || submitting}
                    className={`h-10 rounded-lg border px-3 text-[11px] font-bold transition disabled:opacity-50 ${
                      useLiveStart
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:text-blue-600'
                    }`}
                  >
                    GPS
                  </button>
                </div>
                <div className="pointer-events-none absolute right-[58px] top-1/2 -translate-y-1/2 text-slate-400">
                  {startSearching ? <RefreshCw size={14} className="animate-spin" /> : <MapPin size={14} />}
                </div>
                {startOptions.length > 0 && (
                  <div className="absolute left-0 right-12 top-[44px] z-30 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {startOptions.map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => selectStartPlace(place)}
                        className="w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50"
                      >
                        <span className="block text-xs font-semibold text-slate-800">{place.name}</span>
                        <span className="mt-0.5 block text-[11px] font-medium leading-snug text-slate-500">
                          {place.address}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                  <Route size={12} />
                  {useLiveStart
                    ? displayLocation
                      ? `Current GPS ${fmtCoord(displayLocation.lat)}, ${fmtCoord(displayLocation.lng)}`
                      : 'Waiting for current GPS'
                    : selectedStartPlace?.address || 'Choose a starting point from dropdown'}
                </div>
                {startError && <p className="mt-1 text-[11px] font-medium text-amber-600">{startError}</p>}
              </div>

              <div className="relative">
                <input
                  value={placeQuery}
                  onChange={handlePlaceInputChange}
                  placeholder="Search ending point"
                  className="h-10 w-full rounded-lg border border-[#E2E8F0] px-3 pr-9 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                  disabled={!attendanceTrackingActive || submitting}
                  autoComplete="off"
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {placeSearching ? <RefreshCw size={14} className="animate-spin" /> : <MapPin size={14} />}
                </div>
                {placeOptions.length > 0 && (
                  <div className="absolute left-0 right-0 top-[44px] z-30 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {placeOptions.map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => selectPlace(place)}
                        className="w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50"
                      >
                        <span className="block text-xs font-semibold text-slate-800">{place.name}</span>
                        <span className="mt-0.5 block text-[11px] font-medium leading-snug text-slate-500">
                          {place.address}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {placeError && (
                  <p className="mt-1 text-[11px] font-medium text-amber-600">{placeError}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px]">
                <div>
                  <span className="block font-semibold uppercase text-slate-400">Route</span>
                  <span className="mt-0.5 block font-bold text-slate-700">
                    {routeLoading ? 'Loading' : fmtDistance(plannedDistanceMeters)}
                  </span>
                </div>
                <div>
                  <span className="block font-semibold uppercase text-slate-400">ETA</span>
                  <span className="mt-0.5 block font-bold text-slate-700">
                    {routeLoading ? '--' : fmtDuration(plannedDurationSeconds)}
                  </span>
                </div>
                <div>
                  <span className="block font-semibold uppercase text-slate-400">Provider</span>
                  <span className="mt-0.5 block truncate font-bold text-slate-700">
                    {routePreview?.provider || (routeLoading ? 'OSRM' : '--')}
                  </span>
                </div>
              </div>

              <textarea
                value={form.purpose}
                onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))}
                placeholder="Purpose"
                rows={2}
                className="w-full resize-none rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                disabled={!attendanceTrackingActive || submitting}
              />

              <button
                type="submit"
                disabled={!attendanceTrackingActive || submitting}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                Start Route Tracking
              </button>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <LocateFixed size={12} />
                {attendanceTrackingActive ? 'GPS ready' : 'Mark attendance first'}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
