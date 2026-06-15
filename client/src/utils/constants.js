import APP_CONFIG from './appConfig';

const hrmsRoot = String(APP_CONFIG.HRMS_API_ROOT || '').replace(/\/+$/, '');

export const API_BASE = hrmsRoot ? `${hrmsRoot}/api` : '/api';
export const APP_BASE_URL = APP_CONFIG.APP_BASE_URL;

export default API_BASE;
