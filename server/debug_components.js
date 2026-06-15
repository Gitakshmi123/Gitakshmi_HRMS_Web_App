const mongoose = require('mongoose');

async function checkComponents() {
    try {
        // This is a guess at the connection string, typically I'd check env files
        // But since I have to work within the tenant context, I'll try to find a way to log from the controller
        console.log("Checking components...");
    } catch (err) {
        console.error(err);
    }
}

checkComponents();
