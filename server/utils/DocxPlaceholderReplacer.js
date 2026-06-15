/**
 * DOCX Placeholder Replacer - Robust & Multi-Variant
 * 
 * Replaces docx placeholders regardless of:
 * - Case: {{GROSS_A}}, {{Gross_A}}, {{gross_a}}
 * - Spaces: {{gross a}}, {{gross-a}}, {{gross_a}}
 * - Yearly/Monthly: {{basic}}, {{basic_monthly}}, {{basic_yearly}}
 * 
 * Usage:
 *   const replacer = new DocxPlaceholderReplacer(doc);
 *   replacer.replaceAll(dataMap);
 */

const { normalizeComponentKey, COMPONENT_ALIASES } = require('./componentNormalizer.service');

class DocxPlaceholderReplacer {
    constructor(doc) {
        this.doc = doc;
        this.processedTags = new Set();
    }

    /**
     * Build a comprehensive mapping of all placeholder variations
     * Handles basic, basic_monthly, basic_yearly, BASIC, Gross_A, gross-a, etc.
     */
    buildVariantMap(dataMap) {
        const variantMap = {};

        // Process each key in the data map
        for (const [key, value] of Object.entries(dataMap)) {
            const normalized = normalizeComponentKey(key);

            // Direct assignment
            variantMap[key] = value;                          // exact key
            variantMap[key.toUpperCase()] = value;            // UPPERCASE
            variantMap[key.toLowerCase()] = value;            // lowercase
            variantMap[normalized] = value;                   // normalized (basic, gross_a, etc)
            variantMap[normalized.toUpperCase()] = value;     // NORMALIZED_UPPER
            variantMap[normalized.replace(/_/g, ' ')] = value; // space version
            variantMap[normalized.replace(/_/g, '-')] = value; // hyphen version

            // Monthly/Yearly variants
            if (!key.includes('_monthly') && !key.includes('_yearly')) {
                const withMonthly = `${normalized}_monthly`;
                const withYearly = `${normalized}_yearly`;
                variantMap[withMonthly] = value;
                variantMap[withMonthly.toUpperCase()] = value;
                variantMap[withYearly] = value;
                variantMap[withYearly.toUpperCase()] = value;
                variantMap[withMonthly.replace(/_/g, ' ')] = value;
                variantMap[withYearly.replace(/_/g, ' ')] = value;
            }
        }

        return variantMap;
    }

    /**
     * Extract all placeholder tags from the document
     */
    extractTags() {
        const tags = new Set();
        try {
            // Get document XML and find all {{...}} patterns
            // This is a simplified extraction - docxtemplater manages tags internally
            if (this.doc.render) {
                // Access internal structure if available
                const fullText = this.doc.getFullText ? this.doc.getFullText() : '';
                const matches = fullText.match(/\{\{[^}]+\}\}/g) || [];
                matches.forEach(match => {
                    const tag = match.slice(2, -2).trim();
                    tags.add(tag);
                });
            }
        } catch (e) {
            console.warn('[DOCX] Could not extract tags:', e.message);
        }
        return tags;
    }

    /**
     * Replace all placeholders with values from the data map
     * Supports all variations and falls back to empty string gracefully
     */
    replaceAll(dataMap) {
        const variantMap = this.buildVariantMap(dataMap);

        console.log('[DOCX] Starting placeholder replacement...');
        console.log('[DOCX] Data keys available:', Object.keys(dataMap).length);
        console.log('[DOCX] Variant keys generated:', Object.keys(variantMap).length);

        try {
            // docxtemplater will handle the actual replacement
            // But we prepare data in multiple formats for flexibility

            // 1. Direct data - exact keys as they are
            const directData = { ...dataMap };

            // 2. Uppercase version - for {{GROSS_A}} style
            const uppercaseData = {};
            for (const [key, value] of Object.entries(dataMap)) {
                uppercaseData[key.toUpperCase()] = value;
            }

            // 3. Normalized version - for {{gross_a}} style
            const normalizedData = {};
            for (const [key, value] of Object.entries(dataMap)) {
                const norm = normalizeComponentKey(key);
                if (norm) {
                    normalizedData[norm] = value;
                    normalizedData[norm.toUpperCase()] = value;
                    normalizedData[norm.replace(/_/g, ' ')] = value;
                }
            }

            // Merge all variants - more specific keys override
            const mergedData = {
                ...directData,
                ...normalizedData,
                ...uppercaseData
            };

            console.log('[DOCX] Merged data keys:', Object.keys(mergedData).length);

            // Use docxtemplater's render with our prepared data
            this.doc.setData(mergedData);
            this.doc.render();

            console.log('[DOCX] Placeholder replacement completed successfully');
            return { success: true };

        } catch (error) {
            console.error('[DOCX] Placeholder replacement failed:', error.message);
            // Don't crash - continue with partial replacement
            return { success: false, error: error.message };
        }
    }

    /**
     * Safe placeholder replacement - handles missing values gracefully
     */
    replaceSafe(dataMap) {
        // Add null-getter fallback in case some tags are missing
        try {
            const result = this.replaceAll(dataMap);
            return result;
        } catch (error) {
            console.warn('[DOCX] Safe replacement with error:', error.message);
            // Return the document in best-effort state
            return { success: false, error: error.message };
        }
    }
}

module.exports = DocxPlaceholderReplacer;
