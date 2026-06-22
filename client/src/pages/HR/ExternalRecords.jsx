import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { notification } from '../../utils/antdGlobal';
import { ArrowLeft, CheckCircle, XCircle, FileText, RefreshCw, Eye, X, User, MapPin, GraduationCap, Briefcase, CreditCard, Building, ChevronDown, ChevronUp, Download, ImageIcon, ZoomIn, ZoomOut } from 'lucide-react';
import dayjs from 'dayjs';

// Backend URL for local file paths (e.g. /uploads/...)
const BACKEND_URL = (import.meta.env.VITE_HRMS_API_ROOT || import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://127.0.0.1:5006').replace(/\/$/, '');

function resolveUrl(url) {
    if (!url) return null;
    if (url.startsWith('http')) return url;       // Cloudinary or external
    if (url.startsWith('/')) return `${BACKEND_URL}${url}`; // local /uploads/...
    return url;
}

function isImage(url) {
    if (!url) return false;
    const u = url.toLowerCase().split('?')[0];
    return /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(u);
}

function isPdf(url) {
    if (!url) return false;
    return url.toLowerCase().split('?')[0].endsWith('.pdf');
}

/* ─── Image preview popup ─── */
function ImagePreview({ url, onClose }) {
    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div className="relative max-w-4xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute -top-10 right-0 p-2 text-white hover:text-slate-300"
                >
                    <X size={24} />
                </button>
                <img
                    src={url}
                    alt="Document Preview"
                    className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl"
                    onError={e => { e.target.src = ''; e.target.alt = 'Image failed to load'; }}
                />
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-3 right-3 flex items-center gap-1 bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full shadow hover:bg-slate-100"
                >
                    <Download size={12} /> Download
                </a>
            </div>
        </div>
    );
}

/* ─── File viewer with inline image / PDF ─── */
function FileViewer({ label, url }) {
    const [preview, setPreview] = useState(false);
    const resolved = resolveUrl(url);
    if (!resolved) return null;

    const img = isImage(resolved);
    const pdf = isPdf(resolved);

    return (
        <div className="border-b border-slate-100 last:border-0 py-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">{label}</span>

            {img ? (
                <>
                    <div
                        className="relative group cursor-zoom-in w-full max-w-xs rounded-xl overflow-hidden border border-slate-200 shadow-sm"
                        onClick={() => setPreview(true)}
                    >
                        <img
                            src={resolved}
                            alt={label}
                            className="w-full h-40 object-cover transition-transform group-hover:scale-105"
                            onError={e => { e.target.parentNode.innerHTML = '<div class="flex items-center justify-center h-40 bg-slate-100 text-slate-400 text-xs">Image unavailable</div>'; }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            <ZoomIn size={28} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={() => setPreview(true)}
                            className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors"
                        >
                            <ZoomIn size={12} /> View Full
                        </button>
                        <a
                            href={resolved}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors"
                        >
                            <Download size={12} /> Download
                        </a>
                    </div>
                    {preview && <ImagePreview url={resolved} onClose={() => setPreview(false)} />}
                </>
            ) : pdf ? (
                <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center text-rose-500 shrink-0">
                        <FileText size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-rose-700 truncate">PDF Document</p>
                        <p className="text-[10px] text-rose-500">Click to view</p>
                    </div>
                    <a
                        href={resolved}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-full transition-colors shrink-0"
                    >
                        <Download size={12} /> Open PDF
                    </a>
                </div>
            ) : (
                <a
                    href={resolved}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded-full transition-colors"
                >
                    <Download size={12} /> View File
                </a>
            )}
        </div>
    );
}

function DetailRow({ label, value }) {
    if (!value && value !== 0 && value !== false) return null;
    return (
        <div className="flex flex-col sm:flex-row border-b border-slate-100 last:border-0 py-2 gap-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-full sm:w-44 shrink-0">{label}</span>
            <span className="text-sm text-slate-700 font-medium break-all">{String(value)}</span>
        </div>
    );
}

function SectionCard({ title, icon: Icon, children, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-3">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <Icon size={15} />
                    </div>
                    <span className="text-sm font-black text-slate-700 uppercase tracking-wide">{title}</span>
                </div>
                {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>
            {open && (
                <div className="px-4 py-3 bg-white">
                    {children}
                </div>
            )}
        </div>
    );
}

function CandidateDetailModal({ record, onClose }) {
    const p = record?.personalDetails || {};
    const fam = record?.familyDetails || {};
    const comm = record?.communicationDetails || {};
    const edu = record?.educationDetails || {};
    const exp = record?.experienceDetails || {};
    const docs = record?.documentDetails || {};
    const bank = record?.bankDetails || {};
    const stat = record?.statutoryDetails || {};

    const tempAddr = comm.tempAddress || {};
    const permAddr = comm.permAddress || {};
    const academicQuals = edu.academicQualifications || [];
    const experienceList = exp.experience || [];
    const familyMembers = fam.familyMembers || [];

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl relative">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-lg">
                            {(record?.candidateId?.name || 'C')[0].toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-800">{record?.candidateId?.name || 'Candidate'}</h2>
                            <p className="text-xs text-slate-500">{record?.candidateId?.email} • {record?.jobId?.jobTitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="px-6 py-4 space-y-1">
                    {/* Personal Details */}
                    <SectionCard title="Personal Details" icon={User} defaultOpen={true}>
                        <DetailRow label="First Name" value={p.firstName} />
                        <DetailRow label="Middle Name" value={p.middleName} />
                        <DetailRow label="Last Name" value={p.lastName} />
                        <DetailRow label="Gender" value={p.gender} />
                        <DetailRow label="Date of Birth" value={p.dob ? dayjs(p.dob).format('DD MMM YYYY') : null} />
                        <DetailRow label="Blood Group" value={p.bloodGroup} />
                        <DetailRow label="Nationality" value={p.nationality} />
                        <DetailRow label="Marital Status" value={p.maritalStatus} />
                        <DetailRow label="Primary Contact" value={p.contactNo} />
                        <DetailRow label="Secondary Contact" value={p.alternateContactNo} />
                        <DetailRow label="Personal Email" value={p.personalEmail} />
                        <DetailRow label="Emergency Contact Name" value={p.emergencyContactName} />
                        <DetailRow label="Emergency Contact No" value={p.emergencyContactNumber} />
                        <DetailRow label="Emergency Relation" value={p.emergencyRelationship} />
                        <FileViewer label="Profile Photo" url={p.profilePic} />
                    </SectionCard>

                    {/* Family Details */}
                    <SectionCard title="Family Background" icon={User}>
                        {familyMembers.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No family members added.</p>
                        ) : familyMembers.map((m, i) => (
                            <div key={i} className="mb-3 p-3 bg-slate-50 rounded-lg">
                                <p className="text-xs font-black text-slate-600 uppercase mb-1">Member #{i + 1}</p>
                                <DetailRow label="Name" value={m.name} />
                                <DetailRow label="Relation" value={m.relation} />
                                <DetailRow label="Date of Birth" value={m.dob ? dayjs(m.dob).format('DD MMM YYYY') : null} />
                                <DetailRow label="Occupation" value={m.occupation} />
                                <DetailRow label="Contact No" value={m.contactNo} />
                                <DetailRow label="Dependent" value={m.isDependent ? 'Yes' : 'No'} />
                            </div>
                        ))}
                    </SectionCard>

                    {/* Communication / Address */}
                    <SectionCard title="Communication & Address" icon={MapPin}>
                        <p className="text-xs font-black text-slate-500 uppercase mb-2">Temporary Address</p>
                        <DetailRow label="House / Flat No" value={tempAddr.houseNo} />
                        <DetailRow label="Street / Area" value={tempAddr.streetArea} />
                        <DetailRow label="City" value={tempAddr.city} />
                        <DetailRow label="State" value={tempAddr.state} />
                        <DetailRow label="Country" value={tempAddr.country} />
                        <DetailRow label="Pin Code" value={tempAddr.pinCode} />
                        <div className="my-3 border-t border-slate-100" />
                        <p className="text-xs font-black text-slate-500 uppercase mb-2">Permanent Address</p>
                        <DetailRow label="House / Flat No" value={permAddr.houseNo} />
                        <DetailRow label="Street / Area" value={permAddr.streetArea} />
                        <DetailRow label="City" value={permAddr.city} />
                        <DetailRow label="State" value={permAddr.state} />
                        <DetailRow label="Country" value={permAddr.country} />
                        <DetailRow label="Pin Code" value={permAddr.pinCode} />
                    </SectionCard>

                    {/* Identity Documents */}
                    <SectionCard title="Identity Documents" icon={CreditCard} defaultOpen={true}>
                        <DetailRow label="Aadhaar Number" value={docs.aadhaarNo} />
                        <FileViewer label="Aadhaar Front" url={docs.aadhaarFront} />
                        <FileViewer label="Aadhaar Back" url={docs.aadhaarBack} />
                        <DetailRow label="PAN Number" value={docs.panNo} />
                        <FileViewer label="PAN Card" url={docs.panCard} />
                        <DetailRow label="Passport Number" value={docs.passportNo} />
                        <DetailRow label="Passport Expiry" value={docs.passportExpiry ? dayjs(docs.passportExpiry).format('DD MMM YYYY') : null} />
                        <FileViewer label="Passport" url={docs.passportDoc} />
                        <DetailRow label="Driving Licence No" value={docs.drivingLicenceNo} />
                        <FileViewer label="Driving Licence" url={docs.drivingLicenceDoc} />
                    </SectionCard>

                    {/* Academic Qualifications */}
                    <SectionCard title="Academic Qualifications" icon={GraduationCap}>
                        {academicQuals.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No academic qualifications added.</p>
                        ) : academicQuals.map((q, i) => (
                            <div key={i} className="mb-3 p-3 bg-slate-50 rounded-lg">
                                <p className="text-xs font-black text-slate-600 uppercase mb-1">Qualification #{i + 1}</p>
                                <DetailRow label="Qualification" value={q.qualification} />
                                <DetailRow label="University / Board" value={q.universityBoard} />
                                <DetailRow label="Year of Passing" value={q.yearOfPassing} />
                                <DetailRow label="% / CGPA" value={q.percentageCgpa} />
                                <DetailRow label="Mode" value={q.mode} />
                                <FileViewer label="Document" url={q.documentUrl || q.document} />
                            </div>
                        ))}
                    </SectionCard>

                    {/* Experience */}
                    <SectionCard title="Work Experience" icon={Briefcase}>
                        {experienceList.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No work experience added.</p>
                        ) : experienceList.map((e, i) => (
                            <div key={i} className="mb-3 p-3 bg-slate-50 rounded-lg">
                                <p className="text-xs font-black text-slate-600 uppercase mb-1">Experience #{i + 1}</p>
                                <DetailRow label="Company" value={e.companyName} />
                                <DetailRow label="Designation" value={e.designation} />
                                <DetailRow label="From" value={e.from ? dayjs(e.from).format('DD MMM YYYY') : null} />
                                <DetailRow label="To" value={e.to ? dayjs(e.to).format('DD MMM YYYY') : null} />
                                <DetailRow label="Employment Type" value={e.employmentType} />
                                <DetailRow label="Reason for Leaving" value={e.reasonForLeaving} />
                                <DetailRow label="CTC (Annual)" value={e.annualCtc} />
                                <FileViewer label="Offer Letter" url={e.offerLetterUrl || (typeof e.offerLetter === 'string' ? e.offerLetter : null)} />
                                <FileViewer label="Relieving Letter" url={e.relievingLetterUrl || (typeof e.relievingLetter === 'string' ? e.relievingLetter : null)} />
                                {e.payslips && e.payslips.map((ps, pi) => (
                                    <FileViewer key={pi} label={`Payslip ${pi + 1}`} url={typeof ps === 'string' ? ps : null} />
                                ))}
                            </div>
                        ))}
                    </SectionCard>

                    {/* Bank Details */}
                    <SectionCard title="Bank Details" icon={Building}>
                        <DetailRow label="Account Holder Name" value={bank.accountHolderName} />
                        <DetailRow label="Account Number" value={bank.accountNumber} />
                        <DetailRow label="Bank Name" value={bank.bankName} />
                        <DetailRow label="Branch Name" value={bank.branchName} />
                        <DetailRow label="IFSC Code" value={bank.ifscCode} />
                        <DetailRow label="Account Type" value={bank.accountType} />
                        <FileViewer label="Bank Proof (Cheque / Passbook)" url={bank.bankProofUrl} />
                    </SectionCard>

                    {/* Statutory Details */}
                    <SectionCard title="Statutory Details" icon={FileText}>
                        <DetailRow label="PF Number" value={stat.pfNumber} />
                        <DetailRow label="UAN Number" value={stat.uanNumber} />
                        <DetailRow label="ESI Number" value={stat.esiNumber} />
                        <DetailRow label="Nominee Name (PF)" value={stat.nomineeName} />
                        <DetailRow label="Nominee Relation" value={stat.nomineeRelation} />
                    </SectionCard>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ExternalRecords() {
    const navigate = useNavigate();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const loadRecords = async () => {
        try {
            setLoading(true);
            const res = await api.get('/recruitment/candidate-documents/records');
            if (res.data.success) {
                setRecords(res.data.data);
            }
        } catch (err) {
            notification.error({ message: 'Error', description: 'Failed to load external records' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
    }, []);

    const handleView = async (record) => {
        setLoadingDetail(true);
        try {
            const res = await api.get(`/recruitment/candidate-documents/records/${record._id}`);
            if (res.data.success) {
                setSelectedRecord(res.data.data);
            } else {
                setSelectedRecord(record);
            }
        } catch (err) {
            notification.error({ message: 'Error', description: 'Failed to load candidate details' });
            setSelectedRecord(record);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleAction = async (id, action) => {
        try {
            let endpoint = '';
            if (action === 'Approve') endpoint = `/recruitment/candidate-documents/approve/${id}`;
            else if (action === 'Reject') endpoint = `/recruitment/candidate-documents/reject/${id}`;
            else if (action === 'Request Changes') endpoint = `/recruitment/candidate-documents/request-changes/${id}`;

            const res = await api.post(endpoint);
            if (res.data.success) {
                notification.success({ message: 'Success', description: `Record updated successfully` });
                loadRecords();
            }
        } catch (err) {
            notification.error({ message: 'Error', description: err.response?.data?.message || 'Failed to update record' });
        }
    };

    return (
        <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate('/hr/employees')} className="p-2 bg-white rounded-lg border shadow-sm hover:bg-slate-50">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">External Records</h1>
                    <p className="text-slate-500 text-sm">Review candidate documents and pre-onboarding submissions</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Candidate</th>
                            <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Job Title</th>
                            <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Requested On</th>
                            <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="p-8 text-center text-slate-400">Loading records...</td>
                            </tr>
                        ) : records.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="p-8 text-center text-slate-400">No external records found.</td>
                            </tr>
                        ) : (
                            records.map(record => (
                                <tr key={record._id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <p className="font-bold text-slate-800">{record.candidateId?.name || 'Unknown'}</p>
                                        <p className="text-xs text-slate-500">{record.candidateId?.email || ''}</p>
                                    </td>
                                    <td className="p-4 text-sm text-slate-600">
                                        {record.jobId?.jobTitle || 'N/A'}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md ${
                                            record.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                            record.status === 'Submitted' ? 'bg-blue-100 text-blue-700' :
                                            record.status === 'Revision_Requested' ? 'bg-orange-100 text-orange-700' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-slate-600">
                                        {dayjs(record.createdAt).format('DD MMM YYYY')}
                                    </td>
                                    <td className="p-4 text-right flex items-center justify-end gap-2">
                                        {record.status === 'Submitted' && (
                                            <>
                                                <button onClick={() => handleAction(record._id, 'Approve')} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Approve & Convert to Draft">
                                                    <CheckCircle size={18} />
                                                </button>
                                                <button onClick={() => handleAction(record._id, 'Request Changes')} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Request Changes">
                                                    <RefreshCw size={18} />
                                                </button>
                                                <button onClick={() => handleAction(record._id, 'Reject')} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Reject">
                                                    <XCircle size={18} />
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => handleView(record)}
                                            disabled={loadingDetail}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                            title="View Candidate Details"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            {selectedRecord && (
                <CandidateDetailModal
                    record={selectedRecord}
                    onClose={() => setSelectedRecord(null)}
                />
            )}
        </div>
    );
}
