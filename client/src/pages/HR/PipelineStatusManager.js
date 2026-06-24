
export const DEFAULT_PIPELINE = [
    'Applied',
    'Shortlisted',
    'Interview',
    'HR Round',
    'Finalized'
];

export const STAGE_COLORS = {
    'Applied': 'bg-blue-50 text-blue-700 border-blue-100',
    'Shortlisted': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'Interview': 'bg-purple-50 text-purple-700 border-purple-100',
    'HR Round': 'bg-pink-50 text-pink-700 border-pink-100',
    'Finalized': 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'Rejected': 'bg-rose-50 text-rose-700 border-rose-100',
    'default': 'bg-slate-50 text-slate-700 border-slate-100'
};

export const getNextStage = (currentStage, workflow = DEFAULT_PIPELINE) => {
    const idx = workflow.indexOf(currentStage);
    if (idx !== -1 && idx < workflow.length - 1) {
        return workflow[idx + 1];
    }
    return 'Finalized';
};

export const getPreviousStage = (currentStage, workflow = DEFAULT_PIPELINE) => {
    const idx = workflow.indexOf(currentStage);
    if (idx > 0) {
        return workflow[idx - 1];
    }
    return null;
};

export const isTerminalStage = (stage) => {
    return ['Finalized', 'Rejected', 'Selected', 'Offer Issued', 'Offer Expired'].includes(stage);
};


export const INTERVIEW_VARIANTS = ['Interview Scheduled', 'Interview Rescheduled', 'Interview Completed', 'New Round'];

export const normalizeStatus = (status) => {
    if (!status) return 'Applied';
    const s = String(status).trim();
    const sl = s.toLowerCase();

    if (INTERVIEW_VARIANTS.map(v => v.toLowerCase()).includes(sl) || sl === 'interview') return 'Interview';
    
    const finalizedAliases = [
        'offer issued', 'offer expired', 'offer letter issued', 'offer generated', 
        'salary assigned', 'selected', 'joining letter issued', 'joining letter signed', 'joining letter accepted', 
        'offer accepted – awaiting company approval', 'fully signed', 'finalized', 'hired', 'joined', 'active',
        'document requested', 'document draft saved', 'profile submitted', 'document verification pending', 'resubmitted', 'reupload required'
    ];
    if (finalizedAliases.includes(sl)) return 'Finalized';
    
    if (sl === 'applied') return 'Applied';
    if (sl === 'shortlisted') return 'Shortlisted';
    if (sl === 'rejected' || sl === 'withdrawn') return 'Rejected';
    if (sl === 'hr round') return 'HR Round';

    // Capitalize first letter as fallback for unknown stages to match tab names
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

export const getStageColor = (stage) => {
    return STAGE_COLORS[stage] || STAGE_COLORS['default'];
};
