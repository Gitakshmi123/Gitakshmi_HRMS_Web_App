const mongoose = require('mongoose');

function mockGetModels(db) {
    if (!db.models.Requirement) {
        db.model('Requirement', require('./models/Requirement'));
    }
    return {
        Applicant: db.model("Applicant", require('./models/Applicant')),
        EmployeeSalarySnapshot: db.model("EmployeeSalarySnapshot", require('./models/EmployeeSalarySnapshot')),
        SalaryAssignment: db.model("SalaryAssignment", require('./models/SalaryAssignment')),
        Employee: db.model("Employee", require('./models/Employee'))
    };
}

async function resolveLetterSalarySnapshot(db, { employeeId, applicantId, target, targetType }) {
    const { EmployeeSalarySnapshot, SalaryAssignment } = mockGetModels(db);
    const query = employeeId ? { employee: employeeId } : { applicant: applicantId };
    let snapshot = await EmployeeSalarySnapshot.findOne(query).sort({ createdAt: -1 }).lean();

    if (!snapshot && target) {
        const snapId = target.currentSalarySnapshotId || target.salarySnapshotId;
        if (snapId) snapshot = await EmployeeSalarySnapshot.findById(snapId).lean();
        if (!snapshot && targetType === 'employee' && target.salarySnapshots?.length > 0) {
            snapshot = await EmployeeSalarySnapshot.findById(target.salarySnapshots[target.salarySnapshots.length - 1]).lean();
        }
    }

    return snapshot;
}

async function main() {
    try {
        const uri = "mongodb+srv://techdhruv16_db_user:FpXqAuXiuyi51JLx@cluster0.cpfocff.mongodb.net/?appName=Cluster0";
        await mongoose.connect(uri);
        const db = mongoose.connection.useDb("company_pnr");
        
        const applicantId = '6a2a5153ba273320e57dddea'; // Candidate "NEW"
        const { Applicant } = mockGetModels(db);
        const target = await Applicant.findById(applicantId).populate('requirementId');
        
        const snapshot = await resolveLetterSalarySnapshot(db, { applicantId, target, targetType: 'applicant' });
        console.log("Resolved Snapshot for NEW found:", !!snapshot);
        if (snapshot) {
            console.log("Snapshot ID:", snapshot._id);
            console.log("Snapshot ctc:", snapshot.ctc);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
