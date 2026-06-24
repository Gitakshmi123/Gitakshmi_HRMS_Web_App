const mongoose = require('mongoose');
require('dotenv').config({path: './.env'});

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    // Assuming the database is GT_HRMS
    const db = mongoose.connection.useDb('GT_HRMS'); // we'll update this if needed
    
    // We don't know the exact tenant ID here, but the user is testing
    console.log("Connected to MongoDB.");
    process.exit(0);
}).catch(console.error);
