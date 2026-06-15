const fs = require('fs');
const path = require('path');

function appendHiringLog(line) {
  try {
    const dir = path.join(process.cwd(), 'server', 'logs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'hiring.log');
    fs.appendFileSync(file, `${new Date().toISOString()} ${line}\n`);
  } catch (_) {
    // best effort logging only
  }
}

module.exports = { appendHiringLog };

