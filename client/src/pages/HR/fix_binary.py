path = 'Applicants.jsx'
with open(path, 'rb') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if b'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' in line:
        new_lines.append(b'                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></span>\n')
    elif b'req.location' in line and b'req.jobType' in line:
        new_lines.append(b'                                            {req.location || "Remote"} | {req.jobType || "Full-time"}\n')
    else:
        new_lines.append(line)

with open(path, 'wb') as f:
    f.writelines(new_lines)
print('Done')
