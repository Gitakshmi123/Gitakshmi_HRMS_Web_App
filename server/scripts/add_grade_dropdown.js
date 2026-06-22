const fs = require('fs');
let code = fs.readFileSync('c:/Users/baldaniya nitesh/Desktop/PROJECT/GT_HRMS/client/src/components/RequirementForm.jsx', 'utf8');

if (!code.includes('const [grades, setGrades] = useState([]);')) {
    code = code.replace(
        /const \[employees, setEmployees\] = useState\(\[\]\);/,
        `const [employees, setEmployees] = useState([]);\n    const [grades, setGrades] = useState([]);`
    );
    
    code = code.replace(
        /fetchEmployees\(\);\n\s*\}, \[\]\);/,
        `fetchEmployees();\n    }, []);\n\n    useEffect(() => {\n        const fetchGrades = async () => {\n            try {\n                const res = await api.get('/hr/grades');\n                const list = Array.isArray(res?.data) ? res.data : (res?.data?.data || res?.data?.grades || []);\n                setGrades(list);\n            } catch (err) {\n                console.error('Failed to load grades', err);\n                setGrades([]);\n            }\n        };\n        fetchGrades();\n    }, []);`
    );
    
    code = code.replace(
        /jobType: 'Full-Time',/,
        `jobType: 'Full-Time',\n        grade: '',`
    );
    
    code = code.replace(
        /jobType: \{ visible: true, isPublic: true, required: false, label: 'Job Type', placeholder: '' \},/,
        `jobType: { visible: true, isPublic: true, required: false, label: 'Job Type', placeholder: '' },\n        grade: { visible: true, isPublic: true, required: false, label: 'Grade', placeholder: 'Select Grade' },`
    );
    
    code = code.replace(
        /\{renderFieldWithControls\('jobType', 'Job Type',/,
        `{renderFieldWithControls('grade', 'Grade',\n                                <div className="relative">\n                                    <select\n                                        value={formData.grade || ''}\n                                        onChange={(e) => updateField('grade', e.target.value)}\n                                        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-4 pr-10 text-sm font-semibold text-slate-800 transition-all hover:bg-slate-50 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"\n                                    >\n                                        <option value="">Select Grade</option>\n                                        {grades.map((g, i) => (\n                                            <option key={i} value={g.name || g._id}>{g.name}</option>\n                                        ))}\n                                    </select>\n                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">\n                                        <ChevronDown size={16} className="text-slate-400" />\n                                    </div>\n                                </div>\n                            )}\n                        {renderFieldWithControls('jobType', 'Job Type',`
    );
    
    fs.writeFileSync('c:/Users/baldaniya nitesh/Desktop/PROJECT/GT_HRMS/client/src/components/RequirementForm.jsx', code);
    console.log('Successfully injected Grade logic!');
} else {
    console.log('Grade logic already injected.');
}
