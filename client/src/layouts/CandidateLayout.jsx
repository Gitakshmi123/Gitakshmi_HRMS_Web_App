import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/candidate/Header';
import { useJobPortalAuth } from '../context/JobPortalAuthContext';

export default function CandidateLayout() {
    const { candidate } = useJobPortalAuth();
    const [companyName, setCompanyName] = useState('Gitakshmi');

    useEffect(() => {
        if (candidate?.companyName) {
            setCompanyName(candidate.companyName);
        } else {
            const comp = localStorage.getItem('companyName');
            if (comp) setCompanyName(comp);
        }
    }, [candidate]);

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="flex flex-col min-h-screen">
                <Header />

                <main className="flex-1 overflow-x-hidden p-4 lg:p-6">
                    <div className="max-w-[1800px] mx-auto w-full px-4 lg:px-8">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
