const { spawn } = require('child_process');

const p = spawn('npx', ['drizzle-kit', 'generate'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' }
});

p.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('STDOUT:', output);
  if (output.includes('You are about to delete')) {
    p.stdin.write('\n'); // press enter (accept)
  }
  if (output.includes('Did you rename')) {
    p.stdin.write('n\n'); // say no, we want to drop and add
  }
});

p.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString());
});

p.on('close', (code) => {
  console.log(`Child exited with code ${code}`);
});
