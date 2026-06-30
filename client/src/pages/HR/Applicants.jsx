/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useRef, useMemo } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import api, { API_ROOT } from '../../utils/api'; // Centralized axios instance with auth & tenant headers
import { getNextStage, normalizeStatus } from './PipelineStatusManager';
import { useAuth } from '../../context/AuthContext';
import MatchBreakdown from '../../components/MatchBreakdown';

import InitialCompensationModal from '../../components/Compensation/InitialCompensationModal';
import { DatePicker, Pagination, Select, Modal, TimePicker, Dropdown, Menu } from 'antd';
import { showToast, showConfirmToast } from '../../utils/uiNotifications'; // Imports fixed
import dayjs from 'dayjs';
import { List, Eye, Download, Edit2, RefreshCw, IndianRupee, Upload, FileText, CheckCircle, Settings, Plus, Trash2, X, GripVertical, Star, XCircle, Clock, ShieldCheck, Lock, ChevronRight, ChevronDown, RotateCcw, UserCheck, UserX, PlusCircle, UserPlus, Info, Search, Calendar, Shield, Layout, Briefcase, Mail, Zap, Link, MessageSquare, Users, Phone, MapPin, Building2, Activity, AlertCircle } from 'lucide-react';
import JobBasedBGVModal from './modals/JobBasedBGVModal';
import StageFeedbackModal from './modals/StageFeedbackModal';
import PipelineManagerModal from './modals/PipelineManagerModal';
import InterviewScheduleModal from './modals/InterviewScheduleModal';
import { notification } from '../../utils/antdGlobal';
import usePagePermissions from '../../hooks/usePagePermissions';
import { Can } from '../../components/rbac/PermissionGate';
import OfferLetterPreview from '../../components/OfferLetterPreview';

/**
 * Internal vs external HR pipeline. Uses applicant.source when set; also detects legacy internal applies
 * where `source` was not stored (Applicant schema lacked the field → Mongoose stripped it).
 */
function applicantMatchesInternalPipeline(a) {
    if (!a) return false;
    if (a.source === 'Internal') return true;
    
    // Treat referred candidates as part of the internal tracking/pipeline
    if (a.referral?.referrerEmployeeId) return true;

    const vis = a.requirementId?.visibility;
    if (vis === 'Internal') return true;
    if (typeof a.intro === 'string' && a.intro.includes('Internal Application')) return true;
    if (Array.isArray(a.timeline)) {
        return a.timeline.some(
            (t) => typeof t?.message === 'string' && t.message.includes('Internal Channel')
        );
    }
    return false;
}

const toDisplayDate = (dateVal, formatStr = 'Do MMM. YYYY') => {
    if (!dateVal) return '';
    const d = dayjs(dateVal);
    if (!d.isValid()) return '';
    
    let res = formatStr;
    if (res.includes('Do')) {
        const dayNum = d.date();
        let suffix = 'th';
        if (dayNum % 10 === 1 && dayNum % 100 !== 11) suffix = 'st';
        else if (dayNum % 10 === 2 && dayNum % 100 !== 12) suffix = 'nd';
        else if (dayNum % 10 === 3 && dayNum % 100 !== 13) suffix = 'rd';
        res = res.replace('Do', `${dayNum}[${suffix}]`);
    }
    return d.format(res);
};

const getDatePickerFormat = (formatStr) => {
    if (formatStr && (formatStr.includes('Do') || formatStr.includes('.'))) {
        return (val) => toDisplayDate(val, formatStr);
    }
    return formatStr || 'DD-MM-YYYY';
};

const formatExperienceValue = (value) => {
    if (value === null || value === undefined || value === '') return '0 Years';
    const text = String(value).trim();
    return /year|month/i.test(text) ? text : `${text} Years`;
};

const formatNoticePeriodValue = (value) => {
    if (value === true) return 'Yes';
    if (value === false || value === null || value === undefined || value === '') return 'No';
    return String(value).trim();
};

const STANDARD_OFFER_VARIABLES = new Set([
    'employee_name', 'candidate_name', 'name', 'applicant_name', 'father_name', 'father_names',
    'relation_type', 'relationtype', 'relationship_type', 'relationship',
    'designation', 'job_title', 'department', 'grade', 'grade_name', 'grade_code', 'grade_level',
    'joining_date', 'joiningdate', 'location', 'work_location', 'address', 'candidate_address',
    'offer_ref_no', 'ref_no', 'refno', 'ref_code', 'reference_number', 'reference_no', 'ref',
    'issued_date', 'issueddate', 'issue_date', 'current_date', 'today', 'date', 'date_odt',
    'dear_name', 'dearname', 'signature', 'candidate_signature', 'company_name', 'candidate_email',
    'email', 'mobile', 'phone', 'date_of_birth', 'candidate_title', 'title', 'probation', 'probation_period',
    'probration'
]);

const normalizeVariableKey = (value) => String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const humanizeVariableKey = (value) => {
    const key = normalizeVariableKey(value);
    if (!key) return 'Custom Field';
    return key.split('_').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

const RELATION_TYPE_OPTIONS = ['S/O', 'D/O', 'W/O', 'P/O', 'G/O'];

const normalizeOfferRelationType = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (RELATION_TYPE_OPTIONS.includes(normalized)) return normalized;
    const legacyMap = {
        FATHER: 'S/O',
        MOTHER: 'D/O',
        HUSBAND: 'W/O',
        WIFE: 'W/O',
        GUARDIAN: 'G/O',
        OTHER: 'P/O'
    };
    return legacyMap[normalized] || 'S/O';
};

const inferOfferTitle = (applicant, currentTitle = '') => {
    if (currentTitle) return currentTitle;
    const gender = String(applicant?.gender || applicant?.metadata?.gender || '').trim().toLowerCase();
    if (gender === 'male' || gender === 'm') return 'Mr.';
    if (gender === 'female' || gender === 'f') return 'Ms.';
    return '';
};

const PDF_VIEWER_HASH = '#toolbar=0&navpanes=0&scrollbar=0';

const normalizeOfferPreviewFilePath = (value) => {
    let raw = String(value || '').trim();
    if (!raw) return '';

    try {
        if (/^https?:\/\//i.test(raw)) {
            raw = new URL(raw).pathname;
        }
    } catch (_) {
        // Keep the raw response value if it is not a valid absolute URL.
    }

    raw = raw.split('#')[0].split('?')[0].replace(/\\/g, '/').replace(/^\/+/, '');
    if (raw.toLowerCase().startsWith('api/letters/preview-file')) {
        const queryPath = String(value || '').match(/[?&]path=([^&]+)/)?.[1];
        return queryPath ? decodeURIComponent(queryPath) : '';
    }
    if (raw.toLowerCase().startsWith('uploads/')) {
        raw = raw.slice('uploads/'.length);
    }

    return raw;
};

const revokeObjectPreviewUrl = (value) => {
    const raw = String(value || '').split('#')[0];
    if (typeof window !== 'undefined' && raw.startsWith('blob:')) {
        window.URL.revokeObjectURL(raw);
    }
};

/**
 * Builds a flat map of salary template variables from a salary snapshot.
 * Maps earnings/deductions/benefits items to keys like:
 *   salary.minimum_wage.monthly, salary.hra.monthly, salary.gross.monthly etc.
 * Also exposes salary.ctc, salary.ctc_monthly etc.
 */
const buildSalaryVarsFromSnapshot = (snapshot) => {
    if (!snapshot) return {};
    const vars = {};
    const safeNum = (v) => {
        const n = Number(v);
        return isNaN(n) ? 0 : Math.round(n);
    };
    const toKey = (name) => normalizeVariableKey(name);

    // Top-level CTC
    if (snapshot.ctc)       { vars['salary_ctc'] = safeNum(snapshot.ctc);       vars['salary_ctc_yearly'] = safeNum(snapshot.ctc); }
    if (snapshot.monthlyCTC){ vars['salary_ctc_monthly'] = safeNum(snapshot.monthlyCTC); }

    // Earnings
    (snapshot.earnings || []).forEach(item => {
        const name = item.name || item.code || '';
        if (!name) return;
        const k = toKey(name);
        vars[`salary_${k}_monthly`] = safeNum(item.monthlyAmount);
        vars[`salary_${k}_yearly`]  = safeNum(item.yearlyAmount);
        // also expose without salary_ prefix with dot notation style key
        vars[`salary.${k}.monthly`] = safeNum(item.monthlyAmount);
        vars[`salary.${k}.yearly`]  = safeNum(item.yearlyAmount);
    });

    // Employee Deductions
    (snapshot.employeeDeductions || []).forEach(item => {
        const name = item.name || item.code || '';
        if (!name) return;
        const k = toKey(name);
        vars[`salary_${k}_monthly`] = safeNum(item.monthlyAmount);
        vars[`salary_${k}_yearly`]  = safeNum(item.yearlyAmount);
        vars[`salary.${k}.monthly`] = safeNum(item.monthlyAmount);
        vars[`salary.${k}.yearly`]  = safeNum(item.yearlyAmount);
    });

    // Benefits / Employer deductions
    (snapshot.benefits || []).forEach(item => {
        const name = item.name || item.code || '';
        if (!name) return;
        const k = toKey(name);
        vars[`salary_${k}_monthly`] = safeNum(item.monthlyAmount);
        vars[`salary_${k}_yearly`]  = safeNum(item.yearlyAmount);
        vars[`salary.${k}.monthly`] = safeNum(item.monthlyAmount);
        vars[`salary.${k}.yearly`]  = safeNum(item.yearlyAmount);
    });

    // Aggregated totals from breakdown/summary
    const bd = snapshot.breakdown || snapshot.summary || {};
    if (bd.totalEarnings  !== undefined) { vars['salary_gross_monthly'] = safeNum(bd.totalEarnings);   vars['salary.gross.monthly'] = safeNum(bd.totalEarnings); }
    if (bd.totalDeductions!== undefined) { vars['salary_total_deductions_monthly'] = safeNum(bd.totalDeductions); }
    if (bd.netPay        !== undefined) { vars['salary_take_home_monthly'] = safeNum(bd.netPay); vars['salary.take_home.monthly'] = safeNum(bd.netPay); }
    // Yearly gross/net estimate
    if (bd.totalEarnings  !== undefined) { vars['salary_gross_yearly'] = safeNum(bd.totalEarnings * 12);  vars['salary.gross.yearly'] = safeNum(bd.totalEarnings * 12); }
    if (bd.netPay        !== undefined) { vars['salary_take_home_yearly'] = safeNum(bd.netPay * 12);  vars['salary.take_home.yearly'] = safeNum(bd.netPay * 12); }

    return vars;
};

/**
 * Given a candidate/applicant object, resolve salary snapshot for letter generation.
 */
const resolveSalarySnapshot = (applicant) => {
    if (!applicant) return null;
    if (typeof applicant.salarySnapshotId === 'object' && applicant.salarySnapshotId !== null) {
        return applicant.salarySnapshotId;
    }
    return applicant.salarySnapshot || null;
};

const isOfferAutoFieldKey = (key) => {
    const normalized = String(key || '').toLowerCase();
    
    // Do not hide surname fields so the user can edit them manually
    if (normalized.includes('surname') || normalized.includes('last_name') || normalized.includes('lastname')) {
        return false;
    }

    return (
        normalized.includes('name') || normalized.includes('vandidate') || normalized.includes('cvandidate') ||
        normalized.includes('email') ||
        normalized.includes('phone') || normalized.includes('mobile') || normalized.includes('contact') || normalized.includes('phon_no') ||
        normalized.includes('designation') || normalized.includes('position') || normalized.includes('job_title') || normalized.includes('desingnation') ||
        normalized.includes('joining_date') ||
        normalized.includes('addres') || normalized.includes('location') ||
        normalized.includes('relation_type') || normalized.includes('relationship_type') || normalized === 'relationship' ||
        normalized.includes('ref_no') || normalized.includes('reference_no') ||
        normalized.includes('issue_date') || normalized.includes('isue_date') || normalized.includes('isuedate') ||
        normalized.includes('candidate_title') || normalized.includes('title') ||
        normalized.includes('probation') || normalized.includes('probration') ||
        normalized.startsWith('salary') || normalized.startsWith('salary.')
    );
};

const buildOfferCustomData = (data) => ({
    ...(data.customData || {}),
    candidate_name: data.name || '',
    employee_name: data.name || '',
    name: data.name || '',
    dear_name: data.dearName || data.name || '',
    relation_type: normalizeOfferRelationType(data.relationType),
    relationType: normalizeOfferRelationType(data.relationType),
    relationship_type: normalizeOfferRelationType(data.relationType),
    relationship: normalizeOfferRelationType(data.relationType),
    candidate_title: data.salutation || '',
    candidateTitle: data.salutation || '',
    title: data.salutation || '',
    probation: data.probationPeriod || '',
    probation_period: data.probationPeriod || '',
    probationPeriod: data.probationPeriod || '',
    email: data.email || '',
    candidate_email: data.email || '',
    mobile: data.mobile || '',
    phone: data.mobile || '',
    contact: data.mobile || '',
    contact_no: data.mobile || '',
    contactNo: data.mobile || '',
    address: data.address || '',
    candidate_address: data.address || '',
    candidate_addres: data.address || '',
    addres: data.address || '',
    location: data.location || '',
    work_location: data.location || '',
    designation: data.position || '',
    position: data.position || '',
    issue_date: toDisplayDate(data.issueDate, data.dateFormat),
    issued_date: toDisplayDate(data.issueDate, data.dateFormat),
    isue_date: toDisplayDate(data.issueDate, data.dateFormat),
    current_date: toDisplayDate(data.issueDate, data.dateFormat),
    joining_date: toDisplayDate(data.joiningDate, data.dateFormat),
    ref_no: data.refNo || '',
    reference_no: data.refNo || '',
    ...buildSalaryVarsFromSnapshot(data.salarySnapshot)
});

const buildJoiningCustomData = ({
    customData = {},
    applicant,
    refNo,
    issueDate,
    expiryAt,
    salutation = '',
    relationType = 'S/O',
    probationPeriod = '',
    name = '',
    dearName = '',
    joiningDate = '',
    dateFormat = 'Do MMM. YYYY'
}) => ({
    ...(customData || {}),
    candidate_name: name || applicant?.name || '',
    employee_name: name || applicant?.name || '',
    name: name || applicant?.name || '',
    dear_name: dearName || name || applicant?.name || '',
    father_name: applicant?.fatherName || '',
    email: applicant?.email || '',
    candidate_email: applicant?.email || '',
    mobile: applicant?.mobile || applicant?.phone || '',
    phone: applicant?.mobile || applicant?.phone || '',
    contact_no: applicant?.mobile || applicant?.phone || '',
    address: applicant?.address || applicant?.currentAddress || '',
    candidate_address: applicant?.address || applicant?.currentAddress || '',
    candidate_addres: applicant?.address || applicant?.currentAddress || '',
    addres: applicant?.address || applicant?.currentAddress || '',
    designation: applicant?.requirementId?.jobTitle || applicant?.designation || '',
    position: applicant?.requirementId?.jobTitle || applicant?.designation || '',
    department: applicant?.requirementId?.department?.name || applicant?.department || '',
    joining_date: toDisplayDate(joiningDate || applicant?.joiningDate, dateFormat),
    location: applicant?.location || applicant?.workLocation || '',
    work_location: applicant?.location || applicant?.workLocation || '',
    ref_no: refNo || '',
    reference_no: refNo || '',
    issue_date: toDisplayDate(issueDate, dateFormat),
    issued_date: toDisplayDate(issueDate, dateFormat),
    isue_date: toDisplayDate(issueDate, dateFormat),
    current_date: toDisplayDate(issueDate, dateFormat),
    expiry_date: toDisplayDate(expiryAt, dateFormat),
    relation_type: normalizeOfferRelationType(relationType),
    candidate_title: salutation || '',
    title: salutation || '',
    probation: probationPeriod || '',
    probation_period: probationPeriod || '',
    ...buildSalaryVarsFromSnapshot(resolveSalarySnapshot(applicant))
});

const normalizeTemplateCustomFields = (template) => {
    const seen = new Set();
    const fields = [];
    const addField = (field) => {
        const key = normalizeVariableKey(field?.key || field?.label || field);
        if (!key || seen.has(key)) return;
        seen.add(key);
        fields.push({
            key,
            label: field?.label || humanizeVariableKey(key),
            type: ['text', 'textarea', 'date', 'number', 'email', 'phone'].includes(field?.type) ? field.type : 'text',
            required: !!field?.required,
            placeholder: field?.placeholder || `Enter ${field?.label || humanizeVariableKey(key)}`
        });
    };

    (template?.customFields || []).forEach(addField);
    (template?.placeholders || []).forEach((placeholder) => {
        const key = normalizeVariableKey(placeholder);
        if (!key || STANDARD_OFFER_VARIABLES.has(key) || /_(monthly|yearly|annual)$/.test(key)) return;
        addField({ key, label: humanizeVariableKey(key) });
    });
    return fields;
};

const formatApplicantValue = (value) => {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    if (value instanceof Date) return dayjs(value).format('DD MMM YYYY');
    if (typeof value === 'object') {
        if (value.originalName) return value.originalName;
        if (value.fileName) return value.fileName;
        if (value.label) return value.label;
        if (value.name) return value.name;
        return JSON.stringify(value);
    }
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(text) && dayjs(text).isValid()) return dayjs(text).format('DD MMM YYYY');
    return text;
};

const getApplicantCustomEntries = (applicant, limit = 8) => {
    const standard = new Set([
        'name', 'email', 'mobile', 'phone', 'resume', 'consent', 'requirementid', 'tenantid',
        'fathername', 'dob', 'address', 'experience', 'currentcompany', 'currentdesignation',
        'currentctc', 'expectedctc', 'noticeperiod', 'linkedin', 'location', 'worklocation'
    ]);

    return Object.entries(applicant?.customData || {})
        .map(([key, value]) => ({
            key,
            label: humanizeVariableKey(key),
            value: formatApplicantValue(value),
            rawValue: value
        }))
        .filter(item => item.value && !standard.has(normalizeVariableKey(item.key).replace(/_/g, '')))
        .slice(0, limit);
};

const getApplicantSummaryFields = (applicant) => ([
    { label: 'Mobile', value: applicant?.mobile || applicant?.phone },
    { label: 'Experience', value: applicant?.experience ? `${applicant.experience}${String(applicant.experience).toLowerCase().includes('year') ? '' : ' Years'}` : '' },
    { label: 'Current Role', value: applicant?.currentDesignation },
    { label: 'Company', value: applicant?.currentCompany },
    { label: 'Current CTC', value: applicant?.currentCTC },
    { label: 'Expected CTC', value: applicant?.expectedCTC },
    { label: 'Notice', value: typeof applicant?.noticePeriod === 'boolean' ? (applicant.noticePeriod ? 'Yes' : 'No') : applicant?.noticePeriod },
    { label: 'Location', value: applicant?.workLocation || applicant?.location },
    { label: 'DOB', value: applicant?.dob ? dayjs(applicant.dob).format('DD MMM YYYY') : '' }
]).filter(item => item.value);

export default function Applicants({ internalMode = false, jobSpecific = false }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { jobId } = useParams(); // Get jobId from URL if in job-specific mode
    const permissionKey = internalMode ? 'hiring.internal' : 'hiring.external';
    const { canView, canCreate, canEdit, canDelete, loading: permLoading } = usePagePermissions(permissionKey);

    const hrPrefix = useMemo(
        () => (location.pathname.startsWith('/tenant/') ? '/tenant' : (location.pathname.startsWith('/employee/') ? '/employee' : '/hr')),
        [location.pathname]
    );
    const inEmployeePanel = location.pathname.startsWith('/employee/');
    const applicantsBasePath = internalMode ? `${hrPrefix}/internal-applicants` : `${hrPrefix}/applicants`;
    const jobCandidatesPath = (reqId) => {
        const id = String(reqId?._id || reqId || '');
        if (id === '[object Object]') {
            console.error('CRITICAL: jobCandidatesPath received [object Object]');
        }
        return internalMode
            ? `${hrPrefix}/internal-applicants/job/${id}/candidates`
            : `${hrPrefix}/job/${id}/candidates`;
    };
    const [applicants, setApplicants] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [emailTemplates, setEmailTemplates] = useState([]);

    const [resumeUrl, setResumeUrl] = useState(null);
    const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    // Check if we're in "show all candidates" mode (via path or query param)
    const searchParams = new URLSearchParams(location.search);
    const showAllCandidates = location.pathname.endsWith('/all') || searchParams.get('view') === 'all';

    // ───────────────────────────────────────────────────────────────
    // Strict Hiring Workflow (No UI redesign; only gating/guards)
    // Maps existing Applicant statuses to strict pipeline rules.
    // ───────────────────────────────────────────────────────────────
    const isInterviewStage = (app) => {
        const s = String(app?.status || '');
        return (
            s === 'Interview' ||
            s === 'Interview Scheduled' ||
            s === 'Interview Rescheduled' ||
            s === 'Interview Completed' ||
            s === 'HR Round' ||
            // Legacy pipeline: "Selected" means interview cleared / ready to issue offer
            s === 'Selected' ||
            s.includes('Round') ||
            s.includes('Interview')
        );
    };

    const isOfferPendingStage = (app) => {
        const s = String(app?.status || '');
        return s === 'Offer Issued' || (app?.offerStatus === 'SENT' && !!app?.offerLetterPath);
    };

    const isOfferAcceptedStage = (app) => {
        const s = String(app?.status || '');
        return s === 'Offer Accepted' || s === 'Offer Accepted – Awaiting Company Approval' || app?.offerStatus === 'ACCEPTED';
    };

    const isOfferSignedStage = (app) => {
        const s = String(app?.status || '');
        return s === 'Fully Signed' || app?.offerStatus === 'SIGNED';
    };

    const isJoiningIssuedStage = (app) => {
        const s = String(app?.status || '');
        return s === 'Joining Letter Issued' || !!app?.joiningLetterPath;
    };

    const canGenerateOffer = (app) => {
        const status = String(app?.status || '');
        if (isOfferPendingStage(app) || isOfferAcceptedStage(app) || isOfferSignedStage(app)) return false;
        
        // Allow generating offer if they are finalized/selected OR if documents are submitted/approved
        const stage = String(app?.currentStage?.stageName || '').toLowerCase();
        if (status === 'Finalized' || status === 'Selected' || stage === 'finalized') return true;
        if (app?.documentRequestStatus === 'Submitted' || app?.documentRequestStatus === 'Approved') return true;
        
        // Fallback for candidates who bypassed the external onboarding flow
        const hasApprovedDraft = Boolean(app?.employeeId) && ['Draft Employee', 'Document Verified', 'Profile Approved'].includes(status);
        return hasApprovedDraft;
    };

    const canSendDocuments = (app) => {
        const status = String(app?.status || '');
        const stage = String(app?.currentStage?.stageName || '').toLowerCase();
        
        // Allow sending document request at Finalized or anywhere during the Offer stage
        const isEligibleStage = status === 'Finalized' || status === 'Selected' || stage === 'finalized' || 
                                isOfferPendingStage(app) || isOfferAcceptedStage(app) || isOfferSignedStage(app);
                                
        return isEligibleStage
            && !app?.employeeId
            && !['Document Requested', 'Document Draft Saved', 'Profile Submitted', 'Draft Employee'].includes(status);
    };

    const canIssueJoining = (app) => {
        // Strict: only after OFFER_SIGNED (Fully Signed)
        if (!isOfferSignedStage(app)) return false;
        // Prevent duplicates
        if (isJoiningIssuedStage(app)) return false;
        return true;
    };

    const canMarkJoined = (app) => {
        const isJoiningAccepted = ['ACCEPTED', 'SIGNED'].includes(String(app?.joiningLetterStatus || '').toUpperCase());
        const isOfferAccepted = ['ACCEPTED', 'SIGNED'].includes(String(app?.offerStatus || '').toUpperCase());
        
        // Allow onboarding if either Joining Letter is signed OR Offer is fully signed
        return isJoiningAccepted || isOfferAccepted;
    };


    const [requirements, setRequirements] = useState([]);
    const [selectedRequirement, setSelectedRequirement] = useState(null); // Full requirement object
    const [selectedReqId, setSelectedReqId] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [timeFilter, setTimeFilter] = useState('all'); // Added Time Filter State
    const [jobTypeFilter, setJobTypeFilter] = useState('all'); // Added Job Type Filter

    // Tab State: Dynamic based on Requirement Workflow
    // Start with default tabs for 'all' view
    const [activeTab, setActiveTab] = useState('Applied');
    const [workflowTabs, setWorkflowTabs] = useState(['Applied', 'Shortlisted', 'Interview', 'HR Round', 'Finalized', 'Rejected']);
    const roleName = String(
        user?.roleName || (user?.role && typeof user.role === 'object' ? user.role.name : user?.role) || ''
    ).toLowerCase();
    const isPrivilegedHiringUser = [
        'hr',
        'admin',
        'company_super_admin',
        'company_admin',
        'human_resource',
        'super_admin',
        'psa',
        'hr_manager',
        'hr manager',
        'hr_admin',
    ].includes(roleName) && !location.pathname.startsWith('/employee/');
    const currentUserIdentity = useMemo(() => {
        const toClean = (value) => String(value || '').trim();
        const toKey = (value) => toClean(value).toLowerCase();

        const ids = [
            user?._id,
            user?.id,
            user?.employeeId,
            user?.employeeCode,
            user?.employee?._id,
            user?.employee?.id,
            user?.employee?.employeeId,
            user?.employee?.employeeCode,
        ]
            .map(toClean)
            .filter(Boolean);

        const labels = [
            user?.email,
            user?.name,
            user?.fullName,
            [user?.firstName, user?.lastName].filter(Boolean).join(' '),
            user?.employeeName,
            user?.employee?.email,
            user?.employee?.name,
            [user?.employee?.firstName, user?.employee?.lastName].filter(Boolean).join(' '),
        ]
            .map(toKey)
            .filter(Boolean);

        return {
            ids: new Set(ids),
            labels: new Set(labels),
        };
    }, [user]);
    const visibleWorkflowTabs = useMemo(() => {
        if (selectedReqId === 'all') return workflowTabs;
        if (isPrivilegedHiringUser) return workflowTabs;
        if (!selectedRequirement?.pipelineStages?.length) return inEmployeePanel ? ['Applied'] : workflowTabs;

        const stageNames = selectedRequirement.pipelineStages
            .filter((stage) => {
                const multiAssigned = Array.isArray(stage?.assignedInterviewers) ? stage.assignedInterviewers : [];
                const allAssigned = [
                    ...multiAssigned,
                    stage?.assignedInterviewer,
                ].filter(Boolean);
                if (allAssigned.length === 0) return false;
                return allAssigned.some((assignee) => {
                    if (assignee && typeof assignee === 'object') {
                        const candidateIds = [
                            assignee?._id,
                            assignee?.id,
                            assignee?.employeeId,
                            assignee?.employeeCode,
                            assignee?.userId,
                            assignee?.employee?._id,
                            assignee?.employee?.id,
                            assignee?.employee?.employeeId,
                        ]
                            .map((v) => String(v || '').trim())
                            .filter(Boolean);

                        if (candidateIds.some((id) => currentUserIdentity.ids.has(id))) {
                            return true;
                        }

                        const candidateLabels = [
                            assignee?.email,
                            assignee?.name,
                            assignee?.fullName,
                            assignee?.employeeName,
                            [assignee?.firstName, assignee?.lastName].filter(Boolean).join(' '),
                            assignee?.employee?.email,
                            assignee?.employee?.name,
                            [assignee?.employee?.firstName, assignee?.employee?.lastName].filter(Boolean).join(' '),
                        ]
                            .map((v) => String(v || '').trim().toLowerCase())
                            .filter(Boolean);

                        return candidateLabels.some((label) => currentUserIdentity.labels.has(label));
                    }

                    const raw = String(assignee || '').trim();
                    if (!raw) return false;
                    if (currentUserIdentity.ids.has(raw)) return true;
                    return currentUserIdentity.labels.has(raw.toLowerCase());
                });
            })
            .map((stage) => String(stage?.stageName || '').trim())
            .filter(Boolean);

        const unique = [...new Set(stageNames)];
        if (inEmployeePanel) {
            if (unique.length === 0) return ['Applied'];
            return ['Applied', ...unique.filter((name) => name !== 'Applied')];
        }
        // HR/Admin panels can keep broad fallback.
        return unique.length > 0 ? unique : workflowTabs;
    }, [selectedReqId, workflowTabs, isPrivilegedHiringUser, selectedRequirement, currentUserIdentity, inEmployeePanel]);

    const progressionWorkflowTabs = useMemo(
        () =>
            (inEmployeePanel ? visibleWorkflowTabs : workflowTabs).filter(
                (stage) => normalizeStatus(stage) !== 'Rejected'
            ),
        [inEmployeePanel, visibleWorkflowTabs, workflowTabs]
    );

    useEffect(() => {
        if (!visibleWorkflowTabs.includes(activeTab)) {
            setActiveTab(visibleWorkflowTabs[0] || 'Applied');
        }
    }, [visibleWorkflowTabs, activeTab]);

    // Custom Rounds State - Load from localStorage or use defaults
    const [customRounds, setCustomRounds] = useState(() => {
        const saved = localStorage.getItem('hrms_custom_rounds');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return ['HR Round', 'Tech Round', 'Final Round'];
            }
        }
        return ['HR Round', 'Tech Round', 'Final Round'];
    });

    // Persist custom rounds to localStorage when they change
    useEffect(() => {
        localStorage.setItem('hrms_custom_rounds', JSON.stringify(customRounds));
    }, [customRounds]);



    // Workflow Editing State
    const [companyHolidays, setCompanyHolidays] = useState([]);

    useEffect(() => {
        const fetchHolidays = async () => {
            try {
                const year = new Date().getFullYear();
                const res = await api.get(`/holidays?year=${year}`);
                if (res.data) {
                    setCompanyHolidays(res.data.map(h => dayjs(h.date).format('YYYY-MM-DD')));
                }
            } catch (err) {
                console.error("Failed to fetch holidays", err);
            }
        };
        fetchHolidays();
    }, []);
    const [showWorkflowEditModal, setShowWorkflowEditModal] = useState(false);
    const [editingWorkflow, setEditingWorkflow] = useState([]);
    const [newStageName, setNewStageName] = useState('');

    // Selection & Review State
    const [selectedApplicant, setSelectedApplicant] = useState(null);
    const [selectedStatusForReview, setSelectedStatusForReview] = useState(null);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewFeedback, setReviewFeedback] = useState('');
    const [isFinishingInterview, setIsFinishingInterview] = useState(false);

    // Finalize Modal State
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [finalizeModalVisible, setFinalizeModalVisible] = useState(false);
    const [candidateToFinalize, setCandidateToFinalize] = useState(null);

    // New Interview Round State
    const [addRoundModalVisible, setAddRoundModalVisible] = useState(false);
    const [newRoundName, setNewRoundName] = useState('');

    // Pipeline Manager State
    const [showPipelineManager, setShowPipelineManager] = useState(false);
    const [candidateForNewRound, setCandidateForNewRound] = useState(null);

    // BGV Initiation State (Package-Driven)
    const [showBGVModal, setShowBGVModal] = useState(false);
    const [bgvCandidate, setBgvCandidate] = useState(null);

    // Stage Feedback Modal State
    const [showStageFeedbackModal, setShowStageFeedbackModal] = useState(false);
    const [feedbackCandidate, setFeedbackCandidate] = useState(null);
    const [feedbackTargetStage, setFeedbackTargetStage] = useState(null);
    const [feedbackStageConfig, setFeedbackStageConfig] = useState(null);

    // Custom Other Round State
    const [addCustomRoundModalVisible, setAddCustomRoundModalVisible] = useState(false);
    const [customRoundType, setCustomRoundType] = useState('Game'); // 'Game', 'Assessment', 'Task', etc.
    const [customRoundName, setCustomRoundName] = useState('');
    const [customRoundDescription, setCustomRoundDescription] = useState('');
    const [gameRoundConfig, setGameRoundConfig] = useState({
        gameName: '',
        duration: 30,
        difficulty: 'Medium',
        gameType: 'Coding'
    });

    // Modal Tab State (Resume vs Onboarding Profile)
    const [modalActiveTab, setModalActiveTab] = useState('Resume');

    // Company Approval State (Phase 2)
    const [companyProfile, setCompanyProfile] = useState(null);
    const [companyApprovalModalVisible, setCompanyApprovalModalVisible] = useState(false);
    const [applicantForApproval, setApplicantForApproval] = useState(null);
    const [companySig, setCompanySig] = useState(null);
    const [companyStamp, setCompanyStamp] = useState(null);
    const [isApproving, setIsApproving] = useState(false);
    const [approvalType, setApprovalType] = useState('offer'); // 'offer' or 'joining'

    // Approval Flow Emails Popup States
    const [approvalEmailsModalVisible, setApprovalEmailsModalVisible] = useState(false);
    const [approvalEmails, setApprovalEmails] = useState([
        { roleName: 'Manager', email: '', name: 'Manager' },
        { roleName: 'HR Head', email: '', name: 'HR Head' },
        { roleName: 'CEO', email: '', name: 'CEO' }
    ]);
    const [workflowLetterType, setWorkflowLetterType] = useState('offer');

    useEffect(() => {
        const fetchContext = async () => {
            try {
                const res = await api.get('/letters/company-profile');
                setCompanyProfile(res.data);
                if (res.data?.signatory?.signatureImage) {
                    setCompanySig(res.data.signatory.signatureImage);
                }
                // If there's a default stamp in branding or meta, we could set it too
                if (res.data?.branding?.letterheadBg) {
                    setCompanyStamp(res.data.branding.letterheadBg);
                }
            } catch (err) {
                console.warn("Failed to fetch company profile for approval context", err);
            }
        };
        fetchContext();
    }, []);

    // Stamp Customization State
    const [stampSettings, setStampSettings] = useState({ x: 10, y: 10, scale: 1 }); // x,y in percentage relative to container bottom-left logic if needed, but here relative to top-left of container
    const [isDraggingStamp, setIsDraggingStamp] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null); // URL for iframe preview
    const stampContainerRef = useRef(null);

    const handleStampDragStart = (e) => {
        setIsDraggingStamp(true);
    };

    const handleStampDragEnd = (e) => {
        setIsDraggingStamp(false);
    };

    const handleStampDrag = (e) => {
        if (!isDraggingStamp || !stampContainerRef.current) return;

        // Calculate new position
        const rect = stampContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top; // This is top-left based

        // Constrain to container
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;

        // Limit 0-100
        const clampedX = Math.max(0, Math.min(100, xPercent));
        const clampedY = Math.max(0, Math.min(100, yPercent));

        setStampSettings(prev => ({ ...prev, x: clampedX, y: clampedY }));
    };



    const openWorkflowEditor = () => {
        if (!selectedRequirement) return;
        // Ensure we have at least the basic structure if empty
        const current = selectedRequirement.workflow && selectedRequirement.workflow.length > 0
            ? [...selectedRequirement.workflow]
            : ['Applied', 'Shortlisted', 'Interview', 'Finalized'];
        setEditingWorkflow(current);
        setShowWorkflowEditModal(true);
    };

    const handleStageAdd = () => {
        if (newStageName.trim()) {
            // Insert before 'Finalized' if it exists to keep logical order, or just append
            const newList = [...editingWorkflow];
            const finalIdx = newList.indexOf('Finalized');
            if (finalIdx !== -1) {
                newList.splice(finalIdx, 0, newStageName.trim());
            } else {
                newList.push(newStageName.trim());
            }
            setEditingWorkflow(newList);
            setNewStageName('');
        }
    };

    const handleStageRemove = (index) => {
        const newList = [...editingWorkflow];
        newList.splice(index, 1);
        setEditingWorkflow(newList);
    };

    const saveWorkflowChanges = async () => {
        if (!selectedRequirement) return;
        try {
            setLoading(true);
            await api.put(`/requirements/${selectedRequirement._id}`, {
                workflow: editingWorkflow
            });

            // Refresh requirements to reflect changes
            const res = await api.get('/requirements?_t=${Date.now()}');
            const data = res.data.requirements || res.data || [];
            setRequirements(data);

            // Update current selection
            const updatedReq = data.find(r => r._id === selectedRequirement._id);
            setSelectedRequirement(updatedReq);

            // Trigger tab recalc
            // logic in useEffect will handle it based on updated selectedRequirement

            setShowWorkflowEditModal(false);
            showToast('success', 'Success', 'Workflow updated successfully!');
        } catch (err) {
            console.error(err);
            showToast('error', 'Error', 'Failed to update workflow');
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        // Fetch Requirements for dropdown
        async function fetchReqs() {
            try {
                const res = await api.get('/requirements?_t=${Date.now()}');
                if (res.data.requirements) {
                    setRequirements((res.data.requirements || []).map(r => ({ ...r, _id: String(r._id) })));
                } else {
                    setRequirements((res.data || []).map(r => ({ ...r, _id: String(r._id || r.id) })));
                }
            } catch (err) {
                console.error("Failed to load requirements", err);
            }
        }
        fetchReqs();
    }, []);

    // Handle auto-opening offer modal from HiringActionPage
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const action = params.get('action');
        const applicantId = params.get('id');

        if (action === 'generate-offer' && applicantId && applicants.length > 0) {
            const applicant = applicants.find(a => String(a._id) === String(applicantId));
            if (applicant) {
                // Ensure we are on the 'Finalized' tab
                setSelectedReqId('all');
                setActiveTab('Finalized');
                openOfferModal(applicant);
            }
            // Clear the query string
            params.delete('action');
            params.delete('id');
            const newSearchParams = params.toString();
            navigate(`${applicantsBasePath}${newSearchParams ? '?' + newSearchParams : ''}`, { replace: true });
        }
    }, [applicants, applicantsBasePath, location.search, navigate]);

    // Handle auto-opening joining letter modal from tracker/action routes
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const action = params.get('action');
        const applicantId = params.get('id');
        const targetTab = params.get('tab');

        if (action === 'generate-joining' && targetTab === 'joining') {
            setSelectedReqId('all');
            setActiveTab('Finalized');
        }

        if (action === 'generate-joining' && applicantId && applicants.length > 0) {
            const applicant = applicants.find(a => String(a._id) === String(applicantId));
            if (applicant) {
                openJoiningModal(applicant);
            }

            params.delete('action');
            params.delete('id');
            params.delete('tab');
            const newSearchParams = params.toString();
            navigate(`${applicantsBasePath}${newSearchParams ? '?' + newSearchParams : ''}`, { replace: true });
        }
    }, [applicants, applicantsBasePath, location.search, navigate]);

    // Handle auto-opening joining letter modal from salary assignment
    useEffect(() => {
        if (location.state?.openJoiningLetterFor && applicants.length > 0) {
            // Find the applicant
            const applicant = applicants.find(a => a._id === location.state.openJoiningLetterFor);
            if (applicant) {
                if (location.state.message) {
                    showToast('info', 'Info', location.state.message);
                }
                openJoiningModal(applicant);
            }
            // Clear the state to prevent re-triggering
            navigate(applicantsBasePath, { replace: true });
        }
    }, [applicants, location.state, applicantsBasePath]);

    // Handle auto-opening joining letter modal from BGV clearance
    useEffect(() => {
        const bgvClearedId = searchParams.get('bgvCleared');
        const targetTab = searchParams.get('tab');

        if (targetTab === 'joining') {
            setSelectedReqId('all');
            setActiveTab('Finalized');
        }

        if (bgvClearedId && applicants.length > 0) {
            const applicant = applicants.find(a =>
                String(a._id) === String(bgvClearedId) ||
                String(a.applicationId || '') === String(bgvClearedId)
            );
            if (applicant) {
                openJoiningModal(applicant);
            }
            // Clear the query string to avoid re-triggering
            searchParams.delete('bgvCleared');
            searchParams.delete('tab');
            navigate(`${applicantsBasePath}?${searchParams.toString()}`, { replace: true });
        }
    }, [applicants, location.search, applicantsBasePath]);

    // Auto-select job when in jobSpecific mode
    useEffect(() => {
        if (jobSpecific && jobId) {
            setSelectedReqId(jobId);
            setActiveTab('All');
        }
    }, [jobSpecific, jobId]);

    // Ensure selected requirement details are fetched/set when selectedReqId is active
    useEffect(() => {
        if (selectedReqId && selectedReqId !== 'all') {
            const req = requirements.find(r => String(r._id) === String(selectedReqId));
            if (req) {
                setSelectedRequirement(req);
            } else {
                let cancelled = false;
                (async () => {
                    try {
                        const res = await api.get(`/requirements/${selectedReqId}`);
                        if (!cancelled && res.data) {
                            setSelectedRequirement({
                                ...res.data,
                                _id: String(res.data._id || res.data.id)
                            });
                        }
                    } catch (err) {
                        console.error("Failed to fetch specific requirement details", err);
                    }
                })();
                return () => {
                    cancelled = true;
                };
            }
        }
    }, [selectedReqId, requirements]);

    // Auto-select 'all' when in showAllCandidates mode
    useEffect(() => {
        if (showAllCandidates) {
            setSelectedReqId('all');
            setSelectedRequirement(null);
            setActiveTab('Applied');
        }
    }, [showAllCandidates]);


    // Handle Requirement Selection
    const handleRequirementChange = (reqId) => {
        setSelectedReqId(reqId);
        if (reqId === 'all') {
            setSelectedRequirement(null);
            // setWorkflowTabs handle by useEffect
            setActiveTab('all');
        } else {
            const req = requirements.find(r => r._id === reqId);
            setSelectedRequirement(req);

            // Set default active tab
            if (req && req.workflow && req.workflow.length > 0) {
                setActiveTab(req.workflow[0]);
            } else {
                setActiveTab('Applied');
            }
        }
    };

    // Dynamic Tab Calculation (Includes Custom/Ad-hoc Stages)
    const handlePipelineUpdate = async () => {
        try {
            const res = await api.get('/requirements?_t=${Date.now()}');
            const data = res.data.requirements || res.data || [];
            setRequirements(data);

            if (selectedRequirement) {
                const up = data.find(r => r._id === selectedRequirement._id);
                if (up) setSelectedRequirement(up);
            }
        } catch (e) {
            console.error("Failed to refresh requirements", e);
        }
    };

    useEffect(() => {
        if (selectedReqId === 'all') {
            const globalStages = ['All', 'Applied', 'Finalized', 'Rejected'];
            setWorkflowTabs(globalStages);
            if (activeTab === 'all' || !globalStages.includes(activeTab)) {
                setActiveTab('All');
            }
        } else if (selectedRequirement) {
            let _workflowItems = ['All', 'Applied', 'Shortlisted', 'Interview', 'HR Round', 'Finalized', 'Rejected'];
            
            if (selectedRequirement && selectedRequirement.pipelineStages && selectedRequirement.pipelineStages.length > 0) {
                // Filter out onboarding-related stages as they are now in the "Offer & Joining" manager
                const onboardingStages = ['Joining Letter Issued', 'Offer Issued', 'Joined', 'Hired', 'Offer Accepted'];
                const customStages = selectedRequirement.pipelineStages
                    .filter(s => {
                        const name = s.stageName || s.name || '';
                        return !onboardingStages.some(os => name.toLowerCase().includes(os.toLowerCase()));
                    })
                    .map(s => s.stageName || s.name || 'Unknown');
                
                _workflowItems = ['All', ...customStages];
                
                // Always ensure standard terminal tabs exist if not present
                if (!_workflowItems.includes('Applied')) _workflowItems.splice(1, 0, 'Applied');
                if (!_workflowItems.includes('Finalized')) _workflowItems.push('Finalized');
                if (!_workflowItems.includes('Rejected')) _workflowItems.push('Rejected');
            }
            
            setWorkflowTabs(_workflowItems);

            // If current active tab is not in the new workflow, move to first
            if (!_workflowItems.includes(activeTab)) {
                setActiveTab(_workflowItems[0]);
            }
        }
    }, [selectedReqId, selectedRequirement, applicants]);


    // Custom Stage State
    const [isCustomStageModalVisible, setIsCustomStageModalVisible] = useState(false);
    const [customStageName, setCustomStageName] = useState('');
    const [candidateForCustomStage, setCandidateForCustomStage] = useState(null);

    const handleNextStage = (applicant) => {
        const currentStatus = normalizeStatus(applicant?.status || activeTab);
        const currentIndex = visibleWorkflowTabs.findIndex(
            (stage) => normalizeStatus(stage) === currentStatus
        );
        if (currentIndex !== -1 && currentIndex < visibleWorkflowTabs.length - 1) {
            const nextStage = visibleWorkflowTabs[currentIndex + 1];
            handleStatusChangeRequest(applicant, nextStage === 'Finalized' ? 'Selected' : nextStage);
        } else {
            handleStatusChangeRequest(applicant, 'Selected');
        }
    };

    const handleAddCustomStage = async () => {
        if (!customStageName.trim() || !candidateForCustomStage) return;

        showConfirmToast({
            title: 'Add Custom Stage',
            description: `Move ${candidateForCustomStage.name} to "${customStageName}" ? `,
            okText: 'Confirm',
            cancelText: 'Cancel',
            onConfirm: async () => {
                const success = await updateStatus(candidateForCustomStage, customStageName);
                if (success) {
                    setIsCustomStageModalVisible(false);
                    setCustomStageName('');
                    setCandidateForCustomStage(null);
                }
            }
        });
    };

    // --- NEW PIPELINE LOGIC FUNCTIONS ---

    // Add Virtual Interview Round (Frontend only simulation as requested)
    const handleAddInterviewRound = (app) => {
        setCandidateForNewRound(app);
        setAddRoundModalVisible(true);
    };

    // Add Custom Other Round with Game/Assessment
    const handleAddCustomRound = (app) => {
        setCandidateForNewRound(app);
        setAddCustomRoundModalVisible(true);
    };

    const renderHiringDropdown = (app) => {
        if (app.status === 'Finalized') return (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full w-full justify-center">
                <CheckCircle size={14} className="text-blue-600" />
                <span className="text-[10px] font-black text-blue-700 tracking-widest uppercase">Finalized</span>
            </div>
        );

        if (app.status === 'Joining Letter Issued') return (
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-100 rounded-full w-full justify-center">
                <CheckCircle size={14} className="text-purple-600" />
                <span className="text-[10px] font-black text-purple-700 tracking-widest uppercase">Joining Letter Issued</span>
            </div>
        );

        // Rule: Finalize button ONLY in HR Round tab for Selected candidates
        if (activeTab === 'HR Round' && app.status === 'Selected') {
            return (
                <div className="w-full flex gap-2">
                    <Can module={permissionKey} action="edit">
                        <button
                            onClick={() => { setCandidateToFinalize(app); setFinalizeModalVisible(true); }}
                            className="flex-1 h-10 rounded-full bg-blue-600 text-white text-[11px] font-black shadow-lg shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 px-6"
                        >
                            <ShieldCheck size={16} strokeWidth={2.5} />
                            FINALIZE
                        </button>
                    </Can>
                    <Can module={permissionKey} action="delete">
                        <button
                            onClick={() => updateStatus(app, 'Rejected')}
                            className="flex-1 h-10 rounded-full bg-rose-600 text-white text-[11px] font-black shadow-lg shadow-rose-100 hover:bg-rose-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 px-6"
                        >
                            <UserX size={16} strokeWidth={2.5} />
                            REJECT
                        </button>
                    </Can>
                    <Can module={permissionKey} action="edit">
                        <button
                            onClick={() => handleAddCustomRound(app)}
                            className="flex-1 h-10 rounded-full bg-amber-600 text-white text-[11px] font-black shadow-lg shadow-amber-100 hover:bg-amber-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 px-6"
                        >
                            <PlusCircle size={16} strokeWidth={2.5} />
                            OTHER ROUND
                        </button>
                    </Can>
                </div>
            );
        }

        // Dynamic flow: employee panel uses assigned tabs only; HR uses full workflow.
        const normalizedStatus = normalizeStatus(app.status);
        const candidateStatusIndex = progressionWorkflowTabs.findIndex(
            (stage) => normalizeStatus(stage) === normalizedStatus
        );
        const nextStage =
            candidateStatusIndex >= 0 ? progressionWorkflowTabs[candidateStatusIndex + 1] : null;
        const prevStage =
            candidateStatusIndex > 0 ? progressionWorkflowTabs[candidateStatusIndex - 1] : null;
        const isTerminalCandidate = [
            'Finalized',
            'Selected',
            'Rejected',
            'Joining Letter Issued',
            'Offer Issued',
            'Offer Expired',
            'Hired',
            'Joined',
        ].includes(String(app.status));

        const menuItems = [
            {
                key: 'label',
                label: (
                    <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">
                        Next Pipeline Step
                    </div>
                ),
                disabled: true,
            },
            ...(nextStage && !isTerminalCandidate ? [{
                key: 'next_dynamic',
                icon: <UserCheck size={16} className="text-blue-500" />,
                label: <span className="font-bold text-slate-700">Move to {nextStage}</span>,
                onClick: () => handleStatusChangeRequest(app, nextStage === 'Finalized' ? 'Selected' : nextStage),
            }] : []),
            ...(!nextStage && !isTerminalCandidate ? [{
                key: 'finalize_dynamic',
                icon: <CheckCircle size={16} className="text-emerald-500" />,
                label: <span className="font-bold text-emerald-600">Mark as Selected</span>,
                onClick: () => updateStatus(app, 'Selected'),
            }] : []),
            ...(isInterviewStage(app) ? [
                {
                    key: 'add_round',
                    icon: <PlusCircle size={16} className="text-emerald-500" />,
                    label: <span className="font-bold text-emerald-600">Add Interview Round</span>,
                    onClick: () => handleAddInterviewRound(app),
                }
            ] : []),
            { type: 'divider', className: 'my-1 border-slate-50' },
            {
                key: 'reject',
                icon: <UserX size={16} className="text-rose-500" />,
                label: <span className="font-bold text-rose-600">Mark as Rejected</span>,
                onClick: () => updateStatus(app, 'Rejected'),
            },
            ...(prevStage ? [{
                key: 'back',
                icon: <RotateCcw size={16} className="text-slate-400" />,
                label: <span className="font-bold text-slate-500">Move Back to {prevStage}</span>,
                onClick: () => updateStatus(app, prevStage)
            }] : [])
        ];

        return (
            <Can module={permissionKey} action="edit">
                <Dropdown
                    menu={{ items: menuItems }}
                    trigger={['click']}
                    placement="bottomRight"
                    overlayClassName="p-2 rounded-2xl shadow-2xl border-none min-w-[220px]"
                >
                    <button className="w-full h-10 rounded-xl border border-slate-200 bg-white text-slate-600 text-[11px] font-black hover:border-indigo-400 hover:text-indigo-600 hover:shadow-md transition-all flex items-center justify-between px-4 group">
                        <span>NEXT STEP</span>
                        <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
                    </button>
                </Dropdown>
            </Can>
        );
    };
    // Drag and Drop Refs
    const dragItem = React.useRef(null);
    const dragOverItem = React.useRef(null);

    const handleSort = () => {
        // duplicate items
        let _workflowItems = [...editingWorkflow];

        // remove and save the dragged item content
        const draggedItemContent = _workflowItems.splice(dragItem.current, 1)[0];

        // switch the position
        _workflowItems.splice(dragOverItem.current, 0, draggedItemContent);

        // reset the position ref
        dragItem.current = null;
        dragOverItem.current = null;

        // update the actual array
        setEditingWorkflow(_workflowItems);
    };

    // Helper: Check if a status is terminal/finalized
    const isFinalizedStatus = (s) => {
        const ns = normalizeStatus(s);
        return ns === 'Finalized' || ['Finalized', 'Selected', 'Joining Letter Issued', 'Offer Issued', 'Offer Accepted', 'Offer Accepted – Awaiting Company Approval', 'Fully Signed', 'Hired', 'Joined', 'Document Requested', 'Profile Submitted', 'Document Verification Pending', 'Resubmitted', 'Reupload Required'].includes(s);
    };

    // Cumulative Filtering Logic: Check if a candidate's status has reached or passed a specific tab
    const checkStatusPassage = (applicantStatus, targetTab, tabsArray) => {
        // Step 1: Normalize inputs
        const normalizedApp = normalizeStatus(applicantStatus);
        const normalizedTarget = normalizeStatus(targetTab);

        if (normalizedTarget === 'All') {
            return true;
        }

        // Step 2: Handle Terminal/Special statuses
        if (normalizedTarget === 'Rejected') {
            return normalizedApp === 'Rejected';
        }

        if (isFinalizedStatus(applicantStatus)) {
            // They have passed everything, visible in all positive tabs
            return normalizedTarget !== 'Rejected';
        }

        // Step 3: Index-based comparison for workflow stages (Cumulative)
        const currentIdx = tabsArray.indexOf(normalizedApp);
        const targetIdx = tabsArray.indexOf(normalizedTarget);

        if (targetIdx !== -1) {
            // If current status is not in workflow, but we aren't terminal, do exact match or default
            if (currentIdx === -1) {
                return normalizedApp === normalizedTarget;
            }
            // Visible if current stage is at or beyond the target stage
            return currentIdx >= targetIdx;
        }

        // Fallback to exact match
        return normalizedApp === normalizedTarget;
    };

    const getFilteredApplicants = () => {
        let filtered = applicants;

        // 1. Filter by Search Query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(a =>
                a.name.toLowerCase().includes(query) ||
                a.email.toLowerCase().includes(query) ||
                (a.mobile && a.mobile.includes(query))
            );
        }

        // 2. Filter by Requirement ID
        if (selectedReqId !== 'all') {
            filtered = filtered.filter(a => String(a.requirementId?._id || a.requirementId) === String(selectedReqId));
        }

        // 2.5 Filter by Internal Mode vs External Mode
        if (internalMode) {
            filtered = filtered.filter(applicantMatchesInternalPipeline);
        } else {
            filtered = filtered.filter((a) => !applicantMatchesInternalPipeline(a));
        }

        // 3. Filter by Time Range
        if (timeFilter !== 'all') {
            const now = dayjs();
            let startDate;
            if (timeFilter === 'today') startDate = now.startOf('day');
            else if (timeFilter === 'week') startDate = now.subtract(7, 'days');
            else if (timeFilter === '15days') startDate = now.subtract(15, 'days');
            else if (timeFilter === 'month') startDate = now.subtract(1, 'month');

            if (startDate) {
                filtered = filtered.filter(a => dayjs(a.createdAt).isAfter(startDate));
            }
        }

        // 4. Filter by Active Tab (Stage)
        const onboardingStatuses = ['Joining Letter Issued', 'Offer Issued', 'Offer Accepted', 'Offer Expired', 'Hired', 'Joined', 'Fully Signed'];

        if (activeTab === 'All') {
            return filtered;
        }

        if (selectedReqId === 'all') {
            // Global Pipeline: Cumulative show in 'Applied'
            if (activeTab === 'Finalized') {
                return filtered.filter(a => isFinalizedStatus(a.status));
            }
            if (activeTab === 'Rejected') {
                return filtered.filter(a => a?.status === 'Rejected');
            }
            
            // Show all positive applications in 'Applied' tab
            return filtered.filter(a => a?.status !== 'Rejected');
        }

        // Specific Job Workflow: CUMULATIVE Visibility
        return filtered.filter(a => {
            // Exclude Rejected candidates from all rounds except Rejected tab
            if (a.status === 'Rejected' && activeTab !== 'Rejected') {
                return false;
            }
            if (activeTab === 'Rejected') {
                return a.status === 'Rejected';
            }

            return checkStatusPassage(a.status || 'Applied', activeTab, workflowTabs);
        });
    };

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [showCandidateModal, setShowCandidateModal] = useState(false);

    // File Upload State
    const sigCanvasRef = useRef({});
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const triggerFileUpload = (applicant) => {
        setSelectedApplicant(applicant);
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Reset
            fileInputRef.current.click();
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedApplicant) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            await api.post(`/requirements/applicants/${selectedApplicant._id}/upload-salary-excel`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast('success', 'Success', "Excel uploaded successfully! Variables are now available for Letter Templates.");
            loadApplicants(); // Refresh incase we show status
        } catch (error) {
            console.error(error);
            showToast('error', 'Error', "Upload failed: " + (error.response?.data?.error || error.message));
        } finally {
            setUploading(false);
        }
    };
    // State moved to top
    const [offerData, setOfferData] = useState({
        joiningDate: '',
        expiryAt: '',
        location: '',
        templateId: '',
        emailTemplateId: '',
        position: '',
        jobCategory: 'Full Time', // Intern vs Full Time
        probationPeriod: '',
        templateContent: '',
        isWordTemplate: false,
        refNo: '',
        fatherName: '',
        relationType: 'S/O',
        salutation: '',
        address: '',
        issueDate: dayjs().format('YYYY-MM-DD'), // Default to today
        name: '',
        dearName: '',
        email: '',
        mobile: '',
        dateFormat: 'Do MMM. YYYY', // Default format
        signaturePosition: { alignment: 'right' },
        customData: {}
    });
    const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
    useEffect(() => () => revokeObjectPreviewUrl(previewPdfUrl), [previewPdfUrl]);

    /** Plain-text offer expiry (no native datetime picker); synced to offerData.expiryAt as ISO when valid */
    const parseOfferExpiryText = (raw, formatStr) => {
        const v = String(raw || '').trim();
        if (!v) return null;
        
        const parts = v.split(/\s+/);
        if (parts.length < 2) return null;
        
        const timePart = parts[parts.length - 1];
        const datePart = parts.slice(0, -1).join(' ');
        
        const parsedDate = parseJoiningDateText(datePart, formatStr);
        if (!parsedDate) return null;
        
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        const timeMatch = timePart.match(timeRegex);
        if (!timeMatch) return null;
        
        return parsedDate.hour(parseInt(timeMatch[1], 10)).minute(parseInt(timeMatch[2], 10)).second(0).millisecond(0);
    };

    const parseJoiningDateText = (raw, formatStr) => {
        const v = String(raw || '').trim();
        if (!v) return null;
        
        const candidates = ['YYYY-MM-DD', 'DD/MM/YYYY', 'D/M/YYYY', 'DD-MM-YYYY', 'D-M-YYYY', 'YYYY/MM/DD', 'YYYY.MM.DD', 'DD.MM.YYYY'];
        if (formatStr && !candidates.includes(formatStr)) {
            candidates.unshift(formatStr);
        }
        
        const cleanRaw = v.replace(/(\d+)(st|nd|rd|th)/gi, '$1').replace(/\./g, '');
        
        for (let fmt of candidates) {
            let processedFmt = fmt.replace('Do', 'D').replace(/\./g, '');
            const d = dayjs(cleanRaw, processedFmt, true);
            if (d.isValid()) return d;
            
            const d2 = dayjs(cleanRaw, processedFmt, false);
            if (d2.isValid()) return d2;
        }
        
        const fallback = dayjs(v);
        if (fallback.isValid()) return fallback;
        
        return null;
    };

    const parseJoiningDeadlineText = (raw, formatStr) => {
        const v = String(raw || '').trim();
        if (!v) return null;
        
        const parts = v.split(/\s+/);
        if (parts.length < 2) return null;
        
        const timePart = parts[parts.length - 1];
        const datePart = parts.slice(0, -1).join(' ');
        
        const parsedDate = parseJoiningDateText(datePart, formatStr);
        if (!parsedDate) return null;
        
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        const timeMatch = timePart.match(timeRegex);
        if (!timeMatch) return null;
        
        return parsedDate.hour(parseInt(timeMatch[1], 10)).minute(parseInt(timeMatch[2], 10)).second(0).millisecond(0);
    };

    // Joining Letter State
    const [showJoiningModal, setShowJoiningModal] = useState(false);
    const [joiningTemplateId, setJoiningTemplateId] = useState('');
    const [joiningTemplates, setJoiningTemplates] = useState([]);
    const [joiningPreviewUrl, setJoiningPreviewUrl] = useState(null);
    const [joiningPreviewHtml, setJoiningPreviewHtml] = useState(null);
    const [showJoiningPreview, setShowJoiningPreview] = useState(false);
    const [joiningRefNo, setJoiningRefNo] = useState('');
    const [joiningIssueDate, setJoiningIssueDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [joiningExpiryAt, setJoiningExpiryAt] = useState('');
    const [joiningSignaturePosition, setJoiningSignaturePosition] = useState({ alignment: 'right' });
    const [joiningLetterExpiryDate, setJoiningLetterExpiryDate] = useState('');
    const [joiningIssueDateText, setJoiningIssueDateText] = useState('');
    const [joiningLetterExpiryText, setJoiningLetterExpiryText] = useState('');
    const [joiningExpiryAtText, setJoiningExpiryAtText] = useState('');
    const [joiningCustomData, setJoiningCustomData] = useState({});
    const [joiningSalutation, setJoiningSalutation] = useState('');
    const [joiningRelationType, setJoiningRelationType] = useState('S/O');
    const [joiningProbationPeriod, setJoiningProbationPeriod] = useState('');
    const [joiningDateFormat, setJoiningDateFormat] = useState('Do MMM. YYYY');
    const [joiningName, setJoiningName] = useState('');
    const [joiningDearName, setJoiningDearName] = useState('');
    const [joiningDateVal, setJoiningDateVal] = useState('');
    const [joiningDateText, setJoiningDateText] = useState('');
    const selectedJoiningTemplate = useMemo(
        () => joiningTemplates.find((template) => String(template._id) === String(joiningTemplateId)),
        [joiningTemplates, joiningTemplateId]
    );
    const joiningCustomFields = useMemo(
        () => normalizeTemplateCustomFields(selectedJoiningTemplate),
        [selectedJoiningTemplate]
    );

    useEffect(() => {
        if (!showJoiningModal && !showJoiningPreview && !showModal && !showPreview) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [showJoiningModal, showJoiningPreview, showModal, showPreview]);

    const syncJoiningModalFieldsFromText = () => {
        const issueD = parseJoiningDateText(joiningIssueDateText, joiningDateFormat);
        if (!issueD) {
            notification.error({ message: 'Error', description: `Letter Issue Date: use format ${joiningDateFormat}`, placement: 'topRight' });
            return false;
        }
        setJoiningIssueDate(issueD.format('YYYY-MM-DD'));
        setJoiningIssueDateText(toDisplayDate(issueD, joiningDateFormat));

        const joiningD = parseJoiningDateText(joiningDateText, joiningDateFormat);
        if (!joiningD) {
            notification.error({ message: 'Error', description: `Joining Date: use format ${joiningDateFormat}`, placement: 'topRight' });
            return false;
        }
        setJoiningDateVal(joiningD.format('YYYY-MM-DD'));
        setJoiningDateText(toDisplayDate(joiningD, joiningDateFormat));

        const deadlineD = parseJoiningDeadlineText(joiningLetterExpiryText, joiningDateFormat);
        if (!deadlineD) {
            notification.error({ message: 'Error', description: `Acceptance deadline: use format ${joiningDateFormat} hh:mm (e.g. 29/03/2026 18:00)`, placement: 'topRight' });
            return false;
        }
        if (!deadlineD.isAfter(dayjs().subtract(2, 'minute'))) {
            notification.error({ message: 'Error', description: 'Acceptance deadline must be in the future.', placement: 'topRight' });
            return false;
        }
        setJoiningLetterExpiryDate(deadlineD.toISOString());
        setJoiningLetterExpiryText(toDisplayDate(deadlineD, joiningDateFormat) + ' ' + deadlineD.format('HH:mm'));

        const sigRaw = String(joiningExpiryAtText || '').trim();
        if (sigRaw) {
            const sigD = parseJoiningDateText(sigRaw, joiningDateFormat);
            if (!sigD) {
                notification.error({ message: 'Error', description: `Signature expiry: use format ${joiningDateFormat} or leave empty`, placement: 'topRight' });
                return false;
            }
            setJoiningExpiryAt(sigD.format('YYYY-MM-DD'));
            setJoiningExpiryAtText(toDisplayDate(sigD, joiningDateFormat));
        } else {
            setJoiningExpiryAt('');
        }
        return true;
    };

    const handleJoiningDateFormatChange = (newFormat) => {
        setJoiningDateFormat(newFormat);
        if (joiningIssueDate) {
            setJoiningIssueDateText(toDisplayDate(joiningIssueDate, newFormat));
        }
        if (joiningDateVal) {
            setJoiningDateText(toDisplayDate(joiningDateVal, newFormat));
        }
        if (joiningExpiryAt) {
            setJoiningExpiryAtText(toDisplayDate(joiningExpiryAt, newFormat));
        }
        if (joiningLetterExpiryDate) {
            const deadlineD = dayjs(joiningLetterExpiryDate);
            if (deadlineD.isValid()) {
                setJoiningLetterExpiryText(toDisplayDate(deadlineD, newFormat) + ' ' + deadlineD.format('HH:mm'));
            }
        }
    };

    const closeJoiningPreview = () => {
        setShowJoiningPreview(false);
        setJoiningPreviewHtml(null);
        setJoiningPreviewUrl(null);
    };

    // Salary Assignment State
    const [showSalaryModal, setShowSalaryModal] = useState(false);
    const [showSalaryPreview, setShowSalaryPreview] = useState(false);


    // Review Modal State
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewForm, setReviewForm] = useState({ rating: 0, feedback: '', scorecard: {} });
    const [showEvaluationDrawer, setShowEvaluationDrawer] = useState(false);

    // Document Upload States
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    const [documentApplicant, setDocumentApplicant] = useState(null);
    const [uploadedDocuments, setUploadedDocuments] = useState([]);
    const [documentName, setDocumentName] = useState('');
    const [documentFile, setDocumentFile] = useState(null);
    const [evalActiveRound, setEvalActiveRound] = useState(0);
    const [evaluationData, setEvaluationData] = useState({
        rounds: [
            {
                id: "screening",
                name: "HR Screening",
                categories: [
                    {
                        name: "Communication & Professionalism",
                        skills: [
                            { name: "Verbal Communication", rating: 0, comment: "" },
                            { name: "Clarity of Thought", rating: 0, comment: "" },
                            { name: "Professional Attitude", rating: 0, comment: "" },
                        ],
                    },
                ],
            },
            {
                id: "technical",
                name: "Technical Interview",
                categories: [
                    {
                        name: "Technical Skills",
                        skills: [
                            { name: "Problem Solving", rating: 0, comment: "" },
                            { name: "System Design", rating: 0, comment: "" },
                            { name: "Coding Skills", rating: 0, comment: "" },
                        ],
                    },
                ],
            },
            {
                id: "managerial",
                name: "Hiring Manager Round",
                categories: [
                    {
                        name: "Leadership & Ownership",
                        skills: [
                            { name: "Decision Making", rating: 0, comment: "" },
                            { name: "Culture Fit", rating: 0, comment: "" },
                        ],
                    },
                ],
            }
        ]
    });

    const [generating, setGenerating] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const [offerExpiryAtText, setOfferExpiryAtText] = useState('');
    const selectedOfferTemplate = useMemo(
        () => templates.find((template) => String(template._id) === String(offerData.templateId)),
        [templates, offerData.templateId]
    );
    const offerCustomFields = useMemo(
        () => normalizeTemplateCustomFields(selectedOfferTemplate),
        [selectedOfferTemplate]
    );
    const [companyInfo, setCompanyInfo] = useState({
        name: 'My Company',
        tagline: '',
        address: 'Ahmedabad, Gujarat - 380051',
        phone: '+91 1234567890',
        email: 'hr@gitakshmi.com',
        website: 'www.gitakshmi.com',
        refPrefix: 'GITK',
        signatoryName: 'HR Manager',
        logo: 'https://via.placeholder.com/150x60/4F46E5/FFFFFF?text=COMPANY+LOGO' // Placeholder logo
    });


    // Interview State
    const [showInterviewModal, setShowInterviewModal] = useState(false);
    const [isReschedule, setIsReschedule] = useState(false);
    const [interviewData, setInterviewData] = useState({
        date: '',
        time: '',
        mode: 'Online',
        location: '',
        interviewerName: '',
        stage: '',
        notes: ''
    });

    const openScheduleModal = (applicant, reschedule = false) => {
        setSelectedApplicant(applicant);
        setIsReschedule(reschedule);
        // Pre-fill if rescheduling
        if (reschedule && applicant.interview) {
            setInterviewData({
                date: applicant.interview.date ? dayjs(applicant.interview.date).format('YYYY-MM-DD') : '',
                time: applicant.interview.time || '',
                mode: applicant.interview.mode || 'Online',
                location: applicant.interview.location || '',
                interviewerName: applicant.interview.interviewerName || '',
                stage: applicant.interview.stage || activeTab,
                notes: applicant.interview.notes || ''
            });
        } else {
            setInterviewData({
                date: dayjs().format('YYYY-MM-DD'),
                time: dayjs().format('h:mm a'),
                mode: 'Online',
                location: '',
                interviewerName: '',
                stage: activeTab === 'all' ? 'Interview Round' : activeTab,
                notes: ''
            });
        }
        setShowInterviewModal(true);
    };

    const handleInterviewSubmit = async (data) => {
        // Validation
        if (!data.date || !data.time) {
            showToast('error', 'Error', 'Please select Date and Time');
            return;
        }
        if (!data.mode) {
            showToast('error', 'Error', 'Please select Interview Mode');
            return;
        }

        // Conflict Detection
        const conflicts = applicants.filter(a =>
            a._id !== selectedApplicant._id &&
            a.interview?.date === data.date &&
            a.interview?.time === data.time
        );

        if (conflicts.length > 0) {
            if (!confirm(`Warning: There is already an interview scheduled at this time for ${conflicts[0].name}. Continue?`)) {
                return;
            }
        }

        setLoading(true);
        try {
            const url = isReschedule
                ? `/requirements/applicants/${selectedApplicant._id}/interview/reschedule`
                : `/requirements/applicants/${selectedApplicant._id}/interview/schedule`;

            const method = isReschedule ? 'put' : 'post';

            await api[method](url, {
                date: data.date,
                time: data.time,
                mode: data.mode,
                location: data.location,
                meetingLink: data.meetingLink,
                interviewerName: data.interviewerName,
                interviewerEmail: data.interviewerEmail,
                isExternalInterviewer: data.isExternalInterviewer,
                notes: data.notes,
                stage: data.stage
            });

            // Auto-move to next stage on initial schedule
            if (!isReschedule) {
                const currentIndex = progressionWorkflowTabs.findIndex(
                    (stage) => normalizeStatus(stage) === normalizeStatus(activeTab)
                );
                const nextStage = progressionWorkflowTabs[currentIndex + 1];
                if (nextStage && normalizeStatus(nextStage) !== 'Finalized') {
                    await api.patch(`/requirements/applicants/${selectedApplicant._id}/status`, { status: nextStage, skipEmail: true });
                }
            }

            showToast('success', 'Success', `Interview ${isReschedule ? 'rescheduled' : 'scheduled'} for ${selectedApplicant.name}`);
            setShowInterviewModal(false);
            loadApplicants();
        } catch (error) {
            console.error(error);
            showToast('error', 'Error', "Failed: " + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const markInterviewCompleted = async (applicant) => {
        showConfirmToast({
            title: 'Complete Interview',
            description: "Confirm interview completion? This will be logged in history.",
            okText: 'Yes, Complete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                setLoading(true);
                try {
                    await api.put(`/requirements/applicants/${applicant._id}/interview/complete`);
                    // showToast('success', 'Success', "Interview Marked Completed");
                    loadApplicants();
                } catch (err) {
                    console.error(err);
                    showToast('error', 'Error', "Error: " + (err.response?.data?.message || err.message));
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const updateStatus = async (applicant, status, review = null) => {
        try {
            const payload = { status };
            if (review) {
                payload.rating = review.rating;
                payload.feedback = review.feedback;
                payload.scorecard = review.scorecard; // Added scorecard
                payload.stageName = activeTab;
            }
            await api.patch(`/requirements/applicants/${applicant._id}/status`, payload);
            showToast('success', 'Success', `Status updated to ${status}`);
            loadApplicants();
            return true;
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            showToast('error', 'Error', "Failed: " + errorMsg);
            return false;
        }
    };

    const handleStatusChangeRequest = (applicant, status) => {
        if (status === 'custom_add') {
            setCandidateForCustomStage(applicant);
            setIsCustomStageModalVisible(true);
            return;
        }

        // Check if the TARGET status (Stage) has a configured feedback form or criteria
        // We find the stage configuration from selectedRequirement (if available)
        if (selectedRequirement && selectedRequirement.pipelineStages && status !== 'Selected' && status !== 'Rejected') {
            const stageConfig = selectedRequirement.pipelineStages.find(s => s.stageName === status);

            // If stage exists and has feedback config (formId or criteria) AND we are moving INTO it
            // Actually, feedback is usually collected AFTER a stage (before moving to next)? 
            // OR when moving TO a stage (to populate 'interview' details)?
            // User requirement: "When candidate moved to stage: check if stage.feedbackFormId exists"
            // This implies: On Move -> Open Form -> Submit -> Then Move.
            // Wait, usually feedback is for the COMPLETED stage.
            // But user said "When candidate moved to stage ... load form fields".
            // Maybe it means "When moving to Interview stage, show Interview Form"?
            // Or "When completing Interview stage"?
            // Let's assume interception on Move To X.

            if (stageConfig && (stageConfig.feedbackFormId || (stageConfig.evaluationCriteria && stageConfig.evaluationCriteria.length > 0))) {
                setFeedbackCandidate(applicant);
                setFeedbackTargetStage(status); // The stage we are moving TO
                setFeedbackStageConfig(stageConfig);
                setShowStageFeedbackModal(true);
                return; // INTERCEPTED
            }
        }


        showConfirmToast({
            title: 'Update Status',
            description: `Update status to ${status}? This will trigger an email.`,
            okText: 'Yes, Update',
            cancelText: 'Cancel',
            onConfirm: async () => {
                await updateStatus(applicant, status);
            }
        });
    };

    // NEW HANDLERS FOR INTERVIEW TAB ACTIONS (PART 3 & 4)
    const handleSelected = (applicant) => {
        showConfirmToast({
            title: 'Mark as Selected',
            description: `Move ${applicant.name} to HR Round?`,
            okText: 'Yes, Select',
            cancelText: 'Cancel',
            onConfirm: async () => {
                // Update status to "Selected" and move to HR Round
                const success = await updateStatus(applicant, 'Selected');
                if (success) {
                    // Show success message with green badge info
                    showToast('success', 'Selected', `${applicant.name} has been marked as Selected and moved to HR Round with green badge.`);
                }
            }
        });
    };

    const handleRejected = (applicant) => {
        showConfirmToast({
            title: 'Mark as Rejected',
            description: `Reject ${applicant.name}? This action cannot be undone.`,
            okText: 'Yes, Reject',
            cancelText: 'Cancel',
            onConfirm: async () => {
                // Update status to "Rejected"
                const success = await updateStatus(applicant, 'Rejected');
                if (success) {
                    showToast('error', 'Rejected', `${applicant.name} has been rejected and moved to Rejected tab.`);
                }
            }
        });
    };

    const handleMoveToRound = (applicant, roundName) => {
        showConfirmToast({
            title: 'Move to Another Round',
            description: `Move ${applicant.name} to "${roundName}"?`,
            okText: 'Yes, Move',
            cancelText: 'Cancel',
            onConfirm: async () => {
                // Update status to the selected round name
                const success = await updateStatus(applicant, roundName);
                if (success) {
                    showToast('success', 'Round Changed', `${applicant.name} has been moved to ${roundName}.`);
                }
            }
        });
    };

    const handleInitiateBGV = (applicant) => {
        setBgvCandidate(applicant);
        setShowBGVModal(true);
    };

    const handleBGVSuccess = () => {
        setShowBGVModal(false);
        setBgvCandidate(null);
        loadApplicants(); // Refresh to show updated BGV status
    };

    const openReviewPrompt = (applicant, status) => {
        setSelectedApplicant(applicant);
        setSelectedStatusForReview(status);
        setReviewRating(0);
        setReviewFeedback('');
        setShowEvaluationDrawer(true);
    };

    const submitReviewAndStatus = async () => {
        if (!selectedApplicant || !selectedStatusForReview) return;

        setLoading(true);
        try {
            // 1. If finishing interview, mark it complete in DB first
            if (isFinishingInterview) {
                await api.put(`/requirements/applicants/${selectedApplicant._id}/interview/complete`);
            }

            // 2. Update status with review and full scorecard
            const success = await updateStatus(selectedApplicant, selectedStatusForReview, {
                rating: reviewRating,
                feedback: reviewFeedback,
                scorecard: evaluationData
            });

            if (success) {
                const status = selectedStatusForReview; // Save before clear
                const applicant = selectedApplicant;

                setShowEvaluationDrawer(false);
                setShowReviewModal(false);
                setIsFinishingInterview(false);
                setReviewRating(0);
                setReviewFeedback('');
                setSelectedStatusForReview('');
                setEvalActiveRound(0);

                // Trigger scheduling if appropriate
                if (status === 'Shortlisted' || status.includes('Interview')) {
                    openScheduleModal(applicant);
                }
            }
        } catch (error) {
            showToast('error', 'Error', "Failed to complete action: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    async function loadApplicants() {
        setLoading(true);
        try {
            // Uses centralized api instance - automatically includes Authorization & X-Tenant-ID headers
            const params = new URLSearchParams({ _t: String(Date.now()) });
            if (jobSpecific && selectedReqId && selectedReqId !== 'all') {
                params.set('requirementId', selectedReqId);
            }
            const res = await api.get(`/requirements/applicants?${params.toString()}`);
            const data = res.data?.data || res.data || [];
            setApplicants(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            showToast('error', 'Error', 'Failed to load applicants');
        } finally {
            setLoading(false);
        }
    }

    async function lockApplicantSalary(app) {
        try {
            if (!window.confirm('Are you sure you want to lock this salary? Once locked, you cannot modify it.')) return;
            const res = await api.post(`/salary/confirm`, { applicantId: app._id });
            if (res.data?.success) {
                showToast('success', 'Success', 'Salary Locked successfully!');
                loadApplicants();
            } else {
                showToast('error', 'Error', res.data?.message || 'Failed to lock salary');
            }
        } catch (err) {
            console.error('Lock Salary Error:', err);
            showToast('error', 'Error', err.response?.data?.message || err.message || 'Failed to lock salary');
        }
    }
    async function fetchTemplates() {
        // Fetch Offer Templates
        try {
            const offerRes = await api.get('/letters/templates?type=offer');
            setTemplates(offerRes.data || []);
        } catch (err) {
            console.error("Failed to load offer templates", err);
        }

        // Fetch Joining Templates (independently)
        try {
            const joiningRes = await api.get('/letters/templates?type=joining');
            setJoiningTemplates(joiningRes.data || []);
        } catch (err) {
            // Non-critical, just log
            console.warn("Failed to load joining templates (might be empty or missing permission)", err.message);
        }

        // Fetch Email Templates (independently)
        try {
            const emailRes = await api.get('/email-templates');
            const templatesList = emailRes.data?.templates || emailRes.data || [];
            setEmailTemplates(templatesList.filter(t => t.isActive !== false));
        } catch (err) {
            console.warn("Failed to load email templates (might be empty or missing permission)", err.message);
        }
    }


    // Unified data refresh function
    const refreshData = async () => {
        setLoading(true);
        const promises = [fetchTemplates()];
        if (!jobSpecific || !selectedReqId || selectedReqId === 'all') {
            promises.push(loadApplicants());
        }
        await Promise.all(promises);
        setLoading(false);
    };

    useEffect(() => {
        if (user) {
            refreshData();
        }
    }, [user]); // Keep user as dependency to re-run if auth state changes

    useEffect(() => {
        if (user && jobSpecific && selectedReqId && selectedReqId !== 'all') {
            loadApplicants();
        }
    }, [user, jobSpecific, selectedReqId]);

    // ==================== DOCUMENT HELPER FUNCTIONS ====================

    // Helper function to check if all documents are verified
    const areAllDocumentsVerified = (applicant) => {
        if (!applicant.customDocuments || applicant.customDocuments.length === 0) {
            return false; // No documents uploaded, so CTC button should be disabled
        }
        return applicant.customDocuments.every(doc => doc.verified === true);
    };

    // Open document upload modal
    const openDocumentModal = (applicant) => {
        setDocumentApplicant(applicant);
        setUploadedDocuments(applicant.customDocuments || []);
        setDocumentName('');
        setDocumentFile(null);
        setShowDocumentModal(true);
    };

    // Handle document file selection
    const handleDocumentFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) {
                showToast('error', 'Error', 'Only PDF, JPG, and PNG files are allowed');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                showToast('error', 'Error', 'File size must be less than 5MB');
                return;
            }

            setDocumentFile(file);
        }
    };

    // Add document to list
    const addDocumentToList = () => {
        if (!documentName.trim()) {
            notification.error({ message: 'Error', description: 'Please enter document name', placement: 'topRight' });
            return;
        }

        if (!documentFile) {
            notification.error({ message: 'Error', description: 'Please select a file', placement: 'topRight' });
            return;
        }

        const newDoc = {
            name: documentName.trim(),
            fileName: documentFile.name,
            fileSize: documentFile.size,
            fileType: documentFile.type,
            file: documentFile,
            verified: false,
            uploadedAt: new Date()
        };

        setUploadedDocuments(prev => [...prev, newDoc]);
        setDocumentName('');
        setDocumentFile(null);

        const existingInput = document.getElementById('documentFileInput');
        if (existingInput) existingInput.value = '';

        notification.success({ message: 'Success', description: 'Document added to list', placement: 'topRight' });
    };

    // View Resume
    const handleViewResume = async (resumeFilename) => {
        if (!resumeFilename) {
            notification.warning({ message: 'No Resume', description: 'This applicant does not have a resume file.', placement: 'topRight' });
            return;
        }
        try {
            const response = await api.get(`/hr/resume/${resumeFilename}`, { responseType: 'blob' });
            const file = new Blob([response.data], { type: 'application/pdf' });
            const fileURL = URL.createObjectURL(file);
            setResumeUrl(fileURL);
            setIsResumeModalOpen(true);
        } catch (error) {
            console.error("View Resume Error:", error);
            let description = 'Failed to access resume file.';

            if (error.response?.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const json = JSON.parse(text);
                    if (json.message) description = json.message;
                    if (json.debug) console.warn("Resume Debug Info:", json.debug);
                } catch (e) { /* ignore json parse error */ }
            } else if (error.response?.data?.message) {
                description = error.response.data.message;
            }

            notification.error({ message: 'Error', description, placement: 'topRight' });
        }
    };

    // Remove document from list
    const removeDocumentFromList = (index) => {
        setUploadedDocuments(prev => prev.filter((_, idx) => idx !== index));
    };

    // Save all documents to backend
    const saveDocuments = async () => {
        if (uploadedDocuments.length === 0) {
            notification.error({ message: 'Error', description: 'Please add at least one document', placement: 'topRight' });
            return;
        }

        try {
            const formData = new FormData();

            uploadedDocuments.forEach((doc, index) => {
                if (doc.file) {
                    formData.append('documents', doc.file);
                    formData.append(`documentNames[${index}]`, doc.name);
                }
            });

            await api.post(
                `/requirements/applicants/${documentApplicant._id}/documents`,
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' }
                }
            );

            notification.success({ message: 'Success', description: 'Documents uploaded successfully', placement: 'topRight' });
            setShowDocumentModal(false);
            loadApplicants();
        } catch (err) {
            console.error('Document upload error:', err);
            notification.error({ message: 'Error', description: err.response?.data?.message || 'Failed to upload documents', placement: 'topRight' });
        }
    };

    // Verify a specific document
    const verifyDocument = async (applicantId, documentIndex) => {
        try {
            await api.patch(
                `/requirements/applicants/${applicantId}/documents/${documentIndex}/verify`
            );

            notification.success({ message: 'Success', description: 'Document verified', placement: 'topRight' });
            loadApplicants();
        } catch (err) {
            console.error('Document verification error:', err);
            notification.error({ message: 'Error', description: 'Failed to verify document', placement: 'topRight' });
        }
    };

    // ==================== END DOCUMENT FUNCTIONS ====================

    // Ensure templates are fresh when opening the modal
    useEffect(() => {
        if (showModal) {
            fetchTemplates();
        }
    }, [showModal]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Applied': return 'bg-blue-100 text-blue-800';
            case 'Shortlisted': return 'bg-yellow-100 text-yellow-800';
            case 'Selected': return 'bg-green-100 text-green-800';
            case 'Offer Issued': return 'bg-purple-100 text-purple-800';
            case 'Offer Accepted': return 'bg-indigo-100 text-indigo-800';
            case 'Offer Accepted – Awaiting Company Approval': return 'bg-cyan-100 text-cyan-800';
            case 'Fully Signed': return 'bg-emerald-600 text-white';
            case 'Joining Letter Issued': return 'bg-cyan-100 text-cyan-800';
            case 'Hired': return 'bg-emerald-600 text-white';
            case 'Rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'Applied': return 'bg-blue-50/50 text-blue-600 border-blue-100';
            case 'Shortlisted': return 'bg-indigo-50/50 text-indigo-600 border-indigo-100';
            case 'Interview Scheduled':
            case 'Interview Rescheduled':
            case 'New Round':
                return 'bg-amber-50/50 text-amber-600 border-amber-100';
            case 'Interview Completed': return 'bg-emerald-50/50 text-emerald-600 border-emerald-100';
            case 'Selected': return 'bg-emerald-500 text-white border-emerald-600';
            case 'Offer Issued': return 'bg-purple-50/50 text-purple-600 border-purple-100';
            case 'Offer Accepted': return 'bg-indigo-50/50 text-indigo-600 border-indigo-100';
            case 'Offer Accepted – Awaiting Company Approval': return 'bg-cyan-50/50 text-cyan-600 border-cyan-100';
            case 'Fully Signed': return 'bg-emerald-500 text-white border-emerald-600 shadow-lg';
            case 'Joining Letter Issued': return 'bg-cyan-50/50 text-cyan-600 border-cyan-100';
            case 'Hired': return 'bg-emerald-600 text-white border-emerald-700';
            case 'Rejected': return 'bg-red-50/50 text-red-600 border-red-100';
            default: return 'bg-slate-50/50 text-slate-600 border-slate-100';
        }
    };

    const resetOfferLetterUi = () => {
        setShowModal(false);
        setShowPreview(false);
        setPreviewPdfUrl(null);
    };

    const resetJoiningLetterUi = () => {
        setShowJoiningModal(false);
        setShowJoiningPreview(false);
        setJoiningPreviewUrl(null);
        setJoiningPreviewHtml(null);
    };

    const loadOfferPreviewPdf = async (responseData = {}) => {
        const previewPath = normalizeOfferPreviewFilePath(
            responseData.previewFilePath ||
            responseData.pdfPath ||
            responseData.downloadUrl ||
            responseData.fileUrl ||
            responseData.previewUrl
        );

        if (!previewPath) return null;

        const fileRes = await api.get('/letters/preview-file', {
            params: { path: previewPath },
            responseType: 'blob',
            timeout: 150000
        });

        const contentType = String(fileRes.headers?.['content-type'] || 'application/pdf').toLowerCase();
        const blob = fileRes.data instanceof Blob
            ? fileRes.data
            : new Blob([fileRes.data], { type: contentType });

        if (contentType.includes('text/html')) {
            return { htmlContent: await blob.text() };
        }

        if (!contentType.includes('pdf')) {
            throw new Error('Generated preview did not return a PDF file.');
        }

        return {
            pdfUrl: `${window.URL.createObjectURL(blob)}${PDF_VIEWER_HASH}`
        };
    };

    const closeOfferPreview = () => {
        setShowPreview(false);
        setPreviewPdfUrl(null);
    };

    const handleSendDocumentRequest = async (applicant) => {
        try {
            const res = await api.post(`/recruitment/candidate-documents/request/${applicant._id || applicant.applicationId}`);
            if (res.data.success) {
                notification.success({ message: 'Success', description: 'Document upload link sent to candidate', placement: 'topRight' });
                loadApplicants(); // Refresh list to get updated status
            }
        } catch (err) {
            notification.error({ message: 'Error', description: err.response?.data?.message || 'Failed to send request', placement: 'topRight' });
        }
    };

    const openOfferModal = async (applicant) => {
        resetJoiningLetterUi();
        setSelectedApplicant(applicant);

        // Fetch Next ID from the Enterprise Engine
        let targetRefNo = 'Fetching...';
        setOfferData(prev => ({ ...prev, refNo: 'Fetching...' }));

        try {
            const res = await api.post('/company-id-config/next', { entityType: 'OFFER', increment: false });
            const payload = res.data?.data;
            const fromApi = payload?.id || res.data?.nextId;
            if (fromApi) {
                targetRefNo = fromApi;
            } else {
                targetRefNo = `OFFER/${new Date().getFullYear()}/${String(Math.floor(1000 + Math.random() * 9000)).padStart(4, '0')}`;
            }
        } catch (err) {
            console.error("Failed to fetch next Offer ID", err);
            targetRefNo = `OFFER/${new Date().getFullYear()}/${String(Math.floor(1000 + Math.random() * 9000)).padStart(4, '0')}`;
        }

        const defaultExpiry = dayjs().add(48, 'hour');
        setOfferExpiryAtText(defaultExpiry.format('DD-MM-YYYY HH:mm'));
        const candidateMobile = applicant.mobile || applicant.phone || applicant.contactNo || applicant.phone_no || (applicant.contact !== applicant.name ? applicant.contact : '') || '';
        const candidateProbationPeriod = applicant.probationPeriod || applicant.requirementId?.probationPeriod || '';
        setOfferData({
            joiningDate: applicant.joiningDate ? dayjs(applicant.joiningDate).format('YYYY-MM-DD') : '',
            expiryAt: defaultExpiry.toISOString(),
            location: applicant.workLocation || applicant.location || 'Ahmedabad',
            templateId: '',
            emailTemplateId: '',
            position: applicant.requirementId?.jobTitle || '',
            jobCategory: applicant.jobCategory || 'Full Time',
            probationPeriod: candidateProbationPeriod,
            templateContent: '',
            isWordTemplate: false,
            refNo: targetRefNo,
            relationType: normalizeOfferRelationType(applicant.relationType),
            salutation: inferOfferTitle(applicant, applicant.salutation || ''),
            address: applicant.address || '',
            issueDate: dayjs().format('YYYY-MM-DD'),
            name: applicant.name,
            dearName: applicant.name?.split(' ')[0] || applicant.name,
            email: applicant.email || '',
            approverEmail: '',
            mobile: candidateMobile,
            dateFormat: 'Do MMM. YYYY',
            signaturePosition: { alignment: 'right' },
            customData: applicant.customData || {}
        });
        setPreviewPdfUrl(null);
        setShowModal(true);
        setShowPreview(false);
    };

    const handleOfferChange = (e) => {
        const { name, value } = e.target;
        setOfferData(prev => {
            const updates = { ...prev, [name]: value };

            // If job category changes, update the refNo prefix if applicable
            if (name === 'jobCategory') {
                if (value === 'Intern') {
                    // Change OFF to INT in reference number
                    updates.refNo = updates.refNo.replace('/OFF/', '/INT/').replace('OFFER/', 'INTERN/');
                } else {
                    // Revert INT to OFF
                    updates.refNo = updates.refNo.replace('/INT/', '/OFF/').replace('INTERN/', 'OFFER/');
                }
            }

            // If template selected, save its content for preview
            if (name === 'templateId') {
                const selectedTemplate = templates.find(t => t._id === value);
                if (selectedTemplate) {
                    updates.templateContent = selectedTemplate.bodyContent;
                    updates.isWordTemplate = (selectedTemplate.templateType === 'WORD');
                    const nextCustomData = {};
                    const offerFields = normalizeTemplateCustomFields(selectedTemplate);
                    const hasSurnameField = offerFields.some((field) => {
                        const key = String(field.key || '').toLowerCase();
                        return key.includes('surname') || key.includes('last_name') || key.includes('lastname');
                    });
                    const splitCandidateName = (value = '') => {
                        const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
                        if (parts.length <= 1) return { first: parts[0] || '', middle: '', last: '' };
                        return {
                            first: parts[0],
                            middle: parts.slice(1, -1).join(' '),
                            last: parts[parts.length - 1]
                        };
                    };

                    offerFields.forEach((field) => {
                        const key = String(field.key || '').toLowerCase();
                        let autoValue = '';

                        // Logic to auto-fill from selectedApplicant
                        if (selectedApplicant) {
                            const candidateFullName = selectedApplicant.name || selectedApplicant.fullName || '';
                            const nameParts = splitCandidateName(candidateFullName);
                            const firstMiddleName = [nameParts.first, nameParts.middle].filter(Boolean).join(' ');

                            if (key.includes('candidate_title') || key === 'title' || key.includes('salutation')) {
                                autoValue = updates.salutation || inferOfferTitle(selectedApplicant) || '';
                            } else if (key.includes('surname') || key.includes('last_name') || key.includes('lastname')) {
                                autoValue = selectedApplicant.surname || selectedApplicant.lastName || nameParts.last || '';
                            } else if ((key === 'candidate_name' || key === 'name' || key.includes('candidate_name') || key.includes('employee_name')) && !key.includes('father') && !key.includes('dear')) {
                                autoValue = hasSurnameField ? (firstMiddleName || candidateFullName) : candidateFullName;
                            } else if (key.includes('dear')) {
                                autoValue = selectedApplicant.name?.split(' ')[0] || selectedApplicant.name || '';
                            } else if (key.includes('email')) {
                                autoValue = selectedApplicant.email || '';
                            } else if (key.includes('phone') || key.includes('mobile') || key.includes('contact') || key.includes('phon_no')) {
                                autoValue = selectedApplicant.phone || selectedApplicant.mobile || selectedApplicant.contact || selectedApplicant.contactNo || selectedApplicant.phone_no || '';
                            } else if (key.includes('designation') || key.includes('position') || key.includes('job_title') || key.includes('desingnation')) {
                                autoValue = selectedApplicant.requirementId?.jobTitle || selectedApplicant.position || updates.position || '';
                            } else if (key.includes('joining_date')) {
                                autoValue = updates.joiningDate ? toDisplayDate(updates.joiningDate, updates.dateFormat) : '';
                            } else if (key.includes('address')) {
                                autoValue = selectedApplicant.address || selectedApplicant.currentAddress || '';
                            } else if (key.includes('father_name')) {
                                autoValue = selectedApplicant.fatherName || '';
                            } else if (key.includes('relation_type') || key.includes('relationship_type') || key === 'relationship') {
                                autoValue = normalizeOfferRelationType(updates.relationType || selectedApplicant.relationType);
                            } else if (key.includes('ref_no') || key.includes('reference_no')) {
                                autoValue = updates.refNo || '';
                            } else if (key.includes('issue_date') || key.includes('issued_date') || key === 'isue_date' || key === 'current_date') {
                                autoValue = updates.issueDate ? toDisplayDate(updates.issueDate, updates.dateFormat) : toDisplayDate(dayjs(), updates.dateFormat);
                            } else if (key === 'probation' || key.includes('probation_period') || key.includes('probration')) {
                                autoValue = updates.probationPeriod || '';
                            } else if (key.startsWith('salary') || key.startsWith('salary.')) {
                                // Auto-fill from salary snapshot
                                const snap = resolveSalarySnapshot(selectedApplicant);
                                const salaryVars = buildSalaryVarsFromSnapshot(snap);
                                autoValue = salaryVars[field.key] !== undefined ? String(salaryVars[field.key]) : (salaryVars[key] !== undefined ? String(salaryVars[key]) : '');
                            }
                        }

                        nextCustomData[field.key] = autoValue || prev.customData?.[field.key] || '';
                    });
                    // Merge salary vars directly so all salary.xxx.yyy keys are covered
                    const salaryMerge = buildSalaryVarsFromSnapshot(resolveSalarySnapshot(selectedApplicant));
                    Object.entries(salaryMerge).forEach(([k, v]) => {
                        if (!(k in nextCustomData)) nextCustomData[k] = String(v);
                    });
                    updates.customData = nextCustomData;
                    setPreviewPdfUrl(null); // Reset when template changes
                }
            }
            if (name === 'joiningDate' || name === 'refNo' || name === 'issueDate' || name === 'name' || name === 'relationType' || name === 'salutation' || name === 'probationPeriod' || name === 'dateFormat') {
                const customKeyMap = {
                    'joiningDate': ['joining_date'],
                    'refNo': ['ref_no', 'reference_no'],
                    'issueDate': ['issue_date', 'issued_date', 'isue_date', 'current_date'],
                    'name': ['name', 'vandidate', 'cvandidate'],
                    'relationType': ['relation_type', 'relationship_type', 'relationship'],
                    'salutation': ['candidate_title', 'title'],
                    'probationPeriod': ['probation', 'probation_period', 'probration']
                };
                const nextCustomData = { ...(prev.customData || {}) };
                
                if (name === 'dateFormat') {
                    const issueKeys = ['issue_date', 'issued_date', 'isue_date', 'current_date'];
                    const joinKeys = ['joining_date'];
                    issueKeys.forEach(k => {
                        const actualKey = Object.keys(nextCustomData).find(ck => ck.toLowerCase() === k.toLowerCase());
                        if (actualKey) {
                            nextCustomData[actualKey] = toDisplayDate(updates.issueDate, value);
                        }
                    });
                    joinKeys.forEach(k => {
                        const actualKey = Object.keys(nextCustomData).find(ck => ck.toLowerCase() === k.toLowerCase());
                        if (actualKey) {
                            nextCustomData[actualKey] = toDisplayDate(updates.joiningDate, value);
                        }
                    });
                } else if (name === 'name') {
                    const hasSurnameField = Object.keys(nextCustomData).some(k => {
                        const lk = k.toLowerCase();
                        return lk.includes('surname') || lk.includes('last_name') || lk.includes('lastname');
                    });
                    
                    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
                    const firstMiddleName = parts.length > 1 ? parts.slice(0, -1).join(' ') : value;
                    const lastName = parts.length > 1 ? parts[parts.length - 1] : '';

                    Object.keys(nextCustomData).forEach(actualKey => {
                        const lk = actualKey.toLowerCase();
                        if (customKeyMap.name.some(k => lk === k.toLowerCase())) {
                            nextCustomData[actualKey] = hasSurnameField ? (firstMiddleName || value) : value;
                        } else if (lk.includes('surname') || lk.includes('last_name') || lk.includes('lastname')) {
                            nextCustomData[actualKey] = lastName;
                        }
                    });
                } else {
                    const keysToUpdate = customKeyMap[name] || [];
                    keysToUpdate.forEach(k => {
                        const actualKey = Object.keys(nextCustomData).find(ck => ck.toLowerCase() === k.toLowerCase());
                        if (actualKey) {
                            if (name === 'joiningDate' || name === 'issueDate') {
                                nextCustomData[actualKey] = value ? toDisplayDate(value, updates.dateFormat) : '';
                            } else {
                                nextCustomData[actualKey] = value;
                            }
                        }
                    });
                }
                updates.customData = nextCustomData;
            }

            return updates;
        });
    };

    const handleOfferCustomFieldChange = (key, value) => {
        const normalizedKey = normalizeVariableKey(key);
        setOfferData(prev => ({
            ...prev,
            customData: {
                ...(prev.customData || {}),
                [normalizedKey]: value
            }
        }));
    };

    const handleJoiningTemplateChange = (templateId) => {
        setJoiningTemplateId(templateId);
        const selectedTemplate = joiningTemplates.find(t => String(t._id) === String(templateId));
        const nextCustomData = {};
        const joiningFields = normalizeTemplateCustomFields(selectedTemplate);
        const hasSurnameField = joiningFields.some((field) => {
            const key = String(field.key || '').toLowerCase();
            return key.includes('surname') || key.includes('last_name') || key.includes('lastname');
        });
        const splitCandidateName = (value = '') => {
            const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
            if (parts.length <= 1) return { first: parts[0] || '', middle: '', last: '' };
            return {
                first: parts[0],
                middle: parts.slice(1, -1).join(' '),
                last: parts[parts.length - 1]
            };
        };

        joiningFields.forEach((field) => {
            const key = String(field.key || '').toLowerCase();
            let autoValue = '';

            if (selectedApplicant) {
                const candidateFullName = selectedApplicant.name || selectedApplicant.fullName || '';
                const nameParts = splitCandidateName(candidateFullName);
                const firstMiddleName = [nameParts.first, nameParts.middle].filter(Boolean).join(' ');

                if (key.includes('candidate_title') || key === 'title' || key.includes('salutation')) {
                    autoValue = joiningSalutation || inferOfferTitle(selectedApplicant) || '';
                } else if (key.includes('surname') || key.includes('last_name') || key.includes('lastname')) {
                    autoValue = selectedApplicant.surname || selectedApplicant.lastName || nameParts.last || '';
                } else if ((key === 'candidate_name' || key === 'name' || key.includes('candidate_name') || key.includes('employee_name')) && !key.includes('father')) {
                    autoValue = hasSurnameField ? (firstMiddleName || candidateFullName) : candidateFullName;
                } else if (key.includes('email')) {
                    autoValue = selectedApplicant.email || '';
                } else if (key.includes('phone') || key.includes('mobile') || key.includes('contact') || key.includes('phon_no') || key.includes('phon')) {
                    autoValue = selectedApplicant.phone || selectedApplicant.mobile || selectedApplicant.contact || selectedApplicant.contactNo || selectedApplicant.phone_no || '';
                } else if (key.includes('designation') || key.includes('desingnation') || key.includes('position') || key.includes('job_title')) {
                    autoValue = selectedApplicant.requirementId?.jobTitle || selectedApplicant.position || selectedApplicant.designation || '';
                } else if (key.includes('joining_date')) {
                    autoValue = selectedApplicant.joiningDate ? dayjs(selectedApplicant.joiningDate).format('DD-MM-YYYY') : '';
                } else if (key.includes('address')) {
                    autoValue = selectedApplicant.address || selectedApplicant.currentAddress || '';
                } else if (key.includes('father_name')) {
                    autoValue = selectedApplicant.fatherName || '';
                } else if (key.includes('relation_type') || key.includes('relationship_type') || key === 'relationship') {
                    autoValue = normalizeOfferRelationType(joiningRelationType || selectedApplicant.relationType);
                } else if (key.includes('ref_no') || key.includes('reference_no')) {
                    autoValue = joiningRefNo || '';
                } else if (key.includes('issue_date') || key.includes('issued_date')) {
                    autoValue = joiningIssueDate ? dayjs(joiningIssueDate).format('DD-MM-YYYY') : '';
                } else if (key.includes('expiry_date')) {
                    autoValue = joiningExpiryAt ? dayjs(joiningExpiryAt).format('DD-MM-YYYY') : '';
                } else if (key.startsWith('salary') || key.startsWith('salary.')) {
                    const snap = resolveSalarySnapshot(selectedApplicant);
                    const salaryVars = buildSalaryVarsFromSnapshot(snap);
                    autoValue = salaryVars[field.key] !== undefined ? String(salaryVars[field.key]) : (salaryVars[key] !== undefined ? String(salaryVars[key]) : '');
                }
            }

            nextCustomData[field.key] = autoValue || joiningCustomData?.[field.key] || '';
        });
        // Merge all salary vars so every salary.xxx.yyy key is covered regardless of template field list
        const salaryMerge = buildSalaryVarsFromSnapshot(resolveSalarySnapshot(selectedApplicant));
        Object.entries(salaryMerge).forEach(([k, v]) => {
            if (!(k in nextCustomData)) nextCustomData[k] = String(v);
        });
        setJoiningCustomData(nextCustomData);
    };

    const handleJoiningCustomFieldChange = (key, value) => {
        const normalizedKey = normalizeVariableKey(key);
        setJoiningCustomData(prev => ({
            ...(prev || {}),
            [normalizedKey]: value
        }));
    };

    const handlePreview = async () => {
        if (!offerData.templateId) {
            notification.error({ message: 'Error', description: 'Please select an offer letter template', placement: 'topRight' });
            return;
        }
        if (!offerData.joiningDate) {
            notification.error({ message: 'Error', description: 'Please select the joining date for this offer letter first', placement: 'topRight' });
            return;
        }
        if (!offerData.expiryAt) {
            notification.error({ message: 'Error', description: 'Please select Offer Expiry Date & Time', placement: 'topRight' });
            return;
        }
        const expiryMs = new Date(offerData.expiryAt).getTime();
        // Allow a 5-minute buffer (300,000ms) for validation to avoid strict "past" errors during submission
        if (!expiryMs || Number.isNaN(expiryMs) || expiryMs <= Date.now() - 300000) {
            notification.error({ message: 'Error', description: 'Offer expiry must be a future datetime', placement: 'topRight' });
            return;
        }

        // Validation: Only block if job category explicitly requires salary (Salary Mandatory)
        const isSalaryMandatoryCategory = String(offerData.jobCategory || '').toLowerCase().includes('salary mandatory');
        if (isSalaryMandatoryCategory && !selectedApplicant.salaryLocked) {
            notification.error({ 
                message: 'Salary Missing', 
                description: 'This offer template requires a salary breakdown. Please assign and lock the candidate salary first.', 
                placement: 'topRight' 
            });
            return;
        }

        if (offerData.isWordTemplate) {
            setGenerating(true);
            try {
                const payload = {
                    applicantId: selectedApplicant._id,
                    templateId: offerData.templateId,
                    emailTemplateId: offerData.emailTemplateId,
                    joiningDate: offerData.joiningDate,
                    expiryAt: offerData.expiryAt,
                    location: offerData.location,
                    address: offerData.address,
                    refNo: offerData.refNo, // Pass the user-edited Ref No
                    salutation: offerData.salutation,
                    relationType: offerData.relationType,
                    approverEmail: offerData.approverEmail,
                    issueDate: offerData.issueDate,
                    // issueDate: offerData.issueDate,
                    name: offerData.name,
                    dearName: offerData.dearName,
                    dateFormat: offerData.dateFormat,
                    signaturePosition: offerData.signaturePosition,
                    probationPeriod: offerData.probationPeriod,
                    customData: buildOfferCustomData({ ...offerData, salarySnapshot: resolveSalarySnapshot(selectedApplicant) }),
                    preview: true // Tell backend this is just a preview
                };

                const res = await api.post('/letters/generate-offer', payload, { timeout: 150000 });
                const responseData = res.data || {};

                try {
                    const previewResult = await loadOfferPreviewPdf(responseData);
                    if (previewResult?.pdfUrl) {
                        setPreviewPdfUrl(previewResult.pdfUrl);
                        setOfferData(prev => ({ ...prev, htmlContent: '', isWordPreview: false }));
                        setShowPreview(true);
                        return;
                    }
                    if (previewResult?.htmlContent) {
                        setPreviewPdfUrl(null);
                        setOfferData(prev => ({
                            ...prev,
                            htmlContent: previewResult.htmlContent,
                            isWordPreview: true
                        }));
                        setShowPreview(true);
                        return;
                    }
                } catch (previewFileError) {
                    console.warn("Preview PDF file could not be loaded; falling back to inline preview", previewFileError);
                    if (!responseData.htmlContent) throw previewFileError;
                }

                if (responseData.isPreview && responseData.htmlContent) {
                    setPreviewPdfUrl(null);
                    setOfferData(prev => ({
                        ...prev,
                        htmlContent: responseData.htmlContent,
                        isWordPreview: true
                    }));
                    setShowPreview(true);
                } else {
                    throw new Error('Preview generated, but no preview document was returned.');
                }
            } catch (err) {
                console.error("Preview generation failed", err);
                const msg = err.response?.data?.message || err.message || "Failed to generate preview";

                if (err.response?.status === 404 && !err.response?.data?.message) {
                    notification.error({ message: 'Error', description: `Preview failed: Server endpoint not found (404). Please ensure the backend server is running and the route '/api/letters/generate-offer' exists.`, placement: 'topRight' });
                } else {
                    notification.error({ message: 'Error', description: `Preview failed: ${msg}`, placement: 'topRight' });
                }
            } finally {
                setGenerating(false);
            }
        } else {
            setShowPreview(true);
        }
    };

    const openCompanyApprovalModal = async (applicant, type = 'offer') => {
        setApplicantForApproval(applicant);
        setApprovalType(type);
        setCompanyApprovalModalVisible(true);
        setPdfPreviewUrl(null); // Reset

        // Fetch the PDF URL for preview
        try {
            const resLetters = await api.get(`/letters/generated-letters?applicantId=${applicant._id}`);
            const targetLetter = (resLetters.data?.data || []).find(l => l.letterType?.toLowerCase().includes(type));

            if (targetLetter) {
                const tenantId = user?.tenantId || api.defaults.headers['X-Tenant-ID'] || api.defaults.headers['x-tenant-id'];
                // Use the view-pdf route which serves the file
                const url = `${API_ROOT}/api/public/letters/${targetLetter._id}/view-pdf?tenantId=${tenantId}&ts=${Date.now()}#toolbar=0&navpanes=0&scrollbar=0`;
                setPdfPreviewUrl(url);
            }
        } catch (err) {
            console.error(`Failed to load ${type} PDF preview for approval modal`, err);
        }
    };

    const handleApproveCompany = async () => {
        // if (!companySig) {
        //     notification.error({ message: 'Error', description: 'Company signature is required', placement: 'topRight' });
        //     return;
        // }

        setIsApproving(true);
        try {
            const resLetters = await api.get(`/letters/generated-letters?applicantId=${applicantForApproval._id}`);
            const targetLetter = (resLetters.data?.data || []).find(l => l.letterType?.toLowerCase().includes(approvalType));

            if (!targetLetter) {
                throw new Error(`${approvalType === 'offer' ? 'Offer' : 'Joining'} letter not found for this applicant.`);
            }

            const endpoint = approvalType === 'offer' 
                ? `/letters/${targetLetter._id}/approve-company-signature`
                : `/letters/${targetLetter._id}/approve-company-joining-signature`;

            await api.post(endpoint, {
                signatureImage: companySig,
                stampImage: companyStamp,
                stampSettings: stampSettings
            });

            if (approvalType === 'offer') {
                notification.success({
                    message: 'Success',
                    description: 'Offer letter approved and fully signed by company. Next steps: BGV initiation.',
                    placement: 'topRight'
                });
                // Phase 2: Start BGV automatically (Streamlining workflow)
                try {
                    await api.post('/bgv/initiate', {
                        applicationId: applicantForApproval._id,
                        package: 'BASIC',
                        slaDays: 7
                    });
                    console.log('✅ [AUTO_BGV] BGV Initiated automatically for:', applicantForApproval.name);
                } catch (bgvErr) {
                    console.warn('⚠️ [AUTO_BGV] BGV Auto-initiate failed (non-blocking):', bgvErr.message);
                }
            } else {
                notification.success({
                    message: 'Onboarding Started',
                    description: 'Joining letter finalized. Candidate has been notified with login credentials.',
                    placement: 'topRight'
                });
            }

            setCompanyApprovalModalVisible(false);
            setApplicantForApproval(null);
            // Phase 2: Start BGV automatically (Streamlining workflow)
            try {
                await api.post('/bgv/initiate', {
                    applicationId: applicantForApproval._id,
                    package: 'BASIC', // Use BASIC as default for streamline
                    slaDays: 7
                });
                console.log('✅ [AUTO_BGV] BGV Initiated automatically for:', applicantForApproval.name);
            } catch (bgvErr) {
                console.warn('⚠️ [AUTO_BGV] BGV Auto-initiate failed (non-blocking):', bgvErr.message);
            }

            loadApplicants();
        } catch (err) {
            console.error('[APPROVE_COMPANY] Error:', err);
            notification.error({
                message: 'Approval Failed',
                description: err.response?.data?.message || err.message,
                placement: 'topRight'
            });
        } finally {
            setIsApproving(false);
        }
    };

    const handleGenerateClick = (e) => {
        if (e) e.preventDefault();
        setWorkflowLetterType('offer');
        
        // Ensure approvalEmails is an array format
        if (!Array.isArray(approvalEmails) || approvalEmails.length === 0) {
            setApprovalEmails([
                { roleName: 'Manager', email: '', name: 'Manager' },
                { roleName: 'HR Head', email: '', name: 'HR Head' },
                { roleName: 'CEO', email: '', name: 'CEO' }
            ]);
        }
        setApprovalEmailsModalVisible(true);
    };

    const handleConfirmApprovalWorkflow = async (e) => {
        if (e) e.preventDefault();
        
        // Validate emails are not empty
        const invalid = approvalEmails.some(a => !a.email || !a.roleName);
        if (invalid || approvalEmails.length === 0) {
            notification.error({ message: 'Error', description: 'All approval roles and emails are required.', placement: 'topRight' });
            return;
        }

        setApprovalEmailsModalVisible(false);
        
        if (workflowLetterType === 'offer') {
            await submitOffer(null, { customApprovers: approvalEmails });
        } else {
            await handleJoiningGenerate(null, { customApprovers: approvalEmails });
        }
    };

    const submitOffer = async (e, overrides = null) => {
        if (e) e.preventDefault();
        if (!selectedApplicant) return;
        if (!offerData.templateId) {
            notification.error({ message: 'Error', description: 'Please select an offer letter template', placement: 'topRight' });
            return;
        }

        // Validation: Only block if job category explicitly requires salary (Salary Mandatory)
        const isSalaryMandatoryForGenerate = String(offerData.jobCategory || '').toLowerCase().includes('salary mandatory');
        if (isSalaryMandatoryForGenerate && !selectedApplicant.salaryLocked) {
            notification.error({ 
                message: 'Salary Required', 
                description: 'This offer template requires a salary breakdown. Please assign and lock the candidate salary before generating the final offer.', 
                placement: 'topRight' 
            });
            return;
        }

        const customApprovers = overrides?.customApprovers || [];

        setGenerating(true);
        try {
            // Use unified letter generation endpoint
            const payload = {
                applicantId: selectedApplicant._id,
                templateId: offerData.templateId,
                emailTemplateId: offerData.emailTemplateId,
                joiningDate: offerData.joiningDate,
                expiryAt: offerData.expiryAt,
                location: offerData.location,
                address: offerData.address,
                refNo: offerData.refNo, // Pass user-edited Ref No
                salutation: offerData.salutation,
                relationType: offerData.relationType,
                approverEmail: offerData.approverEmail,
                issueDate: offerData.issueDate,
                name: offerData.name,
                dearName: offerData.dearName,
                dateFormat: offerData.dateFormat,
                signaturePosition: offerData.signaturePosition,
                jobCategory: offerData.jobCategory,
                probationPeriod: offerData.probationPeriod,
                customData: buildOfferCustomData({ ...offerData, salarySnapshot: resolveSalarySnapshot(selectedApplicant) }),
                customWorkflow: !!(customApprovers && customApprovers.length > 0)
            };

            const res = await api.post('/letters/generate-offer', payload, { timeout: 150000 });

            if (res.data.success) {
                // If custom workflow is enabled, trigger the custom workflow API
                if (payload.customWorkflow && (res.data.letterId || res.data.generatedLetterId)) {
                    try {
                        await api.post('/letters/start-custom-workflow', {
                            applicantId: selectedApplicant._id,
                            generatedLetterId: res.data.letterId || res.data.generatedLetterId,
                            letterType: 'offer',
                            steps: customApprovers
                        });
                        notification.success({ 
                            message: 'Success', 
                            description: 'Offer Letter generated and custom workflow started!', 
                            placement: 'topRight' 
                        });
                    } catch (cwErr) {
                        console.error('Custom workflow start error:', cwErr);
                        notification.warning({
                            message: 'Warning',
                            description: 'Offer generated but failed to start custom workflow.',
                            placement: 'topRight'
                        });
                    }
                } else {
                    notification.success({ 
                        message: 'Success', 
                        description: 'Offer Letter generated successfully!', 
                        placement: 'topRight' 
                    });
                }

                setShowModal(false);
                closeOfferPreview();
                loadApplicants(); // Refresh to show status change
            } else {
                notification.warning({ message: 'Warning', description: 'Offer generated but no delivery confirmation received', placement: 'topRight' });
            }
        } catch (err) {
            console.error(err);
            const errCode = String(err.response?.data?.code || '').trim();
            const msg = err.response?.data?.message || err.message || "Failed to generate and send offer letter";

            // If offer already exists or workflow blocks re-generation, open latest issued offer.
            if (
                selectedApplicant?._id &&
                ['ACTIVE_OFFER_EXISTS', 'OFFER_ALREADY_ACCEPTED', 'INVALID_WORKFLOW_TRANSITION'].includes(errCode)
            ) {
                try {
                    const resLetters = await api.get(`/letters/generated-letters?applicantId=${selectedApplicant._id}`);
                    const offerLetters = (resLetters.data?.data || []).filter((l) =>
                        String(l?.letterType || '').toLowerCase().includes('offer')
                    );
                    const latestOffer = offerLetters.sort((a, b) => {
                        const aTime = new Date(a?.createdAt || a?.updatedAt || 0).getTime();
                        const bTime = new Date(b?.createdAt || b?.updatedAt || 0).getTime();
                        return bTime - aTime;
                    })[0];

                    if (latestOffer?._id) {
                        const tenantId = user?.tenantId || api.defaults.headers['X-Tenant-ID'] || api.defaults.headers['x-tenant-id'];
                        const existingUrl = `${API_ROOT}/api/public/letters/${latestOffer._id}/view-pdf?tenantId=${tenantId}&ts=${Date.now()}#toolbar=0&navpanes=0&scrollbar=0`;
                        window.open(existingUrl, '_blank');
                        notification.info({
                            message: 'Offer Already Issued',
                            description: 'Existing issued offer letter opened.',
                            placement: 'topRight'
                        });
                        return;
                    }
                } catch (openErr) {
                    console.error('Failed to open existing offer letter', openErr);
                }
            }

            if (err.response?.status === 404 && !err.response?.data?.message) {
                notification.error({ message: 'Error', description: `Generation failed: Server endpoint not found (404). Please ensure the backend server is running and the route '/api/letters/generate-offer' exists.`, placement: 'topRight' });
            } else {
                notification.error({ message: 'Error', description: `Generation failed: ${msg}`, placement: 'topRight' });
            }
        } finally {
            setGenerating(false);
        }
    };

    const downloadOffer = (filePath) => {
        // Handle both cases: just filename or full path
        let cleanPath = filePath;
        if (filePath && filePath.includes('/')) {
            // If path contains slashes, extract just the filename
            cleanPath = filePath.split('/').pop();
        }
        const url = `${API_ROOT}/uploads/offers/${cleanPath}`;
        window.open(url, '_blank');
    };

    const viewOfferLetter = async (app) => {
        if (!app) return;

        try {
            // Find the letter ID for this applicant
            const resLetters = await api.get(`/letters/generated-letters?applicantId=${app._id}`);
            // Check for 'offer' or 'offer letter' (case insensitive)
            const offerLetter = (resLetters.data?.data || []).find(l => l.letterType?.toLowerCase().includes('offer'));

            if (offerLetter) {
                console.log('📄 [VIEW_OFFER_LETTER] Record found:', offerLetter._id);
                // Use the public view route with tenantId query param
                // This route is specifically optimized for viewing signed/stamped versions correctly
                const tenantId = user?.tenantId || api.defaults.headers['X-Tenant-ID'] || api.defaults.headers['x-tenant-id'];
                // Step 5: Add timestamp to prevent caching
                const url = `${API_ROOT}/api/public/letters/${offerLetter._id}/view-pdf?tenantId=${tenantId}&ts=${Date.now()}`;
                window.open(url, '_blank');
            } else if (app.signedOfferPath || app.offerLetterPath) {
                console.warn('⚠️ [VIEW_OFFER_LETTER] No GeneratedLetter record found, falling back to static path');

                let cleanPath = app.signedOfferPath;

                // Fallback: If no signed path but status says signed, try to guess the signed filename
                if (!cleanPath && app.offerLetterPath && (app.status === 'Fully Signed' || app.offerStatus === 'SIGNED' || app.status?.includes('Accepted'))) {
                    const originalName = app.offerLetterPath.split(/[/\\]/).pop();
                    const isFullySigned = app.status === 'Fully Signed';
                    cleanPath = isFullySigned ? `FullySigned_${originalName}` : `Signed_${originalName}`;
                }

                if (!cleanPath) cleanPath = app.offerLetterPath;

                if (cleanPath && cleanPath.includes('/')) {
                    cleanPath = cleanPath.split(/[/\\]/).pop();
                }
                const url = `${API_ROOT}/uploads/offers/${cleanPath}?ts=${Date.now()}`;
                window.open(url, '_blank');
            } else {
                notification.warning({ message: 'Letter Not Found', description: 'No offer letter record found.' });
            }
        } catch (err) {
            console.error('[VIEW_OFFER_LETTER] Error:', err);
            if (app.signedOfferPath || app.offerLetterPath) {
                let cleanPath = app.signedOfferPath;
                if (!cleanPath && app.offerLetterPath && (app.offerStatus === 'SIGNED' || app.status?.includes('Accepted'))) {
                    const originalName = app.offerLetterPath.split(/[/\\]/).pop();
                    cleanPath = `Signed_${originalName}`;
                }
                if (!cleanPath) cleanPath = app.offerLetterPath;

                if (cleanPath.includes('/')) cleanPath = cleanPath.split(/[/\\]/).pop();

                const url = `${API_ROOT}/uploads/offers/${cleanPath}?ts=${Date.now()}`;
                window.open(url, '_blank');
            }
        }
    };

    const viewJoiningLetter = async (app) => {
        if (!app) return;

        try {
            const resLetters = await api.get(`/letters/generated-letters?applicantId=${app._id}`);
            const joiningLetter = (resLetters.data?.data || []).find(l => l.letterType?.toLowerCase().includes('joining'));

            if (joiningLetter) {
                const tenantId = user?.tenantId || api.defaults.headers['X-Tenant-ID'] || api.defaults.headers['x-tenant-id'];
                const url = `${API_ROOT}/api/public/letters/${joiningLetter._id}/view-pdf?tenantId=${tenantId}&ts=${Date.now()}#toolbar=0&navpanes=0&scrollbar=0`;
                window.open(url, '_blank');
                return;
            }

            if (app.joiningLetterPath) {
                const cleanPath = String(app.joiningLetterPath).replace(/^\/+/, '');
                const url = cleanPath.startsWith('uploads/')
                    ? `${API_ROOT}/${cleanPath}?ts=${Date.now()}`
                    : `${API_ROOT}/uploads/${cleanPath}?ts=${Date.now()}`;
                window.open(url, '_blank');
                return;
            }

            notification.warning({ message: 'Letter Not Found', description: 'No joining letter record found.' });
        } catch (err) {
            console.error('Failed to view joining letter:', err);
            notification.error({ message: 'Error', description: 'Failed to view joining letter', placement: 'topRight' });
        }
    };

    // const downloadJoiningLetter = async (applicantId) => {
    //     try {
    //         const response = await api.get(`/requirements/joining-letter/${applicantId}/download`);
    //         if (response.data.downloadUrl) {
    //             const url = `${API_ROOT}${response.data.downloadUrl}`;
    //             const link = document.createElement('a');
    //             link.href = url;
    //             link.download = `Joining_Letter_${applicantId}.pdf`;
    //             document.body.appendChild(link);
    //             link.click();
    //             document.body.removeChild(link);

    //             notification.success({
    //                 message: "Success",
    //                 description: "Joining letter downloaded successfully",
    //                 placement: 'topRight'
    //             });
    //             loadApplicants();
    //         }
    //     } catch (err) {
    //         console.error(err);
    //         notification.error({
    //             message: "Error",
    //             description: "Failed to download joining letter",
    //             placement: 'topRight'
    //         });
    //     } finally {
    //         setGenerating(false);
    //     }
    // };

    const downloadJoiningLetter = async (applicantId) => {
        try {
            const res = await api.get(`/requirements/joining-letter/${applicantId}/download`, {
                responseType: 'blob'
            });

            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Joining_Letter_${applicantId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download joining letter:', err);
            notification.error({ message: 'Error', description: 'Failed to download joining letter', placement: 'topRight' });
        }
    };

    const viewResume = async (input) => {
        if (!input) {
            showToast('error', 'No Resume', 'This applicant does not have a resume uploaded.');
            return;
        }

        // Handle if full applicant object is passed instead of just the path string
        let filePath = typeof input === 'string' ? input : (input.resumeFileUrl || (input.resume && typeof input.resume === 'object' ? input.resume.url : input.resume));

        if (!filePath) {
            showToast('error', 'No Resume', 'No resume file path found for this candidate.');
            return;
        }

        let filename = filePath;
        if (typeof filePath === 'string' && (filePath.includes('/') || filePath.includes('\\'))) {
            filename = filePath.split(/[/\\]/).pop();
        }

        try {
            // Using Blob approach to handle Authentication Headers in new tab
            const response = await api.get(`/hr/resume/${filename}`, {
                responseType: 'blob'
            });

            // Detect type or default to PDF
            const type = response.headers['content-type'] || 'application/pdf';
            const blob = new Blob([response.data], { type });
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');

            // Cleanup after short delay to allow browser to register
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);

        } catch (error) {
            console.error("View Resume Failed:", error);
            if (error.response?.status === 404) {
                showToast('error', 'Not Found', 'The resume file is missing on the server.');
            } else {
                showToast('error', 'Error', 'Failed to load resume. Please try again.');
            }
        }
    };

    const downloadResume = (filePath) => {
        viewResume(filePath);
    };

    const [resumePreviewUrl, setResumePreviewUrl] = useState(null);

    const openCandidateModal = async (applicant) => {
        if (!applicant?._id) return;

        setLoading(true);
        try {
            // Fetch full applicant/candidate details using the ID
            // Using the verified endpoint /requirements/applicants/:id
            const res = await api.get(`/requirements/applicants/${applicant._id}`);
            const fullData = res.data?.data || res.data;

            setSelectedApplicant(fullData);
            setShowCandidateModal(true);

            // Extract resume path - handle multiple possible field structures
            const resumePath = fullData.resumeFileUrl || (fullData.resume && typeof fullData.resume === 'object' ? fullData.resume.url : fullData.resume);

            // Fetch Resume Blob for Preview if path exists
            if (resumePath) {
                let filename = resumePath;
                if (filename.includes('/') || filename.includes('\\')) {
                    filename = filename.split(/[/\\]/).pop();
                }
                try {
                    const response = await api.get(`/hr/resume/${filename}`, { responseType: 'blob' });
                    const type = response.headers['content-type'] || 'application/pdf';
                    const blob = new Blob([response.data], { type });
                    const url = window.URL.createObjectURL(blob);
                    setResumePreviewUrl(url);
                } catch (err) {
                    console.error("Failed to load resume preview", err);
                    setResumePreviewUrl(null);
                }
            } else {
                setResumePreviewUrl(null);
            }
        } catch (err) {
            console.error("Failed to fetch candidate details:", err);
            showToast('error', 'Error', 'Failed to fetch candidate details');
        } finally {
            setLoading(false);
        }
    };

    const handleApplicationClick = (event, application) => {
        const interactiveTarget = event?.target?.closest?.('button, a, input, select, textarea, [role="button"]');
        if (interactiveTarget) return;
        if (!application || !application._id) return;
        openCandidateModal(application);
    };

    const closeCandidateModalHelper = () => {
        setShowCandidateModal(false);
        if (resumePreviewUrl) {
            window.URL.revokeObjectURL(resumePreviewUrl);
            setResumePreviewUrl(null);
        }
    };


    const openJoiningModal = async (applicant) => {
        if (!applicant.offerLetterPath) {
            notification.warning({ message: 'Warning', description: "Please generate an Offer Letter first.", placement: 'topRight' });
            return;
        }

        // BGV check relaxed to enable joining letter option
        if (applicant.bgvStatus !== 'CLEAR' && applicant.bgvStatus !== 'VERIFIED') {
            console.log('Proceeding with Joining Letter - BGV Status:', applicant.bgvStatus);
        }
        // Check if salary is assigned (either via snapshot or flat ctc field)
        const isSalaryAssigned = applicant.salarySnapshotId || applicant.salarySnapshot || (applicant.ctc && applicant.ctc > 0);
        if (!isSalaryAssigned) {
            notification.warning({ message: 'Warning', description: "Please assign salary before generating joining letter.", placement: 'topRight' });
            return;
        }
        resetOfferLetterUi();
        setSelectedApplicant(applicant);
        setJoiningTemplateId('');
        
        // Initialize new joining fields
        setJoiningName(applicant.name || '');
        setJoiningDearName(applicant.dearName || applicant.name?.split(' ')[0] || '');
        setJoiningSalutation(inferOfferTitle(applicant));
        setJoiningRelationType(normalizeOfferRelationType(applicant.relationType || 'S/O'));
        setJoiningProbationPeriod(applicant.probationPeriod || '');
        setJoiningDateFormat('Do MMM. YYYY');
        setJoiningDateVal(applicant.joiningDate ? dayjs(applicant.joiningDate).format('YYYY-MM-DD') : '');
        setJoiningDateText(applicant.joiningDate ? toDisplayDate(applicant.joiningDate, 'Do MMM. YYYY') : '');

        // Auto-fetch Reference Number
        setJoiningRefNo('Fetching ID...');
        try {
            const res = await api.post('/company-id-config/next', { entityType: 'APPOINTMENT', increment: false });
            const fromApi = res.data?.data?.id || res.data?.nextId;
            if (fromApi) {
                setJoiningRefNo(fromApi);
            } else {
                setJoiningRefNo(`JL/${new Date().getFullYear()}/${String(Math.floor(1000 + Math.random() * 9000)).padStart(4, '0')}`);
            }
        } catch (error) {
            console.error("Failed to fetch next Appointment ID", error);
            setJoiningRefNo(`JL/${new Date().getFullYear()}/${String(Math.floor(1000 + Math.random() * 9000)).padStart(4, '0')}`);
        }

        const today = dayjs();
        const sigDay = today.add(7, 'day');
        const acceptDeadline = today.add(7, 'day').hour(23).minute(59);
        setJoiningIssueDate(today.format('YYYY-MM-DD'));
        setJoiningIssueDateText(toDisplayDate(today, 'Do MMM. YYYY'));
        setJoiningExpiryAt(sigDay.format('YYYY-MM-DD'));
        setJoiningExpiryAtText(toDisplayDate(sigDay, 'Do MMM. YYYY'));
        setJoiningLetterExpiryDate(acceptDeadline.toISOString());
        setJoiningLetterExpiryText(toDisplayDate(acceptDeadline, 'Do MMM. YYYY') + ' ' + acceptDeadline.format('HH:mm'));
        setJoiningSignaturePosition({ alignment: 'right' });
        setJoiningCustomData({});
        setShowJoiningModal(true);
        setJoiningPreviewUrl(null);
        setJoiningPreviewHtml(null);
        setShowJoiningPreview(false);
    };

    const handleApproveOnboarding = async (onboardingId) => {
        try {
            setLoading(true);
            await api.post('/onboarding/activate', { onboardingId, force: true });
            notification.success({ 
                message: 'Onboarding Completed', 
                description: 'The candidate has been successfully activated as an active employee. All profile data and documents have been synced.', 
                placement: 'topRight'
            });
            closeCandidateModalHelper();
            loadApplicants();
        } catch (err) {
            console.error('Failed to activate employee:', err);
            const status = err.response?.status;
            let errorMessage = 'Final activation failed. Please check if all mandatory HR rounds and documents are verified.';
            
            if (status === 500) {
                errorMessage = 'The system encountered an error while creating the employee account. This usually happens if the employee ID or Email already exists in the system.';
            } else if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            }

            notification.error({ 
                message: 'Activation Failed', 
                description: errorMessage,
                placement: 'topRight',
                duration: 6
            });
        } finally {
            setLoading(false);
        }
    };

    const openSalaryPreview = (applicant) => {
        setSelectedApplicant(applicant);
        setShowSalaryPreview(true);
    };

    const handleSalaryAssigned = () => {
        loadApplicants(); // Refresh list to show updated salary status
    };

    const confirmSalary = async (applicant) => {
        if (!confirm("Confirm and Lock this salary structure? This will create an immutable snapshot and enable letter generation.")) return;
        try {
            setLoading(true);
            await api.post('/payroll-engine/salary/confirm', {
                applicantId: applicant._id,
                reason: 'JOINING'
            });
            alert("✅ Salary confirmed and locked!");
            loadApplicants();
        } catch (err) {
            console.error(err);
            alert("❌ Lock failed: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleJoiningPreview = async () => {
        if (!joiningTemplateId) {
            notification.error({ message: 'Error', description: 'Please select a Joining Letter Template', placement: 'topRight' });
            return;
        }
        if (!syncJoiningModalFieldsFromText()) return;

        setGenerating(true);
        try {
            const res = await api.post('/letters/preview-joining', {
                applicantId: selectedApplicant._id,
                templateId: joiningTemplateId,
                refNo: joiningRefNo,
                issueDate: joiningIssueDate,
                dateFormat: joiningDateFormat,
                signaturePosition: joiningSignaturePosition,
                joiningLetterExpiryDate: joiningLetterExpiryDate || null,
                customData: buildJoiningCustomData({
                    customData: joiningCustomData,
                    applicant: selectedApplicant,
                    refNo: joiningRefNo,
                    issueDate: joiningIssueDate,
                    expiryAt: joiningExpiryAt,
                    relationType: joiningRelationType,
                    salutation: joiningSalutation,
                    probationPeriod: joiningProbationPeriod,
                    name: joiningName,
                    dearName: joiningDearName,
                    joiningDate: joiningDateVal,
                    dateFormat: joiningDateFormat
                })
            }, { timeout: 150000 });

            if (res.data.previewUrl || res.data.pdfUrl) {
                setJoiningPreviewHtml(null);
                const pUrl = res.data.previewUrl || res.data.pdfUrl;
                const url = `${API_ROOT}${pUrl}#toolbar=0&navpanes=0&scrollbar=0&ts=${Date.now()}`;
                setJoiningPreviewUrl(url);
                setShowJoiningPreview(true);
            } else if (res.data.htmlContent) {
                setJoiningPreviewHtml(res.data.htmlContent);
                setJoiningPreviewUrl(null);
                setShowJoiningPreview(true);
            }
        } catch (err) {
            console.error("Failed to preview joining letter", err);
            const msg = err.response?.data?.message || err.message || "Failed to preview joining letter";
            if (err.response?.status === 404 && !err.response?.data?.message) {
                notification.error({ message: 'Error', description: `Preview failed: Server endpoint not found (404). Please ensure the backend server is running and the route '/api/letters/preview-joining' exists.`, placement: 'topRight' });
            } else {
                notification.error({ message: 'Error', description: `Preview failed: ${msg}`, placement: 'topRight' });
            }
        } finally {
            setGenerating(false);
        }
    };

    const handleJoiningGenerate = async (e, overrides = null) => {
        if (e) e.preventDefault();
        if (!joiningTemplateId) {
            notification.error({ message: 'Error', description: 'Please select a Joining Letter Template', placement: 'topRight' });
            return;
        }
        if (!syncJoiningModalFieldsFromText()) return;

        const customApprovers = overrides?.customApprovers || [];
        setGenerating(true);
        try {
            const payload = {
                applicantId: selectedApplicant._id,
                templateId: joiningTemplateId,
                refNo: joiningRefNo,
                issueDate: joiningIssueDate,
                dateFormat: joiningDateFormat,
                signaturePosition: joiningSignaturePosition,
                joiningLetterExpiryDate: joiningLetterExpiryDate || null,
                customData: buildJoiningCustomData({
                    customData: joiningCustomData,
                    applicant: selectedApplicant,
                    refNo: joiningRefNo,
                    issueDate: joiningIssueDate,
                    expiryAt: joiningExpiryAt,
                    relationType: joiningRelationType,
                    salutation: joiningSalutation,
                    probationPeriod: joiningProbationPeriod,
                    name: joiningName,
                    dearName: joiningDearName,
                    joiningDate: joiningDateVal,
                    dateFormat: joiningDateFormat
                }),
                customWorkflow: !!(customApprovers && customApprovers.length > 0)
            };

            const res = await api.post('/letters/generate-joining', payload, { timeout: 150000 });

            if (res.data.success) {
                // If custom workflow is enabled, trigger the custom workflow API
                if (payload.customWorkflow && (res.data.letterId || res.data.generatedLetterId)) {
                    try {
                        await api.post('/letters/start-custom-workflow', {
                            applicantId: selectedApplicant._id,
                            generatedLetterId: res.data.letterId || res.data.generatedLetterId,
                            letterType: 'joining',
                            steps: customApprovers
                        });
                        notification.success({ 
                            message: 'Success', 
                            description: 'Joining Letter generated and custom workflow started!', 
                            placement: 'topRight' 
                        });
                    } catch (cwErr) {
                        console.error('Custom workflow start error:', cwErr);
                        notification.warning({
                            message: 'Warning',
                            description: 'Joining letter generated but failed to start custom workflow.',
                            placement: 'topRight'
                        });
                    }
                } else {
                    notification.success({ 
                        message: 'Success', 
                        description: 'Joining Letter generated and sent to candidate successfully!', 
                        placement: 'topRight' 
                    });
                }
                setShowJoiningModal(false);
                closeJoiningPreview();
                loadApplicants();
            }
        } catch (err) {
            console.error("Failed to generate joining letter", err);

            if (err.response?.status === 404 && !err.response?.data?.message) {
                notification.error({ message: 'Error', description: `Generation failed: Server endpoint not found (404). Please ensure the backend server is running and the route '/api/letters/generate-joining' exists.`, placement: 'topRight' });
            } else {
                const errorMsg = err.response?.data?.message ||
                    err.response?.data?.error ||
                    'Failed to generate joining letter';

                if (errorMsg.toLowerCase().includes('salary not assigned') ||
                    err.response?.data?.code === 'SALARY_NOT_ASSIGNED') {
                    notification.error({ message: 'Error', description: 'Please assign salary before generating joining letter.', placement: 'topRight' });
                } else {
                    notification.error({ message: 'Error', description: `Generation failed: ${errorMsg}`, placement: 'topRight' });
                }
            }
        } finally {
            setGenerating(false);
        }
    };

    const openOnboardingWorkspace = (applicant, employeeIdOverride = null) => {
        const params = new URLSearchParams();
        if (applicant?._id) params.set('applicantId', applicant._id);
        if (employeeIdOverride || applicant?.employeeId) params.set('employeeId', employeeIdOverride || applicant.employeeId);
        navigate(`${hrPrefix}/onboarding/dashboard${params.toString() ? `?${params.toString()}` : ''}`);
    };

    const handleOnboard = (applicant) => {
        if (!applicant) return;

        if (applicant.isOnboarded) {
            showToast('info', 'Onboarding', `${applicant.name} is already onboarded.`);
            openOnboardingWorkspace(applicant);
            return;
        }

        if (applicant.employeeId) {
            showToast('info', 'Onboarding', `${applicant.name} onboarding is already active. Opening workspace.`);
            openOnboardingWorkspace(applicant);
            return;
        }

        showConfirmToast({
            title: 'Start Onboarding',
            description: `Start onboarding for ${applicant.name}? This will create the onboarding instance and send the invite automatically.`,
            okText: 'Start Now',
            cancelText: 'Cancel',
            onConfirm: async () => {
                setLoading(true);
                try {
                    const payload = {
                        applicantId: applicant._id,
                        name: applicant.name,
                        email: applicant.email,
                        mobile: applicant.mobile,
                        joiningDate: applicant.joiningDate || new Date(),
                        department: applicant.requirementId?.department?.name || applicant.department || 'General',
                        jobType: applicant.requirementId?.jobType || 'Full-Time',
                        designation: applicant.requirementId?.jobTitle,
                        role: 'employee',
                        ctcAnnual: applicant.salarySnapshot?.ctcYearly || '',
                    };

                    const res = await api.post('/onboarding/invite', payload);
                    const employeeId = res.data?.employee?._id || res.data?.instance?.employee || null;
                    showToast('success', 'Onboarding Started', `${applicant.name} onboarding has been started and the invite was sent automatically.`);
                    openOnboardingWorkspace(applicant, employeeId);
                    loadApplicants();
                } catch (err) {
                    console.error('[ONBOARD_ERROR]', err);
                    const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
                    showToast('error', 'Onboarding Failed', errorMsg);
                } finally {
                    setLoading(false);
                }
            }
        });
    };
    if (!canView && !permLoading) {
        return <Navigate to="/hr/dashboard" replace />;
    }

    return (
        <>
            <div className="space-y-6 sm:space-y-8 relative p-[10px] box-border min-h-0 w-full">
            <div className="sticky top-[-10px] z-10 -mx-[10px] px-4 pt-4 pb-4 bg-slate-50/80 backdrop-blur-md border-b border-slate-100 shadow-sm mb-6">
                {/* Premium Header Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-2 px-1">
                    <div className="flex items-center gap-3 shrink-0">
                        {(jobSpecific || showAllCandidates) && (
                            <button
                                onClick={() => navigate(applicantsBasePath)}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-950 hover:border-slate-300 transition-all shadow-sm group"
                                title="Back to Pipeline"
                            >
                                <ChevronRight size={18} className="rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                            </button>
                        )}
                        <h1 className="text-xl font-black text-slate-900 tracking-tight whitespace-nowrap">
                            {showAllCandidates ? 'All Candidates' : (jobSpecific && selectedRequirement ? selectedRequirement.jobTitle : 'Candidate Pipeline')}
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end w-full">
                        <div className="relative w-full sm:w-48 xl:w-56">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"><Search size={14} /></span>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-[13px] focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 outline-none transition-all placeholder:text-slate-300"
                            />
                        </div>

                        <div className="w-full sm:w-44 xl:w-52">
                            <select
                                className="w-full h-9 border border-slate-200 shadow-sm rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-700 outline-none bg-white cursor-pointer transition-all"
                                value={selectedReqId}
                                onChange={(e) => handleRequirementChange(e.target.value)}
                            >
                                <option value="all">Global Pipeline</option>
                                <optgroup label="Active Recruitments">
                                    {requirements.filter(r => {
                                        if (r.status !== 'Open') return false;
                                        // Strict visibility filtering
                                        if (internalMode) {
                                            return r.visibility === 'Internal' || r.visibility === 'Both';
                                        } else {
                                            return r.visibility === 'External' || r.visibility === 'Both' || !r.visibility; // Default to External
                                        }
                                    }).map(req => {
                                        const id = String(req._id);
                                        if (id === '[object Object]') {
                                            console.warn('⚠️ Applicants.jsx: Requirement ID is [object Object]!', req);
                                        }
                                        return (
                                            <option key={id + '_' + Math.random()} value={id}>{req.jobTitle} {id === '[object Object]' ? ' (Error: Invalid ID)' : ''}</option>
                                        );
                                    })}
                                </optgroup>
                            </select>
                        </div>

                        <div className="w-full sm:w-36">
                            <select
                                className="w-full h-9 border border-slate-200 shadow-sm rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-700 outline-none bg-white cursor-pointer transition-all"
                                value={timeFilter}
                                onChange={(e) => setTimeFilter(e.target.value)}
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="week">This Week</option>
                                <option value="15days">Past 15 Days</option>
                                <option value="month">This Month</option>
                            </select>
                        </div>

                        <div className="w-full sm:w-auto flex gap-2">


                            <Can module={permissionKey} action="export">
                                <button
                                    onClick={() => notification.info({ message: 'Info', description: 'Exporting...', placement: 'topRight' })}
                                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 h-11 bg-white text-slate-500 border border-slate-200/60 shadow-sm rounded-2xl hover:bg-slate-50 hover:text-slate-950 hover:border-slate-300 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
                                >
                                    <Download size={16} />
                                    <span className="hidden sm:inline">Export</span>
                                </button>
                            </Can>
                            <button
                                onClick={refreshData}
                                className="p-2.5 bg-white text-slate-400 border border-slate-100 shadow-sm rounded-xl hover:text-blue-600 transition flex-shrink-0"
                                title="Refresh Data"
                            >
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Premium Pipeline Stepper — Moved up into main header for better access */}
                {(jobSpecific || showAllCandidates) && (
                        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 overflow-hidden">
                            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar pb-1 w-full">
                                {visibleWorkflowTabs.map((tab, idx) => {
                                    let sub = applicants;
                                    if (searchQuery) {
                                        const query = searchQuery.toLowerCase();
                                        sub = sub.filter(a => (a.name || '').toLowerCase().includes(query) || (a.email || '').toLowerCase().includes(query));
                                    }
                                    sub = sub.filter((a) => (internalMode ? applicantMatchesInternalPipeline(a) : !applicantMatchesInternalPipeline(a)));

                                    let count = sub.filter(a => {
                                        if (selectedReqId !== 'all') {
                                            if (!(String(a.requirementId?._id || a.requirementId) === String(selectedReqId))) return false;
                                        }
                                        if (tab === 'All') return true;
                                        if (a.status === 'Rejected' && tab !== 'Rejected') return false;
                                        if (selectedReqId === 'all') {
                                            if (tab === 'Finalized') return ['Finalized', 'Selected', 'Joining Letter Issued', 'Offer Issued', 'Offer Accepted', 'Offer Accepted – Awaiting Company Approval', 'Fully Signed', 'Hired', 'Offer Expired'].includes(a.status);
                                            if (tab === 'Rejected') return (a.status === 'Rejected');
                                            return a.status !== 'Finalized' && a.status !== 'Rejected';
                                        }
                                        return checkStatusPassage(a.status, tab, visibleWorkflowTabs);
                                    }).length;

                                    const isActive = activeTab === tab;
                                    const isFinal = tab === 'Finalized';
                                    const isRejected = tab === 'Rejected';

                                    return (
                                        <button
                                            type="button"
                                            key={tab}
                                            onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                                            className={`
                                                group relative flex-shrink-0 px-3 py-1.5 rounded-lg transition-all duration-200
                                                flex items-center gap-2 border
                                                ${isActive
                                                    ? (isRejected ? 'bg-rose-600 border-rose-600 text-white shadow-md' :
                                                        'bg-slate-800 border-slate-800 text-white shadow-md')
                                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}
                                            `}
                                        >
                                            <div className="flex items-center gap-1.5 leading-none">
                                                <span className={`text-[10px] font-black uppercase tracking-tight ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                                                    {idx + 1}.
                                                </span>
                                                <span className="text-[11px] font-black tracking-tight uppercase whitespace-nowrap leading-none">
                                                    {tab}
                                                </span>
                                            </div>
                                            <div className={`
                                                flex items-center justify-center h-4.5 min-w-[20px] px-1.5 rounded-md text-[9px] font-black shrink-0 leading-none
                                                ${isActive
                                                    ? 'bg-white/20 text-white'
                                                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-100 group-hover:text-slate-900'}
                                            `}>
                                                {count}
                                            </div>
                                        </button>
                                     );
                                })}
                            </div>
                        </div>
                    )}
                </div>

            {/* Premium Job Cards Grid */}
            {!jobSpecific && !showAllCandidates && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {/* Global Pipeline Unified Card */}
                    <div
                        onClick={() => navigate(`${applicantsBasePath}?view=all`)}
                        className="relative bg-slate-800 rounded-xl p-4 cursor-pointer overflow-hidden group shadow-lg shadow-slate-200/50 transform hover:scale-[1.01] transition-all duration-300"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12 transition-all group-hover:bg-white/20"></div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-2.5">
                                <div className="w-9 h-9 rounded-lg bg-white shadow-md shadow-slate-700/20 flex items-center justify-center text-slate-800">
                                    <Layout size={20} strokeWidth={2.5} />
                                </div>
                                <div className="text-right">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-0.5">Total Candidates</span>
                                    <span className="text-2xl font-black text-white leading-none">
                                        {applicants.filter((a) => (internalMode ? applicantMatchesInternalPipeline(a) : !applicantMatchesInternalPipeline(a))).length}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white tracking-tight mb-1 uppercase">Global Pipeline</h3>
                                <p className="text-slate-200 font-medium text-[11px] leading-snug max-w-[180px]">
                                    View all candidates across all open positions
                                </p>
                            </div>
                            <div className="mt-2.5 flex items-center gap-1.5 text-white text-[9px] font-black uppercase tracking-widest group-hover:gap-2 transition-all">
                                View All Candidates <ChevronRight size={12} />
                            </div>
                        </div>
                    </div>

                    {/* Individual Modern Recruitment Cards */}
                    {requirements.filter(r => {
                        if (r.status !== 'Open') return false;
                        if (internalMode) {
                            return r.visibility === 'Internal' || r.visibility === 'Both';
                        } else {
                            return r.visibility === 'External' || r.visibility === 'Both' || !r.visibility;
                        }
                    }).map(req => {
                        const jobApplicants = applicants.filter((a) => {
                            const matchReq = a.requirementId?._id === req._id || a.requirementId === req._id;
                            if (!matchReq) return false;
                            return internalMode ? applicantMatchesInternalPipeline(a) : !applicantMatchesInternalPipeline(a);
                        });
                        const getApplicantBadge = (applicant) => {
                            const displayName = String(
                                applicant?.name ||
                                applicant?.candidateId?.name ||
                                applicant?.fullName ||
                                applicant?.email ||
                                ''
                            ).trim();
                            if (!displayName) return 'NA';
                            const parts = displayName.split(/\s+/).filter(Boolean);
                            if (parts.length >= 2) {
                                return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
                            }
                            return displayName.slice(0, 2).toUpperCase();
                        };
                        const previewApplicants = jobApplicants.slice(0, 3);

                        return (
                            <div
                                key={req._id}
                                onClick={() => navigate(jobCandidatesPath(String(req._id)))}
                                className="group bg-white rounded-xl border border-slate-100 p-3.5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 cursor-pointer flex flex-col justify-between transform hover:scale-[1.01]"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-800 group-hover:text-white group-hover:border-slate-800 transition-all duration-300 shadow-sm shrink-0">
                                                <Briefcase size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-black text-slate-800 leading-tight truncate group-hover:text-slate-900 transition-colors uppercase tracking-tight">
                                                    {req.jobTitle}
                                                </h3>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">
                                                    {req.department?.name || req.department || 'General'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                                        <div className="p-2 bg-slate-50/50 rounded-lg border border-slate-50 group-hover:bg-slate-50 group-hover:border-slate-200 transition-colors">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <PlusCircle size={10} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Openings</span>
                                            </div>
                                            <span className="text-base font-black text-slate-900 leading-none">{req.openings || 0}</span>
                                        </div>
                                        <div className="p-2 bg-slate-50/50 rounded-lg border border-slate-50 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <Clock size={10} className="text-slate-300 group-hover:text-emerald-500 shrink-0" />
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Experience</span>
                                            </div>
                                            <span className="text-base font-black text-slate-900 truncate block leading-none">{req.experience || 'Entry'}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 px-0.5">
                                        <div className="flex items-center gap-1">
                                            <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{req.location || 'Remote'}</span>
                                        </div>
                                        <span className="text-slate-200">·</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{req.jobType || 'Full-time'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-2.5 pt-2.5 border-t border-slate-50 flex items-center justify-between">
                                    <div className="flex -space-x-1.5">
                                        {previewApplicants.map((app, i) => (
                                            <div
                                                key={String(app?._id || `${req._id}-app-${i}`)}
                                                className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500"
                                                title={app?.name || app?.email || 'Applicant'}
                                            >
                                                {getApplicantBadge(app)}
                                            </div>
                                        ))}
                                        {jobApplicants.length > 3 && (
                                            <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 text-slate-600 flex items-center justify-center text-[8px] font-black">
                                                +{jobApplicants.length - 3}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{jobApplicants.length} APPLICANTS</span>
                                        <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-800 group-hover:text-white transition-all shadow-sm">
                                            <ChevronRight size={14} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Candidates Table Section - Show on job-specific pages OR when viewing all candidates */}
            {(jobSpecific || showAllCandidates) && (
                <div className="bg-white/50 backdrop-blur-xl rounded-[32px] border border-white/60 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.05)] overflow-hidden">



                    {/* Content Area */}
                    <div className="p-4 sm:p-8 bg-slate-50/50 min-h-[600px]">
                        {loading ? (
                            <div className="h-96 flex flex-col items-center justify-center gap-6">
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-slate-100 rounded-full animate-spin border-t-slate-800"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-8 h-8 bg-white rounded-full"></div>
                                    </div>
                                </div>
                                <span className="text-slate-400 font-medium animate-pulse">Fetching Talent...</span>
                            </div>
                        ) : getFilteredApplicants().length === 0 ? (
                            <div className="h-96 flex flex-col items-center justify-center gap-6 text-slate-400">
                                <div className="w-28 h-28 rounded-[2rem] bg-white shadow-2xl shadow-slate-200 flex items-center justify-center transform rotate-6 transition-transform hover:rotate-12 duration-700 border border-slate-50">
                                    <UserX size={40} className="text-slate-300" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm">Try adjusting your filters or search query</p>
                                </div>
                            </div>
                        ) : activeTab !== 'Finalized' ? (
                            /* CARD GRID VIEW */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {getFilteredApplicants()
                                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                                    .map((app, index) => (
                                        <div
                                            key={app._id || index}
                                            onClick={(e) => handleApplicationClick(e, app)}
                                            className="group relative bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
                                            title="Click to view full candidate profile"
                                        >
                                            <div className="p-5 flex-1">
                                                {/* Header */}
                                                <div className="flex justify-between items-start mb-4 gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative shrink-0">
                                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white shadow-md transform group-hover:rotate-3 transition-transform duration-300 ${app.status === "Selected" ? "bg-slate-800" : app.status === "Rejected" ? "bg-rose-500" : "bg-slate-950"}`}>
                                                                {(app.name || '?').charAt(0).toUpperCase()}
                                                            </div>
                                                            {activeTab === 'Rejected' && (
                                                                <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center bg-rose-50 text-white shadow-sm">
                                                                    <X size={12} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="text-base font-black text-slate-900 leading-tight group-hover:text-slate-950 transition-colors uppercase tracking-tight truncate">
                                                                {app.name || 'Anonymous'}
                                                            </h3>
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-50 text-slate-500 border border-slate-200 uppercase tracking-widest group-hover:bg-slate-100 group-hover:text-slate-900 transition-colors truncate max-w-full shadow-sm">
                                                                    {app.requirementId?.jobTitle || 'N/A'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Info Grid */}
                                                <div className="grid grid-cols-1 gap-2 mb-4">
                                                    <div className="flex items-center gap-2.5 text-xs text-slate-600 bg-slate-50/50 p-1.5 rounded-lg border border-slate-100 group-hover:bg-white transition-colors overflow-hidden">
                                                        <div className="w-6 h-6 rounded border border-slate-200 bg-white flex items-center justify-center text-slate-400 shrink-0"><Mail size={12} /></div>
                                                        <span className="font-medium truncate">{app.email}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2.5 text-xs text-slate-600 bg-slate-50/50 p-1.5 rounded-lg border border-slate-100 group-hover:bg-white transition-colors">
                                                        <div className="w-6 h-6 rounded border border-slate-200 bg-white flex items-center justify-center text-slate-400 shrink-0"><Calendar size={12} /></div>
                                                        <span className="font-medium">Applied {dayjs(app.appliedAt).format('MMM D, YYYY')}</span>
                                                    </div>
                                                    {/* AI Match Score */}
                                                    {app.matchPercentage !== undefined && (
                                                        <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-100">
                                                            <div className="w-6 h-6 rounded bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0"><Zap size={12} /></div>
                                                            <span className="font-bold text-emerald-700">AI Match: {app.matchPercentage}%</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {!app.matchedSkills?.length && app.parsedSkills?.length > 0 && (
                                                    <div className="mb-2">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {app.parsedSkills.slice(0, 4).map((skill, i) => (
                                                                <span key={i} className="text-[10px] px-2 py-1 bg-white text-slate-600 font-medium rounded border border-slate-200 shadow-sm">{skill}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Action Area */}
                                                <div className="mt-auto border-t border-slate-100 p-3 bg-slate-50/50 group-hover:bg-slate-50 transition-colors">
                                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                                        {/* Slot 1: Interview Action/Status */}
                                                        {app.interview?.date ? (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openScheduleModal(app); }}
                                                                className={`py-2 rounded-lg border text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm ${app.interview.completed
                                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                                                    : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                                                    }`}
                                                            >
                                                                <Clock size={12} />
                                                                {app.interview.completed ? 'DONE' : dayjs(app.interview.date).format('MMM D')}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openScheduleModal(app); }}
                                                                className="py-2 rounded-lg border border-dashed border-slate-300 bg-white text-slate-500 text-[10px] font-black uppercase tracking-wider hover:bg-slate-100 hover:border-slate-400 hover:text-slate-900 transition-all flex items-center justify-center gap-1.5 group/btn shadow-sm"
                                                            >
                                                                <PlusCircle size={12} className="text-slate-400 group-hover/btn:text-slate-600" />
                                                                SCHEDULE
                                                            </button>
                                                        )}
                                                        
                                                        {/* Slot 2: Line up Interview Panel */}
                                                        <button
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                // Ensure we edit the pipeline for this candidate's requirement
                                                                if (app.requirementId && (!selectedRequirement || selectedRequirement._id !== app.requirementId._id)) {
                                                                    setSelectedRequirement(app.requirementId);
                                                                }
                                                                setShowPipelineManager(true); 
                                                            }}
                                                            className="py-2 rounded-lg bg-indigo-600 border border-indigo-700 text-white text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 hover:shadow-md transition-all flex items-center justify-center gap-1.5 shadow-sm text-center"
                                                            title="Line Up Interview Panel"
                                                        >
                                                            <Users size={12} /> LINE UP
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {/* Slot 3: Resume */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleViewResume(app.resume); }}
                                                            className="py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wider hover:bg-slate-100 hover:text-slate-950 hover:border-slate-300 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                                            title="View Resume"
                                                        >
                                                            <FileText size={12} /> RESUME
                                                        </button>

                                                        {/* Slot 4: Actions */}
                                                        <div className="relative">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const dropdown = e.currentTarget.nextElementSibling;
                                                                    if (dropdown) dropdown.classList.toggle('hidden');
                                                                    document.querySelectorAll('.stage-dropdown').forEach(d => {
                                                                        if (d !== dropdown) d.classList.add('hidden');
                                                                    });
                                                                }}
                                                                className="w-full py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-950 shadow-md flex items-center justify-center gap-1.5 transform hover:scale-[1.02] active:scale-95 transition-all"
                                                            >
                                                                <span>ACTIONS</span>
                                                                <ChevronDown size={12} />
                                                            </button>

                                                            <div className="stage-dropdown hidden absolute bottom-full mb-2 right-0 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-[50] animate-in slide-in-from-bottom-2 fade-in duration-200">
                                                                <div className="max-h-[250px] overflow-y-auto">
                                                                    {app.interview && !app.interview.completed && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); markInterviewCompleted(app); document.querySelectorAll('.stage-dropdown').forEach(d => d.classList.add('hidden')); }}
                                                                            className="w-full px-5 py-3.5 text-left text-xs font-bold text-emerald-700 hover:bg-emerald-50 border-b border-slate-100 flex items-center gap-2 transition-colors"
                                                                        >
                                                                            <CheckCircle size={16} /> Mark Interview Done
                                                                        </button>
                                                                    )}
                                                                    {workflowTabs.filter(t => !['Finalized', 'Rejected', 'All', normalizeStatus(app.status)].includes(t)).map(stage => (
                                                                        <button
                                                                            key={stage}
                                                                            onClick={() => {
                                                                                handleStatusChangeRequest(app, stage);
                                                                                document.querySelectorAll('.stage-dropdown').forEach(d => d.classList.add('hidden'));
                                                                            }}
                                                                            className="w-full px-5 py-3.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-700 border-b border-slate-100 last:border-0 transition-colors"
                                                                        >
                                                                            Move to {stage}
                                                                        </button>
                                                                    ))}

                                                                    <div className="p-2 bg-slate-50 grid grid-cols-2 gap-2 border-t border-slate-100">
                                                                        <button onClick={() => { handleStatusChangeRequest(app, 'Selected'); document.querySelectorAll('.stage-dropdown').forEach(d => d.classList.add('hidden')); }} className="py-2.5 text-xs font-black bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 shadow-sm transition-colors">HIRE</button>
                                                                        <button onClick={() => { handleStatusChangeRequest(app, 'Rejected'); document.querySelectorAll('.stage-dropdown').forEach(d => d.classList.add('hidden')); }} className="py-2.5 text-xs font-black bg-rose-100 text-rose-800 rounded-lg hover:bg-rose-200 shadow-sm transition-colors">REJECT</button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            /* MODERN CARD LIST VIEW (Finalized) - Inspired by second photo */
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                {/* Header Labels - Synchronized with Card Columns */}
                                <div className="hidden lg:grid grid-cols-[1.5fr_0.7fr_0.8fr_0.9fr_1.4fr_0.8fr_1.4fr_0.6fr] 2xl:grid-cols-[1.8fr_0.8fr_0.8fr_1fr_1.5fr_0.9fr_1.5fr_0.7fr] px-6 lg:px-8 py-4 opacity-50 gap-4">
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Users size={12} /> Candidate
                                    </div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 justify-center">
                                        Referrer
                                    </div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 justify-center">
                                        Status
                                    </div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 justify-center">
                                        <IndianRupee size={12} /> Salary
                                    </div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 lg:ml-2">
                                        <FileText size={12} /> Documentation
                                    </div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 justify-center">
                                        <ShieldCheck size={12} /> Verification
                                    </div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 lg:ml-2">
                                        <Calendar size={12} /> Joining
                                    </div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-end pr-2">
                                        Action
                                    </div>
                                </div>

                                {/* Card List */}
                                <div className="space-y-4 px-4 sm:px-6">
                                    {getFilteredApplicants()
                                        .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                                        .map((app, index) => (
                                            <div
                                                key={app._id || index}
                                                onClick={(e) => handleApplicationClick(e, app)}
                                                className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-500 group relative overflow-hidden cursor-pointer"
                                                title="Click to view full candidate profile"
                                            >
                                                {/* Decorative background shape */}
                                                <div className="absolute -right-4 -top-4 w-32 h-32 bg-slate-50/50 dark:bg-slate-800/20 rounded-full blur-3xl pointer-events-none group-hover:bg-slate-100/50 transition-colors" />

                                                <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_0.7fr_0.8fr_0.9fr_1.4fr_0.8fr_1.4fr_0.6fr] 2xl:grid-cols-[1.8fr_0.8fr_0.8fr_1fr_1.5fr_0.9fr_1.5fr_0.7fr] items-center gap-6 lg:gap-4 relative z-10">

                                                    {/* Candidate Info */}
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="relative shrink-0">
                                                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-50 dark:bg-slate-950 text-[#1e293b] flex items-center justify-center text-lg font-black border border-slate-100 dark:border-slate-800 shadow-sm group-hover:scale-110 transition-transform duration-500 uppercase">
                                                                {app.name?.charAt(0)}
                                                            </div>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base leading-none group-hover:text-[#1e293b] transition-colors truncate mb-1.5">
                                                                {app.name}
                                                            </h3>
                                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight truncate">
                                                                    {app.requirementId?.jobTitle}
                                                                </span>
                                                                <span className="w-1 h-1 rounded-full bg-slate-200 shrink-0" />
                                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate">
                                                                    {app.email}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Referrer Info */}
                                                    <div className="flex flex-col items-center justify-center text-center">
                                                        {app.referral?.referrerName ? (
                                                            <>
                                                                <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1">{app.referral.referrerName}</span>
                                                                <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.15em]">Internal Ref</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Direct Apply</span>
                                                        )}
                                                    </div>

                                                    {/* Status Block */}
                                                    <div className="flex items-center justify-between lg:justify-center w-full lg:w-auto">
                                                        <span className="lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${app.status === 'Selected' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                                            app.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                                'bg-blue-50 text-blue-600 border-blue-100'
                                                            }`}>
                                                            {app.status}
                                                        </span>
                                                    </div>

                                                    {/* Salary / Pay Section */}
                                                    <div className="flex items-center justify-between lg:justify-center w-full lg:w-auto">
                                                        <span className="lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Salary</span>
                                                        {app.salaryAssigned ? (
                                                            <div className="flex flex-col items-end lg:items-center gap-1">
                                                                <button onClick={(e) => { e.stopPropagation(); setSelectedApplicant(app); setShowSalaryPreview(true); }} className="text-[10px] font-black text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 transition shadow-sm uppercase tracking-widest whitespace-nowrap">VIEW PAY</button>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{app.salaryLocked ? 'Pay Locked' : 'Pay Draft'}</span>
                                                                {!app.salaryLocked && (
                                                                    <button onClick={(e) => { e.stopPropagation(); lockApplicantSalary(app); }} className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline uppercase tracking-widest whitespace-nowrap">Lock Salary</button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <button onClick={(e) => { e.stopPropagation(); setSelectedApplicant(app); setShowSalaryModal(true); }} className="text-[10px] font-black text-[#4F46E5] hover:underline uppercase tracking-widest">Assign Pay</button>
                                                        )}
                                                    </div>

                                                    {/* Offer Documentation */}
                                                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between lg:justify-start gap-3 w-full lg:w-auto lg:ml-2">
                                                        <span className="lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Documentation</span>
                                                        <div className="flex items-center gap-3 w-full lg:w-auto justify-end lg:justify-start">
                                                            {app.offerLetterPath ? (
                                                                <div className="flex items-start lg:items-center gap-2.5">
                                                                    <button onClick={(e) => { e.stopPropagation(); viewOfferLetter(app); }} className="w-9 h-9 shrink-0 flex items-center justify-center bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-[#4F46E5] rounded-xl transition-all shadow-sm shadow-slate-200/50 group/preview" title="Preview Offer">
                                                                        <Eye size={14} className="group-hover/preview:scale-110 transition-transform" />
                                                                    </button>
                                                                    <div className="flex flex-col items-end lg:items-start max-w-[120px] 2xl:max-w-[150px]">
                                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5 truncate w-full text-right lg:text-left">Offer Letter</span>
                                                                        {(app.status === 'Fully Signed' || app.offerStatus === 'SIGNED' || app.status === 'Offer Accepted – Awaiting Company Approval') ? (
                                                                            <div className="flex flex-col items-end lg:items-start gap-0.5 w-full">
                                                                                <span className={`text-[9px] font-black uppercase text-right lg:text-left truncate w-full ${
                                                                                        app.status === 'Offer Accepted – Awaiting Company Approval' ? 'text-amber-500 animate-pulse' :
                                                                                            (app.status === 'Fully Signed' ? 'text-emerald-500' : 'text-blue-600')
                                                                                    }`}
                                                                                >
                                                                                    {app.status === 'Offer Accepted – Awaiting Company Approval' ? 'Pending Approval' :
                                                                                        (app.status === 'Fully Signed' ? 'Signed & Stamped' : 'Signed')}
                                                                                </span>
                                                                                {app.status === 'Offer Accepted – Awaiting Company Approval' && (
                                                                                    <button onClick={(e) => { e.stopPropagation(); openCompanyApprovalModal(app); }} className="text-[8px] font-black text-blue-600 hover:text-blue-700 underline uppercase tracking-widest whitespace-nowrap">Sign & Approve</button>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex flex-col items-end lg:items-start gap-0.5 w-full">
                                                                                <span className={`text-[9px] font-black uppercase text-right lg:text-left truncate w-full ${
                                                                                    app.offerStatus === 'EXPIRED' || app.status === 'Offer Expired' || app.offerStatus === 'REJECTED' || app.status === 'Offer Rejected' ? 'text-rose-500' :
                                                                                        (app.offerStatus === 'REQUESTED' || app.offerRevisionRequested ? 'text-orange-500 animate-bounce' : 'text-emerald-500')
                                                                                }`}>
                                                                                    {app.offerStatus === 'EXPIRED' || app.status === 'Offer Expired' ? 'Expired' :
                                                                                        (app.offerStatus === 'REJECTED' || app.status === 'Offer Rejected' ? 'Rejected' :
                                                                                            (app.offerStatus === 'REQUESTED' || app.offerRevisionRequested ? 'Revision Requested' : 'Issued'))}
                                                                                </span>
                                                                                {(app.offerStatus === 'REQUESTED' || app.offerRevisionRequested) && (
                                                                                    <button onClick={(e) => { e.stopPropagation(); openOfferModal(app); }} className="text-[8px] font-black text-blue-600 underline uppercase tracking-widest flex items-center gap-1 hover:text-blue-700 decoration-blue-200 underline-offset-4 justify-end lg:justify-start whitespace-nowrap">
                                                                                        <Edit2 size={10} className="animate-pulse" /> Edit
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : canSendDocuments(app) ? (
                                                                <button
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        try {
                                                                            const res = await api.post(`/applications/${app._id}/request-documents`);
                                                                            if (res.data.success) {
                                                                                showToast('success', 'Documents Sent', 'Candidate has been notified to complete their employment profile.');
                                                                                loadApplicants();
                                                                            }
                                                                        } catch (err) {
                                                                            showToast('error', 'Request Failed', err.response?.data?.message || 'Failed to send documents');
                                                                        }
                                                                    }}
                                                                    className="w-full lg:w-auto px-6 py-2.5 text-[10px] font-black rounded-2xl transition-all shadow-lg dark:shadow-none uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100"
                                                                >
                                                                    Send Documents
                                                                </button>
                                                            ) : (
                                                              <div className="flex flex-col gap-2 w-full lg:w-auto">
                                                                {app.documentRequestStatus !== 'Approved' && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleSendDocumentRequest(app);
                                                                        }}
                                                                        className={`w-full lg:w-auto px-6 py-2.5 text-[10px] font-black rounded-2xl transition-all shadow-lg uppercase tracking-widest ${
                                                                            app.documentRequestStatus 
                                                                                ? 'bg-amber-500 text-white hover:bg-amber-600' 
                                                                                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                                                        }`}
                                                                    >
                                                                        {app.documentRequestStatus ? `Docs: ${app.documentRequestStatus}` : 'Request Docs'}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (!canGenerateOffer(app)) {
                                                                            notification.error({
                                                                                message: 'Action blocked',
                                                                                description: app.documentRequestStatus !== 'Approved' ? 'Candidate documents must be approved before generating an offer.' : 'Offer can only be issued from Interview stage (no bypass allowed).',
                                                                                placement: 'topRight'
                                                                            });
                                                                            return;
                                                                        }
                                                                        openOfferModal(app);
                                                                    }}
                                                                    disabled={!canGenerateOffer(app)}
                                                                    className={`w-full lg:w-auto px-6 py-2.5 text-[10px] font-black rounded-2xl transition-all shadow-lg dark:shadow-none uppercase tracking-widest ${canGenerateOffer(app)
                                                                        ? 'bg-[#4F46E5] text-white hover:bg-indigo-600 shadow-indigo-100'
                                                                        : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                                                                        }`}
                                                                >
                                                                    Generate Offer
                                                                </button>
                                                              </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* BGV Status Section */}
                                                    <div className="flex items-center justify-between lg:justify-center w-full lg:w-auto">
                                                        <span className="lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Verification</span>
                                                        <div className="flex flex-col items-end lg:items-center gap-1">
                                                            <div className={`px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${['CLEAR', 'VERIFIED'].includes(app.bgvStatus) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                app.bgvStatus === 'FAILED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                                    app.bgvStatus === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                                        'bg-slate-50 text-slate-400 border-slate-100'
                                                                }`}>
                                                                {['CLEAR', 'VERIFIED'].includes(app.bgvStatus) ? <ShieldCheck size={10} /> : <Info size={10} />}
                                                                {app.bgvStatus?.replace(/_/g, ' ') || 'BGV Pending'}
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    if (app.bgvStatus && app.bgvStatus !== 'NOT_INITIATED') return navigate(`/hr/bgv?search=${encodeURIComponent(app.name)}`);
                                                                    if (canEdit && ['Offer Accepted', 'Offer Accepted – Awaiting Company Approval', 'Signed', 'Fully Signed', 'Joining Letter Issued', 'Hired'].includes(app.status)) handleInitiateBGV(app);
                                                                }}
                                                                disabled={((!app.bgvStatus || app.bgvStatus === 'NOT_INITIATED') && !['Offer Accepted', 'Offer Accepted – Awaiting Company Approval', 'Signed', 'Fully Signed', 'Joining Letter Issued', 'Hired'].includes(app.status)) || (!canEdit && (!app.bgvStatus || app.bgvStatus === 'NOT_INITIATED'))}
                                                                className={`text-[9px] font-bold uppercase tracking-tight ${((!app.bgvStatus || app.bgvStatus === 'NOT_INITIATED') && !['Offer Accepted', 'Offer Accepted – Awaiting Company Approval', 'Signed', 'Fully Signed', 'Joining Letter Issued', 'Hired'].includes(app.status)) || (!canEdit && (!app.bgvStatus || app.bgvStatus === 'NOT_INITIATED'))
                                                                    ? 'text-slate-200 cursor-not-allowed'
                                                                    : 'text-blue-500 hover:text-blue-700 underline'
                                                                    }`}
                                                            >
                                                                {(!app.bgvStatus || app.bgvStatus === 'NOT_INITIATED') ? 'Start Check' : 'Manage History'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Joining Letters */}
                                                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between lg:justify-start gap-3 w-full lg:w-auto lg:ml-2">
                                                        <span className="lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Joining Letter</span>
                                                        <div className="flex items-center gap-3 justify-end lg:justify-start w-full lg:w-auto">
                                                            {app.joiningLetterPath ? (
                                                                <div className="flex items-start lg:items-center gap-2.5">
                                                                    <button onClick={(e) => { e.stopPropagation(); viewJoiningLetter(app); }} className="w-9 h-9 shrink-0 flex items-center justify-center bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-emerald-600 rounded-xl transition-all shadow-sm shadow-slate-200/50" title="View Joining Letter"><Eye size={14} /></button>
                                                                    <div className="flex flex-col items-end lg:items-start max-w-[120px] 2xl:max-w-[150px]">
                                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5 truncate w-full text-right lg:text-left">Joining Letter</span>
                                                                        <div className="flex flex-col items-end lg:items-start gap-0.5 w-full">
                                                                            <span className={`text-[9px] font-black uppercase text-right lg:text-left truncate w-full ${String(app.joiningLetterStatus || '').toUpperCase() === 'SIGNED'
                                                                                ? 'text-blue-600'
                                                                                : app.joiningLetterStatus === 'ACCEPTED'
                                                                                    ? 'text-emerald-500'
                                                                                    : 'text-slate-400'}`}>
                                                                                {String(app.joiningLetterStatus || 'Issued').replace(/_/g, ' ')}
                                                                            </span>
                                                                            {String(app.joiningLetterStatus || '').toUpperCase() === 'SIGNED' && (
                                                                                <button onClick={(e) => { e.stopPropagation(); openCompanyApprovalModal(app, 'joining'); }} className="text-[8px] font-black text-blue-600 hover:text-blue-700 underline uppercase tracking-widest whitespace-nowrap">Sign & Approve</button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (!canIssueJoining(app)) {
                                                                            notification.error({
                                                                                message: 'Action blocked',
                                                                                description: 'Joining letter can only be issued after the offer is fully signed (no bypass allowed).',
                                                                                placement: 'topRight'
                                                                            });
                                                                            return;
                                                                        }
                                                                        openJoiningModal(app);
                                                                    }}
                                                                    disabled={!canIssueJoining(app)}
                                                                    className={`w-full lg:w-auto px-6 py-2.5 text-[10px] font-black rounded-2xl transition shadow-lg uppercase tracking-widest ${canIssueJoining(app)
                                                                        ? (['CLEAR', 'VERIFIED'].includes(app.bgvStatus)
                                                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20'
                                                                            : 'bg-[#4F46E5] text-white hover:bg-indigo-600 shadow-indigo-100')
                                                                        : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                                                                        }`}
                                                                >
                                                                    Issue
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Main Management Action */}
                                                    <div className="flex items-center justify-between lg:justify-end w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-0 border-slate-50 dark:border-slate-800">
                                                        <span className="lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Step</span>
                                                        {canEdit && (app.isOnboarded ? (
                                                            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 flex items-center justify-center border border-indigo-100 dark:border-indigo-800" title="Success: Converted to Employee">
                                                                <UserCheck size={20} />
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleOnboard(app)}
                                                                disabled={!canMarkJoined(app)}
                                                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${(!canMarkJoined(app))
                                                                    ? 'bg-slate-50 dark:bg-slate-800 text-slate-200 dark:text-slate-700 cursor-not-allowed'
                                                                    : 'bg-[#4F46E5] text-white hover:bg-indigo-600 hover:scale-110 shadow-indigo-100 group/btn'
                                                                    }`}
                                                                title={app.employeeId ? 'Open Onboarding Workspace' : 'Start Onboarding'}
                                                            >
                                                                <ChevronRight size={24} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="px-10 py-6 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">
                            Active Talent Pipeline: {getFilteredApplicants().length} Candidates Synced
                        </div>
                        <Pagination
                            current={currentPage}
                            pageSize={pageSize}
                            total={getFilteredApplicants().length}
                            onChange={(page) => setCurrentPage(page)}
                            showSizeChanger={false}
                            responsive={true}
                            size="small"
                        />
                    </div>
                </div>
            )}

            {/* Company Approval Modal (Phase 2) */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-black">
                        <ShieldCheck className="text-blue-600" size={20} />
                        <span>COMPANY SIGNATURE & APPROVAL</span>
                    </div>
                }
                open={companyApprovalModalVisible}
                onCancel={() => setCompanyApprovalModalVisible(false)}
                footer={null}
                centered
                width={500}
                className="premium-modal"
            >
                <div className="space-y-6 py-4">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
                        <Info className="text-blue-500 shrink-0" size={20} />
                        <p className="text-xs text-blue-700 font-medium leading-relaxed">
                            Candidate <span className="font-bold">{applicantForApproval?.name}</span> has accepted the offer conditions.
                            Please apply the company signature and stamp to finalize the document.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Company Stamp & Position</label>
                                {companyStamp && (
                                    <button
                                        onClick={() => setCompanyStamp(null)}
                                        className="text-[10px] text-rose-500 font-bold hover:underline flex items-center gap-1"
                                    >
                                        <Trash2 size={12} /> Remove Stamp
                                    </button>
                                )}
                            </div>

                            {!companyStamp ? (
                                <div className="h-32 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center justify-center overflow-hidden relative group hover:border-blue-400 transition-colors cursor-pointer" onClick={() => document.getElementById('stampUpload').click()}>
                                    <div className="text-center p-4">
                                        <Upload className="mx-auto text-slate-300 mb-2" size={24} />
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Click to upload stamp</p>
                                    </div>
                                    <input
                                        type="file"
                                        id="stampUpload"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setCompanyStamp(reader.result);
                                                    setStampSettings({ x: 10, y: 80, scale: 0.3 }); // Reset to default position
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Preview Container - Aspect Ratio Approx A4 (1:1.414) */}
                                    {/* We use a fixed height container to simulate the page bottom area or full page */}
                                    {/* Let's simulate the full page scaled down */}
                                    <div
                                        className="relative w-full aspect-[1/1.414] bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden select-none"
                                        ref={stampContainerRef}
                                        onMouseMove={(e) => isDraggingStamp && handleStampDrag(e)}
                                        onMouseUp={handleStampDragEnd}
                                        onMouseLeave={handleStampDragEnd}
                                        style={{ cursor: isDraggingStamp ? 'grabbing' : 'default' }}
                                    >
                                        {/* Reference Grid (Only visible if no PDF) */}
                                        {!pdfPreviewUrl && (
                                            <div className="absolute inset-0 pointer-events-none opacity-10"
                                                style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                                            </div>
                                        )}

                                        {/* PDF PREVIEW IFRAME */}
                                        {pdfPreviewUrl ? (
                                            <div className="absolute inset-0 w-full h-full bg-slate-100">
                                                <iframe
                                                    src={pdfPreviewUrl}
                                                    className="w-full h-full border-none"
                                                    title="Document Preview"
                                                    style={{ pointerEvents: isDraggingStamp ? 'none' : 'auto' }} // Disable pointer events ONLY when dragging stamp
                                                />
                                            </div>
                                        ) : (
                                            /* Mockup Fallback if PDF fails to load */
                                            <>
                                                <div className="absolute top-8 left-8 right-8 space-y-2 pointer-events-none opacity-20">
                                                    <div className="h-4 bg-slate-800 w-1/3 rounded"></div>
                                                    <div className="h-2 bg-slate-400 w-full rounded"></div>
                                                    <div className="h-2 bg-slate-400 w-full rounded"></div>
                                                    <div className="h-2 bg-slate-400 w-2/3 rounded"></div>
                                                </div>

                                                <div className="absolute bottom-8 left-8 space-y-2 pointer-events-none opacity-20">
                                                    <div className="h-px bg-slate-800 w-40 mb-1"></div>
                                                    <div className="text-[8px] font-bold text-slate-800 uppercase">Authorized Signatory</div>
                                                </div>
                                            </>
                                        )}

                                        {/* The Stamp (Draggable Layer) */}
                                        <div
                                            className="absolute cursor-grab active:cursor-grabbing p-1 border-2 border-transparent hover:border-blue-400/50 rounded-lg transition-colors"
                                            style={{
                                                left: `${stampSettings.x}%`,
                                                top: `${stampSettings.y}%`,
                                                transform: `translate(-50%, -50%) scale(${stampSettings.scale})`,
                                                transformOrigin: 'center center',
                                                zIndex: 50
                                            }}
                                            onMouseDown={handleStampDragStart}
                                        >
                                            <img
                                                src={companyStamp}
                                                className="max-w-[200px] object-contain pointer-events-none drop-shadow-md"
                                                alt="Stamp"
                                            />
                                        </div>
                                    </div>

                                    {/* Customization Controls */}
                                    <div className="bg-slate-50 p-3 rounded-xl space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[9px] font-black uppercase text-slate-400">Size / Scale</label>
                                                <span className="text-[9px] font-bold text-blue-600">{Math.round(stampSettings.scale * 100)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.1"
                                                max="1.5"
                                                step="0.05"
                                                value={stampSettings.scale}
                                                onChange={(e) => setStampSettings({ ...stampSettings, scale: parseFloat(e.target.value) })}
                                                className="w-full"
                                            />
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400">X Position</label>
                                                <input
                                                    type="number"
                                                    value={Math.round(stampSettings.x)}
                                                    onChange={(e) => setStampSettings({ ...stampSettings, x: Number(e.target.value) })}
                                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400">Y Position</label>
                                                <input
                                                    type="number"
                                                    value={Math.round(stampSettings.y)}
                                                    onChange={(e) => setStampSettings({ ...stampSettings, y: Number(e.target.value) })}
                                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <button
                            onClick={handleApproveCompany}
                            disabled={isApproving || (!companySig && !companyStamp)}
                            className={`w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all flex items-center justify-center gap-2
                                ${isApproving || (!companySig && !companyStamp)
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100 active:scale-[0.98]'}`}
                        >
                            {isApproving ? <RefreshCw className="animate-spin" size={18} /> : (
                                <>
                                    <CheckCircle size={18} />
                                    <span>APPROVE & SIGN OFFER LETTER</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
            {/* Sequential Approval Workflow Config Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-slate-800 dark:text-white font-black">
                        <ShieldCheck className="text-blue-600" size={20} />
                        <span>CONFIGURE SEQUENTIAL APPROVAL WORKFLOW</span>
                    </div>
                }
                open={approvalEmailsModalVisible}
                onCancel={() => setApprovalEmailsModalVisible(false)}
                footer={null}
                centered
                width={500}
                className="premium-modal"
            >
                <form onSubmit={handleConfirmApprovalWorkflow} className="space-y-6 py-4">
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-500/20 p-4 rounded-xl flex gap-3">
                        <Info className="text-blue-500 shrink-0" size={20} />
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
                            Specify the sequential approval chain for this offer letter. 
                            The offer letter will be blocked from candidate visibility and route through Manager → HR Head → CEO for approval.
                        </p>
                    </div>

                    {/* Email Template Selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-2">
                            <Mail size={12} className="text-blue-500" />
                            Email Template
                        </label>
                        <select
                            value={offerData.emailTemplateId || ''}
                            onChange={(e) => setOfferData(prev => ({ ...prev, emailTemplateId: e.target.value }))}
                            className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl p-3 h-12 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
                        >
                            <option value="">-- Default Email Format --</option>
                            {emailTemplates?.map(t => (
                                <option key={t._id} value={t._id}>{t.name}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Select a custom email template to be sent to the candidate upon final approval.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {Array.isArray(approvalEmails) && approvalEmails.map((approver, index) => (
                            <div key={index} className="flex gap-2 items-start">
                                <div className="flex-1 space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider">
                                        {index + 1}. Role Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={approver.roleName}
                                        onChange={(e) => {
                                            const newEmails = [...approvalEmails];
                                            newEmails[index].roleName = e.target.value;
                                            newEmails[index].name = e.target.value;
                                            setApprovalEmails(newEmails);
                                        }}
                                        placeholder="e.g. HR Head"
                                        className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 h-[42px]"
                                    />
                                </div>
                                <div className="flex-[1.5] space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider">
                                        Email <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="email"
                                            required
                                            value={approver.email}
                                            onChange={(e) => {
                                                const newEmails = [...approvalEmails];
                                                newEmails[index].email = e.target.value;
                                                setApprovalEmails(newEmails);
                                            }}
                                            placeholder="email@company.com"
                                            className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 h-[42px]"
                                        />
                                        {approvalEmails.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newEmails = [...approvalEmails];
                                                    newEmails.splice(index, 1);
                                                    setApprovalEmails(newEmails);
                                                }}
                                                className="h-[42px] px-3 border border-rose-200 text-rose-500 rounded-lg hover:bg-rose-50 hover:text-rose-600 dark:border-rose-900/30 dark:hover:bg-rose-500/10 transition-colors"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setApprovalEmails([...approvalEmails, { roleName: '', email: '', name: '' }]);
                                }}
                                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
                            >
                                <Plus size={14} /> Add Approver
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                        <button
                            type="button"
                            onClick={() => setApprovalEmailsModalVisible(false)}
                            className="flex-1 h-12 rounded-xl font-bold uppercase tracking-wider text-xs border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={generating}
                            className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100 dark:shadow-none flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {generating ? (
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle size={14} />
                                    <span>Submit & Start Flow</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Offer Letter */}
            {
                showModal && selectedApplicant && (
                    <div className="fixed top-4 bottom-4 left-4 right-4 z-[55] !mt-0 bg-slate-950/45 p-0 backdrop-blur-sm lg:left-[calc(var(--hr-sidebar-width)+16px)] dark:bg-slate-950/75">
                        <div className="mx-auto flex h-full max-w-[98%] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-[#0F172A] dark:text-slate-100">
                            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pt-0 pb-4 sm:px-5 lg:px-6 sm:pb-5">
                                <div className="sticky top-0 z-[1] -mx-3 flex items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-3 pb-3 pt-0 dark:border-slate-800 dark:bg-[#0F172A] sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6">
                                    <div className="min-w-0">
                                        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                                            <FileText size={13} />
                                            Offer workflow
                                        </div>
                                        <h2 className="m-0 text-lg font-black leading-tight tracking-tight text-slate-900 dark:text-white sm:text-xl">Generate Offer Letter</h2>
                                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Preview first, then generate the final candidate offer PDF.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={resetOfferLetterUi}
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                        aria-label="Close offer letter form"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <section className="pb-5 pt-3 border-b border-slate-200/80 dark:border-slate-800">
                                    <div className="grid grid-cols-1 gap-2 text-sm text-slate-600 dark:text-slate-400 md:grid-cols-3 md:gap-4">
                                        <p className="min-w-0"><span className="font-bold text-slate-800 dark:text-slate-200">Candidate:</span> {selectedApplicant.name}</p>
                                        <p className="min-w-0"><span className="font-bold text-slate-800 dark:text-slate-200">Role:</span> {selectedApplicant.requirementId?.jobTitle || '—'}</p>
                                        <p className="min-w-0"><span className="font-bold text-slate-800 dark:text-slate-200">Location:</span> {offerData.location || '—'}</p>
                                    </div>
                                </section>

                                <form onSubmit={(e) => { e.preventDefault(); handlePreview(); }} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-x-5 md:gap-y-3">
                                        
                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Reference Number</label>
                                            <input
                                                type="text"
                                                name="refNo"
                                                value={offerData.refNo || ''}
                                                onChange={handleOfferChange}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                                placeholder="e.g. GT/OFFER/2026/001"
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Issue Date</label>
                                            <DatePicker
                                                className="offer-form-date-cell mt-1 w-full min-w-0"
                                                format={getDatePickerFormat(offerData.dateFormat)}
                                                placeholder={offerData.dateFormat || "DD-MM-YYYY"}
                                                value={offerData.issueDate ? dayjs(offerData.issueDate) : null}
                                                onChange={(date) => handleOfferChange({ target: { name: 'issueDate', value: date ? date.format('YYYY-MM-DD') : '' } })}
                                                getPopupContainer={() => document.body}
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Title (Salutation)</label>
                                            <select
                                                name="salutation"
                                                value={offerData.salutation || ''}
                                                onChange={handleOfferChange}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            >
                                                <option value="">-- Select --</option>
                                                <option value="Mr.">Mr.</option>
                                                <option value="Ms.">Ms.</option>
                                                <option value="Mrs.">Mrs.</option>
                                                <option value="Dr.">Dr.</option>
                                            </select>
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Relation Type</label>
                                            <select
                                                name="relationType"
                                                value={normalizeOfferRelationType(offerData.relationType)}
                                                onChange={handleOfferChange}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            >
                                                {RELATION_TYPE_OPTIONS.map((type) => (
                                                    <option key={type} value={type}>{type}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Probation Period</label>
                                            <input
                                                type="text"
                                                name="probationPeriod"
                                                value={offerData.probationPeriod || ''}
                                                onChange={handleOfferChange}
                                                placeholder="e.g. 3 months"
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date Format</label>
                                            <select
                                                name="dateFormat"
                                                value={offerData.dateFormat || 'Do MMM. YYYY'}
                                                onChange={handleOfferChange}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            >
                                                <option value="Do MMM. YYYY">17th Jan. 2026 (Default)</option>
                                                <option value="DD/MM/YYYY">17/01/2026</option>
                                                <option value="Do MMMM YYYY">17th January 2026</option>
                                                <option value="YYYY-MM-DD">2026-01-17</option>
                                            </select>
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Candidate Name</label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={offerData.name || ''}
                                                onChange={handleOfferChange}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Dear Name</label>
                                            <input
                                                type="text"
                                                name="dearName"
                                                value={offerData.dearName || ''}
                                                onChange={handleOfferChange}
                                                placeholder="e.g. First Name only"
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Joining Date <span className="text-red-500">*</span></label>
                                            <DatePicker
                                                disabledDate={(current) => current && current < dayjs().startOf('day')}
                                                className="offer-form-date-cell mt-1 w-full min-w-0"
                                                format={getDatePickerFormat(offerData.dateFormat)}
                                                placeholder={offerData.dateFormat || "DD-MM-YYYY"}
                                                value={offerData.joiningDate ? dayjs(offerData.joiningDate) : null}
                                                onChange={(date) => handleOfferChange({ target: { name: 'joiningDate', value: date ? date.format('YYYY-MM-DD') : '' } })}
                                                getPopupContainer={() => document.body}
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Offer Template</label>
                                            <select
                                                name="templateId"
                                                value={offerData.templateId || ''}
                                                onChange={handleOfferChange}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            >
                                                <option value="">-- Select Template --</option>
                                                {templates.map(t => (
                                                    <option key={t._id} value={t._id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Job Category <span className="text-red-500">*</span></label>
                                            <select
                                                name="jobCategory"
                                                value={offerData.jobCategory || 'Full Time'}
                                                onChange={handleOfferChange}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            >
                                                <option value="Full Time">Full Time</option>
                                                <option value="Full Time (Salary Mandatory)">Full Time (Salary Mandatory)</option>
                                                <option value="Intern">Intern (Salary Optional)</option>
                                            </select>
                                        </div>


                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Offer Expiry Date &amp; Time <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                value={offerExpiryAtText || ''}
                                                onChange={(e) => {
                                                    const next = e.target.value;
                                                    setOfferExpiryAtText(next);
                                                    const parsed = parseOfferExpiryText(next);
                                                    if (parsed) {
                                                        setOfferData((prev) => ({ ...prev, expiryAt: parsed.toISOString() }));
                                                    } else if (!next.trim()) {
                                                        setOfferData((prev) => ({ ...prev, expiryAt: '' }));
                                                    }
                                                }}
                                                onBlur={() => {
                                                    const parsed = parseOfferExpiryText(offerExpiryAtText);
                                                    if (parsed) {
                                                        setOfferData((prev) => ({ ...prev, expiryAt: parsed.toISOString() }));
                                                        setOfferExpiryAtText(parsed.format('DD-MM-YYYY HH:mm'));
                                                    }
                                                }}
                                                placeholder="DD-MM-YYYY HH:mm"
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            />
                                        </div>

                                        <div className="min-w-0 md:col-span-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-x-5 md:items-start">
                                            {!offerData.address && (
                                                <div className="min-w-0 flex flex-col">
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Candidate Address</label>
                                                    <input
                                                        type="text"
                                                        name="address"
                                                        value={offerData.address || ''}
                                                        onChange={handleOfferChange}
                                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                                        placeholder="Full address with pin code..."
                                                    />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex flex-col">
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Candidate Signature Position</label>
                                                <select
                                                    value={offerData.signaturePosition?.alignment || 'right'}
                                                    onChange={(e) => setOfferData(prev => ({ ...prev, signaturePosition: { alignment: e.target.value } }))}
                                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                                >
                                                    <option value="left">Left Alignment</option>
                                                    <option value="center">Center Alignment</option>
                                                    <option value="right">Right Alignment (Standard)</option>
                                                </select>
                                            </div>
                                        </div>

                                        {(() => {
                                            const filteredFields = offerCustomFields.filter(field => {
                                                return !isOfferAutoFieldKey(field.key);
                                            });

                                            if (filteredFields.length === 0) return null;

                                            return (
                                                <div className="min-w-0 md:col-span-3 rounded-xl border border-indigo-100 bg-white p-4 dark:border-indigo-500/20 dark:bg-slate-950">
                                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                        <div>
                                                            <h3 className="m-0 text-sm font-black text-slate-800 dark:text-slate-100">Custom Template Fields</h3>
                                                        </div>
                                                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                                                            {filteredFields.length} Additional Fields
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                                        {filteredFields.map((field) => (
                                                            <div key={field.key} className="min-w-0">
                                                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                                                    {field.label}
                                                                    {field.required && <span className="text-red-500"> *</span>}
                                                                </label>
                                                                {field.type === 'textarea' ? (
                                                                    <textarea
                                                                        value={offerData.customData?.[field.key] || ''}
                                                                        onChange={(e) => handleOfferCustomFieldChange(field.key, e.target.value)}
                                                                        placeholder={field.placeholder}
                                                                        required={field.required}
                                                                        rows={3}
                                                                        className="mt-1 block w-full resize-none rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                                                                    />
                                                                ) : (
                                                                    <input
                                                                        type={field.type === 'phone' ? 'tel' : field.type}
                                                                        value={offerData.customData?.[field.key] || ''}
                                                                        onChange={(e) => handleOfferCustomFieldChange(field.key, e.target.value)}
                                                                        placeholder={field.placeholder}
                                                                        required={field.required}
                                                                        className="mt-1 block h-[42px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                                                                    />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <div className="flex flex-col-reverse gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-4 sm:flex-row sm:justify-end md:col-span-3 md:pt-4">
                                            <button
                                                type="button"
                                                onClick={resetOfferLetterUi}
                                                className="w-full sm:w-auto px-5 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={generating}
                                                className="w-full sm:w-auto h-11 px-6 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                                            >
                                                {generating ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0" />
                                                        <span>PREPARING...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle size={18} className="shrink-0" />
                                                        <span>PREVIEW OFFER</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Joining Letter — main column; flat single background (no card boxes), matches HR main */}
            {
                showJoiningModal && selectedApplicant && (
                    <div className="fixed top-14 sm:top-20 left-0 right-0 bottom-0 z-[55] !mt-0 flex flex-col bg-white text-slate-900 lg:left-[var(--hr-sidebar-width)] dark:bg-[#0F172A] dark:text-slate-100">
                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-[#0F172A]">
                            <div className="w-full min-h-full px-3 pt-0 pb-4 sm:px-5 lg:px-6 sm:pb-5">
                                <div className="sticky top-0 z-[1] -mx-3 px-3 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6 pt-0 pb-2 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A]">
                                    <h2 className="m-0 text-lg font-black leading-tight tracking-tight text-slate-900 dark:text-white sm:text-xl">Generate Joining Letter</h2>
                                </div>

                                <section className="pb-5 pt-3 border-b border-slate-200/80 dark:border-slate-800">
                                    <div className="grid grid-cols-1 gap-2 text-sm text-slate-600 dark:text-slate-400 md:grid-cols-3 md:gap-4">
                                        <p className="min-w-0"><span className="font-bold text-slate-800 dark:text-slate-200">Candidate:</span> {selectedApplicant.name}</p>
                                        <p><span className="font-bold text-slate-800 dark:text-slate-200">Joining Date:</span> {selectedApplicant.joiningDate ? new Date(selectedApplicant.joiningDate).toLocaleDateString('en-GB') : 'N/A'}</p>
                                        <p className="min-w-0"><span className="font-bold text-slate-800 dark:text-slate-200">Location:</span> {selectedApplicant.location || selectedApplicant.workLocation || 'N/A'}</p>
                                    </div>
                                </section>

                                <div className="pt-5">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-x-5 md:gap-y-3">
                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Joining Letter Template</label>
                                            <select
                                                value={joiningTemplateId}
                                                onChange={(e) => handleJoiningTemplateChange(e.target.value)}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            >
                                                <option value="">-- Select Joining Template --</option>
                                                {joiningTemplates.map(t => (
                                                    <option key={t._id} value={t._id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Reference Number</label>
                                            <input
                                                type="text"
                                                value={joiningRefNo}
                                                onChange={(e) => setJoiningRefNo(e.target.value)}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                                placeholder="e.g. JL/2025/001"
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Letter Issue Date</label>
                                            <DatePicker
                                                className="offer-form-date-cell mt-1 w-full min-w-0"
                                                format={getDatePickerFormat(joiningDateFormat)}
                                                placeholder={joiningDateFormat || 'DD-MM-YYYY'}
                                                value={joiningIssueDate ? dayjs(joiningIssueDate) : null}
                                                onChange={(date) => {
                                                    const val = date ? date.format('YYYY-MM-DD') : '';
                                                    setJoiningIssueDate(val);
                                                    setJoiningIssueDateText(val ? toDisplayDate(val, joiningDateFormat) : '');
                                                }}
                                                getPopupContainer={() => document.body}
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Title (Salutation)</label>
                                            <select
                                                value={joiningSalutation}
                                                onChange={(e) => setJoiningSalutation(e.target.value)}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            >
                                                <option value="Mr.">Mr.</option>
                                                <option value="Ms.">Ms.</option>
                                                <option value="Mrs.">Mrs.</option>
                                                <option value="Dr.">Dr.</option>
                                            </select>
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Relation Type</label>
                                            <select
                                                value={joiningRelationType}
                                                onChange={(e) => setJoiningRelationType(e.target.value)}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            >
                                                {RELATION_TYPE_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Probation Period</label>
                                            <input
                                                type="text"
                                                value={joiningProbationPeriod}
                                                onChange={(e) => setJoiningProbationPeriod(e.target.value)}
                                                placeholder="e.g. 3 months"
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date Format</label>
                                            <select
                                                value={joiningDateFormat}
                                                onChange={(e) => handleJoiningDateFormatChange(e.target.value)}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            >
                                                <option value="Do MMM. YYYY">15th May. 2026 (Standard)</option>
                                                <option value="DD/MM/YYYY">15/05/2026</option>
                                                <option value="MMMM DD, YYYY">May 15, 2026</option>
                                                <option value="YYYY-MM-DD">2026-05-15</option>
                                            </select>
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Candidate Name</label>
                                            <input
                                                type="text"
                                                value={joiningName}
                                                onChange={(e) => setJoiningName(e.target.value)}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Dear Name</label>
                                            <input
                                                type="text"
                                                value={joiningDearName}
                                                onChange={(e) => setJoiningDearName(e.target.value)}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Joining Date <span className="text-red-500">*</span></label>
                                            <DatePicker
                                                className="offer-form-date-cell mt-1 w-full min-w-0"
                                                format={getDatePickerFormat(joiningDateFormat)}
                                                placeholder={joiningDateFormat || 'DD-MM-YYYY'}
                                                value={joiningDateVal ? dayjs(joiningDateVal) : null}
                                                onChange={(date) => {
                                                    const val = date ? date.format('YYYY-MM-DD') : '';
                                                    setJoiningDateVal(val);
                                                    setJoiningDateText(val ? toDisplayDate(val, joiningDateFormat) : '');
                                                }}
                                                getPopupContainer={() => document.body}
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Letter Acceptance Expiry Date &amp; Time <span className="text-red-500">*</span>
                                            </label>
                                            <DatePicker
                                                showTime={{ format: 'HH:mm' }}
                                                className="offer-form-date-cell mt-1 w-full min-w-0"
                                                format="DD/MM/YYYY HH:mm"
                                                placeholder="Select date & time"
                                                value={joiningLetterExpiryDate ? dayjs(joiningLetterExpiryDate) : null}
                                                onChange={(date) => {
                                                    if (date) {
                                                        setJoiningLetterExpiryDate(date.toISOString());
                                                        setJoiningExpiryAt(date.format('YYYY-MM-DD'));
                                                        setJoiningExpiryAtText(toDisplayDate(date, joiningDateFormat));
                                                        setJoiningLetterExpiryText(toDisplayDate(date, joiningDateFormat) + ' ' + date.format('HH:mm'));
                                                    } else {
                                                        setJoiningLetterExpiryDate('');
                                                        setJoiningExpiryAt('');
                                                        setJoiningExpiryAtText('');
                                                        setJoiningLetterExpiryText('');
                                                    }
                                                }}
                                                getPopupContainer={() => document.body}
                                            />
                                        </div>


                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Candidate Signature Position</label>
                                            <select
                                                value={joiningSignaturePosition.alignment}
                                                onChange={(e) => setJoiningSignaturePosition({ alignment: e.target.value })}
                                                className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 h-[42px]"
                                            >
                                                <option value="left">Left Alignment</option>
                                                <option value="center">Center Alignment</option>
                                                <option value="right">Right Alignment (Standard)</option>
                                            </select>
                                        </div>

                                        {(() => {
                                            const filteredFields = joiningCustomFields.filter(field => !isOfferAutoFieldKey(field.key));
                                            if (filteredFields.length === 0) return null;

                                            return (
                                                <div className="min-w-0 md:col-span-3 rounded-xl border border-indigo-100 bg-white p-4 dark:border-indigo-500/20 dark:bg-slate-950">
                                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                        <h3 className="m-0 text-sm font-black text-slate-800 dark:text-slate-100">Custom Template Fields</h3>
                                                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                                                            {filteredFields.length} Additional Fields
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                                        {filteredFields.map((field) => (
                                                            <div key={field.key} className="min-w-0">
                                                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                                                    {field.label}
                                                                    {field.required && <span className="text-red-500"> *</span>}
                                                                </label>
                                                                {field.type === 'textarea' ? (
                                                                    <textarea
                                                                        value={joiningCustomData?.[field.key] || ''}
                                                                        onChange={(e) => handleJoiningCustomFieldChange(field.key, e.target.value)}
                                                                        placeholder={field.placeholder}
                                                                        required={field.required}
                                                                        rows={3}
                                                                        className="mt-1 block w-full resize-none rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                                                                    />
                                                                ) : (
                                                                    <input
                                                                        type={field.type === 'phone' ? 'tel' : field.type}
                                                                        value={joiningCustomData?.[field.key] || ''}
                                                                        onChange={(e) => handleJoiningCustomFieldChange(field.key, e.target.value)}
                                                                        placeholder={field.placeholder}
                                                                        required={field.required}
                                                                        className="mt-1 block h-[42px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                                                                    />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <div className="flex flex-col-reverse gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-4 sm:flex-row sm:justify-end md:col-span-3 md:pt-4">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowJoiningModal(false);
                                                    closeJoiningPreview();
                                                }}
                                                className="w-full sm:w-auto px-5 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleJoiningPreview}
                                                disabled={generating}
                                                className="w-full sm:w-auto px-5 py-2 rounded-lg text-sm font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 transition"
                                            >
                                                {generating ? 'Loading...' : 'Preview'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleJoiningPreview}
                                                disabled={generating}
                                                className="w-full sm:w-auto px-5 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition"
                                            >
                                                {generating ? 'Generating Preview...' : 'Generate & Preview Joining Letter'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Joining Letter Preview — main column; flat single background (no card boxes), matches HR main */}
            {
                showJoiningPreview && selectedApplicant && (
                    <div className="fixed top-14 sm:top-20 left-0 right-0 bottom-0 z-[65] !mt-0 lg:left-[var(--hr-sidebar-width)] bg-black bg-opacity-75 overflow-y-auto">
                        <div className="min-h-full py-4 px-3 sm:px-5 sm:py-6">
                            {/* Sticky Header with Buttons */}
                            <div className="sticky top-0 z-10 bg-gradient-to-b from-black via-black to-transparent pb-6 mb-4">
                                <div className="max-w-5xl mx-auto flex justify-between items-center gap-3">
                                    <h2 className="text-xl font-bold text-white">Joining Letter Preview</h2>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={closeJoiningPreview}
                                            className="px-4 py-2 bg-white text-slate-700 rounded-lg hover:bg-slate-100 shadow-lg font-medium transition"
                                        >
                                            Close
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setWorkflowLetterType('joining');
                                                if (!Array.isArray(approvalEmails) || approvalEmails.length === 0) {
                                                    setApprovalEmails([
                                                        { roleName: 'Manager', email: '', name: 'Manager' }
                                                    ]);
                                                }
                                                setApprovalEmailsModalVisible(true);
                                            }}
                                            className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 shadow-lg font-medium transition flex items-center gap-2"
                                        >
                                            <ShieldCheck size={16} />
                                            Configure Approval Workflow
                                        </button>
                                        <button
                                            onClick={(e) => handleJoiningGenerate(e, null)}
                                            disabled={generating}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg font-medium disabled:opacity-50 transition"
                                        >
                                            {generating ? 'Sending...' : 'Send Directly'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Preview Content */}
                            <div className="max-w-5xl mx-auto">
                                {joiningPreviewHtml ? (
                                    <div
                                        className="w-full h-[80vh] rounded-lg shadow-xl bg-white overflow-y-auto p-10 prose prose-slate max-w-none"
                                        dangerouslySetInnerHTML={{ __html: joiningPreviewHtml }}
                                    />
                                ) : joiningPreviewUrl ? (
                                    <iframe
                                        src={joiningPreviewUrl}
                                        className="w-full h-[80vh] rounded-lg shadow-xl bg-white"
                                        title="Joining Letter PDF Preview"
                                    />
                                ) : (
                                    <div className="w-full h-[80vh] rounded-lg shadow-xl bg-white flex items-center justify-center">
                                        <p className="text-gray-500">Loading preview...</p>
                                    </div>
                                )}
                            </div>

                            {/* Bottom Padding */}
                            <div className="h-8"></div>
                        </div>
                    </div>
                )
            }

            {/* Offer Letter Preview — same main-column bounds as offer form */}
            {
                showPreview && selectedApplicant && (
                    <div className="fixed top-14 sm:top-20 left-0 right-0 bottom-0 z-[65] !mt-0 lg:left-[var(--hr-sidebar-width)] bg-black bg-opacity-75 overflow-y-auto">
                        <div className="min-h-full py-4 px-3 sm:px-5 sm:py-6">
                            {/* Sticky Header with Buttons */}
                            <div className="sticky top-0 z-10 bg-gradient-to-b from-black via-black to-transparent pb-6 mb-4">
                                <div className="max-w-5xl mx-auto flex justify-between items-center gap-3">
                                    <h2 className="text-xl font-bold text-white">Offer Letter Preview</h2>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={closeOfferPreview}
                                            className="px-4 py-2 bg-white text-slate-700 rounded-lg hover:bg-slate-100 shadow-lg font-medium transition"
                                        >
                                            Close Offer Preview
                                        </button>
                                        <button
                                            onClick={(e) => handleGenerateClick(e)}
                                            disabled={generating}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg font-medium disabled:opacity-50 transition"
                                        >
                                            {generating ? 'Sending...' : 'Generate & Send Offer Letter'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Preview Content */}
                            <div className="max-w-5xl mx-auto">
                                {offerData.isWordPreview && offerData.htmlContent ? (
                                    <div
                                        className="w-full h-[80vh] rounded-lg shadow-xl bg-white overflow-y-auto p-10 prose prose-slate max-w-none"
                                        dangerouslySetInnerHTML={{ __html: offerData.htmlContent }}
                                    />
                                ) : offerData.isWordTemplate && previewPdfUrl ? (
                                    <iframe
                                        src={previewPdfUrl}
                                        className="w-full h-[80vh] rounded-lg shadow-xl bg-white"
                                        title="PDF Preview"
                                    />
                                ) : (
                                    <OfferLetterPreview
                                        applicant={selectedApplicant}
                                        offerData={offerData}
                                        companyInfo={companyInfo}
                                    />
                                )}
                            </div>

                            {/* Bottom Padding */}
                            <div className="h-8"></div>
                        </div>
                    </div>
                )
            }

            {/* Initial Compensation Modal */}
            {
                showSalaryModal && selectedApplicant && (
                    <InitialCompensationModal
                        applicant={selectedApplicant}
                        onClose={() => setShowSalaryModal(false)}
                        onSuccess={() => {
                            loadApplicants();
                            setShowSalaryModal(false);
                            showToast('success', 'Salary Configured', 'Candidate salary configuration has been saved successfully.');
                        }}
                    />
                )
            }

            {/* Salary Preview Modal */}
            {
                showSalaryPreview && selectedApplicant && (selectedApplicant.salarySnapshotId || selectedApplicant.salarySnapshot) && (() => {
                    // Logic: Use populated object if available, else fallback to embedded snapshot. 
                    // If salarySnapshotId is a string (unpopulated ID), we MUST use local snapshot.
                    const snapshot = (typeof selectedApplicant.salarySnapshotId === 'object' && selectedApplicant.salarySnapshotId !== null)
                        ? selectedApplicant.salarySnapshotId
                        : selectedApplicant.salarySnapshot;
                    const earnings = snapshot.earnings || [];
                    const deductions = snapshot.employeeDeductions || snapshot.deductions || [];
                    const calculatedGross = earnings.reduce((sum, e) => sum + parseFloat(e.monthlyAmount !== undefined ? e.monthlyAmount : e.monthly || 0), 0);
                    const calculatedDeductions = deductions.reduce((sum, d) => sum + parseFloat(d.monthlyAmount !== undefined ? d.monthlyAmount : d.monthly || 0), 0);
                    const calculatedNet = calculatedGross - calculatedDeductions;
                    const calculatedCtcYearly = calculatedGross * 12;

                    const takeHome = snapshot.breakdown?.netPay || snapshot.breakdown?.takeHome || snapshot.takeHome?.monthly || snapshot.takeHome || snapshot.totals?.netMonthly || snapshot.netPay || calculatedNet;
                    const ctcYearly = snapshot.annualCTC || snapshot.ctc?.yearly || (typeof snapshot.ctc === 'number' ? snapshot.ctc : 0) || snapshot.totals?.ctcYearly || snapshot.totals?.totalCTC || calculatedCtcYearly;
                    const grossMonthly = snapshot.breakdown?.totalEarnings || snapshot.breakdown?.grossA || snapshot.grossA?.monthly || snapshot.grossA || snapshot.totals?.grossMonthly || snapshot.grossMonthly || calculatedGross;

                    const formatCurrency = (amount) => {
                        const val = Math.round(parseFloat(amount || 0));
                        return `₹${val.toLocaleString('en-IN')}`;
                    };

                    return (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                                {/* Header */}
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Salary Structure</h3>
                                        <p className="text-sm text-slate-500">{selectedApplicant.name} · {selectedApplicant.requirementId?.jobTitle}</p>
                                    </div>
                                    <button onClick={() => setShowSalaryPreview(false)} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500">
                                        ✕
                                    </button>
                                </div>

                                {/* Body - Scrollable */}
                                <div className="p-6 overflow-y-auto space-y-6">
                                    {/* Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Earnings */}
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider border-b border-emerald-100 pb-2">Earnings (Monthly)</h4>
                                            <div className="space-y-2">
                                                {earnings.map((e, i) => {
                                                    const amount = e.monthlyAmount !== undefined ? e.monthlyAmount : e.monthly;
                                                    return (
                                                        <div key={i} className="flex justify-between text-sm group border-b border-dashed border-slate-100 pb-1 last:border-0">
                                                            <span className="text-slate-600 group-hover:text-slate-900">{e.name}</span>
                                                            <span className="font-medium text-slate-800">{formatCurrency(amount)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-800 mt-2">
                                                <span>Gross Earnings</span>
                                                <span>{formatCurrency(grossMonthly)}</span>
                                            </div>
                                        </div>

                                        {/* Deductions */}
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider border-b border-rose-100 pb-2">Deductions (Monthly)</h4>
                                            <div className="space-y-2">
                                                {deductions.length > 0 ? (
                                                    deductions.map((d, i) => {
                                                        const amount = d.monthlyAmount !== undefined ? d.monthlyAmount : d.monthly;
                                                        return (
                                                            <div key={i} className="flex justify-between text-sm group border-b border-dashed border-slate-100 pb-1 last:border-0">
                                                                <span className="text-slate-600 group-hover:text-slate-900">{d.name}</span>
                                                                <span className="font-medium text-rose-600">-{formatCurrency(amount)}</span>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="text-xs text-slate-400 italic">No deductions</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary Card */}
                                    <div className="bg-slate-50 text-slate-900 rounded-xl p-5 shadow-sm border border-slate-200">
                                        <div className="grid grid-cols-2 gap-4 text-center divide-x divide-slate-200">
                                            <div>
                                                <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">Monthly Net Pay</div>
                                                <div className="text-2xl font-bold text-emerald-600">{formatCurrency(takeHome)}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">Annual CTC</div>
                                                <div className="text-xl font-bold text-slate-800">{formatCurrency(ctcYearly)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                    <button
                                        onClick={() => { setShowSalaryPreview(false); setShowSalaryModal(true); }}
                                        className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                    >
                                        Edit Structure
                                    </button>
                                    <button
                                        onClick={() => setShowSalaryPreview(false)}
                                        className="px-6 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition shadow-lg"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }

            {/* Custom Stage Modal */}
            {
                isCustomStageModalVisible && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Add Custom Stage</h2>
                            <p className="text-sm text-slate-600 mb-4">Enter the name for the new ad-hoc stage. This will be added for <b>{candidateForCustomStage?.name}</b>.</p>

                            <input
                                type="text"
                                value={customStageName}
                                onChange={(e) => setCustomStageName(e.target.value)}
                                placeholder="e.g. Manager Review 2"
                                className="w-full p-2 border border-slate-300 rounded mb-4"
                                autoFocus
                            />

                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setIsCustomStageModalVisible(false)} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                                <button onClick={handleAddCustomStage} className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Add & Move</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Workflow Edit Modal */}
            {
                showWorkflowEditModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Edit Hiring Workflow</h2>
                                <button onClick={() => setShowWorkflowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>

                            <p className="text-sm text-slate-500 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                Customize the hiring process for <b>{selectedRequirement?.jobTitle}</b>.
                                Adding steps here updates the job for all candidates.
                            </p>

                            <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
                                {editingWorkflow.map((stage, index) => (
                                    <div
                                        key={index}
                                        className={`flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200 group ${stage === 'Applied' || stage === 'Finalized' ? 'opacity-80' : 'cursor-move hover:border-blue-300'}`}
                                        draggable={stage !== 'Applied' && stage !== 'Finalized'}
                                        onDragStart={(e) => {
                                            dragItem.current = index;
                                            e.target.classList.add('opacity-50');
                                        }}
                                        onDragEnter={(e) => {
                                            dragOverItem.current = index;
                                        }}
                                        onDragEnd={(e) => {
                                            e.target.classList.remove('opacity-50');
                                            handleSort();
                                        }}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        {/* Grip Handle for Draggable Items */}
                                        {stage !== 'Applied' && stage !== 'Finalized' ? (
                                            <div className="text-slate-400 cursor-grab active:cursor-grabbing">
                                                <GripVertical size={16} />
                                            </div>
                                        ) : (
                                            <div className="w-4"></div> // Spacer
                                        )}

                                        <div className="flex-1 text-sm font-medium text-slate-700">
                                            {index + 1}. {stage}
                                        </div>
                                        {/* Prevent removing critical stages if needed, or allow full flexibility */}
                                        {stage !== 'Applied' && stage !== 'Finalized' && (
                                            <button
                                                onClick={() => handleStageRemove(index)}
                                                className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2 mb-6">
                                <input
                                    type="text"
                                    value={newStageName}
                                    onChange={(e) => setNewStageName(e.target.value)}
                                    placeholder="New Stage Name (e.g. Logic Test)"
                                    className="flex-1 p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && handleStageAdd()}
                                />
                                <button
                                    onClick={handleStageAdd}
                                    className="bg-blue-100 text-blue-600 p-2 rounded hover:bg-blue-200 transition"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => setShowWorkflowEditModal(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveWorkflowChanges}
                                    disabled={loading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md text-sm font-medium disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* End of Workflow Edit Modal */}
            {/* Candidate Details & Resume Modal */}
            {
                showCandidateModal && selectedApplicant && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-stretch justify-stretch overflow-hidden p-0">
                        <div className="bg-white w-screen h-screen rounded-none shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 sm:px-8 py-4 border-b border-slate-200 bg-white gap-4 shrink-0 shadow-sm">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="h-11 w-11 rounded-xl bg-slate-900 text-white flex items-center justify-center text-base font-black uppercase shadow-lg">
                                            {(selectedApplicant.name || '?').charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight truncate">
                                                {selectedApplicant.name}
                                            </h2>
                                            <p className="text-sm text-slate-500 truncate">Applied for <span className="font-semibold text-slate-700">{selectedApplicant.requirementId?.jobTitle || 'N/A'}</span></p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(selectedApplicant.status)}`}>
                                            {selectedApplicant.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                                    <div className="flex bg-slate-200/50 p-1 rounded-xl mr-4">
                                        <button
                                            onClick={() => setModalActiveTab('Resume')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${modalActiveTab === 'Resume' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Resume
                                        </button>
                                        <button
                                            onClick={() => setModalActiveTab('Activity')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${modalActiveTab === 'Activity' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Activity Log
                                        </button>
                                        {selectedApplicant.employeeId && (
                                            <button
                                                onClick={() => setModalActiveTab('Onboarding')}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${modalActiveTab === 'Onboarding' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                Onboarding Profile
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            const resumeLink = selectedApplicant.resumeFileUrl || (selectedApplicant.resume && typeof selectedApplicant.resume === 'object' ? selectedApplicant.resume.url : selectedApplicant.resume);
                                            downloadResume(resumeLink);
                                        }}
                                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm flex items-center gap-2"
                                    >
                                        <Download size={16} /> Download Resume
                                    </button>
                                    {canSendDocuments(selectedApplicant) && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await api.post(`/applications/${selectedApplicant._id}/request-documents`);
                                                    if (res.data.success) {
                                                        showToast('success', 'Documents Requested', 'Candidate has been notified to complete their profile.');
                                                        loadApplicants(); // Refresh list
                                                    }
                                                } catch (err) {
                                                    showToast('error', 'Request Failed', err.response?.data?.message || 'Failed to request documents');
                                                }
                                            }}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2 shadow-sm transition"
                                        >
                                            <FileText size={16} /> Send Documents
                                        </button>
                                    )}
                                    {selectedApplicant.status === 'Profile Submitted' && (
                                        <>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const res = await api.post(`/applications/${selectedApplicant._id}/approve-profile`);
                                                        if (res.data.success) {
                                                            showToast('success', 'Profile Approved', 'Candidate profile and documents have been verified.');
                                                            loadApplicants();
                                                        }
                                                    } catch (err) {
                                                        showToast('error', 'Approval Failed', err.response?.data?.message || 'Failed to approve profile');
                                                    }
                                                }}
                                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm flex items-center gap-2 shadow-sm transition"
                                            >
                                                <CheckCircle size={16} /> Approve Profile
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const reason = window.prompt("Enter reason for requesting re-upload:");
                                                    if (reason === null) return;
                                                    try {
                                                        const res = await api.post(`/applications/${selectedApplicant._id}/request-reupload`, { reason });
                                                        if (res.data.success) {
                                                            showToast('success', 'Re-upload Requested', 'Candidate has been notified to re-upload documents.');
                                                            loadApplicants();
                                                        }
                                                    } catch (err) {
                                                        showToast('error', 'Request Failed', err.response?.data?.message || 'Failed to request re-upload');
                                                    }
                                                }}
                                                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium text-sm flex items-center gap-2 shadow-sm transition"
                                            >
                                                <AlertCircle size={16} /> Request Re-upload
                                            </button>
                                        </>
                                    )}
                                    {selectedApplicant.status === 'Document Verified' && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await api.post(`/applications/${selectedApplicant._id}/convert-to-employee`);
                                                    if (res.data.success) {
                                                        showToast('success', 'Candidate Hired!', 'Candidate successfully converted to Employee.');
                                                        loadApplicants();
                                                    }
                                                } catch (err) {
                                                    showToast('error', 'Conversion Failed', err.response?.data?.message || 'Failed to convert to employee');
                                                }
                                            }}
                                            className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:from-emerald-600 hover:to-teal-600 font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-200"
                                        >
                                            <UserCheck size={16} /> Convert to Employee
                                        </button>
                                    )}
                                    {(selectedApplicant.offerStatus === 'REQUESTED' || selectedApplicant.offerRevisionRequested) && (
                                        <button
                                            onClick={() => {
                                                setShowCandidateModal(false);
                                                openOfferModal(selectedApplicant);
                                            }}
                                            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 font-bold text-sm flex items-center gap-2 shadow-lg shadow-orange-200 animate-in fade-in slide-in-from-top-2 duration-300"
                                        >
                                            <Edit2 size={16} /> Edit & Re-issue Offer
                                        </button>
                                    )}
                                    {modalActiveTab === 'Onboarding' && selectedApplicant.onboardingInstanceId?._id && (
                                        <button
                                            onClick={() => handleApproveOnboarding(selectedApplicant.onboardingInstanceId._id)}
                                            disabled={loading}
                                            className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:from-emerald-600 hover:to-teal-600 font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-200"
                                        >
                                            {loading ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />} 
                                            Approve & Activate
                                        </button>
                                    )}
                                    <button
                                        onClick={closeCandidateModalHelper}
                                        className="p-2.5 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition text-slate-500 border border-slate-200"
                                        title="Close profile"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50">
                                {/* Sidebar: Candidate Details (Common to both tabs for context) */}
                                <div className="w-full lg:w-[420px] xl:w-[460px] bg-white border-r border-slate-200 overflow-y-auto p-5 sm:p-7 space-y-6 shrink-0">
                                    {/* Link to Employee Panel if onboarding started */}
                                    {selectedApplicant.employeeId && (
                                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mb-4">
                                            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-1">
                                                <UserCheck size={18} />
                                                Onboarding Record Active
                                            </div>
                                            <p className="text-[10px] text-emerald-600 leading-tight">
                                                Candidate has started the onboarding process. View the profile tab for submitted data.
                                            </p>
                                        </div>
                                    )}
                                    <section>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Personal Information</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm"><FileText size={16} /></div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Father's Name</p>
                                                    <p className="mt-0.5 break-words text-sm font-semibold text-slate-800">{selectedApplicant.fatherName || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm"><Mail size={16} /></div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Email Address</p>
                                                    <p className="mt-0.5 break-all text-sm font-semibold text-slate-800">{selectedApplicant.email || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm"><Phone size={16} /></div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Phone / Mobile</p>
                                                    <p className="mt-0.5 break-words text-sm font-semibold text-slate-800">{selectedApplicant.mobile || selectedApplicant.phone || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm"><Calendar size={16} /></div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Date of Birth</p>
                                                    <p className="mt-0.5 break-words text-sm font-semibold text-slate-800">
                                                        {selectedApplicant.dob ? dayjs(selectedApplicant.dob).format('DD MMM YYYY') : '-'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm"><MapPin size={16} /></div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Address</p>
                                                    <p className="mt-0.5 break-words text-sm font-semibold leading-relaxed text-slate-800">{selectedApplicant.address || '-'}</p>
                                                </div>
                                            </div>
                                            {selectedApplicant.referral?.referrerName && (
                                                <div className="mt-4 flex items-start gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-left duration-500">
                                                    <div className="mt-0.5 text-emerald-600"><Users size={16} /></div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Referral Source</p>
                                                        <p className="text-sm font-black text-slate-800">
                                                            {selectedApplicant.referral.referrerName}
                                                            <span className="ml-2 px-1.5 py-0.5 bg-white rounded text-[9px] text-emerald-500 border border-emerald-100">
                                                                Code: {selectedApplicant.referral.usedCode}
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    <div className="border-t border-slate-100 my-2"></div>

                                    <section>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Professional Details</h3>
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm"><Briefcase size={16} /></div>
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Experience</p>
                                                    <p className="mt-0.5 text-sm font-semibold text-slate-800">{formatExperienceValue(selectedApplicant.experience)}</p>
                                                </div>
                                                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm"><Clock size={16} /></div>
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notice Period</p>
                                                    <p className="mt-0.5 text-sm font-semibold text-slate-800">{formatNoticePeriodValue(selectedApplicant.noticePeriod)}</p>
                                                </div>
                                            </div>

                                            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm"><Building2 size={16} /></div>
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Current Company</p>
                                                <p className="mt-0.5 break-words text-sm font-semibold text-slate-800">{selectedApplicant.currentCompany || '-'}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm"><Shield size={16} /></div>
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Designation</p>
                                                <p className="mt-0.5 break-words text-sm font-semibold text-slate-800">{selectedApplicant.currentDesignation || selectedApplicant.designation || '-'}</p>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Current CTC</p>
                                                    <p className="mt-0.5 break-words text-sm font-semibold text-slate-800">{selectedApplicant.currentCTC || '-'}</p>
                                                </div>
                                                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 relative">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600/70">Expected CTC</p>
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-0.5">
                                                        <p className="break-words text-sm font-semibold text-emerald-700">{selectedApplicant.expectedCTC || '-'}</p>
                                                        {selectedApplicant.isOverBudget && (
                                                            <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20 whitespace-nowrap">
                                                                Over Budget / Negotiate
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Offer & Onboarding Details */}
                                            {(selectedApplicant.joiningDate || selectedApplicant.location || selectedApplicant.workLocation || selectedApplicant.salarySnapshot?.ctcYearly) && (
                                                <div className="border-t border-slate-100 mt-4 pt-4">
                                                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Offer & Onboarding</h4>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {selectedApplicant.salarySnapshot?.ctcYearly && (
                                                            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Offered CTC</p>
                                                                <p className="mt-0.5 break-words text-sm font-black text-blue-700">₹ {selectedApplicant.salarySnapshot.ctcYearly.toLocaleString()}</p>
                                                            </div>
                                                        )}
                                                        {selectedApplicant.joiningDate && (
                                                            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Date of Joining</p>
                                                                <p className="mt-0.5 break-words text-sm font-black text-blue-700">{dayjs(selectedApplicant.joiningDate).format('DD MMM YYYY')}</p>
                                                            </div>
                                                        )}
                                                        {(selectedApplicant.location || selectedApplicant.workLocation) && (
                                                            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 sm:col-span-2">
                                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Work Location</p>
                                                                <p className="mt-0.5 break-words text-sm font-black text-blue-700">{selectedApplicant.location || selectedApplicant.workLocation}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {selectedApplicant.linkedin && (
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">LinkedIn Profile</p>
                                                    <a href={selectedApplicant.linkedin} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate block">
                                                        {selectedApplicant.linkedin}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    {selectedApplicant.intro && (
                                        <>
                                            <div className="border-t border-slate-100 my-2"></div>
                                            <section>
                                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Introduction / Notes</h3>
                                                <p className="text-sm text-slate-600 italic leading-relaxed bg-slate-50 p-3 rounded">
                                                    "{selectedApplicant.intro}"
                                                </p>
                                            </section>
                                        </>
                                    )}

                                    {getApplicantCustomEntries(selectedApplicant, 30).length > 0 && (
                                        <>
                                            <div className="border-t border-slate-100 my-2"></div>
                                            <section>
                                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Application Form Details</h3>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {getApplicantCustomEntries(selectedApplicant, 30).map((field) => (
                                                        <div key={field.key} className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                                                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">{field.label}</p>
                                                            {field.rawValue?.filePath ? (
                                                                <a
                                                                    href={`${API_ROOT.replace(/\/api$/, '')}${field.rawValue.filePath}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-sm font-bold text-blue-700 hover:underline break-all"
                                                                >
                                                                    {field.value}
                                                                </a>
                                                            ) : (
                                                                <p className="text-sm font-semibold text-slate-800 break-words">{field.value}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        </>
                                    )}

                                    {/* AI Insights Section */}
                                    {(selectedApplicant.matchScore > 0 || selectedApplicant.aiParsedData) && (
                                        <>
                                            <div className="border-t border-slate-100 my-2"></div>
                                            <section>
                                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                    <span className="text-purple-600">✨</span> AI Insights
                                                </h3>
                                                <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xs font-bold text-purple-700">Match Score</span>
                                                        <span className="text-sm font-black text-purple-600">{selectedApplicant.matchPercentage}%</span>
                                                    </div>
                                                    {/* Skills */}
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {selectedApplicant.parsedSkills?.map((skill, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-white text-purple-600 text-[10px] font-bold rounded border border-purple-100">
                                                                {skill}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {/* Summary */}
                                                    {selectedApplicant.aiParsedData.experienceSummary && (
                                                        <p className="text-xs text-purple-800 leading-relaxed">
                                                            {selectedApplicant.aiParsedData.experienceSummary}
                                                        </p>
                                                    )}
                                                </div>
                                            </section>
                                        </>
                                    )}

                                </div>

                                {/* Main Area: Resume Preview OR Onboarding Profile OR Activity */}
                                {modalActiveTab === 'Resume' && (
                                    <div className="flex-1 bg-slate-100 flex items-center justify-center p-4">
                                        {resumePreviewUrl ? (
                                            <iframe
                                                src={resumePreviewUrl}
                                                className="w-full h-full rounded-lg shadow-input bg-white"
                                                title="Resume Preview"
                                            />
                                        ) : (selectedApplicant.resume || selectedApplicant.resumeFileUrl) ? (
                                            <div className="text-center p-8 bg-white rounded-xl shadow-sm max-w-md">
                                                <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                                                <p className="text-lg font-medium text-slate-800 mb-2">Preview not available</p>
                                                <p className="text-slate-500 mb-6">This file type cannot be previewed directly in the browser or is still loading.</p>
                                                <button
                                                    onClick={() => downloadResume(selectedApplicant.resume || selectedApplicant.resumeFileUrl)}
                                                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                                                >
                                                    <Download size={18} /> Download File
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center text-slate-400">
                                                <p className="font-bold uppercase tracking-widest text-[10px]">No resume uploaded</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {modalActiveTab === 'Activity' && (
                                    <div className="flex-1 bg-slate-50/50 p-6 overflow-y-auto">
                                        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
                                                <Activity size={18} className="text-blue-600"/>
                                                Timeline & Activity
                                            </h3>
                                            {!selectedApplicant.timeline || selectedApplicant.timeline.length === 0 ? (
                                                <div className="text-center py-12 text-slate-400">
                                                    <Clock size={40} className="mx-auto mb-3 opacity-20" />
                                                    <p className="font-bold uppercase tracking-widest text-[10px]">No timeline available</p>
                                                </div>
                                            ) : (
                                                <div className="relative pl-6 border-l-2 border-slate-100 space-y-8">
                                                    {[...selectedApplicant.timeline].reverse().map((t, i) => (
                                                        <div key={i} className="relative group">
                                                            <div className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full border-4 border-white bg-blue-500 shadow-sm group-hover:scale-110 transition-transform" />
                                                            <div className="bg-slate-50 hover:bg-slate-100/50 p-5 rounded-xl border border-slate-100 transition-colors">
                                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                                                                    <div className="font-black text-sm text-slate-800 uppercase tracking-tight">{t.status}</div>
                                                                    <div className="text-[10px] font-bold text-slate-500 uppercase bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 flex items-center gap-1.5">
                                                                        <Clock size={12} className="text-blue-500" />
                                                                        {dayjs(t.timestamp).format('MMM DD YYYY, HH:mm')}
                                                                    </div>
                                                                </div>
                                                                <p className="text-xs text-slate-600 mb-4 bg-white p-3 rounded-lg border border-slate-100 leading-relaxed">{t.message}</p>
                                                                {t.remarks && (
                                                                    <p className="text-xs text-slate-600 mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-100 leading-relaxed">
                                                                        <span className="font-bold">Remarks:</span> {t.remarks}
                                                                    </p>
                                                                )}
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-5 w-5 rounded-md bg-slate-200 flex items-center justify-center text-[9px] font-black text-slate-500">
                                                                        {(t.updatedBy || 'S').charAt(0)}
                                                                    </div>
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">By: <span className="text-slate-700">{t.updatedBy || 'System'}</span></p>
                                                                    {t.email && (
                                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-4">Email: <span className="text-slate-700">{t.email}</span></p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {(modalActiveTab === 'Details' || modalActiveTab === 'Onboarding') && (
                                    <div className="flex-1 bg-slate-50/50 p-6 overflow-y-auto">
                                        {(() => {
                                            const emp = selectedApplicant.employeeId;
                                            if (!emp) return (
                                                <div className="h-full flex items-center justify-center text-slate-400">
                                                    <div className="text-center">
                                                        <UserX size={48} className="mx-auto mb-4 opacity-20" />
                                                        <p className="font-bold">No Onboarding Data Found</p>
                                                        <p className="text-xs">The candidate has not started the onboarding profile yet.</p>
                                                    </div>
                                                </div>
                                            );

                                            const Section = ({ title, icon: Icon, children }) => (
                                                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
                                                    <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                                            <Icon size={20} />
                                                        </div>
                                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{title}</h3>
                                                    </div>
                                                    {children}
                                                </div>
                                            );

                                            const InfoRow = ({ label, value, icon: Icon }) => (
                                                <div className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                                                    {Icon && <Icon size={16} className="text-slate-400 mt-0.5 shrink-0" />}
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                                                        <p className="text-sm font-semibold text-slate-700">{value || '-'}</p>
                                                    </div>
                                                </div>
                                            );

                                            return (
                                                <div className="max-w-5xl mx-auto pb-12">
                                                    {/* Personal Details */}
                                                    <Section title="Personal Info" icon={UserPlus}>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                            <InfoRow label="Full Name" value={`${emp.firstName || ''} ${emp.middleName || ''} ${emp.lastName || ''}`} icon={UserCheck} />
                                                            <InfoRow label="Gender" value={emp.gender} />
                                                            <InfoRow label="DOB" value={emp.dob ? dayjs(emp.dob).format('DD MMM YYYY') : '-'} icon={Calendar} />
                                                            <InfoRow label="Blood Group" value={emp.bloodGroup} />
                                                            <InfoRow label="Marital Status" value={emp.maritalStatus} />
                                                            <InfoRow label="Nationality" value={emp.nationality} />
                                                            <InfoRow label="Father's Name" value={emp.fatherName} icon={Users} />
                                                            <InfoRow label="Mother's Name" value={emp.motherName} icon={Users} />
                                                        </div>
                                                    </Section>

                                                    {/* Addresses */}
                                                    <Section title="Addresses" icon={Layout}>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                            <div className="space-y-4">
                                                                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Permanent</h4>
                                                                <div className="bg-slate-100/50 p-4 rounded-xl border border-dashed border-slate-200">
                                                                    <p className="text-sm text-slate-700 leading-relaxed italic">
                                                                        {emp.permAddress ? `${emp.permAddress.line1}, ${emp.permAddress.line2 || ''} ${emp.permAddress.city}, ${emp.permAddress.state}, ${emp.permAddress.pinCode}` : 'Not provided'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-4">
                                                                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Communication</h4>
                                                                <div className="bg-slate-100/50 p-4 rounded-xl border border-dashed border-slate-200">
                                                                    <p className="text-sm text-slate-700 leading-relaxed italic">
                                                                        {emp.commAddress ? `${emp.commAddress.line1}, ${emp.commAddress.line2 || ''} ${emp.commAddress.city}, ${emp.commAddress.state}, ${emp.commAddress.pinCode}` : 'Same as permanent'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Section>

                                                    {/* Bank Details */}
                                                    <Section title="Bank Account" icon={IndianRupee}>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                            <InfoRow label="Bank Name" value={emp.bankDetails?.bankName} />
                                                            <InfoRow label="Account Number" value={emp.bankDetails?.accountNumber} icon={Lock} />
                                                            <InfoRow label="IFSC Code" value={emp.bankDetails?.ifsc} />
                                                            <InfoRow label="Branch Name" value={emp.bankDetails?.branchName} />
                                                            {emp.bankDetails?.bankProofUrl && (
                                                                <div className="col-span-full pt-4">
                                                                    <a 
                                                                        href={`${API_ROOT}${emp.bankDetails.bankProofUrl}`} 
                                                                        target="_blank" 
                                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                                                                    >
                                                                        <Eye size={14} /> View Bank Proof
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Section>

                                                    {/* Education */}
                                                    <Section title="Education" icon={MessageSquare}>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {emp.education?.class10Marksheet && (
                                                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                                    <div className="flex items-center gap-3">
                                                                        <FileText className="text-blue-500" size={20} />
                                                                        <span className="text-sm font-bold text-slate-700">10th Marksheet</span>
                                                                    </div>
                                                                    <a href={`${API_ROOT}${emp.education.class10Marksheet}`} target="_blank" className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"><Eye size={18} /></a>
                                                                </div>
                                                            )}
                                                            {emp.education?.class12Marksheet && (
                                                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                                    <div className="flex items-center gap-3">
                                                                        <FileText className="text-blue-500" size={20} />
                                                                        <span className="text-sm font-bold text-slate-700">12th Marksheet</span>
                                                                    </div>
                                                                    <a href={`${API_ROOT}${emp.education.class12Marksheet}`} target="_blank" className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"><Eye size={18} /></a>
                                                                </div>
                                                            )}
                                                            {emp.education?.bachelorDegree && (
                                                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                                    <div className="flex items-center gap-3">
                                                                        <Zap className="text-purple-500" size={20} />
                                                                        <span className="text-sm font-bold text-slate-700">Bachelor's Degree</span>
                                                                    </div>
                                                                    <a href={`${API_ROOT}${emp.education.bachelorDegree}`} target="_blank" className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"><Eye size={18} /></a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Section>

                                                    {/* Experience */}
                                                    {emp.experience?.length > 0 && (
                                                        <Section title="Experience" icon={Briefcase}>
                                                            <div className="space-y-4">
                                                                {emp.experience.map((exp, idx) => (
                                                                    <div key={idx} className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm">
                                                                        <div className="flex justify-between items-start mb-3">
                                                                            <div>
                                                                                <h4 className="text-sm font-black text-slate-800">{exp.companyName}</h4>
                                                                                <p className="text-[10px] text-slate-400 font-bold uppercase">{dayjs(exp.from).format('MMM YYYY')} — {exp.to ? dayjs(exp.to).format('MMM YYYY') : 'Present'}</p>
                                                                            </div>
                                                                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black">₹{exp.lastDrawnSalary || '0'}/mo</span>
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            {exp.payslips?.map((slip, sIdx) => (
                                                                                <a key={sIdx} href={`${API_ROOT}${slip}`} target="_blank" className="text-[10px] font-bold text-blue-600 hover:underline">Payslip {sIdx + 1}</a>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </Section>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Premium Candidate Evaluation Drawer */}
            {
                showEvaluationDrawer && selectedApplicant && (
                    <div className="fixed inset-0 z-[100] flex justify-end">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setShowEvaluationDrawer(false)}
                        />

                        {/* Drawer Content */}
                        <div className="relative w-full max-w-2xl bg-white h-screen shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 ease-out overflow-hidden">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                                <div>
                                    <h1 className="text-xl font-black text-slate-800 tracking-tight">Candidate Evaluation</h1>
                                    <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest flex items-center gap-2">
                                        <span className="text-blue-600 font-black">{selectedApplicant.name}</span>
                                        <span className="opacity-20 italic">|</span>
                                        <span>{selectedApplicant.requirementId?.jobTitle}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowEvaluationDrawer(false);
                                        setIsFinishingInterview(false);
                                    }}
                                    className="p-2 hover:bg-slate-50 rounded-full transition-colors"
                                >
                                    <X size={24} className="text-slate-400" />
                                </button>
                            </div>

                            {/* Middle Area (Scrollable) */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">

                                {/* Round Navigation Tabs */}
                                <div className="flex gap-2 p-1 bg-slate-50 rounded-xl">
                                    {evaluationData.rounds.map((round, idx) => (
                                        <button
                                            key={round.id}
                                            onClick={() => setEvalActiveRound(idx)}
                                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all
                                            ${evalActiveRound === idx
                                                    ? 'bg-white text-blue-600 shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {round.name}
                                        </button>
                                    ))}
                                </div>

                                {/* Active Evaluation Criteria */}
                                <div className="space-y-6">
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">0{evalActiveRound + 1}</span>
                                        {evaluationData.rounds[evalActiveRound].name}
                                    </h3>

                                    {evaluationData.rounds[evalActiveRound].categories.map((cat, catIdx) => (
                                        <div key={catIdx} className="space-y-4">
                                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{cat.name}</h4>
                                            <div className="space-y-2">
                                                {cat.skills.map((skill, skillIdx) => (
                                                    <div key={skillIdx} className="grid grid-cols-12 gap-4 items-center p-4 bg-slate-50/50 border border-slate-100/50 rounded-2xl group hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all duration-300">
                                                        <div className="col-span-12 md:col-span-5">
                                                            <p className="text-xs font-black text-slate-700">{skill.name}</p>
                                                        </div>
                                                        <div className="col-span-12 md:col-span-3 flex gap-2">
                                                            {[1, 2, 3, 4, 5].map(num => (
                                                                <button
                                                                    key={num}
                                                                    onClick={() => {
                                                                        const newData = { ...evaluationData };
                                                                        newData.rounds[evalActiveRound].categories[catIdx].skills[skillIdx].rating = num;
                                                                        setEvaluationData(newData);
                                                                        const allRatings = evaluationData.rounds.flatMap(r => r.categories.flatMap(c => c.skills.map(s => s.rating))).filter(r => r > 0);
                                                                        if (allRatings.length > 0) {
                                                                            const avg = Math.round(allRatings.reduce((a, b) => a + b, 0) / allRatings.length);
                                                                            setReviewRating(avg);
                                                                        }
                                                                    }}
                                                                    className={`w-8 h-8 rounded-full text-[11px] font-black transition-all flex items-center justify-center
                                                                    ${skill.rating === num
                                                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110'
                                                                            : 'bg-white text-slate-400 border border-slate-200 hover:border-blue-400 font-bold'}`}
                                                                >
                                                                    {num}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div className="col-span-12 md:col-span-4">
                                                            <input
                                                                type="text"
                                                                placeholder="Short Note..."
                                                                value={skill.comment}
                                                                onChange={(e) => {
                                                                    const newData = { ...evaluationData };
                                                                    newData.rounds[evalActiveRound].categories[catIdx].skills[skillIdx].comment = e.target.value;
                                                                    setEvaluationData(newData);
                                                                    // Sync with main feedback
                                                                    setReviewFeedback(e.target.value);
                                                                }}
                                                                className="w-full text-[10px] p-2 bg-white border border-slate-100 rounded-lg outline-none focus:border-blue-500 transition-colors"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Footer - Bottom Action Bar */}
                            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-6 flex items-center justify-between shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                                <div className="flex items-center gap-6">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[2px] mb-1">Total Score</p>
                                        <div className="text-2xl font-black text-slate-800">
                                            {(evaluationData.rounds.flatMap(r => r.categories.flatMap(c => c.skills.map(s => s.rating))).filter(r => r > 0).reduce((a, b, _, arr) => a + b / arr.length, 0) || 0).toFixed(2)}
                                            <span className="text-xs text-slate-300"> / 5</span>
                                        </div>
                                    </div>
                                    <div className="w-px h-10 bg-slate-100"></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[2px] mb-1">Decision</p>
                                        <Select
                                            className="w-40 premium-select"
                                            placeholder="Pick Step"
                                            value={selectedStatusForReview || null}
                                            variant="borderless"
                                            style={{ background: '#f8fafc', borderRadius: '12px', padding: '0 8px', border: '1px solid #f1f5f9' }}
                                            onChange={(val) => setSelectedStatusForReview(val)}
                                        >
                                            <Select.OptGroup label="Hiring Pipeline">
                                                {workflowTabs.filter(t => !['Applied', 'Finalized'].includes(t)).map(tab => (
                                                    <Select.Option key={tab} value={tab}>{tab}</Select.Option>
                                                ))}
                                            </Select.OptGroup>
                                            <Select.OptGroup label="Final Result">
                                                <Select.Option value="Selected" className="text-emerald-600 font-bold">Selected / Hire</Select.Option>
                                                <Select.Option value="Rejected" className="text-red-500 font-bold">Reject</Select.Option>
                                            </Select.OptGroup>
                                        </Select>
                                    </div>
                                </div>

                                <button
                                    onClick={submitReviewAndStatus}
                                    disabled={loading || !selectedStatusForReview}
                                    className="px-8 py-3 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                                >
                                    {loading ? 'Processing...' : 'Complete Evaluation'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Document Upload Modal */}
            {
                showDocumentModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Upload Documents</h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {documentApplicant?.name} - {documentApplicant?.requirementId?.title}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowDocumentModal(false)}
                                    className="p-2 hover:bg-white rounded-lg transition-colors"
                                >
                                    <XCircle size={20} className="text-slate-400" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Add New Document */}
                                <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Add New Document</h4>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-2">Document Name *</label>
                                        <input
                                            type="text"
                                            value={documentName}
                                            onChange={(e) => setDocumentName(e.target.value)}
                                            placeholder="e.g., Aadhar Card, PAN Card, Degree Certificate"
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-2">Select File * (PDF, JPG, PNG - Max 5MB)</label>
                                        <input
                                            id="documentFileInput"
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={handleDocumentFileChange}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                        {documentFile && (
                                            <p className="mt-2 text-xs text-slate-500">
                                                Selected: {documentFile.name} ({(documentFile.size / 1024).toFixed(1)} KB)
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={addDocumentToList}
                                        className="w-full py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        + Add to List
                                    </button>
                                </div>

                                {/* Uploaded Documents List */}
                                {uploadedDocuments.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                                            Documents to Upload ({uploadedDocuments.length})
                                        </h4>
                                        <div className="space-y-2">
                                            {uploadedDocuments.map((doc, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                                                    <div className="flex-1">
                                                        <div className="text-sm font-bold text-slate-800">{doc.name}</div>
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            {doc.fileName} · {(doc.fileSize / 1024).toFixed(1)} KB
                                                            {doc.verified && <span className="ml-2 text-emerald-600">✓ Verified</span>}
                                                        </div>
                                                    </div>
                                                    {!doc.verified && (
                                                        <button
                                                            onClick={() => removeDocumentFromList(idx)}
                                                            className="ml-3 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                                <button
                                    onClick={() => setShowDocumentModal(false)}
                                    className="flex-1 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveDocuments}
                                    disabled={uploadedDocuments.length === 0}
                                    className={`flex-1 py-2 font-bold rounded-lg transition-colors ${uploadedDocuments.length > 0
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    Save Documents ({uploadedDocuments.length})
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* FINALIZE CANDIDATE CONFIRMATION MODAL */}
            {
                finalizeModalVisible && candidateToFinalize && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                        <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden transform animate-in zoom-in-95 duration-300 border border-slate-100">
                            <div className="p-8 text-center text-slate-900">
                                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse">
                                    <ShieldCheck size={40} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-2xl font-black mb-2">Finalize Candidate?</h2>
                                <p className="text-slate-500 font-medium">
                                    Are you sure you want to finalize <span className="text-slate-900 font-bold">{candidateToFinalize.name}</span>?
                                    They will move to the terminal recruitment stage and you can begin generating their documents.
                                </p>
                            </div>

                            <div className="px-8 pb-8 flex flex-col gap-3">
                                <button
                                    onClick={async () => {
                                        setStatusUpdating(true);
                                        const success = await updateStatus(candidateToFinalize, 'Finalized');
                                        if (success) {
                                            setFinalizeModalVisible(false);
                                            setCandidateToFinalize(null);
                                        }
                                        setStatusUpdating(false);
                                    }}
                                    disabled={statusUpdating}
                                    className="w-full py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                                >
                                    {statusUpdating ? (
                                        <RefreshCw className="animate-spin" size={18} />
                                    ) : (
                                        <>
                                            <span>FINALIZE CANDIDATE</span>
                                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setFinalizeModalVisible(false)}
                                    disabled={statusUpdating}
                                    className="w-full py-4 bg-slate-50 text-slate-500 font-bold rounded-xl hover:bg-slate-100 transition-colors"
                                >
                                    Not Now, Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Rule 5: Add Interview Round Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-black">
                        <PlusCircle className="text-blue-600" size={20} />
                        <span>ADD INTERVIEW ROUND</span>
                    </div>
                }
                open={addRoundModalVisible}
                onCancel={() => {
                    setAddRoundModalVisible(false);
                    setNewRoundName('');
                }}
                footer={null}
                centered
                width={400}
                className="premium-modal"
            >
                <div className="space-y-4 py-4">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
                        <Info className="text-blue-500 shrink-0" size={20} />
                        <p className="text-xs text-blue-700 font-medium leading-relaxed">
                            This will add a new interview stage placeholder (e.g., "Technical Assessment") to the hiring workflow for this candidate.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Round Name</label>
                        <input
                            type="text"
                            value={newRoundName}
                            onChange={(e) => setNewRoundName(e.target.value)}
                            placeholder="e.g. Technical Round 2"
                            className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => setAddRoundModalVisible(false)}
                            className="flex-1 h-12 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                if (!newRoundName.trim()) return;
                                updateStatus(candidateForNewRound, `Round: ${newRoundName}`);
                                setAddRoundModalVisible(false);
                                setNewRoundName('');
                                notification.success({ message: 'Success', description: 'New round added to pipeline', placement: 'topRight' });
                            }}
                            disabled={!newRoundName.trim()}
                            className="flex-1 h-12 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50"
                        >
                            Add Round
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Custom Other Round Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-black">
                        <PlusCircle className="text-amber-600" size={20} />
                        <span>ADD OTHER ROUND</span>
                    </div>
                }
                open={addCustomRoundModalVisible}
                onCancel={() => {
                    setAddCustomRoundModalVisible(false);
                    setCustomRoundName('');
                    setCustomRoundDescription('');
                    setCustomRoundType('Game');
                    setGameRoundConfig({ gameName: '', duration: 30, difficulty: 'Medium', gameType: 'Coding' });
                }}
                footer={null}
                centered
                width={500}
                className="premium-modal"
            >
                <div className="space-y-5 py-4">
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3">
                        <Info className="text-amber-500 shrink-0" size={20} />
                        <p className="text-xs text-amber-700 font-medium leading-relaxed">
                            Add a custom round like Game-based Assessment, Coding Challenge, or Custom Task for this candidate before finalization.
                        </p>
                    </div>

                    {/* Round Name */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Round Name</label>
                        <input
                            type="text"
                            value={customRoundName}
                            onChange={(e) => setCustomRoundName(e.target.value)}
                            placeholder="e.g. Game-Based Assessment"
                            className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all font-bold text-slate-700"
                        />
                    </div>

                    {/* Round Type Selection */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Round Type</label>
                        <select
                            value={customRoundType}
                            onChange={(e) => setCustomRoundType(e.target.value)}
                            className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all font-bold text-slate-700"
                        >
                            <option value="Game">🎮 Game-Based Assessment</option>
                            <option value="Coding">💻 Coding Challenge</option>
                            <option value="Task">📋 Task/Project</option>
                            <option value="Assessment">✍️ Assessment</option>
                            <option value="Custom">⚙️ Custom Round</option>
                        </select>
                    </div>

                    {/* Round Description */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Description</label>
                        <textarea
                            value={customRoundDescription}
                            onChange={(e) => setCustomRoundDescription(e.target.value)}
                            placeholder="Brief description of this round..."
                            className="w-full h-24 p-4 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all font-medium text-slate-700 resize-none"
                        />
                    </div>

                    {/* Game Round Config (if Game type selected) */}
                    {customRoundType === 'Game' && (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 space-y-3">
                            <h4 className="text-sm font-black text-slate-700 flex items-center gap-2">
                                <span className="text-blue-600">ðŸŽ®</span> Game Configuration
                            </h4>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Game Name</label>
                                <input
                                    type="text"
                                    value={gameRoundConfig.gameName}
                                    onChange={(e) => setGameRoundConfig({ ...gameRoundConfig, gameName: e.target.value })}
                                    placeholder="e.g. Logic Puzzle Pro"
                                    className="w-full h-10 px-3 bg-white border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Duration (mins)</label>
                                    <input
                                        type="number"
                                        value={gameRoundConfig.duration}
                                        onChange={(e) => setGameRoundConfig({ ...gameRoundConfig, duration: parseInt(e.target.value) || 30 })}
                                        min="5"
                                        max="180"
                                        className="w-full h-10 px-3 bg-white border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 text-sm"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Difficulty</label>
                                    <select
                                        value={gameRoundConfig.difficulty}
                                        onChange={(e) => setGameRoundConfig({ ...gameRoundConfig, difficulty: e.target.value })}
                                        className="w-full h-10 px-3 bg-white border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 text-sm"
                                    >
                                        <option value="Easy">Easy</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Hard">Hard</option>
                                        <option value="Expert">Expert</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Game Type</label>
                                <select
                                    value={gameRoundConfig.gameType}
                                    onChange={(e) => setGameRoundConfig({ ...gameRoundConfig, gameType: e.target.value })}
                                    className="w-full h-10 px-3 bg-white border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 text-sm"
                                >
                                    <option value="Coding">Coding</option>
                                    <option value="Puzzle">Puzzle</option>
                                    <option value="Logic">Logic</option>
                                    <option value="Strategy">Strategy</option>
                                    <option value="Trivia">Trivia</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => {
                                setAddCustomRoundModalVisible(false);
                                setCustomRoundName('');
                                setCustomRoundDescription('');
                                setCustomRoundType('Game');
                                setGameRoundConfig({ gameName: '', duration: 30, difficulty: 'Medium', gameType: 'Coding' });
                            }}
                            className="flex-1 h-12 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                if (!customRoundName.trim()) {
                                    notification.error({ message: 'Error', description: 'Please enter round name', placement: 'topRight' });
                                    return;
                                }

                                const roundDetails = customRoundType === 'Game'
                                    ? `${customRoundName} (Game: ${gameRoundConfig.gameName || 'TBD'}, ${gameRoundConfig.duration}min, ${gameRoundConfig.difficulty})`
                                    : `${customRoundName} (${customRoundType})`;

                                updateStatus(candidateForNewRound, roundDetails);
                                setAddCustomRoundModalVisible(false);
                                setCustomRoundName('');
                                setCustomRoundDescription('');
                                setCustomRoundType('Game');
                                setGameRoundConfig({ gameName: '', duration: 30, difficulty: 'Medium', gameType: 'Coding' });
                                showToast('success', 'Success', `${customRoundType} round added to pipeline`);
                            }}
                            disabled={!customRoundName.trim()}
                            className="flex-1 h-12 bg-amber-600 text-white font-black rounded-xl shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all disabled:opacity-50"
                        >
                            Add {customRoundType} Round
                        </button>
                    </div>
                </div>
            </Modal>
            {/* Resume Preview Modal */}
            <Modal
                title="Resume Preview"
                open={isResumeModalOpen}
                onCancel={() => {
                    setIsResumeModalOpen(false);
                    setResumeUrl(null);
                }}
                footer={null}
                width={1000}
                centered
                styles={{ body: { height: '80vh', padding: 0 } }}
            >
                {resumeUrl && (
                    <iframe
                        src={resumeUrl}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="Resume PDF"
                    />
                )}
            </Modal>

            {/* BGV Initiation Modal (Package-Driven) */}
            {
                showBGVModal && bgvCandidate && (
                    <JobBasedBGVModal
                        applicant={bgvCandidate}
                        jobTitle={bgvCandidate.requirementId?.jobTitle || 'N/A'}
                        onClose={() => {
                            setShowBGVModal(false);
                            setBgvCandidate(null);
                        }}
                        onSuccess={handleBGVSuccess}
                    />
                )
            }

            {/* Package-Driven Pipeline Manager */}
            <PipelineManagerModal
                visible={showPipelineManager}
                onClose={() => setShowPipelineManager(false)}
                requirement={selectedRequirement}
                onUpdate={handlePipelineUpdate}
            />

            {/* Stage Feedback Modal (Intercept-based) */}
            <StageFeedbackModal
                visible={showStageFeedbackModal}
                onClose={() => setShowStageFeedbackModal(false)}
                applicant={feedbackCandidate}
                stage={feedbackStageConfig}
                onSuccess={(evalData) => {
                    updateStatus(feedbackCandidate, feedbackTargetStage, evalData);
                }}
            />

            {/* Smart Interview Scheduler */}
            <InterviewScheduleModal
                visible={showInterviewModal}
                onCancel={() => setShowInterviewModal(false)}
                onSubmit={handleInterviewSubmit}
                initialData={interviewData}
                isReschedule={isReschedule}
                loading={loading}
                companyHolidays={companyHolidays}
                pipelineStages={selectedRequirement?.pipelineStages || []}
            />
            </div>
        </>
    );
}

