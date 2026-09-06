import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
if (existsSync('.git')) execFileSync('git',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,'config','core.hooksPath','.githooks']);
