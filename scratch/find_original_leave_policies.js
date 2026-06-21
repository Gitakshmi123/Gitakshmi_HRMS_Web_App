const fs = require('fs');
const readline = require('readline');

const fileStream = fs.createReadStream('C:/Users/user/.gemini/antigravity/brain/31b5a9da-bc1a-4769-9bce-16a3d3be3444/.system_generated/logs/transcript.jsonl');

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let count = 0;
rl.on('line', (line) => {
  if (line.includes('LeavePolicies.jsx') && (line.includes('replace_file_content') || line.includes('multi_replace_file_content'))) {
    count++;
    if (count <= 2) {
      console.log(`Occurrence ${count}:`);
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          const args = typeof tc.args === 'string' ? JSON.parse(tc.args) : tc.args;
          console.log(`Step ${obj.step_index} TargetContent:\n`, args.TargetContent ? args.TargetContent.slice(0, 500) : '');
          console.log(`Step ${obj.step_index} ReplacementContent:\n`, args.ReplacementContent ? args.ReplacementContent.slice(0, 500) : '');
        }
      }
    }
  }
});
rl.on('close', () => {
  console.log('Done.');
});
