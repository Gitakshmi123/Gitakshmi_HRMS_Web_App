const { loadEnv } = require('vite');
const path = require('path');

const env = loadEnv('development', __dirname);
console.log('VITE_HRMS_API_ROOT:', env.VITE_HRMS_API_ROOT);
console.log('VITE_API_URL:', env.VITE_API_URL);
console.log('BACKEND_URL from env:', env.BACKEND_URL);

const rawAppBaseUrl =
  env.VITE_APP_BASE_URL ||
  env.VITE_BASE_URL ||
  env.BACKEND_URL ||
  env.VITE_HRMS_API_ROOT ||
  env.VITE_API_URL ||
  '';

const normalizeBackendUrl = (value) =>
  String(value || '').trim().replace(/\/+$/, '').replace(/\/api$/i, '');
const BACKEND_URL = normalizeBackendUrl(rawAppBaseUrl) || 'http://localhost:5003';

console.log('Resolved BACKEND_URL in Vite Config:', BACKEND_URL);
