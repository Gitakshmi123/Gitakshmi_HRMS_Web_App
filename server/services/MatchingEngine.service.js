const stringSimilarity = require('string-similarity');
const axios = require('axios');

class MatchingEngineService {

    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
    }

    /**
     * Calculate comprehensive match score
     * @param {Object} requirement - Job document (from DB)
     * @param {Object} candidateData - AI Extracted candidate data (from AIExtraction.service.js)
     * @returns {Promise<Object>} - { totalScore, breakdown, matchedSkills, missingSkills }
     */
    async calculateMatchScore(requirement, candidateData) {
        if (!requirement || !candidateData) {
            return {
                totalScore: 0,
                breakdown: { skills: 0, experience: 0, education: 0, similarity: 0, preferred: 0 },
                matchedSkills: [],
                missingSkills: []
            };
        }

        // ── 1. SKILLS MATCH (40%) ──
        // Use job's requiredSkills if defined, otherwise use AI's own matchedSkills/missingSkills
        const reqSkillObjects = requirement.requiredSkills || [];
        const reqSkills = this.normalizeSkills(
            reqSkillObjects.map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean)
        );
        const candSkills = this.normalizeSkills(candidateData.skills || []);

        let skillsScore = 0;
        let matchedSkills = [];
        let missingSkills = [];

        if (reqSkills.length > 0) {
            // Job has defined required skills — use fuzzy matching
            reqSkills.forEach(reqSkill => {
                const match = candSkills.find(candSkill =>
                    stringSimilarity.compareTwoStrings(reqSkill, candSkill) > 0.75 || // Increased threshold
                    candSkill.includes(reqSkill) ||
                    reqSkill.includes(candSkill)
                );
                if (match) {
                    matchedSkills.push(reqSkill);
                } else {
                    missingSkills.push(reqSkill);
                }
            });
            skillsScore = (matchedSkills.length / reqSkills.length) * 40;

        } else if (candidateData.matchedSkills?.length > 0 || candidateData.missingSkills?.length > 0) {
            // No job skills defined — use AI's own analysis from the extraction prompt
            matchedSkills = candidateData.matchedSkills || [];
            missingSkills = candidateData.missingSkills || [];
            const total = matchedSkills.length + missingSkills.length;
            if (total > 0) {
                skillsScore = (matchedSkills.length / total) * 40;
            }

        } else if (candSkills.length > 0) {
            // No job skills AND no AI match data — candidate has skills but we can't compare
            // Give partial credit for having skills
            skillsScore = Math.min(15, candSkills.length * 1.5); // Reduced credit
            matchedSkills = candidateData.skills?.slice(0, 5) || [];
            missingSkills = [];
        }
        // else: no skills anywhere → 0 (honest)

        // ── 2. EXPERIENCE MATCH (20%) ──
        const reqExp = requirement.jobDetails?.experienceMin || requirement.minExperience || 0;
        const candExp = this.parseExperience(candidateData.totalExperience || candidateData.experience);
        let expScore = 0;

        if (reqExp > 0) {
            if (candExp >= reqExp) {
                expScore = 20;
            } else if (candExp > 0) {
                expScore = Math.round((candExp / reqExp) * 15); // Penalty for not meeting minimum
            }
        } else if (candExp > 0) {
            // No exp requirement but candidate has experience — give partial credit
            expScore = Math.min(10, candExp * 1); // Reduced credit
        }

        // ── 3. EDUCATION MATCH (10%) ──
        const reqEdu = (requirement.jobDescription?.education || requirement.education || '').toLowerCase().trim();
        let eduScore = 0;

        if (reqEdu) {
            const candEduStr = JSON.stringify(candidateData.education || []).toLowerCase();
            if (candEduStr.includes(reqEdu)) {
                eduScore = 10;
            } else if (
                candEduStr.includes('bachelor') || candEduStr.includes('master') ||
                candEduStr.includes('degree') || candEduStr.includes('b.tech') ||
                candEduStr.includes('b.e') || candEduStr.includes('mca') ||
                candEduStr.includes('bca') || candEduStr.includes('msc') ||
                candEduStr.includes('bsc')
            ) {
                eduScore = 5; // Reduced from 7
            }
        }

        // ── 4. SEMANTIC / AI MATCH (20%) ──
        // Use AI's own matchPercentage if available, otherwise calculate embedding similarity
        let semanticScore = 0;
        const aiMatchPct = candidateData.matchPercentage;

        if (typeof aiMatchPct === 'number' && aiMatchPct >= 0) {
            // AI already gave us a match percentage — use it for semantic score
            semanticScore = Math.round((aiMatchPct / 100) * 20);
            
            // STRICT DOMAIN PROTECTION: If AI says match is < 20%, apply a global penalty
            if (aiMatchPct < 20) {
                console.log(`[MatchingEngine] 🛑 Critical domain mismatch detected by AI (${aiMatchPct}%). Applying penalty.`);
                skillsScore *= 0.5;
                expScore *= 0.5;
            }
        } else {
            // Fall back to embedding similarity
            const jobText = requirement.jobDescription?.roleOverview || requirement.description || requirement.jobTitle || '';
            if (jobText && Object.keys(candidateData).length > 0) {
                try {
                    const similarity = await this.calculateSemanticSimilarity(jobText, JSON.stringify(candidateData));
                    semanticScore = Math.round(similarity * 20);
                    if (similarity < 0.4) { // Low semantic overlap
                        skillsScore *= 0.6;
                    }
                } catch (e) {
                    semanticScore = 0;
                }
            }
        }

        // ── 5. PREFERRED SKILLS BONUS (10%) ──
        let bonusScore = 0;
        const prefSkillObjects = requirement.preferredSkills || [];
        const prefSkills = this.normalizeSkills(
            prefSkillObjects.map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean)
        );

        if (prefSkills.length > 0) {
            const prefMatches = prefSkills.filter(ps =>
                candSkills.some(cs =>
                    stringSimilarity.compareTwoStrings(ps, cs) > 0.65 ||
                    cs.includes(ps) || ps.includes(cs)
                )
            );
            bonusScore = Math.round((prefMatches.length / prefSkills.length) * 10);
        } else {
            // Bonus for exceeding experience requirement
            if (reqExp > 0 && candExp > reqExp + 2) bonusScore += 5;
            // Bonus for matching all required skills
            if (reqSkills.length > 0 && matchedSkills.length === reqSkills.length) bonusScore += 5;
            bonusScore = Math.min(10, bonusScore);
        }

        const totalScore = Math.min(100, Math.round(skillsScore + expScore + eduScore + semanticScore + bonusScore));

        console.log(`[MatchingEngine] ✅ SCORE: ${totalScore}% | Skills: ${Math.round(skillsScore)}/40 | Exp: ${expScore}/20 | Edu: ${eduScore}/10 | Semantic: ${semanticScore}/20 | Bonus: ${bonusScore}/10`);
        console.log(`[MatchingEngine] ReqSkills: [${reqSkills.join(', ')}] | CandSkills: [${candSkills.slice(0, 8).join(', ')}...]`);
        console.log(`[MatchingEngine] Matched: [${matchedSkills.join(', ')}] | Missing: [${missingSkills.join(', ')}]`);
        console.log(`[MatchingEngine] ReqExp: ${reqExp}yrs | CandExp: ${candExp}yrs | ReqEdu: "${reqEdu}"`);

        return {
            totalScore,
            breakdown: {
                skills: Math.round(skillsScore),
                experience: expScore,
                education: eduScore,
                similarity: semanticScore,
                preferred: bonusScore
            },
            matchedSkills,
            missingSkills
        };
    }

    normalizeSkills(skills) {
        if (!Array.isArray(skills)) return [];
        return skills.map(s => String(s).toLowerCase().trim()).filter(Boolean);
    }

    parseExperience(expInput) {
        if (!expInput) return 0;
        if (typeof expInput === 'number') return expInput;
        const str = String(expInput).toLowerCase();
        // Handle "X years Y months" format
        const yearMatch = str.match(/(\d+(\.\d+)?)\s*year/);
        const monthMatch = str.match(/(\d+)\s*month/);
        let years = yearMatch ? parseFloat(yearMatch[1]) : 0;
        let months = monthMatch ? parseInt(monthMatch[1]) : 0;
        if (years === 0 && months === 0) {
            // Try plain number
            const numMatch = str.match(/(\d+(\.\d+)?)/);
            years = numMatch ? parseFloat(numMatch[1]) : 0;
        }
        return years + (months / 12);
    }

    async calculateSemanticSimilarity(text1, text2) {
        if (!this.apiKey) {
            console.warn('[MatchingEngine] No GEMINI_API_KEY — semantic score = 0');
            return 0;
        }

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${this.apiKey}`;
            const emb1 = await this.getEmbedding(text1, url);
            const emb2 = await this.getEmbedding(text2, url);
            if (!emb1 || !emb2) return 0;
            return this.cosineSimilarity(emb1, emb2);
        } catch (error) {
            console.error('[MatchingEngine] Embedding Error:', error.message);
            return 0;
        }
    }

    async getEmbedding(text, url) {
        try {
            const response = await axios.post(url, {
                model: 'models/embedding-001',
                content: { parts: [{ text: text.substring(0, 1500) }] }
            });
            return response.data?.embedding?.values;
        } catch (e) {
            return null;
        }
    }

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0, normA = 0, normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom === 0 ? 0 : dotProduct / denom;
    }
}

module.exports = new MatchingEngineService();
