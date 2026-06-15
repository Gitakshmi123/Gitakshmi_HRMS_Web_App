import React from 'react';

/**
 * LetterFooter Component
 * 
 * FIXED FOOTER
 * - Always appears at very bottom of page
 * - Non-editable
 * - Uses company address and contact info from Letter Settings
 * - Positioned fixed to prevent overlap
 */
export default function LetterFooter({ companyProfile }) {
    if (!companyProfile) return null;

    const address = companyProfile.address || {};
    const contactEmail = companyProfile.contactEmail || '';
    const contactPhone = companyProfile.contactPhone || '';
    const website = companyProfile.website || '';
    const cin = companyProfile.cin || '';
    const gstin = companyProfile.gstin || '';

    // Build footer lines
    const footerLines = [];
    if (address.line1) footerLines.push(address.line1);
    if (address.line2) footerLines.push(address.line2);
    if (address.city || address.state || address.pincode) {
        const cityState = [address.city, address.state, address.pincode].filter(Boolean).join(', ');
        if (cityState) footerLines.push(cityState);
    }
    if (address.country && address.country !== 'India') footerLines.push(address.country);

    // Build contact info
    const contactInfo = [];
    if (contactPhone) contactInfo.push(`Tel: ${contactPhone}`);
    if (contactEmail) contactInfo.push(`Email: ${contactEmail}`);
    if (website) contactInfo.push(`Web: ${website}`);
    if (cin) contactInfo.push(`CIN: ${cin}`);
    if (gstin) contactInfo.push(`GSTIN: ${gstin}`);

    if (footerLines.length === 0 && contactInfo.length === 0) return null;

    return (
        <div 
            className="letter-footer"
            style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                width: '210mm',
                zIndex: 10,
                padding: '8mm 20mm',
                background: 'white',
                borderTop: '1px solid #e5e7eb',
                fontSize: '9pt',
                color: '#4b5563',
                lineHeight: 1.4,
                pointerEvents: 'none', // Non-interactive
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Registered Office Address */}
                {footerLines.length > 0 && (
                    <div style={{ marginBottom: '4px' }}>
                        <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: '2px', fontSize: '9pt' }}>
                            Registered Office:
                        </div>
                        {footerLines.map((line, index) => (
                            <div key={index} style={{ margin: '1px 0', fontSize: '9pt' }}>
                                {line}
                            </div>
                        ))}
                    </div>
                )}

                {/* Contact Information */}
                {contactInfo.length > 0 && (
                    <div style={{ 
                        marginTop: '4px', 
                        paddingTop: '4px', 
                        borderTop: '1px solid #e5e7eb',
                        fontSize: '8.5pt'
                    }}>
                        {contactInfo.map((info, index) => (
                            <span key={index} style={{ display: 'inline' }}>
                                {info}
                                {index < contactInfo.length - 1 && ' • '}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

