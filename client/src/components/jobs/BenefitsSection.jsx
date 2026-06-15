import React from 'react';
import { Heart, Zap, Globe, Smile } from 'lucide-react';

const benefits = [
    {
        icon: <Heart className="w-8 h-8 text-rose-500" />,
        title: "Comprehensive Health",
        description: "Full medical, dental, and vision insurance for you and your family."
    },
    {
        icon: <Zap className="w-8 h-8 text-yellow-500" />,
        title: "Performance Bonuses",
        description: "Competitive salaries with annual performance-based bonuses."
    },
    {
        icon: <Globe className="w-8 h-8 text-blue-500" />,
        title: "Remote Friendly",
        description: "Work from anywhere with our flexible remote-first policy."
    },
    {
        icon: <Smile className="w-8 h-8 text-green-500" />,
        title: "Wellness Programs",
        description: "Gym memberships, mental health support, and wellness stipends."
    }
];

const BenefitsSection = () => {
    return (
        <div className="py-24 bg-gray-50 border-t border-gray-100">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">Why Work With Us?</h2>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                        We believe in taking care of our people. Here are just a few of the perks you'll enjoy when you join the team.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {benefits.map((benefit, index) => (
                        <div key={index} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center group border border-gray-100">
                            <div className="mb-6 p-4 bg-gray-50 rounded-2xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-blue-50">
                                {benefit.icon}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">{benefit.title}</h3>
                            <p className="text-gray-500 leading-relaxed">
                                {benefit.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BenefitsSection;
