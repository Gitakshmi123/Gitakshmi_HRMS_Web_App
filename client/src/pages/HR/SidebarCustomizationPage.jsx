import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, GripVertical, ChevronDown, Settings2 } from 'lucide-react';
import { useModules } from '../../hooks/useModules';
import { useAuth } from '../../context/AuthContext';
import { getScopedStorageKey } from '../../utils/sidebarStorage';

const STORAGE_BASE_KEY = 'hrms:sidebar:advanced-config:v1';
const DEFAULT_APPEARANCE = {
  sidebarVariant: 'light',
  tabsPlacement: 'top',
  sidebarBgColor: '#ffffff',
  sidebarTextColor: '#0f172a',
  pageBgColor: '#f8fafc',
  pageCardColor: '#ffffff',
  pageTextColor: '#0f172a',
};

const DEFAULT_CONFIG = {
  sectionOrder: ['MANAGEMENT', 'EMPLOYEE'],
  customSections: [],
  moduleVisibility: {},
  moduleSection: {},
  pageVisibility: {},
  moduleOrder: [],
  pageOrder: {},
  appearance: DEFAULT_APPEARANCE
};

const FALLBACK_MODULE_ROWS = [
  { moduleName: 'Dashboard', pages: [{ label: 'Dashboard', route: '/dashboard' }] },
  { moduleName: 'Access', pages: [{ label: 'Access', route: '/access' }] },
  { moduleName: 'Employee', pages: [{ label: 'Employees', route: '/employees' }, { label: 'Departments', route: '/departments' }, { label: 'Org Structure', route: '/org' }, { label: 'Users', route: '/users' }] },
  { moduleName: 'Attendance', pages: [{ label: 'Attendance Dashboard', route: '/attendance' }, { label: 'Calendar', route: '/attendance-calendar' }, { label: 'Face Updates', route: '/face-update-requests' }] },
  { moduleName: 'Policy', pages: [{ label: 'Leave Policies', route: '/leave-policies' }, { label: 'Leave Requests', route: '/leave-approvals' }] },
  { moduleName: 'Payroll', pages: [{ label: 'Payroll Dashboard', route: '/payroll/dashboard' }, { label: 'Salary Components', route: '/payroll/salary-components' }, { label: 'Compensation', route: '/payroll/compensation' }, { label: 'Process Payroll', route: '/payroll/process' }, { label: 'Run History', route: '/payroll/run' }, { label: 'Payslips', route: '/payroll/payslips' }, { label: 'Templates', route: '/payslip-templates' }] },
  { moduleName: 'Hiring', pages: [{ label: 'Job List', route: '/requirements' }, { label: 'Create Requirement', route: '/create-requirement' }, { label: 'Applicants (External)', route: '/applicants' }, { label: 'Applicants (Internal)', route: '/internal-applicants' }, { label: 'Candidate Status', route: '/candidate-status' }, { label: 'Offer Templates', route: '/offer-templates' }, { label: 'Offers & Joining', route: '/offers-joining' }] },
  { moduleName: 'Onboarding', pages: [{ label: 'Onboarding', route: '/onboarding/dashboard' }] },
  { moduleName: 'BGV', pages: [{ label: 'Case Master', route: '/bgv' }, { label: 'Email Logs', route: '/bgv/emails' }] },
  { moduleName: 'Offboarding', pages: [{ label: 'Offboarding', route: '/exit-management' }] },
  { moduleName: 'Ticket Inbox', pages: [{ label: 'Ticket Inbox', route: '/tickets' }] },
  { moduleName: 'Social Media', pages: [{ label: 'Social Media Dashboard', route: '/settings/social-media' }, { label: 'Accounts', route: '/settings/social-media/accounts' }, { label: 'Create Post', route: '/settings/social-media/create' }, { label: 'History', route: '/settings/social-media/history' }] },
  { moduleName: 'Portals', pages: [{ label: 'Career Page', route: '/career-builder' }, { label: 'Apply Page', route: '/apply-builder' }, { label: 'Public Page', route: '/jobs/:code' }] },
  { moduleName: 'Reports', pages: [{ label: 'Staffing Overview', route: '/reports' }, { label: 'Replacement Movements', route: '/reports/replacements' }, { label: 'Hiring Trends', route: '/reports/trends' }, { label: 'Performance', route: '/reports/performance' }] },
  { moduleName: 'Settings', pages: [{ label: 'Company Settings', route: '/settings/company' }, { label: 'Document Sequences', route: '/settings/sequences' }] },
  { moduleName: 'Sub Companies', pages: [{ label: 'Sub Companies', route: '/sub-companies' }] },
  { moduleName: 'EMP Service', pages: [{ label: 'Dashboard', route: '/my-dashboard' }, { label: 'My Attendance', route: '/my-attendance' }, { label: 'My Payslips', route: '/my-payslips' }, { label: 'My Documents', route: '/my-documents' }, { label: 'Internal Jobs', route: '/internal-jobs' }, { label: 'Support Center', route: '/support-center' }, { label: 'Resignation', route: '/resignation' }] },
];

function readConfig(storageKey) {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(storageKey) ||
      localStorage.getItem(STORAGE_BASE_KEY) ||
      '{}'
    );
    const appearance = parsed?.appearance || {};
    return {
      sectionOrder: Array.isArray(parsed?.sectionOrder) ? parsed.sectionOrder : DEFAULT_CONFIG.sectionOrder,
      customSections: Array.isArray(parsed?.customSections) ? parsed.customSections : [],
      moduleVisibility: parsed?.moduleVisibility && typeof parsed.moduleVisibility === 'object' ? parsed.moduleVisibility : {},
      moduleSection: parsed?.moduleSection && typeof parsed.moduleSection === 'object' ? parsed.moduleSection : {},
      pageVisibility: parsed?.pageVisibility && typeof parsed.pageVisibility === 'object' ? parsed.pageVisibility : {},
      moduleOrder: Array.isArray(parsed?.moduleOrder) ? parsed.moduleOrder : [],
      pageOrder: parsed?.pageOrder && typeof parsed.pageOrder === 'object' ? parsed.pageOrder : {},
      appearance: {
        sidebarVariant: ['light', 'dark', 'indigo'].includes(appearance?.sidebarVariant) ? appearance.sidebarVariant : DEFAULT_APPEARANCE.sidebarVariant,
        tabsPlacement: ['top', 'hidden'].includes(appearance?.tabsPlacement) ? appearance.tabsPlacement : DEFAULT_APPEARANCE.tabsPlacement,
        sidebarBgColor: String(appearance?.sidebarBgColor || DEFAULT_APPEARANCE.sidebarBgColor),
        sidebarTextColor: String(appearance?.sidebarTextColor || DEFAULT_APPEARANCE.sidebarTextColor),
        pageBgColor: String(appearance?.pageBgColor || DEFAULT_APPEARANCE.pageBgColor),
        pageCardColor: String(appearance?.pageCardColor || DEFAULT_APPEARANCE.pageCardColor),
        pageTextColor: String(appearance?.pageTextColor || DEFAULT_APPEARANCE.pageTextColor),
      },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export default function SidebarCustomizationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { modules, loading } = useModules();
  const scopedStorageKey = useMemo(
    () => getScopedStorageKey(STORAGE_BASE_KEY, { user }),
    [user]
  );
  const [draft, setDraft] = useState(() => readConfig(scopedStorageKey));
  const [newSection, setNewSection] = useState('');
  const [draggingModule, setDraggingModule] = useState(null);
  const [draggingPage, setDraggingPage] = useState(null);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});

  useEffect(() => {
    setDraft(readConfig(scopedStorageKey));
  }, [scopedStorageKey]);

  const moduleRows = useMemo(() => {
    const parsed = (modules || []).map((m) => {
      const moduleName = String(m.name || 'Module').trim();
      const pages = (m.pages || []).map((p) => {
        const label = String(p.name || p.label || 'Page').trim();
        const route = String(p.route || '').trim();
        return { label, route, key: `${label}::${route}` };
      });
      return { moduleName, pages };
    });
    const withPages = parsed.filter((m) => m.pages.length > 0);
    const source = withPages.length > 0 ? withPages : FALLBACK_MODULE_ROWS;
    const rows = source.map((m) => ({
      ...m,
      pages: (m.pages || []).map((p) => ({ ...p, key: p.key || `${p.label}::${p.route}` })),
    }));
    const order = Array.isArray(draft.moduleOrder) ? draft.moduleOrder : [];
    return [...rows].sort((a, b) => {
      const aIdx = order.indexOf(a.moduleName);
      const bIdx = order.indexOf(b.moduleName);
      const aRank = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx;
      const bRank = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx;
      return aRank - bRank;
    });
  }, [modules, draft.moduleOrder]);

  useEffect(() => {
    setExpandedModules((prev) => {
      const next = {};
      moduleRows.forEach((m, idx) => {
        next[m.moduleName] = Object.prototype.hasOwnProperty.call(prev, m.moduleName) ? prev[m.moduleName] : idx < 3;
      });
      return next;
    });
  }, [moduleRows]);

  const sectionOptions = useMemo(() => {
    const defaults = ['MANAGEMENT', 'EMPLOYEE'];
    const custom = Array.isArray(draft.customSections) ? draft.customSections : [];
    return [...defaults, ...custom];
  }, [draft.customSections]);

  const toggleModule = (moduleName) => {
    setDraft((prev) => ({
      ...prev,
      moduleVisibility: {
        ...prev.moduleVisibility,
        [moduleName]: !(prev.moduleVisibility?.[moduleName] !== false),
      },
    }));
  };

  const setModuleSection = (moduleName, section) => {
    setDraft((prev) => ({
      ...prev,
      moduleSection: {
        ...prev.moduleSection,
        [moduleName]: section,
      },
    }));
  };

  const togglePage = (moduleName, pageKey) => {
    setDraft((prev) => {
      const row = { ...(prev.pageVisibility?.[moduleName] || {}) };
      row[pageKey] = !(row[pageKey] !== false);
      return {
        ...prev,
        pageVisibility: {
          ...prev.pageVisibility,
          [moduleName]: row,
        },
      };
    });
  };

  const addSection = () => {
    const val = String(newSection || '').trim();
    if (!val) return;
    setDraft((prev) => {
      if ((prev.customSections || []).includes(val)) return prev;
      return {
        ...prev,
        customSections: [...(prev.customSections || []), val],
        sectionOrder: [...(prev.sectionOrder || []), val],
      };
    });
    setNewSection('');
  };

  const getNormalizedPageOrder = (moduleName, pages, pageOrderMap) => {
    const allKeys = (pages || []).map((p) => p.key);
    const stored = Array.isArray(pageOrderMap?.[moduleName]) ? pageOrderMap[moduleName] : [];
    return [
      ...stored.filter((k) => allKeys.includes(k)),
      ...allKeys.filter((k) => !stored.includes(k)),
    ];
  };

  const save = () => {
    const normalizedModuleOrder = moduleRows.map((m) => m.moduleName);
    const normalizedPageOrder = moduleRows.reduce((acc, mod) => {
      acc[mod.moduleName] = getNormalizedPageOrder(mod.moduleName, mod.pages || [], draft.pageOrder || {});
      return acc;
    }, {});
    localStorage.setItem(
      scopedStorageKey,
      JSON.stringify({ ...draft, moduleOrder: normalizedModuleOrder, pageOrder: normalizedPageOrder })
    );
    navigate(-1);
  };

  const moveModule = (from, to) => {
    setDraft((prev) => {
      const current = moduleRows.map((m) => m.moduleName);
      const fromIdx = current.indexOf(from);
      const toIdx = current.indexOf(to);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
      const next = [...current];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return { ...prev, moduleOrder: next };
    });
  };

  const movePage = (moduleName, fromKey, toKey, pages) => {
    setDraft((prev) => {
      const current = getNormalizedPageOrder(moduleName, pages, prev.pageOrder || {});
      const fromIdx = current.indexOf(fromKey);
      const toIdx = current.indexOf(toKey);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
      const next = [...current];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return {
        ...prev,
        pageOrder: {
          ...(prev.pageOrder || {}),
          [moduleName]: next,
        },
      };
    });
  };

  const setAppearanceField = (field, value) => {
    setDraft((prev) => ({
      ...prev,
      appearance: {
        ...(prev.appearance || {}),
        [field]: value,
      },
    }));
  };

  const colorField = (label, key, fallback) => (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
      <span className="truncate text-[11px] font-semibold text-slate-600">{label}</span>
      <input
        type="color"
        value={draft.appearance?.[key] || fallback}
        onChange={(e) => setAppearanceField(key, e.target.value)}
        className="h-7 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
      />
    </label>
  );

  return (
    <div className="min-h-[calc(100vh-120px)] rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Sidebar Customization</h2>
            <p className="text-xs text-slate-500">Create sections, hide modules/pages, and place modules wherever you want.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-indigo-700"
          >
            Save Layout
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-4 flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-500">New Custom Section</label>
            <input
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              placeholder="e.g. Hiring Special"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <button
            type="button"
            onClick={addSection}
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-bold uppercase tracking-widest text-indigo-700"
          >
            <Plus size={13} />
            Add
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setAppearanceOpen((prev) => !prev)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <div className="flex items-center gap-2">
              <Settings2 size={14} className="text-slate-500" />
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">Appearance</p>
            </div>
            <ChevronDown size={14} className={`text-slate-500 transition-transform ${appearanceOpen ? 'rotate-180' : ''}`} />
          </button>
          {appearanceOpen && (
            <div className="border-t border-slate-200 px-3 py-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="block text-[11px] font-semibold text-slate-600">Sidebar Theme</span>
                  <select
                    value={draft.appearance?.sidebarVariant || 'light'}
                    onChange={(e) => setAppearanceField('sidebarVariant', e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="indigo">Indigo</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-[11px] font-semibold text-slate-600">Top Tabs</span>
                  <select
                    value={draft.appearance?.tabsPlacement || 'top'}
                    onChange={(e) => setAppearanceField('tabsPlacement', e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="top">Show Top Tabs</option>
                    <option value="hidden">Hide Top Tabs</option>
                  </select>
                </label>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                {colorField('Sidebar BG', 'sidebarBgColor', DEFAULT_APPEARANCE.sidebarBgColor)}
                {colorField('Sidebar Text', 'sidebarTextColor', DEFAULT_APPEARANCE.sidebarTextColor)}
                {colorField('Page BG', 'pageBgColor', DEFAULT_APPEARANCE.pageBgColor)}
                {colorField('Page Card', 'pageCardColor', DEFAULT_APPEARANCE.pageCardColor)}
                {colorField('Page Text', 'pageTextColor', DEFAULT_APPEARANCE.pageTextColor)}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {loading && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
              Loading modules...
            </div>
          )}
          {!loading && moduleRows.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              No modules found. Please refresh once.
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {moduleRows.map((mod) => {
              const visible = draft.moduleVisibility?.[mod.moduleName] !== false;
              const selectedSection = draft.moduleSection?.[mod.moduleName] || 'MANAGEMENT';
              const pageMap = draft.pageVisibility?.[mod.moduleName] || {};
              const pageOrder = getNormalizedPageOrder(mod.moduleName, mod.pages || [], draft.pageOrder || {});
              const pageRank = new Map(pageOrder.map((key, idx) => [key, idx]));
              const orderedPages = [...(mod.pages || [])].sort((a, b) => {
                const aRank = pageRank.has(a.key) ? pageRank.get(a.key) : Number.MAX_SAFE_INTEGER;
                const bRank = pageRank.has(b.key) ? pageRank.get(b.key) : Number.MAX_SAFE_INTEGER;
                return aRank - bRank;
              });
              return (
                <div
                  key={mod.moduleName}
                  draggable
                  onDragStart={() => setDraggingModule(mod.moduleName)}
                  onDragEnd={() => setDraggingModule(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!draggingModule) return;
                    moveModule(draggingModule, mod.moduleName);
                  }}
                  className="rounded-lg border border-slate-200 p-2"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedModules((prev) => ({ ...prev, [mod.moduleName]: !prev[mod.moduleName] }))}
                    className="flex w-full items-center gap-1.5 text-left"
                  >
                    <GripVertical size={13} className="text-slate-400" />
                    <p className="text-xs font-semibold text-slate-800">{mod.moduleName}</p>
                    <span
                      className={`ml-auto rounded-md border px-1.5 py-0.5 text-[9px] font-semibold ${
                        visible ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}
                    >
                      {visible ? 'Visible' : 'Hidden'}
                    </span>
                    <ChevronDown size={13} className={`text-slate-400 transition-transform ${expandedModules[mod.moduleName] ? 'rotate-180' : ''}`} />
                  </button>

                  {expandedModules[mod.moduleName] && (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-[1fr_auto]">
                        <label className="space-y-1">
                          <span className="block text-[10px] font-semibold text-slate-600">Section</span>
                          <select
                            value={selectedSection}
                            onChange={(e) => setModuleSection(mod.moduleName, e.target.value)}
                            className="h-8 w-full rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-700"
                          >
                            {sectionOptions.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <label className="inline-flex items-end">
                          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={visible}
                              onChange={() => toggleModule(mod.moduleName)}
                            />
                            Show
                          </span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                        {orderedPages.map((p) => {
                          const pageVisible = pageMap[p.key] !== false;
                          return (
                            <div
                              key={p.key}
                              draggable
                              onDragStart={() => setDraggingPage({ moduleName: mod.moduleName, pageKey: p.key })}
                              onDragEnd={() => setDraggingPage(null)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => {
                                if (!draggingPage || draggingPage.moduleName !== mod.moduleName) return;
                                movePage(mod.moduleName, draggingPage.pageKey, p.key, mod.pages || []);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700"
                            >
                              <GripVertical size={12} className="text-slate-400" />
                              <label className="inline-flex items-center gap-1.5 truncate">
                                <input
                                  type="checkbox"
                                  checked={pageVisible}
                                  onChange={() => togglePage(mod.moduleName, p.key)}
                                />
                                <span className="truncate">{p.label}</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

