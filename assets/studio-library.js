export function clearBrowserPackages(storage=localStorage){
 for(const key of Object.keys(storage)){
  if(key.startsWith('chronicle.package.v1.')||key.startsWith('chronicle.package-studio.mock.v1.'))storage.removeItem(key);
 }
}

export function studioDraftDirectory([header=[],...rows]){
 const key=header.indexOf('패키지ID'),name=header.indexOf('패키지명'),school=header.indexOf('학교급'),course=header.indexOf('과목'),status=header.indexOf('작성상태');
 if([key,name,status].includes(-1))throw Error('패키지 시트의 작성상태와 열 이름을 확인해 주세요.');
 const published=new Set(),drafts=new Map();
 for(const row of rows){
  const raw=row[key];
  if(!raw)continue;
  if(row[status]!=='작성 중'){published.add(raw);continue;}
  const id=raw.startsWith('draft:')?raw.split(':')[1]:raw;
  if(id)drafts.set(id,{id,name:row[name]||'이름 없는 초안',school:row[school]||'',course:row[course]||''});
 }
 for(const id of published)drafts.delete(id);
 return {drafts,published};
}
