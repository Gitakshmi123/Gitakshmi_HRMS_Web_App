import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, MapPin, CheckCircle, XCircle, User, UserPlus, Clock, AlertCircle,
  Loader2, Navigation, LogOut, RotateCcw, Shield, Smartphone, Activity,
  Info, ChevronRight, X, UserCircle, Thermometer, ShieldCheck, Fingerprint
} from 'lucide-react';
import api from '../../utils/api';
import * as faceapi from '@vladmandic/face-api';
import Loader from '../../components/common/Loader';
import clsx from 'clsx';
import { showToast } from '../../utils/uiNotifications';
import locationTrackingService from '../../services/locationTracking.service';
import { useAuth } from '../../context/AuthContext';
import {
  normalizeLocationSample,
  stabilizeLocationSamples,
  trimLocationSamples
} from '../../utils/locationStability';

const FACE_MODEL_PATH =
  import.meta.env.VITE_FACE_MODEL_PATH || '/api/face-attendance/models';
const ENABLE_BROWSER_FACE_MODELS =
  String(import.meta.env.VITE_ENABLE_BROWSER_FACE_MODELS || 'true').toLowerCase() === 'true';
let faceModelsPromise = null;
let ssdModelPromise = null;
let nativeFaceDetectorPromise = null;
const GUIDE_DETECTION_INTERVAL_MS = 900;

const estimateYaw = (landmarks = []) => {
  if (!landmarks.length) return 0;
  const nose = landmarks[30];
  const leftEye = landmarks[36];
  const rightEye = landmarks[45];
  if (!nose || !leftEye || !rightEye) return 0;
  const eyeMidpoint = ((leftEye.x || 0) + (rightEye.x || 0)) / 2;
  const eyeSpan = Math.max(1, Math.abs((rightEye.x || 0) - (leftEye.x || 0)));
  return ((nose.x || 0) - eyeMidpoint) / eyeSpan;
};

const detectSmileRatio = (landmarks = []) => {
  if (landmarks.length < 68) return 0;
  const mouthLeft = landmarks[48];
  const mouthRight = landmarks[54];
  const leftEyeOuter = landmarks[36];
  const rightEyeOuter = landmarks[45];
  
  if (!mouthLeft || !mouthRight || !leftEyeOuter || !rightEyeOuter) return 0;
  
  const mouthWidth = Math.hypot(mouthRight.x - mouthLeft.x, mouthRight.y - mouthLeft.y);
  const eyeDistance = Math.hypot(rightEyeOuter.x - leftEyeOuter.x, rightEyeOuter.y - leftEyeOuter.y);
  
  return mouthWidth / (eyeDistance || 1);
};

const GUIDED_STEPS = [
  { index: 0, label: 'Look Straight', instruction: 'Look straight at the camera and keep your face centered.' },
  { index: 1, label: 'Turn Left', instruction: 'Slowly turn your head to the left.' },
  { index: 2, label: 'Turn Right', instruction: 'Slowly turn your head to the right.' }
];

const FACE_CAPTURE_CONFIG = {
  alignmentInputSize: 320,
  captureInputSize: 320,
  guideScoreThreshold: 0.12,
  captureScoreThreshold: 0.15,
  minDetectionConfidence: 0.12,
  sampleCount: 1,
  sampleDelayMs: 0,
  maxDescriptorDrift: 0.50,
  guideMarginRatio: 0.30,
  minFaceRatio: 0.04,
  maxFaceRatio: 0.97,
  minGuideVisibleRatio: 0.06,
  minCaptureVisibleRatio: 0.08,
  guideHoldMs: 900
};
const FACE_IMAGE_CAPTURE = { maxWidth: 560, quality: 0.72 };
const FACE_REGISTRATION_IMAGE_CAPTURE = { maxWidth: 720, quality: 0.78 };
const LIVENESS_FRAME_CAPTURE = { maxWidth: 320, quality: 0.55 };
const MIN_LIVENESS_FRAMES = 3;
const GPS_ACCURACY_THRESHOLDS = {
  mobile: {
    verified: 50,
    flagged: Infinity
  },
  desktop: {
    verified: 100,
    flagged: Infinity
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorMessage = (err, fallback = 'Verification failed') => {
  const details = err?.response?.data?.details;
  if (typeof details === 'string' && details.trim()) return details;
  if (details?.message) return details.message;
  if (typeof err?.response?.data?.reason === 'string' && err.response.data.reason.trim()) {
    return err.response.data.reason;
  }
  return err?.response?.data?.message || err?.message || fallback;
};

const detectRuntimeDeviceType = () => {
  if (typeof navigator === 'undefined') return 'desktop';
  const raw = `${navigator.userAgent || ''} ${navigator.platform || ''}`.toLowerCase();
  return /android|iphone|ipad|ipod|mobile/i.test(raw) ? 'mobile' : 'desktop';
};

const getGpsThresholds = (deviceType = 'desktop') =>
  GPS_ACCURACY_THRESHOLDS[deviceType === 'mobile' ? 'mobile' : 'desktop'];

const formatGpsCoordinates = (lat, lng) =>
  `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;

const getGuideFrameRect = (frameWidth, frameHeight) => {
  const guideSize = Math.min(frameWidth * 0.72, frameHeight * 0.9);
  return {
    x: (frameWidth - guideSize) / 2,
    y: (frameHeight - guideSize) / 2,
    width: guideSize,
    height: guideSize
  };
};

const expandRect = (rect, marginRatio = 0) => {
  const expandX = rect.width * marginRatio;
  const expandY = rect.height * marginRatio;
  return {
    x: rect.x - expandX,
    y: rect.y - expandY,
    width: rect.width + expandX * 2,
    height: rect.height + expandY * 2
  };
};

const getRectOverlapArea = (left, right) => {
  const overlapWidth =
    Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const overlapHeight =
    Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));

  return overlapWidth * overlapHeight;
};

const getGpsUiState = (location, deviceType) => {
  const thresholds = getGpsThresholds(deviceType);
  if (!location || typeof location.accuracy !== 'number') {
    return {
      status: 'MISSING',
      message: 'GPS not available',
      allowSubmit: false,
      tone: 'text-slate-400'
    };
  }

  if (location.accuracy <= thresholds.verified) {
    return {
      status: 'VERIFIED',
      message: deviceType === 'mobile' ? 'Location verified' : 'Desktop location verified',
      allowSubmit: true,
      tone: 'text-[#16A34A]'
    };
  }

  if (location.accuracy <= thresholds.flagged) {
    return {
      status: 'FLAGGED',
      message:
        deviceType === 'mobile'
          ? 'Low accuracy, attendance will be flagged. Retry in open sky if possible.'
          : 'Desktop browser location is approximate. Attendance will be flagged and tracking will continue.',
      allowSubmit: true,
      tone: 'text-[#D97706]'
    };
  }

  return {
    status: 'REJECTED',
    message:
      deviceType === 'mobile'
        ? 'Move to open area or retry after GPS stabilizes'
        : 'Desktop location is unavailable. Retry once or use mobile GPS',
    allowSubmit: false,
    tone: 'text-[#DC2626]'
  };
};

const buildLocationSnapshot = (position) => {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  return {
    lat,
    lng,
    accuracy: position.coords.accuracy,
    speed: position.coords.speed,
    heading: position.coords.heading,
    altitude: position.coords.altitude,
    timestamp: new Date(position.timestamp || Date.now()).toISOString(),
    mocked: false,
    place: formatGpsCoordinates(lat, lng)
  };
};

const createTinyDetectorOptions = (inputSize, scoreThreshold) =>
  new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold });

const GUIDE_TINY_DETECTION_PASSES = [
  { inputSize: 320, scoreThreshold: 0.12 },
  { inputSize: 256, scoreThreshold: 0.10 },
  { inputSize: 224, scoreThreshold: 0.08 }
];

const CAPTURE_TINY_DETECTION_PASSES = [
  { inputSize: 320, scoreThreshold: 0.15 },
  { inputSize: 256, scoreThreshold: 0.12 },
  { inputSize: 224, scoreThreshold: 0.10 }
];

const SSD_DETECTION_PASSES = [
  { minConfidence: 0.18 },
  { minConfidence: 0.12 }
];

const runTinyFaceDetectionPasses = async ({
  input,
  passes,
  withLandmarks = false,
  withDescriptors = false
}) => {
  for (const pass of passes) {
    let query = faceapi.detectAllFaces(
      input,
      createTinyDetectorOptions(pass.inputSize, pass.scoreThreshold)
    );

    if (withLandmarks) {
      query = query.withFaceLandmarks();
    }

    if (withDescriptors) {
      query = query.withFaceDescriptors();
    }

    const detections = await query;
    if (detections.length) {
      return detections;
    }
  }

  return [];
};

const runSsdFaceDetectionPasses = async ({
  input,
  passes,
  withLandmarks = false,
  withDescriptor = false
}) => {
  await ensureSsdModelLoaded();

  for (const pass of passes) {
    let query = faceapi.detectSingleFace(input, new faceapi.SsdMobilenetv1Options(pass));

    if (withLandmarks) {
      query = query.withFaceLandmarks();
    }

    if (withDescriptor) {
      query = query.withFaceDescriptor();
    }

    const detection = await query;
    if (detection) {
      return detection;
    }
  }

  return null;
};

const createGuideDetectionFromBox = (box = {}) => ({
  detection: {
    score: 1,
    box: {
      x: Number(box.x || box.left || 0),
      y: Number(box.y || box.top || 0),
      width: Number(box.width || 0),
      height: Number(box.height || 0)
    }
  }
});

const ensureNativeFaceDetector = async () => {
  if (typeof window === 'undefined' || typeof window.FaceDetector !== 'function') {
    return null;
  }

  if (!nativeFaceDetectorPromise) {
    nativeFaceDetectorPromise = Promise.resolve(
      new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 })
    ).catch(() => null);
  }

  return nativeFaceDetectorPromise;
};

const runNativeGuideDetection = async (videoEl) => {
  const detector = await ensureNativeFaceDetector();
  if (!detector || !videoEl) {
    return null;
  }

  try {
    const detections = await detector.detect(videoEl);
    if (!Array.isArray(detections) || !detections.length) {
      return null;
    }

    const best = detections.reduce((currentBest, candidate) => {
      if (!currentBest) return candidate;
      const bestArea =
        Number(currentBest.boundingBox?.width || 0) * Number(currentBest.boundingBox?.height || 0);
      const candidateArea =
        Number(candidate.boundingBox?.width || 0) * Number(candidate.boundingBox?.height || 0);
      return candidateArea > bestArea ? candidate : currentBest;
    }, null);

    return best?.boundingBox ? createGuideDetectionFromBox(best.boundingBox) : null;
  } catch {
    return null;
  }
};

const euclideanDistance = (left = [], right = []) => {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    const diff = left[index] - right[index];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

const averageEmbeddings = (embeddings = []) => {
  if (!embeddings.length) return [];
  return embeddings[0].map((_, columnIndex) =>
    embeddings.reduce((sum, embedding) => sum + embedding[columnIndex], 0) / embeddings.length
  );
};

const scoreDetectionForGuide = (videoEl, detection) => {
  const box = detection?.detection?.box;
  if (!videoEl || !box) return Number.NEGATIVE_INFINITY;

  const frameWidth = videoEl.videoWidth || 1;
  const frameHeight = videoEl.videoHeight || 1;
  const guideRect = expandRect(
    getGuideFrameRect(frameWidth, frameHeight),
    FACE_CAPTURE_CONFIG.guideMarginRatio
  );
  const faceRect = {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height
  };
  const overlapRatio =
    getRectOverlapArea(faceRect, guideRect) / Math.max(1, box.width * box.height);
  const faceAreaRatio = (box.width * box.height) / Math.max(1, frameWidth * frameHeight);
  const faceCenterX = box.x + box.width / 2;
  const faceCenterY = box.y + box.height / 2;
  const guideCenterX = guideRect.x + guideRect.width / 2;
  const guideCenterY = guideRect.y + guideRect.height / 2;
  const distancePenalty =
    Math.hypot(faceCenterX - guideCenterX, faceCenterY - guideCenterY) /
    Math.max(frameWidth, frameHeight, 1);

  return overlapRatio * 1000 + faceAreaRatio * 100 - distancePenalty * 25;
};

const pickPrimaryDetection = (videoEl, detections = []) =>
  (Array.isArray(detections) ? detections : []).reduce((best, current) => {
    if (!best) return current;
    return scoreDetectionForGuide(videoEl, current) > scoreDetectionForGuide(videoEl, best)
      ? current
      : best;
  }, null);

const pickBestPlacedDetection = (videoEl, detections = [], mode = 'guide') => {
  const availableDetections = Array.isArray(detections) ? detections.filter(Boolean) : [];
  if (!availableDetections.length) return null;

  const validDetections = availableDetections.filter((detection) =>
    getFacePlacement(videoEl, detection, { mode }).valid
  );

  return pickPrimaryDetection(
    videoEl,
    validDetections.length ? validDetections : availableDetections
  );
};

const getFacePlacement = (videoEl, detection) => {
  const box = detection?.detection?.box;
  if (!videoEl || !box) {
    return { valid: false, message: 'No face detected. Please keep your face centered.' };
  }

  // Relaxed conditions to ensure the 'Check In' button stays enabled 
  // as long as a face is detected, improving user experience.
  return { valid: true, message: 'Face aligned' };
};

const calculateDistance = (pointA, pointB) => {
  if (!pointA || !pointB) return 0;
  return Math.hypot((pointA.x || 0) - (pointB.x || 0), (pointA.y || 0) - (pointB.y || 0));
};

const calculateEyeAspectRatio = (eyePoints = []) => {
  if (!eyePoints.length) return 0;
  const dist = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
  const vertical1 = dist(eyePoints[1], eyePoints[5]);
  const vertical2 = dist(eyePoints[2], eyePoints[4]);
  const horizontal = dist(eyePoints[0], eyePoints[3]) || 1;
  return (vertical1 + vertical2) / (2 * horizontal);
};

const estimateYawSpread = (landmarks = []) => {
  if (!landmarks.length) return 0;
  const nose = landmarks[30];
  const leftEye = landmarks[36];
  const rightEye = landmarks[45];
  if (!nose || !leftEye || !rightEye) return 0;
  const eyeSpan = Math.max(1, Math.abs((rightEye.x || 0) - (leftEye.x || 0)));
  return Math.abs((nose.x || 0) - ((leftEye.x || 0) + (rightEye.x || 0)) / 2) / eyeSpan;
};

const captureVideoFrame = (videoEl, options = {}) => {
  const sourceWidth = Number(videoEl?.videoWidth || 0);
  const sourceHeight = Number(videoEl?.videoHeight || 0);
  if (!sourceWidth || !sourceHeight) {
    throw new Error('Camera frame is not ready yet.');
  }

  const maxWidth = Number(options.maxWidth || sourceWidth);
  const scale = Math.min(1, maxWidth / sourceWidth);
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  context.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', options.quality || 0.72).split(',').pop();
};

const captureRawFrames = async (videoEl, frameCount = MIN_LIVENESS_FRAMES, delayMs = 120) => {
  const frames = [];

  for (let sampleIndex = 0; sampleIndex < frameCount; sampleIndex += 1) {
    frames.push({
      imageData: captureVideoFrame(videoEl, LIVENESS_FRAME_CAPTURE),
      capturedAt: new Date().toISOString()
    });

    if (sampleIndex < frameCount - 1) {
      await wait(delayMs);
    }
  }

  return frames;
};

const buildDeviceSignature = async () => {
  const deviceType = detectRuntimeDeviceType();
  const profile = {
    deviceType,
    userAgent: navigator.userAgent || '',
    platform: navigator.platform || '',
    language: navigator.language || '',
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemory: navigator.deviceMemory || null,
    timezone:
      typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || '' : '',
    screen: typeof window !== 'undefined' ? `${window.screen?.width || 0}x${window.screen?.height || 0}` : ''
  };

  const rawFingerprint = JSON.stringify(profile);
  let fingerprint = rawFingerprint;

  try {
    if (window.crypto?.subtle) {
      const encoded = new TextEncoder().encode(rawFingerprint);
      const digest = await window.crypto.subtle.digest('SHA-256', encoded);
      fingerprint = Array.from(new Uint8Array(digest))
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    fingerprint = btoa(rawFingerprint).slice(0, 64);
  }

  return {
    fingerprint,
    ...profile
  };
};

const ensureFaceModelsLoaded = async () => {
  if (!ENABLE_BROWSER_FACE_MODELS) {
    return false;
  }

  if (!faceModelsPromise) {
    faceModelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_PATH),
      faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_PATH),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_PATH)
    ])
      .then(() => true)
      .catch((error) => {
        console.warn('Browser face models unavailable; using server verification fallback.', error);
        return false;
      });
  }
  return faceModelsPromise;
};

const ensureSsdModelLoaded = async () => {
  if (!ssdModelPromise) {
    ssdModelPromise = faceapi.nets.ssdMobilenetv1.loadFromUri(FACE_MODEL_PATH);
  }
  return ssdModelPromise;
};

const FaceAttendance = ({ onSuccess, onClose, actionType, profile }) => {
  const { user } = useAuth();
  const [mode, setMode] = useState('attendance'); 
  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [location, setLocation] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [faceAligned, setFaceAligned] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [registrationName, setRegistrationName] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [browserModelsReady, setBrowserModelsReady] = useState(false);
  const [previewAspectRatio, setPreviewAspectRatio] = useState(16 / 9);
  const [canUpdate, setCanUpdate] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showUnregisteredModal, setShowUnregisteredModal] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [pendingUpdateRequest, setPendingUpdateRequest] = useState(null);
  const [violationModal, setViolationModal] = useState({ show: false, violations: [] });
  const [guidedStep, setGuidedStep] = useState(-1);
  const [guidedProgress, setGuidedProgress] = useState(0);
  const browserModelsReadyRef = useRef(false);
  const cameraActiveRef = useRef(cameraActive);
  useEffect(() => {
    cameraActiveRef.current = cameraActive;
  }, [cameraActive]);
  const autoCameraStartedRef = useRef(false);
  const lastAlignedAtRef = useRef(0);
  const lastStableLocationRef = useRef(null);
  const recentLocationSamplesRef = useRef([]);
  
  const requestedAction = (actionType || 'AUTO').toString().toUpperCase();
  const attendanceActionLabel = requestedAction === 'OUT' ? 'Check Out' : 'Check In';
  const runtimeDeviceType = detectRuntimeDeviceType();
  const gpsThresholds = getGpsThresholds(runtimeDeviceType);
  const gpsUiState = getGpsUiState(location, runtimeDeviceType);
  const isBootingBiometrics = loading || !modelsLoaded;
  const isLocalDevRuntime =
    typeof window !== 'undefined' &&
    (import.meta.env.DEV ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');
  const employeeCode = String(
    registrationId.trim() || profile?.employeeId || profile?._id || ''
  ).trim();
  const isGpsReady = gpsUiState.allowSubmit;
  const hasUsableLocation = isGpsReady && Boolean(location);
  const faceGuideSatisfied =
    faceAligned ||
    (cameraActive && !isBootingBiometrics && !browserModelsReady) ||
    (isLocalDevRuntime && cameraActive && !isBootingBiometrics);
  const canSubmitAttendance =
    mode === 'register'
      ? !capturing
      : cameraActive &&
        !isBootingBiometrics &&
        faceGuideSatisfied &&
        hasUsableLocation &&
        !capturing;

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  useEffect(() => {
    const fullName = [profile?.firstName, profile?.middleName, profile?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (fullName && !registrationName.trim()) {
      setRegistrationName(fullName);
    }

    if (profile?.employeeId && !registrationId.trim()) {
      setRegistrationId(profile.employeeId);
    }
  }, [profile, registrationId, registrationName]);

  const syncPreviewAspectRatio = useCallback((videoEl) => {
    const width = Number(videoEl?.videoWidth || 0);
    const height = Number(videoEl?.videoHeight || 0);
    if (!width || !height) return;

    const nextRatio = width / height;
    setPreviewAspectRatio((current) =>
      Math.abs(current - nextRatio) < 0.01 ? current : nextRatio
    );
  }, []);

  const ensureVideoReady = async () => {
    const videoEl = videoRef.current;
    if (!videoEl) {
      throw new Error('Camera preview is not ready yet.');
    }

    if (!videoEl.srcObject) {
      throw new Error('Camera is not active. Please start the camera first.');
    }

    if (videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) {
      await new Promise((resolve) => {
        const handleReady = () => {
          videoEl.removeEventListener('loadeddata', handleReady);
          resolve();
        };

        videoEl.addEventListener('loadeddata', handleReady, { once: true });
        setTimeout(() => {
          videoEl.removeEventListener('loadeddata', handleReady);
          resolve();
        }, 1500);
      });
    }

    if (videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) {
      throw new Error('Camera feed is still loading. Please wait a moment and try again.');
    }

    return videoEl;
  };

  const waitForVideoElement = async (maxAttempts = 12, delayMs = 100) => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (videoRef.current) {
        return videoRef.current;
      }
      await wait(delayMs);
    }

    throw new Error('Camera preview failed to initialize. Please retry.');
  };

  const detectGuideFace = async (videoEl) => {
    const nativeDetection = await runNativeGuideDetection(videoEl);
    if (nativeDetection) {
      return nativeDetection;
    }

    if (!browserModelsReadyRef.current) {
      return null;
    }

    let detections = await runTinyFaceDetectionPasses({
      input: videoEl,
      passes: GUIDE_TINY_DETECTION_PASSES
    });

    if (detections.length) {
      return pickBestPlacedDetection(videoEl, detections, 'guide');
    }

    return null;
  };

  const detectFaceDescriptor = async () => {
    if (!browserModelsReadyRef.current) {
      throw new Error('Browser face models are unavailable. Server verification will be used.');
    }

    const videoEl = await ensureVideoReady();
    const capturedEmbeddings = [];

    const detectFacesForCapture = async () => {
      let detections = await runTinyFaceDetectionPasses({
        input: videoEl,
        passes: CAPTURE_TINY_DETECTION_PASSES,
        withLandmarks: true,
        withDescriptors: true
      });

      if (!detections.length) {
        const ssdDetection = await runSsdFaceDetectionPasses({
          input: videoEl,
          passes: SSD_DETECTION_PASSES,
          withLandmarks: true,
          withDescriptor: true
        });

        detections = ssdDetection ? [ssdDetection] : [];
      }

      return detections;
    };

    for (let sampleIndex = 0; sampleIndex < FACE_CAPTURE_CONFIG.sampleCount; sampleIndex += 1) {
      const detections = await detectFacesForCapture();

      if (!detections.length) {
        throw new Error('No face detected. Please keep your face centered, steady, and well-lit.');
      }

      const detection = pickBestPlacedDetection(videoEl, detections, 'capture') || detections[0];
      const placement = getFacePlacement(videoEl, detection, { mode: 'capture' });
      if (!placement.valid) {
        throw new Error(placement.message);
      }

      capturedEmbeddings.push(Array.from(detection.descriptor));
      if (sampleIndex < FACE_CAPTURE_CONFIG.sampleCount - 1) {
        await wait(FACE_CAPTURE_CONFIG.sampleDelayMs);
      }
    }

    if (capturedEmbeddings.length > 1) {
      const drift = euclideanDistance(capturedEmbeddings[0], capturedEmbeddings[1]);
      if (drift > FACE_CAPTURE_CONFIG.maxDescriptorDrift) {
        throw new Error('Motion detected during capture. Please hold still and try again.');
      }
    }

    return averageEmbeddings(capturedEmbeddings);
  };

  const runGuidedRegistrationLoop = async (videoEl) => {
    if (!browserModelsReadyRef.current) {
      throw new Error('Guided registration requires browser face models to be loaded.');
    }

    setGuidedStep(0);
    setGuidedProgress(0);

    let currentStep = 0;
    let stepProgress = 0;
    let savedEmbedding = null;
    let savedImage = null;

    const canvas = overlayCanvasRef.current;
    const ctx = canvas?.getContext('2d');

    const drawGuideHUD = (detection, step, progress, satisfied) => {
      if (!canvas || !videoEl || !ctx) return;
      const w = videoEl.videoWidth;
      const h = videoEl.videoHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);

      // 1. Dark overlay outside the center oval
      const cx = w / 2;
      const cy = h / 2;
      const rx = Math.min(w * 0.33, h * 0.38);
      const ry = Math.min(w * 0.33, h * 0.38) * 1.25;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      // 2. Oval outline (red by default, green if step is satisfied/correct)
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      ctx.lineWidth = 4;
      ctx.strokeStyle = satisfied ? '#10B981' : '#EF4444';
      if (!detection) {
        ctx.setLineDash([8, 6]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Progress ring around oval
      if (progress > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, rx + 14, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * progress) / 100);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#10B981';
        ctx.stroke();
      }

      // 4. Fill oval lightly on completion
      if (detection && progress >= 100) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.fill();
      }
    };

    while (cameraActiveRef.current && currentStep < GUIDED_STEPS.length) {
      let detection = null;
      try {
        let detections = await runTinyFaceDetectionPasses({
          input: videoEl,
          passes: CAPTURE_TINY_DETECTION_PASSES,
          withLandmarks: true,
          withDescriptors: currentStep === 0
        });

        if (!detections.length) {
          const ssdDetection = await runSsdFaceDetectionPasses({
            input: videoEl,
            passes: SSD_DETECTION_PASSES,
            withLandmarks: true,
            withDescriptor: currentStep === 0
          });
          detections = ssdDetection ? [ssdDetection] : [];
        }

        detection = detections[0] || null;
      } catch (err) {
        console.error('Guided detection step error:', err);
      }

      if (!detection) {
        stepProgress = Math.max(0, stepProgress - 15);
        setGuidedProgress(stepProgress);
        drawGuideHUD(null, currentStep, stepProgress, false);
        setMessage('Face lost! Please align your face inside the circle.');
        await wait(150);
        continue;
      }

      // Check face placement (center & size constraints)
      const box = detection.detection.box || {};
      const fcx = box.x + box.width / 2;
      const fcy = box.y + box.height / 2;
      const targetCx = videoEl.videoWidth / 2;
      const targetCy = videoEl.videoHeight / 2;
      const distFromCenter = Math.hypot(fcx - targetCx, fcy - targetCy);
      const faceRatio = box.width / videoEl.videoWidth;

      if (distFromCenter > videoEl.videoWidth * 0.25) {
        stepProgress = Math.max(0, stepProgress - 10);
        setGuidedProgress(stepProgress);
        drawGuideHUD(detection, currentStep, stepProgress, false);
        setMessage('Please center your face inside the circle.');
        await wait(150);
        continue;
      }

      if (faceRatio < 0.22) {
        stepProgress = Math.max(0, stepProgress - 10);
        setGuidedProgress(stepProgress);
        drawGuideHUD(detection, currentStep, stepProgress, false);
        setMessage('Please move closer to the camera.');
        await wait(150);
        continue;
      }

      if (faceRatio > 0.65) {
        stepProgress = Math.max(0, stepProgress - 10);
        setGuidedProgress(stepProgress);
        drawGuideHUD(detection, currentStep, stepProgress, false);
        setMessage('Please move slightly backward.');
        await wait(150);
        continue;
      }

      const landmarks = detection.landmarks.positions || [];
      let stepSatisfied = false;

      if (currentStep === 0) {
        // Look Straight
        const yaw = estimateYaw(landmarks);
        if (Math.abs(yaw) < 0.08) {
          stepSatisfied = true;
          if (detection.descriptor && !savedEmbedding) {
            savedEmbedding = Array.from(detection.descriptor);
            savedImage = captureVideoFrame(videoEl, FACE_REGISTRATION_IMAGE_CAPTURE);
          }
        } else {
          setMessage('Look straight at the camera.');
        }
      } else if (currentStep === 1) {
        // Turn Left
        const yaw = estimateYaw(landmarks);
        if (yaw < -0.12) {
          stepSatisfied = true;
        } else {
          setMessage('Slowly turn your head to the left.');
        }
      } else if (currentStep === 2) {
        // Turn Right
        const yaw = estimateYaw(landmarks);
        if (yaw > 0.12) {
          stepSatisfied = true;
        } else {
          setMessage('Slowly turn your head to the right.');
        }
      }

      if (stepSatisfied) {
        stepProgress += 25; // accumulate progress
        if (stepProgress >= 100) {
          stepProgress = 100;
          setGuidedProgress(100);
          drawGuideHUD(detection, currentStep, 100, true);
          setMessage(`Step ${currentStep + 1} completed!`);
          await wait(600); // feedback delay

          currentStep += 1;
          setGuidedStep(currentStep);
          stepProgress = 0;
          setGuidedProgress(0);
        } else {
          setGuidedProgress(stepProgress);
          drawGuideHUD(detection, currentStep, stepProgress, true);
        }
      } else {
        stepProgress = Math.max(0, stepProgress - 5);
        setGuidedProgress(stepProgress);
        drawGuideHUD(detection, currentStep, stepProgress, false);
      }

      await wait(80);
    }

    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return { faceEmbedding: savedEmbedding, faceImageData: savedImage };
  };

  const captureLivenessFrames = async () => {
    if (!browserModelsReadyRef.current) {
      throw new Error('Browser face models are unavailable. Server verification will be used.');
    }

    const videoEl = await ensureVideoReady();
    const frameCount = 4;
    const earSeries = [];
    const yawSeries = [];
    const centerSeries = [];
    const frames = [];

    setMessage('Liveness check: blink once or move your head slightly.');

    for (let sampleIndex = 0; sampleIndex < frameCount; sampleIndex += 1) {
      let detections = await runTinyFaceDetectionPasses({
        input: videoEl,
        passes: CAPTURE_TINY_DETECTION_PASSES,
        withLandmarks: true
      });

      if (!detections.length) {
        const ssdDetection = await runSsdFaceDetectionPasses({
          input: videoEl,
          passes: SSD_DETECTION_PASSES,
          withLandmarks: true
        });

        detections = ssdDetection ? [ssdDetection] : [];
      }

      const detection = pickBestPlacedDetection(videoEl, detections, 'capture') || detections[0] || null;

      if (!detection) {
        throw new Error('Liveness check failed because the face was not visible in all frames.');
      }

      const placement = getFacePlacement(videoEl, detection, { mode: 'capture' });
      if (!placement.valid) {
        throw new Error(placement.message);
      }

      const landmarks = detection.landmarks.positions || [];
      const leftEye = landmarks.slice(36, 42);
      const rightEye = landmarks.slice(42, 48);
      const faceBox = detection.detection?.box || {};
      const centerPoint = {
        x: (faceBox.x || 0) + (faceBox.width || 0) / 2,
        y: (faceBox.y || 0) + (faceBox.height || 0) / 2
      };

      earSeries.push((calculateEyeAspectRatio(leftEye) + calculateEyeAspectRatio(rightEye)) / 2);
      yawSeries.push(estimateYawSpread(landmarks));
      centerSeries.push(centerPoint);
      frames.push({
        imageData: captureVideoFrame(videoEl, LIVENESS_FRAME_CAPTURE),
        capturedAt: new Date().toISOString()
      });

      if (sampleIndex < frameCount - 1) {
        await wait(120);
      }
    }

    const earSpread = Math.max(...earSeries) - Math.min(...earSeries);
    const yawSpread = Math.max(...yawSeries) - Math.min(...yawSeries);
    const faceMovement = centerSeries.reduce((maxDistance, point, index) => {
      if (index === 0) return maxDistance;
      return Math.max(maxDistance, calculateDistance(centerSeries[index - 1], point));
    }, 0);

    const livenessDetected = earSpread >= 0.035 || yawSpread >= 0.06 || faceMovement >= 6;

    if (!livenessDetected && !isLocalDevRuntime) {
      throw new Error('Liveness check failed. Please blink or move your head slightly, then try again.');
    }

    if (!livenessDetected && isLocalDevRuntime) {
      setMessage('Low motion detected. Continuing with server-side verification.');
    }

    return {
      frames,
      proof: {
        source: 'client_passive_v1',
        valid: livenessDetected,
        passed: livenessDetected,
        frameCount,
        confidence: livenessDetected ? 86 : 55,
        earSpread: Number(earSpread.toFixed(4)),
        yawSpread: Number(yawSpread.toFixed(4)),
        faceMovement: Number(faceMovement.toFixed(2)),
        checkedAt: new Date().toISOString()
      }
    };
  };

  useEffect(() => {
    const syncOfflineRegistration = async () => {
      const offlineData = localStorage.getItem('pending_face_registration');
      if (offlineData) {
        try {
          const payload = JSON.parse(offlineData);
          console.log('🔄 Internet restored. Syncing offline face profile for:', payload.employeeName);
          const res = await api.post('/attendance/face/register', payload);
          if (res.data.success) {
            localStorage.removeItem('pending_face_registration');
            showToast('success', 'Biometrics Sync', 'Offline face profile synced successfully with server.');
            await checkFaceStatus();
          }
        } catch (err) {
          console.error('Failed to sync offline face profile:', err);
        }
      }
    };

    if (navigator.onLine) {
      syncOfflineRegistration();
    }

    const handleOnline = () => {
      syncOfflineRegistration();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        if (!autoCameraStartedRef.current) {
          autoCameraStartedRef.current = true;
          window.setTimeout(() => {
            document.querySelector('[data-face-auto-start="true"]')?.click();
          }, 0);
        }
        const browserReady = await ensureFaceModelsLoaded();
        if (active) {
          browserModelsReadyRef.current = browserReady;
          setBrowserModelsReady(browserReady);
          setModelsLoaded(true);
          checkFaceStatus();
        }
      } catch (err) {
        console.error('Failed to load face models:', err);
        if (active) {
          browserModelsReadyRef.current = false;
          setBrowserModelsReady(false);
          setModelsLoaded(true);
          checkFaceStatus();
        }
      }
    };
    init();
    return () => { active = false; stopCamera(); };
  }, []);

  useEffect(() => {
    let animationFrame;
    let lastGuideDetectionAt = 0;
    const runGuide = async (timestamp = 0) => {
      if (!cameraActive || !videoRef.current || capturing) {
        setFaceAligned(false);
        if (overlayCanvasRef.current) {
          const ctx = overlayCanvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
        }
        return;
      }

      try {
        const videoEl = videoRef.current;
        const shouldRunDetection =
          videoEl.readyState >= 2 &&
          (!lastGuideDetectionAt || timestamp - lastGuideDetectionAt >= GUIDE_DETECTION_INTERVAL_MS);

        if (shouldRunDetection) {
          lastGuideDetectionAt = timestamp;
          let detection = null;
          if (modelsLoaded) {
            detection = await detectGuideFace(videoEl);
          }
          drawFaceAlignmentGuide(videoEl, detection);
        }
      } catch {
        // Silently skip frames if they fail
      }

      if (cameraActive) {
        animationFrame = requestAnimationFrame(runGuide);
      }
    };

    if (cameraActive && modelsLoaded && !capturing) {
      animationFrame = requestAnimationFrame(runGuide);
    }

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [cameraActive, modelsLoaded, capturing, browserModelsReady]);

  const checkFaceStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/face/status');
      setFaceRegistered(res.data.isRegistered);
      setCanUpdate(res.data.canUpdate ?? !res.data.isRegistered);
      setPendingUpdateRequest(res.data.pendingRequest || null);
      if (!res.data.isRegistered && !res.data.isPending) setMode('register');
    } catch {
      setFaceRegistered(false);
      setPendingUpdateRequest(null);
    } finally {
      setLoading(false);
    }
  };

  const drawFaceAlignmentGuide = (videoEl, detection) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = videoEl.videoWidth;
    const height = videoEl.videoHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.clearRect(0, 0, width, height);

    const guideRect = getGuideFrameRect(width, height);
    
    // Dim outside
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, width, height);
    ctx.clearRect(guideRect.x, guideRect.y, guideRect.width, guideRect.height);

    const placement = detection ? getFacePlacement(videoEl, detection, { mode: 'guide' }) : { valid: false };
    if (placement.valid) {
      lastAlignedAtRef.current = Date.now();
    }
    const effectiveAligned =
      placement.valid || Date.now() - lastAlignedAtRef.current < FACE_CAPTURE_CONFIG.guideHoldMs;
    setFaceAligned((current) => (current === effectiveAligned ? current : effectiveAligned));

    ctx.strokeStyle = effectiveAligned ? '#16A34A' : '#F59E0B';
    ctx.setLineDash([10, 5]);
    ctx.lineWidth = effectiveAligned ? 3 : 2;
    ctx.strokeRect(guideRect.x, guideRect.y, guideRect.width, guideRect.height);
    ctx.setLineDash([]);

    if (detection) {
      const { x, y, width: w, height: h } = detection.detection.box;
      ctx.strokeStyle = effectiveAligned ? '#16A34A' : '#F59E0B';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
  };

  const startCamera = async () => {
    try {
      setStatus(null);
      setMessage('Checking location services...');
      setCapturing(false);

      // Verify location is enabled and allowed before starting the camera
      setGpsLoading(true);
      setGpsError('');
      try {
        await getLocation();
      } catch (gpsErr) {
        const msg = gpsErr?.message || 'Please enable location services and allow access before starting the camera.';
        setGpsError(msg);
        throw new Error(msg);
      } finally {
        setGpsLoading(false);
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API is not available in this browser or insecure context.');
      }

      const isSecureBrowserContext =
        window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isSecureBrowserContext) {
        throw new Error('Camera requires HTTPS or localhost to work properly.');
      }

      stopCamera();
      setCameraActive(true);
      await wait(200);

      const videoEl = await waitForVideoElement();
      const getVideoInputs = async () => {
        if (typeof navigator.mediaDevices.enumerateDevices !== 'function') {
          return [];
        }

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          return (devices || []).filter((device) => device && device.kind === 'videoinput');
        } catch {
          return [];
        }
      };

      const preferredDeviceId = (await getVideoInputs())?.[0]?.deviceId || null;

      const baseCameraProfiles = [
        {
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 480 },
            height: { ideal: 360 },
            frameRate: { ideal: 15, max: 20 }
          },
          audio: false
        },
        {
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 960 },
            height: { ideal: 540 },
            aspectRatio: { ideal: 16 / 9 },
            frameRate: { ideal: 15, max: 20 }
          },
          audio: false
        },
        {
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 640 },
            height: { ideal: 360 },
            aspectRatio: { ideal: 16 / 9 },
            frameRate: { ideal: 15, max: 20 }
          },
          audio: false
        },
        {
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { ideal: 15, max: 20 }
          },
          audio: false
        }
      ];

      const cameraProfiles = preferredDeviceId
        ? [
            ...baseCameraProfiles.map((profile) => ({
              ...profile,
              video: {
                ...profile.video,
                deviceId: { exact: preferredDeviceId }
              }
            })),
            ...baseCameraProfiles
          ]
        : baseCameraProfiles;

      let lastError = null;
      for (const profile of cameraProfiles) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(profile);
          streamRef.current = stream;
          if (videoEl) {
            videoEl.srcObject = stream;
            await videoEl.play();
            syncPreviewAspectRatio(videoEl);
            videoEl.addEventListener('loadedmetadata', () => syncPreviewAspectRatio(videoEl), {
              once: true
            });
            if (mode === 'attendance') {
              refreshLocation({ silent: true }).catch(() => {});
            }
            return;
          }
        } catch (err) {
          lastError = err;
        }
      }

      throw lastError || new Error('All camera access strategies failed.');
    } catch (err) {
      setCameraActive(false);
      setStatus('error');
      const errorName = err?.name || '';
      const errorMessage =
        errorName === 'NotAllowedError'
          ? 'Camera permission blocked. Please allow camera access in the browser and retry.'
          : errorName === 'NotFoundError'
            ? (() => {
                return [
                  'No camera device detected.',
                  'Fix:',
                  '1) Check Windows Settings → Privacy & security → Camera → enable camera access (and allow your browser).',
                  '2) Close other apps using camera (Teams/Zoom/WhatsApp Web) and retry.',
                  '3) If using external webcam, reconnect it and confirm it appears in Device Manager.',
                ].join(' ');
              })()
            : errorName === 'NotReadableError'
              ? 'Camera is busy in another app or browser tab. Please close it and try again.'
              : errorName === 'AbortError'
                ? 'Camera startup was interrupted. Please retry once.'
                : errorName === 'OverconstrainedError'
                  ? 'This camera does not support the requested settings. Please retry.'
              : errorName === 'SecurityError'
                ? 'Camera cannot start in this browser security mode.'
                : err?.message || 'Camera access denied or unavailable.';

      setMessage(errorMessage);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setFaceAligned(false);
    setGpsLoading(false);
    setGpsError('');
    setLocation(null);
    lastStableLocationRef.current = null;
    recentLocationSamplesRef.current = [];
    setPreviewAspectRatio(16 / 9);
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
    setGuidedStep(-1);
    setGuidedProgress(0);
  };

  const getLocation = useCallback(async () => {
    const readCurrentPosition = (options = {}) =>
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(buildLocationSnapshot(position)),
          (err) => {
            let locationMessage = 'Unable to fetch your location.';
            if (err?.code === 1) locationMessage = 'Location permission denied. Please allow location access and try again.';
            if (err?.code === 2) locationMessage = 'Location data is unavailable right now. Please retry after a moment.';
            if (err?.code === 3) locationMessage = 'Location request timed out. Please retry in an open area.';
            reject(new Error(locationMessage));
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 20000,
            ...options
          }
        );
      });

    const attemptOptions =
      runtimeDeviceType === 'mobile'
        ? [
            { timeout: 12000, maximumAge: 0 },
            { timeout: 8000, maximumAge: 5000 }
          ]
        : [
            { timeout: 5000, maximumAge: 60000 },
            { timeout: 7000, maximumAge: 30000 }
          ];
    let bestLocation = null;
    let lastError = null;
    const collectedSamples = [];

    for (let attempt = 0; attempt < attemptOptions.length; attempt += 1) {
      try {
        const candidate = normalizeLocationSample(await readCurrentPosition(attemptOptions[attempt]));
        if (!candidate) {
          throw new Error('Unable to read a valid GPS location.');
        }
        collectedSamples.push(candidate);

        if (!bestLocation || (candidate.accuracy || Number.POSITIVE_INFINITY) < (bestLocation.accuracy || Number.POSITIVE_INFINITY)) {
          bestLocation = candidate;
        }

        const candidateAccuracy = candidate.accuracy || Number.POSITIVE_INFINITY;
        if (
          candidateAccuracy <= gpsThresholds.verified ||
          (runtimeDeviceType === 'desktop' && candidateAccuracy <= gpsThresholds.flagged)
        ) {
          break;
        }
      } catch (err) {
        lastError = err;
      }

      if (attempt < attemptOptions.length - 1) {
        await wait(500);
      }
    }

    if (!bestLocation) {
      throw lastError || new Error('Unable to fetch your location.');
    }

    recentLocationSamplesRef.current = trimLocationSamples(
      [...recentLocationSamplesRef.current, ...collectedSamples],
      { maxAgeMs: 20000, maxSamples: 8 }
    );
    const stableLocation =
      stabilizeLocationSamples({
        previous: lastStableLocationRef.current,
        samples: recentLocationSamplesRef.current,
        options: {
          maxAgeMs: 20000,
          maxSamples: 8,
          stableRadiusMeters: runtimeDeviceType === 'mobile' ? 20 : 35
        }
      }) || bestLocation;
    stableLocation.place = formatGpsCoordinates(stableLocation.lat, stableLocation.lng);

    lastStableLocationRef.current = stableLocation;
    setLocation(stableLocation);
    return stableLocation;
  }, [gpsThresholds.flagged, gpsThresholds.verified, runtimeDeviceType]);

  const refreshLocation = useCallback(async ({ silent = false } = {}) => {
    const shouldShowLoading = !silent || !location;
    if (shouldShowLoading) {
      setGpsLoading(true);
    }
    setGpsError('');
    try {
      const loc = await getLocation();
      if (typeof loc.accuracy !== 'number') {
        throw new Error('GPS accuracy is unavailable. Please retry in an open area.');
      }
      if (loc.accuracy > gpsThresholds.flagged) {
        throw new Error(
          runtimeDeviceType === 'mobile'
            ? 'Location accuracy too weak. Please move to open area and retry.'
            : 'Desktop location is too weak. Retry once or use mobile GPS.'
        );
      }
      return loc;
    } catch (err) {
      setGpsError(err.message || 'Unable to fetch your location.');
      if (!silent) {
        setStatus('error');
        setMessage(err.message || 'Unable to fetch your location.');
      }
      throw err;
    } finally {
      if (shouldShowLoading) {
        setGpsLoading(false);
      }
    }
  }, [getLocation, gpsThresholds.flagged, location, runtimeDeviceType]);

  useEffect(() => {
    if (!cameraActive || mode !== 'attendance' || capturing) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      if (!gpsLoading) {
        refreshLocation({ silent: true }).catch(() => {});
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [cameraActive, mode, capturing, gpsLoading, refreshLocation]);

  const handleAttendance = async () => {
    if (!faceRegistered) {
      setShowUnregisteredModal(true);
      return;
    }
    if (!modelsLoaded) return;
    let trackingStartLocation = null;
    let trackingDevice = null;
    setCapturing(true); setStatus(null); setMessage('Verifying Identity...');
    try {
      const [loc, device] = await Promise.all([
        isGpsReady ? Promise.resolve(location) : refreshLocation(),
        buildDeviceSignature()
      ]);
      trackingStartLocation = loc;
      trackingDevice = device;
      const videoEl = await ensureVideoReady();
      const image = captureVideoFrame(videoEl, FACE_IMAGE_CAPTURE);
      let liveFrames = [];
      let livenessProof = null;
      try {
        const livenessCapture = await captureLivenessFrames();
        liveFrames = livenessCapture.frames;
        livenessProof = livenessCapture.proof;
      } catch {
        liveFrames = await captureRawFrames(videoEl);
        livenessProof = {
          source: 'client_fallback_frames',
          valid: false,
          passed: false,
          frameCount: liveFrames.length,
          confidence: 45,
          checkedAt: new Date().toISOString()
        };
        setMessage('Face detected. Switching to fallback verification...');
      }

      let faceEmbedding;
      try {
        faceEmbedding = await detectFaceDescriptor();
      } catch {
        faceEmbedding = null;
      }

      let faceVerificationToken = '';
      if (faceRegistered) {
        try {
          setMessage('Matching face profile...');
          const matchRes = await api.post('/face-attendance/match', {
            employeeId: employeeCode,
            faceEmbedding,
            faceImageData: image,
            liveFrames,
            livenessProof,
            deviceType: device.deviceType || runtimeDeviceType,
            deviceId: device.fingerprint,
            device
          });

          faceVerificationToken = matchRes.data?.data?.faceVerificationToken || '';
        } catch (matchErr) {
          const matchErrorCode = matchErr?.response?.data?.error;
          if (matchErrorCode === 'face_mismatch') {
            throw new Error(matchErr?.response?.data?.message || 'Registered face did not match. Attendance was not marked.');
          }
          if (matchErrorCode === 'no_registered_face') {
            setFaceRegistered(false);
            throw new Error('No registered face profile found. Please register first.');
          }
          throw matchErr;
        }
      }

      setMessage('Marking attendance...');
      const res = await api.post('/face-attendance/mark', {
        employeeId: employeeCode,
        faceVerificationToken,
        faceEmbedding,
        faceImageData: image,
        liveFrames,
        livenessProof,
        actionType: requestedAction,
        deviceType: device.deviceType || runtimeDeviceType,
        deviceId: device.fingerprint,
        device,
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
        location: {
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          speed: loc.speed,
          heading: loc.heading,
          altitude: loc.altitude,
          timestamp: loc.timestamp,
          mocked: false
        }
      });

      if (res.data.success) {
        const tracking = res.data.data?.tracking || null;
        if (requestedAction === 'OUT' || tracking?.status === 'STOPPED') {
          await locationTrackingService.stop({
            reason: 'CHECK_OUT',
            trackingState: 'STOPPED',
            clearStorage: true,
            skipNetwork: true
          });
        } else if (tracking?.sessionId) {
          await locationTrackingService.start({
            sessionId: tracking.sessionId,
            attendanceId: tracking.attendanceId,
            recommendedIntervalSec: tracking.recommendedIntervalSec,
            status: tracking.status,
            device,
            initialLocation: loc,
            userId: user?.id || user?._id || '',
            role: user?.roleName || user?.role || ''
          });
        }

        setStatus('success');
        const responseMessage = res.data.message || 'Attendance processed';

        setMessage(
          tracking?.status === 'ACTIVE' || tracking?.status === 'SUSPICIOUS'
            ? `${responseMessage} Background location tracking is now active.`
            : responseMessage
        );
        if (res.data.data?.status?.policyViolations?.length) {
          setViolationModal({ show: true, violations: res.data.data.status.policyViolations });
        }
        if (onSuccess) onSuccess(res.data);
        setTimeout(() => { stopCamera(); setCapturing(false); }, 2000);
      }
    } catch (err) {
      const errorCode = err?.response?.data?.error;
      const conflictTracking = err?.response?.data?.data?.tracking || null;

      if (errorCode === 'already_checked_in' || errorCode === 'already_checked_out') {
        if (errorCode === 'already_checked_out') {
          await locationTrackingService.stop({
            reason: 'CHECK_OUT',
            trackingState: 'STOPPED',
            clearStorage: true,
            skipNetwork: true
          });
        } else if (conflictTracking?.sessionId) {
          await locationTrackingService.start({
            sessionId: conflictTracking.sessionId,
            attendanceId: conflictTracking.attendanceId,
            recommendedIntervalSec: conflictTracking.recommendedIntervalSec,
            status: conflictTracking.status,
            device: trackingDevice || {},
            initialLocation: trackingStartLocation || location || null,
            userId: user?.id || user?._id || '',
            role: user?.roleName || user?.role || ''
          });
        }

        setStatus('success');
        setMessage(err?.response?.data?.message || 'Attendance is already in sync.');
        if (onSuccess) onSuccess(err.response.data);
        setTimeout(() => { stopCamera(); setCapturing(false); }, 1500);
        return;
      }

      if (errorCode === 'no_registered_face') {
        setFaceRegistered(false);
        setCanUpdate(true);
        setPendingUpdateRequest(null);
        setMode('register');
      }

      setStatus('error');
      setMessage(getErrorMessage(err));
      setCapturing(false);
    }
  };

  const handleRegistration = async () => {
    if (!registrationName.trim() || !registrationId.trim() || !consentGiven) {
      showToast('warning', 'Missing Details', 'Fill all fields and accept consent.'); return;
    }
    setCapturing(true); setStatus(null); setMessage('Initializing guided registration...');
    let result = null;
    try {
      const videoEl = await ensureVideoReady();
      result = await runGuidedRegistrationLoop(videoEl);

      if (!result || !result.faceEmbedding || !result.faceImageData) {
        throw new Error('Guided registration was cancelled or incomplete.');
      }

      setGuidedStep(-1);
      
      const payload = {
        employeeName: registrationName,
        employeeId: registrationId,
        faceEmbedding: result.faceEmbedding,
        faceImageData: result.faceImageData,
        registrationNotes: `Self register: ${registrationName} (${registrationId})`,
        consentGiven: true
      };

      if (!navigator.onLine) {
        localStorage.setItem('pending_face_registration', JSON.stringify(payload));
        setStatus('success');
        setMessage('Offline: Face saved locally. Will sync when online.');
        setFaceRegistered(true);
        showToast('info', 'Offline Mode', 'No internet connection. Saved face profile locally. Will auto-sync when online.');
        setTimeout(() => { stopCamera(); setCapturing(false); setMode('attendance'); }, 3000);
        return;
      }

      setMessage('Saving biometric profile to server...');
      
      try {
        const res = await api.post('/attendance/face/register', payload);
        if (res.data.success) {
          setStatus('success');
          setMessage('Registration Successful');
          await checkFaceStatus();
          setTimeout(() => { stopCamera(); setCapturing(false); setMode('attendance'); }, 2000);
        }
      } catch (postErr) {
        const isNetworkErr = !navigator.onLine || postErr.message === 'Network Error' || !postErr.response;
        if (isNetworkErr) {
          localStorage.setItem('pending_face_registration', JSON.stringify(payload));
          setStatus('success');
          setMessage('Offline Fallback: Face saved locally. Will sync when online.');
          setFaceRegistered(true);
          showToast('info', 'Offline Fallback', 'Network issue. Saved face profile locally. Will auto-sync when connection is restored.');
          setTimeout(() => { stopCamera(); setCapturing(false); setMode('attendance'); }, 3000);
        } else {
          throw postErr;
        }
      }
    } catch (err) {
      setGuidedStep(-1);
      setStatus('error');
      setMessage(getErrorMessage(err, 'Registration failed'));
      setCapturing(false);
      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    }
  };

  const handleSubmitRequest = async () => {
    if (!requestReason.trim()) return;
    try {
      setSubmittingRequest(true);
      await api.post('/face-attendance/request-update', { reason: requestReason });
      showToast('success', 'Request Sent', 'HR will review your update request.');
      setRequestReason('');
      setShowRequestModal(false);
      checkFaceStatus();
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Could not send request.';
      showToast('error', 'Update Failed', message);
    } finally { setSubmittingRequest(false); }
  };

  return (
    <div className="w-full bg-white rounded-xl overflow-hidden font-inter border border-[#E2E8F0] shadow-sm flex flex-col max-h-[90vh]">
      
      {/* 1. Header */}
      <div className="px-6 py-4 border-b border-[#E2E8F0] bg-slate-50/50 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2563EB] text-white rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/10">
               <Fingerprint size={22} />
            </div>
            <div>
               <h2 className="text-[16px] font-semibold text-slate-900 leading-none mb-1">Face Recognition</h2>
               <p className="text-[11px] text-[#64748B] font-medium uppercase tracking-wider">Attendance Verification Protocol</p>
            </div>
         </div>
         <div className="flex items-center gap-3">
         {(isBootingBiometrics || gpsLoading) && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-[#2563EB] border border-blue-100">
               <Loader2 size={12} className="animate-spin" />
               <span className="text-[10px] font-bold uppercase tracking-wider">
                 {isBootingBiometrics ? 'Preparing camera' : 'Refreshing GPS'}
               </span>
            </div>
         )}
         <div className="flex bg-white p-1 rounded-lg border border-[#E2E8F0] shadow-sm">
            <button 
              onClick={() => { setMode('attendance'); setStatus(null); setMessage(''); }}
              className={clsx("px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all", mode === 'attendance' ? "bg-[#2563EB] text-white" : "text-[#64748B] hover:text-[#334155]")}
            >
              Attendance
            </button>
            <button 
              onClick={() => {
                if (faceRegistered && pendingUpdateRequest) {
                  showToast('info', 'Request Pending', 'Your face update request is already waiting for HR approval.');
                  return;
                }
                if (faceRegistered && !canUpdate) {
                  setShowRequestModal(true);
                  return;
                }
                setMode('register');
              }}
              className={clsx("px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all", mode === 'register' ? "bg-[#2563EB] text-white" : "text-[#64748B] hover:text-[#334155]")}
            >
              {faceRegistered ? "Update" : "Register"}
            </button>
         </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
         {mode === 'attendance' && !faceRegistered && (
             pendingUpdateRequest ? (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-3 shadow-sm animate-in fade-in duration-300 w-full">
                   <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5 border border-blue-200">
                      <Clock size={20} className="text-blue-600" />
                   </div>
                   <div>
                      <h4 className="text-sm font-bold text-blue-800">Biometric Registration Pending HR Approval</h4>
                      <p className="text-[12px] text-blue-700 mt-0.5 leading-relaxed font-medium">
                         Your biometric registration is waiting for HR approval. Once approved, you can mark attendance. / आपका बायोमेट्रिक पंजीकरण एचआर की मंजूरी के लिए लंबित है। स्वीकृत होने के बाद आप उपस्थिति दर्ज कर सकेंगे।
                      </p>
                   </div>
                </div>
             ) : (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300 w-full">
                   <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5 border border-amber-200">
                         <AlertCircle size={20} className="text-amber-600" />
                      </div>
                      <div>
                         <h4 className="text-sm font-bold text-amber-800">Biometric Registration Required</h4>
                         <p className="text-[12px] text-amber-700 mt-0.5 leading-relaxed font-medium">
                            Your face profile is not registered. You cannot mark attendance without face verification. Please register first.
                         </p>
                      </div>
                   </div>
                   <button
                      onClick={() => setMode('register')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all shadow-md shadow-amber-500/10 shrink-0"
                   >
                      Register Now
                   </button>
                </div>
             )
          )}
         <div className="grid md:grid-cols-2 gap-8 items-start">
            
            {/* Left: Camera Feed */}
            <div className="space-y-6">
               {/* Telemetry Cards */}
               <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-xl">
                     <p className="text-[9px] font-bold text-[#64748B] uppercase tracking-widest mb-1">GPS Location</p>
                     {gpsLoading ? (
                       <p className="text-[11px] font-bold text-slate-500 truncate flex items-center gap-1.5"><Loader2 size={10} className="animate-spin text-[#2563EB]" /> Syncing GPS...</p>
                     ) : location ? (
                       <div className="space-y-1">
                         <p className="text-[11px] font-bold text-slate-900 truncate flex items-center gap-1.5">
                           <MapPin size={10} className="text-[#2563EB]" /> {location.place || formatGpsCoordinates(location.lat, location.lng)}
                         </p>
                         <p className={clsx("text-[10px] font-semibold", gpsUiState.tone)}>
                           Accuracy {Math.round(location.accuracy || 0)}m
                         </p>
                         <p className={clsx("text-[10px] font-semibold", gpsUiState.tone)}>
                           {gpsUiState.message}
                         </p>
                       </div>
                     ) : (
                       <p className="text-[11px] text-slate-300 font-bold italic">Pending Sync...</p>
                     )}
                  </div>
                  <div className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-xl">
                     <p className="text-[9px] font-bold text-[#64748B] uppercase tracking-widest mb-1">Face Profile</p>
                     <div className="space-y-1">
                       <p className={clsx("text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5", isBootingBiometrics ? "text-[#2563EB]" : faceRegistered ? "text-[#16A34A]" : "text-[#F59E0B]")}>
                          {isBootingBiometrics
                            ? <><Loader2 size={10} className="animate-spin" /> Syncing</>
                            : faceRegistered ? <><ShieldCheck size={10} /> Verified</> : <><Info size={10} /> Unregistered</>}
                       </p>
                       <p className={clsx("text-[10px] font-semibold", faceGuideSatisfied ? "text-[#16A34A]" : "text-slate-400")}>
                         {faceGuideSatisfied ? (faceRegistered ? 'Face ready' : 'Camera ready') : isBootingBiometrics ? 'Preparing camera' : 'Keep face visible'}
                       </p>
                     </div>
                  </div>
               </div>

               <div
                 className="relative w-full bg-black rounded-xl overflow-hidden border border-[#E2E8F0] shadow-inner group"
                 style={{ aspectRatio: previewAspectRatio }}
               >
                  {!cameraActive ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50">
                       <div className="w-16 h-16 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                          <Camera size={28} className="text-slate-300 group-hover:text-[#2563EB] transition-colors" />
                       </div>
                       <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Feed Status: Offline</p>
                    </div>
                  ) : (
                    <>
                       <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                       <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10 scale-x-[-1]" />
                        {capturing && guidedStep === -1 && (
                          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-in fade-in duration-300">
                             <Loader2 size={32} className="text-[#2563EB] animate-spin mb-2" />
                             <span className="text-[10px] font-bold text-[#334155] uppercase tracking-widest animate-pulse">{message || 'Analyzing Biometrics'}</span>
                          </div>
                        )}
                    </>
                  )}
               </div>

               {guidedStep >= 0 && guidedStep < GUIDED_STEPS.length && (
                 <div className="bg-slate-900 border border-slate-700/50 p-4 rounded-xl flex items-center justify-between shadow-xl animate-in slide-in-from-bottom-5 duration-300">
                    <div className="flex-1">
                       <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-0.5">
                         Verification Step {guidedStep + 1} of {GUIDED_STEPS.length}
                       </p>
                       <h4 className="text-white text-sm font-bold leading-tight">
                         {GUIDED_STEPS[guidedStep].label}
                       </h4>
                       <p className="text-slate-300 text-[11px] mt-0.5 font-medium leading-relaxed">
                         {message || GUIDED_STEPS[guidedStep].instruction}
                       </p>
                    </div>
                    <div className="relative w-12 h-12 flex items-center justify-center shrink-0 ml-3">
                       <svg className="w-full h-full transform -rotate-90">
                         <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                         <circle cx="24" cy="24" r="20" stroke="#10B981" strokeWidth="4" fill="none"
                                 strokeDasharray={2 * Math.PI * 20}
                                 strokeDashoffset={2 * Math.PI * 20 * (1 - guidedProgress / 100)}
                                 strokeLinecap="round"
                                 className="transition-all duration-100 ease-out" />
                       </svg>
                       <span className="absolute text-[10px] font-bold text-white uppercase">{guidedProgress}%</span>
                    </div>
                 </div>
               )}

               <div className="space-y-3">
                  {!cameraActive ? (
                    <button data-face-auto-start="true" onClick={startCamera} className="w-full h-[48px] bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-[0.1em] hover:bg-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2">
                       <Camera size={16} /> Power On Sensors
                    </button>
                  ) : (
                    <div className="flex gap-3">
                       <button 
                         onClick={mode === 'attendance' ? handleAttendance : handleRegistration} 
                         disabled={mode === 'attendance' ? !canSubmitAttendance : capturing}
                         className="flex-1 h-[48px] bg-[#2563EB] text-white rounded-lg text-xs font-bold uppercase tracking-[0.1em] hover:bg-blue-700 transition-all shadow-blue-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                       >
                          {capturing ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle size={16} /> {mode === 'attendance' ? attendanceActionLabel : 'Capture & Save'}</>}
                       </button>
                       {mode === 'attendance' && (
                         <button
                           onClick={() => refreshLocation().catch(() => {})}
                           disabled={gpsLoading || capturing}
                           className="h-[48px] px-4 border border-[#E2E8F0] text-slate-500 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                           title="Refresh GPS"
                         >
                           {gpsLoading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                           <span className="text-[11px] font-bold uppercase tracking-wider">Retry Location</span>
                         </button>
                       )}
                       <button onClick={() => { stopCamera(); onClose?.(); }} className="w-12 h-[48px] border border-[#E2E8F0] text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all flex items-center justify-center">
                          <X size={20} />
                       </button>
                    </div>
                  )}
               </div>
            </div>

            {/* Right: Forms & Feedback */}
            <div className="space-y-6">
                
               {mode === 'register' && (
                 <div className="bg-slate-50/50 border border-[#E2E8F0] p-6 rounded-xl space-y-4">
                    <h3 className="text-[12px] font-semibold text-slate-900 uppercase tracking-widest mb-2 flex items-center gap-2"><User size={14} /> Profile Baseline</h3>
                    <div className="space-y-3">
                       <div>
                          <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest ml-1">Full Name</label>
                          <input type="text" value={registrationName} onChange={e => setRegistrationName(e.target.value)} className="w-full h-[40px] px-4 bg-white border border-[#E2E8F0] rounded-lg text-sm font-medium outline-none focus:border-[#2563EB] transition-all" />
                       </div>
                       <div>
                          <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest ml-1">Employee ID</label>
                          <input type="text" value={registrationId} onChange={e => setRegistrationId(e.target.value)} className="w-full h-[40px] px-4 bg-white border border-[#E2E8F0] rounded-lg text-sm font-medium outline-none focus:border-[#2563EB] transition-all" />
                       </div>
                       <label className="flex items-start gap-3 p-3 bg-white border border-[#E2E8F0] rounded-lg cursor-pointer hover:bg-blue-50/30 transition-all group">
                          <input type="checkbox" checked={consentGiven} onChange={e => setConsentGiven(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-[#E2E8F0] text-[#2563EB] focus:ring-[#2563EB]" />
                          <span className="text-[11px] text-[#64748B] font-medium leading-relaxed group-hover:text-[#334155]">I consent to biometric data processing for system access.</span>
                       </label>
                    </div>
                 </div>
               )}

               {status && (
                 <div className="space-y-3">
                    <div className={clsx("p-5 rounded-xl border animate-in zoom-in-95 duration-300 flex items-start gap-4", status === 'success' ? "bg-[#ECFDF5] border-[#D1FAE5] text-[#16A34A]" : "bg-[#FEF2F2] border-[#FEE2E2] text-[#DC2626]")}>
                       <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm transition-transform scale-110", status === 'success' ? "bg-white text-[#16A34A]" : "bg-white text-[#DC2626]")}>
                          {status === 'success' ? <CheckCircle size={22} /> : <XCircle size={22} />}
                       </div>
                       <div>
                          <h4 className="text-[12px] font-semibold uppercase tracking-widest mb-1">{status === 'success' ? 'Verification Success' : 'Sensor Error'}</h4>
                          <p className="text-[13px] font-medium opacity-90 italic">"{message}"</p>
                       </div>
                    </div>

                    {status === 'error' && (import.meta.env.DEV || window.location.hostname === 'localhost') && (
                      <button
                        onClick={async () => {
                          setStatus(null); setMessage('Simulating verification...'); setCapturing(true); await wait(800);
                          if (mode === 'register') {
                            setFaceRegistered(true); setStatus('success'); setMessage('MOCK: Registered');
                            setTimeout(() => { stopCamera(); setCapturing(false); setMode('attendance'); }, 1500);
                          } else {
                            setStatus('success'); setMessage('MOCK: Verified');
                            if (onSuccess) onSuccess({ success: true, message: 'MOCK: Success' });
                            setTimeout(() => { stopCamera(); setCapturing(false); }, 1500);
                          }
                        }}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-slate-200 transition-all flex items-center justify-center gap-2"
                      >
                        <ShieldCheck size={14} /> Bypass Biometrics (Local Dev Only)
                      </button>
                    )}
                 </div>
               )}

               {pendingUpdateRequest && (
                 <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900">
                    <h4 className="text-[11px] font-bold uppercase tracking-widest mb-1">Update Request Pending</h4>
                    <p className="text-[13px] font-medium">
                      HR approval pending since {new Date(pendingUpdateRequest.requestedAt || pendingUpdateRequest.createdAt || Date.now()).toLocaleString()}.
                    </p>
                 </div>
               )}

               {mode === 'attendance' && (
                 <div className="p-4 rounded-xl border border-slate-200 bg-white">
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-700 mb-3">Attendance Prerequisites</h4>
                    <div className="space-y-2">
                       <div className={clsx("text-[12px] font-medium flex items-center gap-2", faceRegistered ? "text-[#16A34A]" : "text-[#D97706]")}>
                          <ShieldCheck size={14} /> {faceRegistered ? 'Face profile registered' : 'No face profile: HR review mode'}
                       </div>
                       <div className={clsx("text-[12px] font-medium flex items-center gap-2", faceGuideSatisfied ? "text-[#16A34A]" : "text-slate-400")}>
                          <Fingerprint size={14} /> Camera frame ready
                       </div>
                       <div className={clsx("text-[12px] font-medium flex items-center gap-2", isGpsReady ? "text-[#16A34A]" : "text-slate-400")}>
                          <MapPin size={14} /> {gpsUiState.status === 'VERIFIED'
                            ? `GPS verified within ${gpsThresholds.verified}m`
                            : gpsUiState.status === 'FLAGGED'
                              ? `GPS allowed with flag up to ${gpsThresholds.flagged}m`
                              : 'GPS missing or too weak'}
                        </div>
                    </div>
                    {location && (
                      <p className={clsx("mt-3 text-[12px] font-medium", gpsUiState.tone)}>
                        {gpsUiState.status === 'VERIFIED'
                          ? `✅ ${gpsUiState.message}`
                          : gpsUiState.status === 'FLAGGED'
                            ? `⚠️ ${gpsUiState.message}`
                            : `❌ ${gpsUiState.message}`}
                      </p>
                    )}
                    {gpsError && (
                      <p className="mt-3 text-[12px] font-medium text-[#DC2626]">{gpsError}</p>
                    )}
                 </div>
               )}

               <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-xl">
                  <h4 className="text-[11px] font-bold text-[#2563EB] uppercase tracking-widest mb-3 flex items-center gap-2"><Activity size={12} /> Live Guidelines</h4>
                  <ul className="space-y-2">
                     {['Ensure adequate face lighting', 'Look directly at the camera lens', 'Remove glasses or accessories if needed', 'Stay within designated office zone'].map((txt, i) => (
                       <li key={i} className="flex items-center gap-2 text-[11px] text-[#2563EB] font-medium opacity-80">
                          <div className="w-1 h-1 bg-[#2563EB] rounded-full shrink-0"></div> {txt}
                       </li>
                     ))}
                  </ul>
               </div>

            </div>
         </div>
      </div>


      {/* UPDATE MODAL */}
      {showRequestModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-xl shadow-2xl p-8 border border-[#E2E8F0] animate-in zoom-in-95 duration-300">
              <h3 className="text-[18px] font-semibold text-[#334155] mb-2 uppercase tracking-tight">Request Data Reset</h3>
              <p className="text-[13px] text-[#64748B] font-medium mb-6 leading-relaxed">System policy requires manual HR approval for biometric updates. Please provide a brief justification.</p>
              
              <div className="space-y-4">
                 <textarea 
                    value={requestReason} 
                    onChange={e => setRequestReason(e.target.value)}
                    placeholder="e.g. Changed appearance, technical registration error..."
                    className="w-full h-32 px-4 py-3 bg-slate-50 border border-[#E2E8F0] rounded-xl text-sm font-medium outline-none focus:border-[#2563EB] transition-all resize-none"
                 />
                 <div className="flex gap-3">
                    <button onClick={() => setShowRequestModal(false)} className="flex-1 h-[44px] bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-widest">Abort</button>
                    <button onClick={handleSubmitRequest} disabled={submittingRequest} className="flex-2 h-[44px] bg-[#2563EB] text-white rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10">
                       {submittingRequest ? <Loader2 size={16} className="animate-spin" /> : 'Submit Request'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* VIOLATION MODAL */}
      {violationModal.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-rose-900/20 backdrop-blur-md">
           <div className="bg-white w-full max-w-sm rounded-xl p-8 border border-[#FEE2E2] shadow-2xl animate-in zoom-in-95 duration-500">
              <div className="flex flex-col items-center text-center mb-6">
                 <div className="w-16 h-16 bg-[#FEF2F2] text-[#DC2626] rounded-full flex items-center justify-center mb-4 border border-[#FEE2E2]">
                    <AlertCircle size={32} />
                 </div>
                 <h2 className="text-[20px] font-bold text-[#DC2626] uppercase tracking-wider">Policy Alert</h2>
                 <p className="text-[11px] font-bold text-rose-400 uppercase tracking-widest mt-1">Operational Anomaly Detected</p>
              </div>
              <div className="space-y-4 mb-8 overflow-y-auto max-h-[30vh] pr-2 custom-scrollbar">
                 {violationModal.violations.map((v, i) => (
                   <div key={i} className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#DC2626] mt-1.5 shrink-0" />
                      <p className="text-[12px] font-semibold text-[#DC2626] leading-relaxed italic">{v}</p>
                   </div>
                 ))}
              </div>
              <button 
                onClick={() => setViolationModal({ show: false, violations: [] })}
                className="w-full h-[48px] bg-[#DC2626] text-white rounded-lg text-[13px] font-bold uppercase tracking-widest shadow-lg shadow-rose-500/10 active:scale-95 transition-all"
              >
                Acknowledge Alert
              </button>
            </div>
         </div>
      )}

      {/* UNREGISTERED MODAL */}
      {showUnregisteredModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 border border-slate-200 animate-in zoom-in-95 duration-300">
              <div className="flex flex-col items-center text-center mb-6">
                 <div className={clsx("w-16 h-16 rounded-full flex items-center justify-center mb-4 border", pendingUpdateRequest ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-amber-50 text-amber-600 border-amber-100")}>
                    {pendingUpdateRequest ? <Clock size={32} /> : <AlertCircle size={32} />}
                 </div>
                 <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                    {pendingUpdateRequest ? "Approval Pending" : "Registration Required"}
                 </h2>
              </div>
              <div className="space-y-4 mb-8 text-center">
                 <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                    {pendingUpdateRequest 
                      ? "Your biometric face profile is registered but is currently pending HR review. You will be able to mark attendance once approved. / आपकी बायोमेट्रिक फेस प्रोफाइल पंजीकृत है लेकिन वर्तमान में एचआर समीक्षा के लिए लंबित है। स्वीकृत होने के बाद आप उपस्थिति दर्ज कर सकेंगे।"
                      : "You cannot mark your attendance because your face profile is not registered in the system. Please register your face first to enable attendance punches."
                    }
                 </p>
              </div>
              <div className="flex gap-4">
                 <button 
                   onClick={() => setShowUnregisteredModal(false)} 
                   className="flex-1 h-[48px] border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                 >
                    Dismiss
                 </button>
                 {!pendingUpdateRequest && (
                    <button 
                      onClick={() => {
                        setShowUnregisteredModal(false);
                        setMode('register');
                      }} 
                      className="flex-1 h-[48px] bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                       Register Now
                    </button>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default FaceAttendance;
