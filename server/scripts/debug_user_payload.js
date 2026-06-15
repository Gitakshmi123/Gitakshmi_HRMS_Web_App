const SalaryCalculationEngine = require('../services/salaryCalculationEngine');

const payload = {
    "annualCTC": 50000,
    "earnings": [
        {
            "name": "CONVEYANCE ALLOWANCE",
            "calculationType": "FLAT_AMOUNT",
            "amount": 1600,
            "percentage": 0,
            "isActive": true
        },
        {
            "name": "SPECIAL ALLOWANCE",
            "calculationType": "PERCENTAGE_OF_CTC",
            "amount": 0,
            "percentage": 0,
            "isActive": true
        },
        {
            "name": "Book & Periodicals",
            "calculationType": "FLAT_AMOUNT",
            "amount": 1263,
            "percentage": 0,
            "isActive": true
        },
        {
            "name": "Uniform Allowance",
            "calculationType": "FLAT_AMOUNT",
            "amount": 1263,
            "percentage": 0,
            "isActive": true
        },
        {
            "name": "Transport Allowance",
            "calculationType": "FLAT_AMOUNT",
            "amount": 0,
            "percentage": 0,
            "isActive": true
        }
    ],
    "deductions": [],
    "benefits": []
};

console.log("🚀 Starting debug test with user payload (50k CTC)...");
try {
    const result = SalaryCalculationEngine.calculateSalary(payload);
    console.log("\n✅ Result Summary:");
    console.log(`Annual CTC: ₹${result.annualCTC}`);
    console.log(`Earnings Count: ${result.earnings.length}`);
    console.log("\nEarnings Breakdown:");
    result.earnings.forEach(e => {
        console.log(`- ${e.name}: ₹${e.monthly}/mo (Code: ${e.code})`);
    });

    console.log("\nTotals:");
    console.log(JSON.stringify(result.totals, null, 2));

} catch (err) {
    console.error("\n❌ Engine Error:", err);
}
