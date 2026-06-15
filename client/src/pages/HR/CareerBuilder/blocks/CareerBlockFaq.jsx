import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function CareerBlockFaq({ content }) {
    const { title = "Frequently Asked Questions", faqs = [] } = content || {};

    const defaultFaqs = [
        { question: "What is the recruitment process like?", answer: "Our process typically involves a screening call, technical interview, and a cultural fit round." },
        { question: "Do you offer remote work?", answer: "Yes, we have a flexible work policy that includes remote and hybrid options." },
        { question: "What benefits do you offer?", answer: "We offer comprehensive health insurance, performance bonuses, and continuous learning opportunities." }
    ];

    const displayFaqs = faqs.length > 0 ? faqs : defaultFaqs;
    const [openIdx, setOpenIdx] = useState(0);

    return (
        <section className="py-24 max-w-4xl mx-auto px-8">
            <h2 className="text-4xl font-black text-center text-gray-900 mb-16 tracking-tight">{title}</h2>
            <div className="space-y-4">
                {displayFaqs.map((faq, idx) => (
                    <div key={idx} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                        <button
                            onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                            className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                        >
                            <span className="text-lg font-bold text-gray-900">{faq.question}</span>
                            {openIdx === idx ? <ChevronUp className="text-blue-600" /> : <ChevronDown className="text-gray-400" />}
                        </button>
                        {openIdx === idx && (
                            <div className="px-8 pb-6 text-gray-600 leading-relaxed animate-in fade-in slide-in-from-top-2">
                                {faq.answer}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
