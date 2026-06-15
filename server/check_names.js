const mongoose = require('mongoose');

async function checkNames() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69ae76d0d0a86653c8f75c29?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        
        const emps = await db.collection('employees').find({ firstName: /Manisha/i }).toArray();
        console.log(`Found ${emps.length} matching employees:`);
        emps.forEach(e => {
            console.log(`ID: ${e._id} | Name: "${e.firstName} ${e.lastName}" | EmpID: ${e.employeeId}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

checkNames();
