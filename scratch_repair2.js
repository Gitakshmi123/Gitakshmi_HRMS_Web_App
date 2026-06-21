const fs = require('fs');
const filePath = 'c:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/HR/LeavePolicies.jsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

const funcsStart = lines.findIndex(l => l.includes('// Excel bulk upload handler') && lines.indexOf(l) > 4000);
if (funcsStart !== -1) {
    lines.splice(funcsStart);
}

// Find HolidayMasterPanel return
const hmpReturn = lines.findIndex(l => l.includes('function HolidayMasterPanel() {'));
let returnIdx = -1;
for (let i = hmpReturn; i < lines.length; i++) {
    if (lines[i].includes('    return (')) {
        returnIdx = i;
        break;
    }
}

const funcsBlock = `    // Excel bulk upload handler
    const handleExcelUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Reset input so same file can be re-uploaded
        e.target.value = '';

        const allowed = ['.xlsx', '.xls', '.csv'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowed.includes(ext)) {
            showToast('error', 'Invalid File', 'Only .xlsx, .xls or .csv files are supported.');
            return;
        }

        setBulkUploading(true);
        setBulkPreview([]);
        setBulkErrors([]);
        setBulkSummary(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/holidays/bulk/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setBulkPreview(res.data.preview || []);
            setBulkErrors(res.data.errors || []);
            setBulkSummary(res.data.summary || null);
            setShowBulkModal(true);
        } catch (err) {
            showToast('error', 'Upload Failed', err.response?.data?.error || 'Failed to parse the file.');
        } finally {
            setBulkUploading(false);
        }
    };

    // Confirm bulk import
    const handleBulkConfirm = async () => {
        setBulkConfirming(true);
        try {
            const res = await api.post('/holidays/bulk/confirm', {
                holidays: bulkPreview,
                skipDuplicates
            });
            const s = res.data.summary;
            showToast('success', 'Import Complete', \`✅ \${s.saved} saved · \${s.skipped} skipped · \${s.errors} errors\`);
            setShowBulkModal(false);
            setBulkPreview([]);
            setBulkSummary(null);
            fetchHolidays();
        } catch (err) {
            showToast('error', 'Import Failed', err.response?.data?.error || 'Failed to save holidays.');
        } finally {
            setBulkConfirming(false);
        }
    };

    // Download sample Excel template
    const downloadTemplate = () => {
        const csv = \`Holiday Name,Date,End Date,Type,Description\\nDiwali,12-Nov-2026,,Festival,Festival of Lights\\nRepublic Day,26-Jan-2026,,National,National Holiday\\nHoli,14-Mar-2026,15-Mar-2026,Festival,Festival of Colors\\n\`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'holiday_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };
`;

lines.splice(returnIdx, 0, funcsBlock);

fs.writeFileSync(filePath, lines.join('\n'));
