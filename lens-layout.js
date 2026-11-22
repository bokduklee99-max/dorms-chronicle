'use strict';
globalThis.LensLayout = (() => {
  const CW=142, CH=52;
  function layout(events,topics,mode,start,end) {
    const W=Math.max(1180,(end-start+1)*170+76);
    const counts=Array.from({length:end-start+1},(_,i)=>events.filter(e=>e.year===start+i).length);
    const height=Math.max(740,Math.max(0,...counts)*70+160);
    const hub=topics[0];
    let ring=0;
    const anchors=topics.map(t=>{if(t===hub)return {...t,x:W/2,y:height/2-40};const angle=-Math.PI/2+(ring++)*Math.PI*2/Math.max(1,topics.length-1);return {...t,x:W/2+W*.35*Math.cos(angle),y:height/2+height*.36*Math.sin(angle)};});
    const byTopic=new Map(anchors.map(a=>[a.topic_id,a]));
    const placed=new Map(),seen=new Map();
    for(const e of events) {
      const row=seen.get(e.year)||0;seen.set(e.year,row+1);
      let x=38+(e.year-start)*(W-76)/(end-start+1)+(W-76)/(end-start+1)/2-CW/2,y=100+row*70;
      if(mode==='topics') {
        const group=e.directTopicIds.map(id=>byTopic.get(id)).filter(Boolean);
        const i=events.indexOf(e),angle=i*2.39996;
        x=(group.reduce((s,a)=>s+a.x,0)/(group.length||1)||W/2)-CW/2+Math.cos(angle)*85;
        y=(group.reduce((s,a)=>s+a.y,0)/(group.length||1)||height/2)+70+Math.sin(angle)*70;
      }
      placed.set(e.id,{x,y});
    }
    if(mode==='topics') {
      const targets=new Map([...placed].map(([id,p])=>[id,{...p}]));
      for(let k=0;k<260;k++) {
        for(const [id,p] of placed){const t=targets.get(id);p.x+=(t.x-p.x)*.035;p.y+=(t.y-p.y)*.035;}
        for(let i=0;i<events.length;i++)for(let j=i+1;j<events.length;j++){
          const a=placed.get(events[i].id),b=placed.get(events[j].id),dx=b.x-a.x,dy=b.y-a.y;
          if(Math.abs(dx)<CW+12&&Math.abs(dy)<CH+12){
            const py=(CH+12-Math.abs(dy))/2+.1,px=(CW+12-Math.abs(dx))/2+.1;
            if(py<px){const sign=dy>=0?1:-1;a.y-=py*sign;b.y+=py*sign;}else{const sign=dx>=0?1:-1;a.x-=px*sign;b.x+=px*sign;}
          }
        }
        for(const p of placed.values()){p.x=Math.max(18,Math.min(W-CW-18,p.x));p.y=Math.max(145,Math.min(height-CH-20,p.y));}
      }
      // Snap to nearby free slots so dense clusters retain readable, nonoverlapping cards.
      const slots=[];
      for(let y=146;y+CH<=height-20;y+=64)for(let x=18;x+CW<=W-18;x+=159){
        if(!anchors.some(a=>x<a.x+145&&x+CW>a.x-145&&y<a.y+16&&y+CH>a.y-25))slots.push({x,y});
      }
      for(const e of events){const p=placed.get(e.id);let best=0;slots.forEach((s,i)=>{if((s.x-p.x)**2+(s.y-p.y)**2<(slots[best].x-p.x)**2+(slots[best].y-p.y)**2)best=i;});if(slots.length)placed.set(e.id,slots.splice(best,1)[0]);}
    }
    return {positions:placed,anchors,width:W,height,cardWidth:CW,cardHeight:CH};
  }
  return {layout};
})();
