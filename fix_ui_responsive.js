const fs = require('fs');
const path = require('path').join(__dirname, 'client', 'src', 'pages', 'HR', 'Applicants.jsx');
let content = fs.readFileSync(path, 'utf8');

// 1. Remove shadows from active stepper buttons (Finalized, Rejected, and general Active)
content = content.replace(/shadow-xl shadow-slate-200 scale-105/g, '');
content = content.replace(/shadow-xl shadow-rose-100 scale-105/g, '');
content = content.replace(/shadow-xl shadow-teal-100 scale-105/g, '');

// 2. Remove shadows from Candidate card Action buttons
content = content.replace(/shadow-xl shadow-slate-200 transform group-hover:scale-\[1\.02\] active:scale-95/g, 'transform active:scale-95');

// 3. Improve Responsiveness in Candidate Card
// Ensure Candidate ID / Name section is flexible
content = content.replace(/<div className="flex gap-4">/g, '<div className="flex flex-col sm:flex-row gap-3 sm:gap-4">');

// Ensure stats grid in candidate card is responsive
content = content.replace(/<div className="flex flex-col gap-2\.5 mb-6">/g, '<div className="flex flex-col gap-2 sm:gap-2.5 mb-6">');

// 4. Fix mangled search icon once and for all
content = content.replace(/<span className="absolute left-3 top-1\/2 -translate-y-1\/2 text-slate-400">ðŸ” <\/span>/,
    '<span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={16} /></span>');


fs.writeFileSync(path, content);
console.log('Successfully removed shadows and improved responsiveness');
