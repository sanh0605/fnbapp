const { execSync } = require('child_process');
try {
  const output = execSync('npx tsc --noEmit', { encoding: 'utf-8', cwd: process.cwd() });
  console.log("SUCCESS:\n" + output);
} catch (e) {
  console.log("ERROR:\n" + e.stdout);
}
