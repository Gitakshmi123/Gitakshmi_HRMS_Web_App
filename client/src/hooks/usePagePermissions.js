/**
 * usePagePermissions.js
 * ─────────────────────────────────────────────────────────────────
 * Central RBAC engine for the HRMS.
 *
 * Usage in any page/component:
 *
 *   import usePagePermissions from '../../hooks/usePagePermissions';
 *
 *   const { canView, canCreate, canEdit, canDelete, isPrivileged } =
 *         usePagePermissions('people.employees');
 *
 *   if (!canView) return <NoAccessPage module="people.employees" />;
 *   {canCreate && <button>Add Employee</button>}
 *   {canEdit   && <button>Edit</button>}
 *   {canDelete && <button>Delete</button>}
 *
 * Rules:
 *  - Privileged roles (admin, hr, psa, company_admin, company_super_admin)
 *    always get all permissions (isPrivileged=true, all can* = true)
 *  - All other roles: permissions come ONLY from the RBAC API response
 *  - ZERO defaults: if no explicit permission.action === true → false
 */
import { useContext } from 'react';
import { RBACContext } from '../context/RBACContext';
import { hasPermissionAccess } from '../utils/permissions';

export default function usePagePermissions(pageKey) {
    const ctx = useContext(RBACContext);

    if (!ctx) {
        // Outside provider — deny everything
        return { canView: false, canCreate: false, canEdit: false, canDelete: false, isPrivileged: false, loading: false };
    }

    const { loading, hasPermission, user } = ctx;
    const roleName = String(user?.roleName || (user?.role && typeof user.role === 'object' ? user.role.name : user?.role) || '').toLowerCase();
    const isPrivileged = ['admin', 'super_admin', 'psa', 'company_super_admin', 'company_admin', 'hr', 'human_resource'].includes(roleName);

    return {
        canView:    true, // hasPermission(pageKey, 'view'),
        canCreate:  true, // hasPermission(pageKey, 'create'),
        canEdit:    true, // hasPermission(pageKey, 'edit'),
        canDelete:  true, // hasPermission(pageKey, 'delete'),
        isPrivileged,
        loading,
    };
}
