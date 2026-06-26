import React from 'react';
import { Search, Sparkles, ArrowRight } from 'lucide-react';
import { API_ROOT } from '../../../../utils/api';
import {
    buildCareerGradientValue,
    DEFAULT_CAREER_GRADIENT,
    resolveCareerGradientBackground,
} from '../../../../utils/careerGradient';

export default function CareerBlockHero({ content, onSearch, searchTerm, previewMode = 'desktop', lockSearch = false, onCtaClick }) {
    const isMobile = previewMode === 'mobile';
    const {
        title = "Join Our Amazing Team",
        subtitle = "Innovate, grow, and build the future with us.",
        bgType = "gradient",
        bgColor = buildCareerGradientValue(DEFAULT_CAREER_GRADIENT),
        imageUrl = "",
        ctaText = "Check Open Positions",
        showSearchBar = true
    } = content || {};

    const getFullImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('data:')) return url;
        if (url.startsWith('/')) return `${API_ROOT}${url}`;
        return url;
    };

    const isGradient = bgType === 'gradient';
    const isSolid = bgType === 'solid';
    const isImage = bgType === 'image';

    let safeBgColor = bgColor;
    if (isGradient && !String(safeBgColor || '').trim()) {
        safeBgColor = buildCareerGradientValue(DEFAULT_CAREER_GRADIENT);
    }

    let gradientStyle = {};
    let gradientClass = '';

    if (isGradient) {
        const gradientBackground = resolveCareerGradientBackground(safeBgColor);
        if (gradientBackground) {
            gradientStyle.backgroundImage = gradientBackground;
        } else {
            gradientClass = `bg-gradient-to-r ${safeBgColor}`;
        }
    }

    const heroStyle = {
        ...(isImage && imageUrl ? { backgroundImage: `url(${getFullImageUrl(imageUrl)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
        ...(isSolid ? { backgroundColor: bgColor } : {}),
        ...gradientStyle
    };

    const fallbackClass = !isGradient && !isSolid && !isImage ? 'bg-gray-900' : '';

    const handleSearch = (e) => {
        if (onSearch) onSearch(e.target.value);
    };

    return (
        <section className="relative" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                @keyframes hero-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
                @keyframes hero-pulse-glow { 0%,100%{box-shadow:0 0 30px rgba(255,255,255,0.15)} 50%{box-shadow:0 0 60px rgba(255,255,255,0.35)} }
                @keyframes hero-spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes hero-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
                @keyframes hero-fade-up { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
                .hero-badge { animation: hero-float 4s ease-in-out infinite; }
                .hero-glow-btn { animation: hero-pulse-glow 3s ease-in-out infinite; }
                .hero-title { animation: hero-fade-up 0.7s ease forwards; }
                .hero-sub { animation: hero-fade-up 0.7s 0.15s ease both; }
                .hero-cta { animation: hero-fade-up 0.7s 0.3s ease both; }
                .hero-search { animation: hero-fade-up 0.7s 0.45s ease both; }
                .hero-orb-1 { animation: hero-spin-slow 20s linear infinite; }
                .hero-orb-2 { animation: hero-spin-slow 15s linear infinite reverse; }
                .hero-shimmer-text {
                    background: linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.6) 40%, #fff 60%, rgba(255,255,255,0.6) 100%);
                    background-size: 200% auto;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: hero-shimmer 4s linear infinite;
                }
                .hero-search-input::placeholder { color: rgba(100,116,139,0.6); }
            `}</style>

            {/* Main Hero */}
            <div
                className={`relative ${isMobile ? 'pt-16 pb-28' : 'pt-28 pb-44'} overflow-hidden ${gradientClass} ${fallbackClass}`}
                style={heroStyle}
            >
                {/* Dark overlay for image mode */}
                {bgType === 'image' && <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />}

                {/* Animated decorative orbs */}
                {bgType === 'gradient' && (
                    <>
                        <div className="hero-orb-1 absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full border border-white/10"
                            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)' }} />
                        <div className="hero-orb-2 absolute -bottom-48 -left-32 w-[600px] h-[600px] rounded-full border border-white/5"
                            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%)' }} />
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] blur-[120px]"
                            style={{ background: 'rgba(255,255,255,0.06)' }} />
                        {/* Grid pattern overlay */}
                        <div className="absolute inset-0 opacity-[0.04]"
                            style={{
                                backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                                backgroundSize: '50px 50px'
                            }} />
                    </>
                )}

                <div className={`max-w-6xl mx-auto ${isMobile ? 'px-5' : 'px-8'} relative z-10 text-center`}>

                    {/* Floating badge */}
                    <div className="hero-badge inline-flex items-center gap-2 mb-6">
                        <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/25 text-white rounded-full px-4 py-2 shadow-lg">
                            <Sparkles size={13} className="text-yellow-300" />
                            <span className="text-xs font-semibold tracking-wide">We're Hiring — Join the Team</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className={`hero-title ${isMobile ? 'text-4xl' : 'text-6xl sm:text-7xl lg:text-8xl'} font-black tracking-tight leading-[0.95] mb-6`}>
                        {bgType === 'gradient' ? (
                            <span className="hero-shimmer-text">{title}</span>
                        ) : (
                            <span className="text-white drop-shadow-lg">{title}</span>
                        )}
                    </h1>

                    {/* Subtitle */}
                    <p className={`hero-sub ${isMobile ? 'text-base' : 'text-xl'} text-white/80 font-medium leading-relaxed max-w-2xl mx-auto mb-10`}>
                        {subtitle}
                    </p>

                    {/* CTA Button */}
                    <div className="hero-cta flex items-center justify-center gap-4">
                        <button
                            type="button"
                            onClick={() => {
                                if (typeof onCtaClick === 'function') { onCtaClick(); return; }
                                document.getElementById('open-positions-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={`hero-glow-btn group relative inline-flex items-center gap-3 ${isMobile ? 'px-7 py-3 text-sm' : 'px-9 py-4 text-base'} bg-white text-gray-900 rounded-full font-bold shadow-2xl hover:shadow-white/20 hover:-translate-y-0.5 transition-all duration-300 active:scale-95`}
                        >
                            {ctaText}
                            <ArrowRight size={isMobile ? 15 : 18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* Bottom wave fade */}
                <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                    style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.12))' }} />
            </div>

            {/* Floating Search Bar */}
            {showSearchBar && !lockSearch && (
                <div className={`hero-search relative z-20 ${isMobile ? '-mt-8 px-4' : '-mt-12 px-8'}`}>
                    <div className="max-w-3xl mx-auto">
                        <div className={`bg-white ${isMobile ? 'rounded-2xl p-2' : 'rounded-[2rem] p-2'} shadow-[0_32px_80px_-16px_rgba(0,0,0,0.16)] border border-gray-100/80`}>
                            <div className="relative flex items-center gap-3 bg-gray-50/60 rounded-[1.6rem] px-4 py-1">
                                <Search size={isMobile ? 16 : 20} className="text-gray-400 shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Search for a job role, skill, or team..."
                                    value={searchTerm || ''}
                                    onChange={handleSearch}
                                    className={`hero-search-input flex-1 bg-transparent border-none outline-none ${isMobile ? 'py-3 text-sm' : 'py-4 text-base'} font-medium text-gray-700`}
                                />
                                <button className={`shrink-0 bg-gray-900 text-white ${isMobile ? 'px-4 py-2 text-xs' : 'px-6 py-3 text-sm'} rounded-[1.4rem] font-bold hover:bg-gray-800 transition-all active:scale-95`}>
                                    Search
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
