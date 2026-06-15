const axios = require('axios');

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function normalizeGstin(value = '') {
  return String(value || '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

function buildAddress(addr = {}) {
  if (!addr || typeof addr !== 'object') return '';

  return [
    addr.bno,
    addr.flno,
    addr.bnm,
    addr.st,
    addr.loc,
    addr.dst,
    addr.stcd,
    addr.pncd
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .filter((part, index, list) => list.indexOf(part) === index)
    .join(', ');
}

function pickTaxpayerInfo(responseData = {}) {
  if (!responseData || typeof responseData !== 'object') return null;
  return responseData.data || responseData.taxpayerInfo || responseData.result || responseData;
}

function normalizeGstResponse(gstin, responseData = {}) {
  const info = pickTaxpayerInfo(responseData) || {};
  const primaryAddress = info.pradr || info.primaryAddress || {};
  const addressInfo = primaryAddress.addr || primaryAddress.address || primaryAddress;
  const legalName = info.lgnm || info.legalName || info.legal_name || '';
  const tradeName = info.tradeNam || info.tradeName || info.trade_name || '';
  const state = addressInfo.stcd || info.stjCd || info.state || '';
  const address = primaryAddress.adr || info.address || buildAddress(addressInfo);

  return {
    gstin,
    pan: gstin.slice(2, 12),
    legalName: String(legalName || tradeName || '').trim(),
    tradeName: String(tradeName || legalName || '').trim(),
    companyName: String(tradeName || legalName || '').trim(),
    address: String(address || '').trim(),
    state: String(state || '').trim(),
    country: 'India',
    registrationDate: info.rgdt || info.registrationDate || '',
    status: info.sts || info.status || '',
    taxpayerType: info.ctb || info.taxpayerType || ''
  };
}

async function lookupGstin(rawGstin) {
  const gstin = normalizeGstin(rawGstin);
  if (!GSTIN_REGEX.test(gstin)) {
    const error = new Error('Invalid GSTIN format.');
    error.status = 400;
    throw error;
  }

  const apiKey = String(process.env.GSTIN_CHECK_API_KEY || process.env.GST_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('GST lookup API key is not configured.');
    error.status = 503;
    throw error;
  }

  const apiRoot = String(process.env.GSTIN_CHECK_API_ROOT || 'https://sheet.gstincheck.co.in').replace(/\/+$/, '');
  const url = `${apiRoot}/check/${encodeURIComponent(apiKey)}/${encodeURIComponent(gstin)}`;
  const response = await axios.get(url, { timeout: 15000 });
  const normalized = normalizeGstResponse(gstin, response.data);

  if (!normalized.companyName && !normalized.address && !normalized.status) {
    const error = new Error(response.data?.message || 'GST details were not found for this GSTIN.');
    error.status = 404;
    throw error;
  }

  return normalized;
}

module.exports = {
  lookupGstin,
  normalizeGstin
};
