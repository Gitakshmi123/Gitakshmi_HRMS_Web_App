const fs = require('fs');
const path = require('path');

const ROUTE_META = [
    { pattern: /^\/$/, title: 'GitakshmiHR', description: 'Secure enterprise HRMS portal.' },
    { pattern: /^\/login/, title: 'Secure Login | GitakshmiHR', description: 'Sign in to the protected GitakshmiHR workspace.' },
    { pattern: /^\/tenant/, title: 'Tenant Workspace | GitakshmiHR', description: 'Protected tenant workspace for HR and operations teams.' },
    { pattern: /^\/hr/, title: 'HR Workspace | GitakshmiHR', description: 'Protected HR workspace for authorized personnel.' },
    { pattern: /^\/employee/, title: 'Employee Workspace | GitakshmiHR', description: 'Protected employee self-service portal.' },
    { pattern: /^\/candidate|^\/jobs|^\/careers/, title: 'Careers | GitakshmiHR', description: 'Explore careers and candidate journeys on GitakshmiHR.' },
];

function resolveMeta(requestPath) {
    return ROUTE_META.find((entry) => entry.pattern.test(requestPath)) || ROUTE_META[0];
}

function buildShellMarkup(requestPath) {
    const safePath = String(requestPath || '/');
    return `
    <div class="app-shell">
      <header class="shell-header">
        <div class="shell-brand">GitakshmiHR</div>
        <div class="shell-status">Secure session bootstrap</div>
      </header>
      <main class="shell-main">
        <div class="shell-card">
          <h1>Loading protected workspace</h1>
          <p>Preparing an enterprise-secure session for <strong>${safePath}</strong>.</p>
        </div>
      </main>
    </div>
  `;
}

function injectHeadMeta(template, meta) {
    let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${meta.title}</title>`);

    if (html.includes('name="description"')) {
        html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${meta.description}" />`);
    } else {
        html = html.replace('</head>', `  <meta name="description" content="${meta.description}" />\n</head>`);
    }

    return html;
}

function renderShell({ clientDistDir, requestPath }) {
    const templatePath = path.join(clientDistDir, 'index.html');
    const template = fs.readFileSync(templatePath, 'utf8');
    const meta = resolveMeta(requestPath);
    const shellMarkup = buildShellMarkup(requestPath);
    const withMeta = injectHeadMeta(template, meta);

    return withMeta.replace(
        '<div id="root"></div>',
        `<div id="root">${shellMarkup}</div>`
    );
}

module.exports = {
    renderShell,
};
