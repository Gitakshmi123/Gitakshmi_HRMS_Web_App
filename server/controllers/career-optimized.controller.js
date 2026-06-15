const getTenantDB = require('../utils/tenantDB');
const CareerSection = require('../models/CareerSection');
const CareerSEO = require('../models/CareerSEO');
const CareerLayout = require('../models/CareerLayout');
const PublishedCareerPage = require('../models/PublishedCareerPage');
const Tenant = require('../models/Tenant');
const mongoose = require('mongoose');

// Helper: Ensure CompanyProfile exists for the tenant
const getCompanyProfile = async (tenantId) => {
    const db = await getTenantDB(tenantId);

    // Resolve tenantId to ObjectId if it's a code
    let resolvedTenantId = tenantId;
    if (db.tenantId) {
        resolvedTenantId = db.tenantId;
    } else if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        const t = await Tenant.findOne({ code: tenantId }).lean();
        if (t) resolvedTenantId = t._id;
    }

    const CompanyProfile = db.model('CompanyProfile');
    let company = await CompanyProfile.findOne({});

    if (!company) {
        // console.log(`[Career] Auto-creating missing CompanyProfile for tenant: ${tenantId}`);
        const t = await Tenant.findById(resolvedTenantId).lean();
        if (!t) throw new Error('Tenant record not found in central database');

        company = new CompanyProfile({
            tenantId: t._id,
            companyName: t.companyName || t.name,
            address: {
                line1: 'Company HQ',
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '400001'
            },
            signatory: {
                name: 'HR Manager',
                designation: 'HR Head'
            }
        });
        await company.save();
    }
    return company;
};

// Helper: Escape HTML special characters for security
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Helper: Validate payload size
function validatePayloadSize(obj, maxSizeMB = 10) {
    const str = JSON.stringify(obj);
    const sizeInMB = Buffer.byteLength(str) / (1024 * 1024);
    return sizeInMB <= maxSizeMB;
}

// Helper: Strip large objects from request
function stripLargeObjects(obj) {
    // Deep clone to avoid mutating original
    const stripped = JSON.parse(JSON.stringify(obj));

    // Recursive function to remove large data
    const clean = (item) => {
        if (!item) return;
        if (typeof item === 'object') {
            // Remove specific large keys
            delete item.preview;
            delete item.fullScreenshot;
            delete item.preview_screenshot;
            delete item.entireHTMLSnapshot;

            Object.keys(item).forEach(key => {
                // Check for base64 strings
                if (typeof item[key] === 'string' && item[key].startsWith('data:image')) {
                    delete item[key]; // Remove base64 image
                } else if (typeof item[key] === 'object') {
                    clean(item[key]); // Recurse
                }
            });
        }
    };

    clean(stripped);
    return stripped;
}

// ============= SAVE SEO SETTINGS (Step 1) =============
exports.saveSEOSettings = async (req, res) => {
    try {
        if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });

        const { seoTitle, seoDescription, seoKeywords, seoSlug, seoOgImageUrl } = req.body;

        // Validation
        if (!seoTitle || !seoDescription || !seoSlug) {
            return res.status(400).json({ error: 'Title, description, and slug are required' });
        }
        if (seoTitle.length > 70) return res.status(400).json({ error: 'Title too long (max 70)' });
        if (seoDescription.length > 160) return res.status(400).json({ error: 'Description too long (max 160)' });
        // Allow ONLY lowercase letters, numbers, and hyphens in slug
        if (!/^[a-z0-9-]*$/.test(seoSlug)) return res.status(400).json({ error: 'Invalid slug format' });

        // Get Company ID (Ensures profile exists)
        const company = await getCompanyProfile(req.tenantId);
        const companyId = company._id.toString();

        // Save to CareerSEO collection
        const seoData = await CareerSEO.findOneAndUpdate(
            { tenantId: req.tenantId, companyId },
            {
                tenantId: req.tenantId,
                companyId,
                seoTitle,
                seoDescription,
                seoKeywords: seoKeywords || [],
                seoSlug,
                seoOgImageUrl, // URL only
                isDraft: true
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: 'SEO saved', data: seoData });
    } catch (error) {
        console.error('❌ [saveSEOSettings] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ============= SAVE SECTIONS (Step 2) =============
exports.saveSections = async (req, res) => {
    try {
        if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });

        // optimize payload
        const cleanBody = stripLargeObjects(req.body);
        const { sections, theme } = cleanBody;

        if (!validatePayloadSize(cleanBody, 10)) {
            return res.status(413).json({ error: 'Payload too large (>10MB)' });
        }

        // Get Company ID (Ensures profile exists)
        const company = await getCompanyProfile(req.tenantId);
        const companyId = company._id.toString();

        // Save Layout first
        await CareerLayout.findOneAndUpdate(
            { tenantId: req.tenantId, companyId },
            {
                tenantId: req.tenantId,
                companyId,
                layoutConfig: {
                    theme: theme || { primaryColor: '#4F46E5' },
                    sectionOrder: sections.map((s, idx) => ({
                        sectionId: s.id,
                        sectionType: s.type,
                        order: idx
                    }))
                },
                isDraft: true
            },
            { upsert: true, new: true }
        );

        // Save Sections individually
        const savedSections = [];
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];

            // Check individual section size
            if (!validatePayloadSize(section.content, 2)) {
                return res.status(413).json({ error: `Section ${section.id} content > 2MB` });
            }

            const saved = await CareerSection.findOneAndUpdate(
                { tenantId: req.tenantId, companyId, sectionId: section.id },
                {
                    tenantId: req.tenantId,
                    companyId,
                    sectionId: section.id,
                    sectionType: section.type,
                    sectionOrder: i, // Use array index for absolute order
                    content: section.content,
                    theme: section.theme || {},
                    isDraft: true
                },
                { upsert: true, new: true }
            );
            savedSections.push(saved);
        }

        // Cleanup sections that were removed
        const currentIds = sections.map(s => s.id);
        await CareerSection.deleteMany({
            tenantId: req.tenantId,
            companyId,
            sectionId: { $nin: currentIds }
        });

        res.json({ success: true, message: `Saved ${savedSections.length} sections` });
    } catch (error) {
        console.error('❌ [saveSections] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ============= PUBLISH LIVE (Step 3 - Final) =============
exports.publishLive = async (req, res) => {
    try {
        // console.log(`[Publish] Starting for tenant: ${req.tenantId}`);
        if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });

        // Get Company ID (Ensures profile exists)
        const company = await getCompanyProfile(req.tenantId);
        const companyId = company._id.toString();

        // 1. Fetch Draft Data
        // console.log(`[Publish] Fetching drafts for company: ${companyId}`);
        const [seo, sections, layout] = await Promise.all([
            CareerSEO.findOne({ tenantId: req.tenantId, companyId }).lean(),
            CareerSection.find({ tenantId: req.tenantId, companyId }).sort({ sectionOrder: 1 }).lean(),
            CareerLayout.findOne({ tenantId: req.tenantId, companyId }).lean()
        ]);

        // console.log(`[Publish] Drafts fetched. SEO: ${!!seo}, Sections: ${sections?.length}, Layout: ${!!layout}`);

        // 3. Prepare Published Data
        const baseUrl = `https://careers.gtachrms.com/${req.tenantId}`;
        const defaultSlug = 'careers';
        const fullUrl = `${baseUrl}/${seo?.seoSlug || defaultSlug}`;

        // SAFE DATA PREPARATION
        const publishedDoc = {
            tenantId: req.tenantId,
            companyId,
            seo: {
                title: seo?.seoTitle || "Career Page",
                description: seo?.seoDescription || "Join our team",
                keywords: seo?.seoKeywords || [],
                slug: seo?.seoSlug || defaultSlug,
                ogImage: seo?.seoOgImageUrl || "",
                canonicalUrl: fullUrl,
                metaHtml: {
                    title: `<title>${escapeHTML(seo?.seoTitle || "Career Page")}</title>`,
                    description: `<meta name="description" content="${escapeHTML(seo?.seoDescription || "Join our team")}">`,
                    keywords: `<meta name="keywords" content="${escapeHTML(seo?.seoKeywords?.join(', ') || '')}">`,
                    ogTitle: `<meta property="og:title" content="${escapeHTML(seo?.seoTitle || "Career Page")}">`,
                    ogDescription: `<meta property="og:description" content="${escapeHTML(seo?.seoDescription || "Join our team")}">`,
                    ogImage: seo?.seoOgImageUrl ? `<meta property="og:image" content="${seo.seoOgImageUrl}">` : '',
                    ogType: `<meta property="og:type" content="website">`,
                    ogUrl: `<meta property="og:url" content="${fullUrl}">`,
                    canonical: `<link rel="canonical" href="${fullUrl}">`
                }
            },
            sections: (sections || []).map(s => ({
                id: s.sectionId,
                type: s.sectionType,
                content: s.content || {},
                order: s.sectionOrder || 0
            })),
            theme: layout?.layoutConfig?.theme || { primaryColor: '#4F46E5' },
            publishedAt: new Date(),
            version: Date.now()
        };

        // console.log("[Publish] Saving to PublishedCareerPage...");
        const savedPub = await PublishedCareerPage.findOneAndUpdate(
            { tenantId: req.tenantId },
            { $set: publishedDoc },
            { upsert: true, new: true, sort: { publishedAt: -1 } }
        );
        // console.log(`[Publish] Saved PublishedCareerPage ID: ${savedPub._id}`);

        // 5. Update Drafts to 'Published' status
        const updatePromises = [];
        // Always try to update sections if any exist
        if (sections && sections.length > 0) {
            updatePromises.push(CareerSection.updateMany({ tenantId: req.tenantId, companyId }, { isPublished: true, publishedAt: new Date() }));
        }

        // Only update SEO/Layout if they exist
        if (seo && seo._id) {
            updatePromises.push(CareerSEO.updateOne({ _id: seo._id }, { isPublished: true, publishedAt: new Date() }));
        }

        if (layout && layout._id) {
            updatePromises.push(CareerLayout.updateOne({ _id: layout._id }, { isPublished: true, publishedAt: new Date() }));
        }

        await Promise.all(updatePromises);

        // console.log(`✅ [Publish] Success for ${req.tenantId}`);

        res.json({
            success: true,
            message: 'Career page published successfully',
            url: fullUrl,
            publishedId: savedPub._id
        });

    } catch (error) {
        console.error('❌ [publishLive] CRITICAL ERROR:', error);
        res.status(500).json({ error: 'Server error during publishing: ' + error.message });
    }
};

// ============= GET PUBLIC PAGE (Fast Read) =============


// ============= GET PUBLIC PAGE (Fast Read) =============
exports.getPublicPage = async (req, res) => {
    try {
        const { tenantId: tenantIdentifier } = req.params;
        if (!tenantIdentifier) {
            return res.status(400).json({ error: 'Tenant ID param required' });
        }

        // Resolve identifier (could be code or ID) to ID
        let tenantId = tenantIdentifier;
        if (!mongoose.Types.ObjectId.isValid(tenantIdentifier)) {
            const t = await Tenant.findOne({ code: tenantIdentifier }).lean();
            if (t) {
                tenantId = t._id.toString();
            }
        }

        const publishedPage = await PublishedCareerPage.findOne({ tenantId }).sort({ publishedAt: -1 });

        if (publishedPage) {
            return res.json({
                success: true,
                seoSettings: {
                    seo_title: publishedPage.seo?.title || "Careers",
                    seo_description: publishedPage.seo?.description || "",
                    seo_keywords: publishedPage.seo?.keywords || [],
                    seo_slug: publishedPage.seo?.slug || "careers",
                    seo_og_image: publishedPage.seo?.ogImage || ""
                },
                sections: publishedPage.sections || [],
                theme: publishedPage.theme || { primaryColor: '#4F46E5' },
                applyPage: publishedPage.applyPage || null, // ADDED THIS
                metaTags: publishedPage.seo?.metaHtml || {}
            });
        }

        return res.json({
            success: false,
            message: 'No published career page found',
            seoSettings: null,
            sections: [],
            metaTags: null
        });

    } catch (error) {
        console.error('❌ [getPublicPage] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ============= GET DRAFT DATA (For Builder) =============
exports.getDraftData = async (req, res) => {
    try {
        if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });

        // Get Company ID (Ensures profile exists)
        const company = await getCompanyProfile(req.tenantId);
        const companyId = company._id.toString();

        if (!companyId) return res.json(getDefaultConfig());

        const [seo, sections, layout] = await Promise.all([
            CareerSEO.findOne({ tenantId: req.tenantId, companyId }),
            CareerSection.find({ tenantId: req.tenantId, companyId }).sort({ sectionOrder: 1 }),
            CareerLayout.findOne({ tenantId: req.tenantId, companyId })
        ]);

        res.json({
            seoSettings: seo ? {
                seo_title: seo.seoTitle,
                seo_description: seo.seoDescription,
                seo_keywords: seo.seoKeywords,
                seo_slug: seo.seoSlug,
                seo_og_image: seo.seoOgImageUrl
            } : getDefaultConfig().seoSettings,
            sections: sections.length > 0 ? sections.map(s => ({
                id: s.sectionId,
                type: s.sectionType,
                content: s.content || {},
                order: s.sectionOrder
            })) : getDefaultConfig().sections,
            theme: layout?.layoutConfig?.theme || getDefaultConfig().theme,
            lastPublishedAt: layout?.publishedAt
        });

    } catch (error) {
        console.error('❌ [getDraftData] Error:', error);
        // Fallback to defaults
        res.json(getDefaultConfig());
    }
};

function getDefaultConfig() {
    return {
        seoSettings: {
            seo_title: '',
            seo_description: '',
            seo_keywords: [],
            seo_slug: '',
            seo_og_image: ''
        },
        sections: [
            {
                id: 'hero-default',
                type: 'hero',
                content: {
                    title: "Join Our Amazing Team",
                    subtitle: "Innovate, grow, and build the future with us.",
                    bgType: "gradient",
                    bgColor: "from-[#4F46E5] via-[#9333EA] to-[#EC4899]",
                    ctaText: "Check Open Positions"
                }
            }
        ],
        theme: {
            primaryColor: '#4F46E5',
            logoUrl: '',
            companyName: '',
            showHeader: true,
            logoHeight: 40,
            logoLink: ''
        },
        lastPublishedAt: null
    };
}
