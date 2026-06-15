import os

path = r'c:\Users\baldaniya nitesh\Desktop\GT_HRMS\GT_HRMS\server\controllers\attendance.controller.js'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = lines[:]

# Task 1: Fix validateLocation block
target1 = "// Check if attendance already exists for today"
for i, line in enumerate(new_lines):
    if target1 in line:
        start = i
        end = -1
        for j in range(i, len(new_lines)):
            if "if (attendance)" in new_lines[j]:
                brace_count = 0
                for k in range(j, len(new_lines)):
                    brace_count += new_lines[k].count('{')
                    brace_count -= new_lines[k].count('}')
                    if brace_count == 0:
                        end = k
                        break
                break
        if end != -1:
            replacement = [
                "        const { AttendanceSettings } = getModels(req);\n",
                "        const settings = await AttendanceSettings.findOne({ tenant: officeTenantId });\n",
                "        let attendance = await Attendance.findOne({\n",
                "            employee: employeeId,\n",
                "            tenant: officeTenantId,\n",
                "            date: today\n",
                "        });\n",
                "\n",
                "        if (attendance && settings?.punchMode === 'single') {\n",
                "            return res.status(400).json({\n",
                "                message: \"Attendance already marked for today\",\n",
                "                data: attendance\n",
                "            });\n",
                "        }\n"
            ]
            new_lines = new_lines[:start] + replacement + new_lines[end+1:]
        break

# Task 2: Fix punch function (Line 577 approx)
target2 = "// Attendance exists - determine next punch type"
for i, line in enumerate(new_lines):
    if target2 in line:
        start = i
        # find the const nextPunchType line
        ptr = i
        while ptr < len(new_lines) and "nextPunchType =" not in new_lines[ptr]:
            ptr += 1
        
        replacement = [
            "        const lastLog = attendance.logs[attendance.logs.length - 1];\n",
            "        let nextPunchType = (lastLog && lastLog.type === 'IN') ? 'OUT' : 'IN';\n",
            "\n",
            "        if (req.body.action === 'IN' || req.body.action === 'RESUME') nextPunchType = 'IN';\n",
            "        if (req.body.action === 'OUT' || req.body.action === 'BREAK') nextPunchType = 'OUT';\n",
            "\n",
            "        // Sequence Validation\n",
            "        if (lastLog && nextPunchType === lastLog.type) {\n",
            "             return res.status(400).json({ error: f'Already {nextPunchType == \"IN\" ? \"Checked-In\" : \"Checked-Out\"}.' if False else ('Already ' + ('In' if nextPunchType == 'IN' else 'Out')) });\n",
            "        }\n"
        ]
        # Wait! python string formatting sucks here. I'll just use a simple string.
        replacement[-2] = "             return res.status(400).json({ error: `You are already ${nextPunchType === 'IN' ? 'In' : 'Out'}.` });\n"
        
        new_lines = new_lines[:start+1] + replacement + new_lines[ptr+1:]
        break

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("SUCCESS: Patched manual punch and validateLocation")
