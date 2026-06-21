const fs = require('fs');
const path = 'c:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/HR/LeavePolicies.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add onView={handleView} to PolicyCard usage
content = content.replace(
    `                                        p={p}\r\n                                        onEdit={handleEdit}`,
    `                                        p={p}\r\n                                        onView={handleView}\r\n                                        onEdit={handleEdit}`
);
if (!content.includes('onView={handleView}')) {
    // Try LF only
    content = content.replace(
        `                                        p={p}\n                                        onEdit={handleEdit}`,
        `                                        p={p}\n                                        onView={handleView}\n                                        onEdit={handleEdit}`
    );
}
console.log('onView prop added:', content.includes('onView={handleView}'));

// 2. Add PolicyDetailView rendering before showModal block
// Find the comment before showModal
const marker = `{/* ── Policy Creation / Edit Form (Inline View) ──────────────────────────────────────────── */}\r\n            {showModal &&`;
const markerLF = `{/* ── Policy Creation / Edit Form (Inline View) ──────────────────────────────────────────── */}\n            {showModal &&`;

const detailViewBlock = `{/* ── Policy Detail View (Read-Only) ─────────────────────────────────────────────────────── */}\r\n            {viewingPolicy && !showModal && (\r\n                <PolicyDetailView\r\n                    policy={viewingPolicy}\r\n                    onClose={() => setViewingPolicy(null)}\r\n                    onEdit={handleEdit}\r\n                />\r\n            )}\r\n\r\n            {/* ── Policy Creation / Edit Form (Inline View) ──────────────────────────────────────────── */}\r\n            {showModal &&`;

if (content.includes(marker)) {
    content = content.replace(marker, detailViewBlock);
    console.log('PolicyDetailView block inserted (CRLF)');
} else if (content.includes(markerLF)) {
    const detailViewBlockLF = detailViewBlock.replace(/\r\n/g, '\n');
    content = content.replace(markerLF, detailViewBlockLF);
    console.log('PolicyDetailView block inserted (LF)');
} else {
    console.error('ERROR: Could not find showModal marker');
    process.exit(1);
}

// 3. Also hide the policy list/stats when viewingPolicy is active
// Conditions: !showModal should also be !showModal && !viewingPolicy for the cards/stats section
// Find the first occurrence of the main condition
content = content.replace(
    /(\{!showModal &&\s*\()/g,
    (match) => `{!showModal && !viewingPolicy && (`
);
console.log('showModal conditions updated');

fs.writeFileSync(path, content, 'utf8');
console.log('Done. Lines:', content.split('\n').length);
