import {readFileSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
// Keep the shared theme after page CSS when Vite extracts it into a common chunk.
for (const path of ['metro/landing.html','metro/metro.html']) {
 const html=readFileSync(path,'utf8');
 const theme=html.match(/<link[^>]+href="[^"]*chronicle-theme-[^"]+\.css"[^>]*>/)?.[0];
 if(!theme)throw new Error(`Missing Chronicle theme in ${path}`);
 writeFileSync(path,html.replace(theme,'').replace('</head>',theme+'\n</head>'));
}
writeFileSync('index.html',readFileSync('metro/landing.html','utf8').replaceAll('./assets/','/metro/assets/'));
unlinkSync('metro/landing.html');
renameSync('metro/metro.html','metro/index.html');
