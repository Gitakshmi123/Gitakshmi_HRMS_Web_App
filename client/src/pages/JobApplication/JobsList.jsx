import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useParams, useNavigate } from 'react-router-dom';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import api, { resolveTenantLogoUrl, API_ROOT } from '../../utils/api';
import { useJobPortalAuth } from '../../context/JobPortalAuthContext';
import { setCompany, getCompany, cleanId } from '../../utils/auth';
import { normalizePortalValue } from '../../utils/jobPortalContext';
import CandidateProfileMenu from '../../components/jobs/CandidateProfileMenu';
import {
    Search,
    Briefcase,
    Clock,
    ArrowRight,
    Star,
    Zap,
    Users,
    Globe,
    Calendar,
    ArrowLeft
} from 'lucide-react';
import CareerPreview from '../HR/CareerBuilder/CareerPreview';

export default function JobsList() {
    const [searchParams] = useSearchParams();
    const { companyId } = useParams();
    const companyCode = companyId;
    const tenantIdQuery = normalizePortalValue(searchParams.get('tenantId'));
    const storedCompany = getCompany();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const navigate = useNavigate();
    const { candidate, isInitialized } = useJobPortalAuth();

    const [resolvedTenantId, setResolvedTenantId] = useState(() => {
        if (tenantIdQuery) return tenantIdQuery;
        const storedTenantId = normalizePortalValue(storedCompany?.tenantId || storedCompany?._id);
        const storedCode = String(storedCompany?.code || '').trim().toLowerCase();
        const currentCode = String(companyCode || '').trim().toLowerCase();
        if (storedTenantId && storedCode && currentCode && storedCode === currentCode) {
            return storedTenantId;
        }
        return null;
    });
    const [myApplications, setMyApplications] = useState(new Set());
    const [companyName, setCompanyName] = useState(() => {
        if (!storedCompany) return '';
        const storedTenantId = cleanId(storedCompany.tenantId || storedCompany._id);
        if (storedCompany.code === companyCode || (tenantIdQuery && storedTenantId === cleanId(tenantIdQuery))) {
            return storedCompany.name || storedCompany.companyName || '';
        }
        return '';
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDept, setFilterDept] = useState('All Departments');
    const [filterExp, setFilterExp] = useState('All Experience');
    const [filterType, setFilterType] = useState('All Types');
    const [candidateName, setCandidateName] = useState(candidate?.name || '');
    const [customization, setCustomization] = useState(null);
    const [scrolled, setScrolled] = useState(false);
    const [logoUrl, setLogoUrl] = useState(() => {
        if (!storedCompany) return null;
        return resolveTenantLogoUrl(storedCompany);
    });

    useEffect(() => {
        // SAFETY: If companyCode is a known portal route, redirect to the correct path
        const portalRoutes = ['dashboard', 'login', 'signup', 'applications', 'profile', 'open-positions'];
        if (portalRoutes.includes(companyCode)) {
            navigate(`/candidate/${companyCode}`, { replace: true });
            return;
        }

        if (candidate?.name) setCandidateName(candidate.name);

        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [candidate, companyCode, navigate]);

    useEffect(() => {
        async function init() {
            let tid = resolvedTenantId;
            let resolvedCompanyName = companyName;
            if (!tid && companyCode) {
                try {
                    const res = await api.get(
                        `/public/resolve-code/${encodeURIComponent(companyCode)}`
                    );
                    tid = normalizePortalValue(res.data?.tenantId);
                    if (!tid) {
                        throw new Error('Resolved tenant ID is invalid');
                    }
                    setResolvedTenantId(tid);
                    resolvedCompanyName = res.data?.companyName || '';
                    setCompanyName(resolvedCompanyName);
                    setCompany({
                        name: resolvedCompanyName || 'Careers',
                        code: companyCode,
                        tenantId: tid,
                    });
                } catch (e) {
                    console.error("Resolve error:", e);
                    // Recovery path: if portal URL has stale/wrong company code but user session exists,
                    // redirect to the tenant's actual public code.
                    try {
                        const me = await api.get('/tenants/me');
                        const safeCode = String(me?.data?.code || '').trim();
                        const safeTenantId = normalizePortalValue(
                            me?.data?._id || me?.data?.id || me?.data?.tenantId
                        );
                        if (safeTenantId) {
                            const desiredCode = safeCode || companyCode;
                            const desiredPath = `/jobs/${encodeURIComponent(desiredCode)}?tenantId=${encodeURIComponent(safeTenantId)}`;
                            navigate(desiredPath, { replace: true });
                            return;
                        }
                    } catch (_fallbackErr) {
                        // ignore and show original error below
                    }

                    setError(e.response?.data?.error || e.message || 'Invalid Company Link');
                    setLoading(false);
                    return;
                }
            }

            if (!tid) {
                setError('Missing Company Information');
                setLoading(false);
                return;
            }

            try {
                try {
                    const companyRes = await api.get(`/public/tenant/${encodeURIComponent(tid)}`);
                    const companyInfo = {
                        ...companyRes.data,
                        tenantId: tid,
                        code: companyRes.data?.code || companyCode || storedCompany?.code || '',
                    };
                    resolvedCompanyName = companyInfo.companyName || companyInfo.name || resolvedCompanyName || '';
                    setCompanyName(resolvedCompanyName);
                    setCompany(companyInfo);
                    setLogoUrl(resolveTenantLogoUrl(companyInfo));
                } catch (companyErr) {
                    console.warn('Failed to load tenant branding:', companyErr.message);
                    if (resolvedCompanyName || companyCode) {
                        const fallbackCompany = {
                            name: resolvedCompanyName || storedCompany?.name || 'Careers',
                            code: companyCode || storedCompany?.code || '',
                            tenantId: tid,
                        };
                        setCompany(fallbackCompany);
                        setLogoUrl(resolveTenantLogoUrl(fallbackCompany));
                    }
                }

                // Public jobs should be visible even before candidate login.
                try {
                    const jobsRes = await api.get(`/public/jobs?tenantId=${encodeURIComponent(tid)}`);
                    let jobList = [];
                    if (Array.isArray(jobsRes.data)) {
                        jobList = jobsRes.data;
                    } else if (jobsRes.data?.success && jobsRes.data?.data?.jobs) {
                        jobList = jobsRes.data.data.jobs;
                    } else if (jobsRes.data?.jobs) {
                        jobList = jobsRes.data.jobs;
                    }
                    setJobs(jobList);
                } catch (jobsErr) {
                    console.warn('Failed to load public jobs:', jobsErr.message);
                    setJobs([]);
                }

                try {
                    // Use new optimized endpoint (reads from PublishedCareerPage)
                    const custRes = await api.get(`/career/public/${encodeURIComponent(tid)}`);
                    if (custRes.data && custRes.data.success !== false) {
                        setCustomization(custRes.data);
                    } else {
                        console.log('No published career customization found, using defaults.');
                        setCustomization(null);
                    }
                } catch (custErr) {
                    console.warn('Failed to load career customization:', custErr.message);
                    setCustomization(null);
                }

                if (candidate) {
                    try {
                        const dashRes = await api.get('/candidate/dashboard');
                        if (dashRes.data.applications) {
                            const appSet = new Set(dashRes.data.applications.map(app => app.requirementId?._id || app.requirementId));
                            setMyApplications(appSet);
                        }
                        if (dashRes.data.profile?.name) {
                            setCandidateName(dashRes.data.profile.name);
                        }
                    } catch (dashErr) {
                        console.warn('Failed to load candidate dashboard data:', dashErr.message);
                    }
                } else {
                    setMyApplications(new Set());
                }
            } catch (err) {
                console.error("Portal Init Error:", err);
                setError('Failed to load portal data.');
            } finally {
                setLoading(false);
            }
        }

        if (isInitialized) {
            init();
        }
    }, [companyCode, resolvedTenantId, isInitialized, candidate]);

    // Apply SEO Settings
    useEffect(() => {
        if (customization && customization.seoSettings) {
            const { seo_title, seo_description, seo_keywords, seo_og_image } = customization.seoSettings;

            // 1. Update Title
            if (seo_title) document.title = seo_title;

            // 2. Update Meta Description
            let metaDesc = document.querySelector("meta[name='description']");
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.name = "description";
                document.head.appendChild(metaDesc);
            }
            if (seo_description) metaDesc.content = seo_description;

            // 3. Update Keywords
            if (seo_keywords && seo_keywords.length > 0) {
                let metaKeywords = document.querySelector("meta[name='keywords']");
                if (!metaKeywords) {
                    metaKeywords = document.createElement('meta');
                    metaKeywords.name = "keywords";
                    document.head.appendChild(metaKeywords);
                }
                metaKeywords.content = seo_keywords.join(', ');
            }

            // 4. Update OG Image
            if (seo_og_image) {
                let metaOgImage = document.querySelector("meta[property='og:image']");
                if (!metaOgImage) {
                    metaOgImage = document.createElement('meta');
                    metaOgImage.setAttribute('property', 'og:image');
                    document.head.appendChild(metaOgImage);
                }
                metaOgImage.content = seo_og_image;
            }
        } else if (companyName) {
            document.title = `${companyName} - Careers`;
        }
    }, [customization, companyName]);

    const departments = ['All Departments', ...new Set(jobs.map(j => j.department).filter(Boolean))];

    const filteredJobs = jobs.filter(job => {
        const matchesSearch = job.jobTitle?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
            job.department?.toLowerCase()?.includes(searchTerm.toLowerCase());
        const matchesDept = filterDept === 'All Departments' || job.department === filterDept;
        return matchesSearch && matchesDept;
    });

    const jobsReturnPath = `/jobs/${companyCode}`;
    const tidStr = cleanId(resolvedTenantId);
    const candidateLoginHref = tidStr
        ? `/candidate/login?tenantId=${tidStr}&redirect=${encodeURIComponent(jobsReturnPath)}`
        : `/candidate/login?redirect=${encodeURIComponent(jobsReturnPath)}`;

    const handleGuestHeroCta = () => {
        navigate(candidateLoginHref);
    };

    if (loading) return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
                <div className="relative">
                    <div className="h-16 w-16 border-4 border-blue-600/20 rounded-full"></div>
                    <div className="absolute top-0 left-0 h-16 w-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="flex flex-col items-center">
                    <p className="text-slate-900 font-black text-[11px] uppercase tracking-[0.3em]">Preparing Portal</p>
                    <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest mt-1">Connecting to {companyName || 'Ecosystem'}...</p>
                </div>
            </div>
        </div>
    );

    if (error) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-8 text-center">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 max-w-md w-full">
                    <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Globe size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-4 tracking-tight">Access Denied</h2>
                    <p className="text-slate-500 font-medium leading-relaxed mb-8">{error}</p>
                    <button onClick={() => window.location.reload()} className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-full font-bold hover:shadow-lg transition-all">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const showHeaderNavbar = customization?.theme?.showHeader !== false;
    const logoHeight = customization?.theme?.logoHeight || 40;
    const logoLink = customization?.theme?.logoLink || '';
    const headerMinHeight = showHeaderNavbar ? Math.max(80, logoHeight + 24) : 0;
    const finalLogoUrl = customization?.theme?.logoUrl
        ? (customization.theme.logoUrl.startsWith('http') || customization.theme.logoUrl.startsWith('data:')
            ? customization.theme.logoUrl
            : `${API_ROOT}${customization.theme.logoUrl.startsWith('/') ? '' : '/'}${customization.theme.logoUrl}`)
        : logoUrl;
    const finalCompanyName = customization?.theme?.companyName || companyName || 'GT HRMS';

    return (
        <div className="min-h-screen bg-white font-sans selection:bg-blue-100 selection:text-blue-600">
            {/* Header / Navigation */}
            {showHeaderNavbar && (
                <nav 
                    style={{ minHeight: `${headerMinHeight}px` }}
                    className="absolute top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-gray-100 bg-white/80 backdrop-blur-md flex items-center py-3"
                >
                    <div className="w-full px-8 flex items-center justify-between">
                        <div className="flex items-center gap-4 group cursor-default">
                            {finalLogoUrl ? (
                                <div 
                                    style={{ height: `${logoHeight}px` }}
                                    className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center shadow-md p-1.5"
                                >
                                    {logoLink ? (
                                        <a href={logoLink} target="_blank" rel="noopener noreferrer" className="block h-full">
                                            <img 
                                                src={finalLogoUrl} 
                                                alt="Logo" 
                                                style={{ height: '100%', width: 'auto' }}
                                                className="object-contain" 
                                            />
                                        </a>
                                    ) : (
                                        <img 
                                            src={finalLogoUrl} 
                                            alt="Logo" 
                                            style={{ height: '100%', width: 'auto' }}
                                            className="object-contain" 
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                                    <Briefcase size={20} />
                                </div>
                            )}
                            <span 
                                style={{ color: customization?.theme?.companyNameColor || '#111827' }}
                                className="text-xl font-black tracking-tight"
                            >
                                {finalCompanyName}
                            </span>
                        </div>

                        <div className="flex items-center gap-6">
                            {candidate ? (
                                <CandidateProfileMenu identifier={resolvedTenantId} isTransparent={false} />
                            ) : (
                                <Link
                                    to={candidateLoginHref}
                                    className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-200"
                                >
                                    Candidate Login
                                </Link>
                            )}
                        </div>
                    </div>
                </nav>
            )}

            {/* Main Content: Driven by Career Builder */}
            <main style={showHeaderNavbar ? { paddingTop: `${headerMinHeight}px` } : {}}>
                <CareerPreview
                    config={customization && customization.sections?.length > 0 ? customization : {
                        sections: [
                            {
                                id: 'hero-default',
                                type: 'hero',
                                content: {
                                    title: "Join Our Amazing Team",
                                    subtitle: "Innovate, grow, and build the future with us.",
                                    bgType: "gradient",
                                    bgColor: "from-blue-600 via-blue-700 to-blue-800",
                                    ctaText: "Check Open Positions"
                                }
                            },
                            {
                                id: 'openings-default',
                                type: 'openings',
                                content: {
                                    title: "Open Positions",
                                    layout: "grid",
                                    gridColumns: 3,
                                    enabled: true
                                }
                            }
                        ],
                        theme: { primaryColor: '#2563EB' }
                    }}
                    isBuilder={false}
                    jobs={filteredJobs}
                    searchTerm={searchTerm}
                    onSearch={setSearchTerm}
                    myApplications={myApplications}
                    lockJobSearch={false}
                    onHeroCta={!candidate ? handleGuestHeroCta : undefined}
                    openingsLocked={false}
                    loginHref={candidateLoginHref}
                    onApply={(job) => {
                        if (!candidate) {
                            navigate(candidateLoginHref);
                            return;
                        }
                        if (myApplications.has(job._id)) {
                            navigate('/candidate/dashboard');
                        } else {
                            const tid = resolvedTenantId || job.tenant;
                            const refCode = searchParams.get('ref');
                            const refQuery = refCode ? `&ref=${encodeURIComponent(refCode)}` : '';
                            navigate(`/apply-job/${job._id}?tenantId=${tid}${refQuery}`);
                        }
                    }}
                />
            </main>

            {/* Simple Footer */}
            <footer className="bg-white border-t border-gray-50 py-12">
                <div className="max-w-[1800px] mx-auto px-6 text-center">
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em]">
                        &copy; {new Date().getFullYear()} {companyName || 'Candidate Portal'}. Powered by Gitakshmi HRMS
                    </p>
                </div>
            </footer>
        </div>
    );
}
