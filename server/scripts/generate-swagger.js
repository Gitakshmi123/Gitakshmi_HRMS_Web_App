const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });
const path = require('path');

const doc = {
  info: {
    title: 'GT HRMS Complete Enterprise API Documentation',
    version: '1.0.0',
    description: 'Auto-generated API documentation for the entire GT HRMS backend system.',
  },
  servers: [
    {
      url: 'http://localhost:5009',
      description: 'Development Server'
    },
    {
      url: 'https://staging-api.company.com',
      description: 'Staging Server'
    },
    {
      url: 'https://api.company.com',
      description: 'Production Server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      }
    }
  },
  security: [
    {
      bearerAuth: [],
    }
  ]
};

const fs = require('fs');

const routesDir = path.join(__dirname, '../routes');
const routeFiles = fs.readdirSync(routesDir)
  .filter(file => file.endsWith('.routes.js') || file === 'index.js')
  .map(file => path.join(routesDir, file));

const modulesDir = path.join(__dirname, '../modules');
// We won't deeply scan modules to avoid node_modules in them, but let's grab top level .routes.js if any, or just rely on routes/ for now.
const endpointsFiles = [...routeFiles];

const outputFile = path.join(__dirname, '../config/swagger-output.json');

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
    console.log('✅ Swagger documentation auto-generated successfully at server/config/swagger-output.json!');
    process.exit(0);
});
