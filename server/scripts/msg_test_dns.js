require('dotenv').config();
const dns = require('dns');

const uri = process.env.MONGO_URI;
console.log("Loaded MONGO_URI:", uri ? "Yes" : "No");

if (!uri) {
    console.log("No MONGO_URI found.");
    process.exit(1);
}

// Extract hostname
// Format: mongodb+srv://user:pass@hostname/db...
const match = uri.match(/@([^/]+)/);
if (!match) {
    console.log("Could not parse hostname from URI. Is it in standard format?");
    // potentially check if it is not +srv
    console.log("URI starts with:", uri.substring(0, 15));
} else {
    const hostname = match[1];
    console.log("Hostname from URI:", hostname);

    console.log("Attempting to resolve SRV records for:", `_mongodb._tcp.${hostname}`);
    dns.resolveSrv(`_mongodb._tcp.${hostname}`, (err, addresses) => {
        if (err) {
            console.error("DNS SRV resolution failed:", err);

            // Try A record
            console.log("Attempting to resolve A record for:", hostname);
            dns.lookup(hostname, (err, address, family) => {
                if (err) console.error("DNS A lookup failed:", err);
                else console.log("DNS A lookup success:", address);
            });

        } else {
            console.log("DNS SRV resolution success:", addresses);
        }
    });
}
