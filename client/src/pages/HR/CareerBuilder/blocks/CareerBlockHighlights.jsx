import React from 'react';
import { Zap, Users, Globe, Star, Heart, Coffee, Shield, Award } from 'lucide-react';

const icons = {
    Zap, Users, Globe, Star, Heart, Coffee, Shield, Award
};

export default function CareerBlockHighlights({ content, previewMode = 'desktop' }) {
    const isMobile = previewMode === 'mobile';
    const { title = "Why Work With Us?", cards = [] } = content || {};

    const defaultCards = [
        { id: 1, title: "Fast Growth", description: "Opportunity to work on cutting-edge tech and grow rapidly.", icon: "Zap", color: "blue" },
        { id: 2, title: "Great Culture", description: "Work with a diverse and highly motivated team.", icon: "Users", color: "green" },
        { id: 3, title: "Global Reach", description: "We operate globally, giving you immense exposure.", icon: "Globe", color: "purple" },
        { id: 4, title: "Best Perks", description: "Competitive salary, insurance, and performance bonuses.", icon: "Star", color: "orange" }
    ];

    const displayCards = cards.length > 0 ? cards : defaultCards;

    const colorClasses = {
        blue: "bg-blue-50 text-blue-600",
        green: "bg-green-50 text-green-600",
        purple: "bg-purple-50 text-purple-600",
        orange: "bg-orange-50 text-orange-600",
        red: "bg-red-50 text-red-600",
        indigo: "bg-blue-50 text-blue-600"
    };

    return (
        <section className={`max-w-[1800px] mx-auto ${isMobile ? 'px-6 py-16' : 'px-8 sm:px-12 lg:px-16 py-32'} text-center`}>
            <h2 className={`${isMobile ? 'text-3xl mb-12' : 'text-5xl mb-20'} font-black text-gray-900 tracking-tight`}>{title}</h2>
            <div className={`grid ${isMobile ? 'grid-cols-1 gap-10' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12'}`}>
                {displayCards.map((card, idx) => {
                    const Icon = icons[card.icon] || Zap;
                    return (
                        <div key={card.id || idx} className="space-y-4">
                            <div className={`w-16 h-16 ${colorClasses[card.color] || colorClasses.blue} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
                                <Icon size={32} />
                            </div>
                            <h3 className="text-xl font-bold">{card.title}</h3>
                            <p className="text-gray-500 text-sm leading-relaxed">{card.description}</p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
