import assert from 'node:assert/strict';
import {cpSync,existsSync,readFileSync,rmSync,mkdirSync,statSync} from 'node:fs';
import {join} from 'node:path';

const pages=['index.html','classroom.html','data-explorer.html','lens.html','visual-ideas.html'];
const scripts=['app.js','constellation-layout.js','data.js','history.js','lens-layout.js','lens.js','sheet-config.js','sheet-snapshot.js','sheets.js','views.js','visual-ideas.js'];
const styles=['style.css','design.css','views.css','data-explorer.css','lens.css'];
// Publish an explicit file list so working notes and source backups stay local.
rmSync('dist',{recursive:true,force:true});
mkdirSync('dist');
for(const file of [...pages,...scripts,...styles,'assets','metro'])cpSync(file,join('dist',file),{recursive:true});
for(const page of [...pages,'metro/index.html']){
 const base=new URL(page,'https://chronicle.local/');
 for(const [,ref] of readFileSync(join('dist',page),'utf8').matchAll(/(?:src|href)=["']([^"']+)["']/g)){
  const url=new URL(ref,base);
  if(url.origin!==base.origin)continue;
  let file=join('dist',decodeURIComponent(url.pathname));
  if(existsSync(file)&&statSync(file).isDirectory())file=join(file,'index.html');
  assert.ok(existsSync(file),`${page}: missing ${url.pathname}`);
 }
}
for(const excluded of ['src','outputs','docs','node_modules','.git','.env'])assert.ok(!existsSync(join('dist',excluded)));
console.log('Static site packaged in dist; local page references verified.');
