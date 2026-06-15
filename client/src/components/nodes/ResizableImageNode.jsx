import React, { useState, useRef } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import {
    AlignLeft, AlignCenter, AlignRight, Move,
    Layers, Square, ArrowUpFromLine, Type
} from 'lucide-react';
import './ResizableImageNode.css';

export default function ResizableImageNode(props) {
    const { node, updateAttributes, selected } = props;
    const [isResizing, setIsResizing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);

    // Attributes
    const width = node.attrs.width || '200px';
    const layout = node.attrs.layout || 'inline';
    const top = node.attrs.top || 0;
    const left = node.attrs.left || 0;

    // Helper: Is Absolute?
    const isAbsolute = layout === 'in-front' || layout === 'behind';

    // --- Resize Logic ---
    const handleResize = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        const startX = e.clientX;
        const currentWidthVal = parseInt(width, 10) || 200;

        const onMouseMove = (moveEvent) => {
            const diffX = moveEvent.clientX - startX;
            const newWidth = Math.max(50, currentWidthVal + diffX);
            updateAttributes({ width: `${newWidth}px` });
        };
        const onMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // --- Absolute Drag Logic ---
    const handleAbsoluteDrag = (e) => {
        if (!isAbsolute || isResizing) return;
        e.preventDefault(); // Prevent browser drag
        e.stopPropagation();

        // Find parent container (A4 Page) to calculate relative pos
        const page = containerRef.current?.closest('.a4-page');
        if (!page) return;

        const _pageRect = page.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = left;
        const startTop = top;

        setIsDragging(true);

        const onMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            // Constrain to page? Optional. currently free.
            updateAttributes({
                left: startLeft + deltaX,
                top: startTop + deltaY
            });
        };

        const onMouseUp = () => {
            setIsDragging(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // --- Layout Setters ---
    const setLayout = (mode) => {
        // Reset absolute coords when switching to standard flow to avoid confusion?
        // Actually, keeping them might be nice if they toggle back. 
        // But switching TO absolute should probably start at current visual location? 
        // For simplicity, we restart at 0,0 or keep existing.
        updateAttributes({ layout: mode });
    };

    return (
        <NodeViewWrapper
            as="span"
            ref={containerRef}
            className={`resizable-image-wrapper ${selected ? 'is-selected' : ''}`}
            style={{
                // Container Layout
                display: layout === 'center' ? 'flex' : (isAbsolute ? 'block' : 'inline-block'),
                justifyContent: layout === 'center' ? 'center' : 'flex-start',

                // Float Modes
                float: layout === 'fixed-left' ? 'left' : (layout === 'fixed-right' ? 'right' : 'none'),
                marginRight: layout === 'fixed-left' ? '1.5rem' : 0,
                marginLeft: layout === 'fixed-right' ? '1.5rem' : 0,
                marginBottom: (layout === 'fixed-left' || layout === 'fixed-right') ? '0.5rem' : 0,

                // Absolute Modes
                position: isAbsolute ? 'absolute' : 'relative',
                top: isAbsolute ? `${top}px` : 'auto',
                left: isAbsolute ? `${left}px` : 'auto',
                zIndex: layout === 'in-front' ? 10 : (layout === 'behind' ? 0 : 'auto'),
                opacity: layout === 'behind' ? 0.5 : 1, // Visual cue for behind

                // Interaction
                cursor: isAbsolute ? (isDragging ? 'grabbing' : 'grab') : 'default',
                lineHeight: 0,
            }}
            // Only allow native dragging for Flow modes. Absolute modes use custom drag.
            draggable={!isAbsolute}
            data-drag-handle={!isAbsolute}
            onMouseDown={isAbsolute ? handleAbsoluteDrag : undefined}
        >
            <div
                className="image-container"
                style={{
                    width: width,
                    position: 'relative',
                    border: selected ? '2px solid #3b82f6' : '2px solid transparent',
                    transition: isDragging ? 'none' : 'all 0.1s ease',
                }}
            >
                <img
                    src={node.attrs.src}
                    alt="Content"
                    style={{ width: '100%', height: 'auto', display: 'block', pointerEvents: 'none' }}
                />

                {/* Resize Handle */}
                {selected && (
                    <div
                        className="resize-handle"
                        onMouseDown={handleResize}
                        style={{
                            position: 'absolute',
                            right: '-6px',
                            bottom: '-6px',
                            width: '12px', height: '12px',
                            backgroundColor: '#3b82f6',
                            border: '2px solid white', borderRadius: '50%',
                            cursor: 'nwse-resize', zIndex: 20
                        }}
                    />
                )}

                {/* --- WORD-STYLE LAYOUT MENU --- */}
                {selected && (
                    <div
                        className="layout-toolbar"
                        onMouseDown={e => e.stopPropagation()} // Prevent drag start from menu
                        style={{
                            position: 'absolute',
                            top: '-45px', left: '50%', transform: 'translateX(-50%)',
                            backgroundColor: 'white',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            borderRadius: '8px',
                            display: 'flex', gap: '4px', padding: '4px',
                            zIndex: 100, border: '1px solid #e2e8f0',
                            width: 'max-content'
                        }}
                    >
                        {/* Inline */}
                        <button onClick={() => setLayout('inline')} className={`p-1.5 rounded hover:bg-gray-100 ${layout === 'inline' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`} title="In Line with Text">
                            <Type size={16} />
                        </button>
                        <div className="w-px bg-gray-200 mx-1" />

                        {/* Wrapper Group */}
                        <button onClick={() => setLayout('fixed-left')} className={`p-1.5 rounded hover:bg-gray-100 ${layout === 'fixed-left' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`} title="Square Left">
                            <AlignLeft size={16} />
                        </button>
                        <button onClick={() => setLayout('center')} className={`p-1.5 rounded hover:bg-gray-100 ${layout === 'center' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`} title="Center">
                            <AlignCenter size={16} />
                        </button>
                        <button onClick={() => setLayout('fixed-right')} className={`p-1.5 rounded hover:bg-gray-100 ${layout === 'fixed-right' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`} title="Square Right">
                            <AlignRight size={16} />
                        </button>
                        <div className="w-px bg-gray-200 mx-1" />

                        {/* Absolute Group */}
                        <button onClick={() => setLayout('in-front')} className={`p-1.5 rounded hover:bg-gray-100 ${layout === 'in-front' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`} title="In Front of Text (Movable)">
                            <Layers size={16} />
                        </button>
                        <button onClick={() => setLayout('behind')} className={`p-1.5 rounded hover:bg-gray-100 ${layout === 'behind' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`} title="Behind Text (Watermark)">
                            <Square size={16} strokeDasharray="3 3" />
                        </button>
                    </div>
                )}
            </div>
            {/* Overlay hint if Absolute */}
            {selected && isAbsolute && (
                <div style={{ position: 'absolute', top: -20, left: 0, fontSize: '10px', background: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px 4px', borderRadius: '4px', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                    Click & Drag to Move
                </div>
            )}
        </NodeViewWrapper>
    );
}
