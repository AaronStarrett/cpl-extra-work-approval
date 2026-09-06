import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const git=(args)=>execFileSync('git',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,...args],{encoding:'utf8'}).trim();
const staged=process.argv.includes('--staged');
const names=git(staged?['diff','--cached','--name-only','--diff-filter=ACM']:['ls-files','--cached','--others','--exclude-standard']).split('\n').filter(Boolean);
for(const name of names){
 if(/(^|\/)(\.env|\.dev\.vars)|\.(sqlite|db|sql\.backup)$/.test(name)) throw new Error(`Private file: ${name}`);
 if(/\.(png|jpg|webp|woff2?|pdf)$/.test(name)) continue;
 const body=staged?git(['show',`:${name}`]):readFileSync(name,'utf8');
 if(/(?:gh[pousr]_[A-Za-z0-9]{30,}|cf(?:at|ut|k)_[A-Za-z0-9_-]{40,}|sk-[A-Za-z0-9_-]{30,}|(?:review\/[a-z0-9-]+|recover)#[A-Za-z0-9_-]{40,})/i.test(body)) throw new Error(`Secret-shaped value: ${name}`);
}
console.log(`Public source check passed (${names.length} files).`);
