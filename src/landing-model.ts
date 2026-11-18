import type {EventRecord} from './metro-model';

const highlights: [string,string][] = [
 ['evt_67513cb7d76d4d418068b18a6275e8af','일본 제국 항복'],
 ['evt_fbb7085b8dfe47d592ad1784acee4f64','트루먼 독트린 발표'],
 ['evt_a0dd55fd01d6479f9956477c1a037133','마셜 플랜 발표'],
 ['evt_117e14c7dc3d478b82e85d88ad66a922','베를린 봉쇄'],
 ['evt_35ca38ee62294dc48dced6d8eb3f715c','NATO 출범'],
 ['evt_98824ae6ad134f60a6365fdd82f217ac','소련의 첫 핵실험'],
 ['evt_552598746dd641709f1f579af1ad9281','중화인민공화국 선포'],
 ['evt_77053ffbeaf7499d997e863fc9a46d5f','바르샤바 조약기구 창설'],
 ['evt_e25896aa9a3042908d2f6b6963990dd0','베를린 장벽 설치 결정'],
 ['evt_10e5e4d5b73b445495545537037a3c52','케네디의 베를린 연설'],
 ['evt_567710c37ead4c5cbf429ee2d167c66d','키신저의 비밀 방중'],
 ['evt_1e92cbd4c97440ffb0d0d614359be6ac','닉슨의 중국 방문'],
];
export type ChronicleCard={id:string;title:string;date:string;image:string;href:string};
export function chronicleCards(events:EventRecord[],media:Record<string,string>):ChronicleCard[]{
 return highlights.flatMap(([id,title])=>{
  const event=events.find(event=>event.id===id),image=event?.media.map(item=>media[item.url]).find(Boolean);
  return event&&image?[{id,title,date:event.date,image:'/'+image,href:'/?setup=1&event='+encodeURIComponent(id)}]:[];
 });
}
export function heroPosition(index:number,total:number,width:number,height:number,progress:number){
 const mobile=width<640,angle=index/total*Math.PI*2-Math.PI/2;
 const rx=Math.min(width*(mobile?.4:.39),570),ry=Math.min(height*.35,300);
 const spread=mobile?1.6:1.9,shuffle=.55-Math.min(1,Math.max(0,(progress-.4)/.6))*1.1;
 const arcAngle=-Math.PI/2+(index/Math.max(total-1,1)-.5)*spread+shuffle;
 const radius=width*(mobile?1.3:.8),morph=Math.min(1,Math.max(0,progress)*2.5);
 const circle={x:Math.cos(angle)*rx,y:Math.sin(angle)*ry,rotate:Math.sin(angle)*12};
 const arc={x:Math.cos(arcAngle)*radius,y:Math.sin(arcAngle)*radius+radius+height*.28,rotate:(arcAngle+Math.PI/2)*180/Math.PI};
 return {x:circle.x+(arc.x-circle.x)*morph,y:circle.y+(arc.y-circle.y)*morph,rotate:circle.rotate+(arc.rotate-circle.rotate)*morph,scale:mobile?.72:1};
}
