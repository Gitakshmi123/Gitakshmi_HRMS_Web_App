import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(clientRoot, '..');
const distDir = path.join(clientRoot, 'dist');
const staleRoot = path.join(repoRoot, 'tmp');

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function removeWithRetry(target, attempts = 12) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      return true;
    } catch (error) {
      const retryable = ['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(error?.code);
      if (!retryable || attempt === attempts) {
        throw error;
      }
      sleep(250 * attempt);
    }
  }
  return false;
}

if (!fs.existsSync(distDir)) {
  process.exit(0);
}

try {
  removeWithRetry(distDir);
} catch (error) {
  fs.mkdirSync(staleRoot, { recursive: true });
  const staleDir = path.join(staleRoot, `client-dist-stale-${Date.now()}`);

  try {
    fs.renameSync(distDir, staleDir);
    try {
      removeWithRetry(staleDir, 6);
    } catch {
      // A background scanner may still hold a file. Leaving the moved folder in tmp
      // is safer than failing the build before Vite can write a fresh dist.
    }
  } catch (renameError) {
    console.error('[clean-dist] Unable to clear client/dist:', renameError.message || error.message);
    process.exit(1);
  }
}
