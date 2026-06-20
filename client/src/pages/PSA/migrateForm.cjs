const fs = require('fs');
const path = require('path');

const p = path.join('d:', 'new hrms', 'Gitakshmi_HRMS_Web_App', 'client', 'src', 'pages', 'PSA');

const addContent = fs.readFileSync(path.join(p, 'AddCompany.jsx'), 'utf8');
const editContent = fs.readFileSync(path.join(p, 'EditCompany.jsx'), 'utf8');

// 1. Extract lucide imports
const importsMatch = addContent.match(/import\s+\{([^}]+)\}\s+from\s+'lucide-react';/);
const lucideImports = importsMatch[1];

// 2. Extract COUNTRY_CODES import
const countryCodeImportMatch = addContent.match(/import \{ COUNTRY_CODES \} from '\.\.\/\.\.\/constants\/countryCodes';/);

// 3. Extract formData initialization
const formDataInitMatch = addContent.match(/const \[formData, setFormData\] = useState\((\{[\s\S]*?\})\);/);
const formDataInit = formDataInitMatch[1];

// 4. Extract handleInputChange
const handleInputChangeMatch = addContent.match(/const handleInputChange = \(e\) => \{[\s\S]*?if \(errors\[name\]\) setErrors\(prev => \(\{ \.\.\.prev, \[name\]: '' \}\)\);\n    \};/);
const handleInputChangeStr = handleInputChangeMatch[0];

// 5. Extract form
const formMatch = addContent.match(/<form onSubmit=\{handleSubmit\} className=\"space-y-8 pt-1\">\s*([\s\S]*?)<\/form>/);
let formContent = formMatch[1];

// Adjust form for EditCompany
formContent = formContent.replace(
    /<button\s*type=\"submit\"\s*disabled=\{loading\}[\s\S]*?<\/button>/,
    `<button
        type="submit"
        disabled={submitting}
        className="px-8 h-10 rounded-xl bg-[#6366F1] text-white font-bold shadow-[0_6px_15px_-4px_rgba(99,102,241,0.3)] hover:shadow-indigo-600/30 hover:-translate-y-0.5 transition-all flex items-center gap-2.5 active:scale-95 group uppercase tracking-widest text-[11px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
    >
        {submitting ? <RefreshCw className="animate-spin" size={14} /> : <>SAVE CHANGES <Plus size={15} className="group-hover:rotate-90 transition-transform" /></>}
    </button>`
);
// In EditCompany, we need password label to say UPDATE PASSWORD *
formContent = formContent.replace(/PASSWORD \*/, 'UPDATE PASSWORD');
formContent = formContent.replace(/placeholder="\*\*\*\*\*\*\*\*"/, 'placeholder="Leave blank to keep current"');


// Update EditCompany.jsx
let newEditContent = editContent;

// Update imports
newEditContent = newEditContent.replace(/import\s+\{([^}]+)\}\s+from\s+'lucide-react';/, `import {\n${lucideImports}} from 'lucide-react';`);
if (!newEditContent.includes('COUNTRY_CODES')) {
    newEditContent = newEditContent.replace(/import { PSA_MODULES } from '\.\.\/\.\.\/constants\/psaModuleCatalog';/, `import { PSA_MODULES } from '../../constants/psaModuleCatalog';\nimport { COUNTRY_CODES } from '../../constants/countryCodes';`);
}

// Update state
newEditContent = newEditContent.replace(/const \[formData, setFormData\] = useState\((\{[\s\S]*?\})\);/, `const [formData, setFormData] = useState(${formDataInit});`);

// Update handleInputChange
newEditContent = newEditContent.replace(/const handleInputChange = \(e\) => \{[\s\S]*?if \(errors\[name\]\) setErrors\(prev => \(\{ \.\.\.prev, \[name\]: '' \}\)\);\n    \};/, handleInputChangeStr);

// Update loadCompany (data mapping)
// We need to carefully update loadCompany to map all fields.
const loadCompanyRegex = /setFormData\(\{\s*code:[\s\S]*?status: data\.status \|\| 'active'\s*\}\);/;
const newLoadCompanyData = `setFormData({
                ...prev, // Keep existing state structure
                code: data.code || data.tenantId || '',
                name: data.companyName || data.name || '',
                email: data.companyEmail || data.meta?.email || data.meta?.primaryEmail || '',
                ownerName: data.ownerName || data.adminName || data.adminUser?.name || '',
                password: '', // Password usually blank on edit
                phoneCode: data.meta?.phoneCode || data.phone?.split('-')[0] || '+91',
                phone: data.phone?.includes('-') ? data.phone.split('-')[1] : (data.phone || ''),
                website: data.meta?.website || data.website || data.domain || '',
                type: data.meta?.type || '',
                subCompanyLimit: data.subCompanyLimit ? String(data.subCompanyLimit) : '',
                gst: data.meta?.gst || '',
                pan: data.meta?.pan || '',
                regNo: data.meta?.regNo || '',
                country: data.meta?.country || 'India',
                state: data.meta?.state || '',
                city: data.meta?.city || '',
                pincode: data.meta?.pincode || '',
                address: data.address || '',
                latitude: data.meta?.latitude || '',
                longitude: data.meta?.longitude || '',
                geofenceRadius: data.meta?.geofenceRadius ? String(data.meta?.geofenceRadius) : '50',
                officeFloor: data.meta?.officeFloor || '',
                signatoryName: data.meta?.signatoryName || '',
                signatoryDesignation: data.meta?.signatoryDesignation || '',
                tan: data.meta?.tan || '',
                cin: data.meta?.cin || '',
                msme: data.meta?.msme || '',
                epf: data.meta?.epf || '',
                esic: data.meta?.esic || '',
                pt: data.meta?.pt || '',
                lwf: data.meta?.lwf || '',
                dateOfIncorporation: data.meta?.dateOfIncorporation || '',
                timezone: data.meta?.timezone || 'Asia/Kolkata',
                currency: data.meta?.currency || 'INR',
                fyStartMonth: data.meta?.fyStartMonth || 'April',
                industry: data.meta?.industry || '',
                userLimit: data.userLimit !== undefined && data.userLimit !== null ? String(data.userLimit) : '',
                enabledModules: normalizeEnabledModules(data.enabledModules, data.modules),
                status: data.status || 'active'
            });`;

newEditContent = newEditContent.replace(loadCompanyRegex, newLoadCompanyData);
// Wait, the prev isn't defined inside loadCompany setFormData. We should just pass an object to setFormData, or use callback `setFormData(prev => ({ ...prev, code: ... }))`.
newEditContent = newEditContent.replace(/setFormData\(\{[\s\S]*?status: data\.status \|\| 'active'\s*\}\);/, `setFormData(prev => ({
                ...prev,
                code: data.code || data.tenantId || '',
                name: data.companyName || data.name || '',
                email: data.companyEmail || data.meta?.email || data.meta?.primaryEmail || '',
                ownerName: data.ownerName || data.adminName || data.adminUser?.name || '',
                password: '', // Password usually blank on edit
                phoneCode: data.meta?.phoneCode || data.phone?.split('-')[0] || '+91',
                phone: data.phone?.includes('-') ? data.phone.split('-')[1] : (data.phone || ''),
                website: data.meta?.website || data.website || data.domain || '',
                type: data.meta?.type || '',
                subCompanyLimit: data.subCompanyLimit ? String(data.subCompanyLimit) : '',
                gst: data.meta?.gst || '',
                pan: data.meta?.pan || '',
                regNo: data.meta?.regNo || '',
                country: data.meta?.country || 'India',
                state: data.meta?.state || '',
                city: data.meta?.city || '',
                pincode: data.meta?.pincode || '',
                address: data.address || '',
                latitude: data.meta?.latitude || '',
                longitude: data.meta?.longitude || '',
                geofenceRadius: data.meta?.geofenceRadius ? String(data.meta?.geofenceRadius) : '50',
                officeFloor: data.meta?.officeFloor || '',
                signatoryName: data.meta?.signatoryName || '',
                signatoryDesignation: data.meta?.signatoryDesignation || '',
                tan: data.meta?.tan || '',
                cin: data.meta?.cin || '',
                msme: data.meta?.msme || '',
                epf: data.meta?.epf || '',
                esic: data.meta?.esic || '',
                pt: data.meta?.pt || '',
                lwf: data.meta?.lwf || '',
                dateOfIncorporation: data.meta?.dateOfIncorporation || '',
                timezone: data.meta?.timezone || 'Asia/Kolkata',
                currency: data.meta?.currency || 'INR',
                fyStartMonth: data.meta?.fyStartMonth || 'April',
                industry: data.meta?.industry || '',
                userLimit: data.userLimit !== undefined && data.userLimit !== null ? String(data.userLimit) : '',
                enabledModules: normalizeEnabledModules(data.enabledModules, data.modules),
                status: data.status || 'active'
            }));`);

// Update handleSubmit payload
const payloadReplacement = `const payload = {
                        companyName: formData.name,
                        companyEmail: formData.email,
                        ownerName: formData.ownerName,
                        phone: formData.phone ? \`\${formData.phoneCode}-\${formData.phone}\` : '',
                        subCompanyLimit: formData.subCompanyLimit ? Number(formData.subCompanyLimit) : 0,
                        userLimit: Number(formData.userLimit),
                        status: formData.status,
                        enabledModules: formData.enabledModules,
                        address: formData.address,
                        domain: formData.website,
                        logo: logoUrl || undefined,
                        meta: {
                            type: formData.type,
                            gst: formData.gst,
                            pan: formData.pan,
                            regNo: formData.regNo,
                            country: formData.country,
                            state: formData.state,
                            city: formData.city,
                            pincode: formData.pincode,
                            logo: logoUrl || undefined,
                            primaryEmail: formData.email,
                            email: formData.email,
                            tan: formData.tan,
                            cin: formData.cin,
                            msme: formData.msme,
                            epf: formData.epf,
                            esic: formData.esic,
                            pt: formData.pt,
                            lwf: formData.lwf,
                            dateOfIncorporation: formData.dateOfIncorporation,
                            timezone: formData.timezone,
                            currency: formData.currency,
                            fyStartMonth: formData.fyStartMonth,
                            industry: formData.industry,
                            signatoryName: formData.signatoryName,
                            signatoryDesignation: formData.signatoryDesignation,
                            latitude: formData.latitude,
                            longitude: formData.longitude,
                            geofenceRadius: formData.geofenceRadius ? Number(formData.geofenceRadius) : 50,
                            officeFloor: formData.officeFloor,
                            phoneCode: formData.phoneCode
                        }
                    };`;

newEditContent = newEditContent.replace(/const payload = \{[\s\S]*?email: formData\.email\n\s*\}\n\s*\};/, payloadReplacement);

// Replace form
newEditContent = newEditContent.replace(/<form onSubmit=\{handleSubmit\} className=\"space-y-4 pt-1\">\s*([\s\S]*?)<\/form>/, `<form onSubmit={handleSubmit} className="space-y-8 pt-1">\n${formContent}\n</form>`);

fs.writeFileSync(path.join(p, 'EditCompany.jsx'), newEditContent);

// NOW DO VIEW COMPANY
const viewContent = fs.readFileSync(path.join(p, 'ViewCompany.jsx'), 'utf8');
let newViewContent = viewContent;
newViewContent = newViewContent.replace(/import\s+\{([^}]+)\}\s+from\s+'lucide-react';/, `import {\n${lucideImports}} from 'lucide-react';`);

console.log("Updated EditCompany.jsx!");
