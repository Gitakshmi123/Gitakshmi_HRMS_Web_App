#!/usr/bin/env node

/**
 * SEO Settings Implementation Validator
 * This script verifies that all SEO Settings fixes are properly implemented
 */

const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(color, ...args) {
    console.log(`${colors[color] || ''}${args.join(' ')}${colors.reset}`);
}

function checkFileExists(filePath, description) {
    const fullPath = path.resolve(__dirname, filePath);
    const exists = fs.existsSync(fullPath);
    if (exists) {
        log('green', '✓', description);
    } else {
        log('red', '✗', description, `(${filePath})`);
    }
    return exists;
}

function checkFileContains(filePath, searchStrings, description) {
    const fullPath = path.resolve(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
        log('red', '✗', description, `(file not found: ${filePath})`);
        return false;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const searchArray = Array.isArray(searchStrings) ? searchStrings : [searchStrings];
    
    const found = searchArray.every(str => content.includes(str));
    
    if (found) {
        log('green', '✓', description);
    } else {
        const notFound = searchArray.find(str => !content.includes(str));
        log('red', '✗', description, `(missing: "${notFound.substring(0, 50)}...")`);
    }
    return found;
}

console.log('\n');
log('cyan', '═══════════════════════════════════════════════════════════════');
log('cyan', '  SEO SETTINGS FIX - IMPLEMENTATION VALIDATOR');
log('cyan', '═══════════════════════════════════════════════════════════════');
console.log('');

// Track results
const results = {
    passed: 0,
    failed: 0,
    sections: []
};

// ============= FRONTEND CHECKS =============
log('blue', '\n📱 FRONTEND VALIDATION\n');

const frontendChecks = [
    {
        name: 'PublicCareerPage.jsx exists',
        check: () => checkFileExists('client/src/pages/PublicCareerPage.jsx', 'PublicCareerPage component')
    },
    {
        name: 'injectMetaTags accepts seoSettings parameter',
        check: () => checkFileContains(
            'client/src/pages/PublicCareerPage.jsx',
            'const injectMetaTags = (seoSettings, metaTags)',
            'Function signature supports seoSettings and metaTags'
        )
    },
    {
        name: 'injectMetaTags has fallback logic',
        check: () => checkFileContains(
            'client/src/pages/PublicCareerPage.jsx',
            'if (metaTags?.metaTags)',
            'Pre-generated metaTags check implemented'
        )
    },
    {
        name: 'injectMetaTags generates from seoSettings',
        check: () => checkFileContains(
            'client/src/pages/PublicCareerPage.jsx',
            'else if (seoSettings)',
            'Fallback generation from seoSettings'
        )
    },
    {
        name: 'document.title updated from both sources',
        check: () => checkFileContains(
            'client/src/pages/PublicCareerPage.jsx',
            'document.title = title',
            'Document title injection'
        )
    },
    {
        name: 'All meta tags generated (title, description, og:*, twitter, canonical)',
        check: () => checkFileContains(
            'client/src/pages/PublicCareerPage.jsx',
            ['og:title', 'og:description', 'og:image', 'twitter:card', 'canonical'],
            'Complete meta tag generation'
        )
    },
    {
        name: 'useEffect extracts both seoSettings and metaTags',
        check: () => checkFileContains(
            'client/src/pages/PublicCareerPage.jsx',
            ['const seoSettings = customRes.data.seoSettings', 'const metaTags = customRes.data.metaTags'],
            'Proper API response extraction'
        )
    },
    {
        name: 'injectMetaTags called with both parameters',
        check: () => checkFileContains(
            'client/src/pages/PublicCareerPage.jsx',
            'injectMetaTags(seoSettings, metaTags)',
            'Both parameters passed to injection function'
        )
    },
    {
        name: 'HTML escaping implemented',
        check: () => checkFileContains(
            'client/src/pages/PublicCareerPage.jsx',
            'escapeHTML',
            'XSS protection with HTML escaping'
        )
    },
    {
        name: 'SEO tag cleanup implemented',
        check: () => checkFileContains(
            'client/src/pages/PublicCareerPage.jsx',
            'data-seo-tag="true"',
            'SEO tag identification and cleanup'
        )
    }
];

frontendChecks.forEach(test => {
    if (test.check()) {
        results.passed++;
    } else {
        results.failed++;
    }
});

// ============= BACKEND CHECKS =============
log('blue', '\n⚙️  BACKEND VALIDATION\n');

const backendChecks = [
    {
        name: 'career.controller.js exists',
        check: () => checkFileExists('server/controllers/career.controller.js', 'Career controller')
    },
    {
        name: 'escapeHTML helper function exists',
        check: () => checkFileContains(
            'server/controllers/career.controller.js',
            'function escapeHTML(str)',
            'HTML escaping helper function'
        )
    },
    {
        name: 'publishCustomization generates metaTags',
        check: () => checkFileContains(
            'server/controllers/career.controller.js',
            'let metaTags = {}',
            'Meta tag generation initialization'
        )
    },
    {
        name: 'metaTags includes ogDescription',
        check: () => checkFileContains(
            'server/controllers/career.controller.js',
            'ogDescription:',
            'OG description field in metaTags'
        )
    },
    {
        name: 'metaTags generates HTML strings',
        check: () => checkFileContains(
            'server/controllers/career.controller.js',
            'metaTags: {',
            'HTML meta tag strings generation'
        )
    },
    {
        name: 'All meta tag HTML strings generated',
        check: () => checkFileContains(
            'server/controllers/career.controller.js',
            ['title:', 'description:', 'ogTitle:', 'ogDescription:', 'canonical:'],
            'Complete meta tag HTML generation'
        )
    },
    {
        name: 'getPublicCustomization returns structured response',
        check: () => checkFileContains(
            'server/controllers/career.controller.js',
            ['seoSettings:', 'metaTags:'],
            'Structured API response with SEO data'
        )
    },
    {
        name: 'getPublicCustomization returns both seoSettings and metaTags',
        check: () => checkFileContains(
            'server/controllers/career.controller.js',
            'const seoSettings = customization?.seoSettings',
            'Proper extraction of seoSettings'
        )
    },
    {
        name: 'publishCustomization stores metaTags in database',
        check: () => checkFileContains(
            'server/controllers/career.controller.js',
            'metaTags: metaTags',
            'MetaTags stored with published content'
        )
    },
    {
        name: 'BaseUrl uses tenant-specific domain',
        check: () => checkFileContains(
            'server/controllers/career.controller.js',
            'https://careers.${req.tenantId}',
            'Tenant-aware canonical URL generation'
        )
    }
];

backendChecks.forEach(test => {
    if (test.check()) {
        results.passed++;
    } else {
        results.failed++;
    }
});

// ============= ROUTE CHECKS =============
log('blue', '\n🌐 ROUTE VALIDATION\n');

const routeChecks = [
    {
        name: 'career.routes.js exists',
        check: () => checkFileExists('server/routes/career.routes.js', 'Career routes file')
    },
    {
        name: 'GET /customize route exists',
        check: () => checkFileContains(
            'server/routes/career.routes.js',
            "router.get('/customize'",
            'Draft fetch route configured'
        )
    },
    {
        name: 'POST /customize route exists',
        check: () => checkFileContains(
            'server/routes/career.routes.js',
            "router.post('/customize'",
            'Draft save route configured'
        )
    },
    {
        name: 'POST /publish route exists',
        check: () => checkFileContains(
            'server/routes/career.routes.js',
            "router.post('/publish'",
            'Publish route configured'
        )
    }
];

routeChecks.forEach(test => {
    if (test.check()) {
        results.passed++;
    } else {
        results.failed++;
    }
});

// ============= COMPONENT CHECKS =============
log('blue', '\n🧩 COMPONENT VALIDATION\n');

const componentChecks = [
    {
        name: 'SEOSettings.jsx exists',
        check: () => checkFileExists('client/src/pages/HR/CareerBuilder/SEOSettings.jsx', 'SEO Settings component')
    },
    {
        name: 'SEOSettings has validation',
        check: () => checkFileContains(
            'client/src/pages/HR/CareerBuilder/SEOSettings.jsx',
            'handleTitleChange',
            'Title validation implemented'
        )
    },
    {
        name: 'CareerBuilder.jsx exists',
        check: () => checkFileExists('client/src/pages/HR/CareerBuilder/CareerBuilder.jsx', 'Career Builder component')
    },
    {
        name: 'CareerBuilder has handlePublish',
        check: () => checkFileContains(
            'client/src/pages/HR/CareerBuilder/CareerBuilder.jsx',
            'const handlePublish',
            'Publish handler implemented'
        )
    },
    {
        name: 'CareerBuilder validates SEO before publish',
        check: () => checkFileContains(
            'client/src/pages/HR/CareerBuilder/CareerBuilder.jsx',
            'seo_title',
            'SEO validation in publish'
        )
    },
    {
        name: 'CareerBuilder sends config with seoSettings',
        check: () => checkFileContains(
            'client/src/pages/HR/CareerBuilder/CareerBuilder.jsx',
            "api.post('/hrms/hr/career/publish', config)",
            'Complete config with SEO sent to backend'
        )
    }
];

componentChecks.forEach(test => {
    if (test.check()) {
        results.passed++;
    } else {
        results.failed++;
    }
});

// ============= SUMMARY =============
console.log('');
log('cyan', '═══════════════════════════════════════════════════════════════');
log('cyan', '  VALIDATION RESULTS');
log('cyan', '═══════════════════════════════════════════════════════════════');
console.log('');

const total = results.passed + results.failed;
const percentage = ((results.passed / total) * 100).toFixed(1);

if (results.failed === 0) {
    log('green', `✓ ALL CHECKS PASSED: ${results.passed}/${total} (${percentage}%)`);
    log('green', '\n🎉 SEO Settings implementation is complete and ready for testing!');
} else {
    if (results.passed > 0) {
        log('yellow', `⚠ PARTIAL SUCCESS: ${results.passed}/${total} (${percentage}%)`);
    } else {
        log('red', `✗ ALL CHECKS FAILED: ${results.passed}/${total} (${percentage}%)`);
    }
    log('yellow', `\n❌ ${results.failed} issue(s) found. Review the output above.`);
}

console.log('');
log('cyan', '═══════════════════════════════════════════════════════════════\n');

// Return appropriate exit code
process.exit(results.failed === 0 ? 0 : 1);
