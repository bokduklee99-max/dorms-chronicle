const records=(()=>{
  const {tables,id,points}=catalogSnapshot;
  const rows=Object.fromEntries(Object.entries(tables).map(([tab,{fields,rows}])=>[tab,rows.map(([n,...v])=>({
    tab,n,...Object.fromEntries(fields.map((f,i)=>[f,v[i]]))
  }))]));
  const key=r=>r?.[tables[r.tab].fields[0]]||'';
  const wall=rows.지도도형.find(row=>row.지도참조키==='geo_berlin_wall');
  if(wall)wall.geometryInfo='MultiLineString · '+catalogSnapshot.wall.length+'개 선 구간';
  return createChronicleRecordViews(rows,{key,id,points,assetRoot:'../..',mapRenderer:()=>catalogPlaceMaps,
    flagFor:(actor,date)=>catalogSnapshot.countryFlags[key(actor)]?.findLast(([day])=>day<=date)?.[1]});
})();
