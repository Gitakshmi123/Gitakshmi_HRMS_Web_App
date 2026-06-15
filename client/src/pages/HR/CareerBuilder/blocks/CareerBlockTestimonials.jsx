import React from 'react';
import { Quote } from 'lucide-react';
import { API_ROOT } from '../../../../utils/api';

export default function CareerBlockTestimonials({ content, previewMode = 'desktop' }) {
    const isMobile = previewMode === 'mobile';
    const { title = "Voices of Gitakshmi", testimonials = [], bgColor = "bg-blue-600" } = content || {};

    const defaultTestimonials = [
        { name: "Sarah Johnson", role: "Software Engineer", quote: "The culture here is unmatched. I've grown more in 6 months than I did in 2 years at my previous job.", image: "https://i.pravatar.cc/150?u=sarah" },
        { name: "Michael Chen", role: "Product Manager", quote: "I love how everyone is encouraged to take ownership of their work and innovate.", image: "https://i.pravatar.cc/150?u=michael" },
        { name: "Emily Davis", role: "Design Lead", quote: "Working here gives me the creative freedom I always wanted. The team is incredibly supportive.", image: "https://i.pravatar.cc/150?u=emily" }
    ];

    const displayTestimonials = testimonials.length > 0 ? testimonials : defaultTestimonials;

    const getImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/')) return `${API_ROOT}${url}`;
        return url;
    };

    return (
        <section className={`${isMobile ? 'py-12' : 'py-24'} ${bgColor}`}>
            <div className={`max-w-[1800px] mx-auto ${isMobile ? 'px-6' : 'px-8 sm:px-12 lg:px-16'} text-center`}>
                <h2 className={`${isMobile ? 'text-2xl mb-12' : 'text-4xl mb-20'} font-black text-white tracking-tight`}>{title}</h2>
                <div className={`grid ${isMobile ? 'grid-cols-1 gap-6' : 'grid-cols-1 md:grid-cols-3 gap-8'}`}>
                    {displayTestimonials.map((t, idx) => (
                        <div key={idx} className="bg-white p-8 rounded-[2rem] shadow-xl relative">
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg border-4" style={{ borderColor: bgColor }}>
                                <Quote size={20} style={{ color: bgColor, fill: bgColor }} />
                            </div>
                            <p className="text-gray-600 italic mb-8 pt-4 leading-relaxed">"{t.quote}"</p>
                            <div className="flex items-center justify-center gap-4 border-t border-gray-50 pt-6">
                                <img src={getImageUrl(t.image)} alt={t.name} className="w-12 h-12 rounded-full object-cover border-2 border-gray-50" />
                                <div className="text-left">
                                    <div className="font-bold text-gray-900">{t.name}</div>
                                    <div className="text-xs font-bold uppercase tracking-widest" style={{ color: bgColor }}>{t.role}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
