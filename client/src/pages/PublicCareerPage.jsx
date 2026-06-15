import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api, { API_ROOT } from '../utils/api';
import CareerPreview from './HR/CareerBuilder/CareerPreview';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function PublicCareerPage() {
    const { tenantId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [data, setData] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!tenantId) return;
        fetchPageData();
        fetchJobs();
    }, [tenantId]);

    // Inject Meta Tags Manually
    useEffect(() => {
        if (!data?.metaTags) return;

        const { metaTags } = data;
        const head = document.head;

        // Cleanup previous tags
        const existing = head.querySelectorAll('[data-seo-tag="true"]');
        existing.forEach(el => el.remove());

        // Helper
        const addTag = (tagName, attributes) => {
            const el = document.createElement(tagName);
            Object.entries(attributes).forEach(([key, val]) => el.setAttribute(key, val));
            el.setAttribute('data-seo-tag', 'true');
            head.appendChild(el);
        };

        const getAbsoluteUrl = (url) => {
            if (!url) return '';
            if (url.startsWith('http')) return url;
            // Remove leading slash if present to avoid double slash if API_ROOT has trailing, or just standard join
            return `${API_ROOT}${url.startsWith('/') ? '' : '/'}${url}`;
        };

        // Title
        if (metaTags.title) document.title = metaTags.title;

        // Meta
        if (metaTags.description) addTag('meta', { name: 'description', content: metaTags.description });
        if (metaTags.keywords) addTag('meta', { name: 'keywords', content: metaTags.keywords });

        // Resolve absolute image URL for social
        const ogImageUrl = getAbsoluteUrl(metaTags.ogImage);

        // OG
        if (metaTags.ogTitle) addTag('meta', { property: 'og:title', content: metaTags.ogTitle });
        if (metaTags.ogDescription) addTag('meta', { property: 'og:description', content: metaTags.ogDescription });
        if (ogImageUrl) addTag('meta', { property: 'og:image', content: ogImageUrl });
        if (metaTags.ogUrl) addTag('meta', { property: 'og:url', content: metaTags.ogUrl });
        addTag('meta', { property: 'og:type', content: 'website' });

        // Twitter
        addTag('meta', { name: 'twitter:card', content: 'summary_large_image' });
        if (metaTags.ogTitle) addTag('meta', { name: 'twitter:title', content: metaTags.ogTitle });
        if (metaTags.ogDescription) addTag('meta', { name: 'twitter:description', content: metaTags.ogDescription });
        if (ogImageUrl) addTag('meta', { name: 'twitter:image', content: ogImageUrl });

        return () => {
            const existing = head.querySelectorAll('[data-seo-tag="true"]');
            existing.forEach(el => el.remove());
        };
    }, [data]);

    const fetchPageData = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/career/public/${tenantId}`);

            if (res.data && res.data.sections) {
                setData(res.data);
            } else {
                throw new Error("Invalid page data");
            }
        } catch (err) {
            console.error("Error fetching career page:", err);
            setError("Career page not found or unpublished.");
        } finally {
            setLoading(false);
        }
    };

    const fetchJobs = async () => {
        try {
            const res = await api.get(`/public/jobs?tenantId=${tenantId}`);
            
            let jobList = [];
            if (Array.isArray(res.data)) {
                jobList = res.data;
            } else if (res.data?.success && res.data?.data?.jobs) {
                jobList = res.data.data.jobs;
            } else if (res.data?.jobs) {
                jobList = res.data.jobs;
            }
            
            setJobs(jobList);
        } catch (error) {
            console.warn("Could not fetch jobs:", error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Loading Career Page...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={32} />
                    </div>
                    <h1 className="text-xl font-black text-gray-900 mb-2">Page Not Found</h1>
                    <p className="text-gray-500 mb-6">{error || "This company hasn't published their career page yet."}</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-gray-900 text-white rounded-lg font-bold text-sm hover:bg-black transition-colors">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <CareerPreview
                config={data} // Pass the entire data object (sections, theme, seo)
                isBuilder={false}
                jobs={jobs}
                searchTerm=""
                onSearch={() => { }}
                onApply={(job) => {
                    navigate(`/apply-job/${job._id}?tenantId=${tenantId}`);
                }}
            />
        </div>
    );
}
