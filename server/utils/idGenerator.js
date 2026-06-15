const mongoose = require('mongoose');

/**
 * Generate unique ID via the centralized Counter system
 * Performs atomic increments and ensures yearly reset.
 */
async function generateId(db, entity, prefix) {
    try {
        const currentYear = new Date().getFullYear();
        const CounterSchema = require('../models/Counter');
        const Counter = db.models.Counter || db.model('Counter', CounterSchema);

        // Determine starting sequence
        let startFrom = 1;
        if (entity === 'EMP') startFrom = 1001;
        // You can add more starting points here if needed

        // Atomic search and increment
        let counter = await Counter.findOneAndUpdate(
            { entity, year: currentYear },
            { $inc: { seq: 1 }, $set: { prefix } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        // Handle starting sequence for new counters
        // If it was just created (upserted), seq might be 1. 
        // If startFrom is 1001, we need to jump.
        if (counter.seq < startFrom) {
            counter = await Counter.findOneAndUpdate(
                { entity, year: currentYear },
                { $set: { seq: startFrom } },
                { new: true }
            );
        }

        const paddedSeq = String(counter.seq).padStart(4, '0');
        return `${prefix}-${currentYear}-${paddedSeq}`;
    } catch (err) {
        console.error(`[ID Generator] Atomic generation failed for ${entity}:`, err.message);
        // Fallback to legacy or timestamp-based if fatal
        return `${prefix}-${Date.now()}`;
    }
}

// Wrapper functions for backward compatibility
async function generateJobId(db) { return generateId(db, 'JOB', 'JOB'); }
async function generateCandidateId(db) { return generateId(db, 'CAND', 'CAN'); }
async function generateApplicationId(db) { return generateId(db, 'APP', 'APP'); }
async function generateInterviewId(db) { return generateId(db, 'INT', 'INT'); }
async function generateOfferId(db) { return generateId(db, 'OFFER', 'OFF'); }
async function generatePositionId(db) { return generateId(db, 'POS', 'POS'); }
async function generateEmployeeId(db) { return generateId(db, 'EMP', 'EMP'); }

async function generatePayslipId(db, employeeId, month, year) {
    const monthStr = String(month).padStart(2, '0');
    const yearMonth = `${year}${monthStr}`;
    const empNumber = employeeId.split('-').pop();
    return `PAY-${yearMonth}-${empNumber}`;
}

async function getCurrentCounter(db, entity) {
    const CounterSchema = require('../models/Counter');
    const Counter = db.models.Counter || db.model('Counter', CounterSchema);
    const currentYear = new Date().getFullYear();
    const counter = await Counter.findOne({ entity, year: currentYear });
    return counter ? counter.seq : 0;
}

module.exports = {
    generateId,
    generateJobId,
    generateCandidateId,
    generateApplicationId,
    generateInterviewId,
    generateOfferId,
    generatePositionId,
    generateEmployeeId,
    generatePayslipId,
    getCurrentCounter
};
