const fs = require('fs');

try {
    const content = fs.readFileSync('.env', 'utf8');
    const lines = content.split(/\r?\n/);
    let modified = false;

    const newLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('MONGO_URI=')) {
            let val = trimmed.substring('MONGO_URI='.length).trim();
            // Remove surrounding quotes if present
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.substring(1, val.length - 1);
                modified = true;
            }
            // Remove trailing comma
            if (val.endsWith(',')) {
                val = val.substring(0, val.length - 1);
                modified = true;
            }
            // Check for obvious typos
            // e.g. w=majorityr0 -> w=majority
            if (val.includes('w=majorityr0')) {
                val = val.replace('w=majorityr0', 'w=majority');
                modified = true;
            }
            // e.g. w=majority' -> w=majority
            if (val.includes("w=majority'")) {
                val = val.replace("w=majority'", 'w=majority');
                modified = true;
            }

            console.log("Sanitized MONGO_URI:", val.replace(/:([^@]+)@/, ':****@')); // Log masked
            return `MONGO_URI=${val}`;
        }
        return line;
    });

    if (modified) {
        fs.writeFileSync('.env', newLines.join('\n'));
        console.log('Fixed .env format issues.');
    } else {
        console.log('.env format appeared correct.');
    }

} catch (e) {
    console.error("Error fixing env:", e);
}
