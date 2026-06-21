const fs = require('fs');
const readline = require('readline');

const fileStream = fs.createReadStream('C:\\Users\\user\\.gemini\\antigravity\\brain\\31b5a9da-bc1a-4769-9bce-16a3d3be3444\\.system_generated\\logs\\transcript_full.jsonl');

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.includes('LeavePolicies.jsx') && (line.includes('replace_file_content') || line.includes('multi_replace_file_content'))) {
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
            const args = typeof tc.args === 'string' ? JSON.parse(tc.args) : tc.args;
            console.log(`Step ${obj.step_index}: ${tc.name} - Instruction: ${args.Instruction || args.Description}`);
          }
        }
      }
    } catch(e) {}
  }
});
