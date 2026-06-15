const mongoose = require('mongoose');
const idGenerator = require('../utils/idGenerator');

/**
 * Preview the NEXT generated ID for an entity
 * GET /api/id-config/preview?entity=EMP&prefix=EMP
 */
exports.previewNextId = async (req, res) => {
    try {
        const { entity, prefix } = req.query;
        if (!entity || !prefix) {
            return res.status(400).json({ success: false, message: 'Entity and Prefix are required' });
        }

        const currentYear = new Date().getFullYear();
        const lastSeq = await idGenerator.getCurrentCounter(req.tenantDB, entity);

        // Determine starting sequence logic (must match generateId logic)
        let nextSeq = lastSeq + 1;
        if (entity === 'EMP' && nextSeq < 1001) nextSeq = 1001;
        else if (entity !== 'EMP' && nextSeq < 1) nextSeq = 1;

        const paddedSeq = String(nextSeq).padStart(4, '0');
        const previewId = `${prefix}-${currentYear}-${paddedSeq}`;

        res.json({
            success: true,
            data: {
                entity,
                prefix,
                year: currentYear,
                nextSequence: nextSeq,
                previewId
            }
        });
    } catch (error) {
        console.error('[ID Config] Preview failed:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Audit IDs for an entity (check for gaps)
 * GET /api/id-config/audit/:entity
 */
exports.auditIds = async (req, res) => {
    try {
        const { entity } = req.params;
        const { year } = req.query;
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const db = req.tenantDB;
        let Model;
        let idField;

        // Map entity to Model and ID Field
        switch (entity) {
            case 'EMP':
                Model = db.model('Employee');
                idField = 'employeeId';
                break;
            case 'CAND':
                Model = db.model('Candidate');
                idField = 'candidateId';
                break;
            case 'APP':
                Model = db.model('Applicant');
                idField = 'applicationId';
                break;
            default:
                return res.status(400).json({ success: false, message: 'Invalid entity for audit' });
        }

        // Get max sequence from Counter
        const lastSeq = await idGenerator.getCurrentCounter(db, entity);

        // Get all used IDs for this year
        const usedDocs = await Model.find({
            [idField]: { $regex: `-${targetYear}-` }
        }).select(idField).lean();

        const usedSeqs = usedDocs.map(doc => {
            const parts = doc[idField].split('-');
            return parseInt(parts[parts.length - 1]);
        }).sort((a, b) => a - b);

        // Find gaps
        const gaps = [];
        let startFrom = (entity === 'EMP') ? 1001 : 1;

        for (let i = startFrom; i <= lastSeq; i++) {
            if (!usedSeqs.includes(i)) {
                gaps.push(i);
            }
        }

        res.json({
            success: true,
            data: {
                entity,
                year: targetYear,
                totalGenerated: lastSeq - startFrom + 1,
                totalUsed: usedSeqs.length,
                missingCount: gaps.length,
                missingSequences: gaps
            }
        });
    } catch (error) {
        console.error('[ID Config] Audit failed:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
