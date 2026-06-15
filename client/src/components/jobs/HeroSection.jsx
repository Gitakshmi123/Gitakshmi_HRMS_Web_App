import React from 'react';

const HeroSection = ({ companyName }) => {
    return (
        <div className="w-full bg-gradient-to-r from-blue-600 to-purple-600 py-16 px-4 md:px-0 text-center text-white overflow-hidden relative">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -translate-x-20 -translate-y-20 animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl translate-x-20 translate-y-20 animate-pulse delay-1000"></div>

            <div className="relative z-10 max-w-[1600px] mx-auto flex flex-col items-center justify-center space-y-6 px-6">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                    {companyName ? `${companyName} Careers` : 'Careers'}
                </h1>
                <p className="text-lg md:text-xl text-blue-50 font-medium max-w-2xl leading-relaxed">
                    Join our team and build your future with us. We are looking for passionate individuals to help us shape the future.
                </p>
                <div className="pt-4">
                    <button
                        onClick={() => document.getElementById('open-positions')?.scrollIntoView({ behavior: 'smooth' })}
                        className="px-8 py-3 bg-white text-blue-700 font-bold rounded-full shadow-lg hover:shadow-2xl hover:bg-gray-50 transform hover:-translate-y-1 transition-all duration-300 text-base"
                    >
                        View Open Positions
                    </button>
                </div>

            </div>
        </div>
    );
};

export default HeroSection;
