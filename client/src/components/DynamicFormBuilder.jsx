import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Type, 
  Hash, 
  ChevronDown, 
  AlignLeft, 
  Calendar, 
  CheckSquare, 
  FileUp, 
  Trash2, 
  Plus, 
  Save, 
  X, 
  Settings2, 
  GripVertical,
  Layers,
  Sparkles,
  Info,
  ChevronRight,
  Eye,
  Settings,
  MoreVertical
} from 'lucide-react';

const FIELD_TYPES = [
  { type: 'text', label: 'Short Text', icon: <Type size={18} />, description: 'Small text fields for names, titles' },
  { type: 'number', label: 'Number', icon: <Hash size={18} />, description: 'Numeric values, quantity, age' },
  { type: 'dropdown', label: 'Dropdown', icon: <ChevronDown size={18} />, description: 'Selectable options from a list' },
  { type: 'textarea', label: 'Long Text', icon: <AlignLeft size={18} />, description: 'Paragraphs, notes, descriptions' },
  { type: 'date', label: 'Date Picker', icon: <Calendar size={18} />, description: 'Pick dates from a calendar' },
  { type: 'checkbox', label: 'Checkbox', icon: <CheckSquare size={18} />, description: 'Yes/No or multi-select options' },
  { type: 'file', label: 'File Upload', icon: <FileUp size={18} />, description: 'Images, PDFs, documents' },
];

const SECTIONS = ['Basic Details', 'Job Description', 'Experience & Skills', 'Salary & Perks', 'Additional Info'];

export default function DynamicFormBuilder({ template, onSave, onCancel }) {
  const [fields, setFields] = useState(template.fields || []);
  const [activeSection, setActiveSection] = useState(SECTIONS[0]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);

  const selectedField = fields.find(f => f.uiId === selectedFieldId);

  const handleAddField = (typeObj) => {
    const newField = {
      uiId: `field_${Date.now()}`,
      key: '',
      label: `New ${typeObj.label}`,
      type: typeObj.type,
      section: activeSection,
      required: false,
      placeholder: `Enter ${typeObj.label.toLowerCase()}...`,
      options: typeObj.type === 'dropdown' ? ['Option 1', 'Option 2'] : []
    };
    setFields([...fields, newField]);
    setSelectedFieldId(newField.uiId);
  };

  const updateFieldProperty = (id, property, value) => {
    setFields(prev => prev.map(f => {
      if (f.uiId === id) {
        const updated = { ...f, [property]: value };
        if (property === 'label' && (!f.key || f.key === f.label.toLowerCase().trim().replace(/[^a-z0-9]/g, '_'))) {
          updated.key = value.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
        }
        return updated;
      }
      return f;
    }));
  };

  const handleDeleteField = (id) => {
    setFields(prev => prev.filter(f => f.uiId !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(fields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setFields(items);
  };

  const handleSaveTemplate = () => {
    if (fields.length === 0) {
      alert("Please add at least one field to the form.");
      return;
    }
    const cleanFields = fields.map(({ uiId, ...rest }) => rest);
    onSave({ ...template, fields: cleanFields, sections: SECTIONS });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-6 font-sans overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[3rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] w-full max-w-[1440px] h-[94vh] flex overflow-hidden border border-slate-200 relative"
      >
        
        {/* ─── LEFT: Elements Sidebar ───────────────────────────────────── */}
        <div className="w-80 bg-slate-50/50 border-r border-slate-100 flex flex-col shrink-0">
          <div className="p-10 pb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                <Plus size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Toolbox</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">Form Elements</h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">Click to add fields to your workspace.</p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
            {FIELD_TYPES.map((ft, idx) => (
              <motion.button
                key={ft.type}
                whileHover={{ scale: 1.02, x: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAddField(ft)}
                className="w-full group bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-300 text-left relative overflow-hidden flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 flex items-center justify-center transition-all duration-300">
                  {ft.icon}
                </div>
                <div>
                  <div className="font-black text-slate-800 text-sm tracking-tight">{ft.label}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">{ft.type}</div>
                </div>
                <div className="ml-auto opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-indigo-500">
                  <ChevronRight size={16} />
                </div>
              </motion.button>
            ))}
          </div>

          <div className="p-8 border-t border-slate-100 bg-white/80">
             <div className="flex items-start gap-3 p-5 bg-indigo-50/50 rounded-3xl border border-indigo-100 shadow-inner">
                <Info size={16} className="text-indigo-500 mt-0.5 shrink-0" />
                <p className="text-[11px] font-medium text-indigo-700/70 leading-relaxed italic">
                  Drag and drop fields in the canvas to reorder them as needed.
                </p>
             </div>
          </div>
        </div>

        {/* ─── CENTER: Interactive Canvas ───────────────────────────────── */}
        <div className="flex-1 bg-white flex flex-col relative overflow-hidden">
          {/* Header */}
          <div className="h-24 px-12 border-b border-slate-50 flex items-center justify-between bg-white/70 backdrop-blur-md sticky top-0 z-10">
            <div>
              <div className="flex items-center gap-3">
                <Layers className="text-indigo-600" size={24} />
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{template.title || 'Canvas Builder'}</h1>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <button 
                onClick={onCancel}
                className="px-6 py-2.5 text-xs font-black text-slate-400 hover:text-slate-950 transition-colors uppercase tracking-widest"
              >
                Cancel Draft
              </button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSaveTemplate}
                className="px-10 py-4 bg-slate-950 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.15em] hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-950/20 flex items-center gap-3"
              >
                <Save size={16} /> Save Changes
              </motion.button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50/20 p-12 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-16 pb-32">
              
              <DragDropContext onDragEnd={onDragEnd}>
                {SECTIONS.map(section => {
                  const sectionFields = fields.filter(f => f.section === section);
                  return (
                    <motion.div 
                      layout
                      key={section} 
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-6 group">
                        <div className="h-px flex-1 bg-slate-100"></div>
                        <div className="flex items-center gap-3">
                          <span className="p-1 px-4 bg-white border border-slate-200 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] shadow-sm transform group-hover:scale-105 transition-transform">
                            {section}
                          </span>
                        </div>
                        <div className="h-px flex-1 bg-slate-100"></div>
                      </div>

                      <Droppable droppableId={section}>
                        {(provided, snapshot) => (
                          <div 
                            {...provided.droppableProps} 
                            ref={provided.innerRef}
                            className={`space-y-4 min-h-[120px] rounded-[2.5rem] transition-all duration-300 p-4 
                              ${snapshot.isDraggingOver ? 'bg-indigo-50/30 scale-[1.01]' : 'bg-transparent'}`}
                          >
                            <AnimatePresence mode="popLayout">
                              {sectionFields.map((field, index) => (
                                <Draggable 
                                  key={field.uiId} 
                                  draggableId={field.uiId} 
                                  index={fields.indexOf(field)}
                                >
                                  {(provided, snapshot) => (
                                    <motion.div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95 }}
                                      onClick={() => setSelectedFieldId(field.uiId)}
                                      className={`group relative bg-white p-7 rounded-3xl border-2 transition-all duration-300
                                        ${snapshot.isDragging ? 'shadow-2xl border-indigo-500 scale-[1.02]' : 'border-transparent shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-slate-100'}
                                        ${selectedFieldId === field.uiId ? 'border-indigo-600 ring-8 ring-indigo-50 shadow-2xl scale-[1.01]' : ''}`}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-6 flex-1">
                                          <div className={`p-3 rounded-2xl bg-slate-50 transition-colors duration-300
                                            ${selectedFieldId === field.uiId ? 'bg-indigo-600 text-white' : 'text-slate-300 group-hover:text-indigo-500'}`}>
                                            <GripVertical size={18} />
                                          </div>
                                          <div className="flex-1 pt-1">
                                            <div className="flex items-center gap-3 mb-2">
                                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{field.type}</span>
                                              {field.required && <span className="bg-red-50 text-red-500 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md">Required</span>}
                                            </div>
                                            <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none mb-4">{field.label}</h3>
                                            <div className="w-full bg-slate-50/50 border border-slate-100/50 rounded-2xl px-5 py-4 text-sm text-slate-400 font-medium">
                                              {field.placeholder || 'Type something here...'}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteField(field.uiId); }}
                                            className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                          <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center">
                                             <MoreVertical size={16} />
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </Draggable>
                              ))}
                            </AnimatePresence>
                            {provided.placeholder}
                            {sectionFields.length === 0 && (
                               <div className="py-16 border-4 border-dashed border-slate-50 rounded-[3rem] flex flex-col items-center justify-center bg-white/30 group opacity-40 hover:opacity-100 transition-all duration-500">
                                   <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-200 mb-4 group-hover:scale-110 transition-transform">
                                      <Plus size={32} />
                                   </div>
                                   <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">Workspace Empty</p>
                               </div>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </motion.div>
                  );
                })}
              </DragDropContext>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Settings Sidebar ──────────────────────────────────── */}
        <div className="w-[420px] bg-slate-50 border-l border-slate-100 flex flex-col shrink-0 overflow-hidden">
          <div className="p-10 pb-6 bg-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <Settings2 size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Customization</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Settings</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-10 py-6 custom-scrollbar space-y-10">
            {selectedField ? (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                {/* Field Header Summary */}
                <div className="p-6 bg-indigo-600 rounded-[2rem] text-white shadow-2xl shadow-indigo-100 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10">
                      {FIELD_TYPES.find(t => t.type === selectedField.type)?.icon}
                   </div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Active Object</div>
                   <div className="text-xl font-bold tracking-tight mb-4 truncate">{selectedField.label}</div>
                   <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest">{selectedField.type}</span>
                      <span className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest">{selectedField.section}</span>
                   </div>
                </div>

                {/* Configuration Inputs */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Label Text</label>
                    <input 
                      type="text"
                      className="w-full px-6 py-4 bg-white border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-bold text-slate-800 shadow-sm"
                      value={selectedField.label}
                      onChange={(e) => updateFieldProperty(selectedField.uiId, 'label', e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Placeholder</label>
                    <input 
                      type="text"
                      className="w-full px-6 py-4 bg-white border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all text-sm font-medium text-slate-600 shadow-sm"
                      value={selectedField.placeholder || ''}
                      onChange={(e) => updateFieldProperty(selectedField.uiId, 'placeholder', e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Grouping Section</label>
                    <div className="relative">
                      <select 
                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all text-sm font-bold text-slate-800 shadow-sm appearance-none cursor-pointer"
                        value={selectedField.section}
                        onChange={(e) => updateFieldProperty(selectedField.uiId, 'section', e.target.value)}
                      >
                        {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {selectedField.type === 'dropdown' && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Options (One per line)</label>
                      <textarea 
                        className="w-full px-6 py-5 bg-white border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all text-sm font-medium text-slate-600 shadow-sm h-48 resize-none font-mono"
                        value={selectedField.options?.join('\n') || ''}
                        onChange={(e) => updateFieldProperty(selectedField.uiId, 'options', e.target.value.split('\n').map(o => o.trim()).filter(Boolean))}
                      />
                    </div>
                  )}

                  {/* Toggles */}
                  <div className="pt-4 space-y-4">
                    <button 
                      onClick={() => updateFieldProperty(selectedField.uiId, 'required', !selectedField.required)}
                      className={`w-full flex items-center justify-between p-7 rounded-[2rem] border-2 transition-all duration-500
                        ${selectedField.required 
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-2xl shadow-indigo-200' 
                          : 'border-white bg-white hover:border-slate-200'
                        }`}
                    >
                      <div className="text-left">
                        <div className={`text-sm font-black uppercase tracking-tight ${selectedField.required ? 'text-white' : 'text-slate-800'}`}>Mandatory Field</div>
                        <div className={`text-[10px] font-medium tracking-wide ${selectedField.required ? 'text-indigo-100' : 'text-slate-400'}`}>User must fill this to submit.</div>
                      </div>
                      <div className={`w-12 h-7 rounded-full relative transition-colors duration-500 ${selectedField.required ? 'bg-indigo-400' : 'bg-slate-200'}`}>
                        <motion.div 
                          animate={{ x: selectedField.required ? 20 : 0 }}
                          className="absolute left-1 top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300" 
                        />
                      </div>
                    </button>
                    
                    <div className="p-8 bg-slate-950 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                       <div className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-3 block">Metadata Key</div>
                       <code className="text-sm font-mono text-indigo-100 leading-none break-all">{selectedField.key || 'awaiting_label...'}</code>
                       <div className="mt-4 flex items-center gap-2">
                          <Info size={14} className="text-slate-500" />
                          <span className="text-[10px] text-slate-400 font-medium">Used for backend API mapping.</span>
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-12 pb-24">
                 <div className="w-24 h-24 bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-[2.5rem] flex items-center justify-center text-slate-300 mb-8 animate-bounce">
                    <Settings size={32} />
                 </div>
                 <h3 className="text-lg font-black text-slate-800 mb-3 tracking-tight">Configuration Mode</h3>
                 <p className="text-xs text-slate-400 font-medium leading-relaxed uppercase tracking-widest max-w-[200px]">Select a canvas object to refine its parameters.</p>
              </div>
            )}
          </div>

          {selectedField && (
            <div className="p-10 shrink-0 bg-white border-t border-slate-100">
               <button 
                onClick={() => setSelectedFieldId(null)}
                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-950 hover:text-white transition-all duration-500 shadow-sm"
               >
                 Close Settings
               </button>
            </div>
          )}
        </div>

      </motion.div>
    </div>
  );
}
