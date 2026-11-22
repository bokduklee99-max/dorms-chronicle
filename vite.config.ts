import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({base:'./',plugins:[tailwindcss()],publicDir:false,build:{outDir:'metro',rollupOptions:{
 preserveEntrySignatures:'exports-only',
 input:{'example-lesson':'src/ExampleLesson.tsx','studio-client':'src/studio-client.js',metro:'metro.html',landing:'landing.html','data-explorer':'data-explorer.js','classroom-workspace':'src/classroom-workspace.ts'},
 output:{
  entryFileNames:chunk=>['example-lesson','studio-client','data-explorer','classroom-workspace'].includes(chunk.name)?'assets/[name].js':'assets/[name]-[hash].js',
  assetFileNames:asset=>asset.names.includes('data-explorer.css')?'assets/[name][extname]':'assets/[name]-[hash][extname]',
 },
}}});
