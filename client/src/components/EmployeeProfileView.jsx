import React, { useState, useEffect } from 'react';
import { Tabs, Tag } from 'antd';
import { 
  User, Mail, Phone, Calendar, MapPin, Briefcase, 
  GraduationCap, ShieldCheck, Heart, Users, Globe, 
  Activity, Smartphone, Hash, Layers, Shield, 
  Printer, ChevronRight, FileText, BadgeCheck,
  Eye, Download, File, UserPlus, Info, 
  ShieldAlert, Landmark, UserCheck, CheckCircle,
  Award, UserCircle
} from 'lucide-react';
import api, { API_ROOT } from '../utils/api';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { extractEmployeeProfilePayload } from '../utils/employeeProfile';
import { motion } from 'framer-motion';

const BACKEND_URL = API_ROOT || '';

const SectionCard = ({ title, children, icon: Icon }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.4 }}
    className="bg-white rounded-[20px] border border-slate-200/60 px-4 py-2 shadow-sm hover:shadow-md transition-all duration-300 group"
  >
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors duration-300">
          {Icon && <Icon size={14} strokeWidth={2.5} />}
        </div>
        <h3 className="text-xs font-bold text-slate-900 tracking-tight">{title}</h3>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">{children}</div>
  </motion.div>
);

const InfoField = ({ label, value, icon: Icon, color = "indigo" }) => {
  const themes = {
    indigo: "bg-indigo-50 text-indigo-600",
    blue: "bg-blue-50 text-blue-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    slate: "bg-slate-50 text-slate-500",
  };
  const themeClass = themes[color] || themes.indigo;

  return (
    <div className="group px-3 py-1.5 rounded-lg bg-slate-50/50 border border-transparent hover:bg-white hover:border-slate-100 transition-all duration-200">
      <div className="flex items-center gap-2 mb-0.5">
        <div className={`w-6 h-6 rounded-md ${themeClass} shadow-sm flex items-center justify-center`}>
          {Icon && <Icon size={10} strokeWidth={2.5} />}
        </div>
        <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase opacity-70">{label}</span>
      </div>
      <div className="pl-8">
        <p className="text-xs font-bold text-slate-800 leading-tight">{value || 'N/A'}</p>
      </div>
    </div>
  );
};

const DocLink = ({ url, label }) => {
  if (!url) return null;
  const fullUrl = url.startsWith('http') ? url : `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50/50 border border-transparent hover:bg-white hover:border-slate-100 hover:shadow-lg hover:shadow-slate-200/30 transition-all duration-300 group"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
          <FileText size={16} strokeWidth={2} />
        </div>
        <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 truncate">{label}</span>
      </div>
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-all">
        <ChevronRight size={14} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </a>
  );
};

export default function EmployeeProfileView({ employee, profile, leaveHistory = [], historyLoading = false }) {
  const [activeTab, setActiveTab] = useState('1');
  const [internalProfile, setInternalProfile] = useState(null);
  const [loading, setLoading] = useState(!employee && !profile);

  const emp = employee || profile || internalProfile;

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (s === 'rejected') return 'bg-rose-50 text-rose-600 border-rose-100';
    if (s === 'pending') return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-slate-50 text-slate-500 border-slate-100';
  };

  useEffect(() => {
    if (!employee && !profile) {
      setLoading(true);
      api.get('/employee/profile')
        .then(res => {
          setInternalProfile(extractEmployeeProfilePayload(res.data));
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch profile:", err);
          setLoading(false);
        });
    }
  }, [employee, profile]);

  if (loading || !emp) {
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-white rounded-[24px] border border-slate-100 shadow-sm animate-pulse">
        <UserCircle size={40} className="text-slate-200 mb-3" />
        <p className="text-[12px] font-bold text-slate-400 tracking-tight uppercase">Syncing Profile...</p>
      </div>
    );
  }

  const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Employee';
  const primaryRole = emp.designation || emp.role || emp.jobTitle || 'Employee';
  const departmentName = emp.department || emp.departmentId?.name || emp.team || 'Department';
  const workEmail = emp.email || emp.personalEmail || 'N/A';
  const workType = emp.jobType || emp.employmentType || emp.workMode || 'N/A';
  const joiningDate = formatDateDDMMYYYY(emp.joiningDate);

  const tabsContent = [
    {
      key: '1',
      label: <div className="px-3 font-semibold text-xs">Profile</div>,
      children: (
        <div className="space-y-1 pt-0">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <SectionCard title="Personal Details" icon={User}>
              <InfoField label="Full Name" value={fullName} icon={User} color="indigo" />
              <InfoField label="Date of Birth" value={formatDateDDMMYYYY(emp.dob)} icon={Calendar} color="amber" />
              <InfoField label="Gender" value={emp.gender} icon={Activity} color="violet" />
              <InfoField label="Blood Group" value={emp.bloodGroup} icon={Heart} color="rose" />
              <InfoField label="Marital Status" value={emp.maritalStatus} icon={Users} color="indigo" />
              <InfoField label="Nationality" value={emp.nationality} icon={Globe} color="violet" />
              <InfoField label="Place of Birth" value={emp.placeOfBirth} icon={MapPin} color="indigo" />
              <InfoField label="Personal Email" value={emp.personalEmail || emp.email} icon={Mail} color="blue" />
              <InfoField label="Caste / Category" value={emp.cast} icon={UserPlus} color="violet" />
              <InfoField label="Hobbies" value={emp.hobbies} icon={Heart} color="rose" />
              <InfoField label="Height / Weight" value={`${emp.height || '--'} / ${emp.weight || '--'}`} icon={Activity} color="indigo" />
              <InfoField label="Disability" value={emp.physicalDisabilityOrSickness === 'yes' ? emp.physicalDisabilityDetails : 'None'} icon={ShieldAlert} color="rose" />
            </SectionCard>

            <SectionCard title="Contact & Family" icon={ShieldCheck}>
              <InfoField label="Father's Name" value={emp.fatherName} icon={User} color="indigo" />
              <InfoField label="Mother's Name" value={emp.motherName} icon={User} color="indigo" />
              <InfoField label="Phone" value={emp.mobileNumber || emp.phone || emp.contactNo} icon={Phone} color="blue" />
              <InfoField label="Emergency Person" value={emp.emergencyContactName} icon={Smartphone} color="rose" />
              <InfoField label="Emergency Mobile" value={emp.emergencyContactNumber} icon={Phone} color="rose" />
              <InfoField label="Current City" value={emp.tempAddress?.city} icon={MapPin} color="indigo" />
              <InfoField label="Aadhaar No" value={emp.documents?.aadharNumber || emp.aadharNumber} icon={Hash} color="blue" />
              <InfoField label="PAN No" value={emp.documents?.panNumber || emp.panNumber} icon={Hash} color="blue" />
            </SectionCard>
          </div>

          <SectionCard title="Address Details" icon={MapPin}>
            <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { title: 'Current Residence', addr: emp.tempAddress },
                { title: 'Permanent Residence', addr: emp.permAddress }
              ].map((res, i) => (
                <div key={i} className="p-6 rounded-[28px] bg-slate-50/50 border border-transparent hover:bg-white hover:border-slate-100 hover:shadow-xl hover:shadow-slate-200/30 transition-all duration-500 group/addr">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover/addr:bg-indigo-500 group-hover/addr:text-white transition-all">
                      <MapPin size={12} strokeWidth={2.5} />
                    </div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-70">{res.title}</h4>
                  </div>
                  <div className="pl-10">
                    <p className="text-sm font-bold text-slate-800 leading-relaxed">
                      {res.addr?.line1 || 'N/A'}<br/>
                      {res.addr?.line2 && <>{res.addr.line2}<br/></>}
                      <span className="text-indigo-500/80 font-medium text-xs">
                        {res.addr?.city || ''}{res.addr?.state ? `, ${res.addr.state}` : ''} {res.addr?.pinCode || ''}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )
    },
    {
      key: '2',
      label: <div className="px-3 font-semibold text-xs">Job Info</div>,
      children: (
        <div className="space-y-1 pt-0">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <SectionCard title="Job Information" icon={Briefcase}>
              <InfoField label="Employee ID" value={emp.employeeId} icon={Hash} color="blue" />
              <InfoField label="Date of Joining" value={formatDateDDMMYYYY(emp.joiningDate)} icon={Calendar} color="amber" />
              <InfoField label="Designation" value={primaryRole} icon={Shield} color="indigo" />
              <InfoField label="Department" value={departmentName} icon={Layers} color="indigo" />
              <InfoField label="Work Type" value={workType} icon={Activity} color="violet" />
              <InfoField label="Work Email" value={workEmail} icon={Mail} color="blue" />
            </SectionCard>

            <SectionCard title="Qualifications" icon={BadgeCheck}>
              <InfoField label="Highest Qual." value={emp.highestQualification || emp.education?.type} icon={GraduationCap} color="indigo" />
              <InfoField label="University" value={emp.education?.university} icon={GraduationCap} color="indigo" />
              <InfoField label="10th Marks" value={emp.education?.class10Marks} icon={Info} color="violet" />
              <InfoField label="12th Marks" value={emp.education?.class12Marks} icon={Info} color="violet" />
              <div className="col-span-full mt-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Academic History</h4>
                <div className="grid grid-cols-1 gap-2">
                  {(emp.academicQualifications || []).map((aq, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-50 border border-transparent">
                      <p className="text-xs font-bold text-slate-800">{aq.qualification}</p>
                      <p className="text-[10px] text-slate-500">{aq.universityBoard} | {aq.yearOfPassing} | {aq.percentageCgpa}% | {aq.mode}</p>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <SectionCard title="Work Experience" icon={Briefcase}>
              <div className="col-span-full grid grid-cols-1 gap-2">
                {(emp.experience || []).length > 0 ? emp.experience.map((exp, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50/50 border border-transparent hover:bg-white hover:border-slate-100 hover:shadow-md transition-all duration-300">
                    <h4 className="text-xs font-bold text-slate-800 mb-1">{exp.companyName}</h4>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{formatDateDDMMYYYY(exp.from)} - {formatDateDDMMYYYY(exp.to)} | {exp.lastDrawnSalary}</p>
                  </div>
                )) : <div className="p-4 text-center text-slate-400 text-[10px] font-medium italic">No experience data</div>}
              </div>
            </SectionCard>

            <SectionCard title="Previous Interview" icon={UserCheck}>
              <InfoField label="Attended Before?" value={emp.previousInterview} icon={CheckCircle} color="emerald" />
              <InfoField label="Interview Date" value={formatDateDDMMYYYY(emp.previousInterviewDate)} icon={Calendar} color="amber" />
              <InfoField label="Dept/Location" value={emp.previousInterviewDeptLocation} icon={MapPin} color="indigo" />
              <InfoField label="Interviewed By" value={emp.previousInterviewedBy} icon={User} color="indigo" />
            </SectionCard>
          </div>
        </div>
      )
    },
    {
      key: '3',
      label: <div className="px-3 font-semibold text-xs">Family</div>,
      children: (
        <div className="space-y-1 pt-0">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <SectionCard title="Parents" icon={Users}>
               <InfoField label="Father's Name" value={emp.fatherName} icon={User} color="indigo" />
               <InfoField label="Father Aadhaar" value={emp.fatherAadhaar} icon={Hash} color="blue" />
               <InfoField label="Mother's Name" value={emp.motherName} icon={User} color="indigo" />
               <InfoField label="Mother Aadhaar" value={emp.motherAadhaar} icon={Hash} color="blue" />
            </SectionCard>

            <SectionCard title="Spouse Details" icon={Heart}>
               <InfoField label="Spouse Name" value={emp.spouseDetails?.name || emp.spouseDetails?.spouseName} icon={User} color="indigo" />
               <InfoField label="Gender" value={emp.spouseDetails?.gender || emp.spouseDetails?.relation} icon={Users} color="indigo" />
               <InfoField label="DOB" value={formatDateDDMMYYYY(emp.spouseDetails?.dob)} icon={Calendar} color="amber" />
               <InfoField label="Blood Group" value={emp.spouseDetails?.bloodGroup} icon={Heart} color="rose" />
            </SectionCard>
          </div>

          <SectionCard title="Children & Siblings" icon={Users}>
             <div className="col-span-full space-y-4">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Children</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(emp.children || []).length > 0 ? emp.children.map((child, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 border border-transparent">
                        <p className="text-xs font-bold text-slate-800">{child.name}</p>
                        <p className="text-[10px] text-slate-500">{child.gender} | {formatDateDDMMYYYY(child.dob)}</p>
                      </div>
                    )) : <p className="text-[10px] text-slate-400 italic px-2">No children data added</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Brothers</h4>
                      {(emp.brothers || []).map((b, i) => (
                        <div key={i} className="p-2 text-xs font-medium text-slate-700">• {b.name} ({b.gender || b.age + ' yrs'}) - {formatDateDDMMYYYY(b.dob) || b.occupation}</div>
                      ))}
                   </div>
                   <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Sisters</h4>
                      {(emp.sisters || []).map((s, i) => (
                        <div key={i} className="p-2 text-xs font-medium text-slate-700">• {s.name} ({s.gender || s.age + ' yrs'}) - {formatDateDDMMYYYY(s.dob) || s.occupation}</div>
                      ))}
                   </div>
                </div>
             </div>
          </SectionCard>
        </div>
      )
    },
    {
      key: '5',
      label: <div className="px-3 font-semibold text-xs">Financials</div>,
      children: (
        <div className="space-y-1 pt-0">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <SectionCard title="Bank Details" icon={Landmark}>
              <InfoField label="Bank Name" value={emp.bankDetails?.bankName} icon={Landmark} color="emerald" />
              <InfoField label="Account No" value={emp.bankDetails?.accountNumber} icon={Hash} color="emerald" />
              <InfoField label="IFSC Code" value={emp.bankDetails?.ifsc} icon={ShieldCheck} color="emerald" />
              <InfoField label="Branch" value={emp.bankDetails?.branchName} icon={MapPin} color="emerald" />
              <InfoField label="Location" value={emp.bankDetails?.location} icon={MapPin} color="emerald" />
            </SectionCard>

            <SectionCard title="Languages" icon={Globe}>
              <div className="col-span-full grid grid-cols-1 gap-2">
                {(emp.languages || []).map((lang, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                    <span className="text-xs font-bold text-slate-800">{lang.name}</span>
                    <div className="flex gap-2">
                      {['speak', 'read', 'write'].map(skill => lang[skill] && (
                        <span key={skill} className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-tighter">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Other Perquisites & References" icon={Award}>
             <div className="col-span-full grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Salary Perquisites</h4>
                   <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <p className="text-[10px] text-slate-500">Car: <span className="text-slate-800 font-bold">{emp.perquisites?.companyCarModel || 'No'}</span></p>
                      <p className="text-[10px] text-slate-500">Rent Reim.: <span className="text-slate-800 font-bold">{emp.perquisites?.leasedAccomMonthlyRentRs || 'No'}</span></p>
                      <p className="text-[10px] text-slate-500">Incentives: <span className="text-slate-800 font-bold">{emp.perquisites?.incentiveParticulars || 'No'}</span></p>
                      <p className="text-[10px] text-slate-500">Tel Limit: <span className="text-slate-800 font-bold">{emp.perquisites?.telephoneLimitAmountRs || 'No'}</span></p>
                   </div>
                </div>
                <div>
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Professional References</h4>
                   <div className="space-y-2">
                      {(emp.references || []).map((ref, i) => (
                        <div key={i} className="text-[11px] font-medium text-slate-700 bg-slate-50 p-2 rounded-lg">
                          <span className="font-bold text-indigo-600">{ref.name}</span> ({ref.designation} at {ref.companyName || ref.company}) - {ref.contactNo || ref.phone}
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </SectionCard>
        </div>
      )
    },
    {
      key: '6',
      label: <div className="px-3 font-semibold text-xs">Documents</div>,
      children: (
        <div className="space-y-1 pt-0">
          <SectionCard title="Identity Proofs" icon={Shield}>
            <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <DocLink url={emp.documents?.aadharFront} label="Aadhaar Front Copy" />
              <DocLink url={emp.documents?.aadharBack} label="Aadhaar Back Copy" />
              <DocLink url={emp.documents?.panCard} label="PAN Card Copy" />
            </div>
          </SectionCard>

          <SectionCard title="Academic Documents" icon={GraduationCap}>
            <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <DocLink url={emp.education?.class10Marksheet} label="10th Marksheet" />
              <DocLink url={emp.education?.class12Marksheet} label="12th Marksheet" />
              <DocLink url={emp.education?.diplomaCertificate} label="Diploma Certificate" />
              <DocLink url={emp.education?.bachelorDegree} label="Bachelor Degree" />
              <DocLink url={emp.education?.masterDegree} label="Master Degree" />
              <DocLink url={emp.education?.lastSem1Marksheet} label="Sem 1 Marksheet" />
              <DocLink url={emp.education?.lastSem2Marksheet} label="Sem 2 Marksheet" />
              <DocLink url={emp.education?.lastSem3Marksheet} label="Sem 3 Marksheet" />
            </div>
          </SectionCard>

          <SectionCard title="Professional & Bank Proofs" icon={Briefcase}>
            <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <DocLink url={emp.bankDetails?.bankProofUrl} label="Bank Account Proof" />
              {(emp.experience || []).map((exp, i) => (
                <React.Fragment key={i}>
                  <DocLink url={exp.bankProofUrl} label={`Bank Proof (${exp.companyName})`} />
                  {(exp.payslips || []).map((ps, pi) => (
                    <DocLink key={`${i}-${pi}`} url={ps} label={`Payslip ${pi + 1} (${exp.companyName})`} />
                  ))}
                </React.Fragment>
              ))}
            </div>
          </SectionCard>
        </div>
      )
    },
    {
      key: '7',
      label: <div className="px-3 font-semibold text-xs">Leaves</div>,
      children: (
        <div className="space-y-1.5 pt-2">
           <SectionCard title="Leave Requests History" icon={Calendar}>
            <div className="col-span-full">
              {historyLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Refreshing history...</p>
                </div>
              ) : leaveHistory.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {leaveHistory.map((leave, i) => (
                    <div key={i} className="p-5 rounded-3xl bg-slate-50/50 border border-transparent hover:bg-white hover:border-slate-100 hover:shadow-lg transition-all duration-300 group/leave">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border border-transparent transition-all duration-300 ${getStatusBadge(leave.status)}`}>
                            <Calendar size={18} strokeWidth={2.5} />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-0.5">
                              <h4 className="text-sm font-black text-slate-800">{leave.leaveType || 'Leave Request'}</h4>
                              <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getStatusBadge(leave.status)}`}>
                                {leave.status}
                              </span>
                            </div>
                            <p className="text-[11px] font-bold text-slate-500 tracking-tight">
                              {formatDateDDMMYYYY(leave.startDate)} → {formatDateDDMMYYYY(leave.endDate)}
                            </p>
                          </div>
                        </div>
                        <div className="pl-14 sm:pl-0 sm:text-right">
                          <p className="text-xs font-medium text-slate-600 italic leading-relaxed line-clamp-2 max-w-md">"{leave.reason || 'No reason provided'}"</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-[32px]">
                   <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4">
                      <Calendar size={24} />
                   </div>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Leave Records Found</p>
                </div>
              )}
            </div>
           </SectionCard>
        </div>
      )
    }
  ];

  return (
    <div id="profile-container" className="space-y-2 pb-2 mx-auto px-1 animate-in fade-in slide-in-from-bottom-2 duration-700 -mt-6">
      <style>{`
        .ant-tabs-nav { position: sticky; top: -4px; z-index: 50; margin-bottom: 4px !important; border-bottom: 1px solid #F1F5F9 !important; padding: 4px 1.5rem !important; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(8px); border-radius: 24px; box-shadow: 0 4px 20px -10px rgba(0, 0, 0, 0.1); transition: all 0.3s ease; }
        .ant-tabs-nav:hover { background: white; box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.15); }
        .ant-tabs-tab { padding: 12px 16px !important; transition: all 0.3s ease !important; color: #64748B !important; margin: 4px 0 !important; border-radius: 12px !important; }
        .ant-tabs-tab:hover { color: #4F46E5 !important; background: #F8FAFC; }
        .ant-tabs-tab-active { background: #EEF2FF !important; }
        .ant-tabs-tab-active .ant-tabs-tab-btn { color: #4F46E5 !important; font-weight: 800 !important; }
        .ant-tabs-ink-bar { display: none !important; }
      `}</style>

      <div className="relative bg-white rounded-[24px] border border-slate-200 shadow-xl shadow-slate-100/50 overflow-hidden py-4 px-6 pr-10 transition-all duration-500 -mt-14">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-50" />
        
        <div className="flex flex-col md:flex-row items-center md:items-center gap-8 relative z-10">
          {/* Avatar Section */}
          <div className="relative group shrink-0">
            <div className="w-28 h-28 rounded-[24px] bg-white p-1 shadow-2xl shadow-slate-200 border border-slate-100 relative overflow-hidden transition-all duration-500 hover:scale-105">
              {emp.profilePic ? (
                <img 
                  src={String(emp.profilePic).startsWith('http') ? emp.profilePic : `${BACKEND_URL}${String(emp.profilePic).startsWith('/') ? '' : '/'}${emp.profilePic}`} 
                  alt="User" 
                  className="w-full h-full object-cover rounded-[20px]" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-[20px] text-4xl font-black text-slate-200 italic">
                  {emp.firstName?.[0]}{emp.lastName?.[0]}
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-indigo-600 rounded-xl shadow-lg border-2 border-white flex items-center justify-center text-white">
              <BadgeCheck size={16} strokeWidth={2.5} />
            </div>
          </div>

          {/* Info Section */}
          <div className="flex-1 w-full text-center md:text-left">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-2.5">
                <div className="flex flex-col md:flex-row items-center md:items-center gap-4">
                  <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">{fullName}</h1>
                  <div className="flex items-center gap-2">
                    <Tag color="blue" className="rounded-full px-3 py-0.5 font-bold border-0 bg-blue-50 text-blue-600 text-[9px] uppercase tracking-widest">
                      {emp.employeeId || 'N/A'}
                    </Tag>
                    <Tag color="green" className="rounded-full px-3 py-0.5 font-bold border-0 bg-emerald-50 text-emerald-600 text-[9px] uppercase tracking-widest">
                      Active
                    </Tag>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 text-slate-600 border border-slate-100 rounded-lg shadow-sm">
                    <Briefcase size={12} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{primaryRole}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 text-slate-600 border border-slate-100 rounded-lg shadow-sm">
                    <Layers size={12} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{departmentName}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-3 border-t border-slate-100 max-w-2xl">
                  {[
                    { label: 'Work Email', value: workEmail, icon: Mail, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Employment', value: workType, icon: Activity, color: 'text-rose-500', bg: 'bg-rose-50' },
                    { label: 'Joined', value: joiningDate, icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-50' },
                  ].map((met, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5 group/met">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-60 group-hover/met:opacity-100 transition-opacity">{met.label}</p>
                      <div className="flex items-center gap-2.5">
                         <div className={`w-7 h-7 rounded-lg ${met.bg} flex items-center justify-center ${met.color} group-hover/met:scale-110 transition-transform`}>
                            <met.icon size={13} strokeWidth={2.5} />
                         </div>
                         <p className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{met.value || 'N/A'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>


            </div>
          </div>
        </div>
      </div>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        items={tabsContent} 
        className="profile-tabs-professional no-print" 
      />
    </div>
  );
}
