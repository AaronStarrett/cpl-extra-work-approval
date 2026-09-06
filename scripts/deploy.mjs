import { readFileSync, mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
if (!config.d1_databases?.[0]?.database_id || !config.vars?.TURNSTILE_SITE_KEY) throw new Error('Production D1 binding and Turnstile site key must be configured before deployment.');
const run = args => execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args], { stdio: 'inherit' });
run(['d1', 'migrations', 'apply', 'DB', '--remote']);
// CI stores the app-specific key encrypted. This temporary input never enters Git or command arguments.
let secretDir, secretFile;
try {
 if (process.env.TURNSTILE_SECRET_KEY) {
  secretDir = mkdtempSync(join(tmpdir(), 'cpl-extra-work-secrets-'));
  secretFile = join(secretDir, 'worker-secrets.json');
  writeFileSync(secretFile, JSON.stringify({ TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY }), { mode: 0o600 });
 }
 run(['deploy', ...(secretFile ? ['--secrets-file', secretFile] : [])]);
} finally {
 if (secretFile) unlinkSync(secretFile);
 if (secretDir) rmdirSync(secretDir);
}
