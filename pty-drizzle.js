const pty = require('node-pty');

const p = pty.spawn('npx.cmd', ['drizzle-kit', 'generate'], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: process.env
});

p.onData((data) => {
  process.stdout.write(data);
  if (data.includes('Is total_downloads column in projects table created or renamed')) {
    p.write('\r');
  }
});
