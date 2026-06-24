import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../utils/api';
import {
    Briefcase,
    Users,
    User,
    Clock,
    MapPin,
    Shield,
    Eye,
    EyeOff,
    Plus,
    Trash2,
    Check,
    ArrowRight,
    ArrowLeft,
    Building2,
    Calendar,
    ChevronRight,
    ChevronDown,
    Search,
    Type,
    Layers,
    X,
    Zap,
    AlertTriangle,
    Settings,
    Globe,
    Lock,
    Unlock,
    Target,
    FileText,
    GripVertical,
    Maximize2,
    Minimize2
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import StageModal from './StageModal';
import FeedbackTemplateBuilder from './FeedbackTemplateBuilder';
import CustomSelect from './shared/CustomSelect';
import toast from 'react-hot-toast';
import { DEPARTMENT_OPTIONS, getDesignationsForDepartment, ALL_DESIGNATION_OPTIONS } from '../constants/departmentDesignationMaster';
import { COUNTRY_OPTIONS, getCitiesForState, getStatesForCountry } from '../constants/locationMaster';

const COMMON_SKILLS = [
    'JavaScript', 'React', 'Node.js', 'Python', 'SQL', 'NoSQL', 'Project Management',
    'Communication', 'Teamwork', 'Problem Solving', 'Leadership', 'Agile', 'Docker'
];

const POSITION_FIELD_CONFIG_KEY = 'hrms:req:positionFieldConfig:v1';
const STEP2_FIELD_CONFIG_KEY = 'hrms:req:step2FieldConfig:v1';
const PIPELINE_FIELD_CONFIG_KEY = 'hrms:req:pipelineFieldConfig:v1';
const REQUIREMENT_PROGRESS_STORAGE_KEY = 'hrms:req:createProgress:v1';
const DEFAULT_POSITION_FIELD_CONFIG = {
    jobTitle: { label: 'Designation', placeholder: 'Select designation', required: true, visible: true },
    department: { label: 'Department', placeholder: 'Assign to unit', required: true, visible: true },
    status: { label: 'Status', placeholder: '', required: false, visible: false },
    hiringStatus: { label: 'Hiring', placeholder: '', required: false, visible: false },
    isReplacement: { label: 'Reason for Hire', placeholder: '', required: false, visible: true },
    budgetedCount: { label: 'Headcount', placeholder: '1', required: true, visible: true },
    baseSalaryMin: { label: 'Min Base', placeholder: '0', required: false, visible: true },
    baseSalaryMax: { label: 'Max Base', placeholder: '0', required: false, visible: true },
};

const CUSTOM_DEPARTMENT_VALUE = '__custom_department__';
const CUSTOM_DESIGNATION_VALUE = '__custom_designation__';

const DEFAULT_PIPELINE_WORKFLOW = [
    { id: 'stage_applied', stageName: 'Applied', stageType: 'System', isSystemStage: true, locked: true },
    { id: 'stage_screening', stageName: 'Screening / Sourcing', stageType: 'Screening', mode: 'Online', durationMinutes: 15 },
    { id: 'stage_tech_1', stageName: 'Technical Interview', stageType: 'Interview', mode: 'Online', durationMinutes: 45 },
    { id: 'stage_hr', stageName: 'Final HR Round', stageType: 'Interview', mode: 'In-person', durationMinutes: 30 },
    { id: 'stage_finalized', stageName: 'Finalized', stageType: 'System', isSystemStage: true, locked: true },
];

const DEFAULT_EDITABLE_PIPELINE_STAGES = DEFAULT_PIPELINE_WORKFLOW.slice(1, -1);

const normalizePipelineStageName = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();

const isMatchingDefaultStage = (stage, defaultStage) => {
    const stageId = String(stage?.stageId || stage?.id || '');
    const defaultId = String(defaultStage.id || '');
    const stageName = normalizePipelineStageName(stage?.stageName);
    const defaultName = normalizePipelineStageName(defaultStage.stageName);

    if (stageId && defaultId && stageId === defaultId) return true;
    if (stageName === defaultName) return true;
    if (defaultName.includes('screening') && (stageName.includes('screening') || stageName.includes('sourcing'))) return true;
    if (defaultName.includes('technical') && stageName.includes('technical')) return true;
    if (defaultName.includes('final') && stageName.includes('final')) return true;
    return false;
};

const ensureDefaultPipelineWorkflow = (stages = []) => {
    const source = Array.isArray(stages) && stages.length > 0 ? stages : DEFAULT_PIPELINE_WORKFLOW;
    const firstStage = source[0] || DEFAULT_PIPELINE_WORKFLOW[0];
    const lastStage = source[source.length - 1] || DEFAULT_PIPELINE_WORKFLOW[DEFAULT_PIPELINE_WORKFLOW.length - 1];
    const editableStages = source.slice(1, -1);
    const usedStageIndexes = new Set();

    const defaultMiddleStages = DEFAULT_EDITABLE_PIPELINE_STAGES.map((defaultStage) => {
        const foundIndex = editableStages.findIndex((stage, idx) => (
            !usedStageIndexes.has(idx) && isMatchingDefaultStage(stage, defaultStage)
        ));

        if (foundIndex >= 0) {
            usedStageIndexes.add(foundIndex);
            return { ...defaultStage, ...editableStages[foundIndex] };
        }

        return { ...defaultStage };
    });

    const extraStages = editableStages.filter((_, idx) => !usedStageIndexes.has(idx));

    return [
        { ...DEFAULT_PIPELINE_WORKFLOW[0], ...firstStage, isSystemStage: true, locked: firstStage.locked !== false },
        ...defaultMiddleStages,
        ...extraStages,
        { ...DEFAULT_PIPELINE_WORKFLOW[DEFAULT_PIPELINE_WORKFLOW.length - 1], ...lastStage, isSystemStage: true, locked: lastStage.locked !== false },
    ];
};

const normalizeLocationFields = (data = {}) => {
    if (data.country || data.state || data.city) {
        const location = [data.city, data.state, data.country].filter(Boolean).join(', ') || data.location || '';
        return { ...data, location };
    }

    const parts = String(data.location || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length >= 3) {
        const [city, state, ...countryParts] = parts;
        return {
            ...data,
            city,
            state,
            country: countryParts.join(', '),
        };
    }

    return data;
};

const POSITION_FIELD_KEYS = [
    'jobTitle',
    'department',
    'status',
    'hiringStatus',
    'isReplacement',
    'budgetedCount',
    'baseSalaryMin',
    'baseSalaryMax',
];

const STEP2_FIELD_KEYS = [
    'vacancy',
    'location',
    'salaryMin',
    'salaryMax',
    'jobType',
    'workMode',
    'visibility',
    'priority',
    'experienceMin',
    'experienceMax',
    'probationPeriod',
    'noticePeriod',
];

const DEFAULT_STEP2_FIELD_CONFIG = {
    vacancy: { visible: true, isPublic: true, required: true, label: 'Vacancies', placeholder: '0' },
    location: { visible: true, isPublic: true, required: false, label: 'Location', placeholder: 'Mumbai' },
    salaryMin: { visible: true, isPublic: false, required: false, label: 'Sal. Min', placeholder: 'Min' },
    salaryMax: { visible: true, isPublic: false, required: false, label: 'Sal. Max', placeholder: 'Max' },
    jobType: { visible: true, isPublic: true, required: false, label: 'Job Type', placeholder: '' },
        grade: { visible: true, isPublic: true, required: false, label: 'Grade', placeholder: 'Select Grade' },
    workMode: { visible: true, isPublic: true, required: false, label: 'Work Mode', placeholder: '' },
    visibility: { visible: true, isPublic: true, required: false, label: 'Visibility', placeholder: '' },
    priority: { visible: true, isPublic: false, required: false, label: 'Priority', placeholder: '' },
    experienceMin: { visible: true, isPublic: true, required: false, label: 'Min Exp.', placeholder: '0' },
    experienceMax: { visible: true, isPublic: true, required: false, label: 'Max Exp.', placeholder: '0' },
    probationPeriod: { visible: true, isPublic: true, required: false, label: 'Probation', placeholder: 'Months' },
    noticePeriod: { visible: true, isPublic: true, required: false, label: 'Notice Period (Days)', placeholder: '30' },
    hiringManager: { visible: true, isPublic: false, required: false, label: 'Hiring Manager', placeholder: '' },
};

const PIPELINE_FIELD_KEYS = ['stageName', 'durationMinutes', 'mode', 'assignedInterviewer', 'feedbackFormId'];
const DEFAULT_PIPELINE_FIELD_CONFIG = {
    stageName: { visible: true, required: true, label: 'Stage Name' },
    durationMinutes: { visible: true, required: false, label: 'Duration (min)' },
    mode: { visible: true, required: false, label: 'Mode' },
    assignedInterviewer: { visible: true, required: false, label: 'Interviewer' },
    feedbackFormId: { visible: true, required: false, label: 'Feedback Form' },
};

export default function RequirementForm({ onClose, onSuccess, initialData, isEdit, isModal = true }) {
    const hasRestoredLocalProgressRef = useRef(false);
    const [step, setStep] = useState(isEdit ? 2 : 1);
    const [saving, setSaving] = useState(false);
    const [positions, setPositions] = useState([]);
    const [positionModalOpen, setPositionModalOpen] = useState(false);
    const [creatingPosition, setCreatingPosition] = useState(false);
    const [nextPositionId, setNextPositionId] = useState('');
    const [positionForm, setPositionForm] = useState({
        jobTitle: '',
        department: '',
        status: 'Vacant',
        hiringStatus: 'Open',
        isReplacement: false,
        budgetedCount: 1,
        baseSalaryRange: { min: '', max: '' }
    });
    const [isCustomDepartment, setIsCustomDepartment] = useState(false);
    const [isCustomDesignation, setIsCustomDesignation] = useState(false);
    const designationSuggestions = useMemo(() => {
        const departmentDesignations = getDesignationsForDepartment(positionForm.department);
        return departmentDesignations.length ? departmentDesignations : ALL_DESIGNATION_OPTIONS;
    }, [positionForm.department]);
    const [positionFieldConfig, setPositionFieldConfig] = useState(() => {
        try {
            const saved = localStorage.getItem(POSITION_FIELD_CONFIG_KEY);
            if (!saved) return DEFAULT_POSITION_FIELD_CONFIG;
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_POSITION_FIELD_CONFIG, ...parsed };
        } catch {
            return DEFAULT_POSITION_FIELD_CONFIG;
        }
    });
    const [showPositionFieldCustomizer, setShowPositionFieldCustomizer] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [grades, setGrades] = useState([]);
    const [dbDepartments, setDbDepartments] = useState([]);
    const departmentOptionsList = useMemo(() => {
        const dbNames = dbDepartments.map(d => d.name).filter(Boolean);
        const combined = [...new Set([...dbNames, ...DEPARTMENT_OPTIONS])];
        return combined;
    }, [dbDepartments]);
    const [selectedPosition, setSelectedPosition] = useState(null);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    // Pipeline & Feedback State
    const [showStageModal, setShowStageModal] = useState(false);
    const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
    const [templateBuilderData, setTemplateBuilderData] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [onboardingTemplates, setOnboardingTemplates] = useState([]);
    const [customBGVCheck, setCustomBGVCheck] = useState('');
    const [showCustomModal, setShowCustomModal] = useState(false);

    const handleAddCustomCheck = () => {
        if (!customBGVCheck.trim()) return;
        const normalizedCheck = customBGVCheck.toUpperCase().replace(/\s+/g, '_');
        if (!formData.bgvConfig.checks.includes(normalizedCheck)) {
            const newChecks = [...formData.bgvConfig.checks, normalizedCheck];
            updateField('bgvConfig', { ...formData.bgvConfig, checks: newChecks });
        }
        setCustomBGVCheck('');
    };

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const [feedbackRes, onboardingRes] = await Promise.all([
                    api.get('/feedback/templates'),
                    api.get('/onboarding/templates')
                ]);
                setTemplates(feedbackRes.data);
                const onboardData = onboardingRes?.data;
                const onboardList = Array.isArray(onboardData) ? onboardData : (onboardData?.templates || onboardData?.data || []);
                setOnboardingTemplates(onboardList);
            } catch (e) {
                console.error("Failed to load templates", e);
            }
        };
        fetchTemplates();
    }, []);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const res = await api.get('/hr/employees?limit=500');
                const payload = res?.data;
                const list = Array.isArray(payload) ? payload : (payload?.data || payload?.employees || []);
                setEmployees(list);
            } catch (err) {
                console.error('Failed to load employees', err);
                setEmployees([]);
            }
        };
        fetchEmployees();
    }, []);

    useEffect(() => {
        const fetchDeptsAndGrades = async () => {
            try {
                const [deptRes, gradeRes] = await Promise.all([
                    api.get('/hr/departments'),
                    api.get('/grades')
                ]);
                const deptList = Array.isArray(deptRes.data?.data) ? deptRes.data.data : (Array.isArray(deptRes.data) ? deptRes.data : []);
                setDbDepartments(deptList);

                const gradeList = Array.isArray(gradeRes.data?.data) ? gradeRes.data.data : (Array.isArray(gradeRes.data) ? gradeRes.data : []);
                setGrades(gradeList);
            } catch (err) {
                console.error('Failed to load departments or grades', err);
            }
        };
        fetchDeptsAndGrades();
    }, []);

    useEffect(() => {
        if (!isModal) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isModal]);

    useEffect(() => {
        try {
            localStorage.setItem(POSITION_FIELD_CONFIG_KEY, JSON.stringify(positionFieldConfig));
        } catch {
            // Ignore storage failures and continue with in-memory config.
        }
    }, [positionFieldConfig]);

    const [formData, setFormData] = useState({
        positionId: '',
        jobTitle: '',
        department: '',
        jobType: 'Full-Time',
        grade: '',
        workMode: 'On-site',
        country: '',
        state: '',
        city: '',
        location: '',
        vacancy: 1,
        priority: 'Medium',
        salaryMin: '',
        salaryMax: '',
        experienceMin: 0,
        experienceMax: 5,
        hiringManager: '',
        interviewPanel: [],
        description: '',
        responsibilities: [],
        requiredSkills: [],
        optionalSkills: [],
        education: '',
        certifications: [],
        keywords: [],
        visibility: 'External',
        bgvConfig: {
            isEnabled: false,
            triggerStage: 'POST_OFFER',
            checks: []
        },
        onboardingConfig: {
            templateId: ''
        }
    });


    // Custom fields state
    const [customFields, setCustomFields] = useState([]);
    const selectedStates = useMemo(() => getStatesForCountry(formData.country), [formData.country]);
    const selectedCities = useMemo(() => getCitiesForState(formData.country, formData.state), [formData.country, formData.state]);

    // State for managing built-in field visibility
    const [fieldVisibility, setFieldVisibility] = useState(() => {
        try {
            const saved = localStorage.getItem(STEP2_FIELD_CONFIG_KEY);
            if (!saved) return DEFAULT_STEP2_FIELD_CONFIG;
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_STEP2_FIELD_CONFIG, ...parsed };
        } catch {
            return DEFAULT_STEP2_FIELD_CONFIG;
        }
    });
    const [showStep2FieldCustomizer, setShowStep2FieldCustomizer] = useState(false);

    useEffect(() => {
        try {
            localStorage.setItem(STEP2_FIELD_CONFIG_KEY, JSON.stringify(fieldVisibility));
        } catch {
            // Ignore storage failures and continue with in-memory config.
        }
    }, [fieldVisibility]);

    // State for dropdown options
    const [dropdownOptions, setDropdownOptions] = useState({
        jobType: ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Freelance'],
        workMode: ['On-site', 'Remote', 'Hybrid'],
        priority: ['Low', 'Medium', 'High'],
        visibility: ['External (Public Portal)', 'Internal Only', 'Both (External + Internal)']
    });


    const [workflow, setWorkflow] = useState(() => ensureDefaultPipelineWorkflow(DEFAULT_PIPELINE_WORKFLOW));
    const [pipelineFieldConfig, setPipelineFieldConfig] = useState(() => {
        try {
            const saved = localStorage.getItem(PIPELINE_FIELD_CONFIG_KEY);
            if (!saved) return DEFAULT_PIPELINE_FIELD_CONFIG;
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_PIPELINE_FIELD_CONFIG, ...parsed };
        } catch {
            return DEFAULT_PIPELINE_FIELD_CONFIG;
        }
    });
    const [showPipelineFieldCustomizer, setShowPipelineFieldCustomizer] = useState(false);

    useEffect(() => {
        try {
            localStorage.setItem(PIPELINE_FIELD_CONFIG_KEY, JSON.stringify(pipelineFieldConfig));
        } catch {
            // Ignore storage failures and continue with in-memory config.
        }
    }, [pipelineFieldConfig]);

    const [pipelineTemplates, setPipelineTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');


    const [draftId, setDraftId] = useState(null);
    /** Modal: start docked next to sidebar; user can toggle true full screen */
    const [modalFullScreen, setModalFullScreen] = useState(false);

    const clearLocalRequirementProgress = () => {
        try {
            localStorage.removeItem(REQUIREMENT_PROGRESS_STORAGE_KEY);
        } catch {
            // Ignore storage failures.
        }
    };

    const getEmployeeDisplayName = (emp) => {
        if (!emp) return '';
        const first = String(emp.firstName || '').trim();
        const last = String(emp.lastName || '').trim();
        const full = `${first} ${last}`.trim();
        if (full) return full;
        const byName = String(emp.name || emp.fullName || '').trim();
        if (byName) return byName;
        const byEmail = String(emp.email || '').trim();
        if (byEmail) return byEmail;
        return String(emp.employeeId || emp.employeeCode || emp._id || 'Employee');
    };

    const getEmployeeCode = (emp) => String(emp?.employeeId || emp?.employeeCode || emp?.code || '').trim();

    const normalizeForMatch = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

    const getEmployeeDepartment = (emp) => (
        emp?.department
        || emp?.departmentName
        || emp?.departmentId?.name
        || emp?.departmentId?.departmentName
        || ''
    );

    const getEmployeeDesignation = (emp) => (
        emp?.designation
        || emp?.jobTitle
        || emp?.position
        || emp?.designationName
        || emp?.designationId?.name
        || emp?.designationId?.designationName
        || ''
    );

    const employeeOptions = useMemo(
        () => employees
            .filter((emp) => emp && emp._id)
            .map((emp) => {
                const employeeCode = getEmployeeCode(emp);
                return {
                    value: emp._id,
                    label: employeeCode ? `${getEmployeeDisplayName(emp)} (${employeeCode})` : getEmployeeDisplayName(emp),
                };
            }),
        [employees]
    );

    const currentEmployeeStats = useMemo(() => {
        const selectedDepartment = normalizeForMatch(formData.department);
        const selectedDesignation = normalizeForMatch(formData.jobTitle);
        const currentEmployees = employees.filter((emp) => {
            const status = normalizeForMatch(emp?.status || 'active');
            return !['draft', 'inactive', 'in active', 'resigned', 'terminated', 'exited', 'deleted'].includes(status);
        });

        return {
            department: selectedDepartment
                ? currentEmployees.filter((emp) => normalizeForMatch(getEmployeeDepartment(emp)) === selectedDepartment).length
                : 0,
            designation: selectedDesignation
                ? currentEmployees.filter((emp) => normalizeForMatch(getEmployeeDesignation(emp)) === selectedDesignation).length
                : 0,
        };
    }, [employees, formData.department, formData.jobTitle]);

    const showCurrentEmployeeStats = Boolean(formData.department || formData.jobTitle);

    // Load data
    const fetchPositions = async () => {
        try {
            const posRes = await api.get('/positions');
            const payload = posRes?.data;
            const allPositions = Array.isArray(payload)
                ? payload
                : (payload?.data || payload?.positions || []);

            setPositions(Array.isArray(allPositions) ? allPositions.filter((pos) => pos && pos._id) : []);
        } catch (err) {
            console.error("Error fetching data for form", err);
            setPositions([]);
        }
    };

    useEffect(() => {
        fetchPositions();
    }, [isEdit]);
    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({ ...prev, ...normalizeLocationFields(initialData) }));
            if (isEdit && initialData._id) {
                setDraftId(initialData._id);
            }

            if (initialData.pipelineStages && Array.isArray(initialData.pipelineStages) && initialData.pipelineStages.length > 0) {
                const mappedStages = initialData.pipelineStages
                    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                    .map(stg => ({
                        ...stg,
                        id: stg.stageId || stg.id || `stage_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        assignedInterviewers: Array.isArray(stg.assignedInterviewers)
                            ? stg.assignedInterviewers.map((it) => (it?._id || it)).filter(Boolean)
                            : (stg.assignedInterviewer ? [stg.assignedInterviewer] : []),
                        assignedInterviewer: (stg.assignedInterviewers && stg.assignedInterviewers.length > 0)
                            ? (stg.assignedInterviewers[0]?._id || stg.assignedInterviewers[0])
                            : stg.assignedInterviewer,
                        locked: stg.isSystemStage
                    }));
                setWorkflow(ensureDefaultPipelineWorkflow(mappedStages));
            }
        }
    }, [initialData]);

    useEffect(() => {
        if (isEdit || initialData || hasRestoredLocalProgressRef.current) return;
        hasRestoredLocalProgressRef.current = true;

        try {
            const saved = localStorage.getItem(REQUIREMENT_PROGRESS_STORAGE_KEY);
            if (!saved) return;

            const parsed = JSON.parse(saved);
            if (!parsed || typeof parsed !== 'object') return;

            if (parsed.formData && typeof parsed.formData === 'object') {
                setFormData((prev) => ({ ...prev, ...parsed.formData }));
            }
            if (parsed.positionForm && typeof parsed.positionForm === 'object') {
                setPositionForm((prev) => ({
                    ...prev,
                    ...parsed.positionForm,
                    baseSalaryRange: {
                        ...prev.baseSalaryRange,
                        ...(parsed.positionForm.baseSalaryRange || {}),
                    },
                }));
            }
            if (Array.isArray(parsed.customFields)) {
                setCustomFields(parsed.customFields);
            }
            if (Array.isArray(parsed.workflow) && parsed.workflow.length > 0) {
                setWorkflow(ensureDefaultPipelineWorkflow(parsed.workflow));
            }
            if (parsed.draftId) {
                setDraftId(parsed.draftId);
            }
            if (Number.isInteger(parsed.step) && parsed.step >= 1 && parsed.step <= 5) {
                setStep(parsed.step);
            }
            toast.success('Restored your unsaved hiring draft.');
        } catch {
            // Ignore corrupt local drafts.
        }
    }, [isEdit, initialData]);

    useEffect(() => {
        if (isEdit) return;

        try {
            localStorage.setItem(
                REQUIREMENT_PROGRESS_STORAGE_KEY,
                JSON.stringify({
                    step,
                    draftId,
                    formData,
                    positionForm,
                    customFields,
                    workflow,
                    savedAt: Date.now(),
                })
            );
        } catch {
            // Ignore storage failures and continue with in-memory state.
        }
    }, [isEdit, step, draftId, formData, positionForm, customFields, workflow]);

    // --- AI Generation ---
    const handleAIGenerate = async () => {
        if (!formData.jobTitle) {
            toast.error("Please enter a Job Title (Step 1) so AI knows what to generate for.");
            return;
        }

        setIsGeneratingAI(true);
        try {
            const res = await api.post('/ai/generate-job-description', {
                jobTitle: formData.jobTitle,
                department: formData.department,
                context: {
                    workMode: formData.workMode,
                    jobType: formData.jobType,
                    priority: formData.priority,
                    education: formData.education,
                    experienceRange: `${formData.experienceMin ?? 0}-${formData.experienceMax ?? 0} years`,
                    mustHaveSkills: formData.requiredSkills || [],
                    niceToHaveSkills: formData.optionalSkills || [],
                    responsibilitiesHint: formData.responsibilities || [],
                    roleObjective: formData.description || '',
                    tone: 'Professional',
                }
            }, { timeout: 65000 });

            if (res.data.success) {
                const { description, responsibilities, requiredSkills, optionalSkills } = res.data.data;

                setFormData(prev => ({
                    ...prev,
                    description: description || prev.description,
                    responsibilities: (responsibilities && responsibilities.length > 0) ? responsibilities : prev.responsibilities,
                    requiredSkills: (requiredSkills && requiredSkills.length > 0) ? requiredSkills : prev.requiredSkills,
                    optionalSkills: (optionalSkills && optionalSkills.length > 0) ? optionalSkills : prev.optionalSkills
                }));
                toast.success("✨ AI has generated fresh content for this role!");
            }
        } catch (err) {
            console.error("AI Generation Error:", err);
            toast.error("Failed to generate content with AI. Please try again.");
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const sanitizePayload = (data) => {
        const clean = { ...data };
        clean.location = [clean.city, clean.state, clean.country].filter(Boolean).join(', ') || clean.location || '';

        // Sanitize hiringManager
        if (!clean.hiringManager || clean.hiringManager === "") {
            delete clean.hiringManager;
        } else if (typeof clean.hiringManager === 'object') {
            clean.hiringManager = clean.hiringManager._id || clean.hiringManager;
        }

        // Sanitize interviewPanel
        if (clean.interviewPanel) {
            clean.interviewPanel = clean.interviewPanel
                .filter(id => id && id !== "")
                .map(id => typeof id === 'object' ? (id._id || id) : id);
        }

        // Sanitize positionId
        return clean;
    };

    const validateStep2RequiredFields = () => {
        for (const fieldKey of STEP2_FIELD_KEYS) {
            const config = fieldVisibility[fieldKey] || {};
            if (!config.visible || !config.required) continue;

            if (fieldKey === 'location') {
                if (!formData.country || !formData.state || !formData.city) {
                    toast.error(`${config.label || 'Location'} is required.`);
                    return false;
                }
                continue;
            }

            const rawValue = formData[fieldKey];
            const isNumberLike = typeof rawValue === 'number';
            const isValid = isNumberLike ? !Number.isNaN(rawValue) : String(rawValue ?? '').trim().length > 0;
            if (!isValid) {
                const label = config.label || fieldKey;
                toast.error(`${label} is required.`);
                return false;
            }
        }
        return true;
    };

    const updateLocationField = (field, value) => {
        setFormData((prev) => {
            const next = { ...prev, [field]: value };
            if (field === 'country') {
                next.state = '';
                next.city = '';
            }
            if (field === 'state') {
                next.city = '';
            }
            next.location = [next.city, next.state, next.country].filter(Boolean).join(', ');
            return next;
        });
    };

    const validateStep4RequiredFields = () => {
        const editableStages = workflow.filter((_, idx) => idx !== 0 && idx !== workflow.length - 1);
        for (const stage of editableStages) {
            for (const fieldKey of PIPELINE_FIELD_KEYS) {
                const cfg = pipelineFieldConfig[fieldKey] || {};
                if (!cfg.visible || !cfg.required) continue;
                const value = stage[fieldKey];
                if (String(value ?? '').trim() === '') {
                    toast.error(`${cfg.label || fieldKey} is required for stage "${stage.stageName || 'Unnamed'}".`);
                    return false;
                }
            }
        }
        return true;
    };

    const validateStep3RequiredFields = () => {
        const description = String(formData.description || '').trim();
        if (!description) {
            toast.error('Role Overview is required.');
            return false;
        }
        return true;
    };

    const handleNext = async (injectedPosId = null) => {
        const validInjectedId = (typeof injectedPosId === 'string') ? injectedPosId : null;
        const effectivePosId = validInjectedId || formData.positionId;

        console.log('>>> handleNext called', {
            step,
            formPositionId: formData.positionId,
            injectedPosId: validInjectedId,
            effectivePosId,
            jobTitle: positionForm.jobTitle,
            dept: positionForm.department
        });

        if (step === 1 && !effectivePosId) {
            if (positionForm.jobTitle && positionForm.department) {
                const newId = await createPositionAndSelect();
                if (!newId) return;

                const currentFormData = {
                    ...formData,
                    positionId: newId,
                    jobTitle: positionForm.jobTitle,
                    department: positionForm.department
                };

                // FORCE STEP CHANGE IMMEDIATELY
                setStep(2);

                // Save draft in background
                return proceedToSaveDraft(currentFormData, 1);
            } else {
                const missing = [];
                if (!positionForm.jobTitle) missing.push("Job Title");
                if (!positionForm.department) missing.push("Department");
                toast.error(`Please fill ${missing.join(" & ")} or select an existing position.`);
                return;
            }
        }
        if (step === 2 && !formData.jobTitle) {
            toast.error("Job Title is required.");
            return;
        }
        if (step === 2 && !validateStep2RequiredFields()) {
            return;
        }
        if (step === 3 && !validateStep3RequiredFields()) {
            return;
        }
        if (step === 4 && !validateStep4RequiredFields()) {
            return;
        }

        proceedToSaveDraft(validInjectedId ? { ...formData, positionId: validInjectedId } : formData, step);
    };

    const buildDraftDataPayload = (currentFormData, currentStep) => {
        let dataPayload = sanitizePayload(currentFormData);

        // Prevent backend BSON validation errors for temporary fallback IDs
        if (dataPayload.positionId && (String(dataPayload.positionId).includes('TEMP') || String(dataPayload.positionId).includes('FALLBACK'))) {
            delete dataPayload.positionId;
        }

        if (currentStep >= 3) {
            dataPayload.pipelineStages = workflow.map((stg, idx) => {
                const allInterviewers = ((stg.assignedInterviewers && stg.assignedInterviewers.length > 0)
                    ? stg.assignedInterviewers
                    : (stg.assignedInterviewer ? [stg.assignedInterviewer] : []))
                    .filter(id => id && id !== "");

                const assignedInterviewers = allInterviewers
                    .filter(inv => typeof inv !== 'object' || !inv.isExternal)
                    .map(id => typeof id === 'object' ? (id._id || id) : id);

                const externalInterviewers = allInterviewers
                    .filter(inv => typeof inv === 'object' && inv.isExternal)
                    .map(inv => ({ name: inv.name, email: inv.email }));

                return {
                    stageId: stg.stageId || stg.id,
                    stageName: typeof stg.stageName === 'string' ? stg.stageName : (stg.stageName?.toString() || 'Stage'),
                    stageType: stg.stageType || 'Interview',
                    mode: stg.mode || 'Online',
                    durationMinutes: stg.durationMinutes || 30,
                    assignedInterviewers,
                    externalInterviewers,
                    feedbackFormId: stg.feedbackFormId && stg.feedbackFormId !== "" ? stg.feedbackFormId : undefined,
                    evaluationCriteria: stg.evaluationCriteria || [],
                    orderIndex: idx + 1,
                    isSystemStage: stg.isSystemStage || false
                };
            });
        }

        dataPayload.bgvConfig = formData.bgvConfig;
        dataPayload.onboardingConfig = formData.onboardingConfig;

        return dataPayload;
    };

    const saveDraftForCurrentStep = async () => {
        try {
            setSaving(true);
            const dataPayload = buildDraftDataPayload(formData, step);
            const stepPayload = {
                step,
                draftId,
                data: dataPayload
            };
            const res = await api.post('/requirements/draft', stepPayload);
            if (res.data?.success) {
                const newDraftId = res.data.draftId;
                setDraftId(newDraftId);
                toast.success('Draft saved');
                return res.data;
            } else {
                toast.error('Draft save failed');
                return null;
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Draft save failed');
            return null;
        } finally {
            setSaving(false);
        }
    };

    const proceedToSaveDraft = async (currentFormData, currentStep) => {
        const targetStep = currentStep === 3 ? 5 : currentStep + 1;

        try {
            setSaving(true);
            const dataPayload = buildDraftDataPayload(currentFormData, currentStep);

            const stepPayload = {
                step: currentStep,
                draftId,
                data: dataPayload
            };

            const res = await api.post('/requirements/draft', stepPayload);
            if (res.data.success) {
                setDraftId(res.data.draftId);
                if (step === currentStep && targetStep <= 5) {
                    setStep(targetStep);
                }
            } else {
                toast.error('Failed to save this step. Please try again.');
            }
        } catch (err) {
            const message = err?.response?.data?.message || err?.message || 'Failed to save this step. Please try again.';
            toast.error(message);
            console.warn("Draft save failed:", message);
        } finally {
            setSaving(false);
        }
    };

    const handlePositionChange = async (posId) => {
        if (!posId) return;

        // Ensure positionId is set regardless of whether we find the full object in local state
        setFormData(prev => ({
            ...prev,
            positionId: posId
        }));

        const pos = positions.find(p => String(p._id) === String(posId));
        if (pos) {
            setFormData(prev => ({
                ...prev,
                jobTitle: pos.jobTitle || prev.jobTitle,
                department: pos.department || prev.department,
                salaryMin: pos.baseSalaryRange?.min || prev.salaryMin || '',
                salaryMax: pos.baseSalaryRange?.max || prev.salaryMax || '',
                vacancy: (pos.budgetedCount || 1) - (pos.currentCount || 0) || prev.vacancy || 1
            }));
            setSelectedPosition(pos);
        }
    };

    const handleBack = () => {
        if (isEdit && step === 2) return;
        if (step > 1) {
            if (step === 5) {
                setStep(3);
            } else {
                setStep(step - 1);
            }
        }
    };

    const fetchNextPositionId = async () => {
        try {
            setNextPositionId('Loading...');
            const res = await api.post('/company-id-config/next', { entityType: 'POS', increment: false });
            if (res.data?.data?.id) {
                setNextPositionId(res.data.data.id);
            } else {
                setNextPositionId('Auto-Generate');
            }
        } catch (error) {
            console.error('Failed to fetch next position ID', error);
            setNextPositionId('Auto-Generate');
        }
    };

    const openPositionModal = async () => {
        const initialDepartment = formData.department || '';
        setPositionForm({
            jobTitle: '',
            department: initialDepartment,
            status: 'Vacant',
            hiringStatus: 'Closed',
            isReplacement: false,
            baseSalaryRange: { min: '', max: '' }
        });
        setIsCustomDepartment(!!initialDepartment && !departmentOptionsList.includes(initialDepartment));
        setIsCustomDesignation(false);
        setShowPositionFieldCustomizer(false);
        setPositionModalOpen(true);
        fetchNextPositionId();
    };

    const getPositionFieldValue = (fieldKey) => {
        if (fieldKey === 'baseSalaryMin') return positionForm.baseSalaryRange?.min;
        if (fieldKey === 'baseSalaryMax') return positionForm.baseSalaryRange?.max;
        return positionForm[fieldKey];
    };

    const renderDepartmentField = ({ label, required, placeholder, labelClassName = "mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400" }) => {
        const currentDepartment = String(positionForm.department || '').trim();
        const selectValue = isCustomDepartment || (currentDepartment && !departmentOptionsList.includes(currentDepartment))
            ? CUSTOM_DEPARTMENT_VALUE
            : currentDepartment;

        return (
            <div>
                <label className={labelClassName}>
                    {label} {required ? '*' : ''}
                </label>
                <select
                    value={selectValue}
                    onChange={(e) => {
                        const value = e.target.value;
                        if (value === CUSTOM_DEPARTMENT_VALUE) {
                            setIsCustomDepartment(true);
                            setPositionForm((prev) => ({ ...prev, department: '' }));
                            return;
                        }
                        setIsCustomDepartment(false);
                        setIsCustomDesignation(false);
                        setPositionForm((prev) => ({ ...prev, department: value, jobTitle: '' }));
                    }}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                    <option value="">{placeholder || 'Select department'}</option>
                    {departmentOptionsList.map((department) => (
                        <option key={department} value={department}>{department}</option>
                    ))}
                    <option value={CUSTOM_DEPARTMENT_VALUE}>Custom</option>
                </select>
                {selectValue === CUSTOM_DEPARTMENT_VALUE && (
                    <input
                        type="text"
                        value={positionForm.department}
                        onChange={(e) => setPositionForm((prev) => ({ ...prev, department: e.target.value, jobTitle: '' }))}
                        placeholder="Enter custom department"
                        className="mt-3 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                )}
            </div>
        );
    };

    const renderDesignationField = ({ label, required, placeholder, labelClassName = "mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400" }) => {
        const currentDesignation = String(positionForm.jobTitle || '').trim();
        const selectValue = isCustomDesignation || (currentDesignation && !designationSuggestions.includes(currentDesignation))
            ? CUSTOM_DESIGNATION_VALUE
            : currentDesignation;
        const hasDepartment = Boolean(String(positionForm.department || '').trim());
        const placeholderText = hasDepartment ? (placeholder || 'Select designation') : 'Select department first';

        return (
            <div>
                <label className={labelClassName}>
                    {label || 'Designation'} {required ? '*' : ''}
                </label>
                <select
                    value={selectValue}
                    onChange={(e) => {
                        const value = e.target.value;
                        if (value === CUSTOM_DESIGNATION_VALUE) {
                            setIsCustomDesignation(true);
                            setPositionForm((prev) => ({ ...prev, jobTitle: '' }));
                            return;
                        }
                        setIsCustomDesignation(false);
                        setPositionForm((prev) => ({ ...prev, jobTitle: value }));
                    }}
                    disabled={!positionForm.department && !isCustomDepartment}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                >
                    <option value="">{placeholderText}</option>
                    {designationSuggestions.map((designation) => (
                        <option key={designation} value={designation}>{designation}</option>
                    ))}
                    <option value={CUSTOM_DESIGNATION_VALUE}>Custom</option>
                </select>
                {selectValue === CUSTOM_DESIGNATION_VALUE && (
                    <input
                        type="text"
                        value={positionForm.jobTitle}
                        onChange={(e) => setPositionForm((prev) => ({ ...prev, jobTitle: e.target.value }))}
                        placeholder="Enter custom designation"
                        className="mt-3 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                )}
            </div>
        );
    };

    const isPositionFieldVisible = (fieldKey) => positionFieldConfig[fieldKey]?.visible !== false;

    const validatePositionForm = () => {
        const requiredFields = POSITION_FIELD_KEYS.filter(
            (key) => positionFieldConfig[key]?.required && isPositionFieldVisible(key)
        );

        for (const fieldKey of requiredFields) {
            const raw = getPositionFieldValue(fieldKey);
            const value = typeof raw === 'boolean' ? String(raw) : String(raw ?? '').trim();
            if (!value) {
                const fieldName = positionFieldConfig[fieldKey]?.label || fieldKey;
                toast.error(`${fieldName} is required to create position.`);
                return false;
            }
        }

        return true;
    };

    const updatePositionFieldConfig = (fieldKey, key, value) => {
        setPositionFieldConfig((prev) => ({
            ...prev,
            [fieldKey]: {
                ...DEFAULT_POSITION_FIELD_CONFIG[fieldKey],
                ...(prev[fieldKey] || {}),
                [key]: value,
            },
        }));
    };

    const createPositionAndSelect = async () => {
        if (!validatePositionForm()) {
            return null;
        }

        try {
            setCreatingPosition(true);
            const payload = {
                ...positionForm,
                baseSalaryRange: {
                    min: positionForm.baseSalaryRange.min || undefined,
                    max: positionForm.baseSalaryRange.max || undefined
                }
            };
            const creationRes = await api.post(`/positions?_debug_t=${Date.now()}`, payload);
            const rawData = creationRes.data || {};
            console.log("DEBUG: Raw API Response:", rawData);

            // EXHAUSTIVE EXTRACTION
            const createdObj = rawData.data || rawData.position || rawData.newPosition || rawData;
            const extractedId =
                (createdObj?._id) ||
                (createdObj?.id) ||
                (rawData.data?._id) ||
                (rawData.data?.id) ||
                (rawData._id) ||
                (rawData.id);

            console.log("DEBUG: Extracted Object:", createdObj);
            console.log("DEBUG: Extracted ID:", extractedId);

            if (extractedId && (typeof extractedId === 'string' || typeof extractedId === 'object')) {
                const finalId = typeof extractedId === 'object' ? String(extractedId) : extractedId;
                console.log("SUCCESS: Finalized position ID:", finalId);
                setFormData(prev => ({
                    ...prev,
                    positionId: finalId,
                    jobTitle: positionForm.jobTitle,
                    department: positionForm.department
                }));

                await handlePositionChange(finalId);
                toast.success('Position created successfully!');

                // Trigger step 2 and close modal
                setStep(2);
                setPositionModalOpen(false);

                // Refresh in background
                fetchPositions();

                return finalId;
            }

            // LAST RESORT - If success is true, we should probably just proceed to step 2 anyway 
            // after re-fetching the positions to see if it's there.
            if (rawData.success) {
                console.log("Entering fallback ID resolution...");
                const allPos = await fetchPositions();

                // Try to find the position we just created by name/dept
                const matched = allPos?.find(p =>
                    p.jobTitle === positionForm.jobTitle &&
                    p.department === positionForm.department
                );

                const finalId = matched?._id || matched?.id || null;

                setFormData(prev => ({
                    ...prev,
                    positionId: finalId || prev.positionId,
                    jobTitle: positionForm.jobTitle,
                    department: positionForm.department
                }));

                setStep(2);
                return finalId || 'TEMP_SYNC';
            }

            console.error("CRITICAL: Failed to find ID in response:", rawData);
            toast.error("Format error: Position created but ID not returned. Please select it from the list.");
            return null;
        } finally {
            setCreatingPosition(false);
        }
    };

    const renderInlinePositionForm = () => {
        const getLabel = (key) => positionFieldConfig[key]?.label || DEFAULT_POSITION_FIELD_CONFIG[key]?.label || key;
        const getPlaceholder = (key) => positionFieldConfig[key]?.placeholder || DEFAULT_POSITION_FIELD_CONFIG[key]?.placeholder || '';
        const show = (key) => isPositionFieldVisible(key);
        const required = (key) => positionFieldConfig[key]?.required && show(key);

        return (
            <div className="col-span-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Position Details</div>
                    <button
                        type="button"
                        onClick={() => setShowPositionFieldCustomizer((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                    >
                        <Settings size={13} />
                        {showPositionFieldCustomizer ? 'Close Field Customization' : 'Customize Fields'}
                    </button>
                </div>

                {showPositionFieldCustomizer && (
                    <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                            Field controls (show, required, title, placeholder)
                        </p>
                        <div className="space-y-2">
                            {POSITION_FIELD_KEYS.map((fieldKey) => (
                                <div key={fieldKey} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto_auto]">
                                    <input
                                        type="text"
                                        value={positionFieldConfig[fieldKey]?.label || ''}
                                        onChange={(e) => updatePositionFieldConfig(fieldKey, 'label', e.target.value)}
                                        placeholder="Field title"
                                        className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    />
                                    <input
                                        type="text"
                                        value={positionFieldConfig[fieldKey]?.placeholder || ''}
                                        onChange={(e) => updatePositionFieldConfig(fieldKey, 'placeholder', e.target.value)}
                                        placeholder="Placeholder"
                                        className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        disabled={fieldKey === 'status' || fieldKey === 'hiringStatus' || fieldKey === 'isReplacement'}
                                    />
                                    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={!!positionFieldConfig[fieldKey]?.visible}
                                            onChange={(e) => updatePositionFieldConfig(fieldKey, 'visible', e.target.checked)}
                                        />
                                        Show
                                    </label>
                                    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={!!positionFieldConfig[fieldKey]?.required}
                                            onChange={(e) => updatePositionFieldConfig(fieldKey, 'required', e.target.checked)}
                                        />
                                        Required
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {show('department') && (
                        <div className="xl:col-span-1">
                            {renderDepartmentField({
                                label: getLabel('department'),
                                required: required('department'),
                                placeholder: getPlaceholder('department')
                            })}
                        </div>
                    )}

                    {show('jobTitle') && (
                        <div className="xl:col-span-1">
                            {renderDesignationField({
                                label: 'Designation',
                                required: required('jobTitle'),
                                placeholder: getPlaceholder('jobTitle') || 'Select designation'
                            })}
                        </div>
                    )}


                    {show('isReplacement') && (
                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {getLabel('isReplacement')} {required('isReplacement') ? '*' : ''}
                            </label>
                            <select
                                value={String(positionForm.isReplacement)}
                                onChange={(e) => setPositionForm((prev) => ({ ...prev, isReplacement: e.target.value === 'true' }))}
                                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            >
                                <option value="false">New Role</option>
                                <option value="true">Backfill</option>
                            </select>
                        </div>
                    )}
                    {show('budgetedCount') && (
                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {getLabel('budgetedCount')} {required('budgetedCount') ? '*' : ''}
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={positionForm.budgetedCount || 1}
                                onChange={(e) => setPositionForm((prev) => ({ ...prev, budgetedCount: parseInt(e.target.value, 10) || 1 }))}
                                placeholder={getPlaceholder('budgetedCount')}
                                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                    )}

                    {show('baseSalaryMin') && (
                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {getLabel('baseSalaryMin')} {required('baseSalaryMin') ? '*' : ''}
                            </label>
                            <input
                                type="number"
                                value={positionForm.baseSalaryRange.min}
                                onChange={(e) =>
                                    setPositionForm((prev) => ({
                                        ...prev,
                                        baseSalaryRange: { ...prev.baseSalaryRange, min: e.target.value }
                                    }))
                                }
                                placeholder={getPlaceholder('baseSalaryMin')}
                                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                    )}

                    {show('baseSalaryMax') && (
                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {getLabel('baseSalaryMax')} {required('baseSalaryMax') ? '*' : ''}
                            </label>
                            <input
                                type="number"
                                value={positionForm.baseSalaryRange.max}
                                onChange={(e) =>
                                    setPositionForm((prev) => ({
                                        ...prev,
                                        baseSalaryRange: { ...prev.baseSalaryRange, max: e.target.value }
                                    }))
                                }
                                placeholder={getPlaceholder('baseSalaryMax')}
                                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                    )}
                </div>

                <div className="mt-5 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <div className="rounded-lg bg-indigo-600 p-2 text-white">
                        <Check size={16} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-indigo-900">
                            Next ID: <span className="rounded-md border border-indigo-200 bg-white px-2 py-1 font-mono text-indigo-700">{nextPositionId || 'Loading...'}</span>
                        </div>
                        <div className="text-xs text-indigo-700/80">Auto-generated by org config.</div>
                    </div>
                </div>
            </div>
        );
    };

    const updateField = (field, val) => {
        setFormData(prev => ({ ...prev, [field]: val }));
        if (field === 'positionId' && val) handlePositionChange(val);
    };

    const submit = async () => {
        setSaving(true);
        try {
            if (isEdit) {
                const cleanData = sanitizePayload(formData);
                // For editing, we call the update API directly with a mapped payload
                const payload = {
                    department: cleanData.department,
                    jobTitle: cleanData.jobTitle,
                    vacancy: cleanData.vacancy,
                    location: cleanData.location,
                    country: cleanData.country,
                    state: cleanData.state,
                    city: cleanData.city,
                    jobDetails: {
                        salaryMin: cleanData.salaryMin,
                        salaryMax: cleanData.salaryMax,
                        experienceMin: cleanData.experienceMin,
                        experienceMax: cleanData.experienceMax,
                        priority: cleanData.priority,
                        visibility: cleanData.visibility,
                        workMode: cleanData.workMode,
                        jobType: cleanData.jobType,
                        grade: cleanData.grade,
                        hiringManager: cleanData.hiringManager,
                        interviewPanel: cleanData.interviewPanel
                    },
                    jobDescription: {
                        roleOverview: cleanData.description,
                        responsibilities: cleanData.responsibilities,
                        keywords: cleanData.keywords,
                        education: cleanData.education,
                        certifications: cleanData.certifications
                    },
                    requiredSkills: (cleanData.requiredSkills || []).map(s => typeof s === 'string' ? { name: s, weight: 40 } : s),
                    preferredSkills: (cleanData.optionalSkills || []).map(s => typeof s === 'string' ? { name: s, weight: 10 } : s),
                    bgvConfig: formData.bgvConfig,
                    onboardingConfig: formData.onboardingConfig,
                    pipelineStages: workflow.map((stg, idx) => {
                          const allInterviewers = ((stg.assignedInterviewers && stg.assignedInterviewers.length > 0)
                              ? stg.assignedInterviewers
                              : (stg.assignedInterviewer ? [stg.assignedInterviewer] : []))
                              .filter(id => id && id !== "");

                          const assignedInterviewers = allInterviewers
                              .filter(inv => typeof inv !== 'object' || !inv.isExternal)
                              .map(id => typeof id === 'object' ? (id._id || id) : id);

                          const externalInterviewers = allInterviewers
                              .filter(inv => typeof inv === 'object' && inv.isExternal)
                              .map(inv => ({ name: inv.name, email: inv.email }));

                          return {
                              stageId: stg.stageId || stg.id,
                              stageName: typeof stg.stageName === 'string' ? stg.stageName : (stg.stageName?.toString() || 'Stage'),
                              stageType: stg.stageType || 'Interview',
                              mode: stg.mode || 'Online',
                              durationMinutes: stg.durationMinutes || 30,
                              assignedInterviewers,
                              externalInterviewers,
                              feedbackFormId: stg.feedbackFormId && stg.feedbackFormId !== "" ? stg.feedbackFormId : undefined,
                              evaluationCriteria: stg.evaluationCriteria || [],
                              orderIndex: idx + 1,
                              isSystemStage: stg.isSystemStage || false
                          };
                      }),
                    status: 'Open'
                };

                const res = await api.put(`/requirements/${initialData._id}`, payload);
                if (res.data) {
                    toast.success('🎉 Job Opening Updated Successfully!');
                    clearLocalRequirementProgress();
                    onSuccess?.(res.data);
                    onClose?.();
                }
            } else {
                // For new jobs, we use the Publish API which converts a draft to a live requirement
                // Save one last time to ensure all data is captured, especially if draftId was null
                const draftRes = await saveDraftForCurrentStep();
                const effectiveDraftId = draftRes?.draftId || draftId;

                if (!effectiveDraftId) {
                    toast.error("Cannot publish without a valid draft session. Please ensure you've completed all steps.");
                    return;
                }

                const res = await api.post('/requirements/publish', { draftId: effectiveDraftId });
                if (res.data.success) {
                    toast.success('🎉 Job Opening Published Successfully!');
                    clearLocalRequirementProgress();
                    onSuccess?.(res.data.job);
                    onClose?.();
                }
            }
        } catch (err) {
            console.error("Submission Error:", err);
            toast.error(err.response?.data?.message || err.message || "Failed to finalize job opening.");
        } finally {
            setSaving(false);
        }
    };



    // --- Sub-renderers ---

    const renderStep1_Position = () => (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 w-full">
                {positions.length > 0 ? positions.map((pos, idx) => {
                    const isSelected = formData.positionId === pos._id;
                    return (
                        <div
                            key={pos._id?.toString() || pos.id || `pos-${idx}`}
                            onClick={() => updateField('positionId', pos._id)}
                            className={`p-3 rounded-xl border transition-all duration-500 cursor-pointer relative group flex flex-col justify-between h-full ${isSelected
                                ? 'border-[#4F46E5] bg-indigo-50/30'
                                : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-200 shadow-sm'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-xs font-bold transition-colors truncate ${isSelected ? 'text-[#4F46E5]' : 'text-slate-900 dark:text-white group-hover:text-[#4F46E5]'}`}>
                                        {pos.jobTitle}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                                            <div className="w-1 h-1 bg-[#4F46E5] rounded-full"></div>
                                            {pos.department}
                                        </span>
                                    </div>
                                </div>
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all duration-500 shrink-0 ${isSelected ? 'border-[#4F46E5] bg-[#4F46E5] text-white' : 'border-slate-100 dark:border-slate-800 bg-slate-50 text-slate-200'}`}>
                                    <Check size={12} strokeWidth={3} />
                                </div>
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-50 dark:border-slate-800/50 space-y-2">
                                <div className="flex items-center justify-between text-[8px] font-bold text-slate-500">
                                    <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                                        <Users size={10} className="text-[#4F46E5]" />
                                        <span>{pos.vacancies || 0}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                                        <MapPin size={10} className="text-rose-500" />
                                        <span>{pos.location || 'HQ'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    renderInlinePositionForm()
                )}

                {positions.length > 0 && (
                    <button
                        type="button"
                        onClick={openPositionModal}
                        className="group flex min-h-[124px] flex-col items-center justify-center rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-4 text-center transition-all hover:border-indigo-500 hover:bg-indigo-50"
                    >
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm">
                            <Plus size={18} />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Create Position</p>
                        <p className="mt-1 text-[10px] font-semibold text-indigo-500">Add another role opening</p>
                    </button>
                )}


            </div>
        </div>
    );

    // Helper functions for field management
    const toggleFieldVisibility = (fieldName) => {
        setFieldVisibility(prev => ({
            ...prev,
            [fieldName]: {
                ...DEFAULT_STEP2_FIELD_CONFIG[fieldName],
                ...prev[fieldName],
                visible: !prev[fieldName]?.visible
            }
        }));
    };

    const toggleFieldPublic = (fieldName) => {
        setFieldVisibility(prev => ({
            ...prev,
            [fieldName]: {
                ...DEFAULT_STEP2_FIELD_CONFIG[fieldName],
                ...prev[fieldName],
                isPublic: !prev[fieldName]?.isPublic
            }
        }));
    };

    const toggleFieldRequired = (fieldName) => {
        setFieldVisibility(prev => ({
            ...prev,
            [fieldName]: {
                ...DEFAULT_STEP2_FIELD_CONFIG[fieldName],
                ...prev[fieldName],
                required: !prev[fieldName]?.required
            }
        }));
    };

    const updateFieldLabelConfig = (fieldName, value) => {
        setFieldVisibility(prev => ({
            ...prev,
            [fieldName]: {
                ...DEFAULT_STEP2_FIELD_CONFIG[fieldName],
                ...prev[fieldName],
                label: value
            }
        }));
    };

    const updateFieldPlaceholderConfig = (fieldName, value) => {
        setFieldVisibility(prev => ({
            ...prev,
            [fieldName]: {
                ...DEFAULT_STEP2_FIELD_CONFIG[fieldName],
                ...prev[fieldName],
                placeholder: value
            }
        }));
    };

    const addDropdownOption = (fieldName, newOption) => {
        setDropdownOptions(prev => ({
            ...prev,
            [fieldName]: [...prev[fieldName], newOption]
        }));
    };

    const updateDropdownOption = (fieldName, index, value) => {
        setDropdownOptions(prev => {
            const newOptions = [...prev[fieldName]];
            newOptions[index] = value;
            return { ...prev, [fieldName]: newOptions };
        });
    };

    const deleteDropdownOption = (fieldName, index) => {
        setDropdownOptions(prev => {
            if (prev[fieldName].length > 1) {
                return {
                    ...prev,
                    [fieldName]: prev[fieldName].filter((_, idx) => idx !== index)
                };
            }
            return prev;
        });
    };

    const addCustomField = () => {
        setCustomFields([...customFields, {
            id: Date.now(),
            label: '',
            type: 'text',
            isPublic: true,
            options: ['Option 1', 'Option 2', 'Option 3'],
            value: ''
        }]);
    };

    const updateCustomField = (id, key, value) => {
        setCustomFields(customFields.map(field =>
            field.id === id ? { ...field, [key]: value } : field
        ));
    };

    const deleteCustomField = (id) => {
        setCustomFields(customFields.filter(field => field.id !== id));
    };

    const addCustomDropdownOption = (fieldId) => {
        setCustomFields(customFields.map(field => {
            if (field.id === fieldId) {
                return {
                    ...field,
                    options: [...field.options, `Option ${field.options.length + 1}`]
                };
            }
            return field;
        }));
    };

    const updateCustomDropdownOption = (fieldId, optionIndex, newValue) => {
        setCustomFields(customFields.map(field => {
            if (field.id === fieldId) {
                const newOptions = [...field.options];
                newOptions[optionIndex] = newValue;
                return { ...field, options: newOptions };
            }
            return field;
        }));
    };

    const deleteCustomDropdownOption = (fieldId, optionIndex) => {
        setCustomFields(customFields.map(field => {
            if (field.id === fieldId && field.options.length > 1) {
                return {
                    ...field,
                    options: field.options.filter((_, idx) => idx !== optionIndex)
                };
            }
            return field;
        }));
    };

    // State to track which field's options are being edited
    const [editingFieldOptions, setEditingFieldOptions] = useState(null);

    const renderStep2_Config = () => {
        // ... existing functions ...

        const renderDropdownManageBlock = (fieldName) => {
            const isEditingOptions = editingFieldOptions === fieldName;
            return (
                <div className="mt-2">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => {
                                const newOption = prompt('Enter new option:');
                                if (newOption && newOption.trim()) {
                                    addDropdownOption(fieldName, newOption.trim());
                                }
                            }}
                            className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 bg-slate-50 hover:bg-indigo-50/50 px-2.5 py-1 rounded-lg transition-all"
                        >
                            <Plus size={12} strokeWidth={3} /> Add Option
                        </button>

                        <button
                            type="button"
                            onClick={() => setEditingFieldOptions(isEditingOptions ? null : fieldName)}
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg transition-all"
                        >
                            <Settings size={12} /> {isEditingOptions ? 'Done' : 'Manage Options'}
                        </button>
                    </div>

                    {isEditingOptions && (
                        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in slide-in-from-top-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Active Options</p>
                            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                                {dropdownOptions[fieldName].map((option, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 shadow-sm group/opt">
                                        <span>{option}</span>
                                        {dropdownOptions[fieldName].length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => deleteDropdownOption(fieldName, idx)}
                                                className="text-slate-400 hover:text-red-500 p-1 rounded-md transition-colors"
                                                title="Delete Option"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400 text-center pt-1">At least one option required</p>
                        </div>
                    )}
                </div>
            );
        };

        const getFieldMeta = (fieldName, fallbackLabel, fallbackPlaceholder = '') => {
            const cfg = fieldVisibility[fieldName] || {};
            return {
                label: cfg.label || fallbackLabel,
                placeholder: cfg.placeholder ?? fallbackPlaceholder,
                required: !!cfg.required,
                visible: cfg.visible !== false,
            };
        };

        const renderFieldWithControls = (fieldName, label, inputElement, isDropdown = false, hideDropdownExtras = false, wrapperClassName = 'relative group space-y-1', hideLabel = false) => {
            if (!fieldVisibility[fieldName]?.visible) return null;
            const meta = getFieldMeta(fieldName, label);

            return (
                <div className={wrapperClassName}>
                    {!hideLabel && (
                        <div className="flex items-start justify-between gap-2 mb-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex-1">
                                {meta.label} {meta.required ? '*' : ''}
                            </label>
                            <div className="flex items-center gap-2">
                            </div>
                        </div>
                    )}

                    {inputElement}

                    {isDropdown && !hideDropdownExtras && renderDropdownManageBlock(fieldName)}
                </div>
            );
        };

        return (
            <div className="animate-in fade-in slide-in-from-right-8 duration-700">
                <div className="w-full pb-0">
                    {/* Job Title - Read Only from Step 1 */}
                    <div className="p-4 mb-8 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Job Title (From Position)</label>
                        <div className="text-xl font-black text-slate-900">{formData.jobTitle || 'Not Selected'}</div>
                        <div className="text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">{formData.department || 'Department'}</div>
                    </div>

                    <div className="mb-4 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setShowStep2FieldCustomizer((prev) => !prev)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                        >
                            <Settings size={13} />
                            {showStep2FieldCustomizer ? 'Close Field Customization' : 'Customize Fields'}
                        </button>
                    </div>

                    {showStep2FieldCustomizer && (
                        <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Step 2 field controls (show, required, title, placeholder)
                            </p>
                            <div className="space-y-2">
                                {STEP2_FIELD_KEYS.map((fieldKey) => {
                                    const meta = getFieldMeta(
                                        fieldKey,
                                        DEFAULT_STEP2_FIELD_CONFIG[fieldKey]?.label || fieldKey,
                                        DEFAULT_STEP2_FIELD_CONFIG[fieldKey]?.placeholder || '',
                                    );
                                    const placeholderEditable = !['jobType', 'workMode', 'visibility', 'priority'].includes(fieldKey);
                                    return (
                                        <div key={fieldKey} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto_auto]">
                                            <input
                                                type="text"
                                                value={meta.label}
                                                onChange={(e) => updateFieldLabelConfig(fieldKey, e.target.value)}
                                                placeholder="Field title"
                                                className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                            />
                                            <input
                                                type="text"
                                                value={meta.placeholder}
                                                onChange={(e) => updateFieldPlaceholderConfig(fieldKey, e.target.value)}
                                                placeholder="Placeholder"
                                                disabled={!placeholderEditable}
                                                className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"
                                            />
                                            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                                                <input
                                                    type="checkbox"
                                                    checked={meta.visible}
                                                    onChange={() => toggleFieldVisibility(fieldKey)}
                                                />
                                                Show
                                            </label>
                                            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                                                <input
                                                    type="checkbox"
                                                    checked={meta.required}
                                                    onChange={() => toggleFieldRequired(fieldKey)}
                                                />
                                                Required
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Grid Layout for Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">

                        {/* Location */}
                        {renderFieldWithControls('location', 'Location',
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                <label className="space-y-1">
                                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Country</span>
                                    <select
                                        value={formData.country || ''}
                                        onChange={(e) => updateLocationField('country', e.target.value)}
                                        className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                    >
                                        <option value="">Select Country</option>
                                        {COUNTRY_OPTIONS.map((country) => (
                                            <option key={country} value={country}>{country}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="space-y-1">
                                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">State</span>
                                    <select
                                        value={formData.state || ''}
                                        onChange={(e) => updateLocationField('state', e.target.value)}
                                        disabled={!formData.country}
                                        className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                    >
                                        <option value="">{formData.country ? 'Select State' : 'Select Country First'}</option>
                                        {selectedStates.map((state) => (
                                            <option key={state.name} value={state.name}>{state.name}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="space-y-1">
                                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">City</span>
                                    <select
                                        value={formData.city || ''}
                                        onChange={(e) => updateLocationField('city', e.target.value)}
                                        disabled={!formData.state}
                                        className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                    >
                                        <option value="">{formData.state ? 'Select City' : 'Select State First'}</option>
                                        {selectedCities.map((city) => (
                                            <option key={city} value={city}>{city}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>,
                            false,
                            false,
                            'relative group space-y-1 sm:col-span-2 lg:col-span-4',
                            true
                        )}



                        {/* Experience Min */}
                        {renderFieldWithControls('experienceMin', 'Min Exp.',
                            <input
                                type="number"
                                value={formData.experienceMin}
                                onChange={e => updateField('experienceMin', e.target.value)}
                                placeholder={fieldVisibility.experienceMin?.placeholder || '0'}
                                className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                            />
                        )}

                        {/* Experience Max */}
                        {renderFieldWithControls('experienceMax', 'Max Exp.',
                            <input
                                type="number"
                                value={formData.experienceMax}
                                onChange={e => updateField('experienceMax', e.target.value)}
                                placeholder={fieldVisibility.experienceMax?.placeholder || '0'}
                                className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                            />
                        )}

                        {/* Job Visibility */}
                        {renderFieldWithControls('visibility', 'Visibility',
                            <CustomSelect
                                value={formData.visibility || 'External'}
                                onChange={val => updateField('visibility', val)}
                                options={dropdownOptions.visibility.map(opt => ({ value: opt.split(' ')[0], label: opt }))}
                                triggerClassName={(open) => `w-full px-2 py-2 bg-white border ${open ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200'} rounded-lg text-[11px] font-bold outline-none transition-all flex items-center justify-between text-slate-700`}
                            />,
                            true
                        )}

                        {/* Priority Level */}
                        {renderFieldWithControls('priority', 'Priority',
                            <CustomSelect
                                value={formData.priority || 'Medium'}
                                onChange={val => updateField('priority', val)}
                                options={dropdownOptions.priority.map(opt => ({ value: opt, label: opt }))}
                                triggerClassName={(open) => `w-full px-2 py-2 bg-white border ${open ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200'} rounded-lg text-[11px] font-bold outline-none transition-all flex items-center justify-between text-slate-700`}
                            />,
                            true
                        )}

                        {/* Job Type */}
                        {renderFieldWithControls('grade', 'Grade',
                                <div className="relative">
                                    <select
                                        value={formData.grade || ''}
                                        onChange={(e) => updateField('grade', e.target.value)}
                                        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-4 pr-10 text-sm font-semibold text-slate-800 transition-all hover:bg-slate-50 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                                    >
                                        <option value="">Select Grade</option>
                                        {grades.map((g, i) => (
                                            <option key={i} value={g._id}>{g.name}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                        <ChevronDown size={16} className="text-slate-400" />
                                    </div>
                                </div>
                            )}
                        {renderFieldWithControls('jobType', 'Job Type',
                            <CustomSelect
                                value={formData.jobType || 'Full-Time'}
                                onChange={val => updateField('jobType', val)}
                                options={dropdownOptions.jobType.map(opt => ({ value: opt.split(' ')[0], label: opt }))}
                                triggerClassName={(open) => `w-full px-2 py-2 bg-white border ${open ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200'} rounded-lg text-[11px] font-bold outline-none transition-all flex items-center justify-between text-slate-700`}
                            />,
                            true
                        )}

                        {/* Work Mode */}
                        {renderFieldWithControls('workMode', 'Work Mode',
                            <CustomSelect
                                value={formData.workMode || 'On-site'}
                                onChange={val => updateField('workMode', val)}
                                options={dropdownOptions.workMode.map(opt => ({ value: opt, label: opt }))}
                                triggerClassName={(open) => `w-full px-2 py-2 bg-white border ${open ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200'} rounded-lg text-[11px] font-bold outline-none transition-all flex items-center justify-between text-slate-700`}
                            />,
                            true
                        )}

                        {/* Probation Period */}
                        {renderFieldWithControls('probationPeriod', 'Probation',
                            <input
                                type="number"
                                value={formData.probationPeriod || ''}
                                onChange={e => updateField('probationPeriod', e.target.value)}
                                placeholder={fieldVisibility.probationPeriod?.placeholder || 'Months'}
                                className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                            />
                        )}

                        {/* Notice Period */}
                        {renderFieldWithControls('noticePeriod', 'Notice Period (Days)',
                            <input
                                type="number"
                                value={formData.noticePeriod || ''}
                                onChange={e => updateField('noticePeriod', e.target.value)}
                                placeholder={fieldVisibility.noticePeriod?.placeholder || '30'}
                                className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                            />
                        )}

                    </div>



                    {/* Custom Fields Section */}
                    <div className="pt-[10px] flex flex-col gap-[10px] pb-0">
                        <div className="flex justify-end shrink-0">
                            <button
                                type="button"
                                onClick={addCustomField}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all"
                            >
                                <Plus size={16} />
                                Add Field
                            </button>
                        </div>

                        {customFields.length > 0 && (
                            <div className="flex flex-col gap-3 pb-0">
                                {customFields.map((field, index) => (
                                    <div key={field.id} className="p-4 bg-white border-2 border-slate-200 rounded-2xl space-y-3">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Field Label */}
                                                <input
                                                    type="text"
                                                    value={field.label}
                                                    onChange={e => updateCustomField(field.id, 'label', e.target.value)}
                                                    placeholder="Field Label"
                                                    className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                                />

                                                {/* Field Type */}
                                                <CustomSelect
                                                    value={field.type}
                                                    onChange={val => updateCustomField(field.id, 'type', val)}
                                                    options={[
                                                        { value: 'text', label: 'Text' },
                                                        { value: 'number', label: 'Number' },
                                                        { value: 'dropdown', label: 'Dropdown' },
                                                        { value: 'radio', label: 'Radio Button' },
                                                        { value: 'checkbox', label: 'Checkbox' }
                                                    ]}
                                                    triggerClassName={(open) => `w-full px-4 py-3 bg-slate-50 border ${open ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-slate-200'} rounded-xl text-sm font-bold flex items-center justify-between text-slate-700`}
                                                />

                                                {/* Public Checkbox */}
                                                <label className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={field.isPublic}
                                                        onChange={e => updateCustomField(field.id, 'isPublic', e.target.checked)}
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                                                    />
                                                    <span className="text-sm font-bold text-slate-700">Public Field</span>
                                                </label>
                                            </div>

                                            {/* Delete Button */}
                                            <button
                                                type="button"
                                                onClick={() => deleteCustomField(field.id)}
                                                className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>

                                        {/* Dropdown/Radio Options */}
                                        {(field.type === 'dropdown' || field.type === 'radio') && (
                                            <div className="pl-4 border-l-2 border-slate-200 space-y-2">
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Options</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => addCustomDropdownOption(field.id)}
                                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                                                    >
                                                        + Add Option
                                                    </button>
                                                </div>
                                                {field.options.map((option, optIdx) => (
                                                    <div key={optIdx} className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={option}
                                                            onChange={e => updateCustomDropdownOption(field.id, optIdx, e.target.value)}
                                                            placeholder={`Option ${optIdx + 1}`}
                                                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                                        />
                                                        {field.options.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteCustomDropdownOption(field.id, optIdx)}
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderStep3_Details = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
            <div className={isModal ? 'max-w-5xl mx-auto flex flex-col gap-[10px]' : 'w-full max-w-none flex flex-col gap-[10px]'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1 block flex items-center gap-2">
                            <Type size={14} className="text-indigo-500" /> Role Overview
                        </label>
                        <textarea value={formData.description} onChange={e => updateField('description', e.target.value)} rows={5} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 transition-all" placeholder="High-level mission for this role..." />

                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1 block flex items-center gap-2">
                            <Target size={14} className="text-rose-500" /> Responsibilities
                        </label>
                        <div className="space-y-2">
                            {formData.responsibilities.map((task, i) => (
                                <div key={i} className="flex gap-2">
                                    <input value={task} onChange={e => {
                                        const n = [...formData.responsibilities];
                                        n[i] = e.target.value;
                                        updateField('responsibilities', n);
                                    }} className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold" />
                                    <button type="button" onClick={() => updateField('responsibilities', formData.responsibilities.filter((_, idx) => idx !== i))} className="text-rose-500"><Trash2 size={14} /></button>
                                </div>
                            ))}
                            <button type="button" onClick={() => updateField('responsibilities', [...formData.responsibilities, 'New task...'])} className="w-full py-2 border border-dashed border-slate-300 rounded-xl text-[10px] font-bold text-slate-400 uppercase tracking-widest">+ Add Task</button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1 block flex items-center gap-2">
                            <Zap size={14} className="text-amber-500" /> Required Skills & Stack
                        </label>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 min-h-[100px]">
                            <div className="flex flex-wrap gap-2 mb-3">
                                {formData.requiredSkills.map((s, idx) => (
                                    <span key={typeof s === 'string' ? s : (s.id || s._id || idx)} className="px-2 py-1 bg-white border border-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1">
                                        {typeof s === 'string' ? s : (s.label || s.name || 'Skill')} <X size={10} className="cursor-pointer" onClick={() => updateField('requiredSkills', formData.requiredSkills.filter(x => x !== s))} />
                                    </span>
                                ))}
                            </div>
                            <input type="text" placeholder="Skill & Enter" onKeyDown={e => {
                                if (e.key === 'Enter' && e.target.value) {
                                    e.preventDefault();
                                    if (!formData.requiredSkills.includes(e.target.value)) updateField('requiredSkills', [...formData.requiredSkills, e.target.value]);
                                    e.target.value = '';
                                }
                            }} className="w-full bg-white px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 outline-none" />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1 block mb-2">Education & Certifications</label>
                            <input value={formData.education} onChange={e => updateField('education', e.target.value)} placeholder="Minimum Degree..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold mb-3" />
                            <div className="flex flex-wrap gap-2">
                                {formData.certifications.map((c, idx) => (
                                    <span key={typeof c === 'string' ? c : (c.id || c._id || idx)} className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-bold border border-amber-100 flex items-center gap-1">
                                        {typeof c === 'string' ? c : (c.label || c.name || 'Cert')} <X size={10} className="cursor-pointer" onClick={() => updateField('certifications', formData.certifications.filter(x => x !== c))} />
                                    </span>
                                ))}
                                <input placeholder="+ Add Certification & Enter" onKeyDown={e => {
                                    if (e.key === 'Enter' && e.target.value) {
                                        e.preventDefault();
                                        updateField('certifications', [...formData.certifications, e.target.value]);
                                        e.target.value = '';
                                    }
                                }} className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-400" />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1 block mb-2">Keywords for Matching</label>
                            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                {formData.keywords.map((k, idx) => (
                                    <span key={typeof k === 'string' ? k : (k.id || k._id || idx)} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold flex items-center gap-1">#{typeof k === 'string' ? k : (k.label || k.name || 'Keyword')} <X size={10} className="cursor-pointer" onClick={() => updateField('keywords', formData.keywords.filter(x => x !== k))} /></span>
                                ))}
                                <input placeholder="#Keyword & Enter" onKeyDown={e => {
                                    if (e.key === 'Enter' && e.target.value) {
                                        e.preventDefault();
                                        updateField('keywords', [...formData.keywords, e.target.value]);
                                        e.target.value = '';
                                    }
                                }} className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-400" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end border-t border-slate-100 py-[10px] shrink-0">
                    <button type="button" onClick={handleAIGenerate} disabled={isGeneratingAI} className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-6 py-2 rounded-2xl transition-all ${isGeneratingAI ? 'bg-slate-100 text-slate-400 border-none animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'}`}>
                        <Zap size={14} className={isGeneratingAI ? 'animate-spin' : 'fill-current'} />
                        {isGeneratingAI ? 'Processing AI Magic...' : '✨ Auto Generate JD'}
                    </button>
                </div>
            </div>
        </div>
    );


    const onDragEnd = (result) => {
        if (!result.destination) return;

        // We are dragging the subset (sliced 1 to -1)
        // so source.index 0 maps to workflow index 1
        const sourceIdx = result.source.index + 1;
        const destIdx = result.destination.index + 1;

        if (sourceIdx === destIdx) return;

        const newWorkflow = Array.from(workflow);
        const [moved] = newWorkflow.splice(sourceIdx, 1);
        newWorkflow.splice(destIdx, 0, moved);

        setWorkflow(newWorkflow);
    };

    const handleStageAdd = (stageData) => {
        // stageData: {name, feedbackTemplateId, mode, durationMinutes}
        // Find existing template to populate initial criteria if needed
        const template = templates.find(t => t._id === stageData.feedbackTemplateId);

        const newStage = {
            stageId: `stage_${Date.now()}`,
            stageName: stageData.name,
            feedbackFormId: stageData.feedbackTemplateId,
            // We use the template's structured criteria if available, else empty
            // Backend schema supports feedbackFormId reference
            evaluationCriteria: template ? template.criteria.map(c => c.label) : [],
            stageType: 'Interview',
            mode: stageData.mode || 'Online',
            durationMinutes: stageData.durationMinutes || 30,
            assignedInterviewers: [],
            assignedInterviewer: '',
            isSystemStage: false
        };

        const newWorkflow = [...workflow];
        // Insert before Finalized (last element)
        newWorkflow.splice(newWorkflow.length - 1, 0, newStage);
        setWorkflow(newWorkflow);
        setShowStageModal(false);
    };

    const deleteStage = (index) => {
        setWorkflow(workflow.filter((_, idx) => idx !== index));
    };

    const toggleStageLock = (stageIndex) => {
        setWorkflow((prev) => prev.map((stage, idx) => (
            idx === stageIndex ? { ...stage, locked: !stage.locked } : stage
        )));
    };

    const updateStageField = (stageIndex, field, value) => {
        setWorkflow((prev) => prev.map((stage, idx) => (
            idx === stageIndex ? { ...stage, [field]: value } : stage
        )));
    };

    const notifyInterviewerAssignment = async (employeeIdOrObject, stage) => {
        if (!employeeIdOrObject) return;
        
        let payload = {
            stageName: stage?.stageName || 'Interview Stage',
            mode: stage?.mode || 'Online',
            durationMinutes: stage?.durationMinutes || 30,
            jobTitle: formData.jobTitle || positionForm.jobTitle || 'Job Opening',
            department: formData.department || positionForm.department || '',
        };

        if (typeof employeeIdOrObject === 'object' && employeeIdOrObject.isExternal) {
            payload.isExternal = true;
            payload.externalName = employeeIdOrObject.name;
            payload.externalEmail = employeeIdOrObject.email;
        } else {
            payload.employeeId = employeeIdOrObject;
        }

        try {
            const res = await api.post('/requirements/interviewer-assignment-notify', payload);
            toast.success(res?.data?.emailSent ? 'Interviewer notified and emailed.' : 'Interviewer notified.');
        } catch (error) {
            console.error('Failed to notify interviewer', error);
            toast.error(error?.response?.data?.message || 'Interviewer selected, but notification/email failed.');
        }
    };

    const openTemplateBuilder = (index) => {
        const stage = workflow[index];
        setTemplateBuilderData({
            stageIndex: index,
            // Ideally we fetch the full template details if ID exists
            // For now passing basic info or fetching
            initialTemplate: {
                templateName: stage.stageName + ' Feedback',
                criteria: [] // Placeholder, would need to fetch actual criteria if editing existing
            }
        });
        // If stage has feedbackFormId, we should fetch it?
        // User asked for "Feedback Form Builder".
        // Let's allow creating a new template for this stage.
        setShowTemplateBuilder(true);
    };

    const handleTemplateSave = async (data) => {
        try {
            // Save as new template
            const res = await api.post('/feedback/template', {
                templateName: data.templateName,
                criteria: data.criteria
            });

            const newTemplate = res.data;
            setTemplates([...templates, newTemplate]);

            // Link to stage
            if (templateBuilderData) {
                const idx = templateBuilderData.stageIndex;
                const newWorkflow = [...workflow];
                newWorkflow[idx].feedbackFormId = newTemplate._id;
                newWorkflow[idx].evaluationCriteria = data.criteria.map(c => c.label); // Legacy sync
                setWorkflow(newWorkflow);
            }
            setShowTemplateBuilder(false);
            setTemplateBuilderData(null);
        } catch (e) {
            console.error(e);
        }
    };

    const updatePipelineFieldConfig = (fieldKey, key, value) => {
        setPipelineFieldConfig((prev) => ({
            ...prev,
            [fieldKey]: {
                ...DEFAULT_PIPELINE_FIELD_CONFIG[fieldKey],
                ...(prev[fieldKey] || {}),
                [key]: value
            }
        }));
    };

    const renderStep4_Pipeline = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
            <div className={isModal ? 'max-w-4xl mx-auto space-y-6 relative' : 'w-full max-w-none space-y-6 relative'}>
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setShowPipelineFieldCustomizer((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                    >
                        <Settings size={13} />
                        {showPipelineFieldCustomizer ? 'Close Field Customization' : 'Customize Fields'}
                    </button>
                </div>

                {showPipelineFieldCustomizer && (
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                            Hiring process controls (show, required, title)
                        </p>
                        <div className="space-y-2">
                            {PIPELINE_FIELD_KEYS.map((fieldKey) => (
                                <div key={fieldKey} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_auto_auto]">
                                    <input
                                        type="text"
                                        value={pipelineFieldConfig[fieldKey]?.label || ''}
                                        onChange={(e) => updatePipelineFieldConfig(fieldKey, 'label', e.target.value)}
                                        placeholder="Field title"
                                        className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    />
                                    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={pipelineFieldConfig[fieldKey]?.visible !== false}
                                            onChange={(e) => updatePipelineFieldConfig(fieldKey, 'visible', e.target.checked)}
                                        />
                                        Show
                                    </label>
                                    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={!!pipelineFieldConfig[fieldKey]?.required}
                                            onChange={(e) => updatePipelineFieldConfig(fieldKey, 'required', e.target.checked)}
                                        />
                                        Required
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Decorative Center Line */}
                <div className="absolute left-[2.45rem] top-6 bottom-6 w-0.5 bg-slate-100 rounded-full z-0"></div>

                {/* System Stage: Applied */}
                <div className={`flex items-center gap-6 p-4 border-2 border-dashed rounded-2xl relative z-10 transition-all ${workflow[0]?.locked !== false ? 'bg-slate-50 border-slate-100 opacity-75' : 'bg-white border-indigo-200 shadow-sm'}`}>
                    <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                        <Lock size={15} />
                    </div>
                    <div className="flex-1">
                        {workflow[0]?.locked === false ? (
                            <input
                                value={workflow[0]?.stageName && workflow[0]?.stageName !== 'Applied' ? workflow[0].stageName : 'Applied / Sourced'}
                                onChange={(e) => updateStageField(0, 'stageName', e.target.value)}
                                className="w-full bg-transparent p-0 text-base font-bold text-slate-800 outline-none focus:ring-0"
                            />
                        ) : (
                            <h4 className="font-bold text-slate-700">{workflow[0]?.stageName && workflow[0]?.stageName !== 'Applied' ? workflow[0].stageName : 'Applied / Sourced'}</h4>
                        )}
                        <p className={`text-[10px] uppercase font-bold ${workflow[0]?.locked === false ? 'text-indigo-500' : 'text-slate-400'}`}>
                            System Stage • {workflow[0]?.locked === false ? 'Unlocked' : 'Locked'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => toggleStageLock(0)}
                        className={`rounded-lg p-2 transition-all ${workflow[0]?.locked === false ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                        title={workflow[0]?.locked === false ? 'Lock stage' : 'Unlock stage'}
                        aria-label={workflow[0]?.locked === false ? 'Lock stage' : 'Unlock stage'}
                    >
                        {workflow[0]?.locked === false ? <Unlock size={16} /> : <Lock size={16} />}
                    </button>
                </div>

                {/* Editable Stages */}
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="pipeline-stages" direction="horizontal">
                        {(provided) => (
                            <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="flex gap-6 overflow-x-auto pb-4 my-4 relative z-10 items-start"
                            >
                                {workflow.map((stg, index) => {
                                    // Skip first (Applied) and last (Finalized) for rendering in draggable list
                                    if (index === 0 || index === workflow.length - 1) return null;

                                    // Draggable index logic
                                    // draggable index needs to be 0,1,2... for specific subset
                                    // We'll trust source.index matches render order

                                    // Actually, map index matches original array
                                    // We need to render ONLY the middle ones
                                    return (
                                        <Draggable key={stg.stageId || stg.id} draggableId={stg.stageId || stg.id} index={index - 1}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className={`w-[22rem] flex-shrink-0 relative flex flex-col gap-2 group transition-all ${snapshot.isDragging ? 'rotate-2 scale-102 z-50' : ''}`}
                                                >
                                                    {/* Visual Arrow Connector */}
                                                    {index < workflow.length - 2 && (
                                                        <div className="absolute top-[40%] -right-[1.1rem] z-0 text-indigo-300 pointer-events-none opacity-50 hidden md:block">
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                                        </div>
                                                    )}
                                                    <div
                                                        {...provided.dragHandleProps}
                                                        className="absolute top-4 right-4 text-slate-300 hover:text-indigo-500 cursor-grab active:cursor-grabbing z-20"
                                                    >
                                                        <GripVertical size={20} />
                                                    </div>

                                                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-100 mt-1">
                                                        {index}
                                                    </div>

                                                    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex-1">
                                                                {pipelineFieldConfig.stageName?.visible !== false && (
                                                                    <input
                                                                        value={stg.stageName}
                                                                        onChange={e => {
                                                                            const newWorkflow = [...workflow];
                                                                            newWorkflow[index].stageName = e.target.value;
                                                                            setWorkflow(newWorkflow);
                                                                        }}
                                                                        className="text-base font-bold text-slate-900 bg-transparent border-none p-0 focus:ring-0 w-full placeholder:text-slate-300"
                                                                        placeholder={pipelineFieldConfig.stageName?.label || 'Stage Name'}
                                                                    />
                                                                )}
                                                                <div className="mt-3 grid max-w-full grid-cols-2 gap-2">
                                                                    {pipelineFieldConfig.durationMinutes?.visible !== false && (
                                                                        <div className="min-w-0">
                                                                            <span className="mb-1 block text-[8px] font-black uppercase tracking-widest text-slate-400">Duration</span>
                                                                            <div className="flex h-8 items-center gap-1 rounded-lg bg-indigo-50/70 px-2">
                                                                                <Clock size={12} className="shrink-0 text-indigo-500" />
                                                                                <input
                                                                                    type="number"
                                                                                    value={stg.durationMinutes || 30}
                                                                                    onChange={e => {
                                                                                        const newWorkflow = [...workflow];
                                                                                        newWorkflow[index].durationMinutes = parseInt(e.target.value);
                                                                                        setWorkflow(newWorkflow);
                                                                                    }}
                                                                                    className="w-8 min-w-0 bg-transparent border-none p-0 text-[10px] font-bold text-indigo-700 focus:ring-0"
                                                                                />
                                                                                <span className="text-[10px] font-bold text-indigo-400">min</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {pipelineFieldConfig.mode?.visible !== false && (
                                                                        <div className="min-w-0">
                                                                            <span className="mb-1 block text-[8px] font-black uppercase tracking-widest text-slate-400">Mode</span>
                                                                            <CustomSelect
                                                                                value={stg.mode || 'Online'}
                                                                                onChange={val => {
                                                                                    const newWorkflow = [...workflow];
                                                                                    newWorkflow[index].mode = val;
                                                                                    setWorkflow(newWorkflow);
                                                                                }}
                                                                                options={[
                                                                                    { value: 'Online', label: 'Online' },
                                                                                    { value: 'In-person', label: 'In-person' }
                                                                                ]}
                                                                                triggerClassName={(open) => `h-8 w-full rounded-lg bg-slate-50 px-2 text-[10px] font-bold text-slate-700 border ${open ? 'border-indigo-200 ring-2 ring-indigo-500/10' : 'border-transparent'} focus:ring-0 flex items-center justify-between gap-2 cursor-pointer whitespace-nowrap`}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {/* Stage Type */}
                                                                    <div className="min-w-0 col-span-1">
                                                                        <span className="mb-1 block text-[8px] font-black uppercase tracking-widest text-slate-400">Stage Type</span>
                                                                        <CustomSelect
                                                                            value={stg.stageType || 'Interview'}
                                                                            onChange={val => {
                                                                                const newWorkflow = [...workflow];
                                                                                newWorkflow[index].stageType = val;
                                                                                setWorkflow(newWorkflow);
                                                                            }}
                                                                            options={[
                                                                                { value: 'Phone Screen', label: 'Phone Screen' },
                                                                                { value: 'Tech Assessment', label: 'Tech Assessment' },
                                                                                { value: 'Behavioral', label: 'Behavioral' },
                                                                                { value: 'Panel Interview', label: 'Panel Interview' },
                                                                                { value: 'Take-home', label: 'Take-home' },
                                                                                { value: 'Interview', label: 'General Interview' }
                                                                            ]}
                                                                            triggerClassName={(open) => `h-8 w-full rounded-lg bg-slate-50 px-2 text-[10px] font-bold text-slate-700 border ${open ? 'border-indigo-200 ring-2 ring-indigo-500/10' : 'border-transparent'} focus:ring-0 flex items-center justify-between gap-2 cursor-pointer whitespace-nowrap`}
                                                                        />
                                                                    </div>
                                                                    
                                                                    {/* Dynamic Meeting Link / Location */}
                                                                    <div className="min-w-0 col-span-1">
                                                                        <span className="mb-1 block text-[8px] font-black uppercase tracking-widest text-slate-400">
                                                                            {stg.mode === 'In-person' ? 'Location / Room' : 'Meeting Link'}
                                                                        </span>
                                                                        <input
                                                                            type="text"
                                                                            value={stg.mode === 'In-person' ? (stg.location || '') : (stg.meetingLink || '')}
                                                                            onChange={e => {
                                                                                const newWorkflow = [...workflow];
                                                                                if (stg.mode === 'In-person') {
                                                                                    newWorkflow[index].location = e.target.value;
                                                                                } else {
                                                                                    newWorkflow[index].meetingLink = e.target.value;
                                                                                }
                                                                                setWorkflow(newWorkflow);
                                                                            }}
                                                                            className="w-full h-8 bg-slate-50 border border-slate-100 rounded-lg px-2 text-[10px] font-bold text-slate-700 focus:border-indigo-200 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
                                                                            placeholder={stg.mode === 'In-person' ? 'e.g. Room A' : 'e.g. Zoom link'}
                                                                        />
                                                                    </div>
                                                                    
                                                                    {/* Focus Area */}
                                                                    <div className="min-w-0 col-span-2">
                                                                        <span className="mb-1 block text-[8px] font-black uppercase tracking-widest text-slate-400">Focus Area / Instructions</span>
                                                                        <textarea
                                                                            value={stg.focusArea || ''}
                                                                            onChange={e => {
                                                                                const newWorkflow = [...workflow];
                                                                                newWorkflow[index].focusArea = e.target.value;
                                                                                setWorkflow(newWorkflow);
                                                                            }}
                                                                            className="w-full h-12 resize-none bg-slate-50 border border-slate-100 rounded-lg p-2 text-[10px] font-bold text-slate-700 focus:border-indigo-200 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all custom-scrollbar"
                                                                            placeholder="e.g., Focus on React Hooks, assess cultural fit..."
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteStage(index)}
                                                                className="text-slate-300 hover:text-rose-500 p-2 rounded-xl hover:bg-rose-50 transition-all"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>

                                                        <div className="space-y-3 pt-3 border-t border-slate-100">
                                                            {pipelineFieldConfig.assignedInterviewer?.visible !== false && (
                                                                <div>
                                                                    <label className="text-[10px] font-semibold text-slate-500 block mb-1">{pipelineFieldConfig.assignedInterviewer?.label || 'Interviewer'}</label>
                                                                    <div className="space-y-2">
                                                                        {(Array.isArray(stg.assignedInterviewers) && stg.assignedInterviewers.length > 0 ? stg.assignedInterviewers : [stg.assignedInterviewer || '']).map((intData, intIdx) => {
                                                                            const isExt = typeof intData === 'object' && intData.isExternal;
                                                                            const intId = isExt ? '' : intData;
                                                                            const emp = !isExt ? employees.find(e => e._id === intId) : null;
                                                                            
                                                                            return (
                                                                                <div key={intIdx} className="space-y-1 bg-slate-50/50 p-1.5 rounded-xl border border-slate-100/50">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <div className="flex-1 min-w-0">
                                                                                            {isExt ? (
                                                                                                <div className="flex flex-col gap-1.5">
                                                                                                    <input 
                                                                                                        type="text"
                                                                                                        placeholder="External Name"
                                                                                                        value={intData.name || ''}
                                                                                                        onChange={(e) => {
                                                                                                            const newWorkflow = [...workflow];
                                                                                                            const currentInterviewers = Array.isArray(newWorkflow[index].assignedInterviewers) ? [...newWorkflow[index].assignedInterviewers] : [newWorkflow[index].assignedInterviewer || ''];
                                                                                                            currentInterviewers[intIdx] = { ...intData, name: e.target.value };
                                                                                                            newWorkflow[index].assignedInterviewers = currentInterviewers;
                                                                                                            setWorkflow(newWorkflow);
                                                                                                        }}
                                                                                                        className="w-full h-8 bg-white border border-slate-200 rounded-lg px-2 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                                                                                                    />
                                                                                                    <input 
                                                                                                        type="email"
                                                                                                        placeholder="External Email"
                                                                                                        value={intData.email || ''}
                                                                                                        onChange={(e) => {
                                                                                                            const newWorkflow = [...workflow];
                                                                                                            const currentInterviewers = Array.isArray(newWorkflow[index].assignedInterviewers) ? [...newWorkflow[index].assignedInterviewers] : [newWorkflow[index].assignedInterviewer || ''];
                                                                                                            currentInterviewers[intIdx] = { ...intData, email: e.target.value };
                                                                                                            newWorkflow[index].assignedInterviewers = currentInterviewers;
                                                                                                            setWorkflow(newWorkflow);
                                                                                                        }}
                                                                                                        onBlur={() => {
                                                                                                            if (intData.email && intData.name) {
                                                                                                                notifyInterviewerAssignment(intData, workflow[index]);
                                                                                                            }
                                                                                                        }}
                                                                                                        className="w-full h-8 bg-white border border-slate-200 rounded-lg px-2 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                                                                                                    />
                                                                                                </div>
                                                                                            ) : (
                                                                                                <CustomSelect
                                                                                                    value={intId || ''}
                                                                                                    onChange={(val) => {
                                                                                                        const newWorkflow = [...workflow];
                                                                                                        const currentInterviewers = Array.isArray(newWorkflow[index].assignedInterviewers)
                                                                                                            ? [...newWorkflow[index].assignedInterviewers]
                                                                                                            : [newWorkflow[index].assignedInterviewer || ''];
                                                                                                        currentInterviewers[intIdx] = val;
                                                                                                        newWorkflow[index].assignedInterviewers = currentInterviewers.filter(Boolean);
                                                                                                        newWorkflow[index].assignedInterviewer = currentInterviewers[0] || '';
                                                                                                        setWorkflow(newWorkflow);
                                                                                                        if (val) {
                                                                                                            notifyInterviewerAssignment(val, newWorkflow[index]);
                                                                                                        }
                                                                                                    }}
                                                                                                    options={employeeOptions}
                                                                                                    placeholder="Select interviewer..."
                                                                                                    triggerClassName={(open) => `w-full bg-white border ${open ? 'border-indigo-300 ring-2 ring-indigo-500/10' : 'border-slate-200'} rounded-lg py-1 px-2 text-[10px] font-bold text-slate-700 outline-none transition-all flex items-center justify-between cursor-pointer`}
                                                                                                />
                                                                                            )}
                                                                                        </div>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                const newWorkflow = [...workflow];
                                                                                                const currentInterviewers = Array.isArray(newWorkflow[index].assignedInterviewers)
                                                                                                    ? [...newWorkflow[index].assignedInterviewers]
                                                                                                    : [newWorkflow[index].assignedInterviewer || ''];
                                                                                                currentInterviewers[intIdx] = isExt ? '' : { isExternal: true, name: '', email: '' };
                                                                                                newWorkflow[index].assignedInterviewers = currentInterviewers;
                                                                                                setWorkflow(newWorkflow);
                                                                                            }}
                                                                                            className={`p-1 rounded-lg transition-colors border border-transparent shrink-0 ${isExt ? 'text-indigo-500 hover:bg-indigo-50 hover:border-indigo-100' : 'text-slate-400 hover:bg-slate-100'}`}
                                                                                            title={isExt ? "Switch to Internal Employee" : "Add External Interviewer"}
                                                                                        >
                                                                                            <User size={13} />
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                const newWorkflow = [...workflow];
                                                                                                const currentInterviewers = Array.isArray(newWorkflow[index].assignedInterviewers)
                                                                                                    ? [...newWorkflow[index].assignedInterviewers]
                                                                                                    : [newWorkflow[index].assignedInterviewer || ''];
                                                                                                currentInterviewers.splice(intIdx, 1);
                                                                                                newWorkflow[index].assignedInterviewers = currentInterviewers.filter(Boolean);
                                                                                                newWorkflow[index].assignedInterviewer = currentInterviewers[0] || '';
                                                                                                setWorkflow(newWorkflow);
                                                                                            }}
                                                                                            className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg transition-colors border border-transparent hover:border-rose-100 shrink-0"
                                                                                        >
                                                                                            <Trash2 size={13} />
                                                                                        </button>
                                                                                    </div>
                                                                                    {emp && !isExt && (
                                                                                        <div className="text-[9px] font-medium text-slate-500 px-2 py-1 flex flex-col gap-0.5 leading-relaxed bg-white/80 border border-slate-100/50 rounded-lg shadow-sm">
                                                                                            <div className="font-bold text-slate-700">{getEmployeeDisplayName(emp)} ({getEmployeeCode(emp) || 'N/A'})</div>
                                                                                            <div>Dept: {getEmployeeDepartment(emp) || 'N/A'} • Desig: {getEmployeeDesignation(emp) || 'N/A'}</div>
                                                                                            <div className="text-slate-400 font-mono truncate">{emp.email || 'N/A'}</div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const newWorkflow = [...workflow];
                                                                                const currentInterviewers = Array.isArray(newWorkflow[index].assignedInterviewers)
                                                                                    ? [...newWorkflow[index].assignedInterviewers]
                                                                                    : [newWorkflow[index].assignedInterviewer || ''];
                                                                                currentInterviewers.push('');
                                                                                newWorkflow[index].assignedInterviewers = currentInterviewers;
                                                                                setWorkflow(newWorkflow);
                                                                            }}
                                                                            className="w-full py-1.5 border border-dashed border-indigo-200 rounded-lg text-[9px] font-bold text-indigo-500 hover:bg-indigo-50/50 flex items-center justify-center gap-1 uppercase tracking-wider transition-all"
                                                                        >
                                                                            <Plus size={10} /> Add Another Interviewer
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            {/* Auto-Notify Candidate Toggle */}
                                                            <div className="flex items-center justify-between bg-indigo-50/50 p-2 rounded-xl border border-indigo-100/50">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-bold text-indigo-900">Auto-Notify Candidate</span>
                                                                    <span className="text-[8px] font-medium text-indigo-500">Send email when candidate reaches this stage</span>
                                                                </div>
                                                                <label className="relative inline-flex items-center cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={stg.autoNotifyCandidate || false}
                                                                        onChange={(e) => {
                                                                            const newWorkflow = [...workflow];
                                                                            newWorkflow[index].autoNotifyCandidate = e.target.checked;
                                                                            setWorkflow(newWorkflow);
                                                                        }}
                                                                        className="sr-only peer"
                                                                    />
                                                                    <div className="w-7 h-4 bg-indigo-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[12px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-indigo-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                                                </label>
                                                            </div>

                                                            {pipelineFieldConfig.feedbackFormId?.visible !== false && (
                                                                <div>
                                                                    <label className="text-[10px] font-semibold text-slate-500 block mb-1">{pipelineFieldConfig.feedbackFormId?.label || 'Feedback Form'}</label>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openTemplateBuilder(index)}
                                                                        className={`w-full text-left bg-slate-50 border border-slate-100 rounded-lg py-2 px-3 text-xs font-bold flex items-center justify-between hover:bg-white hover:border-indigo-300 transition-all ${stg.feedbackFormId ? 'text-emerald-600 border-emerald-100' : 'text-slate-500'}`}
                                                                    >
                                                                        {stg.feedbackFormId ? (templates.find(t => t._id === stg.feedbackFormId)?.templateName || 'Configured') : 'Select / Build Template'}
                                                                        <Settings size={14} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    );
                                })}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>

                <button
                    type="button"
                    onClick={() => setShowStageModal(true)}
                    className="w-full py-[10px] border-2 border-dashed border-indigo-200 rounded-xl flex items-center justify-center gap-2 text-indigo-500 text-sm font-bold hover:bg-indigo-50/50 hover:border-indigo-300 transition-all group relative z-10"
                >
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                        <Plus size={14} />
                    </div>
                    Add Interview Stage
                </button>

                {/* System Stage: Finalized */}
                <div className={`flex items-center gap-6 p-4 border-2 border-dashed rounded-2xl mt-8 relative z-10 transition-all ${workflow[workflow.length - 1]?.locked !== false ? 'bg-emerald-50 border-emerald-100 opacity-75' : 'bg-white border-emerald-200 shadow-sm'}`}>
                    <div className="w-10 h-10 rounded-xl bg-emerald-200 flex items-center justify-center text-emerald-600 font-bold">
                        <Check size={16} />
                    </div>
                    <div className="flex-1">
                        {workflow[workflow.length - 1]?.locked === false ? (
                            <input
                                value={workflow[workflow.length - 1]?.stageName && workflow[workflow.length - 1]?.stageName !== 'Finalized' ? workflow[workflow.length - 1].stageName : 'Hired / Finalized'}
                                onChange={(e) => updateStageField(workflow.length - 1, 'stageName', e.target.value)}
                                className="w-full bg-transparent p-0 text-base font-bold text-emerald-800 outline-none focus:ring-0"
                            />
                        ) : (
                            <h4 className="font-bold text-emerald-800">{workflow[workflow.length - 1]?.stageName && workflow[workflow.length - 1]?.stageName !== 'Finalized' ? workflow[workflow.length - 1].stageName : 'Hired / Finalized'}</h4>
                        )}
                        <p className="text-[10px] uppercase font-bold text-emerald-500">
                            System Stage • {workflow[workflow.length - 1]?.locked === false ? 'Unlocked' : 'Locked'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => toggleStageLock(workflow.length - 1)}
                        className={`rounded-lg p-2 transition-all ${workflow[workflow.length - 1]?.locked === false ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'text-emerald-400 hover:bg-emerald-100 hover:text-emerald-700'}`}
                        title={workflow[workflow.length - 1]?.locked === false ? 'Lock stage' : 'Unlock stage'}
                        aria-label={workflow[workflow.length - 1]?.locked === false ? 'Lock stage' : 'Unlock stage'}
                    >
                        {workflow[workflow.length - 1]?.locked === false ? <Unlock size={16} /> : <Lock size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStep5_Review = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
            <div className={isModal ? 'max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8' : 'w-full max-w-none grid grid-cols-1 lg:grid-cols-3 gap-8'}>
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{formData.department} • {formData.jobType}</span>
                                <h3 className="text-3xl font-bold text-slate-900 mt-1 uppercase leading-none">{formData.jobTitle}</h3>
                            </div>
                            <div className="px-4 py-2 bg-indigo-50/50 text-indigo-600 rounded-xl text-[10px] font-bold uppercase">
                                Priority: {formData.priority}
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">{formData.description}</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-slate-50">
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Vacancies</p>
                                <p className="text-sm font-bold text-slate-800">{formData.vacancy}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Experience</p>
                                <p className="text-sm font-bold text-slate-800">{formData.experienceMin}-{formData.experienceMax} Yrs</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Location</p>
                                <p className="text-sm font-bold text-slate-800">{formData.workMode}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Visibility</p>
                                <p className="text-sm font-bold text-slate-800">{formData.visibility}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Layers size={14} className="text-indigo-500" /> Hiring Stages
                        </h4>
                        <div className="space-y-4">
                            {workflow.map((stg, i) => (
                                <div key={i} className="flex items-center gap-4 group">
                                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800 leading-tight">{typeof stg.stageName === 'string' ? stg.stageName : (stg.stageName?.toString() || 'Stage')}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">{stg.mode} • {stg.durationMinutes}m</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Shield size={14} className="text-indigo-500" /> BGV & Onboarding Configuration
                        </h4>

                        <div className="space-y-6">
                            {/* BGV Toggle */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Background Verification (BGV)</p>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Enable automated background checks for this role</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.bgvConfig.isEnabled}
                                        onChange={(e) => updateField('bgvConfig', { ...formData.bgvConfig, isEnabled: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            {formData.bgvConfig.isEnabled && (
                                <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                                    {/* Trigger Stage */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">Trigger BGV When?</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => updateField('bgvConfig', { ...formData.bgvConfig, triggerStage: 'POST_OFFER' })}
                                                className={`px-4 py-3 rounded-xl text-xs font-bold border transition-all ${formData.bgvConfig.triggerStage === 'POST_OFFER' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                Post-Offer Acceptance
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateField('bgvConfig', { ...formData.bgvConfig, triggerStage: 'POST_JOINING' })}
                                                className={`px-4 py-3 rounded-xl text-xs font-bold border transition-all ${formData.bgvConfig.triggerStage === 'POST_JOINING' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                Post-Joining Date
                                            </button>
                                        </div>
                                    </div>

                                    {/* Check Types */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">Verifications Required</label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {[
                                                'IDENTITY', 'ADDRESS', 'EMPLOYMENT', 'EDUCATION', 'CRIMINAL', 'REFERENCE', 'SOCIAL_MEDIA',
                                                ...formData.bgvConfig.checks.filter(c => !['IDENTITY', 'ADDRESS', 'EMPLOYMENT', 'EDUCATION', 'CRIMINAL', 'REFERENCE', 'SOCIAL_MEDIA'].includes(c))
                                            ].map(check => {
                                                const checkLabel = check.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
                                                const isSelected = formData.bgvConfig.checks.includes(check);
                                                const isCustom = !['IDENTITY', 'ADDRESS', 'EMPLOYMENT', 'EDUCATION', 'CRIMINAL', 'REFERENCE', 'SOCIAL_MEDIA'].includes(check);

                                                return (
                                                    <div key={check} className="relative group">
                                                        <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all min-h-[60px] ${isSelected ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    const newChecks = e.target.checked
                                                                        ? [...formData.bgvConfig.checks, check]
                                                                        : formData.bgvConfig.checks.filter(c => c !== check);
                                                                    updateField('bgvConfig', { ...formData.bgvConfig, checks: newChecks });
                                                                }}
                                                            />
                                                            <span className={`text-[11px] font-bold leading-tight ${isSelected ? 'text-emerald-700' : 'text-slate-600'}`}>{checkLabel}</span>
                                                        </label>
                                                        {isCustom && (
                                                            <button
                                                                onClick={() => {
                                                                    const newChecks = formData.bgvConfig.checks.filter(c => c !== check);
                                                                    updateField('bgvConfig', { ...formData.bgvConfig, checks: newChecks });
                                                                }}
                                                                className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* Add Custom Check Card */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCustomBGVCheck('');
                                                    setShowCustomModal(true);
                                                }}
                                                className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-400 hover:text-indigo-600 transition-all min-h-[60px] group"
                                            >
                                                <Plus size={16} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest">Add Custom Check</span>
                                            </button>

                                            {/* Ant Design Modal for Custom Check Name */}
                                            {showCustomModal && createPortal(
                                                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                                                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                                                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                                                    <Shield size={20} />
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Custom Verification</h3>
                                                                    <p className="text-[10px] font-bold text-indigo-600/70 uppercase tracking-widest">Define new check type</p>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => setShowCustomModal(false)} className="p-2 hover:bg-white rounded-lg text-slate-400 transition-colors">
                                                                <X size={18} />
                                                            </button>
                                                        </div>
                                                        <div className="p-8">
                                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Check Name</label>
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                value={customBGVCheck}
                                                                onChange={(e) => setCustomBGVCheck(e.target.value)}
                                                                placeholder="e.g. MEDICAL_CHECK, ASSET_RECOVERY..."
                                                                className="w-full h-12 px-4 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all outline-none uppercase tracking-wider"
                                                            />
                                                            <p className="mt-3 text-[10px] font-medium text-slate-400 px-1 italic">
                                                                * This check will be added to the job verification requirements.
                                                            </p>
                                                        </div>
                                                        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                                                            <button
                                                                onClick={() => setShowCustomModal(false)}
                                                                className="flex-1 px-6 py-3 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    handleAddCustomCheck();
                                                                    setShowCustomModal(false);
                                                                }}
                                                                disabled={!customBGVCheck.trim()}
                                                                className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                                                            >
                                                                Add Verification
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>,
                                                document.body
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Onboarding Template */}
                            <div className="pt-4 border-t border-slate-50">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">Onboarding Workflow</label>
                                <CustomSelect
                                    value={formData.onboardingConfig.templateId}
                                    onChange={(val) => updateField('onboardingConfig', { ...formData.onboardingConfig, templateId: val })}
                                    options={onboardingTemplates.map(t => ({ value: t._id, label: t.name }))}
                                    placeholder="Select Onboarding Template..."
                                    triggerClassName={(open) => `w-full bg-slate-50 border ${open ? 'border-indigo-300 ring-4 ring-indigo-500/10' : 'border-slate-100'} rounded-2xl py-3 px-4 text-xs font-bold text-slate-700 outline-none transition-all flex items-center justify-between cursor-pointer`}
                                />
                                <p className="mt-2 text-[9px] text-slate-400 font-medium px-1 uppercase tracking-tight">Select the template to use for new hires for this position.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const requirementFormStepTitle = (() => {
        if (isEdit) {
            const titles = { 2: 'Job Details', 3: 'Job Description', 4: 'Hiring Process', 5: 'Review & Post' };
            return titles[step] ?? 'Edit Job Opening';
        }
        const titles = { 1: 'New Job Opening', 2: 'Job Details', 3: 'Job Description', 4: 'Hiring Process', 5: 'Review & Post' };
        return titles[step] ?? 'New Job Opening';
    })();

    const content = (
        <div className={`flex flex-col bg-white dark:bg-slate-950 font-sans min-h-0 ${isModal ? 'flex-1 h-full min-h-0 overflow-hidden' : ''}`}>
            {/* Nav Header */}
            <div className="px-8 py-4 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-950/90 backdrop-blur-xl z-20 shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{requirementFormStepTitle}</h1>
                </div>
                <div className="flex items-center gap-3 sm:gap-6">
                    <div className="hidden md:flex items-center gap-2">
                        {(isEdit ? [2, 3, 5] : [1, 2, 3, 5]).map(s => (
                            <div key={s} className={`w-2 h-2 rounded-full transition-all duration-500 ${step === s ? 'w-8 bg-indigo-600' : 'bg-slate-200 dark:bg-slate-600'}`}></div>
                        ))}
                    </div>
                    {isModal && (
                        <>
                            <button
                                type="button"
                                onClick={() => setModalFullScreen((v) => !v)}
                                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-900 rounded-none border border-slate-200 dark:border-slate-700 transition-all shrink-0"
                                title={modalFullScreen ? 'Exit full screen (show sidebar)' : 'Full screen (hide sidebar)'}
                                aria-label={modalFullScreen ? 'Exit full screen' : 'Enter full screen'}
                            >
                                {modalFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>
                            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-900 rounded-none border border-slate-200 dark:border-slate-700 transition-all shrink-0" aria-label="Close"><X size={20} /></button>
                        </>
                    )}
                </div>
            </div>

            {/* Main scroll Area — full page: bottom padding for fixed footer; modal: flex-1 fills dialog */}
            <div className={`${isModal ? 'flex-1 min-h-0 overflow-y-auto' : 'overflow-y-visible'} ${isModal ? 'px-8 pb-3 pt-0' : 'px-4 sm:px-6 lg:px-8 pt-0 pb-24 lg:pb-28'} custom-scrollbar`}>
                <div className="w-full">
                    {step === 1 && renderStep1_Position()}
                    {step === 2 && renderStep2_Config()}
                    {step === 3 && renderStep3_Details()}
                    {step === 4 && renderStep4_Pipeline()}
                    {step === 5 && renderStep5_Review()}
                </div>
            </div>

            {/* Footer Control — full page: fixed to viewport bottom (align with HrLayout sidebar width); modal: sticky in dialog */}
            <div
                className={
                    isModal
                        ? 'px-4 sm:px-8 py-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex justify-between items-center z-20 shrink-0'
                        : 'pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] border-t border-slate-200/80 bg-white/95 backdrop-blur-lg flex justify-between items-center z-[25] shrink-0 fixed bottom-0 left-0 right-0 lg:left-[var(--hr-sidebar-width,0px)]'
                }
            >
                <button type="button" onClick={handleBack} disabled={isEdit ? step === 2 : step === 1} className="pl-0 pr-6 py-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-0 transition-all flex items-center gap-2 group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back
                </button>

                {showCurrentEmployeeStats && (
                    <div className="mx-3 grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <Building2 size={15} className="text-indigo-600" />
                            <div className="min-w-0">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Current Department Employees</p>
                                <p className="truncate text-sm font-black text-slate-900">{currentEmployeeStats.department}</p>
                            </div>
                        </div>
                        <div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <Users size={15} className="text-emerald-600" />
                            <div className="min-w-0">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Current Designation Employees</p>
                                <p className="truncate text-sm font-black text-slate-900">{currentEmployeeStats.designation}</p>
                            </div>
                        </div>
                    </div>
                )}

                {step < 5 ? (
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={saveDraftForCurrentStep}
                            disabled={saving}
                            className={`px-6 py-4 border border-slate-300 text-slate-700 bg-white ${isModal ? 'rounded-none' : 'rounded-2xl'} text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-70`}
                        >
                            Save Draft
                        </button>
                        <button type="button" onClick={handleNext} disabled={saving} className={`px-12 py-4 bg-slate-900 dark:bg-slate-800 text-white ${isModal ? 'rounded-none' : 'rounded-2xl'} text-xs font-bold uppercase tracking-widest hover:bg-indigo-600 hover:shadow-2xl hover:shadow-indigo-100 transition-all flex items-center gap-4 group active:scale-95 shadow-xl shadow-slate-200 disabled:opacity-70`}>
                            Next Step
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                ) : (
                    <button type="button" onClick={submit} disabled={saving} className={`px-12 py-4 bg-emerald-500 text-white ${isModal ? 'rounded-none' : 'rounded-2xl'} text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 hover:shadow-2xl hover:shadow-emerald-100 transition-all flex items-center gap-4 group active:scale-95 shadow-xl shadow-emerald-200 disabled:opacity-70`}>
                        {saving ? 'Publishing...' : 'Confirm & Publish'}
                        <Check size={20} strokeWidth={3} />
                    </button>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}} />

            {/* Stage Modal */}
            {showStageModal && (
                <StageModal
                    visible={showStageModal}
                    onCancel={() => setShowStageModal(false)}
                    onSave={handleStageAdd}
                    templates={templates}
                    onCreateTemplate={() => {
                        setTemplateBuilderData(null);
                        setShowTemplateBuilder(true);
                    }}
                />
            )}

            {/* Feedback Template Builder Override */}
            {showTemplateBuilder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-2xl">
                        <FeedbackTemplateBuilder
                            initialTemplate={templateBuilderData?.initialTemplate}
                            onSave={handleTemplateSave}
                            onCancel={() => setShowTemplateBuilder(false)}
                        />
                    </div>
                </div>
            )}

            {positionModalOpen && createPortal(
                <div className="fixed inset-0 z-[200] flex items-start justify-center bg-slate-950/45 p-4 py-8 backdrop-blur-sm overflow-y-auto custom-scrollbar">
                    <div className="w-full max-w-2xl rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-2xl my-auto sm:my-8">
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                                    <Plus size={18} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 leading-tight">Create Position</h3>
                                    <p className="mt-0.5 text-xs text-slate-500">Create position first, then continue new job opening.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPositionModalOpen(false)}
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mb-3 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowPositionFieldCustomizer((prev) => !prev)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                            >
                                <Settings size={20} />
                                {showPositionFieldCustomizer ? 'Close Field Customization' : 'Customize Fields'}
                            </button>
                        </div>

                        {showPositionFieldCustomizer && (
                            <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                                    Field controls (show, required, title, placeholder)
                                </p>
                                <div className="space-y-2">
                                    {POSITION_FIELD_KEYS.map((fieldKey) => (
                                        <div key={fieldKey} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto_auto]">
                                            <input
                                                type="text"
                                                value={positionFieldConfig[fieldKey]?.label || ''}
                                                onChange={(e) => updatePositionFieldConfig(fieldKey, 'label', e.target.value)}
                                                placeholder="Field title"
                                                className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                            />
                                            <input
                                                type="text"
                                                value={positionFieldConfig[fieldKey]?.placeholder || ''}
                                                onChange={(e) => updatePositionFieldConfig(fieldKey, 'placeholder', e.target.value)}
                                                placeholder="Placeholder"
                                                className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"
                                                disabled={fieldKey === 'status' || fieldKey === 'hiringStatus' || fieldKey === 'isReplacement'}
                                            />
                                            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                                                <input
                                                    type="checkbox"
                                                    checked={!!positionFieldConfig[fieldKey]?.visible}
                                                    onChange={(e) => updatePositionFieldConfig(fieldKey, 'visible', e.target.checked)}
                                                />
                                                Show
                                            </label>
                                            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                                                <input
                                                    type="checkbox"
                                                    checked={!!positionFieldConfig[fieldKey]?.required}
                                                    onChange={(e) => updatePositionFieldConfig(fieldKey, 'required', e.target.checked)}
                                                />
                                                Required
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {isPositionFieldVisible('department') && (
                                <div>
                                    {renderDepartmentField({
                                        label: positionFieldConfig.department?.label || 'Department',
                                        required: positionFieldConfig.department?.required,
                                        placeholder: positionFieldConfig.department?.placeholder || 'Assign to unit',
                                        labelClassName: "mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-400"
                                    })}
                                </div>
                            )}

                            {isPositionFieldVisible('jobTitle') && (
                                <div>
                                    {renderDesignationField({
                                        label: 'Designation',
                                        required: positionFieldConfig.jobTitle?.required,
                                        placeholder: positionFieldConfig.jobTitle?.placeholder || 'Select designation',
                                        labelClassName: "mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-400"
                                    })}
                                </div>
                            )}


                            {isPositionFieldVisible('isReplacement') && (
                                <div>
                                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                                        {positionFieldConfig.isReplacement?.label || 'Reason for Hire'} {positionFieldConfig.isReplacement?.required ? '*' : ''}
                                    </label>
                                    <select
                                        value={String(positionForm.isReplacement)}
                                        onChange={(e) => setPositionForm((prev) => ({ ...prev, isReplacement: e.target.value === 'true' }))}
                                        className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    >
                                        <option value="false">New Role</option>
                                        <option value="true">Backfill</option>
                                    </select>
                                </div>
                            )}
                            {isPositionFieldVisible('budgetedCount') && (
                                <div>
                                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                                        {positionFieldConfig.budgetedCount?.label || 'Headcount'} {positionFieldConfig.budgetedCount?.required ? '*' : ''}
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={positionForm.budgetedCount || 1}
                                        onChange={(e) => setPositionForm((prev) => ({ ...prev, budgetedCount: parseInt(e.target.value, 10) || 1 }))}
                                        placeholder={positionFieldConfig.budgetedCount?.placeholder || '1'}
                                        className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Target Compensation Range (LPA)</p>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {isPositionFieldVisible('baseSalaryMin') && (
                                    <div>
                                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                                            {positionFieldConfig.baseSalaryMin?.label || 'Min Base'} {positionFieldConfig.baseSalaryMin?.required ? '*' : ''}
                                        </label>
                                        <input
                                            type="number"
                                            value={positionForm.baseSalaryRange.min}
                                            onChange={(e) =>
                                                setPositionForm((prev) => ({
                                                    ...prev,
                                                    baseSalaryRange: { ...prev.baseSalaryRange, min: e.target.value }
                                                }))
                                            }
                                            placeholder={positionFieldConfig.baseSalaryMin?.placeholder || '0'}
                                            className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                )}
                                {isPositionFieldVisible('baseSalaryMax') && (
                                    <div>
                                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                                            {positionFieldConfig.baseSalaryMax?.label || 'Max Base'} {positionFieldConfig.baseSalaryMax?.required ? '*' : ''}
                                        </label>
                                        <input
                                            type="number"
                                            value={positionForm.baseSalaryRange.max}
                                            onChange={(e) =>
                                                setPositionForm((prev) => ({
                                                    ...prev,
                                                    baseSalaryRange: { ...prev.baseSalaryRange, max: e.target.value }
                                                }))
                                            }
                                            placeholder={positionFieldConfig.baseSalaryMax?.placeholder || '0'}
                                            className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-2.5">
                            <div className="rounded-lg bg-indigo-600 p-2 text-white">
                                <Check size={16} />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-indigo-900">
                                    Next ID: <span className="rounded-md border border-indigo-200 bg-white px-2 py-1 font-mono text-indigo-700">{nextPositionId || 'Loading...'}</span>
                                </div>
                                <div className="text-xs text-indigo-700/80">Auto-generated by org config.</div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setPositionModalOpen(false)}
                                className="rounded-xl border border-slate-200 px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-500 transition hover:bg-slate-50"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={createPositionAndSelect}
                                disabled={creatingPosition}
                                className="rounded-xl bg-indigo-500 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-600 disabled:opacity-70"
                            >
                                {creatingPosition ? 'Creating...' : 'Finalize Position'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );

    if (!isModal) return content;

    return createPortal(
        modalFullScreen ? (
            <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-white dark:bg-slate-950 animate-in fade-in duration-200">
                <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden rounded-none border-0 shadow-none">
                    {content}
                </div>
            </div>
        ) : (
            <div className="fixed top-14 sm:top-20 left-0 right-0 bottom-0 z-[55] lg:left-[var(--hr-sidebar-width)] box-border flex flex-col bg-slate-100 dark:bg-[#0F172A] pointer-events-auto animate-in fade-in duration-200">
                <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden rounded-none border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-lg m-[15px] mb-0" style={{width: 'calc(100% - 30px)'}}>
                    {content}
                </div>
            </div>
        ),
        document.body
    );
}
