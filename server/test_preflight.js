require('dotenv').config();
const mongoose = require('mongoose');
const payrollService = require('./services/payroll.service');
const { ObjectId } = mongoose.Types;

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const db = mongoose.connection.client.db('company_demo');
    const tenantId = new ObjectId('6a3ac6d5e82947dfe3b970d2');
    
    // We can't easily run preflightPayrollRun because it expects mongoose models on req.tenantDB
    // We can inject a mock db object that behaves like tenantDB
    const mockDb = {
        model: (name) => {
            if (name === 'Employee') {
                return {
                    find: (filter) => {
                        console.log('Employee.find filter:', JSON.stringify(filter));
                        return {
                            select: () => ({
                                lean: async () => {
                                    return await db.collection('employees').find(filter).toArray();
                                }
                            })
                        };
                    }
                };
            }
            if (name === 'PayrollRun') return {
                findOne: () => ({ lean: async () => null })
            };
            if (name === 'Attendance') return {
                find: () => ({ lean: async () => [] })
            };
            if (name === 'Payslip') return {
                find: () => ({ lean: async () => [] })
            };
            return {};
        }
    };
    
    const options = {
        selectedEmployeeIds: [
            new ObjectId('6a3b0c8faf5be7cfe9a525bb'), // Dhruv
            new ObjectId('6a3b94114f6f69dae48794b6')  // Rakesh
        ]
    };
    
    const preflight = await payrollService.preflightPayrollRun(
        mockDb,
        tenantId,
        6,
        2026,
        null,
        options
    );
    
    console.log('Blockers:', preflight.blockers);
    console.log('Warnings:', preflight.warnings);
    process.exit(0);
});
