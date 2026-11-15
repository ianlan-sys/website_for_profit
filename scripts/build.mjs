import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const frontend=fileURLToPath(new URL('../frontend/',import.meta.url));
const dist=fileURLToPath(new URL('../dist/',import.meta.url));
await fs.mkdir(dist,{recursive:true});
await fs.cp(frontend,dist,{recursive:true});
await fs.writeFile(new URL('../dist/config.js',import.meta.url),"window.YIQIAN_CONFIG = Object.freeze({mode: 'demo', apiBase: ''});\n");
console.log('Built dist/ for the private Sites preview. VPS serves frontend/ and backend/.');
