const path = require('path');
const fs = require('fs');
require('dotenv').config();
const dir = path.join(__dirname, '..', 'controllers');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
console.log('Controllers and exported keys:');
for (const f of files) {
  const p = path.join(dir, f);
  try {
    const ctrl = require(p);
    console.log('-', f);
    const keys = Object.keys(ctrl);
    if (keys.length === 0) console.log('  (no exports)');
    else keys.forEach(k => console.log('  ', k));
  } catch (err) {
    console.log('-', f, '-> ERROR requiring:', err.message);
  }
}
