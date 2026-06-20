import api from '../utils/api';

const shiftAssignmentService = {
    // 1. Assign Shift (Priority/Hierarchical)
    createAssignment: async (payload) => {
        const response = await api.post('/shift-assignment', payload);
        return response.data;
    },

    // 2. Get All Active Assignments
    getAssignments: async () => {
        const response = await api.get('/shift-assignment');
        return response.data;
    },

    // 3. Delete / Inactivate Assignment
    deleteAssignment: async (id) => {
        const response = await api.delete(`/shift-assignment/${id}`);
        return response.data;
    }
};

export default shiftAssignmentService;
