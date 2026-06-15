// Joining Letter Utilities for HRMS SaaS
// Updated to support immutable snapshots

/**
 * Map Offer Letter data to Joining Letter variables with safe fallbacks
 * 
 * @param {Object} applicant - Applicant document
 * @param {Object} customData - Any overrides
 * @param {Object} snapshot - Immutable EmployeeSalarySnapshot document
 */
/**
 * Helper for custom date format: 16th Jan'25
 */
function formatCustomDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const day = d.getDate();
  const month = d.toLocaleString('en-IN', { month: 'short' });
  const year = d.getFullYear();

  let suffix = 'th';
  if (day % 10 === 1 && day !== 11) suffix = 'st';
  else if (day % 10 === 2 && day !== 12) suffix = 'nd';
  else if (day % 10 === 3 && day !== 13) suffix = 'rd';

  return `${day}${suffix} ${month}. ${year}`;
}

/**
 * Map Offer Letter data to Joining Letter variables with safe fallbacks
 * 
 * @param {Object} applicant - Applicant document
 * @param {Object} customData - Any overrides
 * @param {Object} snapshot - Immutable EmployeeSalarySnapshot document
 */
function mapOfferToJoiningData(applicant, customData = {}, snapshot = {}) {
  const today = formatCustomDate(new Date());

  const fullName = `${applicant?.salutation ? applicant.salutation + ' ' : ''}${applicant?.name || ''}`;
  const joinAddressParts = (...parts) => parts.filter(part => part && String(part).trim()).join(', ');
  const derivedAddress =
    applicant?.address ||
    applicant?.candidate_address ||
    applicant?.candidateAddress ||
    joinAddressParts(
      applicant?.tempAddress?.line1,
      applicant?.tempAddress?.line2,
      applicant?.tempAddress?.city,
      applicant?.tempAddress?.state,
      applicant?.tempAddress?.pincode
    ) ||
    joinAddressParts(
      applicant?.permAddress?.line1,
      applicant?.permAddress?.line2,
      applicant?.permAddress?.city,
      applicant?.permAddress?.state,
      applicant?.permAddress?.pincode
    ) ||
    joinAddressParts(
      applicant?.permanentAddress?.line1,
      applicant?.permanentAddress?.line2,
      applicant?.permanentAddress?.city,
      applicant?.permanentAddress?.state,
      applicant?.permanentAddress?.pincode
    ) ||
    joinAddressParts(
      applicant?.currentAddress?.line1,
      applicant?.currentAddress?.line2,
      applicant?.currentAddress?.city,
      applicant?.currentAddress?.state,
      applicant?.currentAddress?.pincode
    );

  // Extract offer data
  const offerData = {
    refNo: applicant?.offerRefNo || applicant?.offerRefCode || `OFFER/${new Date().getFullYear()}/${Math.floor(Math.random() * 10000)}`,
    offerDate: applicant?.offerDate ? new Date(applicant.offerDate).toLocaleDateString('en-IN') : today,
    location: applicant?.location || applicant?.workLocation || applicant?.tempAddress?.city || '',
    joiningDate: customData?.joining_date || (applicant?.joiningDate ? new Date(applicant.joiningDate).toLocaleDateString('en-IN') : ''),
    name: applicant?.name || (applicant?.firstName ? `${applicant.firstName} ${applicant.lastName || ''}`.trim() : ''),
    designation: applicant?.designation || applicant?.currentDesignation || applicant?.requirementId?.jobTitle || '',
    address: derivedAddress || '',
    department: applicant?.department || applicant?.requirementId?.department || (applicant?.departmentId?.name) || '',
    title: applicant?.title || ''
  };

  const safeValue = (joiningValue, offerValue, defaultValue = '') => {
    if (joiningValue !== undefined && joiningValue !== null && String(joiningValue).trim() !== '') return String(joiningValue);
    if (offerValue !== undefined && offerValue !== null && String(offerValue).trim() !== '') return String(offerValue);
    return defaultValue;
  };

  // Process snapshot data
  const earnings = snapshot.earnings || [];
  // Combine all deductions for summary if needed, but usually we care about employee deductions for net pay
  const employeeDeductions = snapshot.employeeDeductions || snapshot.deductions || [];
  const employerDeductions = snapshot.employerDeductions || [];
  const benefits = snapshot.benefits || [];

  const findVal = (list, patterns) => {
    const found = list.find(item => {
      const n = (item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const c = (item.code || item.componentCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return patterns.some(p => n.includes(p) || c.includes(p));
    });
    return {
      monthly: found ? (found.monthlyAmount || (found.yearlyAmount / 12) || 0) : 0,
      annual: found ? (found.yearlyAmount || (found.monthlyAmount * 12) || 0) : 0,
      name: found ? found.name : ''
    };
  };

  const basic = findVal(earnings, ['basic']);
  const hra = findVal(earnings, ['hra', 'house']);
  const conveyance = findVal(earnings, ['conveyance', 'transport', 'travel']);
  const medical = findVal(earnings, ['medical']);
  const special = findVal(earnings, ['special', 'other']);
  const transport = findVal(earnings, ['transportation', 'transportallow']);
  const education = findVal(earnings, ['education']);
  const books = findVal(earnings, ['books', 'periodicals']);
  const uniform = findVal(earnings, ['uniform']);
  const mobile = findVal(earnings, ['mobile', 'phone']);
  const compensatory = findVal(earnings, ['compensatory']);

  const pf = findVal(employeeDeductions, ['pf', 'provident']);
  const pt = findVal(employeeDeductions, ['professional', 'pt', 'tax']);
  const esic = findVal(employeeDeductions, ['esic', 'stateinsurance']);

  const totalEarningsAnnual = earnings.reduce((sum, e) => sum + (e.annualAmount || (e.monthlyAmount * 12) || 0), 0);
  const totalBenefitsAnnual = benefits.reduce((sum, b) => sum + (b.annualAmount || (b.monthlyAmount * 12) || 0), 0);
  const totalEmployeeDeductionsAnnual = employeeDeductions.reduce((sum, d) => sum + (d.annualAmount || (d.monthlyAmount * 12) || 0), 0);

  const fmt = (val) => Math.round(val || 0).toLocaleString('en-IN');
  const grossMonthly = totalEarningsAnnual / 12;
  const grossAnnual = totalEarningsAnnual;
  const netMonthly = (totalEarningsAnnual - totalEmployeeDeductionsAnnual) / 12;
  const netAnnual = totalEarningsAnnual - totalEmployeeDeductionsAnnual;
  const totalCTCMonthly = (totalEarningsAnnual + totalBenefitsAnnual) / 12;
  const totalCTCAnnual = totalEarningsAnnual + totalBenefitsAnnual;

  const finalData = {
    offer_ref_code: safeValue(customData?.offer_ref_code, offerData.refNo, ''),
    employee_name: safeValue(customData?.employee_name, offerData.name, ''),
    name: offerData.name,
    designation: safeValue(customData?.designation, offerData.designation, ''),
    department: safeValue(customData?.department, offerData.department, ''),
    location: safeValue(customData?.location, offerData.location, ''),
    address: safeValue(customData?.address, offerData.address, ''),
    candidate_address: safeValue(customData?.candidate_address, offerData.address, ''),
    candidateAddress: safeValue(customData?.candidateAddress, offerData.address, ''),
    employee_address: safeValue(customData?.employee_address, offerData.address, ''),
    joining_date: safeValue(customData?.joining_date, offerData.joiningDate, ''),
    current_date: today,
    father_name: safeValue(customData?.father_name, applicant?.fatherName, ''),

    // Salary Placeholders
    annual_ctc: fmt(totalCTCAnnual),
    monthly_ctc: fmt(totalCTCMonthly),
    total_ctc_annual: fmt(totalCTCAnnual),
    total_ctc_monthly: fmt(totalCTCMonthly),

    basic_monthly: fmt(basic.monthly),
    basic_annual: fmt(basic.annual),

    hra_monthly: fmt(hra.monthly),
    hra_annual: fmt(hra.annual),

    conveyance_monthly: fmt(conveyance.monthly),
    conveyance_annual: fmt(conveyance.annual),

    medical_monthly: fmt(medical.monthly),
    medical_annual: fmt(medical.annual),

    special_monthly: fmt(special.monthly),
    special_annual: fmt(special.annual),

    transport_monthly: fmt(transport.monthly),
    transport_annual: fmt(transport.annual),

    education_monthly: fmt(education.monthly),
    education_annual: fmt(education.annual),

    books_monthly: fmt(books.monthly),
    books_annual: fmt(books.annual),

    uniform_monthly: fmt(uniform.monthly),
    uniform_annual: fmt(uniform.annual),

    mobile_monthly: fmt(mobile.monthly),
    mobile_annual: fmt(mobile.annual),

    compensatory_monthly: fmt(compensatory.monthly),
    compensatory_annual: fmt(compensatory.annual),

    pf_monthly: fmt(pf.monthly),
    pf_annual: fmt(pf.annual),

    pt_monthly: fmt(pt.monthly),
    pt_annual: fmt(pt.annual),

    esic_monthly: fmt(esic.monthly),
    esic_annual: fmt(esic.annual),

    gross_monthly: fmt(grossMonthly),
    gross_annual: fmt(grossAnnual),
    gross_a_monthly: fmt(grossMonthly),
    gross_a_annual: fmt(grossAnnual),

    net_monthly: fmt(netMonthly),
    net_annual: fmt(netAnnual),
    take_home_monthly: fmt(netMonthly),
    take_home_annual: fmt(netAnnual)
  };

  // Add uppercase versions of all keys for template flexibility
  const upperData = {};
  Object.keys(finalData).forEach(key => {
    upperData[key.toUpperCase()] = finalData[key];
  });

  return { ...finalData, ...upperData };
}

module.exports = {
  mapOfferToJoiningData
};
