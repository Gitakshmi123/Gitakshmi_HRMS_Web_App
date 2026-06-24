const fs = require('fs');
const path = require('path');
const listEndpoints = require('express-list-endpoints');

// Set dummy env vars to prevent startup crashes if needed
process.env.PORT = 5099;
process.env.NODE_ENV = 'development';

const app = require('../app'); // Require the express app

async function generate() {
    console.log('Extracting endpoints from Express app...');
    const endpoints = listEndpoints(app);
    
    const swaggerOutput = {
        openapi: '3.0.0',
        info: {
            title: 'GT HRMS Enterprise API Documentation',
            version: '1.0.0',
            description: 'Dynamically generated API documentation covering all routes in the GT HRMS backend system.',
        },
        servers: [
            { url: 'http://localhost:5009', description: 'Development Server' },
            { url: 'https://staging-api.company.com', description: 'Staging Server' },
            { url: 'https://api.company.com', description: 'Production Server' }
        ],
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
            }
        },
        security: [{ bearerAuth: [] }],
        paths: {}
    };

    endpoints.forEach(endpoint => {
        // endpoint format: { path: '/api/users', methods: ['GET', 'POST'], middlewares: [...] }
        
        // Fix express params (e.g., :id to {id})
        const swaggerPath = endpoint.path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
        
        if (!swaggerOutput.paths[swaggerPath]) {
            swaggerOutput.paths[swaggerPath] = {};
        }

        // Determine tag based on first path segment
        const segments = endpoint.path.split('/').filter(Boolean);
        let tag = 'General';
        if (segments.length > 1 && segments[0] === 'api') {
            tag = segments[1].charAt(0).toUpperCase() + segments[1].slice(1);
        } else if (segments.length > 0 && segments[0] !== 'api') {
             tag = segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
        }

        endpoint.methods.forEach(method => {
            const lowerMethod = method.toLowerCase();
            
            // Extract parameters
            const parameters = [];
            const pathParams = swaggerPath.match(/\{([a-zA-Z0-9_]+)\}/g);
            if (pathParams) {
                pathParams.forEach(param => {
                    const paramName = param.replace(/[{}]/g, '');
                    parameters.push({
                        name: paramName,
                        in: 'path',
                        required: true,
                        schema: { type: 'string' }
                    });
                });
            }

            swaggerOutput.paths[swaggerPath][lowerMethod] = {
                summary: `${method} ${endpoint.path}`,
                tags: [tag],
                parameters: parameters,
                responses: {
                    '200': {
                        description: 'Successful response'
                    }
                }
            };

            // Add basic body for POST/PUT/PATCH
            if (['post', 'put', 'patch'].includes(lowerMethod)) {
                swaggerOutput.paths[swaggerPath][lowerMethod].requestBody = {
                    content: {
                        'application/json': {
                            schema: { type: 'object' }
                        }
                    }
                };
            }
        });
    });

    const outputPath = path.join(__dirname, '../config/swagger-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(swaggerOutput, null, 2));
    console.log(`✅ Generated Swagger documentation for ${endpoints.length} routes at ${outputPath}!`);
    process.exit(0);
}

generate().catch(err => {
    console.error('❌ Generation failed:', err);
    process.exit(1);
});

