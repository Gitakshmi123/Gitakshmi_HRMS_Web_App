const mongoose = require('mongoose');

async function checkEmployee() {
    const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';
    try {
        await mongoose.connect(MONGO_URI);
        const Employee = mongoose.connection.model('Employee', new mongoose.Schema({}, { strict: false }));
        
        const empCount = await Employee.countDocuments();
        console.log('Total Employees in gitakshmi-one:', empCount);
        
        if (empCount > 0) {
            const anyEmp = await Employee.findOne().lean();
            console.log('Sample Employee:', anyEmp.firstName, anyEmp.lastName, anyEmp._id);
        }

        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkEmployee();
