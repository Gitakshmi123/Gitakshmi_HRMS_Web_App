const fs = require('fs');
const readline = require('readline');

const fileStream = fs.createReadStream('C:\\Users\\user\\.gemini\\antigravity\\brain\\31b5a9da-bc1a-4769-9bce-16a3d3be3444\\.system_generated\\logs\\transcript_full.jsonl');

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.includes('"step_index":5740')) {
    console.log(line);
    process.exit(0);
  }
});
