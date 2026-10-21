import {mkdir,copyFile,writeFile} from 'node:fs/promises';

await mkdir('docs',{recursive:true});
await copyFile('dist/index.html','docs/index.html');
await copyFile('THIRD_PARTY_NOTICES.md','docs/THIRD_PARTY_NOTICES.md');
await writeFile('docs/.nojekyll','');
console.log('GitHub Pages files ready in docs/.');
