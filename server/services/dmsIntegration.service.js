'use strict';

/**
 * dmsIntegration.service.js
 * ══════════════════════════════════════════════════════════════════════
 * HRMS ➜ DMS Document Push Service
 *
 * Uploads an employee document to the external Document Management System
 * (DMS) via a secure REST API call, then stores the returned document_id
 * back into the HRMS Employee record for future cross-system reference.
 *
 * Environment variables required in GT_HRMS/server/.env:
 *   DMS_URL              – Base URL of the DMS server  (e.g. http://localhost:5000)
 *   DMS_SECURE_TOKEN     – Shared secret matched by X-HRMS-SECURE-TOKEN header
 *   DMS_TIMEOUT_MS       – (optional) request timeout in ms, default 30 000
 * ══════════════════════════════════════════════════════════════════════
 */

const fs        = require('fs');
const path      = require('path');
const axios     = require('axios');
const FormData  = require('form-data');
const mongoose  = require('mongoose');

/* ─── lazy-load the tenant-aware Employee model ──────────────────────── */
/**
 * The HRMS project uses a multi-tenant pattern where each tenant has its own
 * Mongoose connection. We therefore cannot import a pre-built model; instead
 * we resolve it from the connection stored on req.tenantConnection at request
 * time (passed in as `tenantConnection`).
 *
 * If you call this service outside of a request context (e.g. from a cron job)
 * you must pass the correct Mongoose connection object yourself.
 */
function getEmployeeModel(tenantConnection) {
  if (!tenantConnection) {
    throw new Error('[DMS] tenantConnection is required to resolve the Employee model.');
  }

  const EmployeeSchema = require('../models/Employee'); // exports Schema only
  return tenantConnection.models.Employee ||
    tenantConnection.model('Employee', EmployeeSchema);
}

/* ─── helpers ────────────────────────────────────────────────────────── */

/**
 * Reads DMS config from environment with sensible dev defaults.
 * Throws if mandatory variables are missing in production.
 */
function getDmsConfig() {
  const dmsUrl   = (process.env.DMS_URL || '').trim();
  const token    = (process.env.DMS_SECURE_TOKEN || '').trim();
  const timeout  = parseInt(process.env.DMS_TIMEOUT_MS || '30000', 10);
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  if (isProduction) {
    if (!dmsUrl)  throw new Error('[DMS] DMS_URL is not configured in environment variables.');
    if (!token)   throw new Error('[DMS] DMS_SECURE_TOKEN is not configured in environment variables.');
  }

  return {
    uploadEndpoint : `${dmsUrl || 'http://localhost:5000'}/api/v1/hrms/upload`,
    token          : token || 'dev-token-not-set',
    timeout,
  };
}

/**
 * Validates that the file at `tempFilePath` exists and is readable
 * before we attempt to stream it to the DMS.
 */
function assertFileReadable(tempFilePath) {
  try {
    fs.accessSync(tempFilePath, fs.constants.R_OK);
  } catch {
    throw new Error(`[DMS] File is not readable or does not exist: ${tempFilePath}`);
  }
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN SERVICE FUNCTION
   ══════════════════════════════════════════════════════════════════════ */

/**
 * uploadDocToDMS
 * ─────────────────────────────────────────────────────────────────────
 * Sends an employee document to the DMS and records the returned
 * document_id on the Employee document in the HRMS database.
 *
 * @param {object}  params
 * @param {string}  params.employeeId         HRMS employeeId string (e.g. "EMP-001")
 * @param {string}  params.employeeName       Full display name of the employee
 * @param {string}  params.docType            Document category (e.g. "payslip", "joining_letter")
 * @param {string}  params.tempFilePath       Absolute path to the temporary file on disk
 * @param {object}  params.tenantConnection   Active Mongoose connection for the tenant
 *
 * @returns {Promise<{
 *   success        : boolean,
 *   dmsDocumentId  : string,          // _id returned by DMS
 *   dmsFilePath    : string,          // relative storage path in DMS
 *   employeeRecord : object|null,     // updated Employee document (lean)
 * }>}
 *
 * @throws  {Error}  on validation failure — caller should wrap in try-catch
 */
async function uploadDocToDMS({
  employeeId,
  employeeName,
  docType,
  tempFilePath,
  tenantConnection,
}) {
  // ── 1. Input validation ────────────────────────────────────────────
  if (!employeeId?.trim())   throw new Error('[DMS] employeeId is required.');
  if (!employeeName?.trim()) throw new Error('[DMS] employeeName is required.');
  if (!docType?.trim())      throw new Error('[DMS] docType is required.');
  if (!tempFilePath)         throw new Error('[DMS] tempFilePath is required.');

  assertFileReadable(tempFilePath);

  const config = getDmsConfig();

  // ── 2. Build multipart form payload ───────────────────────────────
  const form = new FormData();

  // The DMS controller reads the file from the field named "document"
  form.append('document', fs.createReadStream(tempFilePath), {
    filename    : path.basename(tempFilePath),
    contentType : 'application/octet-stream',
  });

  form.append('employeeId',   employeeId.trim());
  form.append('employeeName', employeeName.trim());
  form.append('docType',      docType.trim().toLowerCase());

  // ── 3. POST to DMS upload endpoint ────────────────────────────────
  let dmsResponse;

  try {
    dmsResponse = await axios.post(config.uploadEndpoint, form, {
      headers: {
        ...form.getHeaders(),                        // sets Content-Type: multipart/form-data; boundary=...
        'X-HRMS-SECURE-TOKEN' : config.token,        // shared secret for DMS auth
        'Accept'              : 'application/json',
      },
      maxContentLength : Infinity,   // let FormData determine body size
      maxBodyLength    : Infinity,
      timeout          : config.timeout,
    });
  } catch (axiosErr) {
    // ── Network / DNS / Timeout errors ────────────────────────────
    if (axiosErr.code === 'ECONNREFUSED') {
      throw new Error(
        `[DMS] Connection refused. Is the DMS server running at ${config.uploadEndpoint}?`
      );
    }
    if (axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ETIMEDOUT') {
      throw new Error(`[DMS] Request timed out after ${config.timeout} ms.`);
    }

    // ── HTTP 4xx / 5xx errors ──────────────────────────────────────
    if (axiosErr.response) {
      const { status, data } = axiosErr.response;
      throw new Error(
        `[DMS] Server responded with HTTP ${status}: ${data?.error || data?.message || JSON.stringify(data)}`
      );
    }

    // ── Unknown errors ─────────────────────────────────────────────
    throw new Error(`[DMS] Unexpected error during upload: ${axiosErr.message}`);
  }

  // ── 4. Parse DMS response ──────────────────────────────────────────
  const { data: dmsData } = dmsResponse;

  if (!dmsData?.success || !dmsData?.data?._id) {
    throw new Error(
      `[DMS] Upload succeeded (HTTP 2xx) but response is missing expected fields. ` +
      `Response: ${JSON.stringify(dmsData)}`
    );
  }

  const dmsDocumentId = String(dmsData.data._id);
  const dmsFilePath   = String(dmsData.data.filePath || '');

  console.info(
    `[DMS] ✅ Document uploaded. employeeId=${employeeId} docType=${docType} ` +
    `dmsDocumentId=${dmsDocumentId} dmsFilePath=${dmsFilePath}`
  );

  // ── 5. Persist DMS reference into HRMS Employee record ────────────
  let updatedEmployee = null;

  try {
    const Employee = getEmployeeModel(tenantConnection);

    /*
     * We push a structured entry into `meta.dmsDocuments` — a flexible
     * array stored inside the existing `meta: Object` field on the Employee
     * schema. This avoids a schema migration while keeping all DMS refs
     * neatly organised per document type.
     *
     * Structure of each entry:
     * {
     *   dmsDocumentId : string,   ← _id from DMS MongoDB
     *   dmsFilePath   : string,   ← relative path in DMS storage
     *   docType       : string,   ← e.g. "payslip"
     *   uploadedAt    : Date,
     * }
     */
    updatedEmployee = await Employee.findOneAndUpdate(
      { employeeId: employeeId.trim() },
      {
        $push: {
          'meta.dmsDocuments': {
            dmsDocumentId,
            dmsFilePath,
            docType     : docType.trim().toLowerCase(),
            uploadedAt  : new Date(),
          },
        },
      },
      {
        new        : true,   // return the updated document
        lean       : true,   // plain JS object — no Mongoose overhead
        strict     : false,  // allow writing to `meta` sub-paths not in strict schema
        projection : {       // only return the fields we care about
          employeeId      : 1,
          firstName       : 1,
          lastName        : 1,
          'meta.dmsDocuments': 1,
        },
      }
    );

    if (!updatedEmployee) {
      // Non-fatal: the DMS upload succeeded; we just couldn't find the employee record.
      console.warn(
        `[DMS] ⚠️  Employee record not found for employeeId=${employeeId}. ` +
        `DMS document ${dmsDocumentId} was saved in DMS but NOT linked in HRMS.`
      );
    } else {
      console.info(
        `[DMS] 🔗 Employee record updated. employeeId=${employeeId} ` +
        `dmsDocuments count=${updatedEmployee.meta?.dmsDocuments?.length ?? 'unknown'}`
      );
    }
  } catch (dbErr) {
    // Database write failure is non-fatal for the upload itself.
    // Log it, but still return a partial success so the caller knows
    // the DMS upload did go through.
    console.error(
      `[DMS] ❌ HRMS DB update failed after successful DMS upload. ` +
      `dmsDocumentId=${dmsDocumentId} employeeId=${employeeId}. ` +
      `Error: ${dbErr.message}`
    );
  }

  return {
    success       : true,
    dmsDocumentId,
    dmsFilePath,
    employeeRecord: updatedEmployee,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   CONVENIENCE WRAPPER  –  fire-and-forget (non-blocking)
   ══════════════════════════════════════════════════════════════════════ */

/**
 * uploadDocToDMSBackground
 * ─────────────────────────────────────────────────────────────────────
 * Non-blocking version. Kicks off the DMS upload in the background
 * without making the caller await the result. Errors are only logged.
 *
 * Use this when you want the HRMS API response to return immediately
 * to the client and the DMS push to happen asynchronously.
 *
 * @param {object} params – same as uploadDocToDMS
 * @returns {void}
 */
function uploadDocToDMSBackground(params) {
  setImmediate(async () => {
    try {
      const result = await uploadDocToDMS(params);
      console.info(
        `[DMS-BG] ✅ Background upload complete. dmsDocumentId=${result.dmsDocumentId}`
      );
    } catch (err) {
      console.error(`[DMS-BG] ❌ Background upload failed: ${err.message}`);
    }
  });
}

module.exports = {
  uploadDocToDMS,
  uploadDocToDMSBackground,
};
