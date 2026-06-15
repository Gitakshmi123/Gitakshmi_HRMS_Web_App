const fs = require('fs');
let c = fs.readFileSync('server/services/realFaceRecognition.service.js', 'utf8');

const newInit = `
// Try to load face-api with fallback
let faceapi;
let canvas;
let loadImage;
let faceApiRuntimeAvailable = false;
let canvasRuntimeAvailable = false;

try {
  require('@tensorflow/tfjs');
  require('@tensorflow/tfjs-backend-wasm');
  faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
  faceapi.tf.setBackend('wasm');
  faceApiRuntimeAvailable = true;
  console.log('✅ Loaded face-api (WASM Backend)');
} catch (e) {
  try {
    faceapi = require('@vladmandic/face-api');
    faceApiRuntimeAvailable = true;
    console.log('✅ Loaded face-api (Node Backend)');
  } catch (e2) {
    console.warn('⚠️ face-api not available, using fallback mode');
  }
}
`;

// Replace lines 10 to 22 (the old init block)
c = c.replace(/\/\/ Try to load face-api with fallback[\s\S]*?catch \(e\) \{\s*\/\/\s*console\.warn\('⚠️ face-api not available, using fallback mode'\);\s*\}/, newInit.trim());

// Remove the bypass hack
c = c.replace(/if \(!faceApiRuntimeAvailable\) \{\s*console\.warn\('⚠️ face-api runtime unavailable, bypassing face matching validation\.'\);\s*return \{[\s\S]*?timestamp: new Date\(\)\s*\};\s*\}/, '');

fs.writeFileSync('server/services/realFaceRecognition.service.js', c);
console.log('Fixed realFaceRecognition initialization.');
