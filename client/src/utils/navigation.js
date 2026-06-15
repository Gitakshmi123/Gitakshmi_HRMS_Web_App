
/**
 * Returns the base path for navigation based on the user's role.
 * HR-related roles stay under /hr (or /tenant), while others use /employee.
 * 
 * @param {string} role - The user's role name
 * @returns {string} - The base path prefix (e.g., '/hr' or '/employee')
 */
export const getBasePath = (role) => {
    if (!role) return "/employee";
    
    const roleName = (typeof role === 'object' ? role.name : role).toLowerCase();
    const adminRoles = ['hr', 'admin', 'company_super_admin', 'company_admin', 'human_resource', 'hr manager', 'hr_manager', 'hr_admin', 'super_admin', 'psa', 'company administrator', 'hr-manager', 'company-admin'];
    
    return adminRoles.includes(roleName) ? "/hr" : "/employee";
};

/**
 * Normalizes a route by ensuring it has the correct prefix based on the context.
 * 
 * @param {string} route - The target route (e.g., 'dashboard', '/dashboard', or '/employee/dashboard')
 * @param {string} role - The user's role (fallback if currentPanel is missing)
 * @param {string} currentPanel - The current URL prefix (e.g., '/hr', '/employee')
 * @returns {string} - The corrected route with prefix
 */
export const getRoleRoute = (route, role, currentPanel = null) => {
    if (!route) return currentPanel || getBasePath(role);
    
    const prefix = currentPanel || getBasePath(role);
    
    // Clean the route of any existing panel prefixes to avoid duplication or mismatch
    const cleanRoute = (route || '')
        .trim()
        .replace(/^\/?employee\//, '')
        .replace(/^\/?hr\//, '')
        .replace(/^\/?tenant\//, '')
        .replace(/^\//, '')
        .replace(/\s+/g, '-'); // Normalize spaces to hyphens
        
    return `${prefix}/${cleanRoute}`;
};

/**
 * Returns the appropriate hiring action route based on application status.
 * @param {Object} app - The application object containing status and _id
 * @returns {string} - The target path
 */
const normalizePanelPrefix = (panelPrefix = '/hr') => (
    panelPrefix === '/tenant' ? '/tenant' : '/hr'
);

const isJoiningLetterStage = (rawStatus) => {
    const status = String(rawStatus || '').toLowerCase().trim();
    return (
        status.includes('fully signed') ||
        status === 'signed' ||
        status.includes('joining letter') ||
        status.includes('joining')
    );
};

export const getHiringRoute = (app, options = {}) => {
    if (!app || !app._id) return '/hr/dashboard';

    const normalizedOptions = typeof options === 'string'
        ? { panelPrefix: options }
        : options;

    const panelPrefix = normalizePanelPrefix(normalizedOptions.panelPrefix);
    const applicantsPath = normalizedOptions.applicantsPath || `${panelPrefix}/applicants`;

    // Support both 'status' and 'currentStatus' fields commonly used in the app
    const rawStatus = (app.status || app.currentStatus || 'applied').toLowerCase();
    const id = app._id;

    if (isJoiningLetterStage(rawStatus)) {
        return `${applicantsPath}?id=${id}&action=generate-joining&tab=joining`;
    }

    // Robust mapping logic (route aliases removed):
    // always return applicants page + query params, so it works in /hr, /tenant, /employee.
    if (rawStatus.includes('hired') || rawStatus.includes('offer') || rawStatus.includes('selected')) {
        return `${applicantsPath}?id=${id}&action=generate-offer&tab=finalized`;
    }
    
    // If it contains "interview" and it's NOT just the initial "shortlisted" state, 
    // it's likely an active interview round.
    if (rawStatus.includes('interview') || rawStatus.includes('round') || rawStatus.includes('feedback')) {
        return `${applicantsPath}?id=${id}&tab=interview`;
    }
    
    if (rawStatus.includes('shortlisted')) {
        return `${applicantsPath}?id=${id}&tab=shortlisted`;
    }
    
    // Fallback to review for 'applied' or unknown states
    return `${applicantsPath}?id=${id}&tab=applied`;
};
