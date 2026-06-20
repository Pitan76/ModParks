const pty = require('node:child_process');

// We use spawn with stdio: 'inherit'? No, we need a pseudo-terminal (PTY) to fake isTTY, but node doesn't have built-in PTY.
// Wait, we can just patch process.stdout.isTTY in the script that runs drizzle-kit.
