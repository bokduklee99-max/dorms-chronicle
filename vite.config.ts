import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {localStudioSession} from './scripts/local-studio-session.mjs';
export default defineConfig({base:'./',plugins:[tailwindcss(),localStudioSession],publicDir:false,build:{outDir:'metro',rollupOptions:{
 preserveEntrySignatures:'exports-only',
 input:{'studio-client':'src/studio-client.js',metro:'metro.html',landing:'landing.html','data-explorer':'data-explorer.js','classroom-workspace':'src/classroom-workspace.ts'},
 output:{
  entryFileNames:chunk=>['studio-client','data-explorer','classroom-workspace'].includes(chunk.name)?'assets/[name].js':'assets/[name]-[hash].js',
  assetFileNames:asset=>asset.names.includes('data-explorer.css')?'assets/[name][extname]':'assets/[name]-[hash][extname]',
 },
}}});
