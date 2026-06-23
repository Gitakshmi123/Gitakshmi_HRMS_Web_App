export const MODULE_CODES = [
  'hr',
  'payroll',
  'attendance',
  'leave',
  'recruitment',
  'backgroundVerification',
  'documentManagement',
  'socialMediaIntegration',
  'employeePortal',
  'reports',
  'onboarding',
  'policy',
  'customStudio',
  'accessControl'
];

export const MODULE_DEPENDENCIES = {
  leave: ['hr'],
  backgroundVerification: ['hr'],
  documentManagement: ['hr'],
  employeePortal: ['hr']
};

const LEGACY_TO_CANONICAL = {
  ess: 'employeePortal',
  socialMedia: 'socialMediaIntegration',
  socialmedia: 'socialMediaIntegration',
  hiring: 'recruitment'
};

export const MODULE_LABELS = {
  hr: 'HR',
  payroll: 'Payroll',
  attendance: 'Attendance',
  leave: 'Leave',
  recruitment: 'Hiring',
  backgroundVerification: 'BGV',
  documentManagement: 'Documents',
  socialMediaIntegration: 'Social Media',
  employeePortal: 'Employee Portal',
  reports: 'Reports',
  onboarding: 'Onboarding',
  policy: 'Policy',
  customStudio: 'Custom Studio',
  accessControl: 'Access Control'
};

const ARRAY_LABEL_TO_CODE = {
  hr: 'hr',
  'hr management': 'hr',
  'hrm': 'hr',
  payroll: 'payroll',
  'payroll system': 'payroll',
  attendance: 'attendance',
  'attendance management': 'attendance',
  leave: 'leave',
  hiring: 'recruitment',
  recruitment: 'recruitment',
  bgv: 'backgroundVerification',
  'background verification': 'backgroundVerification',
  documents: 'documentManagement',
  'doc management': 'documentManagement',
  'document management': 'documentManagement',
  'social media': 'socialMediaIntegration',
  'social media integration': 'socialMediaIntegration',
  'employee portal': 'employeePortal',
  ess: 'employeePortal',
  reports: 'reports',
  onboarding: 'onboarding',
  policy: 'policy',
  'custom studio': 'customStudio',
  customstudio: 'customStudio',
  access: 'accessControl',
  'access control': 'accessControl'
};

export function normalizeModuleCode(code) {
  const c = String(code || '').trim();
  const lower = c.toLowerCase();
  if (!c) return null;
  if (MODULE_CODES.includes(c)) return c;
  return LEGACY_TO_CANONICAL[c] || LEGACY_TO_CANONICAL[lower] || ARRAY_LABEL_TO_CODE[lower] || null;
}

export function createDefaultEnabledModules(defaultValue = false, moduleCodes = MODULE_CODES) {
  return moduleCodes.reduce((acc, key) => {
    acc[key] = defaultValue;
    return acc;
  }, {});
}

export function normalizeEnabledModules(input = {}, legacyModules = []) {
  const out = createDefaultEnabledModules(false);
  let hasInput = false;

  if (input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).length > 0) {
    hasInput = true;
    Object.entries(input).forEach(([key, value]) => {
      const normalizedKey = normalizeModuleCode(key);
      if (normalizedKey) out[normalizedKey] = value === true;
    });
  }

  if (Array.isArray(legacyModules)) {
    legacyModules.forEach((m) => {
      const normalizedKey = normalizeModuleCode(m);
      if (normalizedKey) out[normalizedKey] = true;
    });
  }

  // If we only had legacy modules (and no explicit input object),
  // or if we have no input at all but legacy modules exist,
  // we should apply dependencies to match legacy behavior/expectations.
  if (!hasInput && Array.isArray(legacyModules) && legacyModules.length > 0) {
    return applyModuleDependencies(out);
  }

  // If we have absolutely no input (empty enabledModules object AND empty legacy list),
  // this is a legacy tenant with no module configuration — default ALL modules to true.
  const hasLegacy = Array.isArray(legacyModules) && legacyModules.length > 0;
  if (!hasInput && !hasLegacy) {
    return createDefaultEnabledModules(true);
  }

  return out;
}


export function applyModuleDependencies(enabledModules = {}) {
  const out = { ...createDefaultEnabledModules(false), ...enabledModules };
  let changed = true;

  while (changed) {
    changed = false;
    Object.entries(MODULE_DEPENDENCIES).forEach(([moduleKey, deps]) => {
      if (out[moduleKey] === true) {
        deps.forEach((dep) => {
          if (out[dep] !== true) {
            out[dep] = true;
            changed = true;
          }
        });
      }
    });
  }

  return out;
}

export function enabledModulesToArray(enabledModules = {}) {
  return MODULE_CODES.filter((key) => enabledModules?.[key] === true);
}

export function enabledModulesToLabelArray(enabledModules = {}) {
  return enabledModulesToArray(enabledModules).map((code) => MODULE_LABELS[code] || code);
}

export function modulesArrayToEnabledModules(modules = []) {
  const out = createDefaultEnabledModules(false);
  if (!Array.isArray(modules)) return out;
  modules.forEach((mod) => {
    const code = normalizeModuleCode(mod);
    if (code) out[code] = true;
  });
  return applyModuleDependencies(out);
}

export function countEnabledModules(enabledModules = {}) {
  return enabledModulesToArray(enabledModules).length;
}
