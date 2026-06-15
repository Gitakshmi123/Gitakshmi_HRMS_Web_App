import React from 'react';
import { Search } from 'lucide-react';
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

    // Robust Fallback: If gradient mode but invalid classes, force default
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
        <section className="relative">
            {/* Main Hero Content */}
            <div
                className={`relative ${isMobile ? 'pt-16 pb-24' : 'pt-32 pb-44'} overflow-hidden ${gradientClass} ${fallbackClass}`}
                style={heroStyle}
            >
                {bgType === 'image' && <div className="absolute inset-0 bg-black/50"></div>}

                {/* Decorative Circles (only for gradient) */}
                {bgType === 'gradient' && (
                    <>
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-400/20 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2"></div>
                    </>
                )}

                <div className={`max-w-[1800px] mx-auto ${isMobile ? 'px-6' : 'px-8 sm:px-12 lg:px-16'} relative z-10`}>
                    <div className="text-center max-w-4xl mx-auto text-white">
                        <h1 className={`${isMobile ? 'text-3xl' : 'text-5xl sm:text-7xl'} font-black mb-4 tracking-tight drop-shadow-sm`}>
                            {title}
                        </h1>
                        <p className={`${isMobile ? 'text-sm' : 'text-xl'} text-white/90 font-medium ${isMobile ? 'mb-6' : 'mb-10'} leading-relaxed max-w-2xl mx-auto`}>
                            {subtitle}
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                if (typeof onCtaClick === 'function') {
                                    onCtaClick();
                                    return;
                                }
                                document.getElementById('open-positions-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={`${isMobile ? 'px-6 py-2.5 text-sm' : 'px-8 py-3.5 text-lg'} bg-white text-gray-900 rounded-full font-bold shadow-xl hover:shadow-2xl transition-all active:scale-95`}
                        >
                            {ctaText}
                        </button>
                    </div>
                </div>
            </div>

            {/* Floating Search Bar - Connected to Hero */}
            {showSearchBar && !lockSearch && (
                <div className={`relative z-20 ${isMobile ? '-mt-10 px-6' : '-mt-16 px-8 sm:px-12 lg:px-16'}`}>
                    <div className="max-w-[1800px] mx-auto">
                        <div className={`bg-white ${isMobile ? 'p-3 rounded-[1.5rem]' : 'p-5 rounded-[2.5rem]'} shadow-[0_40px_80px_-20px_rgba(0,0,0,0.12)] border border-gray-100`}>
                            <div className="relative group">
                                <Search className={`absolute ${isMobile ? 'left-4' : 'left-6'} top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors`} size={isMobile ? 18 : 24} />
                                <input
                                    type="text"
                                    placeholder="Search jobs..."
                                    value={searchTerm || ''}
                                    onChange={handleSearch}
                                    className={`w-full ${isMobile ? 'pl-10 pr-4 py-3 text-sm' : 'pl-16 pr-8 py-5 text-lg'} bg-gray-50/50 rounded-xl border-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium outline-none text-gray-700 placeholder:text-gray-300`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
