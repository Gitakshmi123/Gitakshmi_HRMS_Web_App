import React from 'react';
import { CheckCircleIcon } from '@heroicons/react/solid';

const BenefitsSection = () => {
    const benefits = [
        { title: 'Work-life balance', description: 'Enjoy a healthy work-life balance.', icon: <CheckCircleIcon className="h-6 w-6 text-green-500" /> },
        { title: 'Growth & learning', description: 'Opportunities for personal and professional growth.', icon: <CheckCircleIcon className="h-6 w-6 text-green-500" /> },
        { title: 'Friendly team culture', description: 'Join a supportive and friendly team.', icon: <CheckCircleIcon className="h-6 w-6 text-green-500" /> },
        { title: 'Modern office', description: 'Work in a modern and comfortable office environment.', icon: <CheckCircleIcon className="h-6 w-6 text-green-500" /> },
        { title: 'Remote flexibility', description: 'Work from home or the office.', icon: <CheckCircleIcon className="h-6 w-6 text-green-500" /> },
        { title: 'Health & wellness', description: 'Comprehensive health and wellness programs.', icon: <CheckCircleIcon className="h-6 w-6 text-green-500" /> },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
            {benefits.map((benefit, index) => (
                <div key={index} className="bg-white rounded-lg shadow-md p-4">
                    {benefit.icon}
                    <h3 className="font-bold mt-2">{benefit.title}</h3>
                    <p className="text-gray-600">{benefit.description}</p>
                </div>
            ))}
        </div>
    );
};

export default BenefitsSection;
