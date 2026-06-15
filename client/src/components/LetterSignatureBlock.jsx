import React from 'react';

/**
 * LetterSignatureBlock Component
 * 
 * FIXED SIGNATURE BLOCK
 * - Always appears at bottom of page (above footer)
 * - Non-editable
 * - Uses company signatory data from Letter Settings
 * - Positioned fixed to prevent overlap with content
 */
export default function LetterSignatureBlock({ companyProfile }) {
    if (!companyProfile) return null;

    const signatory = companyProfile.signatory || {};
    const companyName = companyProfile.companyName || '';

    return (
        <div 
            className="letter-signature-block"
            style={{
                position: 'absolute',
                bottom: '60mm', // Above footer (footer is ~50mm)
                left: 0,
                right: 0,
                width: '210mm',
                zIndex: 10,
                padding: '0 20mm',
                background: 'white',
                pointerEvents: 'none', // Non-interactive
            }}
        >
            <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '11pt', margin: '0 0 4px 0', color: '#374151' }}>
                    Yours Truly,
                </p>
                <p style={{ fontSize: '11pt', margin: '0 0 16px 0', fontWeight: '600', color: '#1f2937' }}>
                    For {companyName}
                </p>
            </div>

            {/* Signature Image */}
            {signatory.signatureImage && (
                <div style={{ marginBottom: '8px' }}>
                    <img 
                        src={signatory.signatureImage} 
                        alt="Signature" 
                        style={{ 
                            height: '40px', 
                            maxWidth: '200px',
                            objectFit: 'contain'
                        }} 
                    />
                </div>
            )}

            {/* Signatory Details */}
            <div style={{ 
                borderTop: '1px solid #d1d5db', 
                paddingTop: '8px',
                display: 'inline-block',
                minWidth: '200px'
            }}>
                <p style={{ fontSize: '11pt', margin: '0 0 2px 0', fontWeight: '600', color: '#1f2937' }}>
                    {signatory.name || 'Authorized Signatory'}
                </p>
                <p style={{ fontSize: '10pt', margin: 0, color: '#6b7280' }}>
                    {signatory.designation || 'Manager'}
                </p>
            </div>
        </div>
    );
}

