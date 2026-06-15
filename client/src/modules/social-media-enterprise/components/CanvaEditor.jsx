import React, { useEffect, useRef, useState } from 'react';

import { 
    Type, Image as ImageIcon, Trash2, ChevronUp, ChevronDown, 
    Bold, Italic, Underline, Download, Save, Undo, Redo, 
    X, AlignLeft, AlignCenter, AlignRight, Layers, Square, Circle
} from 'lucide-react';
import { Modal, Button, Slider, Select, Popover, Input, Tabs, Card, Spin } from 'antd';
import { message } from '../../../utils/antdGlobal';
import socialApi from '../services/social.api';



const CanvaEditor = ({ open, onClose, onExport }) => {
    const canvasRef = useRef(null);
    const fabricRef = useRef(null);
    const fabricApiRef = useRef(null);
    const [selectedObject, setSelectedObject] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [loadingCanvasEngine, setLoadingCanvasEngine] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    useEffect(() => {
        let canvas = null;
        let isMounted = true;
        if (open) {
            setLoadingCanvasEngine(true);
            // Wait for Modal animation to finish before initializing canvas
            const timer = setTimeout(async () => {
                if (!canvasRef.current) {
                    if (isMounted) {
                        setLoadingCanvasEngine(false);
                    }
                    return;
                }

                try {
                    const fabricModule = await import('fabric');
                    if (!isMounted) return;

                    const fabricApi = fabricModule.fabric || fabricModule;
                    fabricApiRef.current = fabricApi;

                    canvas = new fabricApi.Canvas(canvasRef.current, {
                        width: 800,
                        height: 500,
                        backgroundColor: '#ffffff',
                        preserveObjectStacking: true,
                    });
                    fabricRef.current = canvas;

                    // Add a test object to confirm it's working
                    const rect = new fabricApi.Rect({
                        left: 100,
                        top: 100,
                        fill: '#6366f1',
                        width: 100,
                        height: 100,
                        rx: 10,
                        ry: 10
                    });
                    canvas.add(rect);
                    canvas.renderAll();

                    canvas.on('selection:created', (e) => setSelectedObject(e.selected[0]));
                    canvas.on('selection:updated', (e) => setSelectedObject(e.selected[0]));
                    canvas.on('selection:cleared', () => setSelectedObject(null));
                    canvas.on('object:modified', saveHistory);

                    loadTemplates();
                    saveHistory();
                } catch (error) {
                    console.error('Failed to initialize fabric editor:', error);
                    message.error('Unable to initialize template editor.');
                } finally {
                    if (isMounted) {
                        setLoadingCanvasEngine(false);
                    }
                }
            }, 250);

            return () => {
                isMounted = false;
                clearTimeout(timer);
                if (fabricRef.current) {
                    fabricRef.current.dispose();
                    fabricRef.current = null;
                }
                fabricApiRef.current = null;
                setSelectedObject(null);
            };
        }
    }, [open]);

    const loadTemplates = async () => {
        setLoadingTemplates(true);
        try {
            const data = await socialApi.getTemplates();
            setTemplates(data || []);
        } catch (err) {
            console.error('Failed to load templates:', err);
        } finally {
            setLoadingTemplates(false);
        }
    };

    const saveHistory = () => {
        if (!fabricRef.current) return;
        const json = fabricRef.current.toJSON();
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(json);
            return newHistory;
        });
        setHistoryIndex(prev => prev + 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const nextIndex = historyIndex - 1;
            fabricRef.current.loadFromJSON(history[nextIndex], () => {
                fabricRef.current.renderAll();
                setHistoryIndex(nextIndex);
            });
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            fabricRef.current.loadFromJSON(history[nextIndex], () => {
                fabricRef.current.renderAll();
                setHistoryIndex(nextIndex);
            });
        }
    };

    const addText = () => {
        const fabricApi = fabricApiRef.current;
        if (!fabricApi || !fabricRef.current) return;

        const text = new fabricApi.IText('Type here...', {
            left: 150,
            top: 150,
            fontFamily: 'Inter',
            fontSize: 28,
            fill: '#000000'
        });
        fabricRef.current.add(text);
        fabricRef.current.setActiveObject(text);
        saveHistory();
    };

    const addRect = () => {
        const fabricApi = fabricApiRef.current;
        if (!fabricApi || !fabricRef.current) return;

        const rect = new fabricApi.Rect({
            left: 100,
            top: 100,
            fill: '#6366f1',
            width: 120,
            height: 120,
            rx: 15,
            ry: 15
        });
        fabricRef.current.add(rect);
        saveHistory();
    };

    const addCircle = () => {
        const fabricApi = fabricApiRef.current;
        if (!fabricApi || !fabricRef.current) return;

        const circle = new fabricApi.Circle({
            left: 150,
            top: 150,
            fill: '#indigo',
            radius: 60
        });
        fabricRef.current.add(circle);
        saveHistory();
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (fEvent) => {
            const dataUrl = fEvent.target.result;
            
            // Create a native HTML image element first
            const imgElement = new Image();
            imgElement.src = dataUrl;
            
            imgElement.onload = () => {
                const fabricApi = fabricApiRef.current;
                if (!fabricApi || !fabricRef.current) return;
                
                // Create fabric image from the loaded element
                const fabricImg = new fabricApi.Image(imgElement);
                
                // Scale to fit nicely
                if (fabricImg.width > 300) {
                    fabricImg.scaleToWidth(300);
                }
                
                fabricRef.current.add(fabricImg);
                fabricRef.current.centerObject(fabricImg);
                fabricRef.current.setActiveObject(fabricImg);
                fabricRef.current.renderAll();
                saveHistory();
                
                // Safety re-render
                setTimeout(() => fabricRef.current?.renderAll(), 100);
            };
        };
        reader.readAsDataURL(file);
    };

    const deleteObject = () => {
        const activeObjects = fabricRef.current.getActiveObjects();
        fabricRef.current.discardActiveObject();
        fabricRef.current.remove(...activeObjects);
        saveHistory();
    };

    const updateTextProperty = (property, value) => {
        const activeObject = fabricRef.current.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'text')) {
            activeObject.set(property, value);
            fabricRef.current.renderAll();
            saveHistory();
        }
    };

    const changeColor = (color) => {
        const activeObject = fabricRef.current.getActiveObject();
        if (activeObject) {
            activeObject.set('fill', color);
            fabricRef.current.renderAll();
            saveHistory();
        }
    };

    const bringForward = () => {
        const activeObject = fabricRef.current.getActiveObject();
        if (activeObject) {
            activeObject.bringForward();
            fabricRef.current.renderAll();
            saveHistory();
        }
    };

    const sendBackward = () => {
        const activeObject = fabricRef.current.getActiveObject();
        if (activeObject) {
            activeObject.sendBackwards();
            fabricRef.current.renderAll();
            saveHistory();
        }
    };

    const exportToImage = () => {
        const dataURL = fabricRef.current.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 2
        });
        onExport(dataURL);
        onClose();
    };

    const loadTemplate = (template) => {
        fabricRef.current.loadFromJSON(template.canvasData, () => {
            fabricRef.current.renderAll();
            saveHistory();
            message.success(`Loaded: ${template.name}`);
        });
    };

    const saveAsTemplate = async () => {
        const name = prompt('Enter template name:');
        if (!name) return;

        const canvasData = fabricRef.current.toJSON();
        const thumbnail = fabricRef.current.toDataURL({ format: 'png', quality: 0.5, multiplier: 0.2 });

        try {
            await socialApi.saveTemplate({ name, canvasData, thumbnail });
            message.success('Template saved successfully!');
            loadTemplates();
        } catch {
            message.error('Failed to save template');
        }
    };

    return (
        <Modal
            title={<div className="flex items-center gap-2 font-bold text-slate-700 underline decoration-indigo-200">✨ Template Editor</div>}
            open={open}
            onCancel={onClose}
            width={1200}
            footer={null}
            destroyOnHidden
        >
            <div className="flex h-[750px] overflow-hidden">
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full"> 
                    <Tabs
                        defaultActiveKey="1"
                        className="px-1 flex-1 h-full"
                        items={[
                            {
                                key: '1',
                                label: <div className="flex items-center gap-2 py-1"><Layers size={14} />Templates</div>,
                                children: (
                                    <div className="p-4 overflow-y-auto h-[660px]">
                                        {loadingTemplates ? <div className="flex justify-center p-10"><Spin /></div> : (
                                            <div className="grid grid-cols-2 gap-3">
                                                {templates.map(t => (
                                                    <Card 
                                                        key={t._id} 
                                                        hoverable 
                                                        className="overflow-hidden border-slate-100 social-card"
                                                        styles={{ body: { padding: 4 } }}
                                                        onClick={() => loadTemplate(t)}
                                                    >
                                                        <img src={t.thumbnail} className="w-full h-24 object-cover rounded-md" alt={t.name} />
                                                        <p className="text-[10px] m-1 font-bold truncate text-slate-500">{t.name}</p>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            },
                            {
                                key: '2',
                                label: <div className="flex items-center gap-2 py-1">Elements</div>,
                                children: (
                                    <div className="p-4 grid grid-cols-2 gap-4">
                                        <button onClick={addText} className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all border border-slate-200 group">
                                            <Type className="text-slate-400 group-hover:text-indigo-500 mb-2" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Add Text</span>
                                        </button>
                                        <label className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer group">
                                            <ImageIcon className="text-slate-400 group-hover:text-indigo-500 mb-2" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Image</span>
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*" 
                                                onChange={(e) => {
                                                    handleImageUpload(e);
                                                    e.target.value = ''; // Reset for next use
                                                }} 
                                            />
                                        </label>
                                        <button onClick={addRect} className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all border border-slate-200 group">
                                            <Square className="text-slate-400 group-hover:text-indigo-500 mb-2" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Box</span>
                                        </button>
                                        <button onClick={addCircle} className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all border border-slate-200 group">
                                            <Circle className="text-slate-400 group-hover:text-indigo-500 mb-2" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Circle</span>
                                        </button>
                                    </div>
                                )
                            }
                        ]}
                    />
                </div>

                {/* Canvas Area */}
                <div className="flex-1 flex flex-col bg-slate-100">
                    <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm z-10">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border">
                                <Button type="text" icon={<Undo size={16} />} onClick={undo} disabled={historyIndex <= 0} />
                                <Button type="text" icon={<Redo size={16} />} onClick={redo} disabled={historyIndex >= history.length - 1} />
                            </div>
                            
                            {selectedObject && (selectedObject.type === 'i-text' || selectedObject.type === 'text') && (
                                <>
                                    <Select 
                                        defaultValue="Inter" 
                                        style={{ width: 120 }} 
                                        onChange={v => updateTextProperty('fontFamily', v)}
                                        options={[
                                            { label: 'Inter', value: 'Inter' },
                                            { label: 'Roboto', value: 'Roboto' },
                                            { label: 'Oswald', value: 'Oswald' },
                                            { label: 'Playfair', value: 'Playfair Display' }
                                        ]}
                                    />
                                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border">
                                        <Button type="text" icon={<Bold size={14} />} className={selectedObject.fontWeight === 'bold' ? 'bg-slate-200' : ''} onClick={() => updateTextProperty('fontWeight', selectedObject.fontWeight === 'bold' ? 'normal' : 'bold')} />
                                        <Button type="text" icon={<Italic size={14} />} className={selectedObject.fontStyle === 'italic' ? 'bg-slate-200' : ''} onClick={() => updateTextProperty('fontStyle', selectedObject.fontStyle === 'italic' ? 'normal' : 'italic')} />
                                        <Button type="text" icon={<Underline size={14} />} className={selectedObject.underline ? 'bg-slate-200' : ''} onClick={() => updateTextProperty('underline', !selectedObject.underline)} />
                                    </div>
                                    
                                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border">
                                        <Button type="text" icon={<AlignLeft size={14} />} className={selectedObject.textAlign === 'left' ? 'bg-slate-200' : ''} onClick={() => updateTextProperty('textAlign', 'left')} />
                                        <Button type="text" icon={<AlignCenter size={14} />} className={selectedObject.textAlign === 'center' ? 'bg-slate-200' : ''} onClick={() => updateTextProperty('textAlign', 'center')} />
                                        <Button type="text" icon={<AlignRight size={14} />} className={selectedObject.textAlign === 'right' ? 'bg-slate-200' : ''} onClick={() => updateTextProperty('textAlign', 'right')} />
                                    </div>

                                    <div className="w-32 px-2">
                                        <Slider 
                                            min={8} 
                                            max={120} 
                                            value={selectedObject.fontSize} 
                                            onChange={v => updateTextProperty('fontSize', v)} 
                                            tooltip={{ formatter: v => `Size: ${v}` }}
                                        />
                                    </div>

                                    <Input 
                                        type="color" 
                                        value={selectedObject.fill} 
                                        onChange={e => changeColor(e.target.value)}
                                        className="w-10 h-10 p-0.5 border-none bg-transparent cursor-pointer"
                                    />
                                </>
                            )}

                            {selectedObject && (
                                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border">
                                    <Button type="text" icon={<ChevronUp size={16} />} title="Bring Forward" onClick={bringForward} />
                                    <Button type="text" icon={<ChevronDown size={16} />} title="Send Backward" onClick={sendBackward} />
                                </div>
                            )}
                            
                            {selectedObject && (
                                <Button danger type="text" icon={<Trash2 size={16} />} onClick={deleteObject}>Delete</Button>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <Button icon={<Save size={16} />} onClick={saveAsTemplate}>Save Template</Button>
                            <Button type="primary" className="bg-indigo-600 border-none h-10 px-6 font-bold flex items-center gap-2" icon={<Download size={16} />} onClick={exportToImage}>
                                Export & Use
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-10 overflow-auto">
                        <div className="shadow-2xl rounded-lg bg-white overflow-hidden" style={{ width: 800, height: 500 }}>
                            {loadingCanvasEngine && (
                                <div className="flex h-full w-full items-center justify-center bg-slate-50 text-slate-500">
                                    <Spin />
                                </div>
                            )}
                            <canvas id="canva-fabric-surface" ref={canvasRef} />
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default CanvaEditor;
