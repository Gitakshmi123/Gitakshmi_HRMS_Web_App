const fs = require('fs');
const readline = require('readline');

const fileStream = fs.createReadStream('C:/Users/user/.gemini/antigravity/brain/31b5a9da-bc1a-4769-9bce-16a3d3be3444/.system_generated/logs/transcript.jsonl');

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let output = '';
rl.on('line', (line) => {
  if (line.includes('LeavePolicies.jsx') && (line.includes('"step_index":5166') || line.includes('"step_index":5223') || line.includes('"step_index":5236') || line.includes('"step_index":5287'))) {
    try {
      const obj = JSON.parse(line);
      output += `=== STEP ${obj.step_index} ===\n`;
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          const args = typeof tc.args === 'string' ? JSON.parse(tc.args) : tc.args;
          output += `Tool: ${tc.name}\n`;
          output += `Instruction: ${args.Instruction || args.Description}\n`;
          if (args.TargetContent) {
            output += `Target:\n${args.TargetContent}\n`;
            output += `Replacement:\n${args.ReplacementContent}\n`;
          }
          if (args.ReplacementChunks) {
            args.ReplacementChunks.forEach((c, i) => {
              output += `Chunk ${i} Target:\n${c.TargetContent}\n`;
              output += `Chunk ${i} Replacement:\n${c.ReplacementContent}\n`;
            });
          }
        }
      }
      output += `\n`;
    } catch(e) {}
  }
});
rl.on('close', () => {
  fs.writeFileSync('scratch/edits_log.txt', output, 'utf8');
  console.log('Written to scratch/edits_log.txt');
});
