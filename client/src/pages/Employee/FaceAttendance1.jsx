import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, MapPin, CheckCircle, XCircle, User, UserPlus, Clock, AlertCircle,
  Loader2, Navigation, LogOut, RotateCcw, Shield, Smartphone
} from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import * as faceapi from '@vladmandic/face-api';


const FaceAttendance = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState('attendance'); // 'attendance' or 'register'
  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [registrationName, setRegistrationName] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Load face-api.js models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('📦 Loading face-api.js models from local folder...');
        console.log('   Checking faceapi.nets availability...');
        console.log('   - ssdMobilenetv1 available?', !!faceapi.nets.ssdMobilenetv1);
        console.log('   - faceLandmark68Net available?', !!faceapi.nets.faceLandmark68Net);
        console.log('   - faceRecognitionNet available?', !!faceapi.nets.faceRecognitionNet);

        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        
        console.log('✅ All face-api.js models loaded successfully from /public/models');
        console.log('   Verifying models are ready:');
        console.log('   - ssdMobilenetv1.isLoaded:', faceapi.nets.ssdMobilenetv1.isLoaded);
        console.log('   - faceLandmark68Net.isLoaded:', faceapi.nets.faceLandmark68Net.isLoaded);
        console.log('   - faceRecognitionNet.isLoaded:', faceapi.nets.faceRecognitionNet.isLoaded);
        
        setModelsLoaded(true);
      } catch (err) {
        console.error('❌ Error loading face-api.js models:', err);
        console.error('   Error type:', err.name);
        console.error('   Error message:', err.message);
        console.error('   Error stack:', err.stack);
        setStatus('error');
        setMessage('Failed to load face recognition models. Please refresh the page.');
      }
    };

    loadModels();
  }, []);

  // Check face registration status on mount
  useEffect(() => {
    checkFaceStatus();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const checkFaceStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/face/status');
      setFaceRegistered(res.data.isRegistered);
      if (!res.data.isRegistered) {
        setMode('register');
      }
    } catch (err) {
      console.error('Error checking face status:', err);
      setFaceRegistered(false);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      setStatus(null);
      setMessage('');
      setCapturing(false);

      console.log('Starting camera initialization...');

      // Step 1: Set camera active FIRST to render the video element
      setCameraActive(true);
      console.log('Set cameraActive to true - waiting for DOM to update...');

      // Step 2: Wait for React to render the video element
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 3: Now request camera stream
      console.log('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      console.log('Camera stream obtained:', stream);

      // Step 4: Attach stream to video element (should exist now)
      let retries = 0;
      const maxRetries = 10;

      const attachStream = () => {
        console.log(`Attempt ${retries + 1} to attach stream...`);

        if (!videoRef?.current) {
          console.warn(`videoRef.current not available yet (attempt ${retries + 1}/${maxRetries})`);

          if (retries < maxRetries) {
            retries++;
            setTimeout(attachStream, 150);
            return;
          } else {
            console.error('Failed to attach stream after max retries');
            setStatus('error');
            setMessage('Camera element not ready. Please refresh the page and try again.');
            setCameraActive(false);
            stream.getTracks().forEach(track => track.stop());
            return;
          }
        }

        try {
          console.log('Attaching stream to video element...');
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          console.log('✓ Stream attached successfully');

          // Ensure video plays
          setTimeout(() => {
            if (videoRef?.current && videoRef.current.paused) {
              console.log('Starting video playback...');
              videoRef.current.play()
                .then(() => {
                  console.log('✓ Video playback started');
                })
                .catch(err => {
                  console.error('✗ Video play error:', err);
                  setStatus('error');
                  setMessage('Failed to start video playback.');
                });
            }
          }, 100);

        } catch (err) {
          console.error('Error attaching stream:', err);
          setStatus('error');
          setMessage('Failed to attach camera stream.');
          setCameraActive(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      attachStream();

    } catch (err) {
      console.error('Camera access error:', err);
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);

      setCameraActive(false);
      setStatus('error');

      // Provide specific error messages
      if (err.name === 'NotAllowedError') {
        setMessage('Camera permission denied. Please enable camera in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setMessage('No camera found on this device.');
      } else if (err.name === 'NotSupportedError') {
        setMessage('Camera not supported in this browser. Try Chrome, Firefox, or Edge.');
      } else if (err.name === 'SecurityError') {
        setMessage('HTTPS is required for camera access.');
      } else {
        setMessage('Unable to access camera: ' + err.message);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported on this device'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setLocation(loc);
          resolve(loc);
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  /**
 * Get high-accuracy user location from browser
 * Works in Chrome, Edge, Firefox, Mobile browsers
 * Must be called from user interaction (button click)
 */
// const getLocation = () => {
//   return new Promise((resolve, reject) => {
//     // ❌ Browser does not support geolocation
//     if (!navigator.geolocation) {
//       return reject({
//         code: 'NOT_SUPPORTED',
//         message: 'Geolocation is not supported by this browser'
//       });
//     }

//     navigator.geolocation.getCurrentPosition(
//       (position) => {
//         const coords = position.coords;

//         // ✅ Return structured data
//         resolve({
//           lat: coords.latitude,
//           lng: coords.longitude,
//           accuracy: Math.round(coords.accuracy), // meters
//           altitude: coords.altitude,
//           heading: coords.heading,
//           speed: coords.speed,
//           timestamp: position.timestamp
//         });
//       },
//       (error) => {
//         let message = 'Unable to retrieve location';

//         switch (error.code) {
//           case error.PERMISSION_DENIED:
//             message = 'Location permission denied';
//             break;
//           case error.POSITION_UNAVAILABLE:
//             message = 'Location unavailable';
//             break;
//           case error.TIMEOUT:
//             message = 'Location request timed out';
//             break;
//         }

//         reject({
//           code: error.code,
//           message
//         });
//       },
//       {
//         enableHighAccuracy: true, // 🔥 MOST IMPORTANT
//         timeout: 15000,           // wait for GPS fix
//         maximumAge: 0             // do not use cached location
//       }
//     );
//   });
// }
  const captureImage = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (canvas && video && video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.9);
    }
    return null;
  };

  const handleAttendance = async () => {
    if (!faceRegistered) {
      setStatus('error');
      setMessage('Please register your face first');
      return;
    }

    if (!modelsLoaded) {
      setStatus('error');
      setMessage('Face recognition models are still loading. Please wait...');
      return;
    }

    setCapturing(true);
    setStatus(null);
    setMessage('Processing attendance...');

    try {
      // Get location
      const loc = await getLocation();

      // Capture image
      const imageData = captureImage();
      if (!imageData) {
        throw new Error('Failed to capture image. Please ensure camera is working.');
      }
      console.log('Location obtained');
      // console.log('Location obtained:', loc);

      const videoEl = videoRef.current;
      if (!videoEl) {
        throw new Error('Video element not ready');
      }

      if (!videoEl.srcObject) {
        throw new Error('Camera is not active. Please start the camera first.');
      }

      // Wait for video to be fully ready
      if (videoEl.readyState < 2) {
        console.log('⏳ Waiting for video to be ready...');
        await new Promise((resolve) => {
          videoEl.onloadeddata = resolve;
          setTimeout(resolve, 2000); // Timeout after 2 seconds
        });
      }

      console.log('🔍 Detecting face...', {
        videoWidth: videoEl.videoWidth,
        videoHeight: videoEl.videoHeight,
        readyState: videoEl.readyState
      });

      // Use SsdMobilenetv1 detector - SAME as registration for consistency
      const detectionOptions = new faceapi.SsdMobilenetv1Options({
        inputSize: 416,  // Larger input size for better detection
        scoreThreshold: 0.3  // Lower threshold to detect faces more easily
      });

      const detection = await faceapi
        .detectSingleFace(videoEl, detectionOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error('No face detected. Please ensure your face is clearly visible in the camera and well-lit.');
      }

      console.log('✓ Face detected successfully');
      console.log('   🔍 Detection verification:');
      console.log('   - Detection object exists:', !!detection);
      console.log('   - Has descriptor:', !!detection.descriptor);
      console.log('   - Descriptor type:', detection.descriptor?.constructor?.name);
      console.log('   - Descriptor length:', detection.descriptor?.length);
      console.log('   - Detection score:', detection.detection?.score);

      // Get face embeddings (128-dimensional vector)
      const faceEmbedding = Array.from(detection.descriptor);

      console.log('📷 ATTENDANCE - Face embedding generated:');
      console.log('   Length:', faceEmbedding.length);
      console.log('   First 10 values:', faceEmbedding.slice(0, 10).map(v => parseFloat(v.toFixed(6))));
      console.log('   Last 10 values:', faceEmbedding.slice(118).map(v => parseFloat(v.toFixed(6))));
      console.log('   Sum:', faceEmbedding.reduce((a, b) => a + b, 0).toFixed(4));
      console.log('   Mean:', (faceEmbedding.reduce((a, b) => a + b, 0) / faceEmbedding.length).toFixed(4));

      // Validate embedding
      if (!Array.isArray(faceEmbedding) || faceEmbedding.length !== 128) {
        throw new Error(`Invalid embedding: expected 128 dimensions, got ${faceEmbedding?.length || 0}`);
      }

      const isValidEmbedding = faceEmbedding.every(val => typeof val === 'number' && !isNaN(val));
      if (!isValidEmbedding) {
        throw new Error('Invalid embedding: contains non-numeric values');
      }

      console.log('✅ Embedding validation passed, sending to backend');

      // Prepare request data with embeddings
      const requestData = {
        faceEmbedding: faceEmbedding,
        location: {
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          timestamp: new Date().toISOString()
        }
      };
      console.log('📤 Sending attendance verification request:', {
        faceEmbeddingLength: requestData.faceEmbedding.length,
        location: requestData.location
      });

      // Call face verify API
      const res = await api.post('/attendance/face/verify', requestData, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.data.success) {
        setStatus('success');
        setMessage(res.data.message);

        setTimeout(() => {
          stopCamera();
          setCapturing(false);
        }, 5000);
      }
    } catch (err) {
      console.error('Attendance error:', err);
      setStatus('error');
      // Show detailed error message if available
      let errorMessage = 'Failed to mark attendance';

      // Handle different error response structures
      if (err.response?.data?.details) {
        // If details is an object with a message property
        if (typeof err.response.data.details === 'object' && err.response.data.details.message) {
          errorMessage = err.response.data.details.message;
        }
        // If details is a string directly
        else if (typeof err.response.data.details === 'string') {
          errorMessage = err.response.data.details;
        }
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setMessage(errorMessage);
      setCapturing(false);
    }
  };

  // const handleRegistration = async () => {
  //   // Validate inputs
  //   if (!registrationName.trim()) {
  //     setStatus('error');
  //     setMessage('Please enter your full name');
  //     return;
  //   }

  //   if (!registrationId.trim()) {
  //     setStatus('error');
  //     setMessage('Please enter your employee ID');
  //     return;
  //   }

  //   if (!consentGiven) {
  //     setStatus('error');
  //     setMessage('Please accept the consent to proceed with face registration');
  //     return;
  //   }

  //   setCapturing(true);
  //   setStatus(null);
  //   setMessage('Registering your face...');

  //   try {
  //     // Capture image
  //     const imageData = captureImage();

  //     if (!imageData) {
  //       throw new Error('Failed to capture image. Please ensure camera is working.');
  //     }

  //     console.log('📸 Face image captured, size:', imageData.length, 'bytes');
  //     console.log('📤 Sending registration request with payload:', {
  //       faceImageData: imageData.substring(0, 100) + '...',
  //       registrationNotes: `Self registration - ${registrationName}`,
  //       consentGiven: true
  //     });

  //     // Call face register API
  //     const res = await api.post('/attendance/face/register', {
  //       faceImageData: imageData,
  //       headers: { 'Content-Type': 'application/json' },
  //       registrationNotes: `Self registration - ${registrationName}`,
  //       consentGiven: true
  //     });

  //     console.log('✅ Registration response:', res.data);

  //     if (res.data.success) {
  //       setStatus('success');
  //       setMessage('Face registered successfully! You can now mark attendance.');
  //       setFaceRegistered(true);
  //       setRegistrationName('');
  //       setRegistrationId('');
  //       setConsentGiven(false);

  //       setTimeout(() => {
  //         stopCamera();
  //         setCapturing(false);
  //         setMode('attendance');
  //       }, 3000);
  //     }
  //   } catch (err) {
  //     console.error('❌ Registration error:', err);
  //     console.error('Error response:', err.response?.data);
  //     setStatus('error');
  //     setMessage(err.response?.data?.message || err.message || 'Face registration failed');
  //     setCapturing(false);
  //   }
  // };

  const handleRegistration = async () => {
    // 1️⃣ Basic validation
    if (!registrationName.trim()) {
      setStatus('error');
      setMessage('Please enter your full name');
      return;
    }

    if (!registrationId.trim()) {
      setStatus('error');
      setMessage('Please enter your employee ID');
      return;
    }

    if (!consentGiven) {
      setStatus('error');
      setMessage('Please accept the consent to proceed with face registration');
      return;
    }

    // ✅ CHECK: Models must be loaded first
    if (!modelsLoaded) {
      setStatus('error');
      setMessage('Face recognition models are still loading. Please wait...');
      return;
    }

    setCapturing(true);
    setStatus(null);
    setMessage('Registering your face...');

    try {
      // 2️⃣ Detect face & generate embedding
      console.log('🔍 Detecting face with options...');
      const videoEl = videoRef.current;
      if (!videoEl) {
        throw new Error('Video element not ready');
      }

      if (!videoEl.srcObject) {
        throw new Error('Camera is not active. Please start the camera first.');
      }

      // Wait for video to be fully ready
      if (videoEl.readyState < 2) {
        console.log('⏳ Waiting for video to be ready...');
        await new Promise((resolve) => {
          videoEl.onloadeddata = resolve;
          setTimeout(resolve, 2000); // Timeout after 2 seconds
        });
      }

      console.log('🔍 Detecting face...', {
        videoWidth: videoEl.videoWidth,
        videoHeight: videoEl.videoHeight,
        readyState: videoEl.readyState
      });

      // Use more lenient detection options - SAME as attendance
      const detectionOptions = new faceapi.SsdMobilenetv1Options({
        inputSize: 416,  // Larger input size for better detection
        scoreThreshold: 0.3  // Lower threshold to detect faces more easily
      });

      const detection = await faceapi
        .detectSingleFace(videoEl, detectionOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error('No face detected. Please ensure your face is clearly visible in the camera and well-lit.');
      }

      console.log('✓ Face detected successfully');

      // 3️⃣ Convert descriptor to normal array
      const faceEmbedding = Array.from(detection.descriptor);

      console.log('🧠 REGISTRATION - Face embedding generated:');
      console.log('   Length:', faceEmbedding.length);
      console.log('   First 10 values:', faceEmbedding.slice(0, 10).map(v => parseFloat(v.toFixed(6))));
      console.log('   Last 10 values:', faceEmbedding.slice(118).map(v => parseFloat(v.toFixed(6))));
      console.log('   Sum:', faceEmbedding.reduce((a, b) => a + b, 0).toFixed(4));
      console.log('   Mean:', (faceEmbedding.reduce((a, b) => a + b, 0) / faceEmbedding.length).toFixed(4));

      // Validate embedding
      if (!Array.isArray(faceEmbedding) || faceEmbedding.length !== 128) {
        throw new Error(`Invalid embedding: expected 128 dimensions, got ${faceEmbedding.length}`);
      }

      const isValidEmbedding = faceEmbedding.every(val => typeof val === 'number' && !isNaN(val));
      if (!isValidEmbedding) {
        throw new Error('Invalid embedding: contains non-numeric values');
      }

      console.log('✅ Embedding validation passed');

      // 4️⃣ Call registration API (CORRECT axios usage)
      const res = await api.post(
        '/attendance/face/register',
        {
          employeeName: registrationName,
          faceEmbedding,
          registrationNotes: `Self registration - ${registrationName}`,
          consentGiven: true
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      console.log('✅ Registration response:', res.data);

      // 5️⃣ Success handling
      if (res.data?.success) {
        setStatus('success');
        setMessage('Face registered successfully! You can now mark attendance.');
        setFaceRegistered(true);

        setRegistrationName('');
        setRegistrationId('');
        setConsentGiven(false);

        setTimeout(() => {
          stopCamera();
          setCapturing(false);
          setMode('attendance');
        }, 3000);
      } else {
        throw new Error(res.data?.message || 'Face registration failed');
      }
    } catch (err) {
      console.error('❌ Registration error:', err);
      console.error('Error response:', err.response?.data);

      setStatus('error');
      setMessage(
        err.response?.data?.message ||
        err.message ||
        'Face registration failed'
      );
      setCapturing(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header section with glassmorphism */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full -mr-20 -mt-20"></div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                <Shield size={20} />
              </div>
              <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter uppercase italic">Biometric Portal</h2>
            </div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] ml-11">Advanced Pulse Identity Verification</p>
          </div>

          <div className="inline-flex bg-slate-50 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
            {faceRegistered && (
              <button
                onClick={() => { setMode('attendance'); setStatus(null); setMessage(''); }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${mode === 'attendance'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
              >
                <CheckCircle size={14} />
                Deploy
              </button>
            )}
            <button
              onClick={() => { setMode('register'); setStatus(null); setMessage(''); }}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${mode === 'register'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
            >
              <UserPlus size={14} />
              {faceRegistered ? 'Re-Sync' : 'Enroll'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Hardware Interface */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-2xl relative">
            <div className="relative aspect-video bg-slate-100 dark:bg-black rounded-3xl overflow-hidden border-4 border-slate-200/50 dark:border-slate-800/50 group/vid">
              {!cameraActive ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-slate-200/50 dark:bg-slate-800/50 flex items-center justify-center mb-4 animate-pulse">
                    <Camera size={40} className="text-slate-400" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hardware Station Offline</p>
                </div>
              ) : (
                <div className="absolute inset-0">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  {/* Scanner HUD Overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-8 left-8 w-12 h-12 border-t-4 border-l-4 border-indigo-500 rounded-tl-2xl"></div>
                    <div className="absolute top-8 right-8 w-12 h-12 border-t-4 border-r-4 border-indigo-500 rounded-tr-2xl"></div>
                    <div className="absolute bottom-8 left-8 w-12 h-12 border-b-4 border-l-4 border-indigo-500 rounded-bl-2xl"></div>
                    <div className="absolute bottom-8 right-8 w-12 h-12 border-b-4 border-r-4 border-indigo-500 rounded-br-2xl"></div>

                    {/* Scanning Line */}
                    {capturing && (
                      <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
                    )}

                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.2)_100%)]"></div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[8px] font-black text-white uppercase tracking-widest">Feed Active: 1080p_FHD</span>
                    </div>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              {!cameraActive ? (
                <button
                  onClick={startCamera}
                  className="col-span-2 group relative overflow-hidden bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl text-[10px] uppercase tracking-[0.3em] transition-all duration-500 shadow-xl shadow-indigo-600/30"
                >
                  <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                  Initialize Hardware
                </button>
              ) : (
                <>
                  <button
                    onClick={mode === 'attendance' ? handleAttendance : handleRegistration}
                    disabled={capturing}
                    className={`relative overflow-hidden group font-black py-5 rounded-2xl text-[10px] uppercase tracking-[0.3em] transition-all duration-500 disabled:opacity-50 ${capturing ? 'bg-slate-100 text-slate-400 dark:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20'
                      }`}
                  >
                    {capturing ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"></div>
                        Processing
                      </div>
                    ) : (
                      'Capture Token'
                    )}
                  </button>
                  <button
                    onClick={stopCamera}
                    disabled={capturing}
                    className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black py-5 rounded-2xl text-[10px] uppercase tracking-[0.3em] transition-all"
                  >
                    Sleep System
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-2xl">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Smartphone size={12} className="text-indigo-500" />
              Operational Protocol
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: 'Frame Alignment', desc: 'Secure facial features within the scanning HUD' },
                { title: 'Luminescence', desc: 'Ensure ambient light supports biometric capture' },
                { title: 'Geo-Verification', desc: 'Active GPS needed for deployment clearance' },
                { title: 'Single Instance', desc: 'Only one operator allowed per session' }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center text-[10px] font-black font-mono">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest leading-none mb-1.5">{item.title}</p>
                    <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-tight">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side Panel */}
        <div className="lg:col-span-2 space-y-6">

          {/* Form Section */}
          {mode === 'register' && (
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-2xl animate-in slide-in-from-right-4 duration-500">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Credential Enrollment</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Full Legal Name</label>
                  <input
                    type="text"
                    value={registrationName}
                    onChange={(e) => setRegistrationName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3.5 text-xs font-bold text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    placeholder="E.g. JASON BOURNE"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Operator ID</label>
                  <input
                    type="text"
                    value={registrationId}
                    onChange={(e) => setRegistrationId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3.5 text-xs font-bold text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    placeholder="EMP-XXXX"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Alert Display */}
          {status && (
            <div className={`p-6 rounded-[2rem] border-2 shadow-2xl animate-in zoom-in-95 duration-300 ${status === 'success'
              ? 'bg-emerald-50/80 border-emerald-500/30 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-500/20 dark:text-emerald-400'
              : 'bg-rose-50/80 border-rose-500/30 text-rose-800 dark:bg-rose-900/20 dark:border-rose-500/20 dark:text-rose-400'
              }`}>
              <div className="flex gap-4">
                <div className={`p-2 rounded-xl h-fit ${status === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                  {status === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                </div>
                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-widest mb-1">{status === 'success' ? 'Authorized' : 'Session Terminated'}</h5>
                  <p className="text-xs font-bold tracking-tight uppercase leading-relaxed">{message}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
          @keyframes scan {
            0% { transform: translateY(0); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translateY(320px); opacity: 0; }
          }
       `}</style>
    </div>
  );
};

export default FaceAttendance;
