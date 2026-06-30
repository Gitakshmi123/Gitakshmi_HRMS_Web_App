const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-COMPANY SUPPORT
// Each HRMS Company record stores `dmsCompanyId` which maps it to its DMS company.
// Fallback: DMS_DEFAULT_COMPANY_ID env var.
// ─────────────────────────────────────────────────────────────────────────────

async function resolveDmsCompanyId(tenantDbName) {
    try {
        // 1️⃣  Try main DB: Tenant collection keyed by databaseName
        const Tenant = mongoose.models['Tenant'] || mongoose.model('Tenant', require('../models/Tenant'));
        const tenantRecord = await Tenant.findOne({ databaseName: tenantDbName }).select('dmsCompanyId companyName').lean();
        if (tenantRecord?.dmsCompanyId) {
            console.log(`[DMS Sync] Using dmsCompanyId from Tenant record: ${tenantRecord.dmsCompanyId} ("${tenantRecord.companyName}")`);
            return tenantRecord.dmsCompanyId;
        }

        // 2️⃣  Fall back to tenant-specific DB companies collection
        const db = mongoose.connection.useDb(tenantDbName);
        const company = await db.collection('companies').findOne({});
        if (company?.dmsCompanyId) {
            console.log(`[DMS Sync] Using dmsCompanyId from tenant DB company: ${company.dmsCompanyId} ("${company.name}")`);
            return company.dmsCompanyId;
        }

        // 3️⃣  Final fallback: env variable
        const fallback = process.env.DMS_DEFAULT_COMPANY_ID || process.env.DMS_COMPANY_ID;
        console.log(`[DMS Sync] No dmsCompanyId found. Using env fallback: ${fallback}`);
        return fallback;
    } catch (err) {
        console.error('[DMS Sync] resolveDmsCompanyId error:', err.message);
        return process.env.DMS_DEFAULT_COMPANY_ID || process.env.DMS_COMPANY_ID;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// FILE DOWNLOAD / READ HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function downloadToBuffer(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadToBuffer(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

function guessMimeType(filePath) {
    const ext = path.extname((filePath || '').split('?')[0]).toLowerCase();
    const map = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return map[ext] || 'application/octet-stream';
}

/**
 * Get file buffer from either a Cloudinary/HTTP URL or a local file path.
 * HRMS stores resumes as local filenames (e.g. "resume-xxx.pdf") in uploads/resumes/.
 * Offer letters are stored locally in uploads/offers/.
 */
async function getFileBuffer(fileSource, baseDir) {
    if (!fileSource) throw new Error('Empty file source');

    // HTTP URL → download from Cloudinary/internet
    if (fileSource.startsWith('http://') || fileSource.startsWith('https://')) {
        return downloadToBuffer(fileSource);
    }

    // Local path/filename — HRMS server root is one level up from services/
    const serverRoot = path.resolve(__dirname, '..'); // services/ → server/

    // If it already looks like an absolute path, try directly first
    if (path.isAbsolute(fileSource) && fs.existsSync(fileSource)) {
        return fs.promises.readFile(fileSource);
    }

    // Build candidate paths (in order of likelihood)
    const basename = path.basename(fileSource);
    const candidates = [
        path.join(serverRoot, fileSource),                          // relative path from server root
        path.join(serverRoot, 'uploads', 'resumes', basename),     // resume files
        path.join(serverRoot, 'uploads', 'offers', basename),       // offer/joining letters
        path.join(serverRoot, 'uploads', 'documents', basename),    // general docs
        path.join(serverRoot, 'uploads', basename),                  // any other upload
    ];

    if (baseDir) candidates.push(path.join(baseDir, basename));

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return fs.promises.readFile(candidate);
        }
    }

    throw new Error(`File not found: ${fileSource} (searched in uploads/resumes, uploads/offers, uploads/documents)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// POSITION RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

async function resolvePositionInfo(record, tenantDbName) {
    try {
        const db = mongoose.connection.useDb(tenantDbName);
        const jobId = record.jobId;
        if (!jobId) return null;

        const requirement = await db.collection('requirements').findOne({
            _id: mongoose.Types.ObjectId.isValid(String(jobId)) ? new mongoose.Types.ObjectId(String(jobId)) : jobId
        });

        return requirement ? {
            positionId: requirement.jobOpeningId || String(requirement._id),
            positionName: requirement.jobTitle || 'Unknown Position'
        } : null;
    } catch (err) {
        console.error('[DMS Sync] resolvePositionInfo error:', err.message);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// COLLECT ALL DOCUMENTS FOR A CANDIDATE
// Sources:
//   1. record.documentDetails   → KYC docs (aadharFront, aadharBack, panCard, bankProof, etc.)
//   2. candidate.resume          → resume (local file in uploads/resumes/)
//   3. applicant.resume          → resume fallback (local file in uploads/resumes/)
//   4. applicant.offerLetterPath → Offer Letter (local file in uploads/offers/)
//   5. applicant.signedOfferPath → Signed Offer Letter (local file in uploads/offers/)
//   6. applicant.joiningLetterPath → Joining Letter (local file in uploads/offers/)
//   7. record.bankDetails.bankProofUrl → Bank Proof document
// ─────────────────────────────────────────────────────────────────────────────

async function collectAllDocuments(record, tenantDbName) {
    const db = mongoose.connection.useDb(tenantDbName);
    const allDocs = {};

    // 1. KYC & submitted documents from ExternalEmployeeRecord.documentDetails
    const docDetails = record.documentDetails || {};
    for (const [key, url] of Object.entries(docDetails)) {
        if (url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('/'))) {
            allDocs[key] = url;
        }
    }

    // 2. Bank proof from bankDetails
    const bankProofUrl = record.bankDetails?.bankProofUrl;
    if (bankProofUrl && typeof bankProofUrl === 'string') {
        allDocs['bankProof'] = bankProofUrl;
    }

    // 3. Resume from Candidate record (local file)
    if (record.candidateId) {
        try {
            const candidateObjId = mongoose.Types.ObjectId.isValid(String(record.candidateId))
                ? new mongoose.Types.ObjectId(String(record.candidateId))
                : record.candidateId;
            const candidate = await db.collection('candidates').findOne({ _id: candidateObjId });
            const resumePath = candidate?.resume || candidate?.resumeUrl;
            if (resumePath && typeof resumePath === 'string') {
                allDocs['Resume'] = resumePath;
            }
        } catch (err) {
            console.warn('[DMS Sync] Could not fetch candidate resume:', err.message);
        }
    }

    // 4. Offer Letter, Signed Offer, Joining Letter from Applicant record
    if (record.applicantId) {
        try {
            const applicantObjId = mongoose.Types.ObjectId.isValid(String(record.applicantId))
                ? new mongoose.Types.ObjectId(String(record.applicantId))
                : record.applicantId;
            const applicant = await db.collection('applicants').findOne({ _id: applicantObjId });

            if (applicant) {
                // Offer Letter (local PDF generated by HRMS)
                if (applicant.offerLetterPath) {
                    allDocs['OfferLetter'] = applicant.offerLetterPath;
                }
                // Signed Offer Letter (uploaded by candidate)
                if (applicant.signedOfferPath) {
                    allDocs['SignedOfferLetter'] = applicant.signedOfferPath;
                }
                // Joining Letter
                if (applicant.joiningLetterPath) {
                    allDocs['JoiningLetter'] = applicant.joiningLetterPath;
                }
                // Resume from applicant (fallback if not from candidate)
                if (!allDocs['Resume'] && applicant.resume) {
                    allDocs['Resume'] = applicant.resume;
                }
            }
        } catch (err) {
            console.warn('[DMS Sync] Could not fetch applicant documents:', err.message);
        }
    }

    // 5. Also try to find applicant by candidateId + jobId if applicantId not set on record
    if (!record.applicantId && record.candidateId && record.jobId) {
        try {
            const candidateObjId = mongoose.Types.ObjectId.isValid(String(record.candidateId))
                ? new mongoose.Types.ObjectId(String(record.candidateId))
                : record.candidateId;
            const applicant = await db.collection('applicants').findOne({
                candidateId: candidateObjId
            });
            if (applicant) {
                if (applicant.offerLetterPath && !allDocs['OfferLetter']) {
                    allDocs['OfferLetter'] = applicant.offerLetterPath;
                }
                if (applicant.signedOfferPath && !allDocs['SignedOfferLetter']) {
                    allDocs['SignedOfferLetter'] = applicant.signedOfferPath;
                }
                if (applicant.joiningLetterPath && !allDocs['JoiningLetter']) {
                    allDocs['JoiningLetter'] = applicant.joiningLetterPath;
                }
                if (!allDocs['Resume'] && applicant.resume) {
                    allDocs['Resume'] = applicant.resume;
                }
            }
        } catch (err) {
            console.warn('[DMS Sync] Could not fetch applicant by candidateId:', err.message);
        }
    }

    return allDocs;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SYNC FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called after a candidate submits their onboarding profile.
 * Syncs ALL documents to DMS: KYC docs, resume, offer letter, signed offer, joining letter.
 */
async function notifyDmsApplicantAndDocuments(record, request, tenantDbName) {
    try {
        const dmsUrl = process.env.DMS_URL;
        const dmsToken = process.env.DMS_SECURE_TOKEN;

        if (!dmsUrl || !dmsToken) {
            console.warn('[DMS Sync] DMS_URL or DMS_SECURE_TOKEN not configured. Skipping.');
            return;
        }

        // ── 1. Resolve DMS company ID (per-company) ─────────────────────────
        const dbName = tenantDbName || 'company_gitakshmi_technologies_private';
        const dmsCompanyId = await resolveDmsCompanyId(dbName);

        if (!dmsCompanyId) {
            console.error('[DMS Sync] No DMS company ID found. Skipping.');
            return;
        }

        // ── 2. Resolve position info ─────────────────────────────────────────
        const posInfo = await resolvePositionInfo(record, dbName);
        const positionId = posInfo?.positionId || String(record.jobId || request?.jobId || '');
        const positionName = posInfo?.positionName || 'Unknown Position';
        const applicantId = String(record.candidateId || request?.candidateId || '');

        const firstName = record.personalDetails?.firstName || '';
        const lastName = record.personalDetails?.lastName || '';
        let candidateName = firstName ? `${firstName} ${lastName}`.trim() : '';
        
        if (!candidateName) {
            try {
                const db = mongoose.connection.useDb(dbName);
                const candIdStr = String(record.candidateId || request?.candidateId || '');
                const candidateObjId = mongoose.Types.ObjectId.isValid(candIdStr) ? new mongoose.Types.ObjectId(candIdStr) : candIdStr;
                const candidate = await db.collection('candidates').findOne({ _id: candidateObjId });
                if (candidate) {
                    candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
                }
            } catch(e) {
                console.error('[DMS Sync] Error fetching candidate name:', e.message);
            }
        }
        candidateName = candidateName || 'Candidate';

        if (!positionId || !applicantId) {
            console.warn('[DMS Sync] Missing positionId or applicantId. Skipping.');
            return;
        }

        console.log(`[DMS Sync] 🚀 Syncing "${candidateName}" → Position "${positionId} - ${positionName}"`);

        // ── 3. Ensure position folder ─────────────────────────────────────────
        try {
            await axios.post(
                `${dmsUrl}/api/v1/hrms/hiring/positions`,
                { companyId: dmsCompanyId, positionId, positionName },
                { headers: { 'x-hrms-secure-token': dmsToken }, timeout: 30000 }
            );
            console.log(`[DMS Sync] ✅ Position folder ready: "${positionId}"`);
        } catch (err) {
            console.warn(`[DMS Sync] ⚠️  Position folder (continuing): ${err?.response?.data?.message || err.message}`);
        }

        // ── 4. Ensure candidate folder ────────────────────────────────────────
        try {
            const folderRes = await axios.post(
                `${dmsUrl}/api/v1/hrms/hiring/applicants`,
                { companyId: dmsCompanyId, positionId, positionName, applicantId, candidateName },
                { headers: { 'x-hrms-secure-token': dmsToken }, timeout: 30000 }
            );
            console.log(`[DMS Sync] ✅ Candidate folder ready. folderId: ${folderRes.data?.data?.candidateFolderId}`);
        } catch (err) {
            console.error(`[DMS Sync] ❌ Candidate folder error: ${err?.response?.data?.message || err.message}`);
            return;
        }

        // ── 5. Collect ALL documents from all sources ─────────────────────────
        const allDocs = await collectAllDocuments(record, dbName);
        const docEntries = Object.entries(allDocs).filter(([, url]) => url && typeof url === 'string' && url.trim() !== '');

        console.log(`[DMS Sync] 📄 Found ${docEntries.length} document(s) to upload:`, docEntries.map(([k]) => k).join(', '));

        if (docEntries.length === 0) {
            console.log('[DMS Sync] No documents found. Nothing to upload.');
            return;
        }

        // ── 6. Upload each document into candidate folder ─────────────────────
        for (const [docKey, docUrl] of docEntries) {
            try {
                console.log(`[DMS Sync] ⬆️  Uploading "${docKey}"...`);
                const fileBuffer = await getFileBuffer(docUrl);
                const ext = path.extname((docUrl.split('?')[0]) || '').toLowerCase() || '.pdf';
                const filename = `${docKey}${ext}`;
                const mimeType = guessMimeType(docUrl);

                const form = new FormData();
                form.append('companyId', dmsCompanyId);
                form.append('positionId', positionId);
                form.append('positionName', positionName);
                form.append('applicantId', applicantId);
                form.append('candidateName', candidateName);
                form.append('docType', docKey);
                form.append('document', fileBuffer, { 
                    filename, 
                    contentType: mimeType,
                    knownLength: fileBuffer.length 
                });

                await axios.post(
                    `${dmsUrl}/api/v1/hrms/hiring/documents`,
                    form,
                    {
                        headers: { ...form.getHeaders(), 'x-hrms-secure-token': dmsToken },
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity,
                        timeout: 60000
                    }
                );
                console.log(`[DMS Sync] ✅ Uploaded "${docKey}" (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
            } catch (err) {
                const msg = err?.response?.data?.message || err.message;
                console.error(`[DMS Sync] ❌ Failed to upload "${docKey}": ${msg}`);
            }
        }

        console.log(`[DMS Sync] 🎉 Done syncing "${candidateName}".`);
    } catch (err) {
        console.error(`[DMS Sync] Unexpected error: ${err.message}`);
    }
}

module.exports = { notifyDmsApplicantAndDocuments, resolveDmsCompanyId };
