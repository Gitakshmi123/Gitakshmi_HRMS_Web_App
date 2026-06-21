const fs = require('fs');
const path = 'c:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/HR/LeavePolicies.jsx';
let content = fs.readFileSync(path, 'utf8');

// Find the start of the corrupted region: after fetchMappings(); on line ~3288
// The region goes: fetchMappings();\n        try {\n        setForm({ (WRONG)
// We need to replace from there through all helper functions up to handleView

// Anchor: "fetchMappings();\r\n        try {\r\n        setForm({"
// or LF version
let badStart = content.indexOf('fetchMappings();\r\n        try {\r\n        setForm({');
if (badStart === -1) badStart = content.indexOf('fetchMappings();\n        try {\n        setForm({');
if (badStart === -1) {
    console.error('Could not find corruption anchor');
    process.exit(1);
}

// The correct code from this point: find the end of corruption
// End anchor: after all the "good" helper functions, before buildPolicyPayload
let badEnd = content.indexOf('    const buildPolicyPayload', badStart);
if (badEnd === -1) {
    console.error('Could not find buildPolicyPayload');
    process.exit(1);
}

console.log('Corrupted region: chars', badStart, 'to', badEnd);

// Replacement: close the try block that was opened, plus all the helper functions
const correctCode = `fetchMappings();
        } catch (err) {
            showToast('error', 'Action Failed', err.response?.data?.error || err.response?.data?.message || 'Something went wrong');
        }
    };

    const handleEditMapping = (m) => {
        setEditingMappingId(m._id);
        setMappingForm({
            minLpa: m.minLpa,
            maxLpa: m.maxLpa,
            band: m.band,
            gradeValue: m.gradeValue || m.gradeCode || m.gradeName || '',
            gradeName: m.gradeName || ''
        });
    };

    const handleDeleteMapping = (id) => {
        showConfirmToast({
            title: 'Delete Mapping',
            description: 'Are you sure you want to remove this mapping rule?',
            okText: 'Delete',
            danger: true,
            onConfirm: async () => {
                try {
                    await api.delete(\`/hr/leave-policies/custom/mappings/\${id}\`);
                    showToast('success', 'Mapping Removed');
                    fetchMappings();
                } catch {
                    showToast('error', 'Deletion Failed');
                }
            }
        });
    };

    const handleApplyMappings = async () => {
        try {
            await api.post('/hr/leave-policies/custom/apply');
            showToast('success', 'Sync Started', 'Mappings are being applied to all employee records.');
        } catch {
            showToast('error', 'Sync Failed');
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/hr/employees');
            if (res.data?.success && Array.isArray(res.data.data)) {
                setEmployees(res.data.data);
            } else if (Array.isArray(res.data)) {
                setEmployees(res.data);
            } else {
                setEmployees([]);
            }
        } catch (err) {
            console.error('Failed to fetch employees', err);
        }
    };

    const fetchDepartments = async () => {
        try {
            const res = await api.get('/hr/departments');
            if (res.data?.success && Array.isArray(res.data.data)) {
                setDepartments(res.data.data);
            } else if (Array.isArray(res.data)) {
                setDepartments(res.data);
            } else {
                setDepartments([]);
            }
        } catch (err) {
            console.error('Failed to fetch departments', err);
            setDepartments([]);
        }
    };

    const fetchGrades = async () => {
        try {
            const res = await api.get('/grades');
            const data = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
            setMappingForm(prev => ({
                ...prev,
                availableGrades: data,
            }));
        } catch (err) {
            console.error('Failed to fetch grades', err);
        }
    };

    const fetchPositions = async () => {
        try {
            const res = await api.get('/positions');
            const data = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
            setPositions(data);
        } catch (err) {
            console.error('Failed to fetch positions', err);
        }
    };

    const fetchBranches = async () => {
        try {
            const res = await api.get('/hierarchy/branches');
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setBranches(data);
        } catch (err) {
            console.error('Failed to fetch branches', err);
        }
    };

    const normalizeObjectIdList = (items = []) => (
        Array.isArray(items)
            ? items
                .map((item) => item?._id || item?.id || item)
                .filter(Boolean)
                .map((item) => item.toString())
            : []
    );

    const handleView = (policy) => {
        setViewingPolicy(policy);
        setShowModal(false);
    };

    const handleEdit = (policy) => {
        setEditingId(policy._id || policy.id);
        setSelectedTemplateId('custom');
        setForm({
            ...policy,
            policyId: policy.policyId || '',
            status: policy.status || (policy.isActive ? 'ACTIVE' : 'INACTIVE'),
            specificEmployeeId: policy.specificEmployeeId || policy.specificEmployeeIds?.[0]?._id || policy.specificEmployeeIds?.[0] || '',
            roles: Array.isArray(policy.roles) ? policy.roles : [],
            departmentIds: normalizeObjectIdList(policy.departmentIds),
            branchIds: Array.isArray(policy.branchIds) ? policy.branchIds.map(id => id?._id || id) : [],
            gradeIds: Array.isArray(policy.gradeIds) ? policy.gradeIds.map(id => id?._id || id) : [],
            gradeCodes: Array.isArray(policy.gradeCodes) ? policy.gradeCodes : [],
            designations: Array.isArray(policy.designations) ? policy.designations : [],
            applicableJobTypes: Array.isArray(policy.applicableJobTypes) ? policy.applicableJobTypes : [],
            applicableBands: Array.isArray(policy.applicableBands) ? policy.applicableBands : [],
            applicableEmployeeTypes: Array.isArray(policy.applicableEmployeeTypes) ? policy.applicableEmployeeTypes : [],
            rules: Array.isArray(policy.rules) ? policy.rules : [],
            effectiveFrom: policy.effectiveFrom ? new Date(policy.effectiveFrom).toISOString().slice(0, 10) : '',
            expiryDate: policy.expiryDate ? new Date(policy.expiryDate).toISOString().slice(0, 10) : ''
        });
        setIsPolicyIdManuallyEdited(true);
        fetchGrades();
        fetchBranches();
        setShowModal(true);
        setViewingPolicy(null);
    };

    `;

content = content.slice(0, badStart) + correctCode + content.slice(badEnd);

// Also remove any remaining stale handleEdit / handleView duplicates after buildPolicyPayload
// Count occurrences
const hvCount = (content.match(/const handleView = /g) || []).length;
const heCount = (content.match(/const handleEdit = /g) || []).length;
console.log('After fix - handleView:', hvCount, ' handleEdit:', heCount);

fs.writeFileSync(path, content, 'utf8');
console.log('Done. Lines:', content.split('\n').length);
