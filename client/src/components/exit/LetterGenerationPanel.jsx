import React, { useState } from 'react';
import { FileText, Printer, Award, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

export default function LetterGenerationPanel({ request }) {
    const [openLetter, setOpenLetter] = useState(null); // 'experience' | 'relieving' | null

    if (!request.lettersGenerated && !request.letters?.experience?.content && !request.letters?.relieving?.content) {
        return null;
    }

    const expLetter = request.letters?.experience;
    const relLetter = request.letters?.relieving;

    const printLetter = (content, title) => {
        const win = window.open('', '_blank');
        win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 24px; }
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:right;margin-bottom:16px;padding:12px;background:#f1f5f9;border-radius:8px;">
    <button onclick="window.print();window.close();" style="padding:8px 20px;background:#0d9488;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:14px;">
      🖨 Print / Download PDF
    </button>
  </div>
  ${content}
</body>
</html>`);
        win.document.close();
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                        <FileText size={17} />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">Generated Letters</h3>
                        <p className="text-blue-100 text-xs mt-0.5">
                            {request.letters?.experience?.generatedAt
                                ? `Generated on ${new Date(request.letters.experience.generatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                : 'Ready to preview & print'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-4">
                {/* Experience Letter */}
                {expLetter?.content && (
                    <LetterCard
                        title="Experience Letter"
                        Icon={Award}
                        color="indigo"
                        content={expLetter.content}
                        isOpen={openLetter === 'experience'}
                        onToggle={() => setOpenLetter(p => p === 'experience' ? null : 'experience')}
                        onPrint={() => printLetter(expLetter.content, 'Experience Letter')}
                    />
                )}

                {/* Relieving Letter */}
                {relLetter?.content && (
                    <LetterCard
                        title="Relieving Letter"
                        Icon={BookOpen}
                        color="indigo"
                        content={relLetter.content}
                        isOpen={openLetter === 'relieving'}
                        onToggle={() => setOpenLetter(p => p === 'relieving' ? null : 'relieving')}
                        onPrint={() => printLetter(relLetter.content, 'Relieving Letter')}
                    />
                )}

                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Printer size={11} /> Click "Print / PDF" to download or print the letters.
                </p>
            </div>
        </div>
    );
}

/* ── Letter Card ──────────────────────────────────────────────────────────── */
function LetterCard({ title, Icon, color, content, isOpen, onToggle, onPrint }) {
    const colors = {
        indigo:   { bg: 'bg-indigo-50 dark:bg-indigo-900/10',   border: 'border-indigo-200 dark:border-indigo-800',   text: 'text-indigo-700 dark:text-indigo-300',   icon: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'   },
    };
    const c = colors[color];

    return (
        <div className={`rounded-xl border ${c.border} overflow-hidden`}>
            {/* Card header */}
            <div className={`flex items-center justify-between px-4 py-3 ${c.bg}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.icon}`}>
                        <Icon size={16} />
                    </div>
                    <span className={`text-sm font-bold ${c.text}`}>{title}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onPrint}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border ${c.border} ${c.text} hover:shadow-sm transition-all`}
                    >
                        <Printer size={12} /> Print / PDF
                    </button>
                    <button onClick={onToggle}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg ${c.bg} ${c.text} hover:opacity-80 transition-opacity`}
                    >
                        {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                </div>
            </div>

            {/* Letter preview */}
            {isOpen && (
                <div className="p-4 bg-white dark:bg-slate-950 overflow-auto max-h-[500px]">
                    <div
                        className="text-slate-800 text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: content }}
                    />
                </div>
            )}
        </div>
    );
}
