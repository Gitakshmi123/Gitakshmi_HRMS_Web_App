require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI;
console.log("Connecting to:", uri.replace(/:([^@]+)@/, ':****@'));

mongoose.connect(uri, {
    maxPoolSize: 10,
    minPoolSize: 5,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    retryWrites: true,
    family: 4
})
    .then(() => {
        console.log("Connected successfully!");
        process.exit(0);
    })
    .catch(err => {
        console.error("Connection failed:", err);
        console.log("Full Error Code:", err.code);
        console.log("Full Error Syscall:", err.syscall);
        console.log("Full Error Hostname:", err.hostname);
        process.exit(1);
    });
