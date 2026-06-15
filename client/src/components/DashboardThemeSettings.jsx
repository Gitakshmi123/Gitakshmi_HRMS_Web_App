import React, { useState, useEffect, useRef } from 'react';
import { Settings, X, Check, Paintbrush, FileText, ArrowLeft, Layers, ChevronRight, ChevronLeft, GripVertical, Settings2, Building2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import { getScopedStorageKey } from '../utils/sidebarStorage';
import { useAuth } from '../context/AuthContext';

import { useLocation, useNavigate } from 'react-router-dom';

const PRESET_THEMES = [
  { 
    name: 'Default Light', 
    bg: '#f8fafc', 
    card: '#ffffff', 
    text: '#0f172a', 
    accent: '#6366f1',
    sidebarBg: '#ffffff',
    sidebarText: '#0f172a',
    metricBg: '#ffffff',
    metricText: '#0f172a'
  },
  { 
    name: 'Soft Blue', 
    bg: '#f0f9ff', 
    card: '#ffffff', 
    text: '#0369a1', 
    accent: '#0284c7',
    sidebarBg: '#f0f9ff',
    sidebarText: '#0369a1',
    metricBg: '#ffffff',
    metricText: '#0369a1'
  },
  { 
    name: 'Midnight Dark', 
    bg: '#0f172a', 
    card: '#1e293b', 
    text: '#f8fafc', 
    accent: '#818cf8',
    sidebarBg: '#1e293b',
    sidebarText: '#f8fafc',
    metricBg: '#1e293b',
    metricText: '#f8fafc'
  },
  { 
    name: 'Warm Sand', 
    bg: '#fdf6e3', 
    card: '#ffffff', 
    text: '#5c2d11', 
    accent: '#d97706',
    sidebarBg: '#fdf6e3',
    sidebarText: '#5c2d11',
    metricBg: '#ffffff',
    metricText: '#5c2d11'
  },
  { 
    name: 'Rose Tint', 
    bg: '#fff1f2', 
    card: '#ffffff', 
    text: '#9f1239', 
    accent: '#e11d48',
    sidebarBg: '#fff1f2',
    sidebarText: '#9f1239',
    metricBg: '#ffffff',
    metricText: '#9f1239'
  },
  { 
    name: 'Mint Green', 
    bg: '#f0fdf4', 
    card: '#ffffff', 
    text: '#166534', 
    accent: '#10b981',
    sidebarBg: '#f0fdf4',
    sidebarText: '#166534',
    metricBg: '#ffffff',
    metricText: '#166534'
  },
];

export default function DashboardThemeSettings() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { user } = useAuth();
  const [currentTheme, setCurrentTheme] = useState({
    bg: '#f8fafc',
    card: '#ffffff',
    text: '#0f172a',
    btnText: '#ffffff'
  });

  const panel = location.pathname.startsWith('/employee') ? 'employee' : 'hr';
  const scopedKey = getScopedStorageKey('hrms:sidebar:advanced-config:v1', { user, panel });
  const sidebarOrderKey = getScopedStorageKey('hrms:sidebar:order:v1', { user, panel });

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    try {
      const cfg = JSON.parse(
        localStorage.getItem(scopedKey) ||
        localStorage.getItem('hrms:sidebar:advanced-config:v1') ||
        '{}'
      );
      if (cfg?.appearance) {
        setCurrentTheme({
          bg: cfg.appearance.pageBgColor || '#f8fafc',
          card: cfg.appearance.pageCardColor || '#ffffff',
          text: cfg.appearance.pageTextColor || '#0f172a',
          accent: cfg.appearance.accentColor || '#6366f1',
          radius: cfg.appearance.borderRadius || '16',
          glass: cfg.appearance.glassEffect || false,
          font: cfg.appearance.fontFamily || 'Inter',
          variant: cfg.appearance.cardVariant || 'Standard',
          metricBg: cfg.appearance.metricBgColor || '',
          metricText: cfg.appearance.metricTextColor || '',
          sidebarBg: cfg.appearance.sidebarBgColor || '',
          sidebarText: cfg.appearance.sidebarTextColor || '',
          sidebarActive: cfg.appearance.sidebarActiveColor || '',
          sidebarActiveBg: cfg.appearance.sidebarActiveBgColor || '',
          sidebarHoverBg: cfg.appearance.sidebarHoverBgColor || '',
          sidebarHoverText: cfg.appearance.sidebarHoverTextColor || '',
          btnText: cfg.appearance.buttonTextColor || '#ffffff'
        });
      }
    } catch (e) { }
  }, [isOpen, scopedKey]);

  const applyTheme = (updates) => {
    try {
      const existingCfg = JSON.parse(
        localStorage.getItem(scopedKey) ||
        localStorage.getItem('hrms:sidebar:advanced-config:v1') ||
        '{}'
      );
      
      const newAppearance = {
        ...(existingCfg.appearance || {}),
        ...updates
      };

      const newCfg = {
        ...existingCfg,
        appearance: newAppearance
      };

      localStorage.setItem(scopedKey, JSON.stringify(newCfg));
      
      // Update local state
      setCurrentTheme(prev => ({
        ...prev,
        bg: newAppearance.pageBgColor || prev.bg,
        card: newAppearance.pageCardColor || prev.card,
        text: newAppearance.pageTextColor || prev.text,
        accent: newAppearance.accentColor || prev.accent,
        radius: newAppearance.borderRadius || prev.radius,
        glass: newAppearance.glassEffect !== undefined ? newAppearance.glassEffect : prev.glass,
        font: newAppearance.fontFamily || prev.font,
        variant: newAppearance.cardVariant || prev.variant,
        metricBg: newAppearance.metricBgColor || prev.metricBg,
        metricText: newAppearance.metricTextColor || prev.metricText,
        sidebarBg: newAppearance.sidebarBgColor || prev.sidebarBg,
        sidebarText: newAppearance.sidebarTextColor || prev.sidebarText,
        sidebarActive: newAppearance.sidebarActiveColor || prev.sidebarActive,
        sidebarActiveBg: newAppearance.sidebarActiveBgColor || prev.sidebarActiveBg,
        sidebarHoverBg: newAppearance.sidebarHoverBgColor || prev.sidebarHoverBg,
        sidebarHoverText: newAppearance.sidebarHoverTextColor || prev.sidebarHoverText,
        btnText: newAppearance.buttonTextColor || prev.btnText
      }));

      // Instant CSS Variable Injection
      const root = document.documentElement;
      if (newAppearance.pageBgColor) root.style.setProperty('--hr-page-bg', newAppearance.pageBgColor);
      if (newAppearance.pageCardColor) root.style.setProperty('--hr-card-bg', newAppearance.pageCardColor);
      if (newAppearance.pageTextColor) root.style.setProperty('--hr-text-color', newAppearance.pageTextColor);
      if (newAppearance.accentColor) root.style.setProperty('--hr-accent-color', newAppearance.accentColor);
      if (newAppearance.borderRadius) root.style.setProperty('--hr-border-radius', `${newAppearance.borderRadius}px`);

      window.dispatchEvent(new CustomEvent('hrms:appearance:changed', { detail: newAppearance }));
    } catch (e) { }
  };

  const handleCustomColorChange = (e, type) => {
    const val = e.target.value;
    if (type === 'bg') {
      const dark = isDark(val);
      applyTheme({ 
        pageBgColor: val,
        pageCardColor: dark ? '#1e293b' : '#ffffff',
        pageTextColor: dark ? '#f8fafc' : '#0f172a',
        sidebarBgColor: dark ? '#1e293b' : val,
        sidebarTextColor: dark ? '#f8fafc' : '#0f172a',
        metricBgColor: dark ? '#1e293b' : '#ffffff',
        metricTextColor: dark ? '#f8fafc' : '#0f172a'
      });
    }
    if (type === 'card') applyTheme({ pageCardColor: val });
    if (type === 'text') applyTheme({ pageTextColor: val });
    if (type === 'accent') applyTheme({ accentColor: val });
    if (type === 'metricBg') applyTheme({ metricBgColor: val });
    if (type === 'metricText') applyTheme({ metricTextColor: val });
    if (type === 'sidebarBg') applyTheme({ sidebarBgColor: val });
    if (type === 'sidebarText') applyTheme({ sidebarTextColor: val });
    if (type === 'sidebarActive') applyTheme({ sidebarActiveColor: val });
    if (type === 'sidebarActiveBg') applyTheme({ sidebarActiveBgColor: val });
    if (type === 'sidebarHoverBg') applyTheme({ sidebarHoverBgColor: val });
    if (type === 'sidebarHoverText') applyTheme({ sidebarHoverTextColor: val });
    if (type === 'btnText') applyTheme({ buttonTextColor: val });
  };

  const FONTS = ['Inter', 'Outfit', 'Plus Jakarta Sans', 'Montserrat', 'Poppins', 'Lexend', 'DM Sans', 'Quicksand', 'Lora', 'Playfair Display'];
  const VARIANTS = ['Standard', 'Minimal', 'Floating', 'Glassy', 'Neon', 'Soft'];

  const [viewMode, setViewMode] = useState('menu'); // 'menu', 'visual', 'architecture'
  const [sidebarOrder, setSidebarOrder] = useState([]);
  const [pendingOrder, setPendingOrder] = useState([]);
  const [hiddenModules, setHiddenModules] = useState([]);
  const [pendingHiddenModules, setPendingHiddenModules] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});

  const hiddenModulesKey = getScopedStorageKey('hrms:sidebar:hidden:v1', { user, panel });

  useEffect(() => {
    if (sidebarOrder && sidebarOrder.length > 0 && pendingOrder.length === 0) {
      setPendingOrder(sidebarOrder);
    }
  }, [sidebarOrder, pendingOrder.length]);

  useEffect(() => {
    const savedHidden = localStorage.getItem(hiddenModulesKey);
    if (savedHidden) {
      try {
        const parsed = JSON.parse(savedHidden);
        if (Array.isArray(parsed)) {
          setHiddenModules(parsed);
          setPendingHiddenModules(parsed);
        }
      } catch (e) {}
    }
  }, [hiddenModulesKey]);


  const MANAGEMENT_MODULES = ['Dashboard', 'Access', 'Employee', 'Attendance', 'Policy', 'Payroll', 'Hiring', 'Onboarding', 'Organization', 'BGV', 'Offboarding', 'Social Media', 'Portals', 'Reports', 'Settings', 'Sub Companies', 'Ticket Inbox'];
  const EMPLOYEE_MODULES = ['emp service'];

  const sectionOrderKey = getScopedStorageKey('hrms:sidebar:section-order:v1', { user, panel });
  const [sectionOrder, setSectionOrder] = useState(['MANAGEMENT', 'EMPLOYEE']);
  const [pendingSectionOrder, setPendingSectionOrder] = useState(['MANAGEMENT', 'EMPLOYEE']);

  useEffect(() => {
    const saved = localStorage.getItem(sectionOrderKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSectionOrder(parsed);
          setPendingSectionOrder(parsed);
        }
      } catch (e) {}
    }
  }, [sectionOrderKey]);

  useEffect(() => {
    const savedOrder = localStorage.getItem(sidebarOrderKey);
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed)) {
          setSidebarOrder(parsed);
        } else {
          setSidebarOrder([...MANAGEMENT_MODULES, ...EMPLOYEE_MODULES]);
        }
      } catch {
        setSidebarOrder([...MANAGEMENT_MODULES, ...EMPLOYEE_MODULES]);
      }
    } else {
      setSidebarOrder([...MANAGEMENT_MODULES, ...EMPLOYEE_MODULES]);
    }
  }, [sidebarOrderKey]);

  const handleSaveOrder = () => {
    setIsSaving(true);
    setSidebarOrder(pendingOrder);
    setHiddenModules(pendingHiddenModules);
    setSectionOrder(pendingSectionOrder);
    localStorage.setItem(sidebarOrderKey, JSON.stringify(pendingOrder));
    localStorage.setItem(hiddenModulesKey, JSON.stringify(pendingHiddenModules));
    localStorage.setItem(sectionOrderKey, JSON.stringify(pendingSectionOrder));
    window.dispatchEvent(new CustomEvent('hrms:sidebar:order:changed'));
    setTimeout(() => {
      setIsSaving(false);
      setViewMode('menu');
    }, 800);
  };

  const toggleVisibility = (moduleName) => {
    setPendingHiddenModules(prev => 
      prev.includes(moduleName) 
        ? prev.filter(m => m !== moduleName) 
        : [...prev, moduleName]
    );
  };

  const moveSection = (fromIndex, toIndex) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= pendingSectionOrder.length || toIndex >= pendingSectionOrder.length) return;
    const newOrder = [...pendingSectionOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    setPendingSectionOrder(newOrder);
  };

  const moveItemInSection = (item, direction, sectionModules) => {
    const currentIndex = pendingOrder.indexOf(item);
    if (currentIndex === -1) return;
    
    const sectionItemsInOrder = pendingOrder.filter(m => sectionModules.includes(m));
    const currentPosInSection = sectionItemsInOrder.indexOf(item);
    
    let targetItem;
    if (direction === 'up' && currentPosInSection > 0) {
      targetItem = sectionItemsInOrder[currentPosInSection - 1];
    } else if (direction === 'down' && currentPosInSection < sectionItemsInOrder.length - 1) {
      targetItem = sectionItemsInOrder[currentPosInSection + 1];
    }
    
    if (targetItem) {
      const targetIndex = pendingOrder.indexOf(targetItem);
      const newOrder = [...pendingOrder];
      const [moved] = newOrder.splice(currentIndex, 1);
      newOrder.splice(targetIndex, 0, moved);
      setPendingOrder(newOrder);
    }
  };

  const isDark = (color) => {
    if (!color) return false;
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  };

  const dark = isDark(currentTheme.card);

  return (
    <div className="relative h-full w-full flex items-center justify-center" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setViewMode('menu');
        }}
        className="relative flex h-full w-full items-center justify-center rounded-xl text-slate-600 transition-all hover:bg-slate-50 active:scale-90"
        title="Advanced Settings"
      >
        <Settings size={18} className="text-slate-600" />
      </button>

      {isOpen && (
        <div 
          className={clsx(
            "theme-studio-popup absolute top-full right-0 mt-3 max-h-[85vh] overflow-y-auto scrollbar-none rounded-[20px] border transition-all duration-300 z-[1000] animate-in fade-in zoom-in-95",
            viewMode === 'menu' ? "w-[260px]" : "w-[320px]",
            dark ? "bg-[#1e293b]/95 border-white/10 text-white shadow-2xl" : "bg-white/95 border-black/5 text-slate-900 shadow-xl"
          )}
          style={{ backdropFilter: 'blur(20px)' }}
        >
          {/* HEADER */}
          <div className={clsx("sticky top-0 z-20 backdrop-blur-md border-b px-4 py-2.5 flex items-center justify-between", dark ? "bg-black/10 border-white/5" : "bg-white/40 border-black/5")}>
            <div className="flex items-center gap-2">
              {viewMode !== 'menu' && (
                <button 
                  onClick={() => setViewMode('menu')}
                  className={clsx("p-1 rounded-md transition-all", dark ? "hover:bg-white/10" : "hover:bg-black/5")}
                >
                  <ArrowLeft size={14} />
                </button>
              )}
              <h3 className="text-[11px] font-bold opacity-80">
                {viewMode === 'menu' ? 'Settings' : viewMode === 'visual' ? 'Appearance' : 'Navigation'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {viewMode === 'architecture' && (
                <button 
                  onClick={handleSaveOrder}
                  disabled={isSaving}
                  className={clsx(
                    "px-3 py-1 rounded-md text-[10px] font-bold transition-all shadow-sm",
                    isSaving ? "bg-emerald-500 text-white" : (dark ? "bg-white text-slate-900 hover:bg-slate-100" : "bg-slate-900 text-white hover:bg-slate-800")
                  )}
                >
                  {isSaving ? 'Saved!' : 'Save'}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-rose-500 transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="p-3">
            {viewMode === 'menu' && (
              <div className="space-y-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
                <button
                  onClick={() => setViewMode('visual')}
                  className={clsx(
                    "w-full p-2.5 rounded-xl border text-left group transition-all flex items-center justify-between",
                    dark ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-slate-50 border-black/5 hover:bg-white hover:border-indigo-200"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
                      <Paintbrush size={16} />
                    </div>
                    <h4 className="font-semibold text-[11px]">Appearance</h4>
                  </div>
                  <ChevronRight size={12} className="opacity-20 group-hover:opacity-100 transition-all" />
                </button>

                <button
                  onClick={() => setViewMode('architecture')}
                  className={clsx(
                    "w-full p-2.5 rounded-xl border text-left group transition-all flex items-center justify-between",
                    dark ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-slate-50 border-black/5 hover:bg-white hover:border-amber-200"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                      <Layers size={16} />
                    </div>
                    <h4 className="font-semibold text-[11px]">Navigation</h4>
                  </div>
                  <ChevronRight size={12} className="opacity-20 group-hover:opacity-100 transition-all" />
                </button>

                <button
                  onClick={() => {
                    const pathPrefix = location.pathname.startsWith('/employee') ? '/employee' : (location.pathname.startsWith('/hr') ? '/hr' : '/tenant');
                    navigate(`${pathPrefix}/settings/company`);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    "w-full p-2.5 rounded-xl border text-left group transition-all flex items-center justify-between",
                    dark ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-slate-50 border-black/5 hover:bg-white hover:border-emerald-200"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                      <Building2 size={16} />
                    </div>
                    <h4 className="font-semibold text-[11px]">Company Profile</h4>
                  </div>
                  <ChevronRight size={12} className="opacity-20 group-hover:opacity-100 transition-all" />
                </button>
              </div>
            )}

            {viewMode === 'visual' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                {/* PRESETS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[9px] font-black uppercase tracking-widest opacity-40">Canvas Presets</h4>
                    <button onClick={() => applyTheme({ pageBgColor: '#f8fafc', pageCardColor: '#ffffff', pageTextColor: '#0f172a', accentColor: '#6366f1', borderRadius: '16', glassEffect: false, fontFamily: 'Inter', cardVariant: 'Standard' })} className="text-[9px] font-bold text-indigo-500">Reset</button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PRESET_THEMES.map((theme, idx) => (
                      <button
                        key={idx}
                        onClick={() => applyTheme({ 
                          pageBgColor: theme.bg, 
                          pageCardColor: theme.card, 
                          pageTextColor: theme.text,
                          accentColor: theme.accent,
                          sidebarBgColor: theme.sidebarBg,
                          sidebarTextColor: theme.sidebarText,
                          metricBgColor: theme.metricBg,
                          metricTextColor: theme.metricText
                        })}
                        className={clsx(
                          "p-1.5 rounded-xl border transition-all text-center group",
                          currentTheme.bg === theme.bg ? "border-indigo-500 bg-indigo-500/5 shadow-sm" : (dark ? "border-white/5 bg-white/5 hover:bg-white/10" : "border-slate-100 bg-slate-50 hover:bg-white")
                        )}
                      >
                        <div className="w-full h-5 rounded-lg mb-1 group-hover:scale-105 transition-transform" style={{ backgroundColor: theme.bg }} />
                        <span className="text-[8px] font-bold uppercase opacity-60 tracking-tighter">{theme.name.split(' ')[0]}</span>
                      </button>
                    ))}
                    <div 
                      className={clsx(
                        "p-1.5 rounded-xl border transition-all text-center group relative",
                        dark ? "border-white/5 bg-white/5 hover:bg-white/10" : "border-slate-100 bg-slate-50 hover:bg-white"
                      )}
                    >
                      <div className="w-full h-5 rounded-lg mb-1 flex items-center justify-center border border-dashed border-slate-300 overflow-hidden">
                        <input 
                          type="color" 
                          value={currentTheme.bg} 
                          onChange={(e) => handleCustomColorChange(e, 'bg')} 
                          className="w-full h-full scale-150 cursor-pointer" 
                        />
                      </div>
                      <span className="text-[8px] font-bold uppercase opacity-60 tracking-tighter">Custom</span>
                    </div>
                  </div>
                </div>

                {/* TYPOGRAPHY */}
                <div className={clsx("space-y-3 border-t pt-5", dark ? "border-white/5" : "border-black/5")}>
                   <h4 className="text-[9px] font-black uppercase tracking-widest opacity-40">Typography</h4>
                   <div className="grid grid-cols-2 gap-1.5">
                    {FONTS.slice(0, 8).map(f => (
                      <button
                        key={f}
                        onClick={() => applyTheme({ fontFamily: f })}
                        className={clsx(
                          "px-3 py-2 rounded-xl border transition-all text-[9px] font-bold text-left truncate",
                          currentTheme.font === f ? "border-indigo-500 bg-indigo-500/5 text-indigo-500" : (dark ? "border-white/5 bg-white/5 text-white/50" : "border-slate-100 text-slate-500 bg-slate-50/50")
                        )}
                        style={{ fontFamily: f }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* VARIANTS */}
                <div className={clsx("space-y-3 border-t pt-5", dark ? "border-white/5" : "border-black/5")}>
                   <h4 className="text-[9px] font-black uppercase tracking-widest opacity-40">Card Variants</h4>
                   <div className="grid grid-cols-3 gap-1">
                    {VARIANTS.map(v => (
                      <button
                        key={v}
                        onClick={() => applyTheme({ cardVariant: v })}
                        className={clsx(
                          "py-2 rounded-lg text-[8px] font-bold uppercase transition-all border",
                          currentTheme.variant === v 
                            ? (dark ? "bg-white text-slate-900 border-white shadow-lg" : "bg-slate-900 text-white border-slate-900 shadow-lg")
                            : (dark ? "bg-white/5 text-slate-400 border-white/5" : "bg-white text-slate-400 border-slate-100")
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                 {/* REFINEMENTS */}
                 <div className={clsx("space-y-4 border-t pt-5", dark ? "border-white/5" : "border-black/5")}>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-black/5 bg-slate-500/5">
                        <span className="text-[8px] font-black uppercase opacity-40">Page BG</span>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold opacity-60 uppercase">{currentTheme.bg || '#Default'}</span>
                          <input type="color" value={currentTheme.bg} onChange={(e) => handleCustomColorChange(e, 'bg')} className="w-6 h-6 rounded-md cursor-pointer border border-white" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-black/5 bg-slate-500/5">
                        <span className="text-[8px] font-black uppercase opacity-40">Card BG</span>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold opacity-60 uppercase">{currentTheme.card || '#Default'}</span>
                          <input type="color" value={currentTheme.card} onChange={(e) => handleCustomColorChange(e, 'card')} className="w-6 h-6 rounded-md cursor-pointer border border-white" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-black/5 bg-slate-500/5">
                        <span className="text-[8px] font-black uppercase opacity-40">Global Text</span>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold opacity-60 uppercase">{currentTheme.text || '#Default'}</span>
                          <input type="color" value={currentTheme.text} onChange={(e) => handleCustomColorChange(e, 'text')} className="w-6 h-6 rounded-md cursor-pointer border border-white" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-black/5 bg-slate-500/5">
                        <span className="text-[8px] font-black uppercase opacity-40">Accent Color</span>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold opacity-80 uppercase">{currentTheme.accent}</span>
                          <input type="color" value={currentTheme.accent} onChange={(e) => handleCustomColorChange(e, 'accent')} className="w-6 h-6 rounded-md cursor-pointer border border-white shadow-sm" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-black/5 bg-slate-500/5">
                        <span className="text-[8px] font-black uppercase opacity-40">Primary Button Text Color</span>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold opacity-60 uppercase">{currentTheme.btnText || '#Default'}</span>
                          <input type="color" value={currentTheme.btnText} onChange={(e) => handleCustomColorChange(e, 'btnText')} className="w-full h-8 mt-1 rounded-md cursor-pointer border border-white" />
                        </div>
                      </div>
                    </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-black/5 bg-slate-500/5">
                      <span className="text-[8px] font-black uppercase opacity-40">Metric Card BG</span>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold opacity-60 uppercase">{currentTheme.metricBg || '#Default'}</span>
                        <input type="color" value={currentTheme.metricBg || '#ffffff'} onChange={(e) => handleCustomColorChange(e, 'metricBg')} className="w-6 h-6 rounded-md cursor-pointer border border-white" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-black/5 bg-slate-500/5">
                      <span className="text-[8px] font-black uppercase opacity-40">Metric Text</span>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold opacity-60 uppercase">{currentTheme.metricText || '#Default'}</span>
                        <input type="color" value={currentTheme.metricText || '#000000'} onChange={(e) => handleCustomColorChange(e, 'metricText')} className="w-6 h-6 rounded-md cursor-pointer border border-white" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-black/5 bg-slate-500/5">
                      <span className="text-[8px] font-black uppercase opacity-40">Sidebar BG</span>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold opacity-60 uppercase">{currentTheme.sidebarBg || '#Default'}</span>
                        <input type="color" value={currentTheme.sidebarBg || '#ffffff'} onChange={(e) => handleCustomColorChange(e, 'sidebarBg')} className="w-6 h-6 rounded-md cursor-pointer border border-white" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-black/5 bg-slate-500/5">
                      <span className="text-[8px] font-black uppercase opacity-40">Sidebar Text</span>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold opacity-60 uppercase">{currentTheme.sidebarText || '#000000'}</span>
                        <input type="color" value={currentTheme.sidebarText || '#000000'} onChange={(e) => handleCustomColorChange(e, 'sidebarText')} className="w-6 h-6 rounded-md cursor-pointer border border-white" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-black/5 bg-slate-500/5">
                      <span className="text-[8px] font-black uppercase opacity-40">Sidebar Active Text</span>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold opacity-60 uppercase">{currentTheme.sidebarActive || '#Default'}</span>
                        <input type="color" value={currentTheme.sidebarActive || '#0369a1'} onChange={(e) => handleCustomColorChange(e, 'sidebarActive')} className="w-6 h-6 rounded-md cursor-pointer border border-white" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-black/5 bg-slate-500/5">
                      <span className="text-[8px] font-black uppercase opacity-40">Sidebar Active BG</span>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold opacity-60 uppercase">{currentTheme.sidebarActiveBg || '#Default'}</span>
                        <input type="color" value={currentTheme.sidebarActiveBg || '#f0f9ff'} onChange={(e) => handleCustomColorChange(e, 'sidebarActiveBg')} className="w-6 h-6 rounded-md cursor-pointer border border-white" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-black/5 bg-slate-500/5">
                      <span className="text-[8px] font-black uppercase opacity-40">Sidebar Hover Text</span>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold opacity-60 uppercase">{currentTheme.sidebarHoverText || '#Default'}</span>
                        <input type="color" value={currentTheme.sidebarHoverText || '#000000'} onChange={(e) => handleCustomColorChange(e, 'sidebarHoverText')} className="w-6 h-6 rounded-md cursor-pointer border border-white" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-black/5 bg-slate-500/5">
                      <span className="text-[8px] font-black uppercase opacity-40">Sidebar Hover BG</span>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold opacity-60 uppercase">{currentTheme.sidebarHoverBg || '#Default'}</span>
                        <input type="color" value={currentTheme.sidebarHoverBg || '#f8fafc'} onChange={(e) => handleCustomColorChange(e, 'sidebarHoverBg')} className="w-6 h-6 rounded-md cursor-pointer border border-white" />
                      </div>
                    </div>
                  </div>

                  <div className="px-3 py-3 rounded-xl border border-black/5 bg-slate-500/5">
                    <div className="flex justify-between items-center mb-2.5 px-1">
                      <span className="text-[8px] font-black uppercase opacity-40">Corners</span>
                      <span className="text-[9px] font-bold opacity-80">{currentTheme.radius}px</span>
                    </div>
                    <input type="range" min="0" max="40" value={currentTheme.radius} onChange={(e) => applyTheme({ borderRadius: e.target.value })} className="w-full h-1 bg-slate-400 rounded-full appearance-none cursor-pointer accent-indigo-500" />
                  </div>

                  <button
                    onClick={() => applyTheme({ glassEffect: !currentTheme.glass })}
                    className={clsx(
                      "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
                      currentTheme.glass 
                        ? (dark ? "bg-white text-slate-900 border-white shadow-lg" : "bg-slate-900 text-white border-slate-900 shadow-lg")
                        : (dark ? "bg-white/5 text-slate-400 border-white/5" : "bg-slate-50 text-slate-400 border-slate-100")
                    )}
                  >
                    <span className="text-[9px] font-bold uppercase">Backdrop Blur Engine</span>
                    <div className={clsx("w-8 h-4 rounded-full p-1 transition-all flex items-center", currentTheme.glass ? "bg-indigo-400" : "bg-slate-400")}>
                      <div className={clsx("w-2 h-2 rounded-full bg-white transition-all", currentTheme.glass ? "translate-x-4" : "translate-x-0")} />
                    </div>
                  </button>
                </div>
              </div>
            )}

            {viewMode === 'architecture' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300 pb-10">
                {pendingSectionOrder.map((sectionId, sIdx) => {
                  const isManagement = sectionId === 'MANAGEMENT';
                  const title = isManagement ? 'Admin Pages' : 'Employee Portal';
                  const modules = isManagement ? MANAGEMENT_MODULES : EMPLOYEE_MODULES;

                  return (
                    <div key={sectionId} className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{title}</span>
                          <div className="h-px flex-1 bg-current opacity-10"></div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button 
                            disabled={sIdx === 0} 
                            onClick={() => moveSection(sIdx, sIdx - 1)} 
                            className={clsx("p-1.5 rounded-lg transition-all", dark ? "hover:bg-white/10 text-white/40" : "hover:bg-black/5 text-slate-400")}
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button 
                            disabled={sIdx === pendingSectionOrder.length - 1} 
                            onClick={() => moveSection(sIdx, sIdx + 1)} 
                            className={clsx("p-1.5 rounded-lg transition-all", dark ? "hover:bg-white/10 text-white/40" : "hover:bg-black/5 text-slate-400")}
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {(() => {
                          const sectionItemsInOrder = pendingOrder.filter(m => modules.includes(m));
                          return pendingOrder.map((item, index) => {
                            if (!modules.includes(item)) return null;
                            const isHidden = pendingHiddenModules.includes(item);
                            const isExpanded = expandedItems[item];
                            const currentPosInSection = sectionItemsInOrder.indexOf(item);
                            
                            return (
                              <div key={item} className="flex flex-col gap-1">
                                <div className={clsx(
                                  "flex items-center justify-between p-3 rounded-2xl border transition-all duration-300", 
                                  isHidden ? "opacity-50 grayscale bg-slate-100/50" : (dark ? "bg-white/5 border-white/5 shadow-inner" : "bg-white border-slate-200/60 shadow-sm")
                                )}>
                                  <div className="flex items-center gap-3">
                                    <div className="cursor-grab active:cursor-grabbing p-1">
                                      <GripVertical size={16} className="opacity-30" />
                                    </div>
                                    <span className="text-[12px] font-bold tracking-tight text-slate-700">
                                      {item === 'emp service' ? 'My Portal / Records' : (item === 'Dashboard' && panel === 'employee' ? 'HR Dashboard' : item)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5">
                                    <button 
                                      onClick={() => toggleVisibility(item)}
                                      className={clsx(
                                        "p-2 rounded-xl transition-all",
                                        isHidden ? "text-rose-500 bg-rose-50" : "text-slate-400 hover:bg-slate-50"
                                      )}
                                      title={isHidden ? "Hidden" : "Visible"}
                                    >
                                      {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                    <div className="flex bg-slate-50 rounded-xl p-0.5 border border-slate-100">
                                      <button 
                                        disabled={currentPosInSection === 0} 
                                        onClick={() => moveItemInSection(item, 'up', modules)} 
                                        className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg disabled:opacity-10 transition-all text-slate-500"
                                      >
                                        <ChevronUp size={14} />
                                      </button>
                                      <button 
                                        disabled={currentPosInSection === sectionItemsInOrder.length - 1} 
                                        onClick={() => moveItemInSection(item, 'down', modules)} 
                                        className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg disabled:opacity-10 transition-all text-slate-500"
                                      >
                                        <ChevronDown size={14} />
                                      </button>
                                    </div>
                                    <button 
                                      onClick={() => setExpandedItems(prev => ({ ...prev, [item]: !isExpanded }))}
                                      className={clsx("p-2 rounded-xl transition-all", isExpanded ? "bg-indigo-50 text-indigo-500" : "text-slate-300 hover:bg-slate-50")}
                                    >
                                      <ChevronDown size={14} className={clsx("transition-transform", isExpanded && "rotate-180")} />
                                    </button>
                                  </div>
                                </div>
                                
                                {isExpanded && (
                                  <div className="mx-4 p-3 rounded-b-2xl border-x border-b border-slate-100 bg-slate-50/50 animate-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center gap-2 opacity-40">
                                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                      <span className="text-[10px] font-medium">Standard HRMS Module Sub-pages</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .theme-studio-popup * {
          font-family: 'Outfit', 'Inter', sans-serif !important;
        }
        .theme-studio-popup::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
