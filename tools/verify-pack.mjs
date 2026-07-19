import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const packDirectory = mkdtempSync(join(tmpdir(), 'lametric-pack-'));

try {
  execFileSync('npm', ['pack', '--pack-destination', packDirectory], {
    encoding: 'utf8',
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  const archives = readdirSync(packDirectory).filter((file) => file.endsWith('.tgz'));
  if (archives.length !== 1) {
    console.error(`Expected one package archive, found ${archives.length}.`);
    process.exit(1);
  }

  const archivePath = join(packDirectory, archives[0]);
  const output = execFileSync('tar', ['-tzf', archivePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const files = new Set(output.split('\n').filter(Boolean).map((file) => file.replace(/^package\//u, '')));
  const requiredFiles = ['dist/index.js', 'assets/plugin-icon.png', 'config.schema.json', 'README.md', 'CHANGELOG.md', 'LICENSE'];
  const missing = requiredFiles.filter((file) => !files.has(file));

  if (missing.length > 0) {
    console.error(`Package archive is missing required files: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`Package archive contains required files: ${requiredFiles.join(', ')}`);
} finally {
  rmSync(packDirectory, { recursive: true, force: true });
}
