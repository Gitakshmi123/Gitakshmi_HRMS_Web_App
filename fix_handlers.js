const fs = require('fs');
const path = 'c:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/HR/LeavePolicies.jsx';
let content = fs.readFileSync(path, 'utf8');

// Verify handleView exists
const hvCount = (content.match(/const handleView = /g) || []).length;
const heCount = (content.match(/const handleEdit = /g) || []).length;
console.log('handleView count:', hvCount, '  handleEdit count:', heCount);

// If duplicate handleEdit exists, remove the second one
if (heCount > 1) {
    const first = content.indexOf('const handleEdit = ');
    const second = content.indexOf('const handleEdit = ', first + 1);
    // Find the end of the second one: next const at same indent level
    const afterSecond = content.indexOf('\n    const handleCreateNew', second);
    if (afterSecond === -1) {
        console.error('Could not locate end of duplicate handleEdit');
        process.exit(1);
    }
    content = content.slice(0, second) + content.slice(afterSecond + 1);
    console.log('Removed duplicate handleEdit');
}

// If handleView is missing, add it before handleEdit
const hvIdx = content.indexOf('const handleView = ');
const heIdx = content.indexOf('const handleEdit = ');
if (hvIdx === -1 || hvIdx > heIdx) {
    // Inject handleView before handleEdit
    const insertAt = heIdx;
    const injection = `const handleView = (policy) => {
        setViewingPolicy(policy);
        setShowModal(false);
    };

    `;
    content = content.slice(0, insertAt) + injection + content.slice(insertAt);
    console.log('Injected handleView before handleEdit');
} else {
    console.log('handleView already in place');
}

fs.writeFileSync(path, content, 'utf8');
const finalHv = (content.match(/const handleView = /g) || []).length;
const finalHe = (content.match(/const handleEdit = /g) || []).length;
console.log('Final: handleView count:', finalHv, '  handleEdit count:', finalHe);
console.log('Lines:', content.split('\n').length);
