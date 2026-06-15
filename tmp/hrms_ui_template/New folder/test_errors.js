// Set active state on sidebar
document.querySelectorAll('.menu-item').forEach(item => {
    item.classList.remove('active');
    if (item.innerText.includes('Reports')) {
        item.classList.add('active');
    }
});

// Set active state on report tabs with Javascript Toggling
const tabs = document.querySelectorAll('.report-tab');
const contents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', function () {
        // Remove active classes
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => {
            c.classList.remove('active');
            c.style.display = 'none';
        });

        // Add active class to clicked tab
        this.classList.add('active');

        // Show corresponding content
        const targetId = this.getAttribute('data-target');
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
            targetContent.classList.add('active');
            targetContent.style.display = 'block';
        }
    });
});

// --- Smart Dashboard Logic --- //

const smartStaffData = [
    // Present Employees from Dashboard
    { id: "EMP001", name: "Rahul Sharma", role: "Software Engineer", dept: "Engineering", status: "On-Time", login: "09:00", logout: "18:00" },
    { id: "EMP002", name: "Priya Singh", role: "Product Manager", dept: "Product", status: "Late", login: "09:15", logout: "18:20" },
    { id: "EMP003", name: "Amit Kumar", role: "UI/UX Designer", dept: "Design", status: "Late", login: "09:30", logout: "18:30" },
    { id: "EMP004", name: "Neha Gupta", role: "HR Executive", dept: "HR", status: "On-Time", login: "08:50", logout: "18:00" },
    { id: "EMP005", name: "Vikram Patel", role: "Frontend Dev", dept: "Engineering", status: "On-Time", login: "09:05", logout: "18:05" },
    { id: "EMP031", name: "Simran Kaur", role: "Analyst", dept: "Finance", status: "Late", login: "09:20", logout: "18:20" },
    // Multi-punch Employees from Dashboard
    { id: "EMP012", name: "Suresh Menon", role: "QA Tester", dept: "Engineering", status: "Early Exit", login: "09:10", logout: "16:00" },
    { id: "EMP025", name: "Anjali Verma", role: "Marketing Lead", dept: "Marketing", status: "Early Exit", login: "09:00", logout: "15:30" },
    { id: "EMP034", name: "Karthik Raj", role: "System Admin", dept: "IT", status: "Late", login: "09:30", logout: "18:00" },
];

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

// Calculate percentage positions for timeline
// Assume day window is 09:00 to 18:00 (9 hours total, 540 minutes)
// Anything before 09:00 starts at 0%. Anything after 18:00 caps at 100%.
function calculateTimeline(loginStr, logoutStr) {
    const dayStartMin = 9 * 60; // 09:00
    const dayEndMin = 18 * 60;  // 18:00
    const totalMins = dayEndMin - dayStartMin;

    function timeToMins(tStr) {
        const [h, m] = tStr.split(':').map(Number);
        return (h * 60) + m;
    }

    let inMin = timeToMins(loginStr);
    let outMin = timeToMins(logoutStr);

    // Bound the visualizations strictly to the 9AM - 6PM graphical window
    if (inMin < dayStartMin) inMin = dayStartMin;
    if (outMin > dayEndMin) outMin = dayEndMin;
    if (outMin < inMin) outMin = inMin;

    const leftPct = ((inMin - dayStartMin) / totalMins) * 100;
    const widthPct = ((outMin - inMin) / totalMins) * 100;

    return { left: Math.max(0, leftPct), width: Math.max(0, Math.min(widthPct, 100)) };
}

function getStatusClass(status) {
    if (status === "On-Time") return "shift-on-time";
    if (status === "Late") return "shift-late";
    if (status === "Early Exit") return "shift-early";
    return "";
}

function renderSmartTable(data) {
    const tbody = document.getElementById('smartStaffBody');
    document.getElementById('staffCount').innerText = data.length;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: #a4b0be;">No staff found in this filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(emp => {
        const timeline = calculateTimeline(emp.login, emp.logout);
        // Use a warning color for early exits too
        const fillClass = emp.status === "Late" ? "late" : (emp.status === "Early Exit" ? "early" : "");
        const barColor = emp.status === "Late" ? "#ff7675" : (emp.status === "Early Exit" ? "#f39c12" : "#0984e3");

        return `
                        <tr>
                            <td style="text-align: center;"><input type="checkbox" class="row-checkbox"></td>
                            <td>
                                <a href="#" class="staff-profile-pill">
                                    <div class="staff-avatar">${getInitials(emp.name)}</div>
                                    <div>
                                        <div class="staff-name">${emp.name}</div>
                                        <div class="staff-role">${emp.role}</div>
                                    </div>
                                </a>
                            </td>
                            <td><span style="font-weight: 700; color: #636e72; font-size: 11px;">${emp.dept}</span></td>
                            <td>
                                <div class="shift-status ${getStatusClass(emp.status)}">
                                    <div class="status-dot"></div>
                                    ${emp.status}
                                </div>
                            </td>
                            <td class="timeline-cell">
                                <div class="timeline-header">
                                    <span>09:00</span>
                                    <span>18:00</span>
                                </div>
                                <div class="timeline-container">
                                    <div class="timeline-fill" style="left: ${timeline.left}%; width: ${timeline.width}%; background-color: ${barColor};"></div>
                                </div>
                                <div class="timeline-time-info">${emp.login} &rarr; ${emp.logout}</div>
                            </td>
                        </tr>
                    `;
    }).join('');
}

// Filter logic by Card Click
function filterByCard(type) {
    // Reset department dropdown visually when a card is clicked
    document.getElementById('deptFilter').value = 'All';

    if (type === 'All' || type === 'On-Duty') {
        // In this mockup, all array members are treated as "On-Duty". 
        renderSmartTable(smartStaffData);
    } else if (type === 'Late') {
        renderSmartTable(smartStaffData.filter(e => e.status === "Late"));
    }
}

// Initialization & Interactivity
document.addEventListener("DOMContentLoaded", () => {
    // Update Top Summary Cards dynamically based on the dataset
    document.getElementById('staffTotalCount').innerText = smartStaffData.length;
    document.getElementById('staffLateCount').innerText = smartStaffData.filter(e => e.status === "Late").length;
    document.getElementById('staffOnDutyCount').innerText = smartStaffData.length; // Assuming all in list are on-duty for this mockup

    renderSmartTable(smartStaffData);

    // Department Filter
    document.getElementById('deptFilter').addEventListener('change', function () {
        const dept = this.value;
        if (dept === "All") renderSmartTable(smartStaffData);
        else renderSmartTable(smartStaffData.filter(e => e.dept === dept));
    });

    // Select All Checkbox
    document.getElementById('selectAll').addEventListener('change', function () {
        const isChecked = this.checked;
        document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = isChecked);
    });

    // Render Initial Movements Data
    renderMovements(movementData);

    // Movement Filter
    document.getElementById('movementFilter').addEventListener('change', function () {
        const status = this.value;
        if (status === "All") renderMovements(movementData);
        else renderMovements(movementData.filter(m => m.status === status));
    });
});

// Send Reminder Action
function sendReminder() {
    const selected = document.querySelectorAll('.row-checkbox:checked').length;
    if (selected === 0) {
        alert('Please select at least one staff member to send a reminder.');
        return;
    }
    alert(`Reminder emails successfully queued for ${selected} selected staff members!`);
}

// Error Catcher - Just in case
window.addEventListener('error', function (event) {
    console.error("Caught unhandled JS Error: ", event.message);
    const tb = document.getElementById('movementBody');
    if (tb && tb.children.length === 0) {
        tb.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">JS Error: ${event.message}</td></tr>`;
    }
});

// --- Replacement Movements Logic --- //

const movementData = [
    {
        id: "MOV001",
        position: "Backend Developer",
        dept: "Engineering",
        previous: { name: "Sneha Reddy", id: "EMP008" },
        resignedOn: "15 Oct 2023",
        status: "Active",
        sla: "12 Days",
        performance: "Excellent",
        isAlert: false
    },
    {
        id: "MOV002",
        position: "Sales Executive",
        dept: "Sales",
        previous: { name: "Ravi Shankar", id: "EMP015" },
        resignedOn: "20 Oct 2023",
        status: "Pending",
        sla: "35 Days",
        performance: "Good",
        isAlert: true // Alerting high SLA delay
    },
    {
        id: "MOV003",
        position: "HR Manager",
        dept: "Human Resources",
        previous: { name: "Karan Johar", id: "EMP019" },
        resignedOn: "01 Nov 2023",
        status: "Completed",
        sla: "18 Days",
        performance: "Average",
        isAlert: false
    }
];

function renderMovements(data) {
    const tbody = document.getElementById('movementBody');

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px; color: #a4b0be;">No movements found matching criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(mov => {
        const statusLower = mov.status.toLowerCase();
        const alertClass = mov.isAlert ? "row-alert-orange" : "";

        let perfColor = "#00b894";
        if (mov.performance === "Good") perfColor = "#0984e3";
        if (mov.performance === "Average") perfColor = "#fdcb6e";

        return `
                        <tr class="${alertClass}">
                            <td>
                                <div style="font-weight: 700; color: #2d3436; font-size: 13px;">${mov.position}</div>
                                <div style="font-weight: 600; color: #a4b0be; font-size: 11px;">${mov.dept}</div>
                            </td>
                            <td>
                                <div class="staff-profile-pill">
                                    <div class="staff-avatar" style="background-color: #f1f2f6; color: #636e72;">${getInitials(mov.previous.name)}</div>
                                    <div>
                                        <div class="staff-name">${mov.previous.name}</div>
                                        <div class="staff-role">${mov.previous.id}</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span style="font-weight: 600; color: #636e72; font-size: 12px;"><i class="far fa-calendar-alt" style="margin-right: 5px; color: #b2bec3;"></i>${mov.resignedOn}</span>
                            </td>
                            <td>
                                <span class="status-badge ${statusLower}" style="font-size: 10px; padding: 3px 8px; border-radius: 12px; font-weight: 700;">
                                    ${mov.status}
                                </span>
                            </td>
                            <td>
                                <div style="font-weight: 700; color: #2d3436; font-size: 13px;">${mov.sla}</div>
                            </td>
                            <td>
                                <span style="font-size: 11px; font-weight: 700; color: ${perfColor}; background-color: ${perfColor}15; padding: 4px 8px; border-radius: 4px;">
                                    ${mov.performance}
                                </span>
                            </td>
                        </tr>
                    `;
    }).join('');
}

