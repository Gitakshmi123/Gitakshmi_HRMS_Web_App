import api from '../utils/api';

/**
 * companiesService - API service for Super Admin Companies module
 * Base Endpoint: /tenants (Matched to Backend tenant.routes.js)
 */

const companiesService = {
    // 1. Get All Companies
    getAllCompanies: async () => {
        const response = await api.get('/tenants');
        // Accept both array directly or { companies: [] }
        return Array.isArray(response.data)
            ? response.data
            : (response.data?.companies || response.data || []);
    },

    // 2. Create Company
    createCompany: async (payload) => {
        const response = await api.post('/tenants/company', payload);
        return response.data;
    },

    // 2.1 Sub-company management (Enterprise Hierarchy)
    getMyCompany: async () => {
        const response = await api.get('/hierarchy/stats');
        return response.data;
    },
    getSubCompanies: async () => {
        const response = await api.get('/hierarchy/sub-companies');
        return response.data;
    },
    getBranches: async () => {
        const response = await api.get('/hierarchy/branches');
        return response.data;
    },
    getHierarchyTree: async () => {
        const response = await api.get('/hierarchy/tree');
        return response.data;
    },
    getCompanyModules: async () => {
        // Fallback to old modules if hierarchy doesn't provide it yet, 
        // but typically hierarchy stats or a specific endpoint should have it.
        const response = await api.get('/company/modules');
        return response.data;
    },
    createSubCompany: async (payload) => {
        const response = await api.post('/hierarchy/sub-companies', payload);
        return response.data;
    },
    createBranch: async (payload) => {
        const response = await api.post('/hierarchy/branches', payload);
        return response.data;
    },
    getSubCompanyById: async (id) => {
        const response = await api.get(`/hierarchy/sub-companies/${id}`);
        return response.data;
    },
    updateSubCompany: async (id, payload) => {
        const response = await api.put(`/hierarchy/sub-companies/${id}`, payload);
        return response.data;
    },
    updateSubCompanyStatus: async (id, status) => {
        const response = await api.put(`/hierarchy/sub-companies/${id}/status`, { status });
        return response.data;
    },

    // 2a. Create Group (Product Super Admin)
    createGroup: async (payload) => {
        const response = await api.post('/group/create', payload);
        return response.data;
    },

    // 2b. Get Groups for company creation dropdown
    getAllGroups: async () => {
        const response = await api.get('/group/all');
        return response.data?.data || [];
    },

    // 2c. Get total companies created under selected group
    getCompanyCountByGroup: async (groupId) => {
        const response = await api.get('/company/count', { params: { groupId } });
        return response.data?.total || 0;
    },

    lookupGst: async (gstin) => {
        const response = await api.get(`/tenants/gst/${encodeURIComponent(gstin)}`);
        return response.data?.data || response.data;
    },

    // 2d. Hierarchical listing APIs for PSA/Admin
    getParentCompanies: async () => {
        const response = await api.get('/tenants/parent-companies');
        return response.data?.items || response.data || [];
    },
    getSubCompaniesByParent: async (parentId) => {
        const response = await api.get('/company/sub-companies', { params: { parentId } });
        return response.data?.items || [];
    },

    // 3. Get Single Company
    getCompanyById: async (id) => {
        const response = await api.get(`/tenants/${id}`);
        return response.data;
    },

    // 4. Update Company
    updateCompany: async (id, payload) => {
        const response = await api.put(`/tenants/${id}`, payload);
        return response.data;
    },

    // 5. Toggle Status (Using PUT update since logic is in updateTenant)
    toggleCompanyStatus: async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        const response = await api.put(`/tenants/${id}`, { status: newStatus });
        return response.data;
    },

    // 6. Delete Company 
    deleteCompany: async (id) => {
        const response = await api.delete(`/tenants/${id}`);
        return response.data;
    },

    // 7. Upload Logo (Unchanged if generic, but usually backend has specific upload routes)
    uploadLogo: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        // Assuming this route is global or adapted
        const response = await api.post('/uploads/logo', formData);
        return response.data;
    },

    // 8. Verify PSA Password
    verifyPsaPassword: async (password) => {
        const response = await api.post('/tenants/verify-password', { password });
        return response.data;
    },

    // 9. Update Company Password
    updateCompanyPassword: async (id, password) => {
        const response = await api.put(`/tenants/${id}/password`, { password });
        return response.data;
    }
};

export default companiesService;
