const fs = require('fs');
const readline = require('readline');

const fileStream = fs.createReadStream('C:/Users/user/.gemini/antigravity/brain/31b5a9da-bc1a-4769-9bce-16a3d3be3444/.system_generated/logs/transcript.jsonl');

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.includes('LeavePolicies.jsx') && (line.includes('flex-1 flex overflow-hidden') || line.includes('Unified Full-Workspace') || line.includes('Left Pane') || line.includes('Right Pane'))) {
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          const args = typeof tc.args === 'string' ? JSON.parse(tc.args) : tc.args;
          console.log(`Step ${obj.step_index}:`);
          console.log("Target:", args.TargetContent ? args.TargetContent.slice(0, 300) : '');
          console.log("Replacement:", args.ReplacementContent ? args.ReplacementContent.slice(0, 300) : '');
          if (args.ReplacementChunks) {
            args.ReplacementChunks.forEach((c, idx) => {
              console.log(`Chunk ${idx} Target:`, c.TargetContent ? c.TargetContent.slice(0, 300) : '');
              console.log(`Chunk ${idx} Replacement:`, c.ReplacementContent ? c.ReplacementContent.slice(0, 300) : '');
            });
          }
          console.log('===');
        }
      }
    } catch(e) {}
  }
});
