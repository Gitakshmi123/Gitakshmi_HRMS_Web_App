import React from 'react';
import { API_ROOT } from '../../../../utils/api';

export default function CareerBlockCompanyInfo({ content }) {
    const {
        title = "Life at Gitakshmi",
        description = "We believe in creating an environment where everyone can thrive. Our culture is built on transparency, innovation, and mutual respect.",
        imageUrl = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
        stats = [
            { label: "Employees", value: "500+" },
            { label: "Offices", value: "10" },
            { label: "Countries", value: "5" }
        ],
        bgColor = "bg-gray-50"
    } = content || {};

    const getImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/')) return `${API_ROOT}${url}`;
        return url;
    };

    return (
        <section className={`py-24 ${bgColor}`}>
            <div className="max-w-[1800px] mx-auto px-8 sm:px-12 lg:px-16">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <h2 className="text-4xl font-black text-gray-900 mb-6 tracking-tight">{title}</h2>
                        <p className="text-lg text-gray-600 mb-10 leading-relaxed whitespace-pre-line">
                            {description}
                        </p>
                        <div className="grid grid-cols-3 gap-8">
                            {stats.map((stat, idx) => (
                                <div key={idx}>
                                    <div className="text-3xl font-black text-blue-600 mb-1">{stat.value}</div>
                                    <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="relative">
                        <div className="aspect-video rounded-[2rem] overflow-hidden shadow-2xl">
                            <img src={getImageUrl(imageUrl)} alt="Company Culture" className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-blue-600 rounded-3xl -z-10 opacity-10"></div>
                    </div>
                </div>
            </div>
        </section>
    );
}
