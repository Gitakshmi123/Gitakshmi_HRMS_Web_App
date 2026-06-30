const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');

const setupSwagger = (app) => {
  const swaggerFilePath = path.join(__dirname, 'swagger-output.json');
  
  // Only setup if the file exists (after the generator script is run)
  if (fs.existsSync(swaggerFilePath)) {
    const swaggerDocument = require('./swagger-output.json');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
      },
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'GT HRMS API Docs'
    }));
  } else {
    console.warn("⚠️ Swagger output file not found. Please run 'npm run swagger-gen'");
  }
};

module.exports = setupSwagger;
