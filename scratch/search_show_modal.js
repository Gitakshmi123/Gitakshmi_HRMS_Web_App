const fs = require('fs');
const readline = require('readline');

const fileStream = fs.createReadStream('C:/Users/user/.gemini/antigravity/brain/31b5a9da-bc1a-4769-9bce-16a3d3be3444/.system_generated/logs/transcript.jsonl');

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.includes('LeavePolicies.jsx') && line.includes('showModal')) {
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          const args = typeof tc.args === 'string' ? JSON.parse(tc.args) : tc.args;
          if (args.TargetContent && args.TargetContent.includes('w-[400px]')) {
            console.log(`Step ${obj.step_index}:`);
            console.log("Target:", args.TargetContent.slice(0, 300));
            console.log("Replacement:", args.ReplacementContent ? args.ReplacementContent.slice(0, 300) : '');
            console.log('===');
          }
          if (args.ReplacementChunks) {
            args.ReplacementChunks.forEach(c => {
              if (c.TargetContent && c.TargetContent.includes('w-[400px]')) {
                console.log(`Step ${obj.step_index} Chunk:`);
                console.log("Target:", c.TargetContent.slice(0, 300));
                console.log("Replacement:", c.ReplacementContent.slice(0, 300));
                console.log('===');
              }
            });
          }
        }
      }
    } catch(e) {}
  }
});
