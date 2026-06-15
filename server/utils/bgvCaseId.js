async function generateBGVCaseId(BGVCase) {
    const year = new Date().getFullYear();
    const prefix = `BGV-${year}-`;

    const latest = await BGVCase.findOne({
        caseId: { $regex: `^${prefix}\\d+$` }
    })
        .sort({ caseId: -1 })
        .select('caseId')
        .lean();

    const latestSequence = latest?.caseId
        ? Number.parseInt(latest.caseId.slice(prefix.length), 10)
        : 0;

    const nextSequence = Number.isFinite(latestSequence) ? latestSequence + 1 : 1;
    return `${prefix}${nextSequence.toString().padStart(5, '0')}`;
}

async function createBGVCaseWithUniqueId(BGVCase, caseData, maxAttempts = 5) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const caseId = await generateBGVCaseId(BGVCase);

        try {
            return await BGVCase.create({
                ...caseData,
                caseId
            });
        } catch (err) {
            const isDuplicateCaseId = err?.code === 11000 && err?.keyPattern?.caseId;
            if (!isDuplicateCaseId || attempt === maxAttempts - 1) {
                throw err;
            }
        }
    }

    throw new Error('Unable to generate unique BGV case ID');
}

module.exports = {
    createBGVCaseWithUniqueId,
    generateBGVCaseId
};
