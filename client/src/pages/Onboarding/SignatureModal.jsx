import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Check, FileText } from 'lucide-react';

function SignatureModal({ isOpen, onSave, onClose, pdfUrl, candidateName, saving = false, isJoiningLetter = false }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [step, setStep] = useState(1);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [signatureImage, setSignatureImage] = useState(null);
    const [applyToAllPages, setApplyToAllPages] = useState(isJoiningLetter);
    const [signatureType, setSignatureType] = useState('draw');
    const [typedSignature, setTypedSignature] = useState(candidateName || '');
    
    const signatureFonts = [
        { name: 'Cursive', value: '"Caveat", "Dancing Script", "Pacifico", "Brush Script MT", cursive', italic: true, weight: 'normal' },
        { name: 'Simple Text', value: 'system-ui, -apple-system, sans-serif', italic: false, weight: '600' },
        { name: 'Serif', value: 'Georgia, serif', italic: true, weight: 'bold' },
        { name: 'Monospace', value: '"Courier New", Courier, monospace', italic: false, weight: 'bold' }
    ];
    const [selectedFont, setSelectedFont] = useState(signatureFonts[0]);
    
    const [additionalText, setAdditionalText] = useState('');

    // Move early return AFTER all hooks to follow Rules of Hooks

    const [position, setPosition] = useState({ x: 50, y: 75 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const docContainerRef = useRef(null);

    useEffect(() => {
        if (step === 1 && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    }, [step, isOpen]);

    useEffect(() => {
        const handleGlobalMouseMove = (e) => {
            if (!isDragging || !docContainerRef.current) return;
            
            const container = docContainerRef.current;
            const rect = container.getBoundingClientRect();
            
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            
            if (clientX === undefined || clientY === undefined) return;

            // Calculate relative position as percentage
            let x = ((clientX - rect.left - dragOffset.x) / rect.width) * 100;
            let y = ((clientY - rect.top - dragOffset.y) / rect.height) * 100;
            
            // Constrain to container
            x = Math.max(0, Math.min(x, 90)); // Leave room for box width
            y = Math.max(0, Math.min(y, 90)); // Leave room for box height
            
            setPosition({ x, y });
        };

        const handleGlobalMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
            window.addEventListener('touchmove', handleGlobalMouseMove);
            window.addEventListener('touchend', handleGlobalMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            window.removeEventListener('touchmove', handleGlobalMouseMove);
            window.removeEventListener('touchend', handleGlobalMouseUp);
        };
    }, [isDragging, dragOffset]);

    if (!isOpen) return null;

    const handleStartDrag = (e) => {
        e.preventDefault();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        const rect = e.currentTarget.getBoundingClientRect();
        setDragOffset({
            x: clientX - rect.left,
            y: clientY - rect.top
        });
        setIsDragging(true);
    };

    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const ctx = canvas.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasDrawn(true);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const saveDrawing = () => {
        if (!hasDrawn) return;
        const canvas = canvasRef.current;
        setSignatureImage(canvas.toDataURL());
        setStep(2);
    };

    const generateTypedSignature = () => {
        if (!typedSignature.trim()) return;
        const canvas = document.createElement('canvas');
        canvas.width = 500;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');
        ctx.font = `${selectedFont.italic ? 'italic ' : ''}${selectedFont.weight || 'normal'} 50px ${selectedFont.value}`;
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(typedSignature, canvas.width / 2, canvas.height / 2);
        setSignatureImage(canvas.toDataURL());
        setStep(2);
    };


    const handleFinalSave = async () => {
        let finalImage = signatureImage;
        if (additionalText.trim()) {
            finalImage = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(img.width, 400);
                    canvas.height = img.height + 40;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, (canvas.width - img.width) / 2, 0);
                    ctx.font = '20px sans-serif';
                    ctx.fillStyle = '#000000';
                    ctx.textAlign = 'center';
                    ctx.fillText(additionalText, canvas.width / 2, img.height + 25);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.src = signatureImage;
            });
        }

        onSave({
            signatureImage: finalImage,
            applyToAll: applyToAllPages,
            timestamp: true,
            signaturePosition: {
                x: position.x,
                y: position.y,
                applyToAllPages
            }
        });
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 lg:p-10 bg-slate-900/95 backdrop-blur-md animate-in fade-in duration-300">
            <div className={`bg-white rounded-[2.5rem] shadow-2xl transition-all duration-500 overflow-hidden border border-white/10
                ${step === 1 ? 'w-full max-w-xl' : 'w-full max-w-5xl h-[90vh]'}`}>

                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white relative z-20">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                            {step === 1 ? 'Draw Signature' : 'Review Signature'}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                            {step === 1 ? 'Use your mouse or touch to draw' : 'Drag signature to your desired position'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-full hover:bg-slate-100 transition-all">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                <div className="relative overflow-y-auto" style={{ height: step === 1 ? 'auto' : 'calc(90vh - 160px)' }}>
                    {step === 1 ? (
                        <div className="p-8">
                            <div className="flex border-b border-slate-200 mb-6">
                                <button 
                                    onClick={() => setSignatureType('draw')}
                                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-colors ${signatureType === 'draw' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Draw Signature
                                </button>
                                <button 
                                    onClick={() => setSignatureType('type')}
                                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-colors ${signatureType === 'type' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Type Signature
                                </button>
                            </div>

                            {signatureType === 'draw' ? (
                                <>
                                    <div className="relative bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-2 overflow-hidden shadow-inner group">
                                        <canvas
                                            ref={canvasRef}
                                            width={500}
                                            height={250}
                                            className="w-full bg-white rounded-xl cursor-crosshair touch-none"
                                            onMouseDown={startDrawing}
                                            onMouseMove={draw}
                                            onMouseUp={stopDrawing}
                                            onMouseOut={stopDrawing}
                                            onTouchStart={startDrawing}
                                            onTouchMove={draw}
                                            onTouchEnd={stopDrawing}
                                        />
                                        {!hasDrawn && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-30">
                                                <Check size={48} className="text-slate-300 mb-2" />
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sign Here</p>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center gap-4 mt-8">
                                        <button
                                            onClick={clearCanvas}
                                            className="flex-1 h-14 rounded-xl border border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                                        >
                                            Clear
                                        </button>
                                        <button
                                            onClick={saveDrawing}
                                            disabled={!hasDrawn}
                                            className="flex-[2] h-14 rounded-xl bg-blue-600 text-white font-bold text-[11px] uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-200"
                                        >
                                            Confirm Signature
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="relative bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-inner group">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Select Font Style</label>
                                        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                            {signatureFonts.map((f, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setSelectedFont(f)}
                                                    className={`px-4 py-2 rounded-xl text-xs whitespace-nowrap transition-all ${selectedFont.name === f.name ? 'bg-blue-100 text-blue-700 border-2 border-blue-500 font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium'}`}
                                                >
                                                    {f.name}
                                                </button>
                                            ))}
                                        </div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Enter Your Name</label>
                                        <input
                                            type="text"
                                            value={typedSignature}
                                            onChange={(e) => setTypedSignature(e.target.value)}
                                            placeholder="John Doe"
                                            className="w-full h-14 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-xl text-slate-800"
                                            style={{ 
                                                fontFamily: selectedFont.value, 
                                                fontStyle: selectedFont.italic ? 'italic' : 'normal',
                                                fontWeight: selectedFont.weight || 'normal'
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center gap-4 mt-8">
                                        <button
                                            onClick={generateTypedSignature}
                                            disabled={!typedSignature.trim()}
                                            className="w-full h-14 rounded-xl bg-blue-600 text-white font-bold text-[11px] uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-200"
                                        >
                                            Confirm Typed Signature
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="p-0 h-full flex flex-col lg:flex-row bg-slate-50">
                            <div className="flex-1 relative bg-white border-r border-slate-100 overflow-hidden" ref={docContainerRef}>
                                <iframe src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`} className="w-full h-full border-0" />
                                
                                <div 
                                    className={`absolute z-30 cursor-move p-3 bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-blue-200 flex flex-col items-center group transition-shadow ${isDragging ? 'shadow-blue-200 scale-105 z-50' : 'hover:border-blue-400'}`}
                                    style={{ 
                                        left: `${position.x}%`, 
                                        top: `${position.y}%`,
                                        touchAction: 'none'
                                    }}
                                    onMouseDown={handleStartDrag}
                                    onTouchStart={handleStartDrag}
                                >
                                    <div className="absolute -top-6 bg-blue-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                        Drag to Position
                                    </div>
                                    <img src={signatureImage} alt="Signature" className="h-12 w-auto mb-1 mix-blend-multiply pointer-events-none" />
                                    {additionalText && (
                                        <p className="text-[10px] text-slate-800 font-medium pointer-events-none pb-1">{additionalText}</p>
                                    )}
                                    <p className="text-[8px] font-bold text-blue-600 uppercase tracking-widest pointer-events-none">Placement</p>
                                </div>

                                {/* Helper Overlay to catch mouse events when dragging over iframe */}
                                {isDragging && <div className="absolute inset-0 z-40 cursor-move" />}
                            </div>
                            
                            <div className="w-full lg:w-80 p-8 flex flex-col justify-between bg-white">
                                <div className="space-y-6">
                                    <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="p-2 bg-blue-600 rounded-lg text-white">
                                                <FileText size={16} />
                                            </div>
                                            <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Digital Placement</span>
                                        </div>
                                        <p className="text-[10px] text-blue-900/60 leading-relaxed font-medium">
                                            Drag the signature box on the left to place it exactly where you want it to appear on the {isJoiningLetter ? 'Joining' : 'Offer'} Letter.
                                        </p>
                                    </div>

                                    {isJoiningLetter && (
                                        <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                                            <input
                                                type="checkbox"
                                                checked={applyToAllPages}
                                                onChange={e => setApplyToAllPages(e.target.checked)}
                                                className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-bold text-slate-700">Apply to all pages</span>
                                                <span className="text-[9px] text-slate-400 font-medium">Add signature to every page at this position</span>
                                            </div>
                                        </label>
                                    )}

                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            <span>Candidate</span>
                                            <span className="text-slate-800">{candidateName}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            <span>Date</span>
                                            <span className="text-slate-800">{new Date().toLocaleDateString()}</span>
                                        </div>
                                        <div className="pt-3 border-t border-slate-100">
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Add Extra Text</label>
                                            <input
                                                type="text"
                                                placeholder="e.g., Job Title, Location"
                                                value={additionalText}
                                                onChange={e => setAdditionalText(e.target.value)}
                                                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-300 font-medium"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-6 border-t border-slate-100">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="w-full h-12 rounded-xl border border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50"
                                    >
                                        Back to Draw
                                    </button>
                                    <button
                                        onClick={handleFinalSave}
                                        disabled={saving}
                                        className="w-full h-16 rounded-2xl bg-slate-900 text-white font-black text-[12px] uppercase tracking-[3px] hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
                                    >
                                        {saving ? 'Signing...' : 'Sign & Complete'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-8 py-5 bg-slate-900 flex items-center justify-between border-t border-white/5">
                    <p className="text-[9px] text-slate-500 font-medium">
                        Secure Digital Encrypted Signature System v2.0
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Legally Binding</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SignatureModal;
