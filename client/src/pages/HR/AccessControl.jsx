import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck, User as UserIcon, Save, Search, RefreshCw, ChevronDown, Users, CheckCheck, X, LayoutGrid, Check, ChevronRight } from 'lucide-react';
import api from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';
import { emitRbacRefetch } from '../../context/RBACContext';
import { useModules } from '../../hooks/useModules';
import { useAuth } from '../../context/AuthContext';
import { ICONS } from '../../components/HRSidebar';
import { safeId } from '../../utils/idHelper';


const PAGE_ACTIONS = ['view', 'create', 'edit', 'delete'];
const ACTION_LABELS = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete' };
const HIDDEN_ACCESS_PERMISSION_KEYS = new Set(['portals.publicPage']);
const ACCESS_BLUE = { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' };
const PALETTES = {
  // UX requirement: keep Access page icons/cards in a single blue theme.
  // (Previously each module had a unique color.)
  Employee: ACCESS_BLUE,
  Organization: ACCESS_BLUE,
  'emp service': ACCESS_BLUE,
  'Access': ACCESS_BLUE,
  Overview: ACCESS_BLUE,
  People: ACCESS_BLUE,
  Offboarding: ACCESS_BLUE,
  Attendance: ACCESS_BLUE,
  Policy: ACCESS_BLUE,
  Payroll: ACCESS_BLUE,
  Hiring: ACCESS_BLUE,
  Onboarding: ACCESS_BLUE,
  BGV: ACCESS_BLUE,
  Settings: ACCESS_BLUE,
  'Social Media': ACCESS_BLUE,
  Portals: ACCESS_BLUE,
  Support: ACCESS_BLUE,
  'Ticket Inbox': ACCESS_BLUE,
  Reports: ACCESS_BLUE,
  Approvals: ACCESS_BLUE,
};

const initials = (name = '') => name.split(' ').map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();
const slugifyKey = (label = '') => String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function avatarGradient(name = '') {
  const g = [['#3b82f6', '#6366f1'], ['#10b981', '#0d9488'], ['#f59e0b', '#f97316'], ['#8b5cf6', '#a855f7'], ['#ef4444', '#f43f5e'], ['#06b6d4', '#0ea5e9'], ['#ec4899', '#db2777'], ['#4F46E5', '#0d9488']];
  return g[(name.charCodeAt(0) || 0) % g.length];
}

function permissionMap(existing = []) {
  const map = {};
  existing.forEach((p) => { if (p?.module) map[p.module] = p.actions || p || {}; });
  return map;
}

function shouldHideAccessPage(page = {}, moduleName = '') {
  const permissionKey = String(page.permissionKey || page.module || '').trim();
  const pageName = String(page.name || page.label || '').trim().toLowerCase();

  return HIDDEN_ACCESS_PERMISSION_KEYS.has(permissionKey) || (moduleName === 'Portals' && pageName === 'public page');
}

function clonePage(page, map) {
  const source = page.permissionKey ? map[page.permissionKey] || {} : {};
  const actions = {
    view: !!source.view,
    create: !!source.create,
    edit: !!source.edit,
    delete: !!source.delete,
  };

  return {
    ...page,
    label: page.name,
    actions,
    children: (page.children || []).map((child) => clonePage(child, map)),
  };
}

function buildStateFromDynamic(dynamicModules = [], existing = []) {
  const map = permissionMap(existing);
  let reportPageData = null;
  let hasSupportModuleInDynamic = false;

  const sectionsMap = new Map();

  dynamicModules.forEach((module) => {
    let moduleName = module.name;
    const lowerName = (moduleName || '').toLowerCase();
    
    // Hide Documents in Access Control (user-requested)
    if (lowerName.includes('document management') || lowerName === 'documents' || lowerName === 'document') return;

    // Normalization
    if (moduleName === 'Overview') moduleName = 'Dashboard';
    if (moduleName === 'People') moduleName = 'Employee';
    if (moduleName === 'Leave') moduleName = 'Policy';
    if (moduleName === 'Access Control') moduleName = 'Access';
    if (moduleName === 'Support' || moduleName === 'Ticket Inbox') moduleName = 'Ticket Inbox';

    const allPages = (module.pages || []);
    let pages = allPages.filter(page => {
      if (shouldHideAccessPage(page, moduleName)) return false;
      if (page.name === 'Reports' || page.label === 'Reports') {
        reportPageData = page;
        return false;
      }
      return true;
    }).map((page, pIdx) => ({
      ...clonePage(page, map),
      _id: safeId(page._id) || `page-${pIdx}`
    }));

    if (moduleName === 'Attendance' || moduleName === 'Social Media') {
      pages = pages.map(p => {
        const lowerLabel = (p.name || p.label || '').toLowerCase();
        // Renaming to avoid collisions while keeping it user-friendly
        if (lowerLabel === 'dashboard' || (lowerLabel.includes('dashboard') && lowerLabel.length < 15) || lowerLabel === moduleName.toLowerCase()) {
          return { ...p, name: `${moduleName} Dashboard`, label: `${moduleName} Dashboard` };
        }
        return p;
      });
    }

    if (moduleName === 'Ticket Inbox') hasSupportModuleInDynamic = true;

    // Deduplication logic: Keep the module with more pages if names match
    const existing = sectionsMap.get(moduleName);
    if (!existing || pages.length > existing.pages.length) {
        if (pages.length > 0 || moduleName === 'Dashboard') {
            sectionsMap.set(moduleName, {
                key: slugifyKey(moduleName),
                label: moduleName,
                icon: module.icon,
                ...(PALETTES[moduleName] || { color: '#6366f1', bg: '#f5f7ff', border: '#e0e7ff', text: '#4338ca' }),
                pages,
            });
        }
    }
  });

  // Manually inject Onboarding module if missing from dynamic modules.
  // This matches the HR sidebar behavior and ensures Access page can manage its permissions.
  if (!sectionsMap.has('Onboarding')) {
    const existingOnboarding = map['onboarding.dashboard'] || {};
    sectionsMap.set('Onboarding', {
      key: 'onboarding',
      label: 'Onboarding',
      icon: 'onboarding',
      ...(PALETTES['Onboarding'] || { color: '#f97316', bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' }),
      pages: [{
        _id: 'manual-onboarding-dashboard',
        name: 'Onboarding',
        label: 'Onboarding',
        permissionKey: 'onboarding.dashboard',
        actions: {
          view: !!existingOnboarding.view,
          create: !!existingOnboarding.create,
          edit: !!existingOnboarding.edit,
          delete: !!existingOnboarding.delete
        },
        children: []
      }]
    });
  }

  const sections = Array.from(sectionsMap.values());

  // Manually inject Dashboard if missing or empty
  const existingDash = sections.find(s => s.label === 'Dashboard');
  if (!existingDash) {
      sections.push({
          key: 'manual-dashboard',
          label: 'Dashboard',
          icon: 'dashboard',
          ...(PALETTES['Overview'] || { color: '#6366f1', bg: '#f5f7ff', border: '#e0e7ff', text: '#4338ca' }),
        pages: [{
          _id: 'manual-dashboard-page',
          name: 'Dashboard',
          label: 'Dashboard',
          permissionKey: 'overview.dashboard',
          actions: { 
            view: !!(map['overview.dashboard']?.view), 
            create: !!(map['overview.dashboard']?.create), 
            edit: !!(map['overview.dashboard']?.edit), 
            delete: !!(map['overview.dashboard']?.delete) 
          },
          children: []
        }]
      });
    } else if (existingDash.pages.length === 0) {
      existingDash.pages = [{
        _id: 'manual-dashboard-page',
        name: 'Dashboard',
        label: 'Dashboard',
        permissionKey: 'overview.dashboard',
        actions: { 
          view: !!(map['overview.dashboard']?.view), 
          create: !!(map['overview.dashboard']?.create), 
          edit: !!(map['overview.dashboard']?.edit), 
          delete: !!(map['overview.dashboard']?.delete) 
        },
        children: []
      }];
    }

  // If Support was NOT found in dynamic modules, manually inject Ticket Inbox
  if (!hasSupportModuleInDynamic && !sections.some(s => s.label === 'Ticket Inbox')) {
    const existing = map['support.tickets'] || {};
    sections.push({
      key: 'ticket-inbox',
      label: 'Ticket Inbox',
      icon: 'support',
      ...(PALETTES['Ticket Inbox'] || { color: '#6366f1', bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' }),
      pages: [{
        _id: 'manual-support-page',
        name: 'Ticket Inbox',
        label: 'Ticket Inbox',
        permissionKey: 'support.tickets',
        actions: { view: !!existing.view, create: !!existing.create, edit: !!existing.edit, delete: !!existing.delete },
        children: []
      }]
    });
  }

  // If we extracted a Report page, add it as a standalone item
  if (reportPageData && !sections.some(s => s.label === 'Reports')) {
    sections.push({
      key: 'system-reports',
      label: 'Reports',
      icon: 'history',
      color: '#6366f1', bg: '#f5f7ff', border: '#e0e7ff', text: '#4338ca',
      pages: [{
        ...clonePage(reportPageData, map),
        _id: reportPageData._id
      }]
    });
  }

  // Ensure legacy management module cards are always visible on Access page
  // even when dynamic module payload is partial.
  const ensureSection = (label, icon, permissionKey, route = null) => {
    const exists = sections.some((s) => String(s.label || '').toLowerCase() === String(label).toLowerCase());
    if (exists) return;
    const existingPerm = map[permissionKey] || {};
    sections.push({
      key: slugifyKey(label),
      label,
      icon,
      ...(PALETTES[label] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', text: '#334155' }),
      pages: [
        {
          _id: `manual-${slugifyKey(label)}-page`,
          name: label,
          label,
          permissionKey,
          route: route || slugifyKey(label),
          actions: {
            view: !!existingPerm.view,
            create: !!existingPerm.create,
            edit: !!existingPerm.edit,
            delete: !!existingPerm.delete,
          },
          children: [],
        },
      ],
    });
  };

  ensureSection('Dashboard', 'dashboard', 'overview.dashboard', 'dashboard');
  ensureSection('Access', 'access', 'configuration.access', 'access');
  ensureSection('Employee', 'employees', 'people.employees', 'employees');
  ensureSection('Attendance', 'attendance', 'attendance.dashboard', 'attendance');
  ensureSection('Policy', 'leavePolicies', 'leave.requests', 'leave-approvals');
  ensureSection('Payroll', 'payrollDashboard', 'payroll.stats', 'payroll/dashboard');
  ensureSection('Hiring', 'requirements', 'hiring.jobList', 'requirements');
  ensureSection('BGV', 'bgv', 'bgv.caseMaster', 'bgv');
  ensureSection('Settings', 'company', 'configuration.company', 'settings/company');
  ensureSection('Social Media', 'social', 'socialMedia.dashboard', 'settings/social-media');
  ensureSection('Portals', 'viewCareers', 'portals.careerPage', 'career-builder');
  ensureSection('Ticket Inbox', 'support', 'support.tickets', 'tickets');
  ensureSection('Reports', 'history', 'reports.staffing', 'reports');
  ensureSection('Offboarding', 'exit', 'offboarding.exit', 'exit-management');
  ensureSection('Approvals', 'history', 'approval.view', 'approvals');
  ensureSection('Organization', 'organization', 'company.subCompanies');

  // If modules-full payload is partial (often only 1 page per module),
  // inject the expected subpages so Access Control can manage granular permissions.
  const FALLBACK_PAGES_BY_SECTION = {
    Dashboard: [{ name: 'Dashboard', permissionKey: 'overview.dashboard', route: 'dashboard' }],
    Access: [{ name: 'Access', permissionKey: 'configuration.access', route: 'access' }],
    Employee: [
      { name: 'Employees', permissionKey: 'people.employees', route: 'employees' },
      { name: 'Departments', permissionKey: 'people.departments', route: 'departments' },
      { name: 'Org Structure', permissionKey: 'people.org', route: 'org' },
      { name: 'Users', permissionKey: 'people.users', route: 'users' },
    ],
    Attendance: [
      { name: 'Attendance Dashboard', permissionKey: 'attendance.dashboard', route: 'attendance' },
      { name: 'History', permissionKey: 'attendance.history', route: 'attendance-history' },
      { name: 'Live Tracking', permissionKey: 'attendance.liveTracking', route: 'attendance-live-tracking' },
      { name: 'Calendar', permissionKey: 'attendance.calendar', route: 'attendance-calendar' },
      { name: 'Face Updates', permissionKey: 'attendance.face', route: 'face-update-requests' },
      { name: 'Settings', permissionKey: 'attendance.settings', route: 'attendance-settings' },
    ],
    Policy: [
      { name: 'Leave Policies', permissionKey: 'leave.policies', route: 'leave-policies' },
      { name: 'Leave Requests', permissionKey: 'leave.requests', route: 'leave-approvals' },
      { name: 'Custom Mapping', permissionKey: 'leave.custom', route: 'leave-policies/custom' },
    ],
    Payroll: [
      { name: 'Payroll Dashboard', permissionKey: 'payroll.stats', route: 'payroll/dashboard' },
      { name: 'Salary Components', permissionKey: 'payroll.salary', route: 'payroll/salary-components' },
      { name: 'Compensation', permissionKey: 'payroll.compensation', route: 'payroll/compensation' },
      { name: 'Process Payroll', permissionKey: 'payroll.process', route: 'payroll/process' },
      { name: 'Run History', permissionKey: 'payroll.run', route: 'payroll/run' },
      { name: 'Payslips', permissionKey: 'payroll.payslips', route: 'payroll/payslips' },
      { name: 'Templates', permissionKey: 'payroll.templates', route: 'payroll/payslip-templates' },
    ],
    Hiring: [
      { name: 'Job List', permissionKey: 'hiring.jobList', route: 'requirements' },
      { name: 'Create Requirement', permissionKey: 'hiring.createReq', route: 'create-requirement' },
      { name: 'Applicants (External)', permissionKey: 'hiring.external', route: 'applicants' },
      { name: 'Applicants (Internal)', permissionKey: 'hiring.internal', route: 'internal-applicants' },
      { name: 'Candidate Status', permissionKey: 'hiring.tracker', route: 'candidate-status' },
      { name: 'Offer Templates', permissionKey: 'hiring.offerTemplates', route: 'offer-templates' },
      { name: 'Offers & Joining', permissionKey: 'hiring.offersJoining', route: 'offers-joining' },
    ],
    Onboarding: [
      { name: 'Onboarding Dashboard', permissionKey: 'onboarding.dashboard', route: 'onboarding/dashboard' },
      { name: 'Onboarding Templates', permissionKey: 'onboarding.templates', route: 'onboarding/templates' },
    ],
    BGV: [
      { name: 'Case Master', permissionKey: 'bgv.caseMaster', route: 'bgv' },
      { name: 'Email Logs', permissionKey: 'bgv.emailLogs', route: 'bgv/emails' },
    ],
    Offboarding: [{ name: 'Offboarding', permissionKey: 'offboarding.exit', route: 'exit-management' }],
    'Ticket Inbox': [{ name: 'Ticket Inbox', permissionKey: 'support.tickets', route: 'tickets' }],
    'Social Media': [
      { name: 'Social Media Dashboard', permissionKey: 'socialMedia.dashboard', route: 'settings/social-media' },
      { name: 'Accounts', permissionKey: 'socialMedia.accounts', route: 'settings/social-media/accounts' },
      { name: 'Create Post', permissionKey: 'socialMedia.create', route: 'settings/social-media/create' },
      { name: 'History', permissionKey: 'socialMedia.history', route: 'settings/social-media/history' },
    ],
    Portals: [
      { name: 'Career Page', permissionKey: 'portals.careerPage', route: 'career-builder' },
      { name: 'Apply Page', permissionKey: 'portals.applyPage', route: 'apply-builder' },
      { name: 'Public Page', permissionKey: 'portals.publicPage', route: 'public-page' },
    ],
    Reports: [
      { name: 'Staffing Overview', permissionKey: 'reports.staffing', route: 'reports' },
      { name: 'Replacement Movements', permissionKey: 'reports.movements', route: 'reports/replacements' },
      { name: 'Hiring Trends', permissionKey: 'reports.trends', route: 'reports/trends' },
      { name: 'Performance', permissionKey: 'reports.performance', route: 'reports/performance' },
    ],
    Approvals: [
      { name: 'My Approvals', permissionKey: 'approval.view', route: 'approvals' },
      { name: 'Approve / Reject', permissionKey: 'approval.approve', route: 'approvals' },
      { name: 'Workflow Setup', permissionKey: 'approval.workflow.manage', route: 'settings/workflows' },
    ],
    Settings: [
      { name: 'Company Settings', permissionKey: 'configuration.company', route: 'settings/company' },
      { name: 'Document Sequences', permissionKey: 'configuration.sequences', route: 'settings/sequences' },
    ],
    Organization: [{ name: 'Organization', permissionKey: 'company.subCompanies', route: 'organization' }],
  };

  const upsertPages = (sectionLabel) => {
    const section = sections.find((s) => String(s.label || '') === String(sectionLabel));
    if (!section) return;
    const fallback = FALLBACK_PAGES_BY_SECTION[sectionLabel];
    if (!Array.isArray(fallback) || fallback.length === 0) return;

    const existingKeys = new Set(
      (section.pages || [])
        .map((p) => String(p.permissionKey || '').trim())
        .filter(Boolean),
    );

    const merged = [...(section.pages || [])];
    fallback.forEach((spec, idx) => {
      const permissionKey = String(spec.permissionKey || '').trim();
      if (!permissionKey || existingKeys.has(permissionKey)) return;
      if (shouldHideAccessPage({ permissionKey, name: spec.name }, sectionLabel)) return;
      const existingPerm = map[permissionKey] || {};
      merged.push({
        _id: `manual-${slugifyKey(sectionLabel)}-${slugifyKey(permissionKey)}-${idx}`,
        name: spec.name,
        label: spec.name,
        permissionKey,
        route: spec.route,
        actions: {
          view: !!existingPerm.view,
          create: !!existingPerm.create,
          edit: !!existingPerm.edit,
          delete: !!existingPerm.delete,
        },
        children: [],
      });
      existingKeys.add(permissionKey);
    });

    section.pages = merged;
  };

  Object.keys(FALLBACK_PAGES_BY_SECTION).forEach(upsertPages);

  // User requirement: Access Control should show ONLY ONE Onboarding page.
  // Even if modules-full returns multiple onboarding pages, keep the dashboard entry only.
  const onboardingSection = sections.find((s) => String(s.label || '') === 'Onboarding');
  if (onboardingSection) {
    const key = 'onboarding.dashboard';
    const tempKey = 'onboarding.templates';
    const existingPerm = map[key] || {};
    const tempPerm = map[tempKey] || {};
    onboardingSection.pages = [
      {
        _id: 'manual-onboarding-dashboard-only',
        name: 'Onboarding Dashboard',
        label: 'Onboarding Dashboard',
        permissionKey: key,
        actions: {
          view: !!existingPerm.view,
          create: !!existingPerm.create,
          edit: !!existingPerm.edit,
          delete: !!existingPerm.delete,
        },
        children: [],
      },
      {
        _id: 'manual-onboarding-templates-only',
        name: 'Onboarding Templates',
        label: 'Onboarding Templates',
        permissionKey: tempKey,
        actions: {
          view: !!tempPerm.view,
          create: !!tempPerm.create,
          edit: !!tempPerm.edit,
          delete: !!tempPerm.delete,
        },
        children: [],
      },
    ];
  }

 if (!sections.some((s) => String(s.label || '').toLowerCase() === 'emp service')) {
    const page = (name, permissionKey) => {
      const source = map[permissionKey] || {};
      return {
        _id: `manual-ess-${slugifyKey(permissionKey)}`,
        name,
        label: name,
        permissionKey,
        actions: {
          // USER REQUEST: Always enable EMP SERVICE permissions by default.
          // If source has data, use it, otherwise default to true.
          // To strictly follow "always on initially", we can force true if not explicitly set.
          view: source.view !== undefined ? !!source.view : true,
          create: source.create !== undefined ? !!source.create : true,
          edit: source.edit !== undefined ? !!source.edit : true,
          delete: source.delete !== undefined ? !!source.delete : true,
        },
        children: []
      };
    };

    sections.push({
      key: 'emp-service',
      label: 'emp service',
      icon: 'dashboard',
      ...(PALETTES['emp service'] || { color: '#6366f1', bg: '#f5f7ff', border: '#e0e7ff', text: '#4338ca' }),
      pages: [
        page('Dashboard', 'employee.dashboard'),
        page('My Attendance', 'employee.attendance'),
        page('My Payslips', 'employee.payslips'),
        page('My Documents', 'employee.documents'),
        page('Internal Jobs', 'employee.jobs'),
        page('Support Center', 'employee.tickets'),
        page('Resignation', 'employee.exit')
      ]
    });
  }

  // Requirements: Ensure EMP Service module always displays correct state
  // (Redundant logic removed as clonePage now handles 'employee.' keys globally)
  const empSection = sections.find((s) => String(s.label || '').toLowerCase() === 'emp service');
  if (empSection?.pages?.length) {
    // Already handled by clonePage recursion
  }

  // Custom sorting based on user-requested order
  const customOrder = [
    'Dashboard', 
    'Access', 
    'Employee', 
    'Attendance', 
    'Policy', 
    'Payroll', 
    'Hiring', 
    'Onboarding',
    'BGV', 
    'Offboarding',
    'Ticket Inbox', 
    'Social Media',
    'Portals',
    'Reports',
    'Approvals',
    'Settings',
    'Organization'
  ];

  sections.sort((a, b) => {
    // ESS module always last
    const nameA = String(a.label || '').toLowerCase();
    const nameB = String(b.label || '').toLowerCase();
    if (nameA === 'emp service') return 1;
    if (nameB === 'emp service') return -1;

    const idxA = customOrder.findIndex(o => (a.label || '').toLowerCase().includes(o.toLowerCase()));
    const idxB = customOrder.findIndex(o => (b.label || '').toLowerCase().includes(o.toLowerCase()));
    
    if (idxA > -1 && idxB > -1) return idxA - idxB;
    if (idxA > -1) return -1;
    if (idxB > -1) return 1;
    return 0;
  });

  return sections;
}

function serializePages(pages = []) {
  return pages.flatMap((page) => [
    ...(page.permissionKey ? [{ module: page.permissionKey, actions: page.actions }] : []),
    ...serializePages(page.children || []),
  ]);
}

function countPages(pages = []) {
  return pages.reduce((sum, page) => sum + (page.permissionKey ? 1 : 0) + countPages(page.children || []), 0);
}
function countEnabled(pages = []) {
  return pages.reduce((sum, page) => sum + (page.permissionKey ? Object.values(page.actions || {}).filter(Boolean).length : 0) + countEnabled(page.children || []), 0);
}
function countActions(pages = []) {
  return pages.reduce((sum, page) => sum + (page.permissionKey ? PAGE_ACTIONS.length : 0) + countActions(page.children || []), 0);
}

function updatePageTree(pages, targetId, updater) {
  return pages.map((page) => {
    if (page._id === targetId) return updater(page);
    if (page.children?.length) return { ...page, children: updatePageTree(page.children, targetId, updater) };
    return page;
  });
}

function mapPageTree(pages, mapper) {
  return pages.map((page) => ({ ...mapper(page), children: mapPageTree(page.children || [], mapper) }));
}

function PermissionRows({ pages, moduleKey, palette, onToggleAction, onTogglePage, depth = 0, gridTemplate = '1fr 80px 80px 80px 80px 90px', actionsToRender = PAGE_ACTIONS }) {
  return pages.map((page, idx) => {
    const onCount = page.permissionKey ? Object.values(page.actions || {}).filter(Boolean).length : 0;
    const allOn = page.permissionKey && onCount === PAGE_ACTIONS.length;
    const allOff = onCount === 0;

    return (
      <React.Fragment key={safeId(page._id)}>
        <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 6, padding: '8px 10px', borderRadius: 9, background: idx % 2 === 0 ? '#fafafa' : 'white', marginBottom: 3, marginLeft: depth * 18, alignItems: 'center', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: onCount > 0 ? palette.color : '#e2e8f0', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{page.name || page.label}</span>
            {page.permissionKey && onCount > 0 && <span style={{ fontSize: 9, color: palette.text, background: palette.bg, padding: '1px 7px', borderRadius: 10, fontWeight: 600, border: `1px solid ${palette.border}` }}>{onCount}/{PAGE_ACTIONS.length}</span>}
          </div>

          {actionsToRender.map((action) => {
            const isOn = page.permissionKey ? page.actions[action] : false;
            
            // Special case: Org Structure is view-only
            const isOrgStructure = (page.name === 'Org Structure' || page.label === 'Org Structure' || page.permissionKey === 'people.org');
            
            // Attendance Module Granular Rules
            const pageName = String(page.name || page.label || '').toLowerCase();
            const isAttendance = pageName === 'attendance';
            const isLiveTracking = pageName === 'live tracking' || pageName === 'tracking';
            const isCalendar = pageName === 'calendar';
            const isHistory = pageName === 'history';
            const isFaceUpdates = pageName === 'face updates' || pageName === 'face';
            const isSettings = pageName === 'settings';

            let isHiddenForPage = false;
            if (isOrgStructure) {
              isHiddenForPage = (action === 'create' || action === 'edit' || action === 'delete');
            } else if (moduleKey === 'attendance' || moduleKey === 'manual-attendance') {
              if (isAttendance || isHistory) {
                // Keep View, Create, Edit. Hide Delete.
                isHiddenForPage = (action === 'delete');
              } else if (isLiveTracking) {
                // View Only
                isHiddenForPage = (action === 'create' || action === 'edit' || action === 'delete');
              } else if (isCalendar) {
                // Bulk Upload, Add Holiday, Edit, Delete (Holidays)
                isHiddenForPage = false;
              } else if (isFaceUpdates) {
                // View, Edit, Delete. Hide Create.
                isHiddenForPage = (action === 'create');
              } else if (isSettings) {
                // Settings (Shifts): Full CRUD needed to add/delete shifts
                isHiddenForPage = false;
              }
            } else if (moduleKey === 'payroll') {
              const lowerLabel = (page.name || page.label || '').toLowerCase();
              
              if (lowerLabel.includes('dashboard')) {
                // Payroll Dashboard: View Only
                isHiddenForPage = (action === 'create' || action === 'edit' || action === 'delete');
              } else if (lowerLabel.includes('salary components') || lowerLabel.includes('templates')) {
                // Salary Components & Payslip Templates: Full CRUD
                isHiddenForPage = false;
              } else {
                // Compensation, Process Payroll, Run History, Payslips: No Delete
                isHiddenForPage = (action === 'delete');
              }
            } else if (moduleKey === 'hiring') {
              const lowerLabel = (page.name || page.label || '').toLowerCase();
              
              if (lowerLabel === 'hiring' || lowerLabel === 'create requirement') {
                // Job List / Create Requirement: View, Create, Edit. Hide Delete.
                isHiddenForPage = (action === 'delete');
              } else if (lowerLabel.includes('applicants (external)')) {
                // External Applicants: View, Edit. Hide Create, Delete.
                isHiddenForPage = (action === 'create' || action === 'delete');
              } else if (lowerLabel.includes('offer templates')) {
                // Offer Templates: Full CRUD
                isHiddenForPage = false;
              } else {
                // Applicants (Internal), Candidate Status, Offers & Joining: View Only
                isHiddenForPage = (action === 'create' || action === 'edit' || action === 'delete');
              }
            } else if (moduleKey === 'onboarding') {
              const lowerLabel = (page.name || page.label || '').toLowerCase();
              
              if (lowerLabel.includes('dashboard') || lowerLabel.includes('templates')) {
                // Onboarding Dashboard (Invite/Verify) & Templates (Create/Edit): No Delete
                isHiddenForPage = (action === 'delete');
              } else {
                // Other onboarding pages (if any): View Only
                isHiddenForPage = (action === 'create' || action === 'edit' || action === 'delete');
              }
            } else if (moduleKey === 'bgv') {
              const lowerLabel = (page.name || page.label || '').toLowerCase();
              
              if (lowerLabel.includes('case master') || lowerLabel === 'bgv') {
                // BGV Dashboard: View, Create, Edit. Hide Delete (button is empty/non-functional).
                isHiddenForPage = (action === 'delete');
              } else if (lowerLabel.includes('email logs')) {
                // Email Logs & Templates: Full CRUD
                isHiddenForPage = false;
              }
            } else if (moduleKey === 'offboarding') {
              // Offboarding: View and Edit (Manage) only. Hide Create and Delete.
              isHiddenForPage = (action === 'create' || action === 'delete');
            } else if (moduleKey === 'ticket-inbox') {
              // Ticket Inbox: View and Edit (Reply/Status) only. Hide Create and Delete.
              isHiddenForPage = (action === 'create' || action === 'delete');
            } else if (moduleKey === 'social-media') {
              // Social Media Module Granular Rules
              const pageKey = slugifyKey(page.name || page.label);
              if (pageKey === 'social-media') {
                // Dashboard: View only
                isHiddenForPage = (action === 'create' || action === 'edit' || action === 'delete');
              } else if (pageKey === 'accounts') {
                // Accounts: View, Create (Connect), Delete (Disconnect)
                isHiddenForPage = (action === 'edit');
              } else if (pageKey === 'create-post') {
                // Create Post: View, Create (Publish)
                isHiddenForPage = (action === 'edit' || action === 'delete');
              } else if (pageKey === 'history') {
                // History: View, Edit (Modify/Retry), Delete
                isHiddenForPage = (action === 'create');
              }
            } else if (moduleKey === 'reports') {
              // Reports Module Granular Rules
              const pageKey = slugifyKey(page.name || page.label);
              if (pageKey === 'staffing-overview') {
                // Staffing Overview: View and Edit (Send Reminders)
                isHiddenForPage = (action === 'create' || action === 'delete');
              } else if (pageKey === 'replacement-movements') {
                // Replacement Movements: View, Edit, Delete (End Movement)
                isHiddenForPage = (action === 'create');
              } else if (pageKey === 'hiring-trends') {
                // Hiring Trends: View Only
                isHiddenForPage = (action === 'create' || action === 'edit' || action === 'delete');
              } else if (pageKey === 'performance') {
                // Performance: View and Edit (Export)
                isHiddenForPage = (action === 'create' || action === 'delete');
              }
            } else if (moduleKey === 'settings') {
              // Settings Module Granular Rules
              const pageKey = slugifyKey(page.name || page.label);
              if (pageKey === 'settings' || pageKey === 'document-sequences') {
                // Settings & Sequences: View and Edit only. No Create/Delete.
                isHiddenForPage = (action === 'create' || action === 'delete');
              }
            } else if (moduleKey === 'organization') {
              // Organization Module Granular Rules
              const pageKey = slugifyKey(page.name || page.label);
              if (pageKey === 'organization') {
                // Organization: View, Create, Edit only. (Status toggle instead of delete)
                isHiddenForPage = (action === 'delete');
              }
            } else if (moduleKey === 'emp-service') {
              // EMP Service (ESS) Module Granular Rules
              const pageKey = slugifyKey(page.name || page.label);
              if (pageKey === 'dashboard') {
                // Dashboard: Allow View and Create (used for birthday/feature toggles)
                isHiddenForPage = (action === 'edit' || action === 'delete');
              } else if (pageKey === 'my-payslips') {
                // Payslips: View Only
                isHiddenForPage = (action === 'create' || action === 'edit' || action === 'delete');
              } else if (pageKey === 'my-documents') {
                // Documents: View, Create (Upload), Delete. No Edit.
                isHiddenForPage = (action === 'edit');
              } else if (pageKey === 'internal-jobs' || pageKey === 'support-center' || pageKey === 'resignation') {
                // Jobs/Support/Exit: View and Create (Apply/Submit). No Edit/Delete.
                isHiddenForPage = (action === 'edit' || action === 'delete');
              }
              // My Attendance remains full CRUD (Regularization, Early Return, Cancel Request)
            }

            return (
              <div key={action} style={{ display: 'flex', justifyContent: 'center' }}>
                {!isHiddenForPage && (
                  <button
                    onClick={() => page.permissionKey && onToggleAction(moduleKey, page._id, action)}
                    disabled={!page.permissionKey}
                    style={{ width: 36, height: 22, borderRadius: 11, border: 'none', cursor: page.permissionKey ? 'pointer' : 'not-allowed', background: isOn ? palette.color : '#e2e8f0', position: 'relative', opacity: page.permissionKey ? 1 : 0.45 }}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: isOn ? 17 : 3, transition: 'left 0.2s ease' }} />
                  </button>
                )}
              </div>
            );
          })}

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => page.permissionKey && onTogglePage(moduleKey, page._id, !allOn)}
              disabled={!page.permissionKey}
              style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: page.permissionKey ? 'pointer' : 'not-allowed', background: allOn ? palette.color : allOff ? '#f8fafc' : palette.bg, color: allOn ? 'white' : allOff ? '#94a3b8' : palette.text, border: `1px solid ${allOn ? palette.color : '#e2e8f0'}`, opacity: page.permissionKey ? 1 : 0.45 }}
            >
              {allOn ? 'Off' : 'All'}
            </button>
          </div>
        </div>

        {page.children?.length > 0 && (
          <PermissionRows 
            pages={page.children} 
            moduleKey={moduleKey} 
            palette={palette} 
            onToggleAction={onToggleAction} 
            onTogglePage={onTogglePage} 
            depth={depth + 1} 
            gridTemplate={gridTemplate}
            actionsToRender={actionsToRender}
          />
        )}
      </React.Fragment>
    );
  });
}

export default function AccessControl() {
  const { user } = useAuth();
  const { modules: dynamicModules } = useModules();
  const [employees, setEmployees] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modState, setModState] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [activeModule, setActiveModule] = useState(null);
  const dropRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { fetchEmployees(); }, []);
  useEffect(() => {
    const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) { setDropdownOpen(false); setSearchQuery(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  useEffect(() => {
    if (!selectedUser) return;
    const next = buildStateFromDynamic(dynamicModules, selectedUser.permissions || []);
    setModState(next);
  }, [selectedUser, dynamicModules]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const r = await api.get('/hr/employees');
      setEmployees(r.data.data || r.data);
    } catch (err) {
      if (err.response?.status === 403) {
        showToast('success', 'Management System Check', 'Limited module visibility based on current administrative settings.');
      } else {
        showToast('error', 'Network Error', 'The system encountered a problem fetching the employee directory.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (emp) => {
    setDropdownOpen(false);
    setSearchQuery('');
    try {
      setLoadingUser(true);
      const empId = safeId(emp._id);
      const r = await api.get(`/roles/user/${empId}`);
      const u = r.data.data;
      u._employeeId = safeId(emp._id);
      setSelectedUser({ ...emp, ...u });
      const next = buildStateFromDynamic(dynamicModules, u.permissions || []);
      setModState(next);
      setActiveModule(null);
    } catch {
      showToast('error', 'Error', 'Failed to load permissions');
    } finally {
      setLoadingUser(false);
    }
  };

  const toggleAction = (moduleKey, pageId, action) => {
    setModState((prev) => prev.map((mod) => mod.key !== moduleKey ? mod : { ...mod, pages: updatePageTree(mod.pages, pageId, (page) => ({ ...page, actions: { ...page.actions, [action]: !page.actions[action] } })) }));
  };
  const togglePage = (moduleKey, pageId, value) => {
    setModState((prev) => prev.map((mod) => mod.key !== moduleKey ? mod : { ...mod, pages: updatePageTree(mod.pages, pageId, (page) => ({ ...page, actions: Object.fromEntries(PAGE_ACTIONS.map((a) => [a, value])) })) }));
  };
  const toggleModule = (moduleKey, value) => {
    setModState((prev) => prev.map((mod) => mod.key !== moduleKey ? mod : { ...mod, pages: mapPageTree(mod.pages, (page) => ({ ...page, actions: page.permissionKey ? Object.fromEntries(PAGE_ACTIONS.map((a) => [a, value])) : page.actions })) }));
  };

  const setAllAccess = (value) => {
    setModState((prev) =>
      prev.map((mod) => ({
        ...mod,
        pages: mapPageTree(mod.pages, (page) => ({
          ...page,
          actions: page.permissionKey
            ? Object.fromEntries(PAGE_ACTIONS.map((a) => [a, value]))
            : page.actions,
        })),
      }))
    );
  };

  const save = async () => {
    try {
      setSaving(true);
      const payload = modState.flatMap((mod) => serializePages(mod.pages));
      const rawId = selectedUser.userId || selectedUser._id || selectedUser._employeeId;
      if (!rawId) {
        showToast('error', 'Error', 'Cannot identify user — please re-select the employee and try again.');
        return;
      }
      const targetId = safeId(rawId);
      await api.put(`/roles/user/${targetId}`, { permissions: payload });
      try { localStorage.removeItem('rbac_perm_map'); } catch {}
      const displayName = selectedUser.name || (selectedUser.firstName ? `${selectedUser.firstName} ${selectedUser.lastName}` : 'User');
      showToast('success', 'Saved', `Permissions updated for ${displayName}`);
      emitRbacRefetch();
    } catch (err) {
      showToast('error', 'Error', err?.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const totalOn = modState.reduce((s, m) => s + countEnabled(m.pages), 0);
  const totalActs = modState.reduce((s, m) => s + countActions(m.pages), 0);
  const allEnabled = totalActs > 0 && totalOn === totalActs;

  const selectableEmployees = useMemo(() => {
    // Include ALL employees (including the logged-in user).
    // Users requested to manage access for every employee; UI will visually mark the current user as "(You)".
    return employees || [];
  }, [employees, user]);

  const filtered = selectableEmployees.filter((e) =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeModData = modState.find((m) => m.key === activeModule);
  const previewModules = useMemo(() => buildStateFromDynamic(dynamicModules, []).slice(0, 6), [dynamicModules]);
  const card = { background: '#ffffff', borderRadius: 0, border: 'none', boxShadow: 'none' };

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', padding: 0, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, padding: '10px 16px', background: '#ffffff' }}>


        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {selectedUser && (
            <button
              type="button"
              disabled={saving || loadingUser || loading || modState.length === 0}
              onClick={() => setAllAccess(!allEnabled)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 10,
                border: `1.5px solid ${allEnabled ? '#fecaca' : ACCESS_BLUE.border}`,
                background: allEnabled ? '#fff1f2' : ACCESS_BLUE.bg,
                color: allEnabled ? '#b91c1c' : ACCESS_BLUE.text,
                fontSize: 12,
                fontWeight: 800,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: (saving || loadingUser || loading) ? 0.6 : 1,
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}
              title={allEnabled ? 'Disable all permissions' : 'Enable all permissions'}
            >
              {allEnabled ? <X size={14} /> : <CheckCheck size={14} />}
              {allEnabled ? 'Disable All Access' : 'Enable All Access'}
            </button>
          )}

          {selectedUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', cursor: 'default' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color="#6366f1" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  {(() => {
                    let on = 0, tot = 0;
                    modState.forEach(m => { on += countEnabled(m.pages); tot += countActions(m.pages); });
                    return `${on} / ${tot}`;
                  })()}
                </span>
              </div>
            </div>
          )}

          <div ref={dropRef} style={{ position: 'relative' }}>
            <button onClick={() => { setDropdownOpen((o) => !o); setTimeout(() => inputRef.current?.focus(), 50); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', background: '#ffffff', border: dropdownOpen ? '1.5px solid #6366f1' : '1.5px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', minWidth: 230 }}>
              {selectedUser ? (
                <>
                  {(() => { const [c1, c2] = avatarGradient(selectedUser.name || ''); return <div style={{ width: 24, height: 24, borderRadius: 7, background: `linear-gradient(135deg,${c1},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white', flexShrink: 0 }}>{initials(selectedUser.name)}</div>; })()}
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', flex: 1, textAlign: 'left' }}>{selectedUser.name}</span>
                </>
              ) : (
                <>
                  <UserIcon size={14} color="#94a3b8" />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8', flex: 1, textAlign: 'left' }}>Select employee...</span>
                </>
              )}
              <ChevronDown size={14} color="#94a3b8" />
            </button>

            {dropdownOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 290, background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 12px 40px rgba(0,0,0,0.12)', zIndex: 9999, overflow: 'hidden' }}>
                <div style={{ padding: '10px 10px 7px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
                    <input ref={inputRef} type="text" placeholder="Search employee..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto', padding: '5px 7px 7px' }}>
                  {loading ? <div style={{ padding: 18, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading...</div> : filtered.length === 0 ? <div style={{ padding: 18, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No employees found</div> : filtered.map((emp, idx) => {
                    const name = `${emp.firstName} ${emp.lastName}`;
                    const active = selectedUser?.name === name.trim();
                    const isSelf =
                      safeId(emp._id) === safeId(user?.id || user?._id) ||
                      (emp.employeeId && user?.employeeId && String(emp.employeeId) === String(user.employeeId)) ||
                      (emp.email && user?.email && String(emp.email).toLowerCase() === String(user.email).toLowerCase()) ||
                      (`${emp.firstName} ${emp.lastName}`.trim().toLowerCase() === user?.name?.trim()?.toLowerCase());
                    const [c1, c2] = avatarGradient(name);
                    return (
                      <button key={safeId(emp._id) || `emp-${idx}`} onClick={() => handleSelect(emp)} style={{ width: '100%', textAlign: 'left', padding: '8px 9px', marginBottom: 2, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', border: 'none', background: active ? '#eef2ff' : 'transparent' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg,${c1},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'white', flexShrink: 0 }}>{initials(name)}</div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#4338ca' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {name}{isSelf ? ' (You)' : ''}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.designation || emp.department || 'Employee'}</div>
                        </div>
                        {active && <Check size={13} color="#6366f1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#ffffff', borderRadius: 10, padding: '7px 14px', border: '1px solid #e2e8f0' }}>
              <Users size={13} color="#6366f1" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{selectableEmployees.length} Employees</span>
            </div>

            {selectedUser && (
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: '7px 16px',
                  background: saving ? '#e2e8f0' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  color: 'white',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(79,70,229,0.15)',
                  transition: 'all 0.2s ease'
                }}
              >
                {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                {saving ? 'Syncing...' : 'Save All Changes'}
              </button>
            )}
          </div>
        </div>
      </div>

      {loadingUser ? (
        <div style={{ ...card, padding: 60, textAlign: 'center' }}><RefreshCw size={24} color="#6366f1" style={{ animation: 'spin 0.9s linear infinite', margin: '0 auto 12px', display: 'block' }} /><p style={{ color: '#64748b', fontWeight: 600, fontSize: 14, margin: 0 }}>Loading permissions...</p></div>
      ) : selectedUser ? (
        <div style={{ padding: 0, position: 'relative' }}>
          {false && selectedUser.role === 'admin' ? (
              <div style={{ width: '100%', maxWidth: 600, margin: '60px auto', textAlign: 'center', background: 'white', padding: 40, borderRadius: 24, border: `1px solid ${ACCESS_BLUE.border}`, boxShadow: '0 10px 30px rgba(37,99,235,0.08)' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: ACCESS_BLUE.bg, border: `2px solid ${ACCESS_BLUE.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><ShieldCheck size={32} color={ACCESS_BLUE.color} /></div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: ACCESS_BLUE.text, margin: '0 0 10px' }}>Full Administrator Access</h3>
              <p style={{ color: '#1e3a8a', fontSize: 14, lineHeight: 1.6, margin: 0 }}>This user is an administrator with unrestricted access to all modules and pages across the entire platform.</p>
            </div>
          ) : (
            <>
              {/* Module Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, padding: 8 }}>
                {modState.map((mod) => {
                  const onCount = countEnabled(mod.pages);
                  const totCount = countActions(mod.pages);
                  const pct = totCount ? Math.round((onCount / totCount) * 100) : 0;
                  const IconElement = ICONS[mod.icon] || <LayoutGrid />;
                  
                  // Uniform theme
                  const themeColor = '#6366f1';
                  const themeBg = '#f5f7ff';
                  const themeBorder = '#e0e7ff';

                  return (
                    <div
                      key={mod.key}
                      onClick={() => setActiveModule(mod.key)}
                      style={{
                        background: 'white',
                        padding: '12px 15px',
                        borderRadius: 14,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: 115
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 8px 16px -8px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: themeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeColor, border: `1px solid ${themeBorder}` }}>
                          {React.cloneElement(IconElement, { size: 16, strokeWidth: 2.3 })}
                        </div>
                        <div style={{ padding: '2px 5px', background: '#f8fafc', borderRadius: 4, fontSize: 8.5, fontWeight: 800, color: '#94a3b8', border: '1px solid #f1f5f9' }}>
                          {countPages(mod.pages)} Pgs
                        </div>
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '7px 9px', border: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '6.5px', fontWeight: 400, color: '#4b5563', marginBottom: 4 }}>
                            <span style={{ fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '82%', display: 'inline-block', textTransform: 'uppercase', letterSpacing: '0.01em', fontWeight: 600 }}>{mod.label}</span>
                            <span style={{ fontSize: '9px' }}>{pct}%</span>
                          </div>
                          <div style={{ height: 3, background: '#e2e8f0', borderRadius: 1.5, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: themeColor }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>



              {/* Advanced Permission Modal */}
              {activeModule && activeModData && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                  <div style={{ background: 'white', width: '100%', maxWidth: 1000, maxHeight: '90vh', borderRadius: 28, overflow: 'hidden', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: activeModData.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeModData.color, border: `1.5px solid ${activeModData.border}` }}>
                          {React.cloneElement(ICONS[activeModData.icon] || <LayoutGrid />, { size: 24, strokeWidth: 2.3 })}
                        </div>
                        <div>
                          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>{activeModData.label}</h2>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {(() => {
                          const isAllOn = countEnabled(activeModData.pages) === countActions(activeModData.pages);
                          return (
                            <button 
                              onClick={() => toggleModule(activeModData.key, !isAllOn)} 
                              style={{ 
                                padding: '8px 16px', 
                                borderRadius: 10, 
                                fontSize: 12, 
                                fontWeight: 700, 
                                background: isAllOn ? '#fef2f2' : activeModData.bg, 
                                color: isAllOn ? '#b91c1c' : activeModData.text, 
                                border: `1.5px solid ${isAllOn ? '#fecaca' : activeModData.border}`, 
                                cursor: 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 6 
                              }}
                            >
                              {isAllOn ? <X size={14} /> : <CheckCheck size={14} />}
                              {isAllOn ? 'Disable All' : 'Enable All'}
                            </button>
                          );
                        })()}
                        
                        <button
                          onClick={save}
                          disabled={saving}
                          style={{
                            padding: '8px 16px',
                            background: saving ? '#e2e8f0' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                            color: 'white',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            border: 'none',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: '0 4px 12px rgba(79,70,229,0.15)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>

                        <button onClick={() => setActiveModule(null)} style={{ marginLeft: 10, width: 40, height: 40, borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}><X size={20} /></button>
                      </div>
                    </div>

                    <div className="hr-sidebar-scroll" style={{ padding: '32px', overflowY: 'auto', flex: 1, background: '#fcfdfe' }}>
                      {(() => {
                        const moduleLabel = String(activeModData.label || '').toLowerCase();
                        const moduleKey = String(activeModData.key || '').toLowerCase();
                        
                        const isDashboard = moduleLabel === 'dashboard' || moduleKey === 'manual-dashboard' || moduleKey === 'dashboard';
                        const isAccess = moduleLabel === 'access' || moduleKey === 'manual-access' || moduleKey === 'access' || moduleKey === 'accesscontrol';

                        let filteredActions = PAGE_ACTIONS;
                        let gridTemplate = '1fr 80px 80px 80px 80px 90px';

                        if (isDashboard) {
                          filteredActions = ['view', 'create'];
                          gridTemplate = '1fr 80px 80px 90px';
                        } else if (isAccess) {
                          filteredActions = ['view', 'edit'];
                          gridTemplate = '1fr 80px 80px 90px';
                        }

                        return (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 10, padding: '0 12px 18px', borderBottom: '2px solid #f1f5f9', marginBottom: 20 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Navigation Node / Page</span>
                              {filteredActions.map((a) => (
                                <span key={a} style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>
                                  {ACTION_LABELS[a]}
                                </span>
                              ))}
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>Full Row</span>
                            </div>
                            <PermissionRows 
                              pages={activeModData.pages} 
                              moduleKey={activeModData.key} 
                              palette={activeModData} 
                              onToggleAction={toggleAction} 
                              onTogglePage={togglePage} 
                              gridTemplate={gridTemplate}
                              actionsToRender={filteredActions}
                            />
                          </>
                        );
                      })()}
                    </div>


                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)', padding: 48, textAlign: 'center' }}>
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <div style={{ width: 80, height: 80, borderRadius: 22, background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(99,102,241,0.12)', border: '1.5px solid #e0e7ff' }}><ShieldCheck size={38} color="#6366f1" /></div>
            <div style={{ position: 'absolute', top: -5, right: -5, width: 22, height: 22, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LayoutGrid size={11} color="white" /></div>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Select an Employee</h3>
          <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 280, lineHeight: 1.65, margin: '0 0 20px' }}>Use the dropdown above to manage permissions from the exact existing HR sidebar structure.</p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
            {previewModules.map((m) => <span key={m.key} style={{ padding: '4px 12px', borderRadius: 20, background: m.bg, border: `1px solid ${m.border}`, color: m.text, fontSize: 12, fontWeight: 600 }}>{m.label}</span>)}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:8px}
      `}</style>
    </div>
  );
}
