import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({base:'./',plugins:[tailwindcss()],publicDir:false,build:{outDir:'metro',rollupOptions:{
 input:{metro:'metro.html',landing:'landing.html','data-explorer':'data-explorer.js'},
 output:{entryFileNames:chunk=>chunk.name==='data-explorer'?'assets/data-explorer.js':'assets/[name]-[hash].js'},
}}});
