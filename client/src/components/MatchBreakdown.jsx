import React from 'react';
import { CheckCircle, XCircle, Award, BookOpen, Briefcase, Zap } from 'lucide-react';

const MatchBreakdown = ({ applicant, requirement }) => {
    if (!applicant || !applicant.matchBreakdown) return null;

    const { matchScore, matchBreakdown, matchedSkills = [], missingSkills = [] } = applicant;
    const { skills, experience, education, similarity, preferred } = matchBreakdown;

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-emerald-600';
        if (score >= 50) return 'text-amber-600';
        return 'text-rose-600';
    };

    const getScoreBg = (score) => {
        if (score >= 80) return 'bg-emerald-50 border-emerald-100';
        if (score >= 50) return 'bg-amber-50 border-amber-100';
        return 'bg-rose-50 border-rose-100';
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Zap className="text-purple-500" size={20} />
                    AI Match Analysis
                </h3>
                <div className={`px-3 py-1 rounded-full text-sm font-black border ${getScoreBg(matchScore)} ${getScoreColor(matchScore)}`}>
                    {matchScore}% Overall Match
                </div>
            </div>

            {/* Score Breakdown Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                <ScoreCard title="Skills" score={skills} max={40} icon={<Award size={16} />} />
                <ScoreCard title="Experience" score={experience} max={20} icon={<Briefcase size={16} />} />
                <ScoreCard title="Education" score={education} max={10} icon={<BookOpen size={16} />} />
                <ScoreCard title="Semantic" score={similarity} max={20} icon={<Zap size={16} />} />
                <ScoreCard title="Bonus" score={preferred} max={10} icon={<Award size={16} />} />
            </div>

            {/* Skills Analysis */}
            <div className="space-y-4">
                <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-500" />
                        Matched Skills
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {matchedSkills.length > 0 ? (
                            matchedSkills.map((skill, i) => (
                                <span key={i} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded border border-emerald-100 flex items-center gap-1">
                                    {skill}
                                </span>
                            ))
                        ) : (
                            <span className="text-xs text-slate-400 italic">No direct skill matches found</span>
                        )}
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <XCircle size={14} className="text-rose-500" />
                        Missing Skills
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {missingSkills.length > 0 ? (
                            missingSkills.map((skill, i) => (
                                <span key={i} className="px-2 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded border border-rose-100 flex items-center gap-1">
                                    {skill}
                                </span>
                            ))
                        ) : (
                            <span className="text-xs text-emerald-500 italic">All required skills matched!</span>
                        )}
                    </div>
                </div>
            </div>

            {/* AI Summary */}
            {(applicant.aiParsedData?.summary || applicant.aiParsedData?.experienceSummary) && (
                <div className="mt-5 pt-5 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">AI Summary</h4>
                    <p className="text-sm text-slate-600 italic bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                        "{applicant.aiParsedData.summary || applicant.aiParsedData.experienceSummary}"
                    </p>
                </div>
            )}

        </div>
    );
};

const ScoreCard = ({ title, score, max, icon }) => (
    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-center">
        <div className="text-slate-400 mb-1">{icon}</div>
        <div className="text-xs font-bold text-slate-500 uppercase tracking-tighter">{title}</div>
        <div className="text-lg font-black text-slate-800">
            {score}<span className="text-xs text-slate-400 font-normal">/{max}</span>
        </div>
    </div>
);

export default MatchBreakdown;
