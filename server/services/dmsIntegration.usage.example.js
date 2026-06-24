/**
 * USAGE EXAMPLE — How to call dmsIntegration.service.js
 * ══════════════════════════════════════════════════════════════════════
 * Drop this pattern into any existing HRMS controller (payslip, 
 * onboarding, document upload, etc.) after you have saved the file
 * locally or generated a PDF on disk.
 * ══════════════════════════════════════════════════════════════════════
 */

const { uploadDocToDMS, uploadDocToDMSBackground } = require('../services/dmsIntegration.service');
const path = require('path');

// ── EXAMPLE 1: Blocking (await the result before responding) ─────────
// Use this when you need the DMS document_id IN the API response.
// ─────────────────────────────────────────────────────────────────────
async function uploadPayslipController(req, res) {
  try {
    // --- your existing logic: generate / save the file ---
    const tempFilePath  = path.join(__dirname, '../temp', 'payslip-EMP001-Jun2026.pdf');
    const { employeeId, employeeName } = req.body;

    // --- push to DMS ---
    const dmsResult = await uploadDocToDMS({
      employeeId,                    // e.g. "EMP-001"
      employeeName,                  // e.g. "Rahul Sharma"
      docType     : 'payslip',       // freeform category string
      tempFilePath,                  // absolute path to file on disk
      tenantConnection: req.tenantConnection, // tenant-aware Mongoose connection
    });

    return res.status(200).json({
      success      : true,
      message      : 'Payslip generated and pushed to DMS.',
      dmsDocumentId: dmsResult.dmsDocumentId,   // ← store this if needed
      dmsFilePath  : dmsResult.dmsFilePath,
    });

  } catch (err) {
    console.error('[uploadPayslipController]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}


// ── EXAMPLE 2: Non-blocking (fire-and-forget background push) ────────
// Use this when you don't want to delay the API response.
// The DMS push happens silently in the background.
// ─────────────────────────────────────────────────────────────────────
async function uploadJoiningLetterController(req, res) {
  try {
    const tempFilePath = path.join(__dirname, '../temp', 'joining-letter-EMP002.pdf');
    const { employeeId, employeeName } = req.body;

    // Respond to the client immediately
    res.status(200).json({
      success: true,
      message: 'Joining letter generated. It will be synced to DMS shortly.',
    });

    // Push to DMS in background — does NOT block the response above
    uploadDocToDMSBackground({
      employeeId,
      employeeName,
      docType          : 'joining_letter',
      tempFilePath,
      tenantConnection : req.tenantConnection,
    });

  } catch (err) {
    console.error('[uploadJoiningLetterController]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { uploadPayslipController, uploadJoiningLetterController };
