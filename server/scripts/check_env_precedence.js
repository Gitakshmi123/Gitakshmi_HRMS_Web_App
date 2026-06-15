console.log("Pre-dotenv MONGO_URI:", process.env.MONGO_URI || "undefined");
require('dotenv').config();
console.log("Post-dotenv MONGO_URI:", process.env.MONGO_URI || "undefined");
