import api from '../utils/api';

/**
 * Service for interacting with the Shift Master Module API
 */
const shiftMasterService = {
    // 1. Fetch all shifts
    getAllShifts: async (status) => {
        const query = status ? `?status=${status}` : '';
        const response = await api.get(`/shift-master${query}`);
        return response.data;
    },

    // 2. Fetch single shift by ID (includes current Policy)
    getShiftById: async (id) => {
        const response = await api.get(`/shift-master/${id}`);
        return response.data;
    },

    // 3. Create new Shift and Initial Policy
    createShift: async (shiftMasterData, policyRulesData) => {
        const response = await api.post('/shift-master', {
            shiftMaster: shiftMasterData,
            policyRules: policyRulesData
        });
        return response.data;
    },

    // 4. Bulk Create Shifts from Excel
    bulkCreateShifts: async (shiftsData) => {
        const response = await api.post('/shift-master/bulk', { shifts: shiftsData });
        return response.data;
    },

    // 5. Update Existing Shift Master
    updateShift: async (id, updates) => {
        const response = await api.put(`/shift-master/${id}`, updates);
        return response.data;
    },

    // 6. Delete Shift (Soft Delete)
    deleteShift: async (id) => {
        const response = await api.delete(`/shift-master/${id}`);
        return response.data;
    },

    // 6. Save/Create New Policy Version
    savePolicy: async (shiftId, policyData) => {
        const response = await api.post(`/shift-master/${shiftId}/policy`, policyData);
        return response.data;
    },

    // 7. Get Policy History
    getPolicyHistory: async (shiftId) => {
        const response = await api.get(`/shift-master/${shiftId}/policy`);
        return response.data;
    },

    // 8. Simulate Rules
    simulateRules: async (policyConfig, punches) => {
        const response = await api.post('/shift-master/simulate', {
            policyConfig,
            punches
        });
        return response.data;
    }
};

export default shiftMasterService;
