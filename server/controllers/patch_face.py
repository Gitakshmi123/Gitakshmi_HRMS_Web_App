import os

path = r'c:\Users\baldaniya nitesh\Desktop\GT_HRMS\GT_HRMS\server\controllers\face-attendance.controller.js'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
target = "if (settings.punchMode === 'single') {"
found = False
for i, line in enumerate(lines):
    if target in line and not found:
        # We replace the whole block from 692 to 707
        # Actually I'll find its matching brace
        brace_count = 0
        start_idx = i
        for j in range(i, len(lines)):
            brace_count += lines[j].count('{')
            brace_count -= lines[j].count('}')
            if brace_count == 0:
                end_idx = j
                break
        
        # Construct replacement
        replacement = [
            "    if (settings.punchMode === 'single') {\n",
            "      if (nextPunchType === 'IN' && attendance?.checkIn) {\n",
            "        return res.status(400).json({ success: false, error: 'ALREADY_MARKED', message: 'Attendance already marked for today' });\n",
            "      }\n",
            "      if (nextPunchType === 'OUT' && attendance?.checkOut) {\n",
            "        return res.status(400).json({ success: false, error: 'ALREADY_CHECKED_OUT', message: 'You have already checked out for today' });\n",
            "      }\n",
            "    } else {\n",
            "      // MULTI Mode Sequence Validation\n",
            "      const last = attendance?.logs?.length > 0 ? attendance.logs[attendance.logs.length - 1] : null;\n",
            "      if (last && last.type === nextPunchType) {\n",
            "        return res.status(400).json({ \n",
            "          success: false, \n",
            "          error: 'INVALID_SEQUENCE', \n",
            "          message: `Already ${nextPunchType === 'IN' ? 'Checked-In' : 'Checked-Out'}.` \n",
            "        });\n",
            "      }\n",
            "    }\n"
        ]
        new_lines = lines[:start_idx] + replacement + lines[end_idx+1:]
        found = True
        break

if found:
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("SUCCESS: Patched verifyFaceAttendance")
else:
    print("ERROR: Target line not found")
