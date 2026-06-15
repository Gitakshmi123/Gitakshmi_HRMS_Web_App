/**
 * 📝 BGV Document Parser
 * Parses raw OCR text into structured data based on document type
 */
class BGVDocumentParser {

    /**
     * Parse structured data from text
     * @param {String} text - Raw OCR text
     * @param {String} type - Document type (AADHAAR, PAN, PAYSLIP, etc.)
     * @returns {Object} - Structured fields
     */
    static parse(text, type) {
        if (!text) return {};

        switch (type) {
            case 'AADHAAR':
                return this.parseAadhaar(text);
            case 'PAN':
                return this.parsePan(text);
            case 'PAYSLIP':
                return this.parsePayslip(text);
            case 'DEGREE_CERTIFICATE':
            case 'MARKSHEET':
                return this.parseEducation(text);
            case 'EXPERIENCE_LETTER':
                return this.parseExperience(text);
            default:
                return this.parseGeneric(text);
        }
    }

    static parseAadhaar(text) {
        const fields = {};

        // Aadhaar number: 12 digits (often grouped in 4s)
        const match = text.match(/(\d{4}\s\d{4}\s\d{4})|(\d{12})/);
        if (match) fields.idNumber = match[0].replace(/\s/g, '');

        // DOB
        const dobMatch = text.match(/DOB[:\s]+(\d{2}[/-]\d{2}[/-]\d{4})/i);
        if (dobMatch) {
            fields.dob = this.toDate(dobMatch[1]);
        }

        // Gender
        const genderMatch = text.match(/Male|Female/i);
        if (genderMatch) fields.gender = genderMatch[0].toUpperCase();

        return fields;
    }

    static parsePan(text) {
        const fields = {};

        // PAN: 5 letters, 4 digits, 1 letter
        const match = text.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
        if (match) fields.idNumber = match[0];

        // DOB
        const dobMatch = text.match(/(\d{2}[/-]\d{2}[/-]\d{4})/);
        if (dobMatch) fields.dob = this.toDate(dobMatch[0]);

        return fields;
    }

    static parsePayslip(text) {
        const fields = {};

        // Month/Year
        const monthYearMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
        if (monthYearMatch) {
            fields.month = monthYearMatch[1];
            fields.year = monthYearMatch[2];
        }

        // Net Pay / Gross Pay
        const salaryMatch = text.match(/(Net|Gross)\s+(Pay|Salary)[:\s]+([\d,.]+)/i);
        if (salaryMatch) {
            fields.salary = parseFloat(salaryMatch[3].replace(/,/g, ''));
        }

        // Employer
        // Usually employer name is at the top, hard to guess without sophisticated layout analysis
        // But we can look for "Limited", "Corp", "Inc", "Pvt"
        const employerMatch = text.match(/[A-Z\s]+(Pvt|Ltd|Limited|Corp|Services|Solutions|Inc)/i);
        if (employerMatch) fields.employer = employerMatch[0].trim();

        return fields;
    }

    static parseEducation(text) {
        const fields = {};

        // University
        const uniMatch = text.match(/[A-Z\s]+(University|Institute|College|Academy)/i);
        if (uniMatch) fields.university = uniMatch[0].trim();

        // Degree
        const degreeMatch = text.match(/(Bachelor|Master|Doctor|B\.A|B\.Sc|B\.Tech|M\.Tech|MBA|Ph\.D)[A-Z\s.\(\)]+/i);
        if (degreeMatch) fields.degree = degreeMatch[0].trim();

        // Year of passing
        const yearMatch = text.match(/Passing\s+Year[:\s]+(\d{4})/i) || text.match(/(\d{4})/);
        if (yearMatch) fields.year = yearMatch[1];

        return fields;
    }

    static parseExperience(text) {
        const fields = {};

        // Date of joining/leaving
        const dates = text.match(/(\d{2}[/-]\d{2}[/-]\d{4})/g);
        if (dates && dates.length >= 1) fields.issueDate = this.toDate(dates[0]);

        return fields;
    }

    static parseGeneric(text) {
        return {
            fullText: text.substring(0, 500)
        };
    }

    /**
     * Helper: Convert string date to Date object
     */
    static toDate(dateStr) {
        if (!dateStr) return null;
        try {
            // Basic support for DD/MM/YYYY or DD-MM-YYYY
            const parts = dateStr.split(/[/-]/);
            if (parts.length === 3) {
                // Assuming DD/MM/YYYY
                return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
            return new Date(dateStr);
        } catch (e) {
            return null;
        }
    }
}

module.exports = BGVDocumentParser;
