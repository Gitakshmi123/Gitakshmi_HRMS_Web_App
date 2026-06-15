const bcrypt = require('bcryptjs');

async function testPassword() {
    const isOk = await bcrypt.compare('pnr2026', '$2b$10$Zna/V8nnP.BhBO2ErhTjgO6xZHtlBKcDIQqCpUr1PvkI6IP859cW6');
    console.log("Is pnr2026 the password?", isOk);
}
testPassword();
