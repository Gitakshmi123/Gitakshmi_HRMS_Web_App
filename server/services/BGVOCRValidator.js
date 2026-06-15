/**
 * ✅ BGV OCR Validator
 * Validates OCR-extracted data against candidate profiles and business rules
 */
class BGVOCRValidator {

    /**
     * Validate extracted fields against candidate data
     * @param {Object} extracted - Extracted structured fields
     * @param {Object} candidate - Candidate profile data
     * @param {String} documentType - Type of document
     * @returns {Object} - Validation result
     */
    static validate(extracted, candidate, documentType) {
        const result = {
            status: 'MATCHED',
            score: 0,
            mismatchedFields: [],
            flags: []
        };

        if (!extracted || !candidate) {
            result.status = 'REVIEW_REQUIRED';
            return result;
        }

        let totalWeight = 0;
        let matchedWeight = 0;

        // 1. Validate ID Number
        if (extracted.idNumber) {
            totalWeight += 40;
            // In a real system, we'd check against profile.aadhaarNumber or profile.panNumber
            const profileId = this.findProfileId(candidate, documentType);

            if (profileId && this.sanitize(profileId) === this.sanitize(extracted.idNumber)) {
                matchedWeight += 40;
            } else if (profileId) {
                result.mismatchedFields.push('idNumber');
                result.flags.push({
                    flag: 'ID_MISMATCH',
                    severity: 'ERROR',
                    message: `Extracted ID (${extracted.idNumber}) does not match profile (${profileId})`
                });
            } else {
                result.flags.push({
                    flag: 'NO_PROFILE_ID',
                    severity: 'WARNING',
                    message: 'No ID number found in profile to compare against'
                });
            }
        }

        // 2. Validate Name
        if (extracted.name || candidate.name) {
            totalWeight += 30;
            const extractedName = extracted.name || "";
            const profileName = candidate.name || "";

            const similarity = this.calculateSimilarity(extractedName, profileName);
            if (similarity > 0.8) {
                matchedWeight += totalWeight * 0.3 * similarity;
            } else if (extractedName) {
                result.mismatchedFields.push('name');
                result.flags.push({
                    flag: 'NAME_MISMATCH',
                    severity: 'WARNING',
                    message: `Name similarity is low (${Math.round(similarity * 100)}%). OCR: ${extractedName}, Profile: ${profileName}`
                });
            }
        }

        // 3. Validate DOB
        if (extracted.dob && candidate.dob) {
            totalWeight += 20;
            const eDob = new Date(extracted.dob).toDateString();
            const pDob = new Date(candidate.dob).toDateString();

            if (eDob === pDob) {
                matchedWeight += 20;
            } else {
                result.mismatchedFields.push('dob');
                result.flags.push({
                    flag: 'DOB_MISMATCH',
                    severity: 'ERROR',
                    message: `DOB Mismatch. OCR: ${eDob}, Profile: ${pDob}`
                });
            }
        }

        // Calculate final score
        result.score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

        // Determine final status
        if (result.flags.some(f => f.severity === 'ERROR')) {
            result.status = 'MISMATCH';
        } else if (result.flags.some(f => f.severity === 'WARNING') || result.score < 80) {
            result.status = 'REVIEW_REQUIRED';
        } else {
            result.status = 'MATCHED';
        }

        return result;
    }

    /**
     * Find matching ID in profile based on document type
     */
    static findProfileId(candidate, type) {
        if (type === 'AADHAAR') return candidate.aadhaarNumber || candidate.metadata?.aadhaarNumber;
        if (type === 'PAN') return candidate.panNumber || candidate.metadata?.panNumber;
        return null;
    }

    /**
     * Sanitize string for comparison
     */
    static sanitize(str) {
        if (!str) return "";
        return String(str).replace(/[^A-Z0-9]/gi, "").toUpperCase();
    }

    /**
     * Simple string similarity (Levenshtein distance would be better)
     */
    static calculateSimilarity(s1, s2) {
        const str1 = this.sanitize(s1);
        const str2 = this.sanitize(s2);

        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;

        // Basic character overlap for now
        let matches = 0;
        const set1 = new Set(str1.split(""));
        for (const char of str2.split("")) {
            if (set1.has(char)) matches++;
        }

        return (matches * 2) / (str1.length + str2.length);
    }
}

module.exports = BGVOCRValidator;
