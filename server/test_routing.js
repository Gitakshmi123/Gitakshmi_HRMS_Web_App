const app = require('./app');

// Helper to inspect the Express router stack
function printRoutes(stack, prefix = '') {
    stack.forEach(layer => {
        if (layer.route) {
            const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
            console.log(`${methods} ${prefix}${layer.route.path}`);
            if (layer.route.stack) {
                layer.route.stack.forEach(s => {
                    console.log(`  - Middleware: ${s.name}`);
                });
            }
        } else if (layer.name === 'router' && layer.handle.stack) {
            const nextPrefix = prefix + (layer.regexp.source.replace('\\/?$', '').replace('(?=\\/|$)', '').replace('^\\/', '').replace('\\/', '/') || '');
            printRoutes(layer.handle.stack, '/' + nextPrefix);
        } else if (layer.name === 'bound dispatch' && layer.route) {
            console.log(`BOUND DISPATCH ${prefix}${layer.route.path}`);
        } else {
            console.log(`Middleware: ${layer.name} on ${prefix || '/'}`);
        }
    });
}

printRoutes(app._router.stack);
