import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { ArrowLeft, Download, Eye } from 'lucide-react';

export default function TemplatePreview() {
    const { templateId } = useParams();
    const navigate = useNavigate();
    const [template, setTemplate] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (templateId) {
            loadTemplateAndGeneratePDF();
        }
    }, [templateId]);

    const loadTemplateAndGeneratePDF = async () => {
        try {
            setLoading(true);
            setError(null);

            // First get template details
            const templateResponse = await api.get(`/letters/templates/${templateId}`);
            const templateData = templateResponse.data;
            setTemplate(templateData);

            // Check template type - only WORD templates support PDF preview
            if (templateData.templateType === 'WORD') {
                // Check if file is available
                if (templateData.hasFile === false) {
                    const fileError = templateData.fileError || 'Template file not found';
                    setError(`Cannot preview: ${fileError}. Please re-upload the template.`);
                    setLoading(false);
                    return;
                }

                // Get the PDF preview for WORD templates
                try {
                    const pdfResponse = await api.get(`/letters/templates/${templateId}/preview-pdf`, {
                        responseType: 'blob',
                        timeout: 180000 // 60 second timeout for PDF conversion
                    });

                    // Verify response is actually a PDF
                    if (pdfResponse.data && pdfResponse.data.size > 0) {
                        const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
                        const url = window.URL.createObjectURL(blob);
                        setPdfUrl(url);
                    } else {
                        throw new Error('PDF preview is empty');
                    }
                } catch (pdfError) {
                    console.error('PDF preview error:', pdfError);
                    const errorMessage = pdfError.response?.data?.message ||
                        pdfError.message ||
                        'Failed to generate PDF preview. Please ensure LibreOffice is installed on the server.';
                    setError(errorMessage);
                }
            } else {
                // HTML templates (BLANK, LETTER_PAD) - show HTML preview instead
                setError('HTML templates cannot be previewed as PDF. Please use the template editor to view HTML templates.');
            }

        } catch (error) {
            console.error('Template load error:', error);
            const errorMessage = error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                'Failed to load template. Please try again.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        // Only allow download for WORD templates
        if (template?.templateType !== 'WORD') {
            alert('Download is only available for WORD templates.');
            return;
        }

        if (template?.hasFile === false) {
            alert('Template file is missing. Please re-upload the template.');
            return;
        }

        try {
            const response = await api.get(`/letters/templates/${templateId}/download-pdf`, {
                responseType: 'blob',
                timeout: 180000 // 60 second timeout for PDF conversion
            });

            // Create download link
            if (response.data && response.data.size > 0) {
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${template?.name || 'template'}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Clean up the blob URL
                window.URL.revokeObjectURL(url);
            } else {
                throw new Error('Downloaded file is empty');
            }
        } catch (error) {
            console.error('Download error:', error);
            const errorMessage = error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                'Failed to download PDF';
            alert(`Failed to download PDF: ${errorMessage}`);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Synchronizing Preview...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl p-10 max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto border border-rose-100">
                        <ArrowLeft className="text-rose-500" size={32} />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Sync Failure</h2>
                        <p className="text-sm text-slate-400 mt-2 italic">{error}</p>
                    </div>
                    <button
                        onClick={() => navigate('/hr/letter-templates')}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all active:scale-95"
                    >
                        Back to Blueprint Registry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-8 py-6 sticky top-0 z-30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate('/hr/letter-templates')}
                            className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-indigo-100 rounded-2xl transition-all group"
                        >
                            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div className="h-10 w-px bg-slate-100"></div>
                        <div>
                            <h1 className="text-2xl font-medium text-slate-900 tracking-tight">
                                {template?.name || 'Blueprint Preview'}
                            </h1>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{template?.type} Layer</span>
                                <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{template?.templateType} Blueprint</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {template?.templateType === 'WORD' && template?.hasFile !== false && (
                            <button
                                onClick={handleDownload}
                                className="px-8 py-3 bg-[#4F46E5] hover:bg-[#0D9488] text-white rounded-2xl font-bold text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-lg shadow-indigo-500/20 active:scale-95"
                            >
                                <Download size={18} />
                                Download PDF Record
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 p-8 overflow-auto">
                {pdfUrl ? (
                    <div className="max-w-[1000px] mx-auto bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden ring-1 ring-slate-200/50">
                        <iframe
                            src={pdfUrl}
                            className="w-full h-[calc(100vh-220px)] border-0"
                            title="Blueprint Preview"
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-lg">
                        <div className="text-center text-slate-500">
                            <Eye size={48} className="mx-auto mb-4 opacity-50" />
                            <p>PDF preview not available</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
