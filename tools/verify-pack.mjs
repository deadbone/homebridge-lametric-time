import { execFileSync } from 'node:child_process';

const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});

const [pack] = JSON.parse(output);
const files = new Set(pack.files.map((file) => file.path));
const requiredFiles = ['dist/index.js', 'assets/plugin-icon.png', 'config.schema.json', 'README.md', 'LICENSE'];
const missing = requiredFiles.filter((file) => !files.has(file));

if (missing.length > 0) {
  console.error(`Package archive is missing required files: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`Package archive contains required files: ${requiredFiles.join(', ')}`);
