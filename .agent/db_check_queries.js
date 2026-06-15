// Quick Database Check Script
// Run this in MongoDB Compass or mongo shell to verify locked snapshots

// 1. Find all LOCKED salary snapshots
db.employeesalarysnapshots.find({
    locked: true
}).pretty()

// 2. Find locked snapshot for a specific applicant
db.employeesalarysnapshots.findOne({
    applicant: ObjectId("YOUR_APPLICANT_ID_HERE"),
    locked: true
})

// 3. Check if snapshot has all required fields
db.employeesalarysnapshots.findOne(
    { locked: true },
    {
        ctc: 1,
        locked: 1,
        lockedAt: 1,
        "earnings.name": 1,
        "earnings.monthlyAmount": 1,
        "earnings.yearlyAmount": 1,
        "breakdown.totalEarnings": 1,
        "breakdown.totalDeductions": 1,
        "breakdown.totalBenefits": 1
    }
)

// Expected Output:
// {
//   "_id": ObjectId("..."),
//   "ctc": 600000,
//   "locked": true,
//   "lockedAt": ISODate("2026-01-21T..."),
//   "earnings": [
//     { "name": "Basic Salary", "monthlyAmount": 25000, "yearlyAmount": 300000 },
//     { "name": "HRA", "monthlyAmount": 12500, "yearlyAmount": 150000 }
//   ],
//   "breakdown": {
//     "totalEarnings": 604200,
//     "totalDeductions": 24000,
//     "totalBenefits": 50600
//   }
// }

// 4. Count locked vs unlocked snapshots
db.employeesalarysnapshots.aggregate([
    {
        $group: {
            _id: "$locked",
            count: { $sum: 1 }
        }
    }
])

// 5. Find applicants with locked salary
db.applicants.find({
    salaryLocked: true
}, {
    name: 1,
    designation: 1,
    salaryLocked: 1
})
