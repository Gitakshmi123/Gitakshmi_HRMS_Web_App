import React from 'react';
import { Zap, Users, Globe, Star, Heart, Coffee, Shield, Award } from 'lucide-react';

const icons = { Zap, Users, Globe, Star, Heart, Coffee, Shield, Award };

const colorMap = {
    blue:   { bg: 'rgba(59,130,246,0.1)',  icon: '#3B82F6', border: 'rgba(59,130,246,0.2)',  glow: 'rgba(59,130,246,0.15)'  },
    green:  { bg: 'rgba(16,185,129,0.1)',  icon: '#10B981', border: 'rgba(16,185,129,0.2)',  glow: 'rgba(16,185,129,0.15)'  },
    purple: { bg: 'rgba(139,92,246,0.1)',  icon: '#8B5CF6', border: 'rgba(139,92,246,0.2)',  glow: 'rgba(139,92,246,0.15)'  },
    orange: { bg: 'rgba(249,115,22,0.1)',  icon: '#F97316', border: 'rgba(249,115,22,0.2)',  glow: 'rgba(249,115,22,0.15)'  },
    red:    { bg: 'rgba(239,68,68,0.1)',   icon: '#EF4444', border: 'rgba(239,68,68,0.2)',   glow: 'rgba(239,68,68,0.15)'   },
    indigo: { bg: 'rgba(99,102,241,0.1)',  icon: '#6366F1', border: 'rgba(99,102,241,0.2)',  glow: 'rgba(99,102,241,0.15)'  },
};

export default function CareerBlockHighlights({ content, previewMode = 'desktop' }) {
    const isMobile = previewMode === 'mobile';
    const { title = "Why Work With Us?", cards = [] } = content || {};

    const defaultCards = [
        { id: 1, title: "Fast Growth",   description: "Work on cutting-edge technology and accelerate your career trajectory with us.",   icon: "Zap",    color: "blue"   },
        { id: 2, title: "Great Culture", description: "Collaborate with a diverse, highly motivated team in an inclusive environment.",     icon: "Users",  color: "purple" },
        { id: 3, title: "Global Reach",  description: "We operate globally, giving you immense exposure across markets and industries.",   icon: "Globe",  color: "green"  },
        { id: 4, title: "Best Perks",    description: "Competitive salary, health insurance, performance bonuses, and flexible work.",     icon: "Star",   color: "orange" },
    ];

    const displayCards = cards.length > 0 ? cards : defaultCards;

    return (
        <section
            className={`relative w-full ${isMobile ? 'px-5 py-16' : 'px-8 py-28'} overflow-hidden`}
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}
        >
            <style>{`
                @keyframes hl-card-in { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
                @keyframes hl-orb { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.2);opacity:0.7} }
                .hl-card { animation: hl-card-in 0.5s ease both; }
                .hl-card:hover .hl-icon-wrap { transform: scale(1.1) rotate(-5deg); }
                .hl-icon-wrap { transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1); }
                .hl-orb { animation: hl-orb 6s ease-in-out infinite; }
            `}</style>

            {/* Background ambient orbs */}
            <div className="hl-orb absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)' }} />
            <div className="hl-orb absolute bottom-[-80px] right-[-80px] w-[350px] h-[350px] rounded-full blur-[100px] pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)', animationDelay: '2s' }} />
            {/* Dot grid */}
            <div className="absolute inset-0 opacity-[0.035] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                    backgroundSize: '30px 30px'
                }} />

            <div className="relative z-10 max-w-6xl mx-auto">
                {/* Header */}
                <div className={`text-center ${isMobile ? 'mb-12' : 'mb-20'}`}>
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-5">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                        <span className="text-xs font-semibold text-violet-300 tracking-widest uppercase">Our Culture</span>
                    </div>
                    <h2 className={`${isMobile ? 'text-3xl' : 'text-5xl lg:text-6xl'} font-black text-white tracking-tight leading-tight`}>
                        {title}
                    </h2>
                </div>

                {/* Cards Grid */}
                <div className={`grid ${isMobile ? 'grid-cols-1 gap-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'}`}>
                    {displayCards.map((card, idx) => {
                        const Icon = icons[card.icon] || Zap;
                        const cm = colorMap[card.color] || colorMap.blue;
                        return (
                            <div
                                key={card.id || idx}
                                className="hl-card group relative rounded-3xl p-7 cursor-default transition-all duration-300 hover:-translate-y-2"
                                style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    backdropFilter: 'blur(10px)',
                                    animationDelay: `${idx * 0.1}s`
                                }}
                            >
                                {/* Hover glow */}
                                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                    style={{ background: `radial-gradient(circle at 50% 0%, ${cm.glow}, transparent 70%)` }} />

                                <div className="relative z-10">
                                    <div
                                        className="hl-icon-wrap w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
                                        style={{ background: cm.bg, border: `1px solid ${cm.border}` }}
                                    >
                                        <Icon size={26} style={{ color: cm.icon }} />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">{card.title}</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed">{card.description}</p>
                                </div>

                                {/* Corner accent */}
                                <div className="absolute top-4 right-4 w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ background: cm.bg, border: `1px solid ${cm.border}` }}>
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Icon size={12} style={{ color: cm.icon }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
