import React from 'react';
import { Briefcase } from 'lucide-react';
import { API_ROOT } from '../../../utils/api';
import CareerBlockHero from './blocks/CareerBlockHero';
import CareerBlockHighlights from './blocks/CareerBlockHighlights';
import CareerBlockCompanyInfo from './blocks/CareerBlockCompanyInfo';
import CareerBlockFaq from './blocks/CareerBlockFaq';
import CareerBlockTestimonials from './blocks/CareerBlockTestimonials';
import CareerBlockOpenings from './blocks/CareerBlockOpenings';

const blockComponents = {
    'hero': CareerBlockHero,
    'highlights': CareerBlockHighlights,
    'company-info': CareerBlockCompanyInfo,
    'faq': CareerBlockFaq,
    'testimonials': CareerBlockTestimonials,
    'openings': CareerBlockOpenings
};

export default function CareerPreview({
    config,
    selectedBlockId,
    onSelectBlock,
    isBuilder = true,
    jobs,
    searchTerm,
    onSearch,
    myApplications,
    onApply,
    previewMode = 'desktop',
    /** When true, hide hero job search until candidate is signed in */
    lockJobSearch = false,
    /** Optional: override hero primary CTA (e.g. navigate to login) */
    onHeroCta,
    /** When true, openings block shows sign-in prompt instead of listings */
    openingsLocked = false,
    /** Router path for sign-in (e.g. /candidate/login?tenantId=...&redirect=...) */
    loginHref = '/candidate/login',
}) {
    if (!config || !config.sections) return null;

    const isMobile = previewMode === 'mobile';

    return (
        <div className={`${isBuilder && !isMobile ? 'flex-1 overflow-y-auto bg-gray-100 p-8' : ''}`}>
            <div className={`relative ${isBuilder ? (isMobile ? 'w-full bg-white min-h-full font-sans' : 'mx-auto bg-white shadow-2xl min-h-full max-w-5xl rounded-3xl font-sans') : 'w-full font-sans'}`}>
                {/* Device Header - UI Polish for Builder (Only show on Desktop) */}
                {isBuilder && !isMobile && (
                    <div className="h-12 bg-gray-900 rounded-t-3xl flex items-center px-6 gap-2 border-b border-gray-800">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <div className="ml-4 flex-1 bg-gray-800 rounded-lg h-6 flex items-center px-3 text-[10px] text-gray-500 font-mono">
                            https://careers.gitakshmi.com/{config.tenantId}
                        </div>
                    </div>
                )}

                {/* Custom Page Header Navbar (Mock for Builder Preview) */}
                {isBuilder && config.theme?.showHeader !== false && (
                    <nav 
                        style={{ minHeight: `${Math.max(80, (config.theme?.logoHeight || 40) + 24)}px` }}
                        className="w-full bg-white/95 backdrop-blur border-b border-gray-100 px-8 py-3 flex items-center justify-between sticky top-0 z-30"
                    >
                        <div className="flex items-center gap-4 cursor-default">
                            {config.theme?.logoUrl ? (
                                <div 
                                    style={{ height: `${config.theme?.logoHeight || 40}px` }}
                                    className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center shadow-md p-1.5"
                                >
                                    {config.theme?.logoLink ? (
                                        <a href={config.theme.logoLink} target="_blank" rel="noopener noreferrer" className="block h-full">
                                            <img 
                                                src={config.theme.logoUrl.startsWith('http') || config.theme.logoUrl.startsWith('data:') ? config.theme.logoUrl : `${API_ROOT}${config.theme.logoUrl.startsWith('/') ? '' : '/'}${config.theme.logoUrl}`} 
                                                alt="Logo" 
                                                style={{ height: '100%', width: 'auto' }}
                                                className="object-contain" 
                                            />
                                        </a>
                                    ) : (
                                        <img 
                                            src={config.theme.logoUrl.startsWith('http') || config.theme.logoUrl.startsWith('data:') ? config.theme.logoUrl : `${API_ROOT}${config.theme.logoUrl.startsWith('/') ? '' : '/'}${config.theme.logoUrl}`} 
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
                                style={{ color: config.theme?.companyNameColor || '#111827' }}
                                className="text-xl font-black tracking-tight"
                            >
                                {config.theme?.companyName || 'GT HRMS'}
                            </span>
                        </div>

                        <div className="flex items-center gap-6">
                            <span className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold shadow-lg shadow-gray-200 cursor-pointer">
                                Candidate Login
                            </span>
                        </div>
                    </nav>
                )}

                {config.sections.map((section) => {
                    const Component = blockComponents[section.type];
                    if (!Component) return null;

                    return (
                        <div
                            key={section.id}
                            onClick={() => isBuilder && onSelectBlock(section.id)}
                            className={`relative group ${isBuilder ? 'cursor-pointer' : ''} ${isBuilder && selectedBlockId === section.id ? 'ring-4 ring-blue-500 ring-inset z-20 shadow-2xl' : ''}`}
                        >
                            {isBuilder && (
                                <div className={`absolute top-4 left-4 z-30 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${selectedBlockId === section.id ? 'opacity-100' : ''}`}>
                                    {section.type} section
                                </div>
                            )}
                            <Component
                                content={section.content}
                                jobs={jobs}
                                searchTerm={searchTerm}
                                onSearch={onSearch}
                                myApplications={myApplications}
                                onApply={onApply}
                                previewMode={previewMode}
                                lockSearch={lockJobSearch}
                                onCtaClick={onHeroCta}
                                openingsLocked={openingsLocked}
                                loginHref={loginHref}
                            />
                        </div>
                    );
                })}

                {/* Builder Footer */}
                {isBuilder && (
                    <footer className="bg-white border-t border-gray-100 py-12">
                        <div className="text-center">
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mb-2">Powered by Gitakshmi HRMS</p>
                        </div>
                    </footer>
                )}
            </div>
        </div>
    );
}
