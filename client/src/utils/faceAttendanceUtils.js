// Utility functions for face attendance operations

/**
 * Validate image is base64 encoded
 */
export const isValidBase64Image = (data) => {
  if (!data || typeof data !== 'string') return false;
  if (!data.startsWith('data:image')) return false;
  return data.length > 1000; // Minimum reasonable size
};

/**
 * Convert canvas image data to base64
 */
export const canvasToBase64 = (canvas, quality = 0.9) => {
  if (!canvas) return null;
  try {
    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.error('Error converting canvas to base64:', err);
    return null;
  }
};

/**
 * Get user media stream with camera
 */
export const getUserMediaStream = async (options = {}) => {
  const defaultOptions = {
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      ...defaultOptions,
      ...options
    });
    return stream;
  } catch (err) {
    const errorMap = {
      'NotAllowedError': 'Camera permission denied. Please enable camera in browser settings.',
      'NotFoundError': 'No camera found on this device.',
      'NotSupportedError': 'Camera not supported in this browser.',
      'AbortError': 'Camera request was aborted.',
      'SecurityError': 'Camera access requires HTTPS.'
    };

    throw new Error(errorMap[err.name] || 'Failed to access camera');
  }
};

/**
 * Get current geolocation
 */
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported on this device'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        const errorMap = {
          'PERMISSION_DENIED': 'Location permission denied. Please enable location access.',
          'POSITION_UNAVAILABLE': 'Location information unavailable.',
          'TIMEOUT': 'Location request timed out. Please try again.'
        };

        reject(new Error(errorMap[error.code] || 'Failed to get location'));
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 30000
      }
    );
  });
};

/**
 * Validate location accuracy
 */
export const isLocationAccurate = (accuracy, threshold = 20) => {
  return accuracy <= threshold;
};

/**
 * Check if point is inside polygon (ray casting algorithm)
 */
export const isPointInPolygon = (point, polygon) => {
  if (!point || !polygon || polygon.length < 3) {
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

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export const calculateDistance = (point1, point2) => {
  const R = 6371; // Earth radius in km
  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
    Math.cos(toRad(point2.lat)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c * 1000; // Convert to meters

  return Math.round(distance);
};

/**
 * Convert degrees to radians
 */
const toRad = (degrees) => {
  return (degrees * Math.PI) / 180;
};

/**
 * Format location for display
 */
export const formatLocation = (location) => {
  if (!location) return 'Unknown';
  return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
};

/**
 * Format accuracy for display
 */
export const formatAccuracy = (accuracy) => {
  if (!accuracy) return 'Unknown';
  return `${Math.round(accuracy)}m`;
};

/**
 * Get accuracy status
 */
export const getAccuracyStatus = (accuracy, threshold = 20) => {
  if (accuracy <= threshold) return 'excellent';
  if (accuracy <= threshold * 1.5) return 'good';
  if (accuracy <= threshold * 2) return 'fair';
  return 'poor';
};

/**
 * Get accuracy color for UI
 */
export const getAccuracyColor = (accuracy, threshold = 20) => {
  const status = getAccuracyStatus(accuracy, threshold);
  const colors = {
    excellent: 'text-emerald-400',
    good: 'text-blue-400',
    fair: 'text-yellow-400',
    poor: 'text-red-400'
  };
  return colors[status] || 'text-slate-400';
};

/**
 * Validate attendance data
 */
export const validateAttendanceData = (data) => {
  const errors = [];

  if (!data.faceImageData) {
    errors.push('Face image is required');
  } else if (!isValidBase64Image(data.faceImageData)) {
    errors.push('Invalid face image data');
  }

  if (!data.location) {
    errors.push('Location data is required');
  } else {
    if (typeof data.location.lat !== 'number') {
      errors.push('Invalid latitude');
    }
    if (typeof data.location.lng !== 'number') {
      errors.push('Invalid longitude');
    }
    if (typeof data.location.accuracy !== 'number') {
      errors.push('Invalid location accuracy');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate registration data
 */
export const validateRegistrationData = (data) => {
  const errors = [];

  if (!data.faceImageData) {
    errors.push('Face image is required');
  } else if (!isValidBase64Image(data.faceImageData)) {
    errors.push('Invalid face image data');
  }

  if (!data.name || !data.name.trim()) {
    errors.push('Employee name is required');
  }

  if (!data.employeeId || !data.employeeId.trim()) {
    errors.push('Employee ID is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Format timestamp
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Format time only
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

/**
 * Get time difference in hours
 */
export const getTimeDifference = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.round(diffHours * 2) / 2; // Round to nearest 0.5
};

/**
 * Check if time is within working hours
 */
export const isWithinWorkingHours = (timestamp, startHour = 9, endHour = 18) => {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  const hour = date.getHours();
  return hour >= startHour && hour < endHour;
};

/**
 * Get attendance status badge
 */
export const getStatusBadge = (status) => {
  const badges = {
    'present': { label: 'Present', color: 'emerald', icon: '✓' },
    'absent': { label: 'Absent', color: 'red', icon: '✕' },
    'leave': { label: 'Leave', color: 'blue', icon: '−' },
    'half-day': { label: 'Half Day', color: 'yellow', icon: '◐' },
    'late': { label: 'Late', color: 'orange', icon: '⏰' }
  };
  return badges[status] || { label: 'Unknown', color: 'slate', icon: '?' };
};

/**
 * Retry logic with exponential backoff
 */
export const retryWithBackoff = async (
  fn,
  maxRetries = 3,
  baseDelay = 1000
) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;

      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Create error message from API response
 */
export const getErrorMessage = (error) => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

/**
 * Check browser compatibility
 */
export const checkBrowserCompatibility = () => {
  const compatibility = {
    getUserMedia: !!navigator.mediaDevices?.getUserMedia,
    geolocation: !!navigator.geolocation,
    localStorage: !!window.localStorage,
    sessionStorage: !!window.sessionStorage
  };

  return {
    supported: Object.values(compatibility).every(v => v),
    features: compatibility
  };
};

/**
 * Stop all media streams
 */
export const stopAllStreams = (streamRef) => {
  if (streamRef?.current) {
    streamRef.current.getTracks().forEach(track => {
      try {
        track.stop();
      } catch (err) {
        console.error('Error stopping stream track:', err);
      }
    });
    streamRef.current = null;
  }
};

/**
 * Log to console with timestamp
 */
export const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}:`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
};
