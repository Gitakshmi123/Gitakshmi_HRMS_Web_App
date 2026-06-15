const mongoose = require('mongoose');
const RoleSchema = require('./models/Role');
const UserSchema = require('./models/User');

// Use a simple worker script to seed default roles
async function seedRoles() {
    try {
        const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
        await mongoose.connect(mongoURI);
        console.log('🌱 Connected to MongoDB for seeding...');

        const Role = mongoose.model('Role', RoleSchema);

        const defaultRoles = [
            {
                name: 'Admin',
                description: 'Full system access',
                permissions: [
                    { module: 'HR & Personnel', section: 'Management Access', actions: { view: true, create: true, edit: true, delete: true } },
                    { module: 'Payroll & Salary', section: 'Management Access', actions: { view: true, create: true, edit: true, delete: true } },
                    { module: 'Attendance & Time', section: 'Management Access', actions: { view: true, create: true, edit: true, delete: true } },
                    { module: 'Tickets', section: 'Support', actions: { view: true, create: true, edit: true, delete: true } }
                ],
                isDefault: true
            },
            {
                name: 'HR',
                description: 'Manage employees, payroll, and recruitment',
                permissions: [
                    { 
                        module: 'HR & Personnel', 
                        section: 'Management Access', 
                        actions: { view: true, create: true, edit: true, delete: false, addEmployee: true } 
                    },
                    { 
                        module: 'Payroll & Salary', 
                        section: 'Management Access', 
                        actions: { view: true, runPayroll: true, approvePayroll: false } 
                    },
                    { 
                        module: 'Recruitment', 
                        section: 'Hiring', 
                        actions: { view: true, createJob: true, scheduleInterview: true, takeInterview: true, hire: false } 
                    },
                    { module: 'Attendance & Time', section: 'Management Access', actions: { view: true, create: true, edit: true, delete: false } },
                    { module: 'Tickets', section: 'Support', actions: { view: true, create: true, edit: true, delete: true } }
                ],
                isDefault: true
            },
            {
                name: 'Manager',
                description: 'Manage team and contribute to hiring',
                permissions: [
                    { module: 'HR & Personnel', section: 'Management Access', actions: { view: true, create: false, edit: false, delete: false } },
                    { 
                        module: 'Payroll & Salary', 
                        section: 'Finance', 
                        actions: { view: true, runPayroll: false, approvePayroll: true } 
                    },
                    { 
                        module: 'Recruitment', 
                        section: 'Hiring', 
                        actions: { view: true, takeInterview: true, hire: true } 
                    },
                    { module: 'Attendance & Time', section: 'Management Access', actions: { view: true, create: true, edit: false, delete: false } },
                    { module: 'Tickets', section: 'Support', actions: { view: true, create: true, edit: false, delete: false } }
                ],
                isDefault: true
            },
            {
                name: 'Employee',
                description: 'Personal access only',
                permissions: [
                    { module: 'Dashboard', section: 'WORKSPACE', actions: { view: true, create: false, edit: false, delete: false } },
                    { module: 'My Attendance', section: 'WORKSPACE', actions: { view: true, create: true, edit: false, delete: false } },
                    { module: 'My Payslips', section: 'WORKSPACE', actions: { view: true, create: false, edit: false, delete: false } },
                    { module: 'Tickets', section: 'Support', actions: { view: true, create: true, edit: false, delete: false } }
                ],
                isDefault: true
            }
        ];

        for (const roleData of defaultRoles) {
            await Role.findOneAndUpdate(
                { name: roleData.name, isDefault: true },
                roleData,
                { upsert: true, new: true }
            );
            console.log(`✅ Role seeded: ${roleData.name}`);
        }

        console.log('🚀 Default roles seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

// In a real app, this would be a script or run on startup.
// Since I'm an agent, I'll just create the file and the user can run it.
// Actually, I can run it if I have the env vars.
seedRoles();
