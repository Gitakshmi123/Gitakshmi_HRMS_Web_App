import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import './LetterWrapper.css';

/**
 * LetterWrapper Component - SIMPLE TWO-MODE VERSION
 * 
 * MODE 1: LETTER_PAD - Shows letter pad image as full A4 background
 * MODE 2: BLANK - Plain white A4 page
 * 
 * USAGE:
 * <LetterWrapper templateType="LETTER_PAD">
 *   <LetterEditor content={...} />
 * </LetterWrapper>
 */
export default function LetterWrapper({ children, templateType = 'BLANK' }) {
    const [companyProfile, setCompanyProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Only fetch profile if using LETTER_PAD mode
        if (templateType === 'LETTER_PAD') {
            fetchCompanyProfile();
        } else {
            setLoading(false);
        }
    }, [templateType]);

    const fetchCompanyProfile = async () => {
        try {
            const response = await api.get('/letters/company-profile');
            if (response.data) {
                setCompanyProfile(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch company profile:', error);
            // Continue with null profile - show plain white page
        } finally {
            setLoading(false);
        }
    };

    // Extract letter pad image (only if LETTER_PAD mode)
    const branding = companyProfile?.branding || {};
    const letterPadBg = templateType === 'LETTER_PAD' ? (branding.letterheadBg || '') : '';

    // Debug logging
    useEffect(() => {
        if (templateType === 'LETTER_PAD') {
            console.log('🔍 Letter Pad Debug:', {
                templateType,
                hasCompanyProfile: !!companyProfile,
                letterPadUrl: letterPadBg,
                branding: companyProfile?.branding
            });
        }
    }, [templateType, companyProfile, letterPadBg]);

    if (loading && templateType === 'LETTER_PAD') {
        return (
            <div className="letter-wrapper-loading">
                <div className="loading-spinner">Loading letter pad...</div>
            </div>
        );
    }

    return (
        <div 
            className="letter-wrapper-container" 
            style={{ 
                position: 'relative', 
                width: '210mm', 
                height: '297mm',
                minHeight: '297mm',
                maxHeight: '297mm',
                margin: '0 auto',
                background: letterPadBg ? 'transparent' : 'white', // White only if no letter pad
                boxSizing: 'border-box',
                overflow: 'hidden'
            }}
        >
            {/* Letter Pad Background - Only if LETTER_PAD mode and image exists */}
            {templateType === 'LETTER_PAD' && letterPadBg && (
                <div 
                    className="letterhead-background"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 1, // Behind content but visible - CRITICAL for letterhead visibility
                        pointerEvents: 'none', // Don't interfere with text selection
                        backgroundImage: `url(${letterPadBg})`,
                        backgroundSize: 'cover', // Cover full A4 area
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'top center',
                    }}
                />
            )}

            {/* Content Area - Above letter pad (or on blank page) */}
            <div 
                className="letter-content-wrapper"
                style={{ 
                    position: 'relative', 
                    zIndex: 10, // Above letter pad background - content layer
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {children}
            </div>
        </div>
    );
}

