/**
 * Vertical Ruler Component - WordPad-like vertical ruler with measurements and vertical indentation
 * Shows measurements along the height of the page and allows vertical spacing control
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

const VerticalRuler = ({ editor, containerHeight = 297 }) => {
    const rulerRef = useRef(null);
    const [rulerHeight, setRulerHeight] = useState(1123); // Default: 297mm ≈ 1123px
    const [topMargin, setTopMargin] = useState(20); // mm
    const [bottomMargin, setBottomMargin] = useState(20); // mm
    const [isDragging, setIsDragging] = useState(null); // 'top' or 'bottom'
    const [dragStart, setDragStart] = useState(0);

    // Update ruler height when container resizes
    useEffect(() => {
        const updateHeight = () => {
            if (rulerRef.current) {
                const parent = rulerRef.current.parentElement;
                if (parent) {
                    const height = parent.offsetHeight;
                    if (height > 0) {
                        setRulerHeight(height);
                    }
                }
            }
        };

        updateHeight();
        const resizeObserver = new ResizeObserver(updateHeight);
        if (rulerRef.current?.parentElement) {
            resizeObserver.observe(rulerRef.current.parentElement);
        }

        window.addEventListener('resize', updateHeight);
        setTimeout(updateHeight, 100);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateHeight);
        };
    }, []);

    // Handle mouse down on margin markers
    const handleMouseDown = useCallback((type, e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(type);
        setDragStart(e.clientY);
    }, []);

    // Handle mouse move for dragging margins
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e) => {
            if (!rulerRef.current) return;

            const deltaY = e.clientY - dragStart;
            const deltaMm = (deltaY / rulerHeight) * containerHeight;

            if (isDragging === 'top') {
                const newTop = Math.max(0, Math.min(containerHeight - bottomMargin - 10, topMargin + deltaMm));
                setTopMargin(newTop);
                // Apply to editor
                if (editor) {
                    // Apply top margin to first paragraph or body
                    editor.chain().focus().setMarginTop(newTop).run();
                }
            } else if (isDragging === 'bottom') {
                const newBottom = Math.max(10, Math.min(containerHeight - topMargin - 10, bottomMargin - deltaMm));
                setBottomMargin(newBottom);
                // Apply to editor
                if (editor) {
                    editor.chain().focus().setMarginBottom(newBottom).run();
                }
            }

            setDragStart(e.clientY);
        };

        const handleMouseUp = () => {
            setIsDragging(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart, topMargin, bottomMargin, rulerHeight, containerHeight, editor]);

    // Generate ruler marks (in mm)
    const generateMarks = () => {
        const marks = [];
        const step = 5; // 5mm steps for minor marks
        const majorStep = 10; // 10mm steps for major marks with numbers
        
        for (let i = 0; i <= containerHeight; i += step) {
            const isMajor = i % majorStep === 0;
            marks.push({
                position: i,
                value: i,
                isMajor
            });
        }

        return marks;
    };

    const marks = generateMarks();

    // Convert mm to percentage
    const mmToPercent = (mm) => (mm / containerHeight) * 100;

    return (
        <div 
            ref={rulerRef}
            className="vertical-ruler-container"
            style={{
                width: '28px',
                height: '100%',
                backgroundColor: '#f0f0f0',
                borderRight: '2px solid #ccc',
                position: 'relative',
                userSelect: 'none',
                cursor: 'default',
                boxSizing: 'border-box',
                flexShrink: 0
            }}
        >
            {/* Background gradient */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(to right, #ffffff 0%, #f0f0f0 50%, #e8e8e8 100%)',
                    borderRight: '1px solid #bbb'
                }}
            />

            {/* Top margin area (grayed out) */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${mmToPercent(topMargin)}%`,
                    backgroundColor: '#d0d0d0',
                    opacity: 0.3,
                    zIndex: 0
                }}
            />

            {/* Bottom margin area (grayed out) */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${mmToPercent(bottomMargin)}%`,
                    backgroundColor: '#d0d0d0',
                    opacity: 0.3,
                    zIndex: 0
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
                            top: `${positionPercent}%`,
                            left: 0,
                            height: '1px',
                            width: mark.isMajor ? '14px' : '8px',
                            backgroundColor: mark.isMajor ? '#333' : '#666',
                            zIndex: 1
                        }}
                    >
                        {mark.isMajor && mark.value > 0 && (
                            <span
                                style={{
                                    position: 'absolute',
                                    left: '16px',
                                    top: '-6px',
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

            {/* Zero mark */}
            <div
                style={{
                    position: 'absolute',
                    top: '0',
                    left: 0,
                    width: '16px',
                    height: '2px',
                    backgroundColor: '#000',
                    zIndex: 10
                }}
            />

            {/* Top Margin Marker (draggable) */}
            <div
                onMouseDown={(e) => handleMouseDown('top', e)}
                style={{
                    position: 'absolute',
                    top: `${mmToPercent(topMargin)}%`,
                    left: 0,
                    right: 0,
                    height: '0',
                    borderTop: '2px solid #0066cc',
                    cursor: 'ns-resize',
                    zIndex: 20
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: '-5px',
                        left: '14px',
                        width: '0',
                        height: '0',
                        borderTop: '5px solid transparent',
                        borderBottom: '5px solid transparent',
                        borderLeft: '8px solid #0066cc',
                        cursor: 'ns-resize'
                    }}
                />
            </div>

            {/* Bottom Margin Marker (draggable) */}
            <div
                onMouseDown={(e) => handleMouseDown('bottom', e)}
                style={{
                    position: 'absolute',
                    bottom: `${mmToPercent(bottomMargin)}%`,
                    left: 0,
                    right: 0,
                    height: '0',
                    borderBottom: '2px solid #cc6600',
                    cursor: 'ns-resize',
                    zIndex: 20
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        bottom: '-5px',
                        left: '14px',
                        width: '0',
                        height: '0',
                        borderTop: '5px solid transparent',
                        borderBottom: '5px solid transparent',
                        borderLeft: '8px solid #cc6600',
                        cursor: 'ns-resize'
                    }}
                />
            </div>

            {/* Center line indicator */}
            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    right: 0,
                    height: '1px',
                    backgroundColor: '#e0e0e0',
                    opacity: 0.5,
                    zIndex: 1,
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none'
                }}
            />
        </div>
    );
};

export default VerticalRuler;
