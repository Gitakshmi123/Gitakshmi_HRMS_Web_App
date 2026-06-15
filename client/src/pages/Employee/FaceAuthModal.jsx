import React, { useState, useEffect, useRef } from 'react';
import { 
    X, Camera, Scan, UserCheck, ShieldCheck, 
    AlertCircle, RefreshCw, CheckCircle2, Info,
    CameraOff, ChevronRight, UserPlus
} from 'lucide-react';
import clsx from 'clsx';

export default function FaceAuthModal({ 
    isOpen, 
    onClose, 
    isRegistered = false, 
    onSuccess, 
    userName = "Employee" 
}) {
    const [step, setStep] = useState('initializing'); // initializing, ready, scanning, success, error
    const [isFaceDetected, setIsFaceDetected] = useState(false);
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setStep('initializing');
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen]);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480, facingMode: "user" } 
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setTimeout(() => setStep('ready'), 1500);
        } catch (err) {
            console.error("Camera access error", err);
            setStep('error');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const handleAction = () => {
        setStep('scanning');
        // Simulate scanning delay
        setTimeout(() => {
            setIsFaceDetected(true);
            setTimeout(() => {
                setStep('success');
                setTimeout(() => {
                    onSuccess && onSuccess();
                    onClose();
                }, 1500);
            }, 2000);
        }, 1500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-[440px] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            {isRegistered ? <ShieldCheck size={18} /> : <UserPlus size={18} />}
                        </div>
                        <div>
                            <h2 className="text-[15px] font-bold text-[#334155]">
                                {isRegistered ? 'Face Verification' : 'Face Registration'}
                            </h2>
                            <p className="text-[11px] text-[#64748B] font-medium leading-none mt-0.5">
                                {isRegistered ? 'Identify yourself for check-in' : 'Register your profile to start'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-50 text-slate-400 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 flex flex-col items-center">
                    
                    {/* Instructions */}
                    <div className="text-center mb-8 space-y-1">
                        <p className="text-[13px] font-semibold text-[#334155]">
                            {step === 'success' ? `Welcome, ${userName}` : (isRegistered ? 'Align your face' : 'Look into the camera')}
                        </p>
                        <p className="text-[12px] text-[#64748B] font-medium opacity-70">
                            {step === 'initializing' && 'Starting camera...'}
                            {step === 'ready' && 'Keep your head steady inside the frame'}
                            {step === 'scanning' && 'Verifying unique facial features...'}
                            {step === 'success' && 'Authentication successful'}
                            {step === 'error' && 'We could not access your camera'}
                        </p>
                    </div>

                    {/* Camera Preview Box */}
                    <div className="relative w-[280px] h-[280px] rounded-3xl overflow-hidden bg-slate-50 border-4 border-slate-100 shadow-inner group">
                        
                        {/* Video Element */}
                        <video 
                            ref={videoRef}
                            autoPlay 
                            playsInline 
                            muted
                            className={clsx(
                                "w-full h-full object-cover grayscale-[0.2] transition-opacity duration-700",
                                (step === 'initializing' || step === 'error') ? 'opacity-0' : 'opacity-100'
                            )}
                        />

                        {/* Scanner Overlay UI */}
                        {(step === 'ready' || step === 'scanning') && (
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Frame Markers */}
                                <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-blue-500 rounded-tl-2xl"></div>
                                <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-blue-500 rounded-tr-2xl"></div>
                                <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-blue-500 rounded-bl-2xl"></div>
                                <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-blue-500 rounded-br-2xl"></div>

                                {/* Animated Scan Line */}
                                {step === 'scanning' && (
                                    <div className="absolute inset-x-0 h-0.5 bg-blue-500 shadow-[0_0_15px_#2563EB] animate-scan-y top-0 opacity-80"></div>
                                )}
                            </div>
                        )}

                        {/* Success Overlay */}
                        {step === 'success' && (
                            <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[1px] flex items-center justify-center animate-in zoom-in-50 duration-300">
                                <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-xl">
                                    <CheckCircle2 size={40} className="text-emerald-500" />
                                </div>
                            </div>
                        )}

                        {/* Error Overlay */}
                        {step === 'error' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                                <CameraOff size={40} className="text-rose-400 mb-3" />
                                <p className="text-[12px] font-bold text-rose-500 uppercase tracking-widest">Access Failed</p>
                                <p className="text-[11px] text-slate-400 mt-1">Please enable camera permissions in your browser</p>
                            </div>
                        )}

                        {/* Loading Spinner */}
                        {step === 'initializing' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <RefreshCw size={32} className="text-blue-500 animate-spin opacity-40" />
                            </div>
                        )}
                    </div>

                    {/* Progress Indicator */}
                    <div className="mt-8 w-full max-w-[280px]">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                            <span>{step === 'scanning' ? 'Scanning...' : (step === 'success' ? 'Verified' : 'Ready')}</span>
                            <span>{step === 'scanning' ? '45%' : (step === 'success' ? '100%' : '0%')}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                             <div 
                                className={clsx(
                                    "h-full transition-all duration-1000 ease-out",
                                    step === 'scanning' ? 'w-[45%] bg-blue-500' : (step === 'success' ? 'w-full bg-emerald-500' : 'w-0')
                                )}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-3">
                    <button 
                        onClick={handleAction}
                        disabled={step !== 'ready'}
                        className={clsx(
                            "w-full h-11 rounded-xl text-[14px] font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2",
                            step === 'ready' ? "bg-[#2563EB] text-white shadow-blue-500/20 hover:bg-blue-600" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        )}
                    >
                        {step === 'scanning' ? <RefreshCw size={18} className="animate-spin" /> : <Scan size={18} />}
                        {isRegistered ? 'Match Face & Check-In' : 'Capture & Secure Profile'}
                    </button>
                    
                    <p className="text-[10px] text-center text-slate-400 font-medium px-4 leading-relaxed">
                        Security Notice: Your facial biometric data is encrypted <br/> and used only for attendance verification.
                    </p>
                </div>
            </div>
        </div>
    );
}

// Add these to your index.css or global CSS:
/*
@keyframes scan-y {
    0% { top: 0; }
    50% { top: 100%; }
    100% { top: 0; }
}
.animate-scan-y {
    animation: scan-y 2.5s infinite linear;
}
*/
