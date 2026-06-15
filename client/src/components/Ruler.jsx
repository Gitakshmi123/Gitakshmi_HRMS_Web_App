/**
 * WordPad-like Ruler Component
 * Features:
 * - Draggable left indent marker
 * - Draggable first line indent marker
 * - Draggable right indent marker
 * - Clickable tab stops
 * - Visual measurements
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

const Ruler = ({ editor, containerWidth = 210 }) => {
    const rulerRef = useRef(null);
    const [rulerWidth, setRulerWidth] = useState(794); // Default: 210mm ≈ 794px
    const [leftIndent, setLeftIndent] = useState(20); // mm (left margin)
    const [rightIndent, setRightIndent] = useState(15); // mm (right margin)
    const [firstLineIndent, setFirstLineIndent] = useState(0); // mm (relative to left indent)
    const [isDragging, setIsDragging] = useState(null); // 'left', 'right', 'firstLine', or null
    const [dragStart, setDragStart] = useState(0);
    const [tabStops, setTabStops] = useState([]); // Array of positions in mm

    // Convert mm to percentage
    const mmToPercent = (mm) => (mm / containerWidth) * 100;
    const _percentToMm = (percent) => (percent / 100) * containerWidth;

    // Update ruler width when container resizes
    useEffect(() => {
        const updateWidth = () => {
            if (rulerRef.current) {
                const parent = rulerRef.current.parentElement;
                if (parent) {
                    const width = parent.offsetWidth;
                    if (width > 0) {
                        setRulerWidth(width);
                    }
                }
            }
        };

        updateWidth();
        const resizeObserver = new ResizeObserver(updateWidth);
        if (rulerRef.current?.parentElement) {
            resizeObserver.observe(rulerRef.current.parentElement);
        }

        window.addEventListener('resize', updateWidth);
        setTimeout(updateWidth, 100);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateWidth);
        };
    }, []);

    // Handle mouse down on indent markers
    const handleMouseDown = useCallback((type, e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(type);
        setDragStart(e.clientX);
    }, []);

    // Handle mouse move for dragging
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e) => {
            if (!rulerRef.current) return;

            const _rulerRect = rulerRef.current.getBoundingClientRect();
            const deltaX = e.clientX - dragStart;
            const deltaMm = (deltaX / rulerWidth) * containerWidth;

            if (isDragging === 'left') {
                const newLeft = Math.max(0, Math.min(containerWidth - rightIndent - 10, leftIndent + deltaMm));
                setLeftIndent(newLeft);
                // Apply in real-time
                if (editor) {
                    editor.chain().focus().setIndentLeft(newLeft).run();
                }
            } else if (isDragging === 'right') {
                const newRight = Math.max(10, Math.min(containerWidth - leftIndent - 10, rightIndent - deltaMm));
                setRightIndent(newRight);
                // Apply in real-time
                if (editor) {
                    editor.chain().focus().setIndentRight(newRight).run();
                }
            } else if (isDragging === 'firstLine') {
                const newFirstLine = Math.max(-leftIndent, Math.min(containerWidth - leftIndent, firstLineIndent + deltaMm));
                setFirstLineIndent(newFirstLine);
                // Apply in real-time
                if (editor) {
                    editor.chain().focus().setIndentFirstLine(newFirstLine).run();
                }
            }

            setDragStart(e.clientX);
        };

        const handleMouseUp = () => {
            setIsDragging(null);
            // Indentation already applied in real-time during drag
            // Just ensure editor maintains focus
            if (editor) {
                editor.chain().focus().run();
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart, leftIndent, rightIndent, firstLineIndent, rulerWidth, containerWidth, editor]);

    // Handle clicking on ruler to set tab stop
    const handleRulerClick = useCallback((e) => {
        if (isDragging) return; // Don't set tab if dragging
        
        if (rulerRef.current) {
            const rulerRect = rulerRef.current.getBoundingClientRect();
            const clickX = e.clientX - rulerRect.left;
            const clickMm = (clickX / rulerWidth) * containerWidth;
            
            // Only set tab if clicked in the editable area (between margins)
            if (clickMm >= leftIndent && clickMm <= (containerWidth - rightIndent)) {
                // Toggle tab stop (remove if exists, add if not)
                setTabStops(prev => {
                    const existing = prev.find(t => Math.abs(t - clickMm) < 2);
                    if (existing) {
                        return prev.filter(t => t !== existing);
                    } else {
                        return [...prev, clickMm].sort((a, b) => a - b);
                    }
                });
            }
        }
    }, [isDragging, rulerWidth, containerWidth, leftIndent, rightIndent]);

    // Generate ruler marks
    const generateMarks = () => {
        const marks = [];
        for (let i = 0; i <= containerWidth; i += 5) {
            const isMajor = i % 10 === 0;
            marks.push({ position: i, value: i, isMajor });
        }
        return marks;
    };

    const marks = generateMarks();

    return (
        <div 
            ref={rulerRef}
            className="ruler-container"
            onClick={handleRulerClick}
            style={{
                width: '100%',
                height: '32px',
                backgroundColor: '#f0f0f0',
                borderBottom: '2px solid #ccc',
                position: 'relative',
                marginBottom: '0',
                userSelect: 'none',
                cursor: 'default',
                boxSizing: 'border-box'
            }}
        >
            {/* Background */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(to bottom, #ffffff 0%, #f0f0f0 50%, #e8e8e8 100%)',
                    borderBottom: '1px solid #bbb'
                }}
            />

            {/* Ruler marks */}
            {marks.map((mark, index) => {
                const positionPercent = mmToPercent(mark.position);
                return (
                    <div
                        key={index}
                        style={{
                            position: 'absolute',
                            left: `${positionPercent}%`,
                            bottom: 0,
                            width: '1px',
                            height: mark.isMajor ? '16px' : '8px',
                            backgroundColor: mark.isMajor ? '#333' : '#666',
                            zIndex: 1
                        }}
                    >
                        {mark.isMajor && mark.value > 0 && (
                            <span
                                style={{
                                    position: 'absolute',
                                    top: '-18px',
                                    left: '1px',
                                    fontSize: '10px',
                                    color: '#000',
                                    fontWeight: '600',
                                    fontFamily: 'Arial, sans-serif',
                                    lineHeight: '1',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {mark.value}
                            </span>
                        )}
                    </div>
                );
            })}

            {/* Left margin area (grayed out) */}
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${mmToPercent(leftIndent)}%`,
                    backgroundColor: '#d0d0d0',
                    opacity: 0.3,
                    zIndex: 0
                }}
            />

            {/* Right margin area (grayed out) */}
            <div
                style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: `${mmToPercent(rightIndent)}%`,
                    backgroundColor: '#d0d0d0',
                    opacity: 0.3,
                    zIndex: 0
                }}
            />

            {/* Left Indent Marker (bottom triangle) */}
            <div
                onMouseDown={(e) => handleMouseDown('left', e)}
                style={{
                    position: 'absolute',
                    left: `${mmToPercent(leftIndent)}%`,
                    bottom: 0,
                    width: '0',
                    height: '20px',
                    borderLeft: '2px solid #0066cc',
                    cursor: 'ew-resize',
                    zIndex: 20
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '-5px',
                        width: '0',
                        height: '0',
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderBottom: '8px solid #0066cc',
                        cursor: 'ew-resize'
                    }}
                />
            </div>

            {/* First Line Indent Marker (top triangle) */}
            <div
                onMouseDown={(e) => handleMouseDown('firstLine', e)}
                style={{
                    position: 'absolute',
                    left: `${mmToPercent(leftIndent + firstLineIndent)}%`,
                    bottom: 0,
                    width: '0',
                    height: '15px',
                    borderLeft: '2px solid #00cc66',
                    cursor: 'ew-resize',
                    zIndex: 21
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        bottom: '15px',
                        left: '-5px',
                        width: '0',
                        height: '0',
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: '8px solid #00cc66',
                        cursor: 'ew-resize'
                    }}
                />
            </div>

            {/* Right Indent Marker (top triangle) */}
            <div
                onMouseDown={(e) => handleMouseDown('right', e)}
                style={{
                    position: 'absolute',
                    right: `${mmToPercent(rightIndent)}%`,
                    bottom: 0,
                    width: '0',
                    height: '20px',
                    borderRight: '2px solid #cc6600',
                    cursor: 'ew-resize',
                    zIndex: 20
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        bottom: '20px',
                        right: '-5px',
                        width: '0',
                        height: '0',
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderBottom: '8px solid #cc6600',
                        cursor: 'ew-resize'
                    }}
                />
            </div>

            {/* Tab Stops */}
            {tabStops.map((tabPos, index) => (
                <div
                    key={index}
                    onClick={(e) => {
                        e.stopPropagation();
                        setTabStops(prev => prev.filter((_, i) => i !== index));
                    }}
                    style={{
                        position: 'absolute',
                        left: `${mmToPercent(tabPos)}%`,
                        bottom: '2px',
                        width: '1px',
                        height: '12px',
                        backgroundColor: '#000',
                        cursor: 'pointer',
                        zIndex: 15
                    }}
                    title="Click to remove tab stop"
                >
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '12px',
                            left: '-3px',
                            width: '0',
                            height: '0',
                            borderLeft: '3px solid transparent',
                            borderRight: '3px solid transparent',
                            borderBottom: '6px solid #000'
                        }}
                    />
                </div>
            ))}

            {/* Zero mark */}
            <div
                style={{
                    position: 'absolute',
                    left: '0',
                    bottom: 0,
                    width: '2px',
                    height: '18px',
                    backgroundColor: '#000',
                    zIndex: 10
                }}
            />
        </div>
    );
};

export default Ruler;
