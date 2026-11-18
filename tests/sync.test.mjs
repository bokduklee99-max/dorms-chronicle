import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

test('failed reads retain data and a content-only live feed updates and caches successfully',async()=>{
  const elements=new Map(),cache=new Map();
  const element=selector=>{
    if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',value:'',hidden:false,dataset:{},classList:{toggle(){}},addEventListener(){},setAttribute(){},removeAttribute(){},getBoundingClientRect(){return {width:900,height:400};}});
    return elements.get(selector);
  };
  let failure=new Error('offline');const calls=[];
  const context=vm.createContext({URL,AbortSignal,console,document:{hidden:false,querySelector:element,querySelectorAll:()=>[],addEventListener(){},documentElement:{dataset:{theme:'light'}}},window:{WORLD:[],addEventListener(){}},localStorage:{getItem:key=>cache.get(key)||null,setItem:(key,value)=>cache.set(key,value)},setInterval(){},clearInterval(){},setTimeout(){},clearTimeout(){},fetch:async(url,options)=>{calls.push(options);if(failure instanceof Error)throw failure;return {ok:true,text:async()=>failure};}});
  for(const name of ['sheet-config.js','sheet-snapshot.js','sheets.js','history.js','data.js','views.js','app.js'])vm.runInContext(readFileSync(new URL('../'+name,import.meta.url),'utf8'),context);
  await vm.runInContext('syncSheet()',context);
  const initial=vm.runInContext('JSON.stringify(EVENTS)',context);
  assert.equal(JSON.parse(initial).length,167);
  assert.match(element('#sheet-status').textContent,/시트를 읽지 못해 저장된 167개/);
  failure='<html>sign in</html>';
  await vm.runInContext('syncSheet()',context);
  assert.equal(vm.runInContext('JSON.stringify(EVENTS)',context),initial);
  assert.match(element('#sheet-status').textContent,/시트를 읽지 못해/);
  assert.equal(element('#refresh-sheet').disabled,false);
  assert.ok(calls.every(options=>options.credentials==='omit'));
  assert.equal(cache.size,0);
  const raw=context.SHEET_SNAPSHOT.tables;
  const rows=Object.entries(raw).flatMap(([name,records])=>{
    const headers=Object.keys(records[0]);
    return [[name,...headers],...records.map(record=>[name,...headers.map(key=>typeof record[key]==='boolean'?String(record[key]).toUpperCase():record[key])])];
  });
  failure=rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
  await vm.runInContext('syncSheet()',context);
  assert.match(element('#sheet-status').textContent,/시트 연결됨 · 167개 사건/);
  assert.equal(vm.runInContext('JSON.stringify(EVENTS)',context),initial);
  assert.equal(cache.size,1);
  vm.runInContext("reading.decade=1960;renderCountries();reading.networkBasis='relations';renderNetwork();",context);
  assert.doesNotMatch(element('#country-board').innerHTML,/href=""/);
  assert.doesNotMatch(element('#network-board').innerHTML,/734217008|출처/);
});
