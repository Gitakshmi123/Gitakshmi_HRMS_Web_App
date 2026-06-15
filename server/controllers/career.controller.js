const getTenantDB = require('../utils/tenantDB');
const PublishedCareerPage = require('../models/PublishedCareerPage');
const mongoose = require('mongoose');
const CareerSection = require('../models/CareerSection');
const CareerSEO = require('../models/CareerSEO');
const CareerLayout = require('../models/CareerLayout');

// Helper function to escape HTML special characters
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Helper to strip large objects (base64, etc.) to keep DB small
function stripLargeObjects(obj) {
    if (!obj) return obj;
    const stripped = JSON.parse(JSON.stringify(obj));
    const clean = (item) => {
        if (!item || typeof item !== 'object') return;
        Object.keys(item).forEach(key => {
            if (typeof item[key] === 'string' && (item[key].startsWith('data:image') || item[key].length > 50000)) {
                delete item[key];
            } else if (typeof item[key] === 'object') {
                clean(item[key]);
            }
        });
    };
    clean(stripped);
    return stripped;
}

exports.getCustomization = async (req, res) => {
    try {
        if (!req.tenantId) {
            return res.status(400).json({ error: 'Tenant ID not found in request' });
        }

        const db = await getTenantDB(req.tenantId);
        const CompanyProfile = db.model('CompanyProfile');

        const company = await CompanyProfile.findOne({}).lean();
        if (!company) {
            console.warn('✅ No company found, returning empty configuration');
            return res.json(null);
        }

        // Strategy: Return Draft if exists. If not, return Live. 
        // If neither, return null (frontend handles default).
        // If Draft is missing but Live exists, we should probably initialize Draft = Live so user sees current state.

        let draft = company.meta?.draftCareerPage;
        const live = company.meta?.careerCustomization;

        if (!draft && live) {
            // Self-repair: Initialize draft from live so editor starts with current live state
            draft = { ...live };
            // We don't necessarily need to save this to DB yet, just return it.
        }

        if (draft) {
            // Inject metadata for UI
            draft.lastPublishedAt = live?.publishedAt || null;
            draft.isPublished = false; // It is draft content
        }

        res.json(draft || null);
    } catch (error) {
        console.error('❌ [getCustomization] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.saveCustomization = async (req, res) => {
    try {
        if (!req.tenantId) {
            return res.status(400).json({ error: 'Tenant ID not found in request' });
        }

        const db = await getTenantDB(req.tenantId);
        const CompanyProfile = db.model('CompanyProfile');

        const customization = req.body;

        // Find or create company profile
        let company = await CompanyProfile.findOne({});
        if (!company) {
            company = new CompanyProfile({
                tenantId: req.tenantId,
                companyName: 'My Company',
                meta: {}
            });
        }

        // Save customization to DRAFT field
        if (!company.meta) company.meta = {};
        company.meta.draftCareerPage = {
            ...customization,
            updatedAt: new Date()
        };
        company.markModified('meta');

        await company.save();

        // console.log('✅ Customization saved to DRAFT');
        res.json({ message: 'Draft saved successfully', data: customization });
    } catch (error) {
        console.error('❌ [saveCustomization] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.publishCustomization = async (req, res) => {
    const startTime = Date.now();
    try {
        if (!req.tenantId) {
            return res.status(400).json({ error: 'Tenant ID not found in request' });
        }

        // Parallelize DB connection and initial lookup
        const dbPromise = getTenantDB(req.tenantId);

        // Use direct body if present (Step 1 of atomic publish)
        let contentToPublish = req.body && (req.body.sections || req.body.applyPage) ? req.body : null;

        const db = await dbPromise;
        const CompanyProfile = db.model('CompanyProfile');

        let company = await CompanyProfile.findOne({}).lean();

        if (!company) {
            const CompanyProfile = db.model('CompanyProfile');
            const newCompany = new CompanyProfile({
                tenantId: req.tenantId,
                companyName: 'My Company',
                address: { line1: 'Address', city: 'City', state: 'State', pincode: '0000' },
                signatory: { name: 'Admin', designation: 'Admin' },
                meta: {}
            });
            await newCompany.save();
            company = newCompany.toObject();
        }

        // Determine content to publish & strip large blobs
        if (contentToPublish) {
            contentToPublish = stripLargeObjects(contentToPublish);
        } else if (company.meta?.draftCareerPage) {
            contentToPublish = company.meta.draftCareerPage;
        }

        if (!contentToPublish) {
            return res.status(400).json({ error: 'No content found to publish. Please save changes first.' });
        }

        const timestamp = new Date();

        // Generate SEO Meta Tags from seoSettings
        let metaTags = {};
        if (contentToPublish.seoSettings?.seo_title && contentToPublish.seoSettings?.seo_description) {
            const seo = contentToPublish.seoSettings;
            const baseUrl = `https://careers.${req.tenantId}.com`;
            const seoSlug = seo.seo_slug || 'careers';
            const fullUrl = `${baseUrl}/${seoSlug}`;

            metaTags = {
                title: seo.seo_title || 'Join Our Team',
                description: seo.seo_description || 'Explore exciting career opportunities with us',
                keywords: seo.seo_keywords && Array.isArray(seo.seo_keywords) && seo.seo_keywords.length > 0 ? seo.seo_keywords.join(', ') : '',
                ogTitle: seo.seo_title || 'Join Our Team',
                ogDescription: seo.seo_description || 'Explore exciting career opportunities with us',
                ogImage: seo.seo_og_image || '',
                canonical: fullUrl,
                metaTags: {
                    title: `<title>${escapeHTML(seo.seo_title || 'Join Our Team')}</title>`,
                    description: `<meta name="description" content="${escapeHTML(seo.seo_description || 'Explore exciting career opportunities with us')}">`,
                    keywords: seo.seo_keywords && Array.isArray(seo.seo_keywords) && seo.seo_keywords.length > 0 ? `<meta name="keywords" content="${escapeHTML(seo.seo_keywords.join(', '))}">` : '',
                    ogTitle: `<meta property="og:title" content="${escapeHTML(seo.seo_title || 'Join Our Team')}">`,
                    ogDescription: `<meta property="og:description" content="${escapeHTML(seo.seo_description || 'Explore exciting career opportunities with us')}">`,
                    ogImage: seo.seo_og_image ? `<meta property="og:image" content="${seo.seo_og_image}">` : '',
                    ogType: `<meta property="og:type" content="website">`,
                    ogUrl: `<meta property="og:url" content="${fullUrl}">`,
                    twitterCard: `<meta name="twitter:card" content="summary_large_image">`,
                    canonical: `<link rel="canonical" href="${fullUrl}">`
                }
            };
        }

        // Update LIVE and DRAFT content
        const liveContent = { ...contentToPublish, publishedAt: timestamp, isPublished: true, metaTags };
        const draftContent = { ...contentToPublish, updatedAt: timestamp, metaTags };

        // Save to Legacy (CompanyProfile) - Atomic partial update
        const savingLegacy = CompanyProfile.updateOne(
            { _id: company._id },
            {
                $set: {
                    "meta.careerCustomization": { ...company.meta?.careerCustomization, ...liveContent },
                    "meta.draftCareerPage": { ...company.meta?.draftCareerPage, ...draftContent }
                }
            }
        );

        // SYNC TO OPTIMIZED SYSTEM (PublishedCareerPage)
        const publishedDoc = {
            tenantId: req.tenantId,
            companyId: company._id.toString(),
            publishedAt: new Date(),
            version: Date.now()
        };

        // SEO update
        if (metaTags && Object.keys(metaTags).length > 0) {
            publishedDoc.seo = {
                title: metaTags.title || 'Careers',
                description: metaTags.description || '',
                keywords: metaTags.keywords ? metaTags.keywords.split(',').map(k => k.trim()) : [],
                slug: contentToPublish.seoSettings?.seo_slug || '',
                ogImage: metaTags.ogImage || '',
                metaHtml: metaTags || {}
            };
        }

        // Theme update
        if (contentToPublish.theme) {
            publishedDoc.theme = contentToPublish.theme;
        }

        // Apply Page update
        if (contentToPublish.applyPage) {
            publishedDoc.applyPage = contentToPublish.applyPage;
        }

        // Sections update
        if (contentToPublish.sections && Array.isArray(contentToPublish.sections)) {
            publishedDoc.sections = contentToPublish.sections.map((s, idx) => ({
                id: s.id,
                type: s.type,
                content: s.content || {},
                order: idx
            }));
        }

        // Atomic Upsert that merges current state
        const syncingOptimized = PublishedCareerPage.findOneAndUpdate(
            { tenantId: req.tenantId },
            { $set: publishedDoc },
            { upsert: true, new: true, sort: { publishedAt: -1 } }
        );

        // Execute both operations in parallel
        await Promise.all([savingLegacy, syncingOptimized]);

        // console.log(`✅ [PUBLISH] Finalized for ${req.tenantId}`);

        // console.log('✅ Career page PUBLISHED (Atomic)');

        res.json({
            success: true,
            message: 'Career page published successfully with SEO meta tags',
            livePage: liveContent,
            metaTags: metaTags,
            publishedAt: timestamp
        });

    } catch (error) {
        console.error('❌ [publishCustomization] CRITICAL ERROR:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.stack, // Send full stack trace temporarily for debugging
            debug_info: {
                hasCompany: !!company,
                hasTenantId: !!req.tenantId,
                payloadSections: !!req.body?.sections,
                payloadApplyPage: !!req.body?.applyPage
            }
        });
    }
};

exports.getPublicCustomization = async (req, res) => {
    try {
        const { tenantId } = req.params;
        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID required' });
        }

        // Prevent Caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');

        const db = await getTenantDB(tenantId);
        const CompanyProfile = db.model('CompanyProfile');

        const company = await CompanyProfile.findOne({});
        if (!company) {
            return res.json({
                customization: null,
                seoSettings: null,
                metaTags: null
            });
        }

        // Return LIVE content with SEO metadata
        const customization = company.meta?.careerCustomization || {};
        
        // Flatten for frontend which expects 'sections' at the root
        res.json({
            ...customization,
            customization: customization, // Keeping keys for compatibility
            seoSettings: customization.seoSettings || null,
            metaTags: customization.metaTags || null,
            data: customization // For backward compatibility
            // sections will now be present at root if they exist in customization
        });
    } catch (error) {
        console.error('❌ [getPublicCustomization] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};
