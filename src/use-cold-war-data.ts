import {useEffect,useState} from 'react';
import {coldWarData} from './metro-model';

export function useColdWarData(enabled=true){
 const source = window.HistorySource;
 const [data,setData] = useState(()=>coldWarData(source.data));
 const [status,setStatus] = useState('저장된 시트 데이터');
 useEffect(()=>{
  if(!enabled)return;
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),10000);
  async function refresh(){
   try {
    const response = await fetch(source.config.feedUrl+'&v='+Math.floor(Date.now()/60000),{signal:controller.signal,credentials:'omit'});
    if(!response.ok)throw new Error('feed');
    const fresh = coldWarData(source.SheetData.build(source.SheetData.decodeFeed(source.SheetData.parseCSV(await response.text()))));
    if(!fresh.events.length)throw new Error('empty feed');
    if(!cancelled)setData(previous=>JSON.stringify(previous)===JSON.stringify(fresh)?previous:fresh);
    setStatus('공개 시트 연결됨');
   } catch {
    if(!cancelled)setStatus('저장된 시트 데이터 · 연결 확인 필요');
   } finally { clearTimeout(timeout); }
  }
  let cancelled=false;
  void refresh();
  return ()=>{cancelled=true;clearTimeout(timeout);controller.abort();};
 },[enabled,source]);
 return {data,status};
}
