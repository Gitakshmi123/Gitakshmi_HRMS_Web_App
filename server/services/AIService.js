const axios = require('axios');

class AIService {
    constructor() {
        // Gemini model endpoints evolve; prefer a configurable model with a safe default.
        // If the configured model is unavailable, we fall back to local templates.
        const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
        this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        this.hrmsQueryParseSystemPrompt = `
You are an intelligent HRMS Assistant integrated with a company HR system.

You must understand and answer ANY HR-related question using structured logic and system data.

----------------------------------------
LANGUAGE UNDERSTANDING
----------------------------------------

- Understand all types of input:
  - English, Hindi, Gujarati, Hinglish
  - Broken sentences
  - Spelling mistakes

Examples:
"jay coming today?"
"jay aaje aavyo che?"
"ketla employees che?"
-> ALL should be understood correctly

----------------------------------------
TASK UNDERSTANDING
----------------------------------------

You must detect:

1. Employee-specific query
   -> attendance, salary, leave, profile

2. System-wide query
   -> total employees
   -> present today
   -> absent today
   -> employees on leave

----------------------------------------
RESPONSE LOGIC
----------------------------------------

STEP 1: Understand intent
STEP 2: Extract employee name (if any)
STEP 3: Decide query type:
   - "employee"
   - "system"

STEP 4: Return JSON ONLY (NO TEXT)

----------------------------------------
OUTPUT FORMAT (STRICT)
----------------------------------------

{
  "type": "employee" | "system",
  "intent": "attendance" | "salary" | "leave" | "profile" | "count",
  "employeeName": "string or null",
  "originalQuery": "user message"
}

----------------------------------------
RULES
----------------------------------------

- NEVER answer directly
- ONLY return JSON
- Fix spelling mistakes automatically
- If no name -> employeeName = null
- If unclear -> guess best possible intent

----------------------------------------
GOAL
----------------------------------------

Act as a smart brain that converts user message into structured data for backend processing.
`.trim();

        this.hrmsResponseSystemPrompt = `
You are an HRMS assistant.

Convert the following data into a natural human-friendly response.

DATA:
{{backend_data}}

RULES:
- Keep it short
- Be clear
- Match user language
`.trim();
    }

    async callModel(prompt, retries = 2) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not configured in .env');
        }

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await axios.post(`${this.baseUrl}?key=${apiKey}`, {
                    contents: [{ parts: [{ text: prompt }] }]
                }, { 
                    timeout: 60000,
                    headers: { 'Content-Type': 'application/json' }
                });

                const text = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) {
                    throw new Error('AI returned an empty or invalid response.');
                }

                return String(text);
            } catch (err) {
                const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
                const status = err.response?.status;
                
                // If it's a timeout and we have retries left, try again. 
                // But JD generation is heavy, so if it times out once, it might time out again.
                const isRetryable = (status === 429 || status === 503 || !status || isTimeout);
                
                if (isRetryable && attempt < retries) {
                    const delay = (attempt + 1) * 2000;
                    await new Promise(res => setTimeout(res, delay));
                    continue;
                }
                
                // Attach a specific flag for timeout so generateJobContent can catch it
                if (isTimeout) {
                    err.isTimeout = true;
                }
                throw err;
            }
        }
    }

    extractJson(raw) {
        if (!raw) throw new Error('No content provided for parsing.');
        
        // Remove markdown fences if present
        let cleaned = String(raw).replace(/```json/gi, '').replace(/```/g, '').trim();
        
        // Find the first '{' and last '}' to isolate the JSON object
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1) {
            throw new Error('AI response did not contain a valid JSON object.');
        }
        
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        
        try {
            return JSON.parse(cleaned);
        } catch (e) {
            console.error('[AIService] JSON Parse Error. Raw:', raw);
            throw new Error('AI returned malformed data. Please try again.');
        }
    }

    detectRoleFamily(jobTitle = '', department = '') {
        const text = `${jobTitle} ${department}`.toLowerCase();
        if (/(qa|test|quality|sdet)/.test(text)) return 'qa';
        if (/(ui|ux|design|product designer)/.test(text)) return 'design';
        if (/(developer|engineer|software|frontend|backend|full stack|node|react)/.test(text)) return 'engineering';
        if (/(data|analytics|bi|analyst)/.test(text)) return 'data';
        if (/(recruit|talent|hiring|acquisition)/.test(text)) return 'recruitment';
        if (/(sales|business development|account executive)/.test(text)) return 'sales';
        if (/(marketing|seo|social|brand|growth)/.test(text)) return 'marketing';
        if (/(hr|human resource|people ops)/.test(text)) return 'hr';
        if (/(support|customer success|service desk)/.test(text)) return 'support';
        return 'general';
    }

    getRoleBlueprint(roleFamily) {
        const map = {
            qa: {
                responsibilities: [
                    'Define and maintain test scenarios for new and existing features',
                    'Execute functional, regression, and integration testing cycles',
                    'Raise, track, and verify defects with clear reproduction steps',
                    'Collaborate with developers during root-cause analysis and fixes',
                    'Build reusable test checklists and improve release quality gates',
                    'Contribute to test automation strategy and tooling'
                ],
                requiredSkills: [
                    'Hands-on QA lifecycle knowledge (test planning to closure)',
                    'Strong bug reporting and defect triage communication',
                    'Understanding of web APIs, workflows, and user journeys',
                    'Analytical thinking and high attention to detail',
                    'Ability to work cross-functionally in sprint-based teams'
                ],
                optionalSkills: ['Automation experience (Cypress/Playwright/Selenium)', 'Performance or security testing exposure']
            },
            design: {
                responsibilities: [
                    'Translate business goals into intuitive user experiences',
                    'Create wireframes, flows, and high-fidelity UI designs',
                    'Collaborate with product and engineering for feasible implementation',
                    'Conduct UX reviews and iterate using feedback and data',
                    'Maintain consistency through design systems and components'
                ],
                requiredSkills: [
                    'Strong UX fundamentals and interaction design thinking',
                    'Hands-on Figma proficiency and component system usage',
                    'Ability to present rationale behind design decisions',
                    'Understanding of responsive and accessible interfaces'
                ],
                optionalSkills: ['User research and usability testing experience', 'Micro-interaction or motion design exposure']
            },
            engineering: {
                responsibilities: [
                    'Design and deliver scalable features aligned with product roadmap',
                    'Write clean, testable, and maintainable production code',
                    'Review code quality and support engineering best practices',
                    'Troubleshoot production issues and improve system reliability',
                    'Collaborate with QA, product, and design in sprint execution'
                ],
                requiredSkills: [
                    'Strong programming fundamentals and data structure knowledge',
                    'Experience with modern frameworks and API-driven architecture',
                    'Debugging, problem-solving, and performance optimization skills',
                    'Version control and peer code review practices'
                ],
                optionalSkills: ['Cloud or DevOps exposure', 'Automated testing and CI/CD knowledge']
            },
            recruitment: {
                responsibilities: [
                    'Own end-to-end hiring pipeline for assigned business roles',
                    'Source quality candidates through multiple channels',
                    'Coordinate interviews and ensure timely stakeholder feedback',
                    'Maintain candidate experience and communication standards',
                    'Track funnel metrics and improve conversion at each stage'
                ],
                requiredSkills: [
                    'Hands-on recruitment lifecycle and stakeholder management',
                    'Strong sourcing, screening, and interview coordination ability',
                    'Data-driven hiring decisions with ATS discipline',
                    'Excellent communication and negotiation skills'
                ],
                optionalSkills: ['Employer branding initiatives', 'Niche hiring exposure']
            },
            general: {
                responsibilities: [
                    `Drive critical initiatives within the ${roleFamily === 'general' ? 'assigned' : roleFamily} function`,
                    'Collaborate with cross-functional teams to deliver outcomes on time',
                    'Analyse requirements and convert them into practical execution plans',
                    'Maintain high quality, process compliance, and reporting discipline',
                    'Contribute to continuous improvement across team workflows'
                ],
                requiredSkills: [
                    'Strong communication and stakeholder collaboration ability',
                    'Problem-solving, ownership mindset, and execution discipline',
                    'Attention to detail with quality-first thinking',
                    'Ability to prioritise and manage tasks independently'
                ],
                optionalSkills: ['Process improvement mindset', 'Domain-specific tool familiarity']
            }
        };
        return map[roleFamily] || map.general;
    }

    getFallbackJobContent(jobTitle, department, context = {}) {
        const roleFamily = this.detectRoleFamily(jobTitle, department);
        const blueprint = this.getRoleBlueprint(roleFamily);
        const seniority = String(context?.seniority || '').trim();
        const objective = String(context?.roleObjective || '').trim();
        const tone = String(context?.tone || 'Professional').trim();
        const exp = String(context?.experienceRange || '').trim();
        const workMode = String(context?.workMode || '').trim();
        const jobType = String(context?.jobType || '').trim();
        const education = String(context?.education || '').trim();

        const mustHave = Array.isArray(context?.mustHaveSkills) ? context.mustHaveSkills.filter(Boolean) : [];
        const niceToHave = Array.isArray(context?.niceToHaveSkills) ? context.niceToHaveSkills.filter(Boolean) : [];
        const respHints = Array.isArray(context?.responsibilitiesHint) ? context.responsibilitiesHint.filter(Boolean) : [];

        const responsibilities = [...respHints, ...blueprint.responsibilities]
            .map((x) => String(x).trim())
            .filter(Boolean)
            .filter((item, idx, arr) => arr.findIndex((s) => s.toLowerCase() === item.toLowerCase()) === idx)
            .slice(0, 10);

        const requiredSkills = [...mustHave, ...blueprint.requiredSkills]
            .map((x) => String(x).trim())
            .filter(Boolean)
            .filter((item, idx, arr) => arr.findIndex((s) => s.toLowerCase() === item.toLowerCase()) === idx)
            .slice(0, 10);

        const optionalSkills = [...niceToHave, ...blueprint.optionalSkills]
            .map((x) => String(x).trim())
            .filter(Boolean)
            .filter((item, idx, arr) => arr.findIndex((s) => s.toLowerCase() === item.toLowerCase()) === idx)
            .slice(0, 6);

        const summaryLine = objective || `This role drives measurable impact across the ${department} function through strong execution and collaboration.`;
        const candidateProfile = [
            exp ? `Experience: ${exp}` : null,
            seniority ? `Seniority: ${seniority}` : null,
            workMode ? `Work mode: ${workMode}` : null,
            jobType ? `Employment type: ${jobType}` : null,
            education ? `Education: ${education}` : null,
        ].filter(Boolean).join(' | ');

        const description = [
            `Role Summary: We are hiring a ${seniority ? `${seniority} ` : ''}${jobTitle} to join our ${department} team.`,
            `Key Outcomes: ${summaryLine}`,
            `Candidate Profile: ${candidateProfile || 'Strong ownership, communication, and role-relevant domain capability.'}`,
            `Why Join Us: You will work in a ${tone.toLowerCase()} culture with clear ownership, meaningful impact, and cross-functional visibility.`
        ].join('\n\n');

        return { description, responsibilities, requiredSkills, optionalSkills };
    }

    async generateJobContent(jobTitle, department, context = {}) {
        const cleanContext = {
            seniority: String(context?.seniority || '').trim(),
            roleObjective: String(context?.roleObjective || '').trim(),
            responsibilitiesHint: Array.isArray(context?.responsibilitiesHint)
                ? context.responsibilitiesHint.filter(Boolean).map((x) => String(x).trim())
                : [],
            mustHaveSkills: Array.isArray(context?.mustHaveSkills)
                ? context.mustHaveSkills.filter(Boolean).map((x) => String(x).trim())
                : [],
            niceToHaveSkills: Array.isArray(context?.niceToHaveSkills)
                ? context.niceToHaveSkills.filter(Boolean).map((x) => String(x).trim())
                : [],
            domain: String(context?.domain || '').trim(),
            tone: String(context?.tone || 'Professional').trim(),
            workMode: String(context?.workMode || '').trim(),
            jobType: String(context?.jobType || '').trim(),
            experienceRange: String(context?.experienceRange || '').trim(),
            education: String(context?.education || '').trim()
        };

        const prompt = `
            You are an expert HR Recruitment Consultant.
            Generate a professional job description for the role of "${jobTitle}" in the "${department}" department.

            Additional hiring context (if provided by recruiter):
            ${JSON.stringify(cleanContext, null, 2)}

            Return ONLY a valid JSON object with the following structure:
            {
                "description": "A structured JD in clear sections. Use headings in this order: Role Summary, Key Outcomes, Candidate Profile, Why Join Us. Keep concise and recruiter-ready.",
                "responsibilities": ["Array of 6-10 responsibilities in priority order (most important first)"],
                "requiredSkills": ["Array of 6-10 mandatory technical and behavioural skills, aligned with context"],
                "optionalSkills": ["Array of 3-6 preferred skills/certifications"]
            }

            Keep the content modern, engaging, and professional. Use British English.
            If context includes must-have skills or responsibilities hints, prioritise them first.
            Avoid generic filler lines and vague text.
            Ensure the JSON is perfectly formatted and contains no markdown backticks or extra text.
        `;

        try {
            const text = await this.callModel(prompt);
            return this.extractJson(text);
        } catch (error) {
            const status = error.response?.status;
            const errorMsg = error.response?.data?.error?.message || error.message;
            console.error('[AIService] Error generating job content:', errorMsg);

            // If timeout, quota exceeded, or temporary issue, return a useful fallback instead of crashing
            if (error.isTimeout || status === 429 || status === 503 || status === 400 || status === 401 || status === 403 || status === 404) {
                console.warn(`[AIService] Returning fallback due to: ${error.isTimeout ? 'Timeout' : 'Service Status ' + status}`);
                return this.getFallbackJobContent(jobTitle, department, cleanContext);
            }

            throw new Error(`AI Service Error: ${errorMsg}`);
        }
    }

    async analyzeTicketMoodAndPriority(title, description) {
        const prompt = `
            You are a strict HR ticket classifier.

            Analyze the employee message and return structured JSON.
            Do NOT add any extra text.

            Rules:
            - Financial/salary issues -> High or Urgent
            - Technical/system issues -> Medium
            - Informational/general -> Low

            Return format:
            {
              "priority": "Low|Medium|High|Urgent",
              "category": "Salary|IT|Leave|HR|Other",
              "reasoning": "1-sentence why"
            }

            Message:
            Title: "${title}"
            Description: "${description}"
        `;

        try {
            const text = await this.callModel(prompt);
            return this.extractJson(text);
        } catch (error) {
            console.error('[AIService] Analysis Error:', error.message);
            return { priority: 'Medium', category: 'General', reasoning: 'Defaulting due to AI unavailability.' };
        }
    }

    async parseHRMSQuery(query) {
        const userQuery = String(query || '').trim();
        if (!userQuery) return null;
        if (!process.env.GEMINI_API_KEY) return null;

        const prompt = `${this.hrmsQueryParseSystemPrompt}\n\nUser Query: "${userQuery}"`;

        try {
            const text = await this.callModel(prompt);
            const parsed = this.extractJson(text);

            const type = String(parsed?.type || '').trim().toLowerCase();
            const intent = String(parsed?.intent || '').trim().toLowerCase();
            const employeeName = parsed?.employeeName == null ? null : String(parsed.employeeName).trim();

            const validType = type === 'system' ? 'system' : 'employee';
            const validIntent = ['attendance', 'salary', 'leave', 'profile', 'count'].includes(intent) ? intent : 'attendance';

            return {
                type: validType,
                intent: validIntent,
                employeeName: employeeName || null,
                originalQuery: userQuery
            };
        } catch (error) {
            console.warn('[AIService] parseHRMSQuery fallback to local parser:', error.message);
            return null;
        }
    }

    // Backward-compatible adapter used by existing controller logic
    async parseHRMSIntent(query) {
        const parsed = await this.parseHRMSQuery(query);
        if (!parsed) return null;

        const intentMap = {
            attendance: 'attendance',
            salary: 'salary',
            leave: 'leave_balance',
            profile: 'profile',
            count: 'count'
        };

        return {
            type: parsed.type,
            intent: intentMap[parsed.intent] || 'unknown',
            employeeName: parsed.employeeName,
            originalQuery: parsed.originalQuery
        };
    }

    async formatHRMSResponse({ backendData, userQuery = '' }) {
        if (!process.env.GEMINI_API_KEY) return null;

        const apiKey = process.env.GEMINI_API_KEY;
        const prompt = this.hrmsResponseSystemPrompt
            .replace('{{backend_data}}', JSON.stringify(backendData ?? {}, null, 2))
            + `\n\nUser Query: "${String(userQuery || '').trim()}"`;

        try {
            const text = await this.callModel(prompt);
            return String(text).replace(/```/g, '').trim();
        } catch (error) {
            console.warn('[AIService] formatHRMSResponse fallback:', error.message);
            return null;
        }
    }
}

module.exports = new AIService();
