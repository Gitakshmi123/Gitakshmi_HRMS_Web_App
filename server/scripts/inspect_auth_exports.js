require('dotenv').config();
const path = require('path');
const ctrlPath = path.join(__dirname, '..', 'controllers', 'auth.controller.js');
try {
  const ctrl = require(ctrlPath);
  console.log('Exports from auth.controller:');
  Object.keys(ctrl).forEach(k => {
    console.log(k, typeof ctrl[k]);
  });
} catch (err) {
  console.error('Error requiring controller:', err && err.stack ? err.stack : err);
  process.exit(1);
}
