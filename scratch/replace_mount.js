const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'client', 'src', 'pages', 'HR', 'LeavePolicies.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace <HolidayMasterPanel /> with <HolidayCalendarWorkspace /> under view === 'holiday'
const targetStr = `                {view === 'holiday' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <HolidayMasterPanel />
                    </div>
                )}`;

const replacementStr = `                {view === 'holiday' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <HolidayCalendarWorkspace />
                    </div>
                )}`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully replaced HolidayMasterPanel with HolidayCalendarWorkspace!");
} else {
    // Try with unix newlines
    const targetStrUnix = `                {view === 'holiday' && (\n                    <div className="animate-in slide-in-from-bottom-4 duration-500">\n                        <HolidayMasterPanel />\n                    </div>\n                )}`;
    const replacementStrUnix = `                {view === 'holiday' && (\n                    <div className="animate-in slide-in-from-bottom-4 duration-500">\n                        <HolidayCalendarWorkspace />\n                    </div>\n                )}`;
    if (content.includes(targetStrUnix)) {
        content = content.replace(targetStrUnix, replacementStrUnix);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log("Successfully replaced HolidayMasterPanel with HolidayCalendarWorkspace (Unix)!");
    } else {
        console.log("Could not find the target string in LeavePolicies.jsx");
    }
}
