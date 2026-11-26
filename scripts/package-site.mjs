import assert from 'node:assert/strict';
import {cpSync,existsSync,readFileSync,readdirSync,rmSync,mkdirSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const pages=['index.html','example/index.html','classroom.html','data-explorer.html','sheet-schema-dashboard.html','package-studio.html','history-map.html','lens.html','visual-ideas.html','japan.html','swimlane.html','swimlane-focus.html','event-map-demo.html','cuba-story.html','berlin-story.html','asia-stories.html','territory-map.html'];
const scripts=['app.js','constellation-layout.js','data.js','history.js','lens-layout.js','lens.js','sheet-config.js','sheet-snapshot.js','sheets.js','views.js','visual-ideas.js','japan-board.js','swimlane-data.js','event-map-links.js'];
const styles=['style.css','design.css','views.css','data-explorer.css','lens.css','japan-board.css'];
const catalogDir='mockups/modal-catalog/';
pages.push(catalogDir+'index.html');
const catalogFiles=['catalog.css','catalog.js','specimens.js','records.js','place-map.js','sheet-data.js'].map(file=>catalogDir+file);
const studioUiDir='mockups/studio-ui/';
pages.push(studioUiDir+'index.html');
const studioUiFiles=['gallery.css','gallery.js'].map(file=>studioUiDir+file);
// Publish an explicit file list so working notes and source backups stay local.
rmSync('dist',{recursive:true,force:true});
mkdirSync('dist');
for(const file of [...pages,...scripts,...styles,...catalogFiles,...studioUiFiles,'assets','metro'])cpSync(file,join('dist',file),{recursive:true});
const entryFiles=readdirSync('metro/assets');
for(const [page,attribute,source,entry] of [
 ['classroom.html','content','/src/classroom-workspace.ts','classroom-workspace'],
 ['data-explorer.html','src','./data-explorer.js','data-explorer'],
]){
 const matches=entryFiles.filter(file=>file.startsWith(entry+'-')&&file.endsWith('.js'));
 assert.equal(matches.length,1,`Expected one bundled ${entry} entry`);
 const path=join('dist',page);
 const html=readFileSync(path,'utf8');
 const reference=`${attribute}="${source}"`;
 assert.ok(html.includes(reference),`${page}: missing ${reference}`);
 writeFileSync(path,html.replace(reference,`${attribute}="/metro/assets/${matches[0]}"`));
}
for(const page of [...pages,'metro/index.html']){
 const base=new URL(page,'https://chronicle.local/');
 const html=readFileSync(join('dist',page),'utf8').replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi,'$1');
 for(const [,ref] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
  const url=new URL(ref,base);
  if(url.origin!==base.origin)continue;
  let file=join('dist',decodeURIComponent(url.pathname));
  if(existsSync(file)&&statSync(file).isDirectory())file=join(file,'index.html');
  assert.ok(existsSync(file),`${page}: missing ${url.pathname}`);
 }
}
for(const excluded of ['src','outputs','docs','node_modules','.git','.env'])assert.ok(!existsSync(join('dist',excluded)));
console.log('Static site packaged in dist; local page references verified.');
