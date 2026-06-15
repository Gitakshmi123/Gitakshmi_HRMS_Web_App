const axios = require('axios');

/**
 * AI Extraction Service
 * Uses Google Gemini to:
 * 1. Read the full resume text
 * 2. Read the job description
 * 3. Return structured candidate data + match analysis in ONE prompt
 */
class AIExtractionService {

    constructor() {
        this.apiDisabledReason = null;
        this.warnedMissingKey = false;
    }

    getApiKey() {
        const key = String(process.env.GEMINI_API_KEY || '').trim();
        if (!key || key.length < 30 || /^(your_|dummy|test|replace_|null|undefined)/i.test(key)) return '';
        return key;
    }

    /**
     * Clean JSON string from markdown code fences
     */
    cleanJSON(str) {
        if (!str) return null;
        // Remove ```json ... ``` or ``` ... ```
        return str
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();
    }

    /**
     * Extract structured data from Resume Text + match against Job Description
     * @param {string} resumeText - Raw text extracted from resume (full text)
     * @param {string} jobTitle - Job title for context
     * @param {string} jobDescription - Full job description / role overview
     * @returns {Promise<Object>} - Structured candidate data with match analysis
     */
    async extractData(resumeText, jobTitle = "", jobDescription = "") {
        if (this.apiDisabledReason) {
            return this._emptyResult("No API Key configured");
        }

        const apiKey = this.getApiKey();
        if (!apiKey) {
            if (!this.warnedMissingKey) {
                console.warn("[AIExtraction] GEMINI_API_KEY missing/invalid — using OCR fallback extraction.");
                this.warnedMissingKey = true;
            }
            return this._emptyResult("No API Key configured");
        }

        if (!resumeText || resumeText.trim().length < 20) {
            console.warn("[AIExtraction] ⚠️ Resume text too short or empty.");
            return this._emptyResult("Resume text empty or too short");
        }

        // Truncate to avoid token limits
        const resumeChunk = resumeText.substring(0, 12000);
        const jdChunk = jobDescription ? jobDescription.substring(0, 3000) : '';

        const prompt = `You are a STRICT and HIGHLY CRITICAL Senior Technical Recruiter. Your task is to analyze a resume against a job description.
CRITICAL RULE: DO NOT be "nice". If a candidate is from a completely different field (e.g., Sales vs Engineering), their match score MUST be below 20%, regardless of soft skills.

=== JOB DETAILS ===
Job Title: ${jobTitle || "Not specified"}
Job Description: ${jdChunk || "Extract skills from resume only"}

=== RESUME TEXT ===
${resumeChunk}

=== INSTRUCTIONS ===
1. EXTRACT Candidate Data:
   - fullName, email, phone, skills (thorough list), totalExperience (numeric string like "3.5 years"), education, workHistory.

2. PERFORM MATCH ANALYSIS:
   - matchedSkills: ONLY include skills that clearly overlap with the JD.
   - missingSkills: Crucial JD requirements missing in the resume.
   - matchPercentage (0-100): Be extremely honest. 
     * Mismatch Penalty: If the candidate's career track (Work History) is unrelated to the Job Title (e.g., a Sales person applying for a Developer role), set matchPercentage to < 15.
     * Keyword Stuffing Check: Do not give points for skills mentioned without context in work history.
     * Seniority Check: If the JD asks for 5+ years and the resume has 1, penalize heavily.

3. REASONING:
   - provide a brief 1-sentence "matchReason" explaining why you gave this score.

Return ONLY a valid JSON object in this format (no markdown):
{
  "fullName": "string",
  "email": "string",
  "phone": "string",
  "skills": ["skill1", "skill2"],
  "totalExperience": "X.X years",
  "education": [{"degree": "...", "institution": "...", "year": "...", "field": "..."}],
  "workHistory": [{"role": "...", "company": "...", "duration": "...", "description": "..."}],
  "summary": "string",
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill3", "skill4"],
  "matchPercentage": number,
  "matchReason": "string"
}
`;

        try {
            console.log(`[AIExtraction] 🤖 Calling Gemini for: "${jobTitle}" | Resume: ${resumeChunk.length} chars | JD: ${jdChunk.length} chars`);

            const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            const payload = {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    topP: 0.8,
                    maxOutputTokens: 2048
                }
            };

            let response;
            try {
                response = await axios.post(url, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 45000
                });
            } catch (err) {
                // If it's a 404 and we were using gemini-1.5-flash, try the -latest suffix
                if (err.response?.status === 404 && model === 'gemini-1.5-flash') {
                    console.log("[AIExtraction] ⚠️ gemini-1.5-flash not found, trying gemini-1.5-flash-latest...");
                    const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
                    response = await axios.post(fallbackUrl, payload, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 45000
                    });
                } else {
                    throw err;
                }
            }

            const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawText) {
                throw new Error("Empty response from Gemini API");
            }

            console.log(`[AIExtraction] ✅ Raw AI response received (${rawText.length} chars)`);

            // Parse JSON
            const cleaned = this.cleanJSON(rawText);
            let parsed;
            try {
                parsed = JSON.parse(cleaned);
            } catch (jsonErr) {
                // Try to extract JSON from within the text
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error(`JSON parse failed: ${jsonErr.message}`);
                }
            }

            // Validate and normalize the result
            const result = {
                fullName: parsed.fullName || parsed.name || "Unknown",
                email: parsed.email || "",
                phone: parsed.phone || parsed.mobile || "",
                skills: Array.isArray(parsed.skills) ? parsed.skills.filter(Boolean) : [],
                totalExperience: parsed.totalExperience || parsed.experience || "0",
                education: Array.isArray(parsed.education) ? parsed.education : [],
                workHistory: Array.isArray(parsed.workHistory) ? parsed.workHistory : [],
                summary: parsed.summary || parsed.experienceSummary || "",
                matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills.filter(Boolean) : [],
                missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.filter(Boolean) : [],
                matchPercentage: typeof parsed.matchPercentage === 'number' ? parsed.matchPercentage : 0,
                _source: 'gemini-1.5-flash',
                _extractedAt: new Date().toISOString()
            };

            console.log(`[AIExtraction] ✅ Extracted: ${result.fullName} | Skills: ${result.skills.length} | Matched: ${result.matchedSkills.length} | Missing: ${result.missingSkills.length} | AI Score: ${result.matchPercentage}%`);

            return result;

        } catch (error) {
            const status = error.response?.status;
            const errMsg = error.response?.data?.error?.message || error.message;
            const isInvalidKey = status === 400 && /api key/i.test(errMsg);
            if (isInvalidKey) {
                this.apiDisabledReason = errMsg;
                console.warn("[AIExtraction] GEMINI_API_KEY rejected by Google — using OCR fallback extraction. Update server/.env with a valid key to enable AI resume matching.");
                return this._emptyResult(`AI disabled: ${errMsg}`);
            }

            console.warn(`[AIExtraction] API unavailable (${status || 'No Status'}): ${errMsg}. Using OCR fallback extraction.`);

            if (status === 403) {
                console.warn(`[AIExtraction] 403 Forbidden: check key restrictions, enabled models, billing, or project access.`);
            }

            // Return honest empty structure — don't fake data
            return this._emptyResult(`AI Error ${status}: ${errMsg}`);
        }

    }

    /**
     * Returns an honest empty result when AI fails
     */
    _emptyResult(reason = "Unknown error") {
        return {
            fullName: "",
            email: "",
            phone: "",
            skills: [],
            totalExperience: "0",
            education: [],
            workHistory: [],
            summary: "",
            matchedSkills: [],
            missingSkills: [],
            matchPercentage: 0,
            _error: reason,
            _source: 'fallback'
        };
    }
}

module.exports = new AIExtractionService();
