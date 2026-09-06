import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const local = config.env?.local;
const localDatabase = local?.d1_databases?.find(database => database.binding === 'DB');
if (local?.vars?.ENVIRONMENT !== 'local' || !localDatabase ||
    config.d1_databases?.some(database => database.database_id === localDatabase.database_id)) {
  throw new Error('Browser tests require the separate local-only D1 configuration.');
}
const run = (entry, args) => execFileSync(process.execPath, [entry, ...args], { stdio: 'inherit' });
const wrangler = 'node_modules/wrangler/bin/wrangler.js';
const localState = ['--local', '--env', 'local', '--persist-to', '.local/browser-state'];
run(wrangler, ['d1', 'migrations', 'apply', 'DB', ...localState]);
// Browser suites use their own local state and fresh server. Reset only synthetic
// quota metadata between runs; no remote operation is accepted.
run(wrangler, ['d1', 'execute', 'DB', ...localState, '--command', 'DELETE FROM rate_limits']);
run('node_modules/@playwright/test/cli.js', ['test']);
