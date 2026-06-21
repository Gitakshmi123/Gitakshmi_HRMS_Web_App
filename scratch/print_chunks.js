const fs = require('fs');
const readline = require('readline');

const fileStream = fs.createReadStream('C:\\Users\\user\\.gemini\\antigravity\\brain\\31b5a9da-bc1a-4769-9bce-16a3d3be3444\\.system_generated\\logs\\transcript_full.jsonl');

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.includes('"step_index":5166')) {
    const obj = JSON.parse(line);
    const args = typeof obj.tool_calls[0].args === 'string' ? JSON.parse(obj.tool_calls[0].args) : obj.tool_calls[0].args;
    console.log("Chunk 0 Target:");
    console.log(args.ReplacementChunks[0].TargetContent);
    console.log("Chunk 0 Replacement:");
    console.log(args.ReplacementChunks[0].ReplacementContent);
    process.exit(0);
  }
});
