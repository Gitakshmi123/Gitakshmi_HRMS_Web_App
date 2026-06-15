export function normalizePermissionMap(rawPermissions) {
  if (!Array.isArray(rawPermissions)) return {};

  return rawPermissions.reduce((acc, entry) => {
    if (!entry?.module) return acc;

    const sourceActions = entry.actions || entry;
    acc[entry.module] = {
      view: (typeof sourceActions?.get === 'function' ? sourceActions.get('view') : sourceActions.view) === true,
      create: (typeof sourceActions?.get === 'function' ? sourceActions.get('create') : sourceActions.create) === true,
      edit: (typeof sourceActions?.get === 'function' ? sourceActions.get('edit') : sourceActions.edit) === true,
      delete: (typeof sourceActions?.get === 'function' ? sourceActions.get('delete') : sourceActions.delete) === true,
    };

    return acc;
  }, {});
}

/**
 * Enriches the permission map with route-based keys.
 * This satisfies the requirement of permissions["/employee/dashboard"]
 */
export function enrichWithRoutes(permMap, modules) {
  if (!permMap || typeof permMap !== 'object' || !Array.isArray(modules)) return permMap;

  const enriched = { ...permMap };

  modules.forEach(mod => {
    (mod.pages || []).forEach(page => {

      if (page.permissionKey && page.route && permMap[page.permissionKey]) {
        enriched[page.route] = permMap[page.permissionKey];
      }
      
      (page.children || []).forEach(sub => {
        if (sub.permissionKey && sub.route && permMap[sub.permissionKey]) {
          enriched[sub.route] = permMap[sub.permissionKey];
        }
      });
    });
  });

  return enriched;
}


export function checkPermission(permissions, keyOrRoute, action = 'view') {
  // 1. No permissions map or invalid key/route
  if (!permissions || typeof permissions !== 'object' || !keyOrRoute) return false;
  const normalizedAction = String(action || 'view').toLowerCase() === 'update' ? 'edit' : String(action || 'view').toLowerCase();

  // 2. Handle Arrays (recursion)
  if (Array.isArray(keyOrRoute)) {
    return keyOrRoute.some(k => checkPermission(permissions, k, action));
  }

  // 3. Normalize keyOrRoute (handle /hr, /tenant, and /employee prefixes)
  let lookupKey = keyOrRoute;
  if (lookupKey.startsWith('/tenant/')) {
    lookupKey = '/hr/' + lookupKey.substring(8);
  } else if (lookupKey.startsWith('/tenant')) {
    lookupKey = '/hr' + lookupKey.substring(7);
  } else if (lookupKey.startsWith('/employee/')) {
    lookupKey = '/hr/' + lookupKey.substring(10);
  } else if (lookupKey.startsWith('/employee')) {
    lookupKey = '/hr' + lookupKey.substring(9);
  }

  // 3. Exact and Relative check
  const relativeKey = lookupKey.replace(/^\/hr/, '').replace(/^\/employee/, '');
  let actions = permissions[lookupKey] || permissions[keyOrRoute] || (relativeKey && permissions[relativeKey]);

  // 4. Fallback Alias Check: 'ticket-inbox' <=> 'support.tickets'
  if (!actions) {
    if (lookupKey === 'ticket-inbox' || keyOrRoute === 'ticket-inbox') actions = permissions['support.tickets'];
    else if (lookupKey === 'support.tickets' || keyOrRoute === 'support.tickets') actions = permissions['ticket-inbox'];
  }

  if (!actions) return false;
  
  if (normalizedAction === 'any') {
    return !!(actions.view || actions.create || actions.edit || actions.delete);
  }
  
  return actions[normalizedAction] === true;
}

/**
 * Legacy wrapper for checkPermission.
 */
export function hasPermissionAccess({ permissionMap, module, action = 'view' }) {
  return checkPermission(permissionMap, module, action);
}
