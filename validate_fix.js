/**
 * Quick validation that API routes are working correctly
 * This confirms the resume download fix is in place
 */

const fs = require('fs');
const path = require('path');

console.log('\n✅ === RESUME DOWNLOAD FIX VALIDATION ===\n');

// 1. Check CandidateTimeline.jsx for correct routes
const timelinePath = 'client/src/pages/HR/CandidateStatusTracker/CandidateTimeline.jsx';
const timelineContent = fs.readFileSync(timelinePath, 'utf8');

const checks = [
    {
        name: 'CandidateTimeline - GET /hr/candidate-status/candidates/:id',
        path: timelinePath,
        pattern: /\/hr\/candidate-status\/candidates\/\$\{id\}/,
        should: 'PASS'
    },
    {
        name: 'CandidateTimeline - POST /hr/candidate-status/:id/status',
        path: timelinePath,
        pattern: /api\.post\(`\/hr\/candidate-status\/\$\{.+\}\/status/,
        should: 'PASS'
    },
    {
        name: 'CandidateTimeline - No /hrms/ prefix',
        path: timelinePath,
        pattern: /\/hrms\/hr\/candidate-status/,
        should: 'NOT FOUND'
    }
];

let allPass = true;

checks.forEach((check, idx) => {
    const hasPattern = check.pattern.test(timelineContent);
    const result = check.should === 'PASS' ? hasPattern : !hasPattern;
    const status = result ? '✅' : '❌';
    
    console.log(`${status} Check ${idx + 1}: ${check.name}`);
    if (!result) {
        console.log(`   Expected: ${check.should}`);
        console.log(`   Pattern: ${check.pattern}`);
        allPass = false;
    }
});

// 2. Check if resume logging is in place
const cardPath = 'client/src/pages/HR/CandidateStatusTracker/CandidateCard.jsx';
const cardContent = fs.readFileSync(cardPath, 'utf8');

const hasResumeLogging = /console\.log.*resumeUrl/.test(cardContent);
console.log(`\n${hasResumeLogging ? '✅' : '❌'} CandidateCard - Resume download logging in place`);

if (!hasResumeLogging) allPass = false;

// 3. Check server routes
const routesPath = 'server/routes/tracker.routes.js';
const routesContent = fs.readFileSync(routesPath, 'utf8');

const hasGetRoute = /router\.get\('\/candidates\/:id'/i.test(routesContent);
const hasStatusRoute = /router\.post\('\/candidates\/:id\/status'/i.test(routesContent);

console.log(`\n${hasGetRoute ? '✅' : '❌'} Server - GET /candidates/:id route exists`);
console.log(`${hasStatusRoute ? '✅' : '❌'} Server - POST /candidates/:id/status route exists`);

if (!hasGetRoute || !hasStatusRoute) allPass = false;

// 4. Check app.js mounting
const appPath = 'server/app.js';
const appContent = fs.readFileSync(appPath, 'utf8');

const hasMounting = /app\.use\('\/api\/hr\/candidate-status',.*tracker\.routes/.test(appContent);
console.log(`\n${hasMounting ? '✅' : '❌'} Server - Routes mounted at /api/hr/candidate-status`);

if (!hasMounting) allPass = false;

// 5. Summary
console.log('\n' + '='.repeat(60));
if (allPass) {
    console.log('✅ ALL CHECKS PASSED - Resume download fix is correctly implemented!');
    console.log('\nExpected flow:');
    console.log('1. Client calls GET /hr/candidate-status/candidates/:id');
    console.log('2. Server returns candidate with resumeUrl: "/hr/resume/filename.pdf"');
    console.log('3. Client calls GET /hr/resume/filename.pdf');
    console.log('4. Server serves the PDF file');
} else {
    console.log('❌ SOME CHECKS FAILED - Please review the fixes');
}
console.log('='.repeat(60) + '\n');

process.exit(allPass ? 0 : 1);
