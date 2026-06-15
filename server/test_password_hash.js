const bcrypt = require('bcryptjs');

async function test() {
    const password = '123456789';
    const hash = '$2b$10$kvP38wA6VwXBllyKBslzOeZnYfiArNuTc5cbrko7MXyv6KPfYS5ba';
    const match = await bcrypt.compare(password, hash);
    console.log('Match:', match);
}

test();
